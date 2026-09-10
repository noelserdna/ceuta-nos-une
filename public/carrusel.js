/**
 * El pase del 2 de septiembre.
 *
 * Las fotos de todas las plazas, una detrás de otra y a pantalla completa, para
 * proyectarlas o para mandarlas por el móvil. Los créditos y los nombres de los
 * convocantes son texto de terceros copiado de sus publicaciones: se pintan con
 * textContent y createElement, nunca inyectando HTML, igual que en todo el sitio.
 *
 * Las decisiones que no se ven leyendo el código de arriba abajo:
 *
 * - El orden lo pone el servidor, intercalado por provincia, y aquí no se toca.
 *   Es el mismo pase para todo el mundo: eso es lo que hace que compartirlo
 *   signifique algo y que la caché del borde sirva para miles de personas.
 * - El ámbito y la página van en la ruta (/api/pase/madrid/2), nunca en un
 *   parámetro variable: una URL distinta en cada petición tira las dos cachés.
 * - Sólo se precarga la siguiente foto, nunca tres. Con la red de un bar o de
 *   un salón de actos, eso es la diferencia entre que el pase avance y que se
 *   atasque.
 * - Los seis segundos empiezan a contar cuando la foto ya se ve, no cuando se
 *   pide: si no, una foto lenta saldría medio segundo.
 * - El pie cambia a la vez que la foto, no antes. Un crédito que se adelanta a
 *   su imagen le atribuye a alguien la foto de otro.
 */

const $ = (sel) => document.querySelector(sel);

const DURACION = 6000;        // una foto, y también el fotograma de un vídeo: es una imagen
const AVISO_TANDA = 250;      // en la foto 250 de una página se pide la siguiente
const ESPERA_TELE = 3000;     // lo que tarda en irse el mando en modo proyección
const ESPERA_FOTO = 20000;    // más que esto, la foto se da por perdida y se sigue
const FALLOS_SEGUIDOS = 4;    // tantas fotos seguidas sin llegar ya no es una foto rota: es la red
const UMBRAL_GESTO = 60;      // px de deslizamiento horizontal para pasar de foto

const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");
const parametros = new URLSearchParams(location.search);

const estado = {
  ambito: "espana",
  provincia: null,       // el nombre con acentos, si el ámbito es una provincia
  fotos: [],             // todas las tandas pedidas, concatenadas y en el orden del servidor
  claves: new Set(),     // para no repetir una foto si el archivo cambia entre dos tandas
  paginas: 1,
  cargadas: 0,
  inicioUltima: 0,       // dónde empieza, en `fotos`, la última tanda concatenada
  total: 0,
  pidiendo: false,
  indice: -1,            // la foto pedida (la que se ve, o la que está de camino)
  visible: -1,           // la que se ve de verdad, y a la que corresponde el pie
  cargando: false,
  cambiando: false,      // hay otra provincia de camino
  avisando: false,
  fallosSeguidos: 0,
  pausado: quieto.matches,   // quien pidió que nada se mueva, entra en pausa
  desde: 0,              // cuándo empezó a contar la foto de ahora
  transcurrido: 0,       // lo que llevaba contado al pausar, para seguir desde ahí
  turnoAmbito: 0,        // cambia al elegir otra provincia: lo que llegue tarde se tira
  turnoFoto: 0,          // lo mismo con la foto que está cargando
  tele: parametros.has("tele"),
};

/** Las dos capas del lienzo. Se crean en arrancar(). */
let capas = [];
let capaVisible = 0;

/** Lo que hace el botón del aviso. Cambia según el aviso: reintentar, ver España… */
let accionAviso = null;

/* ---------------------------------------------------------------------------
   Utilidades
--------------------------------------------------------------------------- */

/** Mismo envoltorio que en app.js, y además dice el código: un 404 no es un fallo de red. */
async function pedir(url) {
  let res;
  try {
    res = await fetch(url, { credentials: "same-origin" });
  } catch {
    throw Object.assign(
      new Error("No se ha podido conectar. Comprueba la conexión y vuelve a intentarlo."),
      { status: 0 },
    );
  }
  let datos = {};
  try {
    datos = await res.json();
  } catch {
    /* respuesta sin JSON: se trata como error genérico más abajo */
  }
  if (!res.ok || datos.ok === false) {
    throw Object.assign(new Error(datos.error || "Algo ha ido mal. Vuelve a intentarlo."), {
      status: res.status,
    });
  }
  return datos;
}

