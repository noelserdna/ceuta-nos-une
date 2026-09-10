/**
 * Paso 2d: pasar los hallazgos de la búsqueda a la lista de trabajo.
 *
 * La búsqueda por perfil no sabe de qué va cada publicación: sólo sabe que es
 * de los días del acto. Así que entran como candidatas —marcadas «por
 * comprobar»— y quien decide si son del acto es el ojo, después de cosecharlas.
 * Se anotan con su cuenta como crédito, que es de quien son.
 *
 *   node scripts/cosecha/2d-anotar.mjs [--desde 2026-09-02] [--hasta 2026-09-03]
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { comprobarDatos, DATOS } from "./lib/rutas.mjs";

const args = process.argv.slice(2);
const opcion = (n, def) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const desde = opcion("--desde", "2026-09-02");
const hasta = opcion("--hasta", "2026-09-03");

comprobarDatos();

const hoja = JSON.parse(await readFile(path.join(DATOS, "hoja.json"), "utf8"));
const hallazgos = (await readFile(path.join(DATOS, "hallazgos.ndjson"), "utf8"))
  .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

const yaEstan = new Set(hoja.publicaciones.map((p) => p.url));
const municipios = new Map(hoja.municipios.map((m) => [`${m.municipio}|${m.provincia}`, m]));

let nuevas = 0, vinculos = 0;
for (const f of hallazgos) {
  for (const h of f.hallazgos ?? []) {
    /* Los de Instagram se filtran por fecha, porque su rejilla no da el texto.
       Los de Facebook vienen ya filtrados por la palabra: allí el muro sí trae
       lo que dice cada publicación. */
    if (f.red !== "facebook" && (h.fecha < desde || h.fecha > hasta)) continue;
    const url = h.url.endsWith("/") ? h.url : h.url + "/";
    if (yaEstan.has(url)) continue;
    yaEstan.add(url);

    const esReel = /\/reel\//.test(url);
    const esFb = f.red === "facebook";
    const cuenta = esFb
      ? (url.match(/facebook\.com\/([\w.\-]+)/) ?? [])[1] ?? "ayuntamiento"
      : f.cuenta;
    hoja.publicaciones.push({
      url,
      red: esFb ? "facebook" : "instagram",
      forma: esFb ? "fb_post" : (esReel ? "ig_reel" : "ig_post"),
      cuenta: esFb ? cuenta : "@" + cuenta,
      medio: esFb ? `Facebook — ${cuenta}` : `Instagram — @${cuenta}`,
      credito: esFb ? `${cuenta} (página oficial)` : `@${cuenta} (cuenta oficial)`,
      licencia: "institucional", hay_video: esReel ? 1 : 0,
      clave: createHash("sha256").update(url).digest("hex").slice(0, 16),
      origen: esFb ? "búsqueda en el muro" : "búsqueda por perfil",
    });
    nuevas++;

    /* La clave del hallazgo lleva la red al final para no mezclar la búsqueda
       de Instagram con la de Facebook; la del municipio, no. */
    const claveMunicipio = f.clave.replace(/\|(instagram|facebook)$/, "");
    hoja.vinculos.push({
      url, municipio: claveMunicipio, tipo: "por_comprobar", lugar: null,
      notas: f.red === "facebook"
        ? `Publicación del ayuntamiento localizada buscando «Ceuta» en su muro: ${(h.texto ?? "").slice(0, 150)}`
        : `Publicación del ${h.fecha} en el perfil del ayuntamiento, localizada buscando por fechas`,
    });
    vinculos++;
    if (!municipios.has(claveMunicipio)) {
      console.log(`  aviso: ${claveMunicipio} no estaba en la lista de municipios`);
    }
  }
}

await writeFile(path.join(DATOS, "hoja.json"), JSON.stringify(hoja, null, 1), "utf8");
console.log(`${nuevas} publicaciones nuevas por comprobar (${desde} a ${hasta}) · ${vinculos} vínculos`);
console.log(`la lista de trabajo pasa a ${hoja.publicaciones.length} publicaciones`);
