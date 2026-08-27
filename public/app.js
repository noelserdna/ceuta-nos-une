/* Ceuta nos une — lógica de la portada.
   Todo el contenido de la gente se pinta con textContent / createElement:
   nunca con innerHTML, porque los mensajes del muro se publican sin revisión. */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const TESELAS = "/tiles/{z}/{x}/{y}.png";
const ATRIBUCION =
  '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

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

  if (c.turnstile_site_key) cargarTurnstile(c.turnstile_site_key);
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
    $("#c-dias").textContent = String(Math.floor(seg / 86400));
    $("#c-horas").textContent = String(Math.floor((seg % 86400) / 3600)).padStart(2, "0");
    $("#c-min").textContent = String(Math.floor((seg % 3600) / 60)).padStart(2, "0");
    $("#c-seg").textContent = String(seg % 60).padStart(2, "0");
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
  capaMarcadores = L.layerGroup().addTo(mapa);
  // Con la rueda solo se hace zoom tras pulsar el mapa: así no secuestra el scroll.
  mapa.on("click", () => mapa.scrollWheelZoom.enable());
  mapa.on("mouseout", () => mapa.scrollWheelZoom.disable());
}

async function cargarLugares() {
  if (!$("#lista-lugares")) return;
  const datos = await pedir("/api/places");
  estado.lugares = datos.places || [];
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
      pintarChips();
      pintarLugares();
    });
    return b;
  };

  contenedor.append(hacerChip("Todas", ""));
  provincias.forEach((p) => contenedor.append(hacerChip(p, p)));
}

function pintarLugares() {
  const lista = $("#lista-lugares");
  const lugares = lugaresFiltrados();
  lista.replaceChildren();
  capaMarcadores?.clearLayers();
  estado.marcadores.clear();

  $("#lugares-contador").textContent =
    lugares.length === 0
      ? "Ningún lugar coincide con la búsqueda"
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
    return;
  }

  const limites = [];

  lugares.forEach((lugar) => {
    lista.append(tarjetaLugar(lugar));

    if (lugar.lat != null && lugar.lon != null) {
      const marcador = L.marker([lugar.lat, lugar.lon], {
        icon: L.divIcon({ className: "", html: '<div class="pin"></div>', iconSize: [18, 18] }),
        title: lugar.city + " · " + lugar.event_time,
      });
      marcador.bindPopup(popupLugar(lugar));
      marcador.addTo(capaMarcadores);
      estado.marcadores.set(lugar.id, marcador);
      limites.push([lugar.lat, lugar.lon]);
    }
  });

  if (limites.length) {
    mapa.fitBounds(limites, { padding: [40, 40], maxZoom: limites.length === 1 ? 13 : 9 });
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
  const texto =
    lugar.city + " · " + lugar.venue + " · " + lugar.event_time + " h — " + location.origin + "/#lugares";
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
  $$(".tarjeta--activa").forEach((el) => el.classList.remove("tarjeta--activa"));
  elemento.classList.add("tarjeta--activa");

  const marcador = estado.marcadores.get(lugar.id);
  if (!marcador) return;
  mapa.setView(marcador.getLatLng(), Math.max(mapa.getZoom(), 12), { animate: true });
  marcador.openPopup();
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
      icon: L.divIcon({ className: "", html: '<div class="pin"></div>', iconSize: [18, 18] }),
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

  const reportar = crear("button", "postal__reportar", "Avisar");
  reportar.type = "button";
  reportar.title = "Avisar de un contenido inadecuado";
  reportar.addEventListener("click", async () => {
    reportar.disabled = true;
    try {
      await pedir("/api/messages/" + mensaje.id + "/report", { method: "POST" });
      reportar.textContent = "Avisado";
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
  });

  $("#previa-quitar").addEventListener("click", limpiar);
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
  }
}


/* ------------------------------------------------------------- difundir -- */

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
      pintarLugares();
    }, 180);
  });

  $("#btn-buscar-dir")?.addEventListener("click", buscarDireccion);
  $("#form-lugar")?.addEventListener("submit", enviarLugar);
  $("#form-mensaje")?.addEventListener("submit", enviarMensaje);
  $("#btn-mas")?.addEventListener("click", () => cargarMensajes(true));

  const cuerpo = $("#m-body");
  const restantes = $("#m-restantes");
  cuerpo?.addEventListener("input", () => {
    const quedan = 800 - cuerpo.value.length;
    restantes.textContent = String(quedan);
    restantes.parentElement.classList.toggle("contador--limite", quedan < 60);
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

  rellenarProvincias();
  prepararPrevia();
  conectarEventos();
  prepararRevelados();
  iniciarMapa();

  await cargarConfig();
  prepararCompartir();
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