/**
 * Igual que slug() en src/index.ts. Si un día difieren, el filtro pide
 * provincias que el servidor no reconoce y cada una da un 404.
 */
function slug(t) {
  return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function rutaPase(ambito, pagina) {
  return "/api/pase/" + ambito + "/" + pagina;
}

/** La clave trae barras de carpeta: se codifica cada trozo, no la ruta entera. */
function rutaImagen(clave) {
  return "/img/" + String(clave).split("/").map(encodeURIComponent).join("/");
}

/**
 * El enlace a la publicación original viene de fuera. Un `javascript:` metido
 * en ese campo sería código ejecutándose en esta página al pulsarlo: sólo pasa
 * lo que sea http o https.
 */
function enlaceSeguro(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

/** «Alcoy, Alicante», pero «Madrid» a secas y no «Madrid, Madrid». */
function lugarDe(f, separador) {
  return f.provincia && f.provincia !== f.municipio ? f.municipio + separador + f.provincia : f.municipio;
}

/* Lo que la imagen es primero (vídeo, texto) y luego el papel que tuvo. Antes
   todo salía como «foto del acto», carteles incluidos. */
const QUE_ES = {
  cartel: "Cartel de la convocatoria en ",
  acto: "Foto del acto en ",
  cartel_y_acto: "Cartel y foto del acto en ",
  prensa: "Foto de prensa en ",
};

function textoAlt(f) {
  if (f.clase === "portada") return "Fotograma de un vídeo del acto en " + lugarDe(f, ", ");
  if (f.clase === "texto") return "Comunicado o carta publicado en " + lugarDe(f, ", ");
  return (QUE_ES[f.tipo] ?? "Imagen de ") + lugarDe(f, ", ");
}

function numero(n) {
  return Number(n).toLocaleString("es-ES");
}

/* ---------------------------------------------------------------------------
   Las imágenes
--------------------------------------------------------------------------- */

/** Pide una imagen y dice si ha llegado. Nunca rechaza: una foto que falla se salta. */
function traer(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const reloj = setTimeout(() => {
      img.removeAttribute("src");
      resolve(false);
    }, ESPERA_FOTO);
    img.onload = () => { clearTimeout(reloj); resolve(true); };
    img.onerror = () => { clearTimeout(reloj); resolve(false); };
    img.src = src;
  });
}

/* La única foto pedida por adelantado. Una, no tres: ver la cabecera. */
let precarga = { src: "", promesa: null };

function precargar(f) {
  if (!f?.clave) return;
  const src = rutaImagen(f.clave);
  if (precarga.src === src) return;
  precarga = { src, promesa: traer(src) };
}

/** La grande; si no llega, la de 400 px, que en un móvil sigue viéndose bien. */
async function primeraQueLlegue(f) {
  for (const clave of [f.clave, f.clave_mini]) {
    if (!clave) continue;
    const src = rutaImagen(clave);
    const llega = precarga.src === src ? await precarga.promesa : await traer(src);
    if (llega) return src;
  }
  return "";
}

/* ---------------------------------------------------------------------------
   El pase
--------------------------------------------------------------------------- */

/**
 * Adónde se llega dando `paso` desde `desde`, saltando las fotos rotas.
 * Devuelve null si hay que esperar: al final de lo cargado con la siguiente
 * tanda ya de camino, volver a la primera sería cortar el pase en seco.
 */
function destino(desde, paso) {
  const n = estado.fotos.length;
  if (!n) return null;
  let i = desde;
  for (let vueltas = 0; vueltas < n; vueltas++) {
    i += paso;
    if (i >= n) {
      if (estado.cargadas < estado.paginas && estado.pidiendo) return null;
      i = 0;   // era la última página, o la siguiente no ha llegado: se vuelve a la 1
    } else if (i < 0) {
      i = n - 1;
    }
    // Una foto que ya ha fallado dos veces no se vuelve a intentar.
    if (estado.fotos[i].fallos < 2) return i;
  }
  return null;
}

