/* Ceuta nos une — lógica de la portada.
   Todo el contenido de la gente se pinta con textContent / createElement:
   nunca con innerHTML, porque los mensajes del muro se publican sin revisión. */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const TESELAS = "/tiles/{z}/{x}/{y}.png";
const ATRIBUCION =
  '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/* El listado enseña las tarjetas de cinco en cinco: con 89 concentraciones,
   pintarlas todas hace una lista larguísima que en el móvil no se acaba nunca.
   Quien busca la suya tira del buscador o del filtro por provincia, no de
   bajar. Los puntos del mapa no se paginan: ahí salen todos siempre. */
const POR_PAGINA = 5;

const PROVINCIAS = [
  "A Coruña", "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz",
  "Baleares", "Barcelona", "Burgos", "Cáceres", "Cádiz", "Cantabria", "Castellón", "Ceuta",
  "Ciudad Real", "Córdoba", "Cuenca", "Girona", "Granada", "Guadalajara", "Guipúzcoa", "Huelva",
  "Huesca", "Jaén", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo", "Madrid", "Málaga",
  "Melilla", "Murcia", "Navarra", "Ourense", "Palencia", "Pontevedra", "Salamanca",
  "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo",
  "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza",
];

const estado = {
  config: {},
  lugares: [],
  provincia: "",
  busqueda: "",
  marcadores: new Map(),
  siguienteMensaje: null,
  cargandoMensajes: false,
  fotoElegida: null,
  turnoFoto: 0,
  visibles: POR_PAGINA,
};

let mapa = null;
let capaMarcadores = null;
let minimapa = null;
let pinPropuesta = null;

/* ------------------------------------------------------------------ util -- */

async function pedir(url, opciones = {}) {
  let res;
  try {
    res = await fetch(url, { credentials: "same-origin", ...opciones });
  } catch {
    // Fallo de red: el navegador da un mensaje en inglés ("Load failed",
    // "Failed to fetch") que no le dice nada a nadie.
    throw new Error("No se ha podido conectar. Comprueba la cobertura y vuelve a intentarlo.");
  }
  let datos = {};
  try {
    datos = await res.json();
  } catch {
    datos = { ok: false, error: "No hemos podido completar la operación. Inténtalo dentro de un momento." };
  }
  if (!res.ok || datos.ok === false) {
    throw new Error(datos.error || "No hemos podido completar la operación. Inténtalo dentro de un momento.");
  }
  return datos;
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined && texto !== null) el.textContent = String(texto);
  return el;
}

function mostrarEstado(nodo, texto, tipo) {
  nodo.textContent = texto;
  nodo.className = "estado" + (tipo ? " estado--" + tipo : "");
}

