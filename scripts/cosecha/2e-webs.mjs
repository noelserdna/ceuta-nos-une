/**
 * Paso 2e: buscar en las webs municipales de los que siguen sin nada.
 *
 * Esta vía no necesita navegador ni sesión: se le pregunta a la propia web. Casi
 * todas las webs de ayuntamiento son WordPress o parecidas, y todas entienden
 * alguna forma de «búscame esto». Se prueban las cuatro más comunes y, si
 * ninguna contesta, se mira la portada, que en un pueblo pequeño suele tener la
 * noticia a la vista.
 *
 * Lo que se apunta es la URL de la noticia; bajarla es cosa de 2-prensa.mjs, que
 * ya sabe sacar la foto del artículo.
 *
 *   node scripts/cosecha/2e-webs.mjs [--tope 20]
 */
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

import { comprobarDatos, DATOS } from "./lib/rutas.mjs";
import { pedir } from "./lib/web.mjs";

const HALLAZGOS = path.join(DATOS, "hallazgos-web.ndjson");

/* Las cuatro formas de buscar que cubren casi todo: WordPress, Joomla y los dos
   apaños más frecuentes. */
const BUSCADORES = ["?s=ceuta", "?buscar=ceuta", "buscar?q=ceuta", "search?q=ceuta"];

const args = process.argv.slice(2);
const tope = Number(args.includes("--tope") ? args[args.indexOf("--tope") + 1] : 0);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Enlaces de la página que huelen a noticia sobre Ceuta. */
function enlacesConCeuta(html, base) {
  const salida = new Map();
  for (const m of html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const [, href, dentro] = m;
    const texto = dentro.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    /* Vale con que hable de Ceuta el texto del enlace o la propia dirección: en
       muchas webs el titular va en el `title` y la URL lleva el resumen. */
    if (!/ceuta/i.test(texto) && !/ceuta/i.test(href)) continue;
    try {
      const abs = new URL(href, base);
      /* Los botones de «compartir» llevan la dirección de la noticia dentro de
         la suya, así que hablan de Ceuta sin ser la noticia: entraban enlaces a
         WhatsApp y a AddToAny como si fueran artículos. La regla que los quita
         a todos de una vez es exigir que el enlace sea del propio sitio. */
      if (abs.hostname.replace(/^www\./, "") !== new URL(base).hostname.replace(/^www\./, "")) continue;
      // Ni canales ni ficheros: se busca una noticia que leer.
      if (/[?&](format|type)=(feed|rss)|\.(rss|xml|pdf|jpg|png|zip|docx?)$/i.test(abs.href)) continue;
      /* Y tampoco la propia página de resultados: un buscador enlaza a sus
         propios filtros («ordenar por fecha», «última semana»), y todos llevan
         la palabra buscada dentro. */
      if (/[?&](s|q|buscar|search)=/i.test(abs.search) || /\/(buscar|search)\b/i.test(abs.pathname)) continue;
      if (!salida.has(abs.href)) salida.set(abs.href, texto.slice(0, 160));
    } catch { /* href inservible */ }
  }
  return [...salida].map(([url, texto]) => ({ url, texto }));
}

async function buscarEnWeb(web) {
  const base = web.startsWith("http") ? web : `http://${web}`;
  const intentos = [];
  for (const forma of BUSCADORES) {
    const url = new URL(forma, base.endsWith("/") ? base : base + "/").href;
    try {
      const { texto: html, url: final } = await pedir(url, { tiempo: 18000 });
      const hallados = enlacesConCeuta(html, final);
      intentos.push({ forma, encontrados: hallados.length });
      if (hallados.length) return { via: forma, hallazgos: hallados, intentos };
    } catch (err) {
      intentos.push({ forma, error: err.message.slice(0, 40) });
    }
  }
  // Nadie contestó a la búsqueda: se mira la portada.
  try {
    const { texto: html, url: final } = await pedir(base, { tiempo: 18000 });
    const hallados = enlacesConCeuta(html, final);
    return { via: "portada", hallazgos: hallados, intentos };
  } catch (err) {
    return { via: null, hallazgos: [], intentos, error: err.message.slice(0, 60) };
  }
}

comprobarDatos();

const sinFoto = JSON.parse(await readFile(path.join(DATOS, "sin-foto.json"), "utf8"));
let pendientes = sinFoto.filter((m) => m.web);
if (tope) pendientes = pendientes.slice(0, tope);
console.log(`${pendientes.length} municipios sin foto con web municipal conocida\n`);

let conAlgo = 0;
for (const [n, m] of pendientes.entries()) {
  const r = await buscarEnWeb(m.web);
  if (r.hallazgos.length) conAlgo++;
  await appendFile(HALLAZGOS, JSON.stringify({
    t: new Date().toISOString(), clave: `${m.municipio}|${m.provincia}`,
    municipio: m.municipio, provincia: m.provincia, web: m.web, red: "web", ...r,
  }) + "\n");
  console.log(`${r.hallazgos.length ? "✓" : r.error ? "✗" : "·"} ` +
    `${String(n + 1).padStart(3)}/${pendientes.length} ${m.municipio.slice(0, 26).padEnd(28)} ` +
    `${String(r.via ?? "sin respuesta").padEnd(14)} ${r.hallazgos.length} enlaces` +
    (r.error ? ` · ${r.error}` : ""));
  await dormir(1200);
}
console.log(`\n${conAlgo} municipios con alguna noticia sobre Ceuta en su web`);