function avanzar(paso, { aMano = false } = {}) {
  // Mientras llega otra provincia, la lista de ahora está a punto de irse:
  // moverse por ella sólo serviría para pedir fotos que nadie va a ver.
  if (estado.avisando || estado.cambiando) return;
  // Quien mueve el pase a mano quiere mirar esa foto, no que se le vaya a los
  // seis segundos.
  if (aMano) pausar(true);
  const i = destino(estado.indice, paso);
  if (i === null) return;
  mostrar(i, { anunciar: aMano, paso });
}

async function mostrar(i, { anunciar = false, paso = 1 } = {}) {
  const f = estado.fotos[i];
  if (!f) return;
  const turno = ++estado.turnoFoto;
  estado.indice = i;
  estado.cargando = true;
  pintarAvance(0);
  pedirMas();

  const src = await primeraQueLlegue(f);
  if (turno !== estado.turnoFoto) return;   // mientras tanto se ha pedido otra
  if (!src) return fallo(f, i, paso, anunciar);

  const entra = capas[1 - capaVisible];
  const sale = capas[capaVisible];
  entra.alt = textoAlt(f);
  entra.src = src;
  try {
    await entra.decode();
  } catch {
    /* decode() también falla si la capa cambia de foto a medias: se mira abajo */
  }
  if (turno !== estado.turnoFoto) return;
  if (!entra.naturalWidth) return fallo(f, i, paso, anunciar);

  estado.fallosSeguidos = 0;
  entra.classList.add("activa");
  entra.removeAttribute("aria-hidden");
  sale.classList.remove("activa");
  sale.setAttribute("aria-hidden", "true");
  capaVisible = 1 - capaVisible;

  estado.visible = i;
  estado.cargando = false;
  estado.desde = performance.now();
  estado.transcurrido = 0;
  pintarPie(f);
  pintarCuenta();
  if (anunciar) $("#anuncio").textContent = lugarDe(f, ", ") + ". " + numero(i + 1) + " de " + numero(estado.total) + ".";

  const siguiente = destino(i, 1);
  if (siguiente !== null && siguiente !== i) precargar(estado.fotos[siguiente]);
}

function fallo(f, i, paso, anunciar) {
  f.fallos++;
  estado.fallosSeguidos++;
  estado.cargando = false;
  // Cuatro seguidas sin llegar no son cuatro fotos rotas: se ha ido la red. Si
  // se siguiera saltando, se darían por rotas todas en un par de segundos.
  if (estado.fallosSeguidos >= FALLOS_SEGUIDOS) {
    pintarAviso({
      titulo: "No llegan las fotos.",
      texto: "Puede que se haya cortado la conexión.",
      boton: "Reintentar",
      accion: reintentar,
    });
    return;
  }
  const otra = destino(i, paso);
  if (otra !== null && otra !== i) mostrar(otra, { anunciar, paso });
}

function reintentar() {
  for (const f of estado.fotos) f.fallos = 0;
  estado.fallosSeguidos = 0;
  precarga = { src: "", promesa: null };
  ocultarAviso();
  mostrar(Math.max(0, estado.indice));
}

/* ---------------------------------------------------------------------------
   Las tandas y el ámbito
--------------------------------------------------------------------------- */

function meter(fotos) {
  for (const f of Array.isArray(fotos) ? fotos : []) {
    if (!f?.clave || estado.claves.has(f.clave)) continue;
    estado.claves.add(f.clave);
    estado.fotos.push({ ...f, fallos: 0 });
  }
}

/**
 * La siguiente página se pide cincuenta fotos antes de que haga falta: da cinco
 * minutos de margen, y quien sólo mira las primeras no se baja las demás.
 */
async function pedirMas() {
  if (estado.pidiendo || estado.cargadas >= estado.paginas) return;
  const largo = estado.fotos.length - estado.inicioUltima;
  if (estado.indice < estado.inicioUltima + Math.min(AVISO_TANDA, largo) - 1) return;

  estado.pidiendo = true;
  const turno = estado.turnoAmbito;
  const ambito = estado.ambito;
  try {
    const datos = await pedir(rutaPase(ambito, estado.cargadas + 1));
    // Una tanda de Madrid que llega cuando ya se ve Sevilla no se concatena.
    if (turno !== estado.turnoAmbito || ambito !== estado.ambito) return;
    estado.inicioUltima = estado.fotos.length;
    meter(datos.fotos);
    estado.cargadas += 1;
    estado.paginas = Math.max(estado.cargadas, Number(datos.paginas) || 1);
    estado.total = Number(datos.total) || estado.fotos.length;
    pintarCuenta();
  } catch {
    /* Si no llega, al final de esta tanda se vuelve a la primera foto y en la
       siguiente vuelta se intenta otra vez. Nadie tiene que enterarse. */
  } finally {
    if (turno === estado.turnoAmbito) estado.pidiendo = false;
  }
}