function fechaLegible(iso) {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* Los "me gusta" que ha dado quien está delante. El servidor los cuenta por
   huella, pero no hay sesión que preguntar, así que el navegador recuerda cuáles
   son suyos para pintarlos al volver. Si el almacenamiento falla (ventana
   privada, ajustes del navegador), se sigue sin memoria y ya está. */
const MIS_ME_GUSTA = "cnu:megusta";

function misMeGusta() {
  try {
    return new Set(JSON.parse(localStorage.getItem(MIS_ME_GUSTA) || "[]"));
  } catch {
    return new Set();
  }
}

function guardarMeGusta(conjunto) {
  try {
    localStorage.setItem(MIS_ME_GUSTA, JSON.stringify([...conjunto]));
  } catch { /* sin memoria, pero el me gusta ya ha contado en el servidor */ }
}

function sinAcentos(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/* ---------------------------------------------------------------- config -- */

async function cargarConfig() {
  try {
    estado.config = await pedir("/api/config");
  } catch {
    estado.config = {};
  }
  const c = estado.config;

  $$("[data-config]").forEach((el) => {
    const valor = c[el.dataset.config];
    if (valor) el.textContent = valor;
  });

  // Solo en la portada: las demás páginas traen su propio título
  if (c.site_title && document.querySelector(".portada")) {
    document.title = c.site_title + " · " + (c.event_label || "");
  }

  // Solo se ofrece un correo si de verdad hay uno configurado: un enlace a una
  // dirección que no existe es peor que no ofrecer ninguna.
  const antes = $("#antes-contacto");
  if (c.contact_email && antes) antes.href = "mailto:" + c.contact_email;

  const contacto = $("#pie-contacto");
  if (c.contact_email && contacto) {
    contacto.append(document.createTextNode(", o escríbenos a "));
    const enlace = crear("a", null, c.contact_email);
    enlace.href = "mailto:" + c.contact_email;
    contacto.append(enlace);
  }

  if (c.event_date) {
    const campoFecha = $("#l-date");
    if (campoFecha) {
      campoFecha.value = c.event_date;
      campoFecha.min = new Date().toISOString().slice(0, 10);
    }
    arrancarCuentaAtras(c.event_date);
  }

  // Solo se cierra si el servidor lo dice expresamente: si la configuración no
  // llegó (un corte de red), se deja abierto y ya validará el servidor.
  if (c.places_open === false) cerrarFormulario("#form-lugar", "Las propuestas de lugares están cerradas.");
  if (c.messages_open === false) cerrarFormulario("#form-mensaje", "El muro está cerrado por ahora.");

  // Con la fila cero en marcha, el muro deja de recoger mensajes y la cuenta
  // atrás deja de contar: las dos cosas se sustituyen por la puerta de entrada.
  if (c.fila_cero) abrirLaPuerta();

  if (c.turnstile_site_key) cargarTurnstile(c.turnstile_site_key);
}

/**
 * La puerta a la fila cero.
 *
 * Cuando el directo arranca hay dos trozos de la portada que dejan de tener
 * sentido a la vez: la cuenta atrás, que ya no cuenta nada, y el formulario del
 * muro, porque a esa hora se manda desde el directo -que es donde están el
 * Turnstile de entrada y la moderación de fotos-. Los dos se sustituyen por lo
 * mismo, así que el bloque se fabrica una vez y se usa en los dos sitios.
 */
function puertaFilaCero(titular, texto, conPase) {
  const caja = crear("div", "filacero");
  caja.appendChild(crear("p", "filacero__eco", titular));
  caja.appendChild(crear("p", "filacero__texto", texto));

  /* El pase, pintado aquí mismo y no en un iframe. Un iframe traería otro
     documento entero, con su CSS y su JS, y abriría un segundo sondeo a la
     misma API: más espera al arrancar y los datos aislados de esta página.
     Pintándolo aquí, el contador de gente que ya viene en la respuesta se
     puede enseñar sin pedir nada más. El widget de /embed se queda para quien
     lo incruste desde fuera, que es lo suyo. */
  if (conPase) {
    const pase = crear("div", "filacero__pase");
    const gente = crear("p", "filacero__gente", "");
    caja.appendChild(pase);
    caja.appendChild(gente);
    seguirLaFilaCero(pase, gente);
  }
  const boton = crear("a", "boton boton--brasa filacero__boton", "Entrar en la fila cero");
  boton.href = "/directo";
  caja.appendChild(boton);
  return caja;
}

/**
 * Sigue la fila cero desde la portada: pinta las fotos que van llegando y dice
 * cuánta gente hay dentro.
 *
 * Sondea más despacio que el propio directo (allí la pantalla es el acto; aquí
 * es un aperitivo) y no toca nada más de la página.
 */
function seguirLaFilaCero(caja, gente) {
  const puestas = new Map();
  let orden = [];
  let i = 0;
  let esperaMs = 10000;

  const pintar = (tarjetas) => {
    tarjetas.forEach((t) => {
      if (!t.media || puestas.has(t.media)) return;
      const img = new Image();
      img.src = t.media;
      img.alt = "";
      img.loading = "lazy";
      caja.appendChild(img);
      puestas.set(t.media, img);
      orden.push(img);
    });
    caja.classList.toggle("filacero__pase--vacio", orden.length === 0);
  };

  const pasar = () => {
    if (!orden.length) return;
    orden.forEach((img, n) => img.classList.toggle("visible", n === i));
    i = (i + 1) % orden.length;
  };

  const sondear = async () => {
    try {
      const d = await pedir("/api/directo");
      const n = d.ahora || 0;
      gente.textContent = n
        ? "Ahora mismo " + (n === 1 ? "hay 1 persona" : "hay " + n.toLocaleString("es-ES") + " personas") + " dentro"
        : "";
      pintar((d.tarjetas || []).slice(0, 24));
      if (d.sondeo) esperaMs = Math.max(8000, d.sondeo * 2000);
    } catch {
      // Un fallo suelto no rompe la portada: se reintenta a la siguiente vuelta.
    }
    setTimeout(sondear, esperaMs);
  };

  sondear();
  setInterval(pasar, 5000);
}

function abrirLaPuerta() {
  /* La franja de arriba del todo. Nace con `hidden` en el HTML y se enciende
     aquí, no al revés: si se pintara siempre y se ocultara con JS, quien
     entrase con la red lenta vería un instante un directo que no existe. */
  const aviso = $("#aviso-directo");
  if (aviso) aviso.hidden = false;

  const form = $("#form-mensaje");
  if (form) {
    form.replaceWith(puertaFilaCero(
      "La fila cero ya está abierta",
      "Esta noche los mensajes se mandan desde ahí, para que salgan en la pantalla.",
    ));
  }

  /* El bloque de la fecha entero, no solo la cuenta atrás: anunciar el día y
     la hora de algo que ya está empezando no dice nada, y deja al lector con
     dos mensajes que se contradicen. La cuenta atrás se va dentro, y su
     intervalo se para solo al quedarse el bloque fuera de la página. */
  const fecha = document.querySelector(".fecha");
  if (fecha) {
    const puerta = puertaFilaCero(
      "Concentración virtual",
      "Si hoy no puedes ir a una plaza, la fila cero también es estar.",
      true,
    );
    puerta.classList.add("filacero--portada");
    fecha.replaceWith(puerta);
  }
}

function cerrarFormulario(selector, motivo) {
  const form = $(selector);
  if (!form) return;
  form.querySelectorAll("input, textarea, button").forEach((el) => (el.disabled = true));
  const aviso = crear("p", "aviso", motivo);
  form.prepend(aviso);
}

/* Turnstile solo se carga si hay clave configurada en el servidor. */
function cargarTurnstile(siteKey) {
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
  ["#turnstile-lugar", "#turnstile-mensaje"].forEach((sel) => {
    const caja = $(sel);
    if (caja) {
      caja.className = "cf-turnstile turnstile";
      caja.dataset.sitekey = siteKey;
      caja.dataset.theme = "dark";
    }
  });
}

function tokenTurnstile(contenedorSel) {
  const campo = $(contenedorSel + ' [name="cf-turnstile-response"]');
  return campo ? campo.value : "";
}

/* ---------------------------------------------------------- cuenta atrás -- */

function arrancarCuentaAtras(fechaISO) {
  // La convocatoria es a las 20:00 hora peninsular (UTC+2 a principios de septiembre).
  const objetivo = new Date(fechaISO + "T20:00:00+02:00");
  if (Number.isNaN(objetivo.getTime())) return;

  const bloque = $("#cuenta");
  if (!bloque) return;
  const pintar = () => {
    /* Si el bloque ya no está en la página, se para. Pasa cuando arranca la
       fila cero y la puerta ocupa su hueco: sin esto el intervalo seguía
       escribiendo en nodos que ya no existen, un error por segundo y para
       siempre en la consola de cualquiera con la web abierta. */
    if (!bloque.isConnected) return true;

    let resto = objetivo.getTime() - Date.now();
    if (resto <= 0) {
      bloque.classList.add("cuenta--pasado");
      bloque.replaceChildren();
      const texto = crear("div", "cuenta__bloque");
      texto.append(crear("b", null, "Es hoy"), crear("span", null, "nos vemos en la plaza"));
      bloque.append(texto);
      return true;
    }
    const seg = Math.floor(resto / 1000);
    const dias  = Math.floor(seg / 86400);
    const horas = Math.floor((seg % 86400) / 3600);
    const min   = Math.floor((seg % 3600) / 60);
    $("#c-dias").textContent = String(dias);
    $("#c-horas").textContent = String(horas).padStart(2, "0");
    $("#c-min").textContent = String(min).padStart(2, "0");
    $("#c-seg").textContent = String(seg % 60).padStart(2, "0");

    /* Lo que oye quien usa un lector de pantalla. Se reescribe solo al cambiar
       el minuto, no cada segundo: el bloque de números está en aria-hidden y
       este párrafo no es una región viva, así que no interrumpe nada; se lee
       cuando la persona llega hasta aquí, y entonces está al día. */
    const hablada = $("#cuenta-hablada");
    if (hablada) {
      const frase = "Faltan " + dias + (dias === 1 ? " día, " : " días, ") +
                    horas + (horas === 1 ? " hora y " : " horas y ") +
                    min + (min === 1 ? " minuto." : " minutos.");
      if (hablada.textContent !== frase) hablada.textContent = frase;
    }
    return false;
  };

  if (pintar()) return;
  const id = setInterval(() => {
    if (pintar()) clearInterval(id);
  }, 1000);
}

/* ---------------------------------------------------------------- lugares -- */

function iniciarMapa() {
  if (!$("#mapa") || typeof L === "undefined") return;
  mapa = L.map("mapa", { scrollWheelZoom: false, zoomControl: true }).setView([39.5, -3.5], 5);
  L.tileLayer(TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa);
  capaMarcadores = (typeof L.markerClusterGroup === "function")
    ? L.markerClusterGroup({
        /* 70 y no 45: con 172 puntos, los grupos pequeños se solapaban entre
           sí y dejaban zonas de 22 px imposibles de pulsar con el dedo. */
        maxClusterRadius: 70,
        showCoverageOnHover: false,   // el polígono azul de serie no pega con el cartel
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
        iconCreateFunction: (grupo) => {
          const n = grupo.getChildCount();
          const talla = n < 10 ? "grupo--peq" : n < 40 ? "grupo--med" : "grupo--gra";
          const caja = document.createElement("div");
          caja.className = "grupo " + talla;
          caja.textContent = String(n);
          /* Un lector de pantalla leía «7», «69», «323» y ya está: un número
             suelto en mitad de un mapa no dice nada. Ahora dice qué son. */
          caja.setAttribute("aria-label", n + (n === 1 ? " concentración" : " concentraciones") + " en esta zona");
          caja.setAttribute("role", "img");
          return L.divIcon({ html: caja.outerHTML, className: "", iconSize: [40, 40] });
        },
      }).addTo(mapa)
    : L.layerGroup().addTo(mapa);   // si el agrupador no cargara, puntos sueltos
  // Con la rueda solo se hace zoom tras pulsar el mapa: así no secuestra el scroll.
  mapa.on("click", () => mapa.scrollWheelZoom.enable());
  mapa.on("mouseout", () => mapa.scrollWheelZoom.disable());
}

async function cargarLugares() {
  if (!$("#lista-lugares")) return;
  const datos = await pedir("/api/places");
  /* Orden alfabético de verdad: la base de datos ordena con COLLATE NOCASE, que
     en español manda los acentos al final, así que Écija salía después de Utrera. */
  estado.lugares = (datos.places || []).sort(
    (a, b) => a.city.localeCompare(b.city, "es") || a.venue.localeCompare(b.venue, "es"),
  );
  pintarChips();
  pintarLugares();
  actualizarCifras();
}

function lugaresFiltrados() {
  const q = sinAcentos(estado.busqueda.trim());
  return estado.lugares.filter((l) => {
    if (estado.provincia && l.province !== estado.provincia) return false;
    if (!q) return true;
    return sinAcentos([l.city, l.province, l.venue, l.address].join(" ")).includes(q);
  });
}

function pintarChips() {
  const contenedor = $("#chips-provincia");
  const provincias = [...new Set(estado.lugares.map((l) => l.province))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  contenedor.replaceChildren();

  const hacerChip = (texto, valor) => {
    const b = crear("button", "chip", texto);
    b.type = "button";
    b.setAttribute("aria-pressed", String(estado.provincia === valor));
    b.addEventListener("click", () => {
      estado.provincia = estado.provincia === valor ? "" : valor;
      estado.visibles = POR_PAGINA;
      pintarChips();
      pintarLugares();
    });
    return b;
  };

  contenedor.append(hacerChip("Todas", ""));
  provincias.forEach((p) => contenedor.append(hacerChip(p, p)));
}

function pintarLugares(ajustarMapa = true) {
  const lista = $("#lista-lugares");
  const lugares = lugaresFiltrados();
  lista.replaceChildren();
  capaMarcadores?.clearLayers();
  estado.marcadores.clear();

  const aPintar = lugares.slice(0, estado.visibles);

  $("#lugares-contador").textContent =
    lugares.length === 0
      ? "Ningún lugar coincide con la búsqueda"
      : aPintar.length < lugares.length
        ? aPintar.length + " de " + lugares.length + " lugares"
        : lugares.length + (lugares.length === 1 ? " lugar" : " lugares");

  if (!lugares.length) {
    const vacio = crear("li", "vacio");
    vacio.append(
      crear("p", null, estado.lugares.length
        ? "Ningún lugar coincide con esa búsqueda."
        : "Todavía no hay lugares publicados."),
    );
    const enlace = crear("a", "boton boton--brasa", "Propón tu plaza");
    enlace.href = "/propon";
    vacio.append(enlace);
    lista.append(vacio);
    actualizarBotonMas(0, 0);
    return;
  }

  const limites = [];

  aPintar.forEach((lugar) => lista.append(tarjetaLugar(lugar)));
  actualizarBotonMas(aPintar.length, lugares.length);

  lugares.forEach((lugar) => {
    if (lugar.lat != null && lugar.lon != null) {
      const marcador = L.marker([lugar.lat, lugar.lon], {
        icon: L.divIcon({ className: "", html: '<div class="pin"></div>', iconSize: [24, 24] }),
        title: lugar.city + " · " + lugar.event_time,
      });
      marcador.bindPopup(popupLugar(lugar));
      marcador.addTo(capaMarcadores);
      estado.marcadores.set(lugar.id, marcador);
      limites.push([lugar.lat, lugar.lon]);
    }
  });

  if (limites.length && ajustarMapa) {
    mapa.fitBounds(limites, { padding: [40, 40], maxZoom: limites.length === 1 ? 13 : 9 });
  }
}

/* El botón dice cuántos lugares quedan por ver, no un "ver más" a secas: con 89
   concentraciones conviene saber si queda uno o cincuenta. */
function actualizarBotonMas(pintados, total) {
  const boton = $("#btn-mas-lugares");
  if (!boton) return;
  const quedan = total - pintados;
  boton.hidden = quedan <= 0;
  if (quedan > 0) {
    boton.textContent = quedan === 1
      ? "Ver el lugar que queda"
      : "Ver " + Math.min(quedan, POR_PAGINA) + " más de los " + quedan + " que quedan";
  }
}

function popupLugar(lugar) {
  const caja = crear("div");
  caja.append(crear("b", null, lugar.city));
  caja.append(crear("div", "hora", lugar.event_time + " h · " + lugar.venue));
  caja.append(crear("div", null, lugar.address));
  return caja;
}

function tarjetaLugar(lugar) {
  const li = crear("li", "tarjeta");
  li.dataset.id = String(lugar.id);

  li.append(crear("div", "tarjeta__hora", lugar.event_time));

  const cabecera = crear("div");
  cabecera.append(crear("div", "tarjeta__ciudad", lugar.city));
  cabecera.append(crear("div", "tarjeta__provincia", lugar.province));
  li.append(cabecera);

  const cuerpo = crear("div", "tarjeta__cuerpo");
  cuerpo.append(crear("p", "tarjeta__lugar", lugar.venue));
  cuerpo.append(crear("p", "tarjeta__dir", lugar.address));

  /* Quién convoca. El formulario lo pedía y la base lo guardaba, pero la tarjeta
     nunca lo enseñaba: el dato se perdía. Importa cuando hay dos concentraciones
     en la misma ciudad y hay que saber cuál es cuál. */
  if (lugar.organizer) cuerpo.append(crear("p", "tarjeta__convoca", "Convoca: " + lugar.organizer));

  if (lugar.notes) cuerpo.append(crear("p", "tarjeta__notas", lugar.notes));

  const acciones = crear("div", "tarjeta__acciones");

  const comoLlegar = crear("a", "tarjeta__enlace", "Cómo llegar");
  comoLlegar.href =
    lugar.lat != null && lugar.lon != null
      ? "https://www.google.com/maps/dir/?api=1&destination=" + lugar.lat + "," + lugar.lon
      : "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(lugar.venue + ", " + lugar.address);
  comoLlegar.target = "_blank";
  comoLlegar.rel = "noopener noreferrer";
  acciones.append(comoLlegar);

  const compartir = crear("button", "tarjeta__enlace", "Compartir");
  compartir.type = "button";
  compartir.addEventListener("click", (ev) => {
    ev.stopPropagation();
    compartirLugar(lugar, compartir);
  });
  acciones.append(compartir);

  if (lugar.source_url) {
    const fuente = crear("a", "tarjeta__enlace", "Convocatoria");
    fuente.href = lugar.source_url;
    fuente.target = "_blank";
    fuente.rel = "noopener noreferrer nofollow";
    acciones.append(fuente);
  }

  cuerpo.append(acciones);
  li.append(cuerpo);

  li.addEventListener("click", () => centrarEn(lugar, li));
  return li;
}

async function compartirLugar(lugar, boton) {
  /* El enlace lleva la ciudad, así que quien lo reciba abre la web directamente en
     esa tarjeta en vez de tener que buscarla entre 172. */
  const enlace = location.origin + "/?q=" + encodeURIComponent(lugar.city) + "#lugares";
  const texto =
    lugar.city + " · " + lugar.venue + " · " + lugar.event_time + " h — " + enlace;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Ceuta nos une · " + lugar.city, text: texto });
      return;
    }
    await navigator.clipboard.writeText(texto);
    const antes = boton.textContent;
    boton.textContent = "Copiado";
    setTimeout(() => (boton.textContent = antes), 1800);
  } catch {
    /* el usuario ha cancelado: no hay nada que hacer */
  }
}

function centrarEn(lugar, elemento) {
  /* Al elegir una tarjeta se filtra también por su provincia: el mapa y el
     listado pasan a hablar de lo mismo, y el chip encendido deja a la vista que
     hay un filtro puesto y que para volver a verlo todo hay que pulsar "Todas". */
  if (estado.provincia !== lugar.province) {
    estado.provincia = lugar.province;
    pintarChips();

    /* El listado va por tandas, así que hay que asegurarse de que la que se
       acaba de pulsar entra en las que se pintan: si no, desaparecería. */
    const posicion = lugaresFiltrados().findIndex((l) => l.id === lugar.id);
    estado.visibles = Math.max(POR_PAGINA, (Math.floor(posicion / POR_PAGINA) + 1) * POR_PAGINA);

    // Sin recolocar el mapa: se centra abajo en el lugar concreto, no en la provincia.
    pintarLugares(false);

    // Repintar rehace las tarjetas, así que la que llegó por parámetro ya no existe.
    elemento = $('.tarjeta[data-id="' + lugar.id + '"]') || elemento;
  }

  $$(".tarjeta--activa").forEach((el) => el.classList.remove("tarjeta--activa"));
  elemento?.classList.add("tarjeta--activa");

  const marcador = estado.marcadores.get(lugar.id);
  if (!marcador) return;

  const mostrar = () => {
    mapa.setView(marcador.getLatLng(), Math.max(mapa.getZoom(), 12), { animate: true });
    marcador.openPopup();
  };

  /* Si los puntos están agrupados, este puede estar escondido dentro de un grupo:
     hay que abrirlo antes, o el globo no aparece por ningún lado. */
  if (typeof capaMarcadores?.zoomToShowLayer === "function") {
    capaMarcadores.zoomToShowLayer(marcador, mostrar);
  } else {
    mostrar();
  }

  if (window.innerWidth < 900) $("#mapa").scrollIntoView({ behavior: "smooth", block: "center" });
}

function actualizarCifras() {
  const provincias = new Set(estado.lugares.map((l) => l.province));
  const lugares = $("#cifra-lugares");
  const prov = $("#cifra-provincias");
  if (lugares) lugares.textContent = String(estado.lugares.length);
  if (prov) prov.textContent = String(provincias.size);
}

/* --------------------------------------------------- formulario de lugar -- */

function rellenarProvincias() {
  const lista = $("#provincias");
  if (!lista) return;
  PROVINCIAS.forEach((p) => {
    const opcion = document.createElement("option");
    opcion.value = p;
    lista.append(opcion);
  });
}

async function buscarDireccion() {
  const consulta = [$("#l-address").value, $("#l-city").value, $("#l-province").value]
    .filter(Boolean)
    .join(", ");
  const caja = $("#sugerencias");
  const ayuda = $("#ayuda-coords");

  if (consulta.trim().length < 4) {
    ayuda.textContent = "Escribe primero la dirección y la localidad.";
    return;
  }

  ayuda.textContent = "Buscando…";
  try {
    const datos = await pedir("/api/geocode?q=" + encodeURIComponent(consulta));
    caja.replaceChildren();

    if (!datos.results.length) {
      ayuda.textContent = "No hemos encontrado esa dirección. Puedes enviarla igualmente.";
      caja.hidden = true;
      return;
    }

    datos.results.forEach((r) => {
      const li = crear("li", null, r.label);
      li.tabIndex = 0;
      li.setAttribute("role", "option");
      const elegir = () => {
        fijarCoordenadas(r.lat, r.lon);
        if (r.city && !$("#l-city").value) $("#l-city").value = r.city;
        if (r.province && !$("#l-province").value) $("#l-province").value = r.province;
        caja.hidden = true;
      };
      li.addEventListener("click", elegir);
      li.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          elegir();
        }
      });
      caja.append(li);
    });
    caja.hidden = false;
    ayuda.textContent = "Elige la dirección correcta de la lista.";
  } catch (err) {
    ayuda.textContent = err.message;
  }
}

