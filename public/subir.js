/**
 * El canal de equipo.
 *
 * Aquí sube quien tiene un código de la organización: fotos y vídeos cortos de
 * las plazas. Es lo que da contenido de verdad a la pantalla, lo que ningún
 * filtro automático puede conseguir.
 *
 * El código viaja en el trozo de la URL que va después de la almohadilla
 * (/subir#marta-a7f3). Eso tiene una ventaja concreta: ese trozo no se manda al
 * servidor al navegar, así que no acaba en los registros de nadie ni en la
 * cabecera Referer si desde aquí se pincha en un enlace. Se lee una vez, se
 * guarda en el navegador, y a partir de ahí basta con entrar en /subir.
 */

const $ = (sel) => document.querySelector(sel);
const CLAVE = "cnu:pase";
/* El sitio desde el que se manda no cambia en toda la noche: se guarda para no
   reescribirlo foto a foto, y para que sobreviva a que el movil recargue la
   pagina en mitad del acto. */
const CLAVE_ORIGEN = "cnu:origen";

async function pedir(url, opciones = {}) {
  let res;
  try {
    res = await fetch(url, { credentials: "same-origin", ...opciones });
  } catch {
    throw new Error("No se ha podido conectar. Comprueba la cobertura y vuelve a intentarlo.");
  }
  let datos = {};
  try { datos = await res.json(); } catch { /* sin JSON */ }
  if (!res.ok || datos.ok === false) throw new Error(datos.error || "Algo ha ido mal.");
  return datos;
}

const estado = { codigo: "", archivo: null, subidas: [] };

function decir(texto, mal = false) {
  const caja = $("#s-estado");
  caja.textContent = texto;
  caja.className = "estado" + (texto ? (mal ? " estado--mal" : " estado--ok") : "");
}

/** Igual que en el directo: reduce y, al recodificar, borra el EXIF con el GPS. */
async function prepararFoto(archivo) {
  const LADO_MAX = 1400;
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#FDF1E6";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();
    const blob = await new Promise((r) => lienzo.toBlob(r, "image/jpeg", 0.8));
    return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : archivo;
  } catch {
    return archivo;
  }
}

async function elegir(ev) {
  const archivo = ev.target.files?.[0];
  if (!archivo) return;
  const esVideo = archivo.type.startsWith("video/");

  if (esVideo && archivo.size > 8 * 1024 * 1024) {
    decir("Ese vídeo pesa demasiado. Manda un trozo más corto.", true);
    ev.target.value = "";
    return;
  }

  decir(esVideo ? "Comprobando el vídeo…" : "Preparando la foto…");
  estado.archivo = esVideo ? archivo : await prepararFoto(archivo);

  const previa = $("#s-previa");
  const img = $("#s-previa-img");
  const vid = $("#s-previa-video");
  const url = URL.createObjectURL(estado.archivo);
  if (previa.dataset.url) URL.revokeObjectURL(previa.dataset.url);
  previa.dataset.url = url;

  if (esVideo) {
    vid.src = url; vid.hidden = false; img.hidden = true;
    // Se mira la duración aquí para poder avisar antes de gastar la subida entera
    // con la red de una plaza.
    vid.onloadedmetadata = () => {
      if (vid.duration > 16) {
        decir("El vídeo dura " + Math.round(vid.duration) + " segundos. El tope son quince.", true);
        estado.archivo = null;
      } else {
        decir("");
      }
    };
    // Un MOV de iPhone puede no reproducirse en Android, y eso no se sabe hasta
    // que se intenta: mejor decirlo ahora que descubrirlo en la pantalla grande.
    vid.onerror = () => decir("Este vídeo puede no verse en algunos móviles. Si puedes, mándalo como MP4.", true);
  } else {
    img.src = url; img.hidden = false; vid.hidden = true;
    decir("");
  }
  previa.hidden = false;
  $("#s-label").textContent = "Elegir otro";
}

function quitar() {
  estado.archivo = null;
  $("#s-media").value = "";
  const previa = $("#s-previa");
  if (previa.dataset.url) { URL.revokeObjectURL(previa.dataset.url); delete previa.dataset.url; }
  $("#s-previa-img").hidden = true;
  $("#s-previa-video").hidden = true;
  $("#s-previa-video").removeAttribute("src");
  previa.hidden = true;
  $("#s-label").textContent = "Elegir foto o vídeo";
  decir("");
}

function pintarLista() {
  const lista = $("#lista");
  lista.textContent = "";
  if (!estado.subidas.length) {
    const li = document.createElement("li");
    li.className = "subir__nada";
    li.textContent = "Todavía nada.";
    lista.appendChild(li);
    return;
  }
  for (const s of estado.subidas) {
    const li = document.createElement("li");
    if (s.url) {
      const m = document.createElement(s.tipo === "video" ? "video" : "img");
      m.src = s.url;
      if (s.tipo === "video") { m.muted = true; m.playsInline = true; }
      else { m.alt = ""; }
      li.appendChild(m);
    }
    const txt = document.createElement("span");
    txt.textContent = (s.body || "(sin texto)") + " · " + s.cuando;
    li.appendChild(txt);
    lista.appendChild(li);
  }
}

async function enviar(ev) {
  ev.preventDefault();
  if (!estado.archivo) { decir("Elige una foto o un vídeo.", true); return; }

  const boton = $("#s-enviar");
  boton.disabled = true;
  decir("Subiendo… no cierres la página.");

  const datos = new FormData();
  datos.set("codigo", estado.codigo);
  const origen = $("#s-origin").value.trim();
  datos.set("origin", origen);
  try { localStorage.setItem(CLAVE_ORIGEN, origen); } catch { /* modo privado */ }
  datos.set("body", $("#s-body").value.trim());
  datos.set("media", estado.archivo);

  try {
    const res = await pedir("/api/subir", {
      method: "POST",
      body: datos,
      signal: AbortSignal.timeout(120000),
    });
    estado.subidas.unshift({
      url: $("#s-previa").dataset.url,
      tipo: res.message?.media_tipo,
      body: $("#s-body").value.trim(),
      cuando: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    });
    // La miniatura se queda apuntando al blob local, así que no se revoca aquí.
    delete $("#s-previa").dataset.url;
    quitar();
    $("#s-body").value = "";
    pintarLista();
    decir("Subido. Sale en la pantalla en un par de minutos.");
  } catch (err) {
    decir(err.name === "TimeoutError"
      ? "Está tardando demasiado. Mira la lista de abajo antes de volver a subirlo."
      : err.message, true);
  } finally {
    boton.disabled = false;
  }
}

function arrancar() {
  const delEnlace = location.hash.replace(/^#/, "").trim().toLowerCase();
  if (delEnlace) {
    estado.codigo = delEnlace;
    localStorage.setItem(CLAVE, delEnlace);
    // Se quita de la barra de direcciones para que no se lea por encima del
    // hombro ni acabe en una captura de pantalla compartida.
    history.replaceState(null, "", location.pathname);
  } else {
    estado.codigo = localStorage.getItem(CLAVE) || "";
  }

  if (!estado.codigo) {
    $("#sin-codigo").hidden = false;
    return;
  }

  $("#caja").hidden = false;
  $("#saludo").textContent = "Sube lo que estás viendo";
  try {
    const previo = localStorage.getItem(CLAVE_ORIGEN);
    if (previo) $("#s-origin").value = previo;
  } catch { /* modo privado: se escribe a mano y ya */ }
  $("#s-media").addEventListener("change", elegir);
  $("#s-quitar").addEventListener("click", quitar);
  $("#forma").addEventListener("submit", enviar);
}

arrancar();
