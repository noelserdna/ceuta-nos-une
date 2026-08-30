/**
 * La fila cero.
 *
 * Igual que en el resto del sitio: todo lo que escribe la gente se pinta con
 * textContent y createElement, nunca con innerHTML. Aquí importa más que en
 * ninguna otra página, porque lo que aparece son mensajes de desconocidos, sin
 * revisar por nadie, en bucle y a pantalla completa.
 *
 * Las decisiones que no se ven leyendo el código de arriba abajo:
 *
 * - La foto y el mensaje son la misma cosa: una tarjeta. Separar "pase de fotos"
 *   y "chat" partía la pantalla en dos y obligaba a elegir dónde mirar.
 * - Al enviar, la tarjeta aparece al instante con la copia local de la foto, sin
 *   esperar al servidor. Con la red de una plaza llena eso son cuarenta segundos
 *   en los que no existes.
 * - No se añade un parámetro a la URL del sondeo para "refrescar": eso convierte
 *   cada petición en una URL distinta y tira la caché del borde, que es lo que
 *   permite que miles de personas sean una sola consulta.
 */

const $ = (sel) => document.querySelector(sel);

/** Mismo envoltorio que en app.js: traduce el fallo de red a algo que se entienda. */
async function pedir(url, opciones = {}) {
  let res;
  try {
    res = await fetch(url, { credentials: "same-origin", ...opciones });
  } catch {
    throw new Error("No se ha podido conectar. Comprueba la cobertura y vuelve a intentarlo.");
  }
  let datos = {};
  try {
    datos = await res.json();
  } catch {
    /* respuesta sin JSON: se trata como error genérico más abajo */
  }
  if (!res.ok || datos.ok === false) {
    throw new Error(datos.error || "Algo ha ido mal. Vuelve a intentarlo.");
  }
  return datos;
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");

const estado = {
  ficha: "",
  tarjetas: [],          // lo que se ve, en orden
  vistas: new Set(),     // ids ya pintados, para no repetir
  indice: 0,
  pausado: quieto.matches,   // quien pidió que nada se mueva, entra en pausa
  sondeoMs: 4000,
  ultimoToque: Date.now(),
  foto: null,
  mini: null,
  turnoFoto: 0,
  momento: "off",
  enviando: false,
  ultimoFeed: null,
};

const CLAVE_FICHA = "cnu:ficha";
const CLAVE_FIRMA = "cnu:firma";
const CLAVE_BUTACA = "cnu:butaca";

/* ---------------------------------------------------------------------------
   La ficha: se pasa el anti-robots una vez, al entrar, y no se vuelve a pedir.
   Un token de Turnstile vale una sola vez y tarda segundos en renovarse: pedirlo
   en cada mensaje haría que medio chat recibiera "no hemos podido comprobar que
   no eres un robot" sin que nadie hubiera hecho nada raro.
--------------------------------------------------------------------------- */

function fichaGuardadaSigueValiendo() {
  const ficha = localStorage.getItem(CLAVE_FICHA) || "";
  const exp = Number(ficha.split(".")[0]?.split(":")[1]);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() + 60000) return "";
  return ficha;
}

