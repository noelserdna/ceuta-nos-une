/**
 * El visor: una foto del archivo a tamaño grande, con su autor y su enlace.
 *
 * Es un `<dialog>` con `showModal()`, que da gratis lo difícil —la trampa de
 * foco, el Esc, el fondo inerte— sin una sola librería. Lo que no da bien en
 * todos los navegadores, y por eso va a mano: devolver el foco a quien lo abrió
 * y bloquear el scroll de la página de detrás.
 *
 * El crédito no es opcional ni aquí ni en ningún sitio: son fotos de otros. Si
 * una foto no trae autor y enlace, el visor no la enseña.
 *
 * Todo con createElement/textContent: los créditos y los nombres son texto de
 * terceros y nunca pasan por innerHTML.
 */

const CLAVE = /^(acto|mini)\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{32}\.webp$/;

const TIPO = {
  cartel: "Cartel de la convocatoria",
  acto: "Foto del acto",
  cartel_y_acto: "Cartel y foto del acto",
  prensa: "Foto de prensa",
};

let dialogo = null;
let partes = null;
let estado = { fotos: [], i: 0, contexto: {}, invocador: null };
const quieto = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
}

function montar() {
  if (dialogo) return;
  dialogo = document.getElementById("visor") ?? document.body.appendChild(crear("dialog"));
  dialogo.id = "visor";
  dialogo.className = "visor";
  dialogo.setAttribute("aria-label", "Foto ampliada");

  const cerrar = crear("button", "visor__cerrar", "×");
  cerrar.type = "button";
  cerrar.setAttribute("aria-label", "Cerrar");
  const ant = crear("button", "visor__flecha visor__flecha--ant", "‹");
  ant.type = "button";
  ant.setAttribute("aria-label", "Foto anterior");
  const sig = crear("button", "visor__flecha visor__flecha--sig", "›");
  sig.type = "button";
  sig.setAttribute("aria-label", "Foto siguiente");

  const figura = crear("figure", "visor__figura");
  const img = crear("img", "visor__img");
  img.decoding = "async";
  const pie = crear("figcaption", "visor__pie");
  const donde = crear("p", "visor__donde");
  const credito = crear("p", "visor__credito");
  const convoca = crear("p", "visor__convoca");
  const aviso = crear("p", "visor__aviso");
  const enlace = crear("a", "visor__enlace", "Ver la publicación original");
  enlace.target = "_blank";
  enlace.rel = "noopener noreferrer nofollow";
  /* El «3 de 8» se anuncia al moverse: sin él, quien usa lector de pantalla
     no sabe si ha cambiado de foto ni cuántas le quedan. */
  const cuenta = crear("p", "visor__cuenta");
  cuenta.setAttribute("aria-live", "polite");
  pie.append(donde, credito, convoca, aviso, enlace, cuenta);
  figura.append(img, pie);
  dialogo.replaceChildren(cerrar, ant, figura, sig);
  partes = { img, donde, credito, convoca, aviso, enlace, cuenta, ant, sig };

  cerrar.addEventListener("click", () => dialogo.close());
  ant.addEventListener("click", () => mover(-1));
  sig.addEventListener("click", () => mover(1));
  // Pulsar el fondo cierra, como en cualquier visor; pulsar la foto, no.
  dialogo.addEventListener("click", (ev) => { if (ev.target === dialogo) dialogo.close(); });

  /* El teclado se engancha al diálogo y no al documento: así sólo existe
     mientras está abierto, y no pelea con los atajos del resto de la página. */
  dialogo.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowLeft") { ev.preventDefault(); mover(-1); }
    else if (ev.key === "ArrowRight") { ev.preventDefault(); mover(1); }
    else if (ev.key === "Home") { ev.preventDefault(); ir(0); }
    else if (ev.key === "End") { ev.preventDefault(); ir(estado.fotos.length - 1); }
  });

  // En el móvil se pasa con el dedo: más de 60 px en horizontal cuenta.
  let x0 = null;
  figura.addEventListener("pointerdown", (ev) => { x0 = ev.clientX; });
  figura.addEventListener("pointerup", (ev) => {
    if (x0 == null) return;
    const dx = ev.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 60) mover(dx < 0 ? 1 : -1);
  });

  dialogo.addEventListener("close", () => {
    document.documentElement.classList.remove("visor-abierto");
    partes.img.removeAttribute("src");
    // El retorno de foco que trae el navegador no es fiable en todos: a mano.
    estado.invocador?.focus?.();
  });
}