async function cambiarAmbito(ambito, { aMano = false } = {}) {
  const turno = ++estado.turnoAmbito;
  estado.turnoFoto++;           // la foto que estuviera cargando ya no es de aquí
  estado.pidiendo = false;
  estado.cargando = true;
  estado.cambiando = true;
  pintarCuenta("Cargando…");
  $("#lienzo").setAttribute("aria-busy", "true");

  let datos;
  try {
    datos = await pedir(rutaPase(ambito, 1));
  } catch (err) {
    if (turno !== estado.turnoAmbito) return;
    estado.cambiando = false;
    $("#lienzo").removeAttribute("aria-busy");
    if (ambito !== "espana" && err.status === 404) {
      // Un enlace a una provincia que ya no tiene fotos: mejor enseñar toda
      // España que una pantalla vacía.
      nota("No hay fotos de esa provincia. Se ven las de toda España.");
      cambiarAmbito("espana", { aMano });
      return;
    }
    pintarAviso({
      titulo: "No hemos podido cargar las fotos.",
      texto: err.message,
      boton: "Reintentar",
      accion: () => cambiarAmbito(ambito, { aMano }),
    });
    return;
  }
  if (turno !== estado.turnoAmbito) return;
  estado.cambiando = false;
  $("#lienzo").removeAttribute("aria-busy");

  estado.ambito = ambito;
  estado.provincia = datos.provincia || null;
  estado.fotos = [];
  estado.claves = new Set();
  meter(datos.fotos);
  estado.cargadas = 1;
  estado.paginas = Number(datos.paginas) || 1;
  estado.total = Number(datos.total) || estado.fotos.length;
  estado.inicioUltima = 0;
  estado.indice = -1;
  estado.fallosSeguidos = 0;
  precarga = { src: "", promesa: null };

  asegurarOpcion(ambito, estado.provincia);
  $("#provincia").value = ambito;
  reflejarEnLaUrl();
  document.title = estado.provincia
    ? "Fotos del 2 de septiembre en " + estado.provincia + " · Ceuta nos une"
    : "Fotos del 2 de septiembre · Ceuta nos une";

  if (!estado.fotos.length) {
    estado.cargando = false;
    pintarAviso(ambito === "espana"
      ? { titulo: "Todavía no hay fotos.", texto: "Estamos reuniendo las de cada plaza. Vuelve en un rato." }
      : {
        titulo: "Todavía no hay fotos de " + (estado.provincia || "esta provincia") + ".",
        texto: "Mientras tanto, están las del resto de España.",
        boton: "Ver toda España",
        accion: () => cambiarAmbito("espana", { aMano: true }),
      });
    return;
  }

  ocultarAviso();
  if (aMano) {
    $("#anuncio").textContent = (estado.provincia || "Toda España") + ": " +
      numero(estado.total) + (estado.total === 1 ? " foto." : " fotos.");
  }
  mostrar(0);
}

/**
 * La provincia va en la URL para que el enlace compartido abra la misma. Se
 * conserva lo demás que hubiera (el ?tele de un proyector, sobre todo), y sin
 * recargar: sería volver a pedir la página entera por cambiar un filtro.
 */
function reflejarEnLaUrl() {
  const partes = estado.ambito === "espana" ? [] : ["p=" + encodeURIComponent(estado.ambito)];
  for (const [clave, valor] of new URLSearchParams(location.search)) {
    if (clave === "p") continue;
    // ?tele se queda como está, sin el «=» que añadiría URLSearchParams.
    partes.push(valor ? encodeURIComponent(clave) + "=" + encodeURIComponent(valor) : encodeURIComponent(clave));
  }
  history.replaceState(null, "", location.pathname + (partes.length ? "?" + partes.join("&") : "") + location.hash);
}

/** Lo que se comparte: la provincia sí, el modo proyección no. */
function urlParaCompartir() {
  return location.origin + location.pathname +
    (estado.ambito === "espana" ? "" : "?p=" + encodeURIComponent(estado.ambito));
}