function cargarTurnstile(siteKey) {
  return new Promise((resolve) => {
    const caja = $("#turnstile-directo");
    if (!caja || !siteKey) return resolve(false);
    caja.className = "cf-turnstile turnstile";
    caja.dataset.sitekey = siteKey;
    caja.dataset.theme = "dark";
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function abrirEntrada() {
  const guardada = fichaGuardadaSigueValiendo();
  const butaca = localStorage.getItem(CLAVE_BUTACA);
  if (guardada) {
    estado.ficha = guardada;
    return;   // ya entraste antes: se cae directo al río
  }

  const entrada = $("#entrada");
  const boton = $("#entrada-boton");
  entrada.hidden = false;
  // La cifra grande antes de entrar es cuánta gente ha pasado ya; después es tu
  // butaca. Es el mismo hueco contando dos cosas distintas, y las dos importan:
  // primero que hay gente, luego que tú eres una de ellas.
  const yaHan = estado.ultimoFeed?.total ?? 0;
  if (butaca) {
    $("#entrada-butaca").textContent = "Butaca " + Number(butaca).toLocaleString("es-ES");
    $("#entrada-pie").textContent = "Sigue siendo la tuya. Entra otra vez.";
  } else if (yaHan > 0) {
    $("#entrada-butaca").textContent = yaHan.toLocaleString("es-ES");
    $("#entrada-pie").textContent = yaHan === 1
      ? "Una persona ha entrado ya. Coge tu sitio."
      : "personas han entrado ya. Coge tu sitio.";
  } else {
    $("#entrada-butaca").textContent = "—";
    $("#entrada-pie").textContent = "Todavía no ha entrado nadie. Sé la primera persona.";
  }

  let config = {};
  try {
    config = await pedir("/api/config");
  } catch {
    /* sin config se intenta igual: el servidor dirá que no si no puede */
  }
  await cargarTurnstile(config.turnstile_site_key);
  boton.disabled = false;

  await new Promise((resolve) => {
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      boton.textContent = "Entrando…";
      const campo = document.querySelector('#turnstile-directo [name="cf-turnstile-response"]');
      try {
        const res = await pedir("/api/directo/entrar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ turnstile_token: campo ? campo.value : "" }),
        });
        estado.ficha = res.ficha;
        localStorage.setItem(CLAVE_FICHA, res.ficha);
        const mia = await latir();
        if (mia?.butaca) {
          $("#entrada-eco").textContent = "Tu sitio";
          $("#entrada-butaca").textContent = "Butaca " + mia.butaca.toLocaleString("es-ES");
          $("#entrada-pie").textContent = "Ya estás dentro.";
          boton.hidden = true;
          $("#turnstile-directo").hidden = true;
          await new Promise((r) => setTimeout(r, 1400));
        }
        entrada.hidden = true;
        resolve();
      } catch (err) {
        $("#entrada-pie").textContent = err.message;
        boton.disabled = false;
        boton.textContent = "Entrar";
        window.turnstile?.reset();
      }
    });
  });
}

/* ---------------------------------------------------------------------------
   El río
--------------------------------------------------------------------------- */

function pintarTarjeta(m, { propia = false } = {}) {
  const li = crear("li", "rio__tarjeta");
  li.dataset.id = String(m.id);

  if (m.media && m.tipo === "video") {
    const v = document.createElement("video");
    v.className = "rio__media";
    v.src = m.media;
    v.muted = true;            // en el pase no suena nada: es una foto que se mueve
    v.loop = true;
    v.playsInline = true;
    v.preload = "none";
    // Un MOV de iPhone puede no reproducirse en Android. Si falla, se salta.
    v.addEventListener("error", () => { li.dataset.roto = "1"; });
    li.appendChild(v);
  } else if (m.media || m.blob) {
    const img = crear("img", "rio__media");
    img.src = m.blob || m.media;
    img.loading = "lazy";
    img.decoding = "async";
    // El alt es lo que escribió la persona. "Foto enviada por" sesenta veces
    // seguidas no le dice nada a nadie.
    img.alt = m.body ? m.body + (m.origin ? ". Desde " + m.origin : "") : "Foto de " + m.author;
    li.appendChild(img);
  } else {
    li.appendChild(crear("p", "rio__solo-texto", m.body));
  }

  const pie = crear("div", "rio__pie");
  if (m.media || m.blob) pie.appendChild(crear("p", "rio__texto", m.body));

  const firma = crear("p", "rio__firma");
  firma.appendChild(document.createTextNode(m.author));
  if (m.origin) {
    firma.appendChild(document.createTextNode(" · "));
    firma.appendChild(crear("b", null, m.origin));
  }
  if (m.created_at) {
    const h = new Date(m.created_at.replace(" ", "T") + (m.created_at.includes("Z") ? "" : "Z"));
    if (!Number.isNaN(h.getTime())) {
      firma.appendChild(document.createTextNode(" · " +
        h.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })));
    }
  }
  pie.appendChild(firma);

  if (propia && m.esperando) {
    pie.appendChild(crear("span", "rio__espera", "Solo lo ves tú de momento. Lo estamos mirando."));
  } else if (propia && m.enviando) {
    pie.appendChild(crear("span", "rio__espera", "Enviando…"));
  }

  li.appendChild(pie);
  return li;
}

