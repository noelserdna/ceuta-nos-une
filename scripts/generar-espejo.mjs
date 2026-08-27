#!/usr/bin/env node
/**
 * Genera la copia de respaldo que se publica en GitHub Pages.
 *
 * Por qué existe: es el último nivel de respaldo. El sitio principal está en
 * Vercel (ceutanosune.es) y el backend en Cloudflare; si alguno de los dos
 * quedara inaccesible desde España —como le pasó al dominio de Cloudflare con
 * el bloqueo de IPs de la sentencia de LaLiga—, esta copia estática en GitHub
 * Pages sigue en pie, porque no depende de ninguno de los dos.
 *
 * Es un sitio estático: lleva los lugares y las horas, que es lo que hace falta
 * para acudir. El muro y el formulario necesitan servidor y se quedan fuera; la
 * página enlaza a la web principal para eso.
 *
 * Uso:  node scripts/generar-espejo.mjs
 *       ORIGEN=https://otro.dominio node scripts/generar-espejo.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ORIGEN = process.env.ORIGEN || "https://ceutanosune.es";
const SALIDA = "site";

function descargar(ruta) {
  const args = ["-s", "--max-time", "25", "-H", "accept: application/json"];
  if (process.env.RESOLVE_IP) {
    const host = new URL(ORIGEN).hostname;
    args.push("--resolve", host + ":443:" + process.env.RESOLVE_IP);
  }
  args.push(ORIGEN + ruta);
  const salida = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(salida);
}

const escapar = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ---------------------------------------------------------------------------

console.log("Leyendo datos de " + ORIGEN + "…");
const config = descargar("/api/config");
const { places } = descargar("/api/places");
console.log("  " + places.length + " lugares, fecha " + config.event_date);

const provincias = [...new Set(places.map((p) => p.province))].sort((a, b) => a.localeCompare(b, "es"));
const generado = new Date().toISOString();

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapar(config.site_title)} · Lugares del ${escapar(config.event_label)}</title>
<meta name="description" content="Copia de respaldo con el listado y el mapa de los lugares de concentración del ${escapar(config.event_label)}.">
<meta name="theme-color" content="#F7E3D3">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:ital,wght@0,400..700;1,400..600&display=swap">
<link rel="stylesheet" href="vendor/leaflet.css">
<link rel="stylesheet" href="styles.css">
<style>
  /* Ajustes propios de la copia de respaldo */
  .cinta {
    background: var(--oro); color: var(--tinta);
    padding: 0.7rem clamp(1rem, 4vw, 3rem);
    font-family: var(--texto); font-weight: 700; letter-spacing: 0.08em; font-size: 0.78rem; line-height: 1.5;
    text-align: center;
  }
  .cinta a { color: var(--tinta); font-weight: 700; }
  .cinta { border-bottom: 3px solid var(--tinta); }
  .espejo-cabecera {
    background: var(--tinta); color: var(--papel-claro);
    padding: clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 3rem);
    position: relative; overflow: hidden; isolation: isolate;
  }
  .espejo-cabecera__gyronny {
    position: absolute; z-index: -1; top: 50%; left: 82%; translate: -50% -50%;
    width: min(120vw, 1000px); aspect-ratio: 1;
    color: rgba(252, 192, 24, 0.06);
    mask-image: radial-gradient(circle, #000 32%, transparent 68%);
    background-image: conic-gradient(from 22.5deg,
      currentColor 0deg 45deg, transparent 45deg 90deg,
      currentColor 90deg 135deg, transparent 135deg 180deg,
      currentColor 180deg 225deg, transparent 225deg 270deg,
      currentColor 270deg 315deg, transparent 315deg 360deg);
  }
  .espejo-cabecera h1 {
    font-size: clamp(2.6rem, 9vw, 5.5rem); line-height: 0.9;
    letter-spacing: 0.01em; text-transform: uppercase; margin-bottom: 0.7rem;
    color: var(--oro); -webkit-text-stroke: 0.045em var(--carmin);
    paint-order: stroke fill; transform: skewX(-5deg); transform-origin: left;
  }
  .espejo-cabecera p { color: rgba(247, 227, 211, 0.8); max-width: 52ch; margin: 0; }
  .espejo-cuerpo {
    max-width: var(--ancho); margin-inline: auto;
    padding: clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 3rem) clamp(3rem, 7vw, 5rem);
    display: grid; gap: clamp(1.5rem, 3vw, 2.5rem); grid-template-columns: 1fr;
  }
  @media (min-width: 900px) {
    .espejo-cuerpo { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); align-items: start; }
    .espejo-mapa { position: sticky; top: 1.5rem; }
  }
  /* En la web principal la cuenta atrás va sobre papel; aquí va sobre tinta,
     así que hay que devolverle el contraste a mano. */
  .espejo-cabecera .cuenta { border-top-color: rgba(247, 227, 211, 0.3); }
  .espejo-cabecera .cuenta__bloque b { color: var(--oro); }
  .espejo-cabecera .cuenta__bloque span { color: rgba(247, 227, 211, 0.72); }
  .espejo-cabecera .etiqueta { max-width: 34ch; }
  .sello {
    font-family: var(--texto); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.7rem; color: var(--gris-claro);
    text-align: center; padding-bottom: 2rem;
  }