function ambitoDeLaUrl() {
  const pedido = parametros.get("p");
  if (!pedido) return "espana";
  // Se acepta también «Málaga» escrito a mano: se convierte como lo hace el servidor.
  const limpio = slug(pedido);
  return /^[a-z0-9-]{1,40}$/.test(limpio) ? limpio : "espana";
}

/* ---------------------------------------------------------------------------
   El filtro de provincias
--------------------------------------------------------------------------- */

function crearOpcion(valor, texto) {
  const o = document.createElement("option");
  o.value = valor;
  o.textContent = texto;
  return o;
}

/** Si la provincia pedida aún no está en el desplegable, se añade con su nombre. */
function asegurarOpcion(valor, texto) {
  const select = $("#provincia");
  if ([...select.options].some((o) => o.value === valor)) return;
  select.appendChild(crearOpcion(valor, texto || valor));
}

async function cargarProvincias() {
  let datos;
  try {
    datos = await pedir("/api/acto");
  } catch {
    return;   // sin lista, el filtro se queda en «Toda España» y el pase sigue igual
  }
  const nombres = [...new Set((datos.municipios || []).map((m) => m.provincia).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
  const select = $("#provincia");
  const opciones = [crearOpcion("espana", "Toda España")];
  for (const nombre of nombres) {
    const valor = slug(nombre);
    if (valor) opciones.push(crearOpcion(valor, nombre));
  }
  select.replaceChildren(...opciones);
  // Una provincia que ha llegado por la URL y no está en la lista se conserva:
  // borrarla del desplegable dejaría elegida otra que no es la que se ve.
  if (estado.ambito !== "espana") asegurarOpcion(estado.ambito, estado.provincia);
  select.value = estado.ambito;
}

/* ---------------------------------------------------------------------------
   Lo que se pinta
--------------------------------------------------------------------------- */

function pintarPie(f) {
  $("#pie").hidden = false;
  $("#pie-municipio").textContent = f.municipio || "";
  $("#pie-provincia").textContent = f.provincia && f.provincia !== f.municipio ? " · " + f.provincia : "";

  $("#pie-credito-linea").hidden = !f.credito;
  $("#pie-rotulo").textContent = f.clase === "portada" ? "Vídeo:" : f.clase === "texto" ? "Publicado por:"
    : f.tipo === "cartel" ? "Cartel:" : "Foto:";
  $("#pie-credito").textContent = f.credito || "";

  $("#pie-convoca-linea").hidden = !f.convocante;
  $("#pie-convoca").textContent = f.convocante || "";

  const original = $("#pie-original");
  const url = enlaceSeguro(f.url);
  original.hidden = !url;
  if (url) original.href = url;

  const todas = $("#pie-todas");
  const id = Number(f.municipio_id);
  todas.hidden = !(Number.isInteger(id) && id > 0);
  if (!todas.hidden) {
    todas.href = "/?m=" + id + "#archivo";
    $("#pie-todas-municipio").textContent = f.municipio || "";
  }
}

function pintarCuenta(texto) {
  $("#cuenta").textContent = texto ?? (estado.visible < 0 ? "" :
    numero(estado.visible + 1) + " de " + numero(estado.total));
}

function pintarAvance(parte) {
  $("#avance").style.setProperty("--avance", String(Math.max(0, Math.min(1, parte))));
}

function mandosActivos(si) {
  for (const sel of ["#anterior", "#siguiente", "#pausa"]) $(sel).disabled = !si;
}

function pintarAviso({ titulo, texto = "", boton = "", accion = null }) {
  estado.avisando = true;
  estado.visible = -1;
  $("#aviso").hidden = false;
  $("#aviso-titulo").textContent = titulo;
  $("#aviso-texto").textContent = texto;
  const b = $("#aviso-boton");
  b.hidden = !boton;
  b.textContent = boton;
  accionAviso = accion;
  // Sin foto a la vista no hay crédito que dar, y una foto sin su crédito no
  // se enseña: fuera las dos capas y fuera el pie.
  for (const c of capas) {
    c.classList.remove("activa");
    c.setAttribute("aria-hidden", "true");
  }
  $("#pie").hidden = true;
  pintarCuenta("");
  pintarAvance(0);
  mandosActivos(false);
}

function ocultarAviso() {
  estado.avisando = false;
  $("#aviso").hidden = true;
  accionAviso = null;
  mandosActivos(true);
}

let relojNota = 0;
function nota(texto) {
  const caja = $("#nota");
  caja.textContent = texto;
  clearTimeout(relojNota);
  relojNota = setTimeout(() => { caja.textContent = ""; }, 6000);
}

/* ---------------------------------------------------------------------------
   El reloj
--------------------------------------------------------------------------- */

function pausar(si) {
  const ahora = performance.now();
  if (si && !estado.pausado) estado.transcurrido = ahora - estado.desde;
  if (!si && estado.pausado) estado.desde = ahora - estado.transcurrido;
  estado.pausado = si;
  // La etiqueta dice lo que hace el botón al pulsarlo. Sin aria-pressed: un
  // botón que cambia de nombre y además dice «pulsado» se lee dos veces al revés.
  $("#pausa-texto").textContent = si ? "Seguir" : "Pausar";
  $(".mando__icono-pausa").toggleAttribute("hidden", si);
  $(".mando__icono-seguir").toggleAttribute("hidden", !si);
  // Parado a media carga, la barra se queda a cero: lo contado era de la foto anterior.
  if (si) pintarAvance(estado.cargando || estado.visible < 0 ? 0 : estado.transcurrido / DURACION);
}

function tictac(ahora) {
  if (!estado.pausado && !estado.cargando && !estado.avisando && estado.visible >= 0) {
    const t = ahora - estado.desde;
    pintarAvance(t / DURACION);
    if (t >= DURACION) avanzar(1);
  }
  requestAnimationFrame(tictac);
}

/* ---------------------------------------------------------------------------
   Pantalla completa, compartir y modo proyección
--------------------------------------------------------------------------- */

const raiz = document.documentElement;
// El iPhone no deja poner a pantalla completa nada que no sea un vídeo: allí el
// botón no sale, en vez de salir y no hacer nada.
const puedePantalla = Boolean(raiz.requestFullscreen || raiz.webkitRequestFullscreen);

function enPantallaCompleta() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

async function alternarPantalla() {
  if (!puedePantalla) return;
  try {
    if (enPantallaCompleta()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      await (raiz.requestFullscreen || raiz.webkitRequestFullscreen).call(raiz);
    }
  } catch {
    /* el navegador puede negarse (un iframe, una política): se sigue en ventana */
  }
}

function pintarPantalla() {
  const dentro = enPantallaCompleta();
  $("#pantalla-texto").textContent = dentro ? "Salir de pantalla completa" : "Pantalla completa";
  $("#pantalla").title = dentro ? "Salir de pantalla completa (F)" : "Pantalla completa (F)";
}

async function compartir() {
  const url = urlParaCompartir();
  const donde = estado.provincia ? "en " + estado.provincia : "en toda España";
  try {
    if (navigator.share) {
      await navigator.share({
        title: document.title,
        text: "Las fotos del 2 de septiembre " + donde + ", en apoyo a Ceuta.",
        url,
      });
      return;
    }
  } catch (err) {
    if (err?.name === "AbortError") return;   // ha cerrado el menú: no hay nada que hacer
    /* cualquier otro fallo: se prueba con el portapapeles */
  }
  try {
    await navigator.clipboard.writeText(url);
    nota("Enlace copiado. Pégalo donde quieras.");
  } catch {
    // Sin portapapeles (http, un permiso denegado): el enlace, a la vista.
    nota("Copia este enlace: " + url);
  }
}

/* El cerrojo de pantalla: sin él, el portátil conectado al proyector se apaga
   a los cinco minutos de no tocarlo, que es justo lo que va a pasar. */
let cerrojo = null;
async function mantenerDespierta() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    cerrojo = await navigator.wakeLock.request("screen");
  } catch {
    /* sin permiso o con poca batería: el pase sigue, sólo que la pantalla puede dormirse */
  }
}

