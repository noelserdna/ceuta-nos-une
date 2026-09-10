/**
 * La galería de la portada: el mapa de los municipios con foto, la rejilla y
 * la ficha de cada uno.
 *
 * Vive aparte de app.js a propósito. app.js sigue pintando el muro y, en
 * /2026, el mapa de la convocatoria; esto pinta lo que se vio el día 2. Cada
 * uno se protege preguntando si su trozo de página existe, así que pueden
 * convivir en la misma portada sin pisarse.
 *
 * Todo con createElement/textContent: los nombres y los créditos son texto de
 * terceros y nunca pasan por innerHTML. La única excepción es el HTML de los
 * pines de Leaflet, que se construye igual y en el que sólo entran una clave
 * comprobada con una expresión regular y un número.
 */
import { abrirVisor } from "/visor.js";

const TESELAS = "/tiles/{z}/{x}/{y}.png";
const ATRIBUCION =
  '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/* De 24 en 24: una tarjeta con foto ocupa lo que un sexto de las antiguas de
   texto, y en móvil van tres por fila. */
const POR_TANDA = 24;
const CLAVE_MINI = /^mini\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{32}\.webp$/;

const estado = {
  municipios: [], provincia: null, busqueda: "", visibles: POR_TANDA,
  sinMapa: false, abierto: null,
};
let mapa = null;
let capa = null;
const marcadores = new Map();

const $ = (sel) => document.querySelector(sel);
function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
}
const sinAcentos = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const fotos = (n) => `${n} ${n === 1 ? "foto" : "fotos"}`;

async function pedir(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok || datos.ok === false) throw new Error(datos.error || `Error ${res.status}`);
  return datos;
}

function miniatura(clave, alt = "") {
  const img = crear("img");
  img.alt = alt;
  img.loading = "lazy";
  img.decoding = "async";
  if (CLAVE_MINI.test(clave ?? "")) img.src = "/img/" + clave;
  return img;
}

/* ------------------------------------------------------------------ mapa -- */

function iniciarMapa() {
  if (!$("#mapa-acto") || typeof L === "undefined") return;
  mapa = L.map("mapa-acto", { scrollWheelZoom: false, zoomControl: true }).setView([39.5, -3.5], 5);
  L.tileLayer(TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa);
  capa = (typeof L.markerClusterGroup === "function")
    ? L.markerClusterGroup({
        maxClusterRadius: 70,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
        /* Desde este zoom ya no se agrupa: se ve cada pueblo con su foto. Antes
           de eso, seiscientas miniaturas a la vez serían cien megas pedidos de
           golpe en un móvil. */
        disableClusteringAtZoom: 10,
        iconCreateFunction: (grupo) => {
          const n = grupo.getChildCount();
          const talla = n < 10 ? "grupo--peq" : n < 40 ? "grupo--med" : "grupo--gra";
          const caja = crear("div", "grupo " + talla, String(n));
          caja.setAttribute("aria-label", `${n} municipios con foto en esta zona`);
          caja.setAttribute("role", "img");
          return L.divIcon({ html: caja.outerHTML, className: "", iconSize: [40, 40] });
        },
      }).addTo(mapa)
    : L.layerGroup().addTo(mapa);
  mapa.on("click", () => mapa.scrollWheelZoom.enable());
  mapa.on("mouseout", () => mapa.scrollWheelZoom.disable());
}

/** El pin es la propia foto; si hay varias, se apilan por detrás. */
function pinDe(m) {
  const caja = crear("div", "pin-foto" + (m.fotos > 1 ? " pin-foto--varias" : ""));
  if (CLAVE_MINI.test(m.portada ?? "")) caja.append(miniatura(m.portada));
  if (m.fotos > 1) caja.append(crear("span", "pin-foto__n", String(m.fotos)));
  return L.divIcon({ html: caja.outerHTML, className: "", iconSize: [46, 46], iconAnchor: [23, 23] });
}

function pintarMapa(ajustar) {
  if (!capa) return;
  capa.clearLayers();
  marcadores.clear();
  const puntos = [];
  for (const m of filtrados()) {
    if (m.lat == null || m.lon == null) continue;
    const mk = L.marker([m.lat, m.lon], { icon: pinDe(m), title: `${m.municipio} · ${m.provincia}` });
    mk.on("click", () => abrirFicha(m.id));
    capa.addLayer(mk);
    marcadores.set(m.id, mk);
    puntos.push([m.lat, m.lon]);
  }
  if (ajustar && puntos.length) {
    mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: puntos.length === 1 ? 12 : 9 });
  }
}

/* ------------------------------------------------------ filtros y rejilla -- */

function filtrados() {
  const q = sinAcentos(estado.busqueda.trim());
  return estado.municipios.filter((m) =>
    (!estado.provincia || m.provincia === estado.provincia) &&
    (!estado.sinMapa || m.lat == null) &&
    (!q || sinAcentos(`${m.municipio} ${m.provincia}`).includes(q)));
}