function meterEnElRio(mensajes, { propia = false, alFrente = false } = {}) {
  const rio = $("#rio");
  let nuevas = 0;
  for (const m of mensajes) {
    const clave = propia ? "propia:" + m.id + ":" + m.created_at : m.id;
    if (estado.vistas.has(clave)) continue;
    estado.vistas.add(clave);
    const li = pintarTarjeta(m, { propia });
    // El río se añade, nunca se repinta entero: repintarlo tira el foco al body
    // y quien navega con teclado se pierde a cada refresco.
    if (alFrente) {
      rio.prepend(li);
      estado.tarjetas.unshift(li);
      estado.indice = 0;
    } else {
      rio.appendChild(li);
      estado.tarjetas.push(li);
    }
    nuevas++;
  }
  if (nuevas) {
    $("#rio-vacio").hidden = true;
    if (!rio.querySelector(".activa")) mostrar(0);
  }
  return nuevas;
}

function mostrar(i) {
  if (!estado.tarjetas.length) return;
  estado.indice = ((i % estado.tarjetas.length) + estado.tarjetas.length) % estado.tarjetas.length;
  estado.tarjetas.forEach((li, n) => {
    const activa = n === estado.indice;
    li.classList.toggle("activa", activa);
    const v = li.querySelector("video");
    if (v) activa && !quieto.matches ? v.play().catch(() => {}) : v.pause();
  });
  // Sólo se precarga la siguiente, nunca tres: en la red de una plaza llena eso
  // es la diferencia entre que el pase avance y que se atasque.
  const siguiente = estado.tarjetas[(estado.indice + 1) % estado.tarjetas.length];
  const img = siguiente?.querySelector("img");
  if (img && !img.complete) img.loading = "eager";
}

function avanzar() {
  if (!estado.tarjetas.length) return;
  let saltos = 0;
  do {
    estado.indice = (estado.indice + 1) % estado.tarjetas.length;
    saltos++;
  } while (estado.tarjetas[estado.indice]?.dataset.roto && saltos < estado.tarjetas.length);
  mostrar(estado.indice);
}

/** Un vídeo se queda quince segundos; una foto, seis. */
function duracionActual() {
  const li = estado.tarjetas[estado.indice];
  return li?.querySelector("video") ? 15000 : 6000;
}

let desdeCuando = Date.now();
function tictac() {
  const li = estado.tarjetas[estado.indice];
  if (!estado.pausado && li) {
    const trans = Date.now() - desdeCuando;
    const dur = duracionActual();
    $("#avance").style.setProperty("--avance", Math.min(100, (trans / dur) * 100) + "%");
    if (trans >= dur) {
      avanzar();
      desdeCuando = Date.now();
    }
  }
  requestAnimationFrame(tictac);
}

/* ---------------------------------------------------------------------------
   El sondeo
--------------------------------------------------------------------------- */

function textoCifra(datos) {
  const gente = datos.ahora === 1 ? "1 persona" : datos.ahora.toLocaleString("es-ES") + " personas";
  const pueblos = datos.pueblos.length;
  if (datos.momento === "fin") {
    return "Fuimos " + datos.total.toLocaleString("es-ES") + " personas de " + pueblos + " pueblos";
  }
  return "Somos " + gente + (pueblos ? " · " + pueblos + (pueblos === 1 ? " pueblo" : " pueblos") : "");
}