function prepararTele() {
  document.body.classList.add("tele");
  const mando = $("#mando");
  let reloj = 0;
  const despertar = () => {
    document.body.classList.remove("inactivo");
    clearTimeout(reloj);
    reloj = setTimeout(function dormir() {
      // Con el ratón encima del mando no se va: estaría a punto de pulsar algo.
      if (mando.matches(":hover")) { reloj = setTimeout(dormir, ESPERA_TELE); return; }
      document.body.classList.add("inactivo");
    }, ESPERA_TELE);
  };
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) {
    document.addEventListener(ev, despertar, { passive: true });
  }
  despertar();

  mantenerDespierta();
  // El navegador suelta el cerrojo en cuanto la pestaña deja de verse; hay que
  // volver a pedirlo al volver.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") mantenerDespierta();
  });
}

/* ---------------------------------------------------------------------------
   Teclado y gestos
--------------------------------------------------------------------------- */

function alPulsarTecla(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const destinoTecla = e.target instanceof Element ? e.target : document.body;
  // En el desplegable las flechas cambian de provincia: son suyas.
  if (destinoTecla.closest("input, textarea, select, [contenteditable]")) return;

  switch (e.key) {
    case " ":
    case "Spacebar":
      // Sobre un botón, el espacio ya lo pulsa: sumarle la pausa sería hacer dos cosas.
      if (destinoTecla.closest("button, summary")) return;
      e.preventDefault();   // si no, además de pausar baja la página
      if (!estado.avisando) pausar(!estado.pausado);
      break;
    case "ArrowLeft":
      e.preventDefault();
      avanzar(-1, { aMano: true });
      break;
    case "ArrowRight":
      e.preventDefault();
      avanzar(1, { aMano: true });
      break;
    case "f":
    case "F":
      if (!e.repeat) alternarPantalla();
      break;
    default:
  }
}