function fijarCoordenadas(lat, lon) {
  const contenedor = $("#minimapa");
  contenedor.hidden = false;

  if (!minimapa) {
    minimapa = L.map("minimapa", { scrollWheelZoom: false, attributionControl: false })
      .setView([lat, lon], 16);
    L.tileLayer(TESELAS, { maxZoom: 19 }).addTo(minimapa);
    pinPropuesta = L.marker([lat, lon], {
      draggable: true,
      icon: L.divIcon({ className: "", html: '<div class="pin"></div>', iconSize: [24, 24] }),
    }).addTo(minimapa);
    pinPropuesta.on("dragend", () => {
      const p = pinPropuesta.getLatLng();
      $("#ayuda-coords").textContent =
        "Punto ajustado: " + p.lat.toFixed(5) + ", " + p.lng.toFixed(5);
    });
  } else {
    minimapa.setView([lat, lon], 16);
    pinPropuesta.setLatLng([lat, lon]);
  }

  setTimeout(() => minimapa.invalidateSize(), 60);
  $("#ayuda-coords").textContent =
    "Punto fijado. Arrastra el marcador si quieres afinarlo: " + lat.toFixed(5) + ", " + lon.toFixed(5);
}

async function enviarLugar(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const boton = $("#btn-lugar");
  const salida = $("#estado-lugar");

  if (!form.reportValidity()) return;

  const datos = Object.fromEntries(new FormData(form).entries());
  if (pinPropuesta) {
    const p = pinPropuesta.getLatLng();
    datos.lat = p.lat;
    datos.lon = p.lng;
  }
  datos.turnstile_token = tokenTurnstile("#turnstile-lugar");

  boton.disabled = true;
  mostrarEstado(salida, "Enviando…");

  try {
    const res = await pedir("/api/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(datos),
    });
    mostrarEstado(salida, res.message, "ok");
    form.reset();
    $("#l-date").value = estado.config.event_date || "";
    $("#minimapa").hidden = true;
    $("#sugerencias").hidden = true;
    if (pinPropuesta) {
      minimapa.removeLayer(pinPropuesta);
      pinPropuesta = null;
    }
    window.turnstile?.reset();
  } catch (err) {
    mostrarEstado(salida, err.message, "mal");
  } finally {
    boton.disabled = false;
  }
}