function pintarChips() {
  const caja = $("#chips-acto");
  if (!caja) return;
  const cuenta = new Map();
  for (const m of estado.municipios) cuenta.set(m.provincia, (cuenta.get(m.provincia) ?? 0) + 1);
  const chip = (texto, valor) => {
    const b = crear("button", "chip", texto);
    b.type = "button";
    b.setAttribute("aria-pressed", String(estado.provincia === valor && !estado.sinMapa));
    b.addEventListener("click", () => {
      estado.provincia = estado.provincia === valor ? null : valor;
      estado.sinMapa = false;
      estado.visibles = POR_TANDA;
      pintarChips();
      pintarTodo(true);
    });
    return b;
  };
  const provincias = [...cuenta.keys()].sort((a, b) => a.localeCompare(b, "es"));
  caja.replaceChildren(chip("Todas", null), ...provincias.map((p) => chip(`${p} · ${cuenta.get(p)}`, p)));

  /* Los que no tienen punto no se esconden: un mapa cuyo argumento es «esto
     pasó aquí» no puede inventarse el aquí, pero sí puede decir cuántos faltan
     y enseñarlos en un clic. La cifra sale de los datos, nunca del código. */
  const sin = estado.municipios.filter((m) => m.lat == null).length;
  const boton = $("#btn-sin-mapa");
  if (boton) {
    boton.hidden = !sin;
    boton.textContent = `${sin} ${sin === 1 ? "municipio" : "municipios"} sin situar en el mapa`;
    boton.setAttribute("aria-pressed", String(estado.sinMapa));
  }
}

function tarjeta(m) {
  const li = crear("li", "tarjeta-foto");
  const b = crear("button", "tarjeta-foto__boton");
  b.type = "button";
  b.append(miniatura(m.portada, ""));
  /* Si la única foto es de una galería que cubre varios pueblos, la tarjeta
     no puede presentarla como de aquí: varios municipios de la misma
     provincia saldrían seguidos con la misma imagen y sin explicación. */
  const compartida = (m.portada_compartida ?? 1) > 1;
  if (compartida) b.append(crear("span", "tarjeta-foto__galeria", "galería de prensa"));
  const texto = crear("span", "tarjeta-foto__texto");
  texto.append(crear("b", "tarjeta-foto__nombre", m.municipio),
    crear("span", "tarjeta-foto__prov", m.provincia),
    crear("span", "tarjeta-foto__n", fotos(m.fotos)));
  b.append(texto);
  b.setAttribute("aria-label", `${m.municipio}, ${m.provincia}: ${fotos(m.fotos)}` +
    (compartida ? ", foto de una galería de prensa" : ""));
  b.addEventListener("click", () => abrirFicha(m.id));
  li.append(b);
  return li;
}

function pintarRejilla() {
  const lista = $("#rejilla-acto");
  if (!lista) return;
  const todos = filtrados();
  const aPintar = todos.slice(0, estado.visibles);
  lista.replaceChildren(...aPintar.map(tarjeta));
  const contador = $("#contador-acto");
  if (contador) {
    contador.textContent = todos.length
      ? `${todos.length} ${todos.length === 1 ? "municipio" : "municipios"}` +
        (todos.length > aPintar.length ? ` · se ven ${aPintar.length}` : "")
      : "Ningún municipio con esa búsqueda.";
  }
  const mas = $("#btn-mas-acto");
  if (mas) {
    const quedan = todos.length - aPintar.length;
    mas.hidden = quedan <= 0;
    mas.textContent = `Ver ${Math.min(quedan, POR_TANDA)} más de los ${quedan} que quedan`;
  }
}

function pintarTodo(ajustarMapa) {
  pintarRejilla();
  pintarMapa(ajustarMapa);
}

/* ------------------------------------------------------------------ ficha -- */