function pintarPueblos(lista) {
  const caja = $("#pueblos");
  caja.textContent = "";
  lista.slice(0, 24).forEach((p, i) => {
    if (i) caja.appendChild(document.createTextNode(" · "));
    // El más reciente encendido: es la señal de que alguien acaba de sumarse.
    caja.appendChild(i === 0 ? crear("b", null, p.nombre) : document.createTextNode(p.nombre));
  });
}

function pintarRetransmision(video) {
  const caja = $("#retrans");
  if (!video) { caja.hidden = true; return; }
  caja.hidden = false;
  $("#retrans-abrir").onclick = () => {
    const hueco = $("#retrans-hueco");
    if (hueco.firstChild) return;
    const marco = document.createElement("iframe");
    // Nada de terceros hasta que alguien pulsa: así no se cuela una cookie de
    // YouTube en una web que no pone ninguna.
    if (video.tipo === "youtube") {
      marco.src = "https://www.youtube-nocookie.com/embed/" + video.id + "?autoplay=1";
    } else if (video.tipo === "twitch") {
      marco.src = "https://player.twitch.tv/?channel=" + video.id + "&parent=" + location.hostname;
    } else {
      marco.src = "https://iframe.videodelivery.net/" + video.id + "?autoplay=true";
    }
    marco.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    marco.title = "Retransmisión en directo";
    hueco.appendChild(marco);
    $("#retrans-abrir").hidden = true;
  };
}

async function sondear() {
  try {
    const datos = await pedir("/api/directo");
    estado.ultimoFeed = datos;
    estado.momento = datos.momento;
    estado.sondeoMs = Math.max(3000, datos.sondeo * 1000);

    $("#cifra-texto").textContent = textoCifra(datos);
    $("#cifra").classList.toggle("cifra--parada", datos.momento === "fin" || datos.momento === "off");
    pintarPueblos(datos.pueblos);
    pintarRetransmision(datos.video);

    // Las tarjetas con imagen primero: son las que llenan la pantalla. Los
    // mensajes sueltos van detrás, intercalados por el propio orden del río.
    meterEnElRio([...datos.tarjetas, ...datos.mensajes]);

    if (datos.momento === "off") {
      $("#rio-vacio").hidden = estado.tarjetas.length > 0;
    }
  } catch {
    // Un fallo suelto del sondeo no se le cuenta a nadie: la pantalla sigue
    // pasando lo que ya tiene y en cuatro segundos se vuelve a intentar.
  }
}

async function latir() {
  if (!estado.ficha) return;
  try {
    const r = await pedir("/api/directo/latido?ficha=" + encodeURIComponent(estado.ficha), {
      method: "POST",
    });
    if (r.butaca) localStorage.setItem(CLAVE_BUTACA, String(r.butaca));
    // El feed va con tres segundos de retraso por la cache del borde, y quien
    // acaba de entrar no puede leer "somos 0 personas". El latido ya trae la
    // cuenta buena: se pinta con ella y el siguiente sondeo la confirma.
    if (estado.ultimoFeed) {
      estado.ultimoFeed.ahora = Math.max(estado.ultimoFeed.ahora, r.ahora);
      estado.ultimoFeed.total = Math.max(estado.ultimoFeed.total, r.total);
      const texto = document.querySelector("#cifra-texto");
      if (texto) texto.textContent = textoCifra(estado.ultimoFeed);
    }
    return r;
  } catch {
    /* el contador es un adorno: si falla, no se molesta a nadie */
    return null;
  }
}

/* ---------------------------------------------------------------------------
   Participar
--------------------------------------------------------------------------- */

/**
 * Reduce la foto en el propio móvil antes de subirla.
 *
 * Copiado de app.js a propósito, con el lado más corto: aquí la foto se ve en un
 * pase, no en una postal, y quien la manda suele estar en una plaza con la red
 * saturada. Recodificar siempre, aunque la foto sea pequeña, es lo que le quita
 * el EXIF con las coordenadas de dónde se hizo.
 */