</style>
</head>
<body>

<div class="cinta">
  Copia de respaldo · La web completa, con el muro de apoyo, está en
  <a href="${escapar(ORIGEN)}">${escapar(new URL(ORIGEN).hostname)}</a>
</div>

<header class="espejo-cabecera">
  <div class="espejo-cabecera__gyronny" aria-hidden="true"></div>
  <p class="etiqueta etiqueta--claro" style="color: var(--oro);">Concentración en toda España · ${escapar(config.event_label)}</p>
  <h1>${escapar(config.site_title)}</h1>
  <p>
    Listado y mapa de los lugares confirmados. Esta página funciona aunque la web
    principal no esté accesible desde tu conexión.
  </p>
  <div class="cuenta" id="cuenta" aria-live="polite" style="margin-top: 2rem;">
    <div class="cuenta__bloque"><b id="c-dias">--</b><span>días</span></div>
    <div class="cuenta__bloque"><b id="c-horas">--</b><span>horas</span></div>
    <div class="cuenta__bloque"><b id="c-min">--</b><span>min</span></div>
    <div class="cuenta__bloque"><b id="c-seg">--</b><span>seg</span></div>
  </div>
</header>

<main class="espejo-cuerpo">
  <div class="espejo-mapa">
    <div id="mapa" role="application" aria-label="Mapa con los lugares de concentración"></div>
    <p class="mapa__pie">Arrastra para moverte · pulsa un punto para ver los detalles</p>
  </div>

  <div>
    <div class="filtros">
      <label class="buscador">
        <span class="visualmente-oculto">Buscar por localidad, provincia o lugar</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" id="buscador" placeholder="Busca tu ciudad…" autocomplete="off">
      </label>
      <div class="chips" id="chips-provincia" role="group" aria-label="Filtrar por provincia"></div>
    </div>
    <p class="lugares__contador" id="lugares-contador" aria-live="polite"></p>
    <ol class="tarjetas" id="lista-lugares"></ol>
    <p class="aviso aviso--sutil">
      Los lugares se revisan antes de publicarlos, pero confirma siempre la convocatoria
      con la organización de tu ciudad antes de desplazarte.
    </p>
  </div>
</main>

<p class="sello">
  Datos actualizados el <span id="sello-fecha"></span> ·
  <a href="${escapar(ORIGEN)}">Ir a la web completa</a>
</p>

<script>window.DATOS = ${JSON.stringify({ config, places, generado })};</script>
<script src="vendor/leaflet.js"></script>
<script src="espejo.js"></script>
</body>
</html>
`;

const js = `/* Copia de respaldo: mismo comportamiento que la web principal, pero con los
   lugares ya incrustados y sin las partes que necesitan servidor. */
const { config, places, generado } = window.DATOS;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const estado = { provincia: "", busqueda: "", marcadores: new Map() };

const crear = (et, cl, tx) => {
  const el = document.createElement(et);
  if (cl) el.className = cl;
  if (tx !== undefined && tx !== null) el.textContent = String(tx);
  return el;
};
const sinAcentos = (t) => t.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();