/* -------------------------------------------------------------------- muro -- */

async function cargarMensajes(masAntiguos = false) {
  if (!$("#mensajes") || estado.cargandoMensajes) return;
  estado.cargandoMensajes = true;

  const boton = $("#btn-mas");
  if (masAntiguos && boton) { boton.disabled = true; boton.textContent = "Cargando…"; }

  const url = masAntiguos && estado.siguienteMensaje
    ? "/api/messages?before=" + estado.siguienteMensaje
    : "/api/messages";

  try {
    const datos = await pedir(url);
    const contenedor = $("#mensajes");
    if (!masAntiguos) contenedor.replaceChildren();

    datos.messages.forEach((m) => contenedor.append(postal(m)));
    estado.siguienteMensaje = datos.next;
    if (boton) { boton.hidden = !datos.next; boton.textContent = "Ver más mensajes"; }
    const cifra = $("#cifra-mensajes");
    if (cifra) cifra.textContent = String(datos.total ?? datos.messages.length);

    if (!datos.messages.length && !masAntiguos) {
      contenedor.append(crear("p", "vacio", "Todavía no hay mensajes. Sé la primera persona en dejar uno."));
    }
  } catch (err) {
    const contenedor = $("#mensajes");
    if (!masAntiguos && contenedor) {
      contenedor.replaceChildren(crear("p", "vacio", "No hemos podido cargar los mensajes. " + err.message));
    } else if (masAntiguos) {
      // Antes no pasaba nada al fallar: la gente pulsaba y pulsaba sin respuesta
      const boton = $("#btn-mas");
      if (boton) { boton.textContent = "No se ha podido cargar. Toca para reintentar"; boton.hidden = false; }
    }
  } finally {
    estado.cargandoMensajes = false;
    const boton = $("#btn-mas");
    if (boton) boton.disabled = false;
  }
}