function precargar(i) {
  const f = estado.fotos[i];
  if (f && CLAVE.test(f.clave)) new Image().src = "/img/" + f.clave;
}

function pintar() {
  const f = estado.fotos[estado.i];
  const { municipio = "", provincia = "" } = estado.contexto;
  partes.img.src = "/img/" + f.clave;
  partes.img.width = f.ancho || 1200;
  partes.img.height = f.alto || 900;
  partes.img.alt = `${f.clase === "portada" ? "Fotograma de un vídeo" : TIPO[f.tipo] ?? "Foto"} en ` +
    (municipio === provincia ? municipio : `${municipio}, ${provincia}`);
  const lugar = municipio === provincia ? municipio : `${municipio} · ${provincia}`;
  partes.donde.textContent = lugar +
    (TIPO[f.tipo] ? ` — ${TIPO[f.tipo]}` : "") + (f.clase === "portada" ? " (vídeo)" : "");
  partes.credito.textContent = `Foto: ${f.credito}`;
  partes.convoca.textContent = f.convocante ? `Convoca: ${f.convocante}` : "";
  partes.convoca.hidden = !f.convocante;
  /* Una galería de prensa que cubre varios pueblos puede traer la foto de otro
     de ellos. Se dice, en vez de dar por hecho que es de aquí. */
  const varios = (f.municipios_en_publicacion ?? 1) > 1;
  partes.aviso.textContent = varios
    ? `Viene de una galería que documenta ${f.municipios_en_publicacion} municipios: puede ser de otro de ellos.`
    : "";
  partes.aviso.hidden = !varios;
  partes.enlace.href = f.url;
  partes.enlace.textContent = f.clase === "portada" ? "Ver el vídeo en la publicación original" : "Ver la publicación original";
  partes.cuenta.textContent = estado.fotos.length > 1 ? `${estado.i + 1} de ${estado.fotos.length}` : "";
  partes.ant.hidden = partes.sig.hidden = estado.fotos.length < 2;

  // Sólo las vecinas, nunca todas: en un móvil con datos, veinte fotos de
  // 200 KB precargadas por si acaso son cuatro megas que nadie ha pedido.
  precargar(estado.i + 1);
  precargar(estado.i - 1);
}

function ir(i) {
  estado.i = (i + estado.fotos.length) % estado.fotos.length;
  if (!quieto()) {
    partes.img.classList.remove("visor__img--entra");
    void partes.img.offsetWidth;   // reinicia la animación
    partes.img.classList.add("visor__img--entra");
  }
  pintar();
}

function mover(paso) {
  if (estado.fotos.length > 1) ir(estado.i + paso);
}

/**
 * Abre el visor en la foto `i` de la lista.
 * @param {Array} fotos   las de la ficha: { clave, ancho, alto, clase, tipo, credito, url, convocante, … }
 * @param {number} i
 * @param {{municipio: string, provincia: string}} contexto
 */
export function abrirVisor(fotos, i, contexto) {
  const validas = fotos.filter((f) => CLAVE.test(f.clave ?? "") && f.credito && f.url);
  if (!validas.length) return;
  const pedida = validas.indexOf(fotos[i]);

  // Sin <dialog> (navegadores muy viejos): se abre la foto sola y basta.
  if (typeof HTMLDialogElement !== "function") {
    window.open("/img/" + validas[Math.max(0, pedida)].clave, "_blank", "noopener");
    return;
  }
  montar();
  estado = { fotos: validas, i: Math.max(0, pedida), contexto, invocador: document.activeElement };
  pintar();
  document.documentElement.classList.add("visor-abierto");
  if (!dialogo.open) dialogo.showModal();
}
