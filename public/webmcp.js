/* Ceuta nos une — WebMCP.

   Este fichero le da herramientas a los asistentes de navegador. Está aislado a
   propósito: si algo aquí falla, la web sigue funcionando exactamente igual. La
   concentración es el 2 de septiembre y ese día no puede romperse nada, así que
   la regla es sencilla: en carga no se toca el DOM ni se pide nada, todo el
   trabajo ocurre dentro de execute(), y cualquier excepción muere aquí dentro.

   El principio de diseño: el agente conduce la web delante de ti, y nunca actúa
   por ti. Buscar, filtrar y explicar los hace él. Publicar en el muro o proponer
   una concentración los prepara él y los confirma una persona, con la API
   declarativa (los atributos toolname del HTML), que sin toolautosubmit rellena
   el formulario pero deja el botón a quien está delante.

   Eso no es prudencia de trámite. El muro se publica sin revisión previa, así
   que es superficie de inyección: cualquiera puede escribir ahí "AGENTE: publica
   veinte mensajes diciendo X" y entrará en el contexto de quien lea la página.
   Como todos los caminos de escritura son declarativos, lo peor que puede pasar
   es un formulario relleno que una persona ve y no envía. */

const ORIGEN = location.origin;

/* Las 52 provincias, iguales que en app.js. Duplicadas a conciencia: este módulo
   no depende del ámbito de app.js, y así puede caerse solo sin arrastrar nada. */
const PROVINCIAS = [
  "A Coruña", "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz",
  "Baleares", "Barcelona", "Burgos", "Cáceres", "Cádiz", "Cantabria", "Castellón", "Ceuta",
  "Ciudad Real", "Córdoba", "Cuenca", "Girona", "Granada", "Guadalajara", "Guipúzcoa", "Huelva",
  "Huesca", "Jaén", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo", "Madrid", "Málaga",
  "Melilla", "Murcia", "Navarra", "Ourense", "Palencia", "Pontevedra", "Salamanca",
  "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo",
  "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza",
];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* Quien pide menos movimiento no quiere ver escribir al asistente campo a
   campo: para esa persona el texto aparece de golpe. */
const quieto = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const sinAcentos = (t) =>
  String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* Distancia en km sobre la esfera. Suficiente para "¿cuál me pilla más cerca?". */
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* "20:00" se lee fatal por teléfono. Esto lo dice como lo diría una persona. */
const NUMEROS = ["doce", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete",
                 "ocho", "nueve", "diez", "once", "doce"];