$("#sello-fecha").textContent = new Date(generado).toLocaleString("es-ES",
  { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/* Cuenta atrás ---------------------------------------------------------- */
const objetivo = new Date(config.event_date + "T20:00:00+02:00");
function pintarCuenta() {
  const resto = objetivo.getTime() - Date.now();
  const bloque = $("#cuenta");
  if (resto <= 0) {
    bloque.replaceChildren();
    const t = crear("div", "cuenta__bloque");
    t.append(crear("b", null, "Es hoy"), crear("span", null, "nos vemos en la plaza"));
    bloque.append(t);
    return true;
  }
  const s = Math.floor(resto / 1000);
  $("#c-dias").textContent = String(Math.floor(s / 86400));
  $("#c-horas").textContent = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  $("#c-min").textContent = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  $("#c-seg").textContent = String(s % 60).padStart(2, "0");
  return false;
}
if (!pintarCuenta()) {
  const id = setInterval(() => { if (pintarCuenta()) clearInterval(id); }, 1000);
}

/* Mapa ------------------------------------------------------------------ */
// Aquí las teselas van directas a OpenStreetMap: el proxy cacheado vive en el
// Worker, que es justo lo que puede estar bloqueado.
const mapa = L.map("mapa", { scrollWheelZoom: false }).setView([39.5, -3.5], 5);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(mapa);
const capa = L.layerGroup().addTo(mapa);
mapa.on("click", () => mapa.scrollWheelZoom.enable());
mapa.on("mouseout", () => mapa.scrollWheelZoom.disable());

/* Listado --------------------------------------------------------------- */
function filtrados() {
  const q = sinAcentos(estado.busqueda.trim());
  return places.filter((l) => {
    if (estado.provincia && l.province !== estado.provincia) return false;
    if (!q) return true;
    return sinAcentos([l.city, l.province, l.venue, l.address].join(" ")).includes(q);
  });
}

function pintarChips() {
  const cont = $("#chips-provincia");
  cont.replaceChildren();
  const hacer = (texto, valor) => {
    const b = crear("button", "chip", texto);
    b.type = "button";
    b.setAttribute("aria-pressed", String(estado.provincia === valor));
    b.addEventListener("click", () => {
      estado.provincia = estado.provincia === valor ? "" : valor;
      pintarChips(); pintar();
    });
    return b;
  };
  cont.append(hacer("Todas", ""));
  [...new Set(places.map((p) => p.province))].sort((a, b) => a.localeCompare(b, "es"))
    .forEach((p) => cont.append(hacer(p, p)));
}

function tarjeta(lugar) {
  const li = crear("li", "tarjeta");
  li.append(crear("div", "tarjeta__hora", lugar.event_time));
  const cab = crear("div");
  cab.append(crear("div", "tarjeta__ciudad", lugar.city));
  cab.append(crear("div", "tarjeta__provincia", lugar.province));
  li.append(cab);
  const cuerpo = crear("div", "tarjeta__cuerpo");
  cuerpo.append(crear("p", "tarjeta__lugar", lugar.venue));
  cuerpo.append(crear("p", "tarjeta__dir", lugar.address));
  if (lugar.notes) cuerpo.append(crear("p", "tarjeta__notas", lugar.notes));
  const acciones = crear("div", "tarjeta__acciones");
  const ir = crear("a", "tarjeta__enlace", "Cómo llegar");
  ir.href = lugar.lat != null && lugar.lon != null
    ? "https://www.google.com/maps/dir/?api=1&destination=" + lugar.lat + "," + lugar.lon
    : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(lugar.venue + ", " + lugar.address);
  ir.target = "_blank"; ir.rel = "noopener noreferrer";
  acciones.append(ir);
  cuerpo.append(acciones);
  li.append(cuerpo);
  li.addEventListener("click", () => {
    const m = estado.marcadores.get(lugar.id);
    if (!m) return;
    $$(".tarjeta--activa").forEach((e) => e.classList.remove("tarjeta--activa"));
    li.classList.add("tarjeta--activa");
    mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 12), { animate: true });
    m.openPopup();
    if (window.innerWidth < 900) $("#mapa").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  return li;
}

function pintar() {
  const lista = $("#lista-lugares");
  const datos = filtrados();
  lista.replaceChildren();
  capa.clearLayers();
  estado.marcadores.clear();

  $("#lugares-contador").textContent = datos.length === 0
    ? "Ningún lugar coincide con la búsqueda"
    : datos.length + (datos.length === 1 ? " lugar" : " lugares");

  if (!datos.length) {
    lista.append(crear("li", "vacio", places.length
      ? "Prueba con otra búsqueda."
      : "Todavía no hay lugares publicados."));
    return;
  }

  const limites = [];
  datos.forEach((lugar) => {
    lista.append(tarjeta(lugar));
    if (lugar.lat != null && lugar.lon != null) {
      const m = L.marker([lugar.lat, lugar.lon], {
        icon: L.divIcon({ className: "", html: '<div class="pin"></div>', iconSize: [18, 18] }),
        title: lugar.city + " · " + lugar.event_time,
      });
      const caja = crear("div");
      caja.append(crear("b", null, lugar.city));
      caja.append(crear("div", "hora", lugar.event_time + " h · " + lugar.venue));
      caja.append(crear("div", null, lugar.address));
      m.bindPopup(caja);
      m.addTo(capa);
      estado.marcadores.set(lugar.id, m);
      limites.push([lugar.lat, lugar.lon]);
    }
  });
  if (limites.length) {
    mapa.fitBounds(limites, { padding: [40, 40], maxZoom: limites.length === 1 ? 13 : 9 });
  }
}

let temporizador;
$("#buscador").addEventListener("input", (ev) => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { estado.busqueda = ev.target.value; pintar(); }, 180);
});

pintarChips();
pintar();
`;

// ---------------------------------------------------------------------------

mkdirSync(join(SALIDA, "vendor"), { recursive: true });
writeFileSync(join(SALIDA, "index.html"), html);
writeFileSync(join(SALIDA, "espejo.js"), js);
writeFileSync(join(SALIDA, ".nojekyll"), "");

for (const f of ["styles.css", "favicon.svg"]) {
  copyFileSync(join("public", f), join(SALIDA, f));
}
for (const f of ["leaflet.js", "leaflet.css"]) {
  copyFileSync(join("public", "vendor", f), join(SALIDA, "vendor", f));
}

console.log("Espejo generado en " + SALIDA + "/ con " + places.length + " lugares y " + provincias.length + " provincias.");