function postal(mensaje) {
  const art = crear("article", "postal");

  if (mensaje.photo_url) {
    const img = document.createElement("img");
    img.className = "postal__foto";
    img.src = mensaje.photo_url;
    img.alt = "Foto enviada por " + mensaje.author;
    img.loading = "lazy";
    img.decoding = "async";
    art.append(img);
  }

  art.append(crear("p", "postal__texto", mensaje.body));

  const pie = crear("div", "postal__pie");
  const firma = crear("div");
  firma.append(crear("div", "postal__firma", mensaje.author));
  if (mensaje.origin) firma.append(crear("div", "postal__origen", mensaje.origin));
  pie.append(firma);

  const derecha = crear("div");
  derecha.append(crear("div", "postal__fecha", fechaLegible(mensaje.created_at)));

  /* El me gusta. Va antes que denunciar y con más presencia: en un muro de apoyo
     lo normal es querer sumarse a un mensaje, no señalarlo. */
  const mios = misMeGusta();
  const meGusta = crear("button", "postal__megusta");
  meGusta.type = "button";
  const pintarMeGusta = (n, mio) => {
    meGusta.classList.toggle("postal__megusta--mio", mio);
    meGusta.setAttribute("aria-pressed", String(mio));
    meGusta.title = mio ? "Quitar mi me gusta" : "Me gusta este mensaje";
    meGusta.replaceChildren();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 20.7 4.1 13a4.6 4.6 0 0 1 6.5-6.5l1.4 1.4 1.4-1.4A4.6 4.6 0 1 1 19.9 13z");
    svg.append(path);
    meGusta.append(svg);
    const cuenta = crear("span", "postal__megusta-n", n > 0 ? String(n) : "");
    meGusta.append(cuenta);
    const oculto = crear("span", "visualmente-oculto",
      n === 1 ? "1 me gusta" : n + " me gusta");
    meGusta.append(oculto);
  };
  pintarMeGusta(mensaje.likes || 0, mios.has(mensaje.id));

  meGusta.addEventListener("click", async () => {
    meGusta.disabled = true;
    try {
      const res = await pedir("/api/messages/" + mensaje.id + "/like", { method: "POST" });
      const guardados = misMeGusta();
      if (res.mio) guardados.add(mensaje.id); else guardados.delete(mensaje.id);
      guardarMeGusta(guardados);
      pintarMeGusta(res.likes, res.mio);
    } catch { /* si falla, se queda como estaba */ }
    meGusta.disabled = false;
  });
  derecha.append(meGusta);

  const reportar = crear("button", "postal__reportar", "Denunciar");
  reportar.type = "button";
  reportar.title = "Denunciar un contenido inadecuado";
  reportar.addEventListener("click", async () => {
    reportar.disabled = true;
    try {
      const res = await pedir("/api/messages/" + mensaje.id + "/report", { method: "POST" });
      if (res.hidden) {
        /* Ha llegado al número de denuncias y se ha ocultado: quitarlo de la
           vista al momento, o quien acaba de denunciarlo seguiría leyéndolo. */
        art.classList.add("postal--retirada");
        art.replaceChildren(
          crear("p", "postal__retirada",
                "Mensaje oculto por las denuncias recibidas. Lo revisaremos."),
        );
        const cifra = $("#cifra-mensajes");
        if (cifra) cifra.textContent = String(Math.max(0, (Number(cifra.textContent) || 1) - 1));
      } else {
        reportar.textContent = "Denunciado";
      }
    } catch {
      reportar.textContent = "No se pudo";
    }
  });
  derecha.append(reportar);
  pie.append(derecha);

  art.append(pie);
  return art;
}