async function prepararFoto(archivo) {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });

    const encoger = async (lado, calidad, nombre) => {
      const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(bitmap.width * escala);
      lienzo.height = Math.round(bitmap.height * escala);
      const ctx = lienzo.getContext("2d");
      ctx.fillStyle = "#FDF1E6";     // sin esto, un PNG transparente sale con fondo negro
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
      const blob = await new Promise((r) => lienzo.toBlob(r, "image/jpeg", calidad));
      return blob ? new File([blob], nombre, { type: "image/jpeg" }) : null;
    };

    // La que se ve en el pase, y una copia pequeña que sólo mira el clasificador.
    // No es un capricho: medido contra el mismo modelo, una foto de 320 px se
    // resuelve en segundo y medio y la misma a 800 px tarda treinta y tres.
    const grande = await encoger(1200, 0.78, "foto.jpg");
    const mini = await encoger(320, 0.6, "mini.jpg");
    bitmap.close();
    return { grande: grande ?? archivo, mini };
  } catch {
    return { grande: archivo, mini: null };
  }
}

function decir(texto, mal = false) {
  const caja = $("#p-estado");
  caja.textContent = texto;
  caja.className = "estado" + (texto ? (mal ? " estado--mal" : " estado--ok") : "");
}

async function elegirFoto(ev) {
  const archivo = ev.target.files?.[0];
  if (!archivo) return;
  if (archivo.size > 12 * 1024 * 1024) {
    decir("Esa foto pesa demasiado. Prueba con otra.", true);
    ev.target.value = "";
    return;
  }
  const turno = ++estado.turnoFoto;
  decir("Preparando la foto…");
  const { grande, mini } = await prepararFoto(archivo);
  if (turno !== estado.turnoFoto) return;    // han elegido otra mientras tanto
  estado.foto = grande;
  estado.mini = mini;
  const previa = $("#p-previa");
  const img = $("#p-previa-img");
  if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  const url = URL.createObjectURL(grande);
  img.dataset.url = url;
  img.src = url;
  previa.hidden = false;
  $("#p-foto-label").classList.add("tiene");
  decir("");
}

function quitarFoto() {
  estado.foto = null;
  estado.mini = null;
  $("#p-foto").value = "";
  const img = $("#p-previa-img");
  if (img.dataset.url) { URL.revokeObjectURL(img.dataset.url); delete img.dataset.url; }
  img.removeAttribute("src");
  $("#p-previa").hidden = true;
  $("#p-foto-label").classList.remove("tiene");
}

async function enviar(ev) {
  ev.preventDefault();
  if (estado.enviando) return;

  const author = $("#p-author").value.trim();
  const origin = $("#p-origin").value.trim();
  const body = $("#p-body").value.trim();
  if (!author) { $("#p-author").focus(); decir("Pon tu nombre o un apodo.", true); return; }
  if (!body && !estado.foto) { $("#p-body").focus(); decir("Escribe algo, o manda una foto.", true); return; }

  estado.enviando = true;
  $("#p-enviar").disabled = true;

  // Tu tarjeta aparece ya, con tu propia copia de la foto. Nadie debería esperar
  // a que suba una imagen por una red saturada para saber que ha participado.
  const provisional = {
    id: "yo-" + Date.now(),
    author, origin, body,
    created_at: new Date().toISOString(),
    blob: estado.foto ? URL.createObjectURL(estado.foto) : null,
    enviando: true,
  };
  meterEnElRio([provisional], { propia: true, alFrente: true });
  mostrar(0);
  desdeCuando = Date.now();

  const datos = new FormData();
  datos.set("author", author);
  datos.set("origin", origin);
  datos.set("body", body);
  datos.set("ficha", estado.ficha);
  datos.set("website", "");
  if (estado.foto) datos.set("foto", estado.foto);
  if (estado.mini) datos.set("mini", estado.mini);

  try {
    const res = await pedir("/api/directo/mensaje", {
      method: "POST",
      body: datos,
      // La red de una plaza a las ocho de la tarde es lenta, no está rota.
      signal: AbortSignal.timeout(90000),
    });
    if (res.message?.id) {
      estado.vistas.add(res.message.id);
      if (estado.tarjetas[0]) estado.tarjetas[0].dataset.id = String(res.message.id);
    }
    localStorage.setItem(CLAVE_FIRMA, JSON.stringify({ author, origin }));
    $("#participar-quien").hidden = true;
    $("#p-body").value = "";
    quitarFoto();
    decir(res.message?.esperando
      ? "Lo estamos mirando. Aparecerá en un momento."
      : "¡Ya estás en la fila cero!");
    const tarjeta = estado.tarjetas[0];
    const marca = tarjeta?.querySelector(".rio__espera");
    if (marca) {
      marca.textContent = res.message?.esperando
        ? "Solo lo ves tú de momento. Lo estamos mirando."
        : "Ya se está viendo";
    }
  } catch (err) {
    decir(err.name === "TimeoutError"
      ? "Está tardando demasiado. Mira si aparece aquí arriba; si no, vuelve a enviarlo."
      : err.message, true);
    const marca = estado.tarjetas[0]?.querySelector(".rio__espera");
    // Nunca se cae en silencio: si no ha salido, se dice.
    if (marca) marca.textContent = "No hemos podido enviarlo";
  } finally {
    estado.enviando = false;
    $("#p-enviar").disabled = false;
  }
}