/**
 * Deslizar el dedo pasa de foto. Con eventos de puntero y no de toque, así
 * también vale arrastrando con el ratón. El desplazamiento vertical y el zoom
 * se le dejan al navegador (touch-action en carrusel.css).
 */
function prepararGestos() {
  const lienzo = $("#lienzo");
  let inicio = null;
  lienzo.addEventListener("pointerdown", (e) => {
    // El botón del aviso tiene que recibir su clic: no se toca.
    if (!e.isPrimary || e.button > 0 || e.target.closest?.("button, a")) return;
    inicio = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { lienzo.setPointerCapture(e.pointerId); } catch { /* sin captura, basta con soltar dentro */ }
  });
  lienzo.addEventListener("pointerup", (e) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    inicio = null;
    if (Math.abs(dx) > UMBRAL_GESTO && Math.abs(dx) > Math.abs(dy)) {
      avanzar(dx < 0 ? 1 : -1, { aMano: true });
    }
  });
  lienzo.addEventListener("pointercancel", () => { inicio = null; });
}

/* ---------------------------------------------------------------------------
   Arranque
--------------------------------------------------------------------------- */

function crearCapas() {
  const lienzo = $("#lienzo");
  capas = [0, 1].map(() => {
    const img = document.createElement("img");
    img.className = "pase__foto";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    img.setAttribute("aria-hidden", "true");
    lienzo.insertBefore(img, $("#aviso"));
    return img;
  });
}

function arrancar() {
  crearCapas();
  if (estado.tele) prepararTele();

  $("#pausa").addEventListener("click", () => pausar(!estado.pausado));
  $("#anterior").addEventListener("click", () => avanzar(-1, { aMano: true }));
  $("#siguiente").addEventListener("click", () => avanzar(1, { aMano: true }));
  $("#provincia").addEventListener("change", (e) => cambiarAmbito(e.target.value, { aMano: true }));
  $("#compartir").addEventListener("click", compartir);
  $("#aviso-boton").addEventListener("click", () => accionAviso?.());
  document.addEventListener("keydown", alPulsarTecla);
  prepararGestos();

  $("#pantalla").hidden = !puedePantalla;
  $("#pantalla").addEventListener("click", alternarPantalla);
  document.addEventListener("fullscreenchange", pintarPantalla);
  document.addEventListener("webkitfullscreenchange", pintarPantalla);
  pintarPantalla();

  // La regla CSS de prefers-reduced-motion apaga el fundido, pero no toca un
  // temporizador: hay que mirar la preferencia aquí, y otra vez si cambia en caliente.
  quieto.addEventListener("change", (e) => pausar(e.matches));
  pausar(estado.pausado);

  cargarProvincias();       // en paralelo: el pase no la espera
  cambiarAmbito(ambitoDeLaUrl());
  requestAnimationFrame(tictac);
}

arrancar();