/**
 * Reduce la foto en el propio navegador antes de subirla: ahorra datos móviles
 * a quien publica y evita rechazos por tamaño. Los GIF se dejan intactos para
 * no perder la animación.
 */
async function prepararFoto(archivo) {
  if (!archivo || archivo.type === "image/gif") return archivo;

  const LADO_MAX = 1600;
  try {
    // Sin esto, las fotos hechas en vertical salen giradas 90°: el canvas no
    // aplica la orientación EXIF por sí solo en todos los navegadores.
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    // Se recodifica siempre, aunque la foto sea pequeña: al pasar por el canvas
    // se pierden los metadatos EXIF, que suelen incluir las coordenadas GPS de
    // donde se hizo. Publicarlas sin avisar sería un problema serio.
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#FDF1E6";                 // sin esto, un PNG transparente sale con fondo negro
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();

    const blob = await new Promise((resolve) => lienzo.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return archivo;
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}

function prepararPrevia() {
  const entrada = $("#m-photo");
  const previa = $("#previa");
  const img = $("#previa-img");
  if (!entrada || !previa || !img) return;

  const limpiar = () => {
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);  // si no, cada foto queda retenida en memoria
    estado.fotoElegida = null;
    previa.hidden = true;
    entrada.value = "";
  };

  entrada.addEventListener("change", async () => {
    const archivo = entrada.files?.[0];
    const salida = $("#estado-mensaje");
    const boton = $("#btn-mensaje");
    if (!archivo) { limpiar(); return; }

    if (archivo.size > 12 * 1024 * 1024) {
      limpiar();
      mostrarEstado(salida, "Esa foto pesa más de 12 MB. Elige otra.", "mal");
      return;
    }

    // Preparar la foto tarda segundos en un móvil normal. Sin avisar, la gente
    // pulsaba Publicar antes de tiempo y el mensaje salía sin foto.
    const turno = ++estado.turnoFoto;
    if (boton) boton.disabled = true;
    mostrarEstado(salida, "Preparando la foto…");

    const preparada = await prepararFoto(archivo);
    if (turno !== estado.turnoFoto) return;   // se eligió otra foto mientras tanto

    if (boton) boton.disabled = false;

    // El servidor rechaza a partir de 5 MB: mejor avisar ahora que después de
    // subirla entera con mala cobertura.
    if (preparada.size > 3.5 * 1024 * 1024) {
      limpiar();
      mostrarEstado(salida, "Esa foto sigue pesando demasiado después de reducirla. Prueba con otra, o envía el mensaje sin foto.", "mal");
      return;
    }

    mostrarEstado(salida, "");
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    estado.fotoElegida = preparada;
    img.src = URL.createObjectURL(preparada);
    previa.hidden = false;
    const etiqueta = $("#etiqueta-foto");
    if (etiqueta) etiqueta.lastChild.textContent = " Cambiar la foto";
  });

  $("#previa-quitar")?.addEventListener("click", () => {
    limpiar();
    const etiqueta = $("#etiqueta-foto");
    if (etiqueta) etiqueta.lastChild.textContent = " Elegir una foto del móvil";
  });
}

async function enviarMensaje(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const boton = $("#btn-mensaje");
  const salida = $("#estado-mensaje");

  if (!form.reportValidity()) return;

  const datos = new FormData();
  datos.append("author", $("#m-author").value);
  datos.append("origin", $("#m-origin").value);
  datos.append("body", $("#m-body").value);
  datos.append("website", $("#website").value);
  datos.append("turnstile_token", tokenTurnstile("#turnstile-mensaje"));
  if (estado.fotoElegida) datos.append("photo", estado.fotoElegida);

  boton.disabled = true;
  boton.setAttribute("aria-busy", "true");
  const textoBoton = boton.textContent;
  boton.textContent = "Publicando…";
  mostrarEstado(salida, "Publicando…");

  try {
    const res = await pedir("/api/messages", {
      method: "POST",
      body: datos,
      signal: AbortSignal.timeout(90000),   // en redes saturadas la petición se queda colgada
    });
    mostrarEstado(salida, "¡Gracias! Tu mensaje ya está en el muro.", "ok");

    const nueva = postal(res.message);
    nueva.classList.add("postal--nueva");
    $("#mensajes").prepend(nueva);

    const cifra = $("#cifra-mensajes");
    if (cifra) cifra.textContent = String((Number(cifra.textContent) || 0) + 1);

    form.reset();
    estado.fotoElegida = null;
    $("#previa").hidden = true;
    const restantes = $("#m-restantes");
    if (restantes) {
      restantes.textContent = "800";
      restantes.parentElement?.classList.remove("contador--limite");
    }
    window.turnstile?.reset();
    nueva.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    mostrarEstado(salida, err.name === "TimeoutError"
      ? "Está tardando demasiado. Mira si tu mensaje aparece aquí abajo; si no está, vuelve a pulsar Publicar."
      : err.message, "mal");
    // El token de Turnstile caduca a los 5 minutos y no se puede reutilizar:
    // sin reiniciarlo, el segundo intento fallaría siempre.
    window.turnstile?.reset();
  } finally {
    boton.disabled = false;
    boton.removeAttribute("aria-busy");
    boton.textContent = textoBoton;
  }
}


/* ------------------------------------------------------------- difundir -- */

/* Carga automática al llegar al final del muro. Con miles de mensajes, pulsar
   "ver más" veinte veces no es forma de leer nada.
   Se para a las CARGAS_AUTOMATICAS tandas y pide un clic: un scroll infinito sin
   freno impide llegar al pie de la página, y ahí está el contacto y el aviso
   legal. El botón se queda siempre, que es lo que funciona con teclado. */
const CARGAS_AUTOMATICAS = 5;
let cargasSeguidas = 0;
let vigilanteMuro = null;

/* ------------------------------------------------ la más cercana a mí ------ */

/* Distancia en km entre dos puntos sobre la esfera. Sobra de precisión para
   decidir a qué plaza le pilla más cerca a alguien. */
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

function prepararCercania() {
  const boton = $("#btn-cerca");
  const salida = $("#cerca-estado");
  if (!boton || !("geolocation" in navigator)) return;

  /* Solo se enseña si el navegador puede: si no, mejor no prometer nada.
     Hace falta conexión segura, así que en local por IP no aparecerá. */
  if (!window.isSecureContext) return;
  boton.hidden = false;

  boton.addEventListener("click", () => {
    boton.disabled = true;
    $("#btn-cerca-texto").textContent = "Buscando…";
    mostrarEstado(salida, "Buscando dónde estás. Tu ubicación no sale de este móvil.");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        boton.disabled = false;
        $("#btn-cerca-texto").textContent = "¿Cuál me pilla más cerca?";

        const conCoordenadas = estado.lugares.filter((l) => l.lat != null && l.lon != null);
        if (!conCoordenadas.length) {
          mostrarEstado(salida, "Todavía no hay lugares con punto en el mapa.", "mal");
          return;
        }

        const cerca = conCoordenadas
          .map((l) => ({ l, km: distanciaKm(pos.coords.latitude, pos.coords.longitude, l.lat, l.lon) }))
          .sort((a, b) => a.km - b.km)[0];

        const km = cerca.km < 1 ? "menos de 1 km" : Math.round(cerca.km) + " km";
        mostrarEstado(salida,
          "La más cercana es " + cerca.l.city + " (" + cerca.l.province + "), a " + km +
          ". Te la he marcado en el mapa.", "ok");

        /* Reutiliza el mismo camino que pulsar la tarjeta: filtra por su
           provincia, la resalta y lleva el mapa hasta ella. */
        const tarjeta = $('.tarjeta[data-id="' + cerca.l.id + '"]');
        centrarEn(cerca.l, tarjeta);
      },
      (err) => {
        boton.disabled = false;
        $("#btn-cerca-texto").textContent = "¿Cuál me pilla más cerca?";
        const motivo =
          err.code === err.PERMISSION_DENIED
            ? "No has dado permiso para saber dónde estás. Puedes buscar tu ciudad ahí arriba."
            : err.code === err.TIMEOUT
              ? "Se ha tardado demasiado en localizarte. Prueba otra vez o busca tu ciudad."
              : "No se ha podido saber dónde estás. Busca tu ciudad ahí arriba.";
        mostrarEstado(salida, motivo, "mal");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

function prepararScrollDelMuro() {
  const boton = $("#btn-mas");
  if (!boton || typeof IntersectionObserver !== "function") return;

  /* El observador avisa cuando el botón ENTRA en pantalla, pero tras cargar una
     tanda el botón sigue ahí abajo sin haber salido nunca, así que no vuelve a
     avisar. Por eso, después de cada carga se comprueba a mano si sigue a la
     vista y se encadena la siguiente. */
  async function quizasCargarMas() {
    if (boton.hidden || estado.cargandoMensajes) return;
    if (cargasSeguidas >= CARGAS_AUTOMATICAS) return;
    const caja = boton.getBoundingClientRect();
    if (caja.top > window.innerHeight + 300) return;   // aún queda por bajar

    cargasSeguidas++;
    await cargarMensajes(true);
    requestAnimationFrame(() => quizasCargarMas());
  }

  vigilanteMuro = new IntersectionObserver((entradas) => {
    if (entradas.some((e) => e.isIntersecting)) quizasCargarMas();
  }, { rootMargin: "300px" });   // se adelanta, para que no haya salto visible

  vigilanteMuro.observe(boton);
}

function prepararCompartir() {
  const boton = $("#btn-compartir");
  const nota = $("#difunde-nota");
  if (!boton) return;

  const original = nota ? nota.textContent : "";
  const texto =
    (estado.config.site_title || "Ceuta nos une") + " · " +
    (estado.config.event_label || "2 de septiembre") +
    ", 20:00 h frente a cada ayuntamiento o Delegación del Gobierno.";

  boton.addEventListener("click", async () => {
    const url = location.origin + "/";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ceuta nos une", text: texto, url });
        return;
      }
      await navigator.clipboard.writeText(texto + " " + url);
      if (nota) {
        nota.textContent = "Enlace copiado. Pégalo donde quieras: saldrá el cartel con la fecha y la hora.";
        nota.classList.add("difunde__nota--ok");
        setTimeout(() => {
          nota.textContent = original;
          nota.classList.remove("difunde__nota--ok");
        }, 5000);
      }
    } catch {
      /* el usuario ha cancelado el menú de compartir: no hay nada que hacer */
    }
  });
}

/* ------------------------------------------------------------ animaciones -- */

function prepararRevelados() {
  const objetivos = $$(".seccion__cabecera, .lugares__cuerpo, .proponer__intro, .formulario, .postal-nueva, .difunde__cuerpo");

  // Sin IntersectionObserver no se oculta nada: el contenido es lo importante,
  // la animación es un adorno.
  if (!("IntersectionObserver" in window)) return;

  objetivos.forEach((el) => el.classList.add("revelar"));

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("visible");
          observador.unobserve(entrada.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
  );
  objetivos.forEach((el) => observador.observe(el));

  // Red de seguridad: si algo impide que el observador dispare (una extensión,
  // un error, una captura de pantalla larga), a los 5 s se muestra todo igual.
  // Más vale perder la animación que dejar media web invisible.
  setTimeout(() => objetivos.forEach((el) => el.classList.add("visible")), 5000);
}

/* ----------------------------------------------------------------- inicio -- */

function conectarEventos() {
  let temporizador;
  $("#buscador")?.addEventListener("input", (ev) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      estado.busqueda = ev.target.value;
      estado.visibles = POR_PAGINA;
      pintarLugares();
    }, 180);
  });

  $("#btn-buscar-dir")?.addEventListener("click", buscarDireccion);
  $("#form-lugar")?.addEventListener("submit", enviarLugar);
  $("#form-mensaje")?.addEventListener("submit", enviarMensaje);
  $("#btn-mas")?.addEventListener("click", () => {
    cargasSeguidas = 0;          // ha pedido seguir a mano: vuelven a permitirse tandas solas
    cargarMensajes(true);
  });

  $("#btn-mas-lugares")?.addEventListener("click", () => {
    const antes = $$("#lista-lugares .tarjeta").length;
    estado.visibles += POR_PAGINA;
    pintarLugares(false);          // sin recolocar el mapa: solo crece la lista
    // El foco va a la primera tarjeta nueva, para no perder el sitio con el teclado.
    $$("#lista-lugares .tarjeta")[antes]?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const cuerpo = $("#m-body");
  const restantes = $("#m-restantes");
  cuerpo?.addEventListener("input", () => {
    // Crecer con el texto: sin esto se ven 4 líneas de las 14 que ocupa un
    // mensaje normal. field-sizing lo hace solo donde está soportado.
    if (!CSS.supports("field-sizing", "content")) {
      cuerpo.style.height = "auto";
      cuerpo.style.height = Math.min(cuerpo.scrollHeight, window.innerHeight * 0.6) + "px";
    }
    const quedan = 800 - cuerpo.value.length;
    if (restantes) {
      // Solo se avisa cuando queda poco: antes ponía "800 caracteres" de
      // entrada y parecía que había que escribir 800.
      restantes.textContent = quedan < 150 ? "Te quedan " + quedan + " letras" : "";
      restantes.parentElement?.classList.toggle("contador--limite", quedan < 60);
    }
  });

  document.addEventListener("click", (ev) => {
    if (!ev.target.closest("#sugerencias") && !ev.target.closest("#btn-buscar-dir")) {
      const caja = $("#sugerencias");
      if (caja) caja.hidden = true;
    }
  });
}

async function iniciar() {
  // Enlaces antiguos: /#proponer llevaba al formulario, que ahora vive en /propon
  if (location.hash === "#proponer" && !$("#form-lugar")) {
    location.replace("/propon");
    return;
  }

  /* Enlaces del tipo ceutanosune.es/?q=talavera: quien llega por WhatsApp aterriza
     en su tarjeta, ya filtrada, sin buscar nada. Es lo que se comparte desde cada
     lugar, y no crea direcciones nuevas que mantener. */
  const buscadaEnLaUrl = new URLSearchParams(location.search).get("q");
  if (buscadaEnLaUrl) {
    estado.busqueda = buscadaEnLaUrl.slice(0, 80);
    const caja = $("#buscador");
    if (caja) caja.value = estado.busqueda;
  }

  rellenarProvincias();
  prepararPrevia();
  conectarEventos();
  prepararRevelados();
  iniciarMapa();

  await cargarConfig();
  prepararCompartir();
  prepararScrollDelMuro();
  prepararCercania();
  await Promise.all([
    cargarLugares().catch((err) => {
      $("#lista-lugares").replaceChildren(
        crear("li", "vacio", "No hemos podido cargar los lugares: " + err.message),
      );
    }),
    cargarMensajes(),
  ]);
}

iniciar();