async function abrirFicha(id, { mover = true } = {}) {
  const ficha = $("#ficha-acto");
  if (!ficha) return;
  const m = estado.municipios.find((x) => x.id === id);
  estado.abierto = id;

  ficha.hidden = false;
  $("#panel-acto")?.setAttribute("hidden", "");
  const titulo = $("#ficha-titulo");
  titulo.textContent = m ? m.municipio : "…";
  $("#ficha-sub").textContent = m ? `${m.provincia} · ${fotos(m.fotos)}` : "";
  const rejilla = $("#ficha-fotos");
  rejilla.replaceChildren(crear("li", "ficha__cargando", "Cargando las fotos…"));

  // El enlace de la ficha se puede copiar y compartir: ceutanosune.es/?m=196
  const url = new URL(location.href);
  url.searchParams.set("m", String(id));
  history.replaceState(null, "", url.pathname + url.search + "#archivo");

  if (m?.lat != null && mapa) {
    const mk = marcadores.get(id);
    if (mk && capa.zoomToShowLayer) capa.zoomToShowLayer(mk, () => {});
    else mapa.setView([m.lat, m.lon], Math.max(mapa.getZoom(), 11));
  }
  if (mover) ficha.scrollIntoView({ behavior: "smooth", block: "start" });

  let datos;
  try {
    datos = await pedir(`/api/acto/${id}`);
  } catch (err) {
    rejilla.replaceChildren(crear("li", "ficha__cargando", "No se han podido cargar: " + err.message));
    return;
  }
  if (estado.abierto !== id) return;   // se abrió otra mientras tanto
  const contexto = { municipio: datos.municipio.municipio, provincia: datos.municipio.provincia };
  titulo.textContent = contexto.municipio;
  $("#ficha-sub").textContent = `${contexto.provincia} · ${fotos(datos.fotos.length)}`;

  rejilla.replaceChildren(...datos.fotos.map((f, i) => {
    const li = crear("li", "ficha__foto");
    const b = crear("button", "ficha__abrir");
    b.type = "button";
    const tipo = f.clase === "portada" ? "Vídeo" : f.tipo === "cartel" ? "Cartel" : "Acto";
    b.setAttribute("aria-label", `Ampliar: ${tipo.toLowerCase()} en ${contexto.municipio}`);
    const img = miniatura(f.clave_mini, "");
    if (f.ancho && f.alto) { img.width = 400; img.height = Math.round(400 * f.alto / f.ancho); }
    b.append(img, crear("span", "ficha__tipo", tipo));
    b.addEventListener("click", () => abrirVisor(datos.fotos, i, contexto));
    const pie = crear("p", "ficha__credito", f.credito);
    if (f.convocante) pie.append(crear("span", "ficha__convoca", ` · Convoca: ${f.convocante}`));
    const enlace = crear("a", "ficha__original", "publicación original");
    enlace.href = f.url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer nofollow";
    li.append(b, pie, enlace);
    return li;
  }));
  titulo.focus({ preventScroll: true });
}

function cerrarFicha() {
  estado.abierto = null;
  $("#ficha-acto").hidden = true;
  $("#panel-acto")?.removeAttribute("hidden");
  const url = new URL(location.href);
  url.searchParams.delete("m");
  history.replaceState(null, "", url.pathname + url.search + "#archivo");
}

/* -------------------------------------------------------------- arranque -- */

function conectar() {
  let espera;
  $("#buscador-acto")?.addEventListener("input", (ev) => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      estado.busqueda = ev.target.value.slice(0, 80);
      estado.visibles = POR_TANDA;
      pintarTodo(true);
    }, 180);
  });
  $("#btn-mas-acto")?.addEventListener("click", () => {
    estado.visibles += POR_TANDA;
    pintarRejilla();
  });
  $("#btn-sin-mapa")?.addEventListener("click", () => {
    estado.sinMapa = !estado.sinMapa;
    estado.provincia = null;
    estado.visibles = POR_TANDA;
    pintarChips();
    pintarTodo(false);
  });
  $("#ficha-cerrar")?.addEventListener("click", cerrarFicha);
}

function pintarCifras(d) {
  const poner = (id, v) => { const el = $(id); if (el) el.textContent = Number(v).toLocaleString("es-ES"); };
  poner("#cifra-municipios", d.total_municipios);
  poner("#cifra-fotos", d.total_fotos);
  poner("#cifra-provincias-acto", d.total_provincias);
}

async function iniciar() {
  if (!$("#archivo")) return;
  iniciarMapa();
  conectar();

  let datos;
  try {
    datos = await pedir("/api/acto");
  } catch (err) {
    $("#contador-acto").textContent = "No hemos podido cargar el archivo: " + err.message;
    return;
  }
  if (datos.preparando) {
    $("#contador-acto").textContent = "Estamos preparando el archivo de fotos. Vuelve en un rato.";
    return;
  }
  estado.municipios = datos.municipios.sort((a, b) => a.municipio.localeCompare(b.municipio, "es"));
  pintarCifras(datos);
  pintarChips();
  pintarTodo(false);

  const params = new URLSearchParams(location.search);
  const pedido = Number(params.get("m"));
  if (pedido && estado.municipios.some((m) => m.id === pedido)) {
    abrirFicha(pedido);
    return;
  }

  /* Antes del acto se compartía «ceutanosune.es/?q=talavera#lugares» para
     llegar a la plaza de cada pueblo, y esos enlaces siguen en los grupos de
     WhatsApp. Ahora llevan a sus fotos, que es lo que hay que ver de Talavera
     después del día 2. Y si el pueblo tiene fotos, se abre directamente. */
  const buscado = (params.get("q") ?? "").slice(0, 80);
  if (buscado || location.hash === "#lugares") {
    if (buscado) {
      estado.busqueda = buscado;
      const caja = $("#buscador-acto");
      if (caja) caja.value = buscado;
      const coinciden = filtrados();
      pintarTodo(true);
      if (coinciden.length === 1) { abrirFicha(coinciden[0].id); return; }
    }
    $("#archivo")?.scrollIntoView({ block: "start" });
  }
}

iniciar();
