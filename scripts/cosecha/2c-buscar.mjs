/**
 * Paso 2c: buscar activamente en los municipios que se quedaron sin nada.
 *
 * Aquí no hay enlace a una publicación concreta: hay una cuenta. Así que se
 * abre el perfil del ayuntamiento y se leen las miniaturas de su rejilla, que
 * traen en el `alt` el texto de cada publicación. Si alguna habla de Ceuta y es
 * de los días del acto, se apunta su enlace para cosecharla después con el
 * cosechador de siempre.
 *
 * Buscar y cosechar van separados a propósito: así lo encontrado se puede mirar
 * antes de bajarlo, y un fallo al bajar no obliga a repetir la búsqueda.
 *
 *   node scripts/cosecha/2c-buscar.mjs --red instagram [--tope 20]
 */
import { appendFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

import { comprobarDatos, DATOS } from "./lib/rutas.mjs";
import { estaBloqueado } from "./lib/redes.mjs";

const HALLAZGOS = path.join(DATOS, "hallazgos.ndjson");
const PERFIL = process.env.PERFIL ?? path.join(os.homedir(), ".cosecha-ceuta", "perfil");

/* En la rejilla de un perfil, el `alt` que pone Instagram NO trae el texto de la
   publicación, sólo el autor y la fecha: «Photo by Ayuntamiento de X on
   September 02, 2026». Así que aquí no se busca por palabras, se busca por
   fecha, que además es más fiable: del 26 de agosto al 4 de septiembre está
   todo lo que puede hablar del acto —la convocatoria y la crónica—, y lo de
   fuera no. */
const MESES = ["january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december"];
const DESDE = "2026-08-26";
const HASTA = "2026-09-04";

function fechaDelAlt(alt) {
  const m = String(alt ?? "").toLowerCase().match(/on (\w+) (\d{1,2}), (\d{4})/);
  if (!m) return null;
  const mes = MESES.indexOf(m[1]);
  if (mes < 0) return null;
  return `${m[3]}-${String(mes + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

const args = process.argv.slice(2);
const opcion = (n, def = null) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const tope = Number(opcion("--tope", 0));
const red = opcion("--red", "instagram");
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * En Facebook se busca al revés que en Instagram: aquí el muro SÍ trae el texto
 * de cada publicación, así que se busca por la palabra. Lo que no trae fiable es
 * la fecha —la pone como «hace 4 días»—, y por eso la comprobación de fechas se
 * deja para cuando se cosecha.
 */
async function buscarEnPagina(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  /* El muro carga por tandas y las publicaciones del acto tienen ya unos días,
     así que hay que bajar un rato. Se para en cuanto aparece algo que hable de
     Ceuta: no hace falta recorrer el muro entero. */
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const hay = await page.evaluate(() =>
      /ceuta/i.test(document.body?.innerText ?? "")).catch(() => false);
    if (hay) break;
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(2000);
  }

  return page.evaluate(() => {
    const salida = [];
    for (const art of document.querySelectorAll('[role="article"]')) {
      const texto = (art.innerText ?? "").replace(/\s+/g, " ").trim();
      if (!/ceuta/i.test(texto)) continue;
      const enlace = art.querySelector(
        'a[href*="/posts/"], a[href*="story_fbid"], a[href*="/photos/"], a[href*="/videos/"]');
      if (!enlace) continue;
      salida.push({ href: enlace.href.split("?")[0], alt: texto.slice(0, 220) });
    }
    return salida;
  });
}

/** De «https://www.instagram.com/aytox/?hl=es» a «aytox». */
function cuentaDe(url) {
  const m = String(url ?? "").match(/instagram\.com\/([\w.]+)/);
  return m && !["p", "reel", "explore"].includes(m[1]) ? m[1] : null;
}

async function buscarEnPerfil(page, cuenta) {
  await page.goto(`https://www.instagram.com/${cuenta}/`,
    { waitUntil: "domcontentloaded", timeout: 45000 });
  const corte = await estaBloqueado(page);
  if (corte) {
    const err = new Error(corte);
    err.bloqueo = true;
    throw err;
  }
  await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  /* La rejilla carga de doce en doce. Se baja mientras lo más antiguo que se ve
     siga siendo posterior al acto: si el ayuntamiento publica a diario, las de
     septiembre están enterradas. Y se para en cuanto asoma algo anterior, para
     no recorrer el perfil entero. */
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const masAntigua = await page.evaluate(() => {
      const alts = [...document.querySelectorAll('a[href*="/p/"] img, a[href*="/reel/"] img')]
        .map((i) => i.alt ?? "");
      return alts[alts.length - 1] ?? "";
    });
    if (fechaDelAlt(masAntigua) && fechaDelAlt(masAntigua) < DESDE) break;
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1800);
  }

  return page.evaluate(() => {
    const salida = [];
    for (const a of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
      const img = a.querySelector("img");
      salida.push({ href: a.href, alt: img?.alt ?? "" });
    }
    return salida;
  });
}