/* ---------------------------------------------------------------------------
   Arranque
--------------------------------------------------------------------------- */

function pausar(si) {
  estado.pausado = si;
  $("#pausa").setAttribute("aria-pressed", String(si));
  $("#pausa-texto").textContent = si ? "Seguir" : "Pausar";
  if (!si) desdeCuando = Date.now();
  const v = estado.tarjetas[estado.indice]?.querySelector("video");
  if (v) si ? v.pause() : v.play().catch(() => {});
}

async function arrancar() {
  if (new URLSearchParams(location.search).has("tele")) {
    document.body.classList.add("tele");
  }

  const firma = JSON.parse(localStorage.getItem(CLAVE_FIRMA) || "null");
  if (firma?.author) {
    $("#p-author").value = firma.author;
    $("#p-origin").value = firma.origin || "";
    $("#participar-quien").hidden = true;
  }

  $("#p-foto").addEventListener("change", elegirFoto);
  $("#p-previa-quitar").addEventListener("click", quitarFoto);
  $("#participar").addEventListener("submit", enviar);
  $("#pausa").addEventListener("click", () => pausar(!estado.pausado));
  // La regla CSS de prefers-reduced-motion no toca un temporizador: hay que
  // mirar la preferencia aquí, y volver a mirarla si cambia en caliente.
  quieto.addEventListener("change", (e) => pausar(e.matches));
  pausar(estado.pausado);

  await sondear();          // que haya algo en pantalla antes de pedir entrar
  await abrirEntrada();
  await latir();
  requestAnimationFrame(tictac);

  let ciclo = 0;
  const bucle = async () => {
    // Con la pestaña de fondo no se pide nada: un móvil en el bolsillo sondeando
    // cada cuatro segundos durante dos horas son mil ochocientas peticiones y
    // una batería a la mitad justo cuando hace falta.
    if (document.visibilityState === "visible") {
      // Y si nadie toca la pantalla en diez minutos, se afloja el ritmo.
      const dormido = Date.now() - estado.ultimoToque > 600000;
      if (!dormido || ciclo % 5 === 0) await sondear();
      if (ciclo % 7 === 0) await latir();
      ciclo++;
    }
    setTimeout(bucle, estado.sondeoMs);
  };
  setTimeout(bucle, estado.sondeoMs);

  ["pointerdown", "keydown"].forEach((ev) =>
    document.addEventListener(ev, () => { estado.ultimoToque = Date.now(); }, { passive: true }),
  );
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { estado.ultimoToque = Date.now(); sondear(); }
  });
}

arrancar();