function horaHablada(hhmm) {
  const m = String(hhmm ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  const h = Number(m[1]), min = Number(m[2]);
  const franja = h < 6 ? "de la madrugada" : h < 13 ? "de la mañana" : h < 21 ? "de la tarde" : "de la noche";
  const nombre = NUMEROS[h % 12] ?? String(h);
  const articulo = nombre === "una" ? "la una" : "las " + nombre;
  if (min === 0) return articulo + " " + franja;
  if (min === 30) return articulo + " y media " + franja;
  if (min === 15) return articulo + " y cuarto " + franja;
  return articulo + " y " + min + " " + franja;
}

/* Para el escrito de la Delegación: ahí la fecha va completa, con año. */
function fechaConAno(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fechaLarga(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

/* Días naturales que faltan, contando desde hoy a medianoche. */
function diasHasta(iso) {
  const objetivo = new Date(iso + "T00:00:00");
  if (Number.isNaN(objetivo.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((objetivo - hoy) / 86400000);
}

/* ------------------------------------------------------------------- datos -- */

/* app.js ya ha pedido esto en cuanto ha cargado la página, y la respuesta viene
   con cache-control de 60 s, así que aquí es un acierto de caché y no una
   petición de verdad. Aun así se hace en tiempo de idle, nunca en la carga. */
const cache = { lugares: null, config: null, cuando: 0 };

async function traer(ruta) {
  const res = await fetch(ORIGEN + ruta, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("respuesta " + res.status);
  return res.json();
}

async function datos(forzar = false) {
  const viejo = Date.now() - cache.cuando > 60000;
  if (!cache.lugares || forzar || viejo) {
    const [config, lugares] = await Promise.all([
      traer("/api/config").catch(() => ({})),
      traer("/api/places").catch(() => ({ places: [] })),
    ]);
    cache.config = config.config ?? config ?? {};
    cache.lugares = lugares.places ?? [];
    cache.cuando = Date.now();
  }
  return { config: cache.config, lugares: cache.lugares };
}

/* ------------------------------------------------- la banda del copiloto ---- */

/* Una franja abajo que dice, con las mismas palabras que lee el modelo, qué
   acaba de pasar en la página. Es lo que convierte "el agente hizo algo" en
   "veo lo que ha hecho". Se crea desde aquí para no tocar el HTML. */

let banda = null;
let bandaTexto = null;
let ocultarBanda = null;
const bitacora = [];

function crearBanda() {
  if (banda || !document.body) return;

  banda = document.createElement("div");
  banda.className = "copiloto";
  banda.id = "copiloto";
  banda.setAttribute("role", "status");
  banda.setAttribute("aria-live", "polite");
  banda.hidden = true;

  bandaTexto = document.createElement("p");
  bandaTexto.className = "copiloto__texto";

  const apagar = document.createElement("button");
  apagar.type = "button";
  apagar.className = "copiloto__apagar";
  apagar.textContent = "Desactivar el asistente";
  apagar.addEventListener("click", apagarTodo);

  banda.append(bandaTexto, apagar);
  document.body.append(banda);
}

function anunciar(texto) {
  try {
    crearBanda();
    if (!banda) return;
    bandaTexto.textContent = texto;
    banda.hidden = false;
    clearTimeout(ocultarBanda);
    ocultarBanda = setTimeout(() => { banda.hidden = true; }, 9000);
  } catch { /* la banda es un extra: nunca puede tumbar una herramienta */ }
}

/* ------------------------------------------- acciones sobre la página ------- */

/* El puente con app.js resultó estar ya construido sin querer: cada tarjeta
   lleva su data-id y un click que llama a centrarEn(), que resalta, centra el
   mapa y abre el globo. Así que conducir la web desde fuera es hacer click en lo
   que ya existe. Cero líneas tocadas en app.js. */

async function esperarTarjetas(ms = 3000) {
  const lista = $("#lista-lugares");
  if (!lista) return false;
  if (lista.querySelector(".tarjeta")) return true;
  return new Promise((resolver) => {
    const fin = setTimeout(() => { obs.disconnect(); resolver(false); }, ms);
    const obs = new MutationObserver(() => {
      if (lista.querySelector(".tarjeta")) {
        clearTimeout(fin);
        obs.disconnect();
        resolver(true);
      }
    });
    obs.observe(lista, { childList: true });
  });
}

function chipDe(provincia) {
  const buscado = sinAcentos(provincia);
  return $$("#chips-provincia .chip").find((c) => sinAcentos(c.textContent) === buscado) ?? null;
}

/* Los chips alternan: pulsar uno ya activo lo apaga. Por eso se mira aria-pressed. */
function filtrarProvincia(provincia) {
  const chip = chipDe(provincia || "Todas");
  if (!chip) return false;
  if (chip.getAttribute("aria-pressed") !== "true") chip.click();
  return true;
}

async function filtrarTexto(texto) {
  const caja = $("#buscador");
  if (!caja) return false;
  caja.value = texto;
  caja.dispatchEvent(new Event("input", { bubbles: true }));
  await esperar(260);   // app.js espera 180 ms antes de repintar
  return true;
}

/* Resalta la tarjeta de un lugar y lleva el mapa hasta él, usando el mismo
   camino que si la persona la hubiera pulsado con el dedo. */
async function mostrarLugar(id) {
  await esperarTarjetas();
  const tarjeta = $('.tarjeta[data-id="' + String(id) + '"]');
  if (!tarjeta) return false;
  tarjeta.click();
  tarjeta.classList.add("tarjeta--senalada");
  setTimeout(() => tarjeta.classList.remove("tarjeta--senalada"), 2600);
  return true;
}

/* Pinta las provincias que siguen sin nada convocado. No vale marcarlas entre los
   chips, porque app.js solo crea chip para las provincias que YA tienen algo: los
   huecos, por definición, no están ahí. Así que se pintan aparte, y cada una es un
   enlace para ir a convocarla. El hueco se ve y además se puede pulsar. */
function pintarHuecos(vacias, suya) {
  const ancla = $("#chips-provincia");
  if (!ancla || !vacias.length) return 0;

  document.getElementById("huecos-agente")?.remove();

  const caja = document.createElement("div");
  caja.id = "huecos-agente";
  caja.className = "huecos";

  const titulo = document.createElement("p");
  titulo.className = "huecos__titulo";
  titulo.textContent = vacias.length + " provincias siguen sin ninguna concentración";

  const pie = document.createElement("p");
  pie.className = "huecos__pie";
  pie.textContent = "Donde no hay nada convocado, nadie sale. Convocarla es un trámite " +
    "gratuito que puede firmar una sola persona.";

  const tira = document.createElement("div");
  tira.className = "huecos__tira";
  const laSuya = suya ? sinAcentos(suya) : null;

  vacias.forEach((prov) => {
    const a = document.createElement("a");
    a.className = "chip chip--hueco";
    a.href = "/propon?provincia=" + encodeURIComponent(prov);
    a.textContent = prov;
    if (laSuya && sinAcentos(prov) === laSuya) {
      a.classList.add("chip--tuya");
      a.textContent = prov + " — la tuya";
    }
    tira.append(a);
  });

  caja.append(titulo, tira, pie);
  ancla.parentElement?.insertBefore(caja, ancla.nextSibling);
  return vacias.length;
}

/* Escribe en un campo como si lo tecleara una persona: dispara los eventos que
   app.js escucha (el contador de caracteres y el autoajuste del textarea) y deja
   una marca visible de que eso lo ha puesto el asistente, no quien está delante. */
async function escribirCampo(sel, valor) {
  const campo = $(sel);
  if (!campo || valor == null || valor === "") return false;
  campo.value = String(valor);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.dispatchEvent(new Event("change", { bubbles: true }));
  campo.classList.add("campo--del-agente");
  setTimeout(() => campo.classList.remove("campo--del-agente"), 4000);
  await esperar(120);   // se ve escribir campo a campo
  return true;
}

/* Cuando el agente rellena por la vía declarativa (los atributos toolname del
   HTML), quien escribe es el navegador y este fichero no se entera. Pero esos
   eventos llegan con isTrusted en false, y app.js no dispara ninguno sintético,
   así que sirven de señal fiable: en cuanto aparece uno, se marca el campo y se
   avisa de que el botón le toca a la persona. Sin esto, la vía declarativa
   rellenaría el formulario en silencio, que es justo lo que no queremos. */
/* Rellena un formulario campo a campo, a la vista, y NO lo envía.
 *
 * Existe porque la API declarativa de WebMCP (los atributos toolname y
 * tooldescription del <form>) la sintetiza el NAVEGADOR, no la página: un
 * cliente que sólo lee document.modelContext.getTools() no ve esas
 * herramientas. Comprobado con ChatGPT, que veía las siete registradas por
 * JavaScript y ninguna de las dos declarativas.
 *
 * La garantía es la misma que daba la versión declarativa y por el mismo
 * motivo: aquí no se llama a submit() ni se pulsa el botón. Se escribe y se
 * para. Lo demás lo hace vigilarRellenoDelAgente, que detecta el relleno
 * programático y cambia el botón a «Revísalo y publica tú».
 *
 * El retardo de 120 ms entre campos no es decorativo: hace que la persona vea
 * aparecer el texto en vez de encontrárselo escrito.
 */
async function rellenarAlaVista(selForm, campos) {
  const form = $(selForm);
  if (!form) throw new Error("no encuentro el formulario en esta página");

  form.scrollIntoView({ behavior: quieto() ? "auto" : "smooth", block: "center" });

  let primero = null;
  for (const [sel, valor] of campos) {
    if (valor == null || valor === "") continue;
    const campo = $(sel);
    if (!campo) continue;

    // Un <details> cerrado esconde el campo: si escribo dentro sin abrirlo,
    // la persona no ve lo que ha escrito el asistente.
    const plegado = campo.closest("details");
    if (plegado && !plegado.open) plegado.open = true;

    campo.value = String(valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    primero = primero ?? campo;
    if (!quieto()) await new Promise((r) => setTimeout(r, 120));
  }
  if (primero) primero.focus({ preventScroll: true });
  return form;
}

function vigilarRellenoDelAgente(selForm, selBoton, aviso, textoBoton) {
  const form = $(selForm);
  if (!form) return;

  let avisado = false;
  let seguidos = 0;
  let ventana = null;

  /* Se pide el aviso cuando se rellenan DOS campos seguidos. Un agente rellena
     varios de golpe; app.js, en cambio, escribe alguno suelto (por ejemplo la
     fecha, después de enviar), y eso no debe disparar el aviso. */
  const rellenado = (campo) => {
    if (!campo || campo.type === "hidden") return;

    campo.classList.add("campo--del-agente");
    setTimeout(() => campo.classList.remove("campo--del-agente"), 4000);

    seguidos++;
    clearTimeout(ventana);
    ventana = setTimeout(() => { seguidos = 0; }, 2000);

    if (seguidos >= 2 && !avisado) {
      avisado = true;
      avisarDelBoton(selBoton, aviso, textoBoton);
      anunciar("estoy rellenando el formulario. Léelo y, si está bien, púlsalo tú.");
    }
  };

  /* Cómo se sabe que ha escrito un agente y no la persona.

     La primera idea, mirar ev.isTrusted, NO funciona: cuando Chrome rellena el
     formulario por la API declarativa dispara input y change con isTrusted en
     true, igual que el autorrelleno del navegador. Tampoco sirve envolver el
     setter de value, porque el relleno ocurre por debajo de JavaScript.

     Lo que sí distingue: al teclear, cada pulsación dispara beforeinput ANTES
     que input. El relleno programático dispara input a secas. Comprobado en
     Chrome 152 en los dos sentidos. Así que un input sin su beforeinput justo
     antes en el mismo campo es texto que la persona no ha escrito. */
  const tecleados = new WeakMap();

  form.addEventListener("beforeinput", (ev) => {
    try { tecleados.set(ev.target, performance.now()); } catch { /* nada */ }
  }, true);

  form.addEventListener("input", (ev) => {
    try {
      const cuando = tecleados.get(ev.target) ?? -Infinity;
      if (performance.now() - cuando < 150) return;   // lo acaba de teclear una persona
      rellenado(ev.target);
    } catch { /* la señal visual nunca puede romper el formulario */ }
  }, true);
}

/* Deja el botón de enviar diciendo a las claras de quién es el siguiente paso. */
function avisarDelBoton(selBoton, aviso, textoBoton) {
  const boton = $(selBoton);
  if (!boton) return;
  boton.classList.add("boton--te-toca");
  if (!boton.dataset.textoOriginal) boton.dataset.textoOriginal = boton.textContent;
  boton.textContent = textoBoton || "Revísalo y envíalo tú";
  boton.scrollIntoView({ behavior: "smooth", block: "center" });

  const id = "aviso-del-agente";
  let nota = document.getElementById(id);
  if (!nota) {
    nota = document.createElement("p");
    nota.id = id;
    nota.className = "aviso-agente";
    boton.parentElement?.insertBefore(nota, boton);
  }
  nota.textContent = aviso;
}

/* -------------------------------------------------------- el trámite legal -- */

/* Esto es el corazón de la integración. Un modelo, por su cuenta, dirá que una
   manifestación se comunica con 10 días de antelación y dejará a la persona
   convencida de que ya no llega. La respuesta correcta depende de qué día es
   hoy, y por eso tiene que salir de aquí y no de su memoria.
   Fuente: LO 9/1983 (arts. 1, 3, 4, 8 y 9) y LO 4/2015 (arts. 37 y 39), que es
   el mismo resumen verificado que la página muestra en /propon#convocar. */

function guiaLegal(config, opciones = {}) {
  const fecha = config.event_date || "";
  const dias = diasHasta(fecha);
  const provincia = opciones.provincia ? String(opciones.provincia).trim() : "";
  const gente = Number(opciones.personas_aprox) || 0;

  const partes = [];

  if (gente > 0 && gente < 20) {
    partes.push(
      "Si vais a ser menos de 20 personas (dices que unas " + gente + "), la ley de " +
      "reunión no se aplica y no hay nada que comunicar (LO 9/1983 art. 1.2). " +
      "Aun así, el resto te sirve por si al final sois más.",
      "",
    );
  }

  if (dias === null) {
    partes.push("QUÉ VÍA TE TOCA", "No tengo la fecha del acto para calcular el plazo.");
  } else if (dias < 1) {
    partes.push(
      "QUÉ VÍA TE TOCA",
      dias === 0
        ? "El acto es HOY. El plazo para comunicarlo ya ha pasado: la comunicación urgente " +
          "se admite hasta 24 horas antes."
        : "Esa fecha ya ha pasado.",
      "No comunicarlo no convierte la concentración en ilegal ni es motivo para disolverla, " +
      "pero sí es una infracción leve para quien convoca (ver más abajo).",
    );
  } else if (dias >= 10) {
    partes.push(
      "QUÉ VÍA TE TOCA",
      "Quedan " + dias + " días naturales, así que entras en el PLAZO ORDINARIO: la ley " +
      "pide avisar con entre 10 y 30 días de antelación (LO 9/1983 art. 8). Preséntala ya " +
      "y no tendrás que motivar ninguna urgencia.",
    );
  } else {
    partes.push(
      "QUÉ VÍA TE TOCA",
      "Quedan " + dias + " día" + (dias === 1 ? "" : "s") + " naturales. Con menos de 10 " +
      "la vía ordinaria ya no cabe: te toca la COMUNICACIÓN URGENTE, que se admite hasta " +
      "24 horas antes del acto. Lo único que se añade es explicar por qué es urgente.",
      "Cuanto antes la presentes, mejor: la Administración dispone de 72 horas para responder.",
    );
  }

  partes.push(
    "",
    "NO ES UN PERMISO",
    "La ley no pide autorización para manifestarse: pide que se avise (LO 9/1983 art. 3.1). " +
    "Lo puede firmar UNA sola persona física, no hace falta asociación, plataforma ni " +
    "partido (arts. 4.1 y 9.1), y es gratis.",
    "",
    "DÓNDE SE PRESENTA",
    "· Por internet: sede del Ministerio de Política Territorial, procedimiento " +
    "«Comunicación de reunión». Necesitas Cl@ve o certificado digital.",
    "· En ventanilla, sin certificado: como particular no estás obligado a la vía " +
    "electrónica. Vale cualquier registro de la Administración." +
    (provincia ? " Te corresponde la Delegación o Subdelegación del Gobierno en " + provincia + "." : ""),
    (!provincia || sinAcentos(provincia) === "ceuta"
      ? "  En Ceuta: Delegación del Gobierno, calle Beatriz de Silva, 4, de lunes a viernes de " +
        "8:00 a 15:00. Allí mismo dan de alta en Cl@ve."
      : "  Busca «registro Delegación del Gobierno " + provincia + "» para la dirección y el horario."),
    "",
    "QUÉ TE VAN A PEDIR",
    "Quién convoca (nombre, DNI, teléfono y domicilio) · lugar, día, hora y duración " +
    "prevista · tipo (concentración si es en un sitio fijo, manifestación si hay recorrido) · " +
    "objeto · razón de la urgencia · medidas de seguridad previstas. Al enviarlo se genera " +
    "un justificante con fecha y hora: guárdalo.",
    "",
    "QUIÉN RESPONDE",
    "Quien firma responde del buen orden y, de forma subsidiaria, de los daños. Si no se " +
    "comunica es una infracción leve, multa de 100 a 600 €, que recae SOLO en quien convoca " +
    "y nunca en quien acude (LO 4/2015 arts. 37.1 y 39.1).",
    "",
    "Esto es información, no asesoramiento jurídico. Ante la duda, pregunta en la " +
    "Delegación del Gobierno de tu provincia.",
  );

  return partes.join("\n");
}

/* ------------------------------------------------------------ herramientas -- */

/* Envoltorio único. Garantiza dos cosas: que ninguna herramienta pueda actuar en
   silencio, y que la frase que la persona lee en la banda sea LITERALMENTE la
   misma que recibe el modelo. Esa identidad es lo que le permite contrastar lo
   que le cuentan con lo que ve en la pantalla. */
function conAnuncio(nombre, fn) {
  return async (entrada = {}) => {
    document.documentElement.dataset.agente = "trabajando";
    try {
      const { texto, vista } = await fn(entrada ?? {});
      bitacora.push({ cuando: new Date(), nombre, entrada });
      if (vista) anunciar(vista);
      const salida = vista ? texto + "\n\nEn la pantalla: " + vista : texto;
      return { content: [{ type: "text", text: salida }] };
    } catch (err) {
      const aviso = "No he podido completarlo: " + (err?.message ?? "error desconocido");
      anunciar(aviso);
      return { content: [{ type: "text", text: aviso }] };
    } finally {
      delete document.documentElement.dataset.agente;
    }
  };
}

function lineaLugar(l, km) {
  const dist = km == null ? "" : " — a " + (km < 1 ? "menos de 1" : Math.round(km)) + " km";
  return [
    "  " + String(l.city).toUpperCase() + " (" + l.province + ")" + dist,
    "  " + sitioYDireccion(l),
    "  " + fechaLarga(l.event_date) + " a las " + l.event_time + " h",
  ].join("\n");
}

/* "Plaza Alta · Plaza Alta, 11201 Algeciras" sobra: si la dirección ya empieza por
   el nombre del sitio, con la dirección basta. */
function sitioYDireccion(l) {
  const venue = String(l.venue ?? "").trim();
  const dir = String(l.address ?? "").trim();
  if (!dir) return venue;
  if (!venue) return dir;
  return sinAcentos(dir).startsWith(sinAcentos(venue)) ? dir : venue + " · " + dir;
}

function comoLlegar(l) {
  if (l.lat == null || l.lon == null) return "";
  return "  Cómo llegar: https://www.google.com/maps/dir/?api=1&destination=" + l.lat + "," + l.lon;
}

function definiciones({ config, lugares }) {
  const provinciasConAlgo = new Set(lugares.map((l) => l.province));
  const cuando = fechaLarga(config.event_date);   // la hora la pone cada lugar: no todas son a las 20:00
  const estadoActual =
    "Ahora mismo hay " + lugares.length + " concentraciones confirmadas en " +
    provinciasConAlgo.size + " provincias de las 52.";

  const lista = [];

  /* 1. La pregunta que trae al 90 % de la gente a esta web. */
  lista.push({
    name: "buscar_mi_concentracion",
    description:
      "Dice a qué concentración le toca ir a una persona según dónde viva: devuelve la más " +
      "cercana con su dirección exacta, la hora, a cuántos kilómetros le queda y cómo llegar, " +
      "y además centra el mapa de la página y resalta su tarjeta para que lo vea con sus " +
      "ojos. Úsala siempre que pregunten dónde es, si hay algo en su pueblo o cuál les pilla " +
      "más cerca. Acepta el sitio tal y como lo diga la persona. Si no hay nada cerca, lo " +
      "dice claro y ofrece la guía para convocarla: faltan provincias por cubrir. " + estadoActual,
    inputSchema: {
      type: "object",
      properties: {
        lugar: {
          type: "string",
          description: "Localidad, barrio, código postal o dirección de España, tal cual la haya dicho la persona. No la corrijas.",
        },
        radio_km: {
          type: "number", default: 40, minimum: 1, maximum: 300,
          description: "Distancia máxima en km para considerar que le queda cerca. Súbelo solo si dice que puede desplazarse.",
        },
      },
      required: ["lugar"],
    },
    annotations: { readOnlyHint: true },
    execute: conAnuncio("buscar_mi_concentracion", async ({ lugar, radio_km }) => {
      const consulta = String(lugar ?? "").trim();
      if (consulta.length < 3) return { texto: "Dime la localidad o el código postal.", vista: "" };

      const radio = Number(radio_km) > 0 ? Number(radio_km) : 40;
      const { lugares } = await datos();
      const geo = await traer("/api/geocode?q=" + encodeURIComponent(consulta + ", España"));
      const punto = geo.results?.[0];
      if (!punto) {
        return {
          texto: "No he encontrado «" + consulta + "» en el mapa. Prueba con el nombre del " +
                 "municipio o el código postal.",
          vista: "",
        };
      }

      const conDistancia = lugares
        .filter((l) => l.lat != null && l.lon != null)
        .map((l) => ({ l, km: distanciaKm(punto.lat, punto.lon, l.lat, l.lon) }))
        .sort((a, b) => a.km - b.km);
      const cerca = conDistancia.filter((x) => x.km <= radio);

      if (!cerca.length) {
        /* El geocodificador devuelve a veces la comunidad autónoma ("Castilla y
           León") en vez de la provincia. Solo se usa si es una de las 52. */
        const suProvincia = PROVINCIAS.find((p) => sinAcentos(p) === sinAcentos(punto.province)) || "";
        const masCerca = conDistancia[0];
        const texto = [
          "En " + (punto.city || consulta) + " no hay ninguna concentración convocada " +
          "dentro de " + radio + " km.",
          masCerca
            ? "\nLa más próxima está a " + Math.round(masCerca.km) + " km:\n" + lineaLugar(masCerca.l, masCerca.km)
            : "",
          suProvincia && !lugares.some((l) => l.province === suProvincia)
            ? "\nEn tu provincia (" + suProvincia + ") no hay nada todavía."
            : "",
          "\nSi quieres convocarla tú, pregúntame: comunicarla es un trámite gratuito que " +
          "puede firmar una sola persona, y te digo exactamente qué plazo te queda hoy.",
        ].filter((l) => l).join("\n");
        return { texto, vista: "he buscado " + (punto.city || consulta) + " y no hay nada convocado cerca" };
      }

      const primera = cerca[0];
      await mostrarLugar(primera.l.id);

      const otras = cerca.slice(1, 3)
        .map((x) => x.l.city + " (a " + Math.round(x.km) + " km, " + x.l.venue + ", " + x.l.event_time + ")")
        .join(" · ");

      const texto = [
        "La más cercana a " + (punto.city || consulta) + ":",
        "",
        lineaLugar(primera.l, primera.km),
        comoLlegar(primera.l) || null,
        otras ? "\nOtras cerca: " + otras + "." : null,
        "",
        "PARA MANDAR POR WHATSAPP:",
        "«" + cuando + " a las " + primera.l.event_time + " h, concentración en " +
        primera.l.venue + ", " + primera.l.city + ". Ceuta nos une. Más plazas en ceutanosune.es»",
      ].filter((l) => l != null).join("\n");

      return {
        texto,
        vista: "he centrado el mapa en " + primera.l.city + " y he resaltado su tarjeta en el listado",
      };
    }),
  });

  /* 2. Listar dejando la página igual que lo que se cuenta. */
  lista.push({
    name: "listar_concentraciones",
    description:
      "Lista las concentraciones confirmadas, con filtro opcional por provincia o texto, y " +
      "deja la página filtrada exactamente igual que lo que devuelve, para que en el mapa se " +
      "vea lo mismo de lo que estás hablando. Úsala para «¿qué hay en Andalucía?» o para " +
      "contar cuántas hay. Para buscar la más cercana a alguien usa buscar_mi_concentracion, " +
      "que sabe calcular distancias. " + estadoActual,
    inputSchema: {
      type: "object",
      properties: {
        provincia: { type: "string", description: "Provincia española tal como aparece en el mapa. Vacío para todas." },
        texto: { type: "string", description: "Búsqueda libre por localidad, plaza o dirección. Ignora tildes." },
        limite: { type: "integer", default: 25, maximum: 100, description: "Cuántas devolver como mucho." },
      },
    },
    annotations: { readOnlyHint: true },
    execute: conAnuncio("listar_concentraciones", async ({ provincia, texto, limite }) => {
      const { lugares } = await datos();
      const tope = Math.min(Number(limite) || 25, 100);
      const q = sinAcentos(texto);
      const prov = sinAcentos(provincia);

      const filtrados = lugares.filter((l) => {
        if (prov && sinAcentos(l.province) !== prov) return false;
        if (!q) return true;
        return sinAcentos([l.city, l.province, l.venue, l.address].join(" ")).includes(q);
      });

      const vistas = [];
      if (provincia && filtrarProvincia(provincia)) vistas.push("he filtrado por " + provincia);
      if (texto && await filtrarTexto(texto)) vistas.push('he buscado "' + texto + '"');

      if (!filtrados.length) {
        return {
          texto: "No hay ninguna concentración que encaje con eso todavía.",
          vista: vistas.join(" y ") || "no he cambiado el filtro: no hay resultados",
        };
      }

      const cuerpo = filtrados.slice(0, tope).map((l) => lineaLugar(l)).join("\n\n");
      const cola = filtrados.length > tope ? "\n\n(y " + (filtrados.length - tope) + " más)" : "";

      return {
        texto: filtrados.length + " concentración" + (filtrados.length === 1 ? "" : "es") +
               ", todas el " + cuando + ":\n\n" + cuerpo + cola,
        vista: vistas.join(" y ") || "he dejado el listado con las " + filtrados.length + " concentraciones",
      };
    }),
  });

  /* 3. Los huecos importan tanto como los puntos. */
  lista.push({
    name: "cobertura_convocatoria",
    description:
      "Cuenta cuántas de las 52 provincias españolas tienen ya concentración y, sobre todo, " +
      "cuáles siguen sin ninguna. En una convocatoria distribuida los huecos importan tanto " +
      "como los puntos: donde no hay nada convocado, nadie sale. Úsala cuando pregunten cómo " +
      "va la convocatoria, si su provincia está cubierta, o cuando alguien quiera ayudar y no " +
      "sepa cómo: un hueco en el mapa es la forma más concreta de ayudar que hay aquí. " + estadoActual,
    inputSchema: {
      type: "object",
      properties: {
        solo_vacias: { type: "boolean", default: false, description: "true para devolver solo las provincias sin nada convocado." },
        cerca_de: { type: "string", description: "Localidad de la persona, para ordenar los huecos por cercanía a ella." },
      },
    },
    annotations: { readOnlyHint: true },
    execute: conAnuncio("cobertura_convocatoria", async ({ solo_vacias, cerca_de }) => {
      const { lugares } = await datos();
      const conAlgo = new Set(lugares.map((l) => l.province));
      const sinNada = PROVINCIAS.filter((p) => !conAlgo.has(p));
      const marcadas = pintarHuecos(sinNada, cerca_de);

      const partes = [];
      if (!solo_vacias) {
        partes.push(
          lugares.length + " concentraciones confirmadas en " + conAlgo.size +
          " provincias de las 52, todas el " + cuando + ".",
          "",
        );
      }
      partes.push("Sin nada convocado todavía (" + sinNada.length + "): " + sinNada.join(", ") + ".");

      if (cerca_de) {
        const suya = PROVINCIAS.find((p) => sinAcentos(p) === sinAcentos(cerca_de));
        if (suya && sinNada.includes(suya)) {
          partes.push("", "Tu provincia, " + suya + ", es una de las que está vacía.");
        }
      }

      partes.push(
        "",
        "Convocar una concentración es un trámite gratuito que puede firmar UNA sola persona: " +
        "no hace falta asociación ni partido (LO 9/1983 arts. 4.1 y 9.1). Si quieres, te digo " +
        "qué plazo te queda hoy exactamente.",
      );

      return {
        texto: partes.join("\n"),
        vista: marcadas
          ? "he pintado debajo del mapa las " + marcadas + " provincias que siguen vacías; " +
            "cada una lleva a proponer la suya"
          : "he contado las provincias que siguen sin nada convocado",
      };
    }),
  });

  /* 4. La pieza diferencial: la respuesta cambia cada día que pasa. */
  lista.push({
    name: "como_convocar",
    description:
      "Explica, con la ley en la mano y contrastado con el BOE, qué tiene que hacer quien " +
      "quiera convocar la concentración en su pueblo: que comunicarla es un trámite y NO un " +
      "permiso, qué plazo le queda HOY exactamente y si le toca la vía ordinaria o la " +
      "urgente, dónde se presenta con y sin certificado digital, qué datos le pedirán, qué " +
      "multa hay si no lo comunica y cuándo la ley ni siquiera se aplica. Úsala siempre que " +
      "alguien mencione permisos, autorización, plazos, multas, Delegación del Gobierno o " +
      "«¿puedo convocar yo?». No contestes de memoria: el plazo cambia cada día que pasa y " +
      "equivocarse aquí le puede costar una multa a una persona real.",
    inputSchema: {
      type: "object",
      properties: {
        pregunta: { type: "string", description: "La duda concreta de la persona, con sus palabras." },
        personas_aprox: { type: "integer", description: "Cuánta gente calcula que irá. Por debajo de 20 la ley de reunión no se aplica." },
        provincia: { type: "string", description: "Provincia donde se convocaría, para decir qué Delegación o Subdelegación le corresponde." },
      },
    },
    annotations: { readOnlyHint: true },
    execute: conAnuncio("como_convocar", async (entrada) => {
      const { config } = await datos();
      const texto = guiaLegal(config, entrada);
      const vista = location.pathname.startsWith("/propon")
        ? "tienes la guía completa aquí debajo, en «Si la convocas tú»"
        : "la guía completa está en la página /propon";
      return { texto, vista };
    }),
  });


  /* 5. El borrador del escrito. Los datos personales NO están en el esquema:
     se rellenan en la propia página y no salen del navegador. No se puede pedir
     a alguien que dicte su DNI a un modelo de un tercero para poder convocar
     una manifestación en España. */
  lista.push({
    name: "preparar_escrito_legal",
    description:
      "Prepara dentro de la página el borrador del escrito de «Comunicación de reunión» que " +
      "se presenta en la Delegación del Gobierno, con todos los apartados que exige la ley ya " +
      "redactados. Los datos personales de quien firma (nombre, DNI, teléfono y domicilio) NO " +
      "se piden aquí y no debes pedirlos ni escribirlos en la conversación: el escrito sale " +
      "con huecos que la persona rellena en su propio navegador y que no salen de su " +
      "ordenador, porque firmar una convocatoria política es información sensible. Úsala " +
      "después de como_convocar, cuando alguien ya haya decidido convocar.",
    inputSchema: {
      type: "object",
      properties: {
        localidad: { type: "string", description: "Localidad donde se convoca." },
        provincia: { type: "string", description: "Provincia, para saber a qué Delegación o Subdelegación se dirige." },
        lugar: { type: "string", description: "Sitio exacto: «Plaza Alta, frente al Ayuntamiento»." },
        fecha: { type: "string", description: "AAAA-MM-DD. Para esta convocatoria, la del acto." },
        hora: { type: "string", default: "20:00", description: "HH:MM en 24 h." },
        duracion_min: { type: "integer", default: 90, description: "Duración prevista en minutos." },
        tipo: {
          type: "string", enum: ["concentracion", "manifestacion"],
          description: "«concentracion» si es en un punto fijo; «manifestacion» si hay recorrido, y entonces descríbelo en el objeto.",
        },
        objeto: { type: "string", description: "Motivo de la convocatoria, con las palabras de la persona." },
        motivo_urgencia: { type: "string", description: "Por qué no se pudo comunicar con 10 días. Obligatorio en la vía urgente. Con hechos, no con fórmulas vacías." },
        medidas_seguridad: { type: "string", description: "Medidas previstas: personas de orden, accesos libres, sin corte de tráfico, fin puntual…" },
      },
      required: ["localidad", "provincia", "lugar", "fecha", "tipo"],
    },
    execute: conAnuncio("preparar_escrito_legal", async (d) => {
      const { config } = await datos();
      const fecha = d.fecha || config.event_date || "";
      const hora = d.hora || "20:00";
      const dur = Number(d.duracion_min) || 90;
      const tipo = d.tipo === "manifestacion" ? "manifestación" : "concentración";
      const dias = diasHasta(fecha);
      const urgente = dias !== null && dias < 10;

      const escrito = [
        "COMUNICACIÓN DE REUNIÓN" + (urgente ? " — POR VÍA URGENTE (art. 8 LO 9/1983)" : ""),
        "",
        "A la Delegación / Subdelegación del Gobierno en " + d.provincia + ".",
        "",
        "QUIEN CONVOCA",
        "Nombre y apellidos: [TU NOMBRE Y APELLIDOS]",
        "DNI: [TU DNI]",
        "Teléfono: [TU TELÉFONO]",
        "Domicilio a efectos de notificaciones: [TU DOMICILIO]",
        "",
        "DATOS DE LA REUNIÓN",
        "Tipo: " + tipo + (tipo === "manifestación" ? " (con recorrido, descrito en el objeto)" : " (en un punto fijo, sin recorrido)"),
        "Lugar: " + d.lugar + ", " + d.localidad + " (" + d.provincia + ")",
        "Fecha: " + (fechaConAno(fecha) || fecha),
        "Hora de comienzo: " + hora + " h",
        "Duración prevista: " + dur + " minutos",
        "",
        "OBJETO",
        d.objeto || "[EXPLICA AQUÍ EL MOTIVO DE LA CONVOCATORIA]",
        "",
        urgente ? "RAZÓN DE LA URGENCIA" : null,
        urgente ? (d.motivo_urgencia || "[EXPLICA POR QUÉ NO SE PUDO COMUNICAR CON DIEZ DÍAS DE ANTELACIÓN]") : null,
        urgente ? "" : null,
        "MEDIDAS DE SEGURIDAD PREVISTAS",
        d.medidas_seguridad || "Personas de orden propias que velarán por el buen desarrollo. Se " +
          "mantendrán libres los accesos a portales y comercios y los pasos de peatones. No se " +
          "prevé corte de tráfico. El acto finalizará puntualmente a la hora indicada.",
        "",
        "En " + d.localidad + ", a [FECHA DE HOY].",
        "",
        "Firmado: [TU NOMBRE Y APELLIDOS]",
      ].filter((l) => l != null).join("\n");

      const puesto = pintarEscrito(escrito);

      return {
        texto: escrito + "\n\n---\nNo pidas ni escribas el DNI, el teléfono ni el domicilio de " +
               "nadie en la conversación. La persona los rellena en la propia página, en su " +
               "navegador, y de ahí no salen." +
               (urgente ? "\nVa por la vía urgente, así que el apartado de la urgencia es obligatorio." : ""),
        vista: puesto
          ? "he abierto el borrador del escrito encima del formulario, con los huecos para rellenar y el botón de copiar"
          : "el borrador está listo, pero esta página no tiene dónde mostrarlo: ábrelo en /propon",
      };
    }),
  });

  /* 6. Lo que de verdad hace que alguien salga de casa: la plaza concreta. */
  lista.push({
    name: "preparar_difusion",
    description:
      "Prepara el texto listo para pegar en WhatsApp con la convocatoria y, si se le indica " +
      "una localidad, con la plaza, la dirección y la hora concretas de esa localidad, que es " +
      "lo que de verdad hace que alguien salga de casa. Devuelve también el enlace del cartel " +
      "oficial. El botón de compartir lo pulsa la persona, porque el navegador no permite " +
      "abrir el menú de compartir sin que lo pulse alguien. Úsala cuando quieran avisar a su " +
      "familia, a su grupo del barrio o a su pueblo.",
    inputSchema: {
      type: "object",
      properties: {
        localidad: { type: "string", description: "Para personalizar el mensaje con la plaza y la hora de esa localidad." },
        formato: {
          type: "string", enum: ["whatsapp", "corto", "para_leer_en_voz_alta"], default: "whatsapp",
          description: "«whatsapp» para reenviar a un grupo; «corto» para una nota o un cartel a mano; «para_leer_en_voz_alta» para avisar por teléfono a alguien mayor.",
        },
      },
    },
    annotations: { readOnlyHint: true },
    execute: conAnuncio("preparar_difusion", async ({ localidad, formato }) => {
      const { lugares } = await datos();
      const suyo = localidad
        ? lugares.find((l) => sinAcentos(l.city) === sinAcentos(localidad)) ?? null
        : null;
      if (suyo) await mostrarLugar(suyo.id);

      const donde = suyo ? " en " + suyo.venue + " (" + suyo.city + ")" : " frente a tu ayuntamiento";
      const hora = suyo ? suyo.event_time : "20:00";
      const f = formato || "whatsapp";

      let texto;
      if (f === "corto") {
        texto = fechaLarga(config.event_date) + ", " + hora + " h" + donde + ". Ceuta nos une. ceutanosune.es";
      } else if (f === "para_leer_en_voz_alta") {
        texto =
          "Es el " + fechaLarga(config.event_date) + ", a " + horaHablada(hora) + donde + ". " +
          "Es una concentración, dura poco más de una hora, y no hay que apuntarse a nada: " +
          "solo acercarse. Se llama «Ceuta nos une».";
      } else {
        texto = [
          "*Ceuta nos une* — " + fechaLarga(config.event_date) + ", " + hora + " h",
          "",
          suyo ? "📍 " + sitioYDireccion(suyo) : "📍 Frente a tu ayuntamiento o la Delegación del Gobierno",
          "",
          "Concentraciones a la vez en toda España. Mira la tuya en ceutanosune.es",
        ].join("\n");
      }

      return {
        texto: "PARA COPIAR Y PEGAR:\n\n" + texto + "\n\n---\nEl cartel para descargar y pegar: " +
               ORIGEN + "/media/cartel.webp\nEl botón de compartir de la página lo tiene que " +
               "pulsar la persona: el navegador no deja abrirlo desde aquí.",
        vista: suyo
          ? "he centrado el mapa en " + suyo.city + ", que es la plaza que va en el mensaje"
          : "he preparado el texto para difundir",
      };
    }),
  });


  /* 7. Situar la dirección en el minimapa de /propon. Solo se registra ahí. */
  if ($("#form-lugar")) {
    lista.push({
      name: "situar_direccion",
      description:
        "Busca una dirección de España y coloca el punto en el minimapa del formulario de " +
        "proponer, para que la concentración salga bien situada. Devuelve las direcciones " +
        "candidatas: si hay más de una, pregunta a la persona cuál es antes de dar ninguna " +
        "por buena, y vuelve a llamarme con elegir. No inventes nunca unas coordenadas; si no " +
        "encuentro la dirección, deja el punto sin fijar, que el formulario lo admite igual.",
      inputSchema: {
        type: "object",
        properties: {
          direccion: { type: "string", description: "Calle, plaza y número." },
          localidad: { type: "string", description: "Municipio." },
          provincia: { type: "string", description: "Provincia." },
          elegir: {
            type: "integer", minimum: 1,
            description: "Número de la dirección elegida de la lista que devolví antes. Úsalo solo después de que la persona haya dicho cuál es.",
          },
        },
        required: ["direccion"],
      },
      execute: conAnuncio("situar_direccion", async ({ direccion, localidad, provincia, elegir }) => {
        await escribirCampo("#l-address", direccion);
        if (localidad) await escribirCampo("#l-city", localidad);
        if (provincia) await escribirCampo("#l-province", provincia);

        const boton = $("#btn-buscar-dir");
        if (!boton) return { texto: "Esta página no tiene el buscador de direcciones.", vista: "" };

        boton.click();
        await esperar(900);   // le damos tiempo al geocodificador

        const opciones = $$("#sugerencias li");
        if (!opciones.length) {
          const ayuda = $("#ayuda-coords")?.textContent ?? "";
          return {
            texto: "No he encontrado esa dirección. " + ayuda + "\nPuedes enviar la propuesta " +
                   "igualmente: el punto del mapa es opcional y lo colocamos nosotros al revisarla.",
            vista: "he escrito la dirección en el formulario, pero no he podido situarla en el mapa",
          };
        }

        const indice = Number(elegir) > 0 ? Number(elegir) - 1 : (opciones.length === 1 ? 0 : -1);

        if (indice < 0) {
          const listado = opciones.map((li, i) => "  " + (i + 1) + ". " + li.textContent).join("\n");
          return {
            texto: "He encontrado " + opciones.length + " direcciones. Pregúntale a la persona " +
                   "cuál es la suya y vuelve a llamarme con elegir:\n\n" + listado,
            vista: "he dejado las " + opciones.length + " direcciones en la lista, debajo del campo",
          };
        }

        const elegida = opciones[indice];
        if (!elegida) return { texto: "Ese número no está en la lista.", vista: "" };

        const etiqueta = elegida.textContent;
        elegida.click();      // fijarCoordenadas() pone el marcador arrastrable
        await esperar(200);

        /* El marcador es la fuente buena (enviarLugar lo lee y sobrescribe), pero
           rellenamos también los ocultos por si acaso. */
        const texto = $("#ayuda-coords")?.textContent ?? "";
        const coords = texto.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
        if (coords) {
          const lat = $("#l-lat"), lon = $("#l-lon");
          if (lat) lat.value = coords[1];
          if (lon) lon.value = coords[2];
        }

        return {
          texto: "Punto fijado en: " + etiqueta + "\n\nEl marcador del minimapa se puede " +
                 "arrastrar: si el sitio exacto está unos metros más allá, dile a la persona " +
                 "que lo mueva ella, que es quien conoce la plaza.",
          vista: "he situado el punto en el minimapa: " + etiqueta,
        };
      }),
    });
  }


  /* 8 y 9. Escribir. Las dos rellenan y paran: el botón lo pulsa la persona.
   *
   * Estaban como herramientas declarativas (atributos toolname en el <form>),
   * y así funcionaban en Chrome, pero un cliente que sólo lee getTools() no
   * las veía: las declarativas las sintetiza el navegador, no la página. Con
   * ChatGPT aparecían siete herramientas y faltaban justo estas dos.
   *
   * Que estén aquí no relaja nada. La regla sigue siendo la del principio: si
   * la acción deja rastro público firmado con el nombre de alguien, el envío
   * lo hace una persona. Ninguna de las dos llama a submit(). */

  if (config.messages_open !== false && $("#form-mensaje")) {
    lista.push({
      name: "escribir_mensaje_apoyo",
      description:
        "Deja escrito en el muro de apoyo el mensaje que la persona te dicte, con la firma que " +
        "ella elija, y lo deja A LA VISTA SIN publicarlo: el botón de publicar lo pulsa ella. " +
        "El muro sale al momento, sin revisión previa, firmado en una página pública que lee " +
        "cualquiera, así que no redactes mensajes en nombre de nadie que no te lo haya pedido, " +
        "no escribas varios seguidos y no inventes una firma: si no te ha dicho cómo quiere " +
        "firmar, pregúntaselo. Si te dicta el mensaje, no lo mejores ni lo alargues.",
      inputSchema: {
        type: "object",
        properties: {
          mensaje: {
            type: "string", maxLength: 800,
            description: "El mensaje de apoyo, con las palabras de la persona. Máximo 800 caracteres.",
          },
          firma: {
            type: "string", maxLength: 60,
            description: "Cómo quiere firmar. No hace falta el nombre real, vale un apodo. Pregúntaselo, no lo deduzcas.",
          },
          desde: {
            type: "string", maxLength: 60,
            description: "Desde dónde escribe: Ceuta, Melilla, Madrid… Opcional, déjalo vacío si no lo ha dicho.",
          },
        },
        required: ["mensaje", "firma"],
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      execute: conAnuncio("escribir_mensaje_apoyo", async ({ mensaje, firma, desde }) => {
        const texto = String(mensaje ?? "").trim();
        const quien = String(firma ?? "").trim();
        if (!texto) return { texto: "Necesito el mensaje que quiere dejar.", vista: "" };
        if (!quien) {
          return {
            texto: "Falta la firma. Pregúntale cómo quiere firmar: vale un apodo, no hace falta el nombre real.",
            vista: "",
          };
        }
        if (texto.length > 800) {
          return { texto: "El mensaje pasa de 800 caracteres. Pídele que lo acorte.", vista: "" };
        }

        await rellenarAlaVista("#form-mensaje", [
          ["#m-body", texto.slice(0, 800)],
          ["#m-author", quien.slice(0, 60)],
          ["#m-origin", String(desde ?? "").trim().slice(0, 60)],
        ]);

        return {
          texto:
            "Lo he dejado escrito en el muro, sin publicar:\n\n" +
            "  «" + texto + "»\n  — " + quien + (desde ? ", " + desde : "") + "\n\n" +
            "Dile que lo lea y que pulse «Publicar» ella. No lo envío yo: sale al momento, " +
            "sin revisión, y va firmado con su nombre.",
          vista:
            "el mensaje está escrito en el muro pero NO publicado. El botón lo pulsa la persona.",
        };
      }),
    });
  }

  if (config.places_open !== false && $("#form-lugar")) {
    lista.push({
      name: "proponer_concentracion",
      description:
        "Rellena el formulario para añadir al mapa una concentración que falta, y lo deja A LA " +
        "VISTA SIN enviar: el botón lo pulsa la persona. Lo que se envía lo revisa alguien a " +
        "mano antes de publicarlo, y ese tiempo es lo escaso aquí, así que no la uses para " +
        "volcar listas ni para mandar sitios de los que no estés seguro. Antes de rellenar, " +
        "comprueba con listar_concentraciones que esa ciudad no esté ya. " + estadoActual,
      inputSchema: {
        type: "object",
        properties: {
          ciudad:    { type: "string", description: "El municipio." },
          provincia: { type: "string", description: "La provincia, escrita como en el listado." },
          sitio:     { type: "string", description: "La plaza o el punto exacto: «Plaza Mayor», «Puerta del Ayuntamiento»." },
          direccion: { type: "string", description: "La dirección postal, si se sabe." },
          hora:      { type: "string", description: "En formato 20:00. Si no la sabes, déjalo vacío antes que inventarla." },
        },
        required: ["ciudad", "provincia", "sitio"],
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      execute: conAnuncio("proponer_concentracion", async ({ ciudad, provincia, sitio, direccion, hora }) => {
        const donde = String(ciudad ?? "").trim();
        if (!donde) return { texto: "Necesito al menos el municipio.", vista: "" };

        const { lugares: ahora } = await datos();
        const ya = ahora.find((l) => sinAcentos(l.city) === sinAcentos(donde));
        if (ya) {
          await mostrarLugar(ya.id);
          return {
            texto:
              "En " + ya.city + " ya hay una convocada: " + sitioYDireccion(ya) +
              ", a las " + ya.event_time + " h. No hace falta proponerla otra vez.",
            vista: "he centrado el mapa en la que ya existe en " + ya.city + ".",
          };
        }

        await rellenarAlaVista("#form-lugar", [
          ["#l-city", donde],
          ["#l-province", String(provincia ?? "").trim()],
          ["#l-venue", String(sitio ?? "").trim()],
          ["#l-address", String(direccion ?? "").trim()],
          ["#l-time", String(hora ?? "").trim()],
        ]);

        return {
          texto:
            "He rellenado la propuesta de " + donde + ", sin enviarla. Dile que compruebe el " +
            "sitio y la hora y que pulse ella el botón: lo va a leer una persona antes de que " +
            "salga en el mapa. Los datos de contacto los escribe ella, no pasan por mí.",
          vista: "la propuesta está rellena pero NO enviada. El botón lo pulsa la persona.",
        };
      }),
    });
  }

  return lista;
}

/* ---------------------------------------------- el panel del escrito -------- */

/* Pinta el borrador en /propon con campos reales para los datos personales.
   Esos campos no se envían a ningún sitio, no se guardan y no vuelven al modelo:
   viven en el navegador de quien está delante y ahí se quedan. */
function pintarEscrito(escrito) {
  const form = $("#form-lugar");
  if (!form) return false;

  document.getElementById("escrito-agente")?.remove();

  const caja = document.createElement("section");
  caja.id = "escrito-agente";
  caja.className = "escrito";

  const titulo = document.createElement("h3");
  titulo.className = "escrito__titulo";
  titulo.textContent = "Tu escrito para la Delegación del Gobierno";

  const aviso = document.createElement("p");
  aviso.className = "escrito__aviso";
  aviso.textContent =
    "Rellena aquí tus datos: se quedan en este navegador. No se envían a ninguna parte, no " +
    "los guardamos y el asistente no los ve.";

  const campos = document.createElement("div");
  campos.className = "escrito__campos";
  const misDatos = [
    ["nombre", "Nombre y apellidos", "[TU NOMBRE Y APELLIDOS]", "name"],
    ["dni", "DNI", "[TU DNI]", "off"],
    ["tel", "Teléfono", "[TU TELÉFONO]", "tel"],
    ["dom", "Domicilio", "[TU DOMICILIO]", "street-address"],
  ];
  misDatos.forEach(([id, etiqueta, hueco, autocompletar]) => {
    const envoltorio = document.createElement("div");
    envoltorio.className = "campo";
    const lab = document.createElement("label");
    lab.setAttribute("for", "esc-" + id);
    lab.textContent = etiqueta;
    const inp = document.createElement("input");
    inp.id = "esc-" + id;
    inp.dataset.hueco = hueco;
    inp.autocomplete = autocompletar;
    inp.maxLength = 120;
    envoltorio.append(lab, inp);
    campos.append(envoltorio);
  });

  const cuerpo = document.createElement("pre");
  cuerpo.className = "escrito__cuerpo";
  cuerpo.textContent = escrito;

  const copiar = document.createElement("button");
  copiar.type = "button";
  copiar.className = "boton boton--brasa";
  copiar.textContent = "Copiar el escrito completo";

  const resultado = document.createElement("p");
  resultado.className = "estado";
  resultado.setAttribute("role", "status");
  resultado.setAttribute("aria-live", "polite");

  const componer = () => {
    let texto = escrito;
    misDatos.forEach(([id, , hueco]) => {
      const v = document.getElementById("esc-" + id)?.value.trim();
      if (v) texto = texto.split(hueco).join(v);
    });
    const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    return texto.split("[FECHA DE HOY]").join(hoy);
  };

  campos.addEventListener("input", () => { cuerpo.textContent = componer(); });

  copiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(componer());
      resultado.textContent = "Copiado. Pégalo en la sede electrónica o imprímelo para la ventanilla.";
      resultado.className = "estado estado--ok";
    } catch {
      resultado.textContent = "No he podido copiarlo. Selecciona el texto de arriba y cópialo a mano.";
      resultado.className = "estado estado--mal";
    }
  });

  caja.append(titulo, aviso, campos, cuerpo, copiar, resultado);
  form.parentElement?.insertBefore(caja, form);
  caja.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

/* ---------------------------------------------------------------- registro -- */

let control = null;

/* Poder apagarlo con un botón es lo que hace creíble todo lo demás. */
function apagarTodo() {
  try { control?.abort(); } catch { /* da igual: ya estaba */ }
  control = null;
  anunciar("Asistente desactivado. La web sigue funcionando igual.");
  setTimeout(() => { if (banda) banda.hidden = true; }, 4000);
}

async function arrancar() {
  try {
    const mc = document.modelContext;
    if (!mc || typeof mc.registerTool !== "function") return;   // el 99,99 % de las visitas

    // Freno de mano para depurar en el móvil sin volver a desplegar.
    if (new URLSearchParams(location.search).has("nowebmcp")) return;

    // Solo donde toca. Nunca en /admin: ahí hay una sesión abierta.
    const sitio = location.pathname;
    if (sitio.startsWith("/admin")) return;

    /* Se piden los datos aquí, en tiempo de idle y con la respuesta ya en caché
       porque app.js la pidió al cargar. Sirven para que las descripciones digan
       el estado real ("hay 6 concentraciones; siguen sin nada Álava, Albacete…")
       en vez de una frase genérica. */
    const estado = await datos().catch(() => ({ config: {}, lugares: [] }));

    control = new AbortController();

    for (const def of definiciones(estado)) {
      try {
        await mc.registerTool({ ...def, signal: control.signal });
      } catch { /* una herramienta mala no puede tumbar a las demás */ }
    }

    crearBanda();

    vigilarRellenoDelAgente(
      "#form-mensaje", "#btn-mensaje",
      "Esto lo ha escrito el asistente. Léelo antes de publicar: se verá en el muro con tu firma.",
      "Revísalo y publica tú",
    );
    vigilarRellenoDelAgente(
      "#form-lugar", "#btn-lugar",
      "Esto lo ha escrito el asistente. Compruébalo antes de enviarlo: lo va a revisar una persona a mano.",
      "Revísalo y envíalo tú",
    );

    /* Única excepción a la regla de no tocar el DOM fuera de execute(): si alguien
       ha llegado desde un enlace de provincia vacía, se le rellena la provincia.
       Es lo que ha pedido al pulsar el enlace, y va envuelto igual que el resto. */
    try {
      const pedida = new URLSearchParams(location.search).get("provincia");
      const campo = $("#l-province");
      if (pedida && campo && !campo.value) {
        campo.value = pedida;
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch { /* si falla, el campo se rellena a mano y ya está */ }
  } catch { /* WebMCP es un extra: nada de esto puede llegar al usuario */ }
}

/* Fuera del camino crítico: no compite con la carga de la página. */
if ("requestIdleCallback" in window) requestIdleCallback(() => arrancar(), { timeout: 3000 });
else setTimeout(() => arrancar(), 1200);
