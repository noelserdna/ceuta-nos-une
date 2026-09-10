/**
 * Paso 4 de la cosecha: la hoja de contactos para mirar lo bajado.
 *
 * El fallo caro no es que falte una foto: es publicar la que no era. El
 * `og:image` de un periódico a veces no es la foto del acto, sino la de archivo
 * que ilustraba el artículo — un paisaje, un retrato del alcalde, una imagen de
 * hace años. Eso no lo detecta ninguna comprobación automática: hay que verlo.
 *
 * Así que esto no decide nada, sólo pone cada foto al lado de lo que dice la
 * hoja de quien la encontró, y deja marcar. Lo marcado se guarda en el propio
 * navegador y se copia al portapapeles como lista, que es lo que lee el paso 5.
 *
 *   node scripts/cosecha/4-revisar.mjs && open scripts/cosecha/datos/informe.html
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { comprobarDatos, DATOS } from "./lib/rutas.mjs";

comprobarDatos();


const escapar = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const hoja = JSON.parse(await readFile(path.join(DATOS, "hoja.json"), "utf8"));
const fotos = JSON.parse(await readFile(path.join(DATOS, "fotos.json"), "utf8"));

const porUrl = new Map(hoja.publicaciones.map((p) => [p.url, p]));
const municipiosDe = new Map();
for (const v of hoja.vinculos) {
  if (!municipiosDe.has(v.url)) municipiosDe.set(v.url, []);
  municipiosDe.get(v.url).push(v);
}

const fichas = fotos.map((f) => {
  const pub = porUrl.get(f.url) ?? {};
  const vins = municipiosDe.get(f.url) ?? [];
  return {
    sha: f.sha256,
    municipios: vins.map((v) => v.municipio.replace("|", " · ")).join(" / "),
    tipos: [...new Set(vins.map((v) => v.tipo))].join(", "),
    notas: vins.map((v) => v.notas).filter(Boolean)[0] ?? "",
    medio: pub.medio ?? "", credito: pub.credito ?? "", licencia: pub.licencia ?? "",
    url: f.url, medidas: `${f.ancho}×${f.alto}`, kb: Math.round((f.bytes || 0) / 1024),
  };
});

const filas = fichas.map((f) => `
  <figure class="c" data-sha="${f.sha}">
    <img src="mini/${f.sha}.webp" alt="" loading="lazy">
    <figcaption>
      <b>${escapar(f.municipios)}</b>
      <span class="t">${escapar(f.tipos)} · ${escapar(f.medio)}</span>
      <span class="n">${escapar(f.notas).slice(0, 220)}</span>
      <span class="d">${f.medidas} · ${f.kb} KB · ${escapar(f.licencia)}</span>
      <a href="${escapar(f.url)}" target="_blank" rel="noopener noreferrer nofollow">publicación original</a>
      <span class="botones">
        <button data-v="si">vale</button><button data-v="no">fuera</button>
      </span>
    </figcaption>
  </figure>`).join("");

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Revisión de la cosecha · ${fichas.length} fotos</title>
<style>
 :root { color-scheme: light dark; }
 body { font: 14px/1.45 system-ui, sans-serif; margin: 0; padding: 1rem 1rem 5rem; }
 h1 { font-size: 1.2rem; }
 .rejilla { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
 .c { margin: 0; border: 1px solid #8884; border-radius: 8px; overflow: hidden; }
 .c img { width: 100%; height: 190px; object-fit: cover; display: block; background: #0002; }
 figcaption { display: grid; gap: .25rem; padding: .5rem .6rem .6rem; }
 .t { font-size: .8rem; opacity: .8; }
 .n { font-size: .78rem; opacity: .7; max-height: 3.2em; overflow: hidden; }
 .d { font-size: .72rem; opacity: .55; }
 .botones { display: flex; gap: .4rem; margin-top: .3rem; }
 button { flex: 1; padding: .35rem; cursor: pointer; border-radius: 6px; border: 1px solid #8886; background: transparent; }
 .c[data-marca="si"] { outline: 3px solid #1a7f37; }
 .c[data-marca="no"] { outline: 3px solid #b42318; opacity: .45; }
 .barra { position: fixed; inset: auto 0 0 0; padding: .6rem 1rem; background: Canvas;
          border-top: 1px solid #8884; display: flex; gap: 1rem; align-items: center; }
</style></head>
<body>
<h1>Revisión de la cosecha — ${fichas.length} fotos de prensa y webs municipales</h1>
<p>Marca <b>fuera</b> lo que no sea del acto: una foto de archivo del medio, un paisaje, un retrato.
   Lo que no marques se da por bueno. Al terminar, pulsa «copiar descartes» y pégamelo.</p>
<div class="rejilla">${filas}</div>
<div class="barra">
  <button id="copiar">copiar descartes</button>
  <span id="cuenta"></span>
</div>
<script>
 const marcas = JSON.parse(localStorage.getItem("cosecha-prensa") || "{}");
 const pintar = () => {
   for (const c of document.querySelectorAll(".c")) {
     const m = marcas[c.dataset.sha];
     if (m) c.dataset.marca = m; else delete c.dataset.marca;
   }
   const fuera = Object.values(marcas).filter(v => v === "no").length;
   document.getElementById("cuenta").textContent =
     Object.keys(marcas).length + " marcadas · " + fuera + " fuera";
 };
 document.addEventListener("click", (e) => {
   const b = e.target.closest("button[data-v]");
   if (!b) return;
   const sha = b.closest(".c").dataset.sha;
   marcas[sha] = marcas[sha] === b.dataset.v ? undefined : b.dataset.v;
   if (!marcas[sha]) delete marcas[sha];
   localStorage.setItem("cosecha-prensa", JSON.stringify(marcas));
   pintar();
 });
 document.getElementById("copiar").addEventListener("click", async () => {
   const fuera = Object.entries(marcas).filter(([, v]) => v === "no").map(([k]) => k);
   await navigator.clipboard.writeText(JSON.stringify(fuera, null, 1));
   document.getElementById("copiar").textContent = "copiado (" + fuera.length + ")";
 });
 pintar();
</script>
</body></html>`;

await writeFile(path.join(DATOS, "informe.html"), html, "utf8");
await writeFile(path.join(DATOS, "informe.csv"),
  "sha256,municipios,tipos,medio,credito,licencia,medidas,url\n" +
  fichas.map((f) => [f.sha, f.municipios, f.tipos, f.medio, f.credito, f.licencia, f.medidas, f.url]
    .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "utf8");

console.log(`informe con ${fichas.length} fotos: ${path.join(DATOS, "informe.html")}`);