async function main() {
  const sinFoto = JSON.parse(await readFile(path.join(DATOS, "sin-foto.json"), "utf8"));
  const yaVistos = new Set();
  try {
    for (const l of (await readFile(HALLAZGOS, "utf8")).split("\n")) {
      if (l.trim()) yaVistos.add(JSON.parse(l).clave);
    }
  } catch { /* la primera vez no hay fichero */ }

  const enFacebook = (m) => m.fb_hoja ?? m.fb ?? null;
  let pendientes = sinFoto
    .filter((m) => (red === "facebook" ? enFacebook(m) : cuentaDe(m.ig)))
    .filter((m) => !yaVistos.has(`${m.municipio}|${m.provincia}|${red}`));
  if (tope) pendientes = pendientes.slice(0, tope);

  console.log(`${pendientes.length} municipios sin foto con ${red} conocido\n`);
  if (!pendientes.length) return;

  const ctx = await chromium.launchPersistentContext(PERFIL, {
    channel: "chrome", headless: false, locale: "es-ES", timezoneId: "Europe/Madrid",
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled", "--disable-extensions"],
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();

  let encontrados = 0;
  for (const [n, m] of pendientes.entries()) {
    const cuenta = red === "facebook" ? enFacebook(m) : cuentaDe(m.ig);
    let fila = { clave: `${m.municipio}|${m.provincia}|${red}`, municipio: m.municipio,
      provincia: m.provincia, cuenta, red };
    try {
      const rejilla = red === "facebook"
        ? await buscarEnPagina(page, cuenta)
        : await buscarEnPerfil(page, cuenta);
      const conFecha = rejilla.map((r) => ({ ...r, fecha: fechaDelAlt(r.alt) }));
      // En Instagram manda la fecha; en Facebook, que el texto hable de Ceuta.
      const buenas = red === "facebook"
        ? conFecha
        : conFecha.filter((r) => r.fecha && r.fecha >= DESDE && r.fecha <= HASTA);
      const ultima = conFecha.map((r) => r.fecha).filter(Boolean).sort().at(-1);
      fila = { ...fila, publicaciones: rejilla.length, ultima_publicacion: ultima,
        hallazgos: buenas.map((b) => ({ url: b.href, fecha: b.fecha, texto: b.alt })) };
      if (buenas.length) encontrados++;
      console.log(`${buenas.length ? "✓" : "·"} ${String(n + 1).padStart(3)}/${pendientes.length} ` +
        `${String(m.municipio).slice(0, 24).padEnd(26)} @${cuenta.slice(0, 22).padEnd(24)} ` +
        `${String(rejilla.length).padStart(3)} vistas · ${buenas.length} ` +
        (red === "facebook" ? "sobre Ceuta" : "en fechas") +
        (ultima ? ` · última ${ultima}` : " · sin fechas legibles"));
    } catch (err) {
      if (err.bloqueo) {
        console.error(`\n✋ ${err.message}. Se para: lo encontrado hasta aquí está apuntado.`);
        await ctx.close();
        process.exitCode = 2;
        return;
      }
      fila = { ...fila, error: `${err.name}: ${err.message}`.slice(0, 140) };
      console.log(`✗ ${String(n + 1).padStart(3)}/${pendientes.length} ${m.municipio}: ${err.message.slice(0, 60)}`);
    }
    await appendFile(HALLAZGOS, JSON.stringify({ t: new Date().toISOString(), ...fila }) + "\n");
    await dormir(7000 + Math.random() * 6000);
  }

  await ctx.close();
  console.log(`\n${encontrados} municipios con publicación en las fechas del acto`);
}

comprobarDatos();
await main();
