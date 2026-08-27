/* Panel de administración. Igual que en la portada, todo lo que escriben las
   personas se pinta con textContent: nunca con innerHTML. */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const ESTADOS = {
  pending: "Pendiente",
  approved: "Publicado",
  rejected: "Rechazado",
};

const estado = { vista: "lugares", filtroLugares: "pending", filtroMuro: "all" };

/* ------------------------------------------------------------------ util -- */

async function pedir(url, opciones = {}) {
  const res = await fetch(url, { credentials: "same-origin", ...opciones });
  let datos = {};
  try {
    datos = await res.json();
  } catch {
    datos = { ok: false, error: "Respuesta inesperada del servidor." };
  }
  if (res.status === 401) {
    mostrarAcceso();
    throw new Error("Sesión caducada. Vuelve a entrar.");
  }
  if (!res.ok || datos.ok === false) throw new Error(datos.error || "Operación fallida.");
  return datos;
}

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined && texto !== null) el.textContent = String(texto);
  return el;
}

function campo(etiqueta, valor, atributos = {}) {
  const caja = crear("label", "ficha__campo");
  caja.append(crear("span", "campo-label", etiqueta));
  const entrada = document.createElement(atributos.multilinea ? "textarea" : "input");
  if (atributos.type) entrada.type = atributos.type;
  if (atributos.rows) entrada.rows = atributos.rows;
  if (atributos.step) entrada.step = atributos.step;
  entrada.value = valor ?? "";
  entrada.dataset.campo = atributos.nombre;
  caja.append(entrada);
  return caja;
}

function mostrarEstado(nodo, texto, tipo) {
  nodo.textContent = texto;
  nodo.className = "estado" + (tipo ? " estado--" + tipo : "");
}

function fechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ----------------------------------------------------------------- acceso -- */

function mostrarAcceso() {
  $("#acceso").hidden = false;
  $("#panel").hidden = true;
}

function mostrarPanel() {
  $("#acceso").hidden = true;
  $("#panel").hidden = false;
  cargarVista();
}

async function comprobarSesion() {
  try {
    const datos = await pedir("/api/admin/session");
    if (datos.authenticated) mostrarPanel();
    else mostrarAcceso();
  } catch {
    mostrarAcceso();
  }
}

async function entrar(ev) {
  ev.preventDefault();
  const salida = $("#estado-login");
  mostrarEstado(salida, "Comprobando…");
  try {
    await pedir("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: $("#password").value }),
    });
    $("#password").value = "";
    mostrarEstado(salida, "");
    mostrarPanel();
  } catch (err) {
    mostrarEstado(salida, err.message, "mal");
  }
}

async function salir() {
  await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
  mostrarAcceso();
}

/* ---------------------------------------------------------------- lugares -- */

function pintarFiltrosLugares(recuentos) {
  const contenedor = $("#filtros-lugares");
  contenedor.replaceChildren();

  const mapa = Object.fromEntries((recuentos || []).map((r) => [r.status, r.n]));
  const total = Object.values(mapa).reduce((a, b) => a + b, 0);

  const opciones = [
    ["pending", "Pendientes", mapa.pending || 0],
    ["approved", "Publicados", mapa.approved || 0],
    ["rejected", "Rechazados", mapa.rejected || 0],
    ["all", "Todos", total],
  ];

  opciones.forEach(([valor, texto, n]) => {
    const b = crear("button", "chip", texto + " (" + n + ")");
    b.type = "button";
    b.setAttribute("aria-pressed", String(estado.filtroLugares === valor));
    b.addEventListener("click", () => {
      estado.filtroLugares = valor;
      cargarLugares();
    });
    contenedor.append(b);
  });

  const globo = $("#globo-pendientes");
  globo.textContent = String(mapa.pending || 0);
  globo.hidden = !mapa.pending;
}

async function cargarLugares() {
  const listado = $("#listado-lugares");
  listado.replaceChildren(crear("p", "vacio", "Cargando…"));

  try {
    const datos = await pedir("/api/admin/places?status=" + estado.filtroLugares);
    pintarFiltrosLugares(datos.counts);
    listado.replaceChildren();

    if (!datos.places.length) {
      listado.append(crear("p", "vacio", "No hay lugares en este apartado."));
      return;
    }
    datos.places.forEach((lugar) => listado.append(fichaLugar(lugar)));
  } catch (err) {
    listado.replaceChildren(crear("p", "vacio", err.message));
  }
}

function fichaLugar(lugar) {
  const ficha = crear("article", "ficha");
  ficha.dataset.status = lugar.status;

  const cabecera = crear("div", "ficha__cabecera");
  cabecera.append(crear("span", "ficha__titulo", lugar.city + " · " + lugar.province));
  cabecera.append(crear("span", "marca marca--" + lugar.status, ESTADOS[lugar.status] || lugar.status));
  cabecera.append(crear("span", "ficha__meta", "Recibido " + fechaCorta(lugar.created_at)));
  ficha.append(cabecera);

  const rejilla = crear("div", "ficha__rejilla");
  rejilla.append(campo("Localidad", lugar.city, { nombre: "city" }));
  rejilla.append(campo("Provincia", lugar.province, { nombre: "province" }));
  rejilla.append(campo("Lugar", lugar.venue, { nombre: "venue" }));
  rejilla.append(campo("Dirección", lugar.address, { nombre: "address" }));
  rejilla.append(campo("Fecha", lugar.event_date, { nombre: "event_date", type: "date" }));
  rejilla.append(campo("Hora", lugar.event_time, { nombre: "event_time", type: "time" }));
  rejilla.append(campo("Latitud", lugar.lat ?? "", { nombre: "lat", type: "number", step: "any" }));
  rejilla.append(campo("Longitud", lugar.lon ?? "", { nombre: "lon", type: "number", step: "any" }));
  rejilla.append(campo("Convoca", lugar.organizer ?? "", { nombre: "organizer" }));
  rejilla.append(campo("Enlace", lugar.source_url ?? "", { nombre: "source_url", type: "url" }));
  ficha.append(rejilla);

  ficha.append(campo("Detalles", lugar.notes ?? "", { nombre: "notes", multilinea: true, rows: 2 }));

  const contacto = crear("div", "ficha__contacto");
  contacto.append(document.createTextNode("Contacto: " + (lugar.submitter_name || "sin nombre") + " · "));
  if (lugar.submitter_email) {
    const correo = crear("a", null, lugar.submitter_email);
    correo.href = "mailto:" + lugar.submitter_email;
    contacto.append(correo);
  } else {
    contacto.append(document.createTextNode("sin correo"));
  }
  if (lugar.submitter_phone) contacto.append(document.createTextNode(" · tel. " + lugar.submitter_phone));
  ficha.append(contacto);

  const acciones = crear("div", "ficha__acciones");
  const salida = crear("p", "estado");

  const leerCampos = () => {
    const valores = {};
    ficha.querySelectorAll("[data-campo]").forEach((el) => {
      const nombre = el.dataset.campo;
      if (nombre === "lat" || nombre === "lon") valores[nombre] = el.value === "" ? null : Number(el.value);
      else valores[nombre] = el.value;
    });
    return valores;
  };

  const enviar = async (cambios, boton, textoOk) => {
    boton.disabled = true;
    mostrarEstado(salida, "Guardando…");
    try {
      await pedir("/api/admin/places/" + lugar.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cambios),
      });
      mostrarEstado(salida, textoOk, "ok");
      setTimeout(cargarLugares, 700);
    } catch (err) {
      mostrarEstado(salida, err.message, "mal");
      boton.disabled = false;
    }
  };

  if (lugar.status !== "approved") {
    const aprobar = crear("button", "btn btn--ok", "Aprobar y publicar");
    aprobar.addEventListener("click", () =>
      enviar({ ...leerCampos(), status: "approved" }, aprobar, "Publicado."),
    );
    acciones.append(aprobar);
  }

  if (lugar.status !== "rejected") {
    const rechazar = crear("button", "btn btn--no", "Rechazar");
    rechazar.addEventListener("click", () =>
      enviar({ status: "rejected" }, rechazar, "Rechazado."),
    );
    acciones.append(rechazar);
  }

  if (lugar.status === "approved") {
    const despublicar = crear("button", "btn btn--no", "Quitar de la web");
    despublicar.addEventListener("click", () =>
      enviar({ status: "pending" }, despublicar, "Retirado de la web."),
    );
    acciones.append(despublicar);
  }

  const guardar = crear("button", "btn btn--fantasma", "Guardar cambios");
  guardar.addEventListener("click", () => enviar(leerCampos(), guardar, "Guardado."));
  acciones.append(guardar);

  const situar = crear("button", "btn btn--fantasma", "Buscar coordenadas");
  situar.addEventListener("click", async () => {
    const valores = leerCampos();
    situar.disabled = true;
    mostrarEstado(salida, "Buscando…");
    try {
      const consulta = [valores.address, valores.city, valores.province].filter(Boolean).join(", ");
      const datos = await pedir("/api/geocode?q=" + encodeURIComponent(consulta));
      if (!datos.results.length) {
        mostrarEstado(salida, "No se ha encontrado esa dirección.", "mal");
      } else {
        const r = datos.results[0];
        ficha.querySelector('[data-campo="lat"]').value = r.lat;
        ficha.querySelector('[data-campo="lon"]').value = r.lon;
        mostrarEstado(salida, "Coordenadas puestas: " + r.label.slice(0, 60) + "… Recuerda guardar.", "ok");
      }
    } catch (err) {
      mostrarEstado(salida, err.message, "mal");
    } finally {
      situar.disabled = false;
    }
  });
  acciones.append(situar);

  const mapa = crear("a", "btn btn--fantasma", "Ver en el mapa");
  mapa.target = "_blank";
  mapa.rel = "noopener noreferrer";
  mapa.href =
    lugar.lat != null && lugar.lon != null
      ? "https://www.openstreetmap.org/?mlat=" + lugar.lat + "&mlon=" + lugar.lon + "#map=17/" + lugar.lat + "/" + lugar.lon
      : "https://www.openstreetmap.org/search?query=" + encodeURIComponent(lugar.address);
  acciones.append(mapa);

  const borrar = crear("button", "btn btn--peligro", "Borrar");
  borrar.addEventListener("click", async () => {
    if (!confirm("¿Borrar definitivamente el lugar de " + lugar.city + "?")) return;
    borrar.disabled = true;
    try {
      await pedir("/api/admin/places/" + lugar.id, { method: "DELETE" });
      ficha.remove();
      cargarLugares();
    } catch (err) {
      mostrarEstado(salida, err.message, "mal");
      borrar.disabled = false;
    }
  });
  acciones.append(borrar);

  acciones.append(salida);
  ficha.append(acciones);
  return ficha;
}

/* ------------------------------------------------------------------- muro -- */

function pintarFiltrosMuro() {
  const contenedor = $("#filtros-muro");
  contenedor.replaceChildren();
  [
    ["all", "Todos"],
    ["reported", "Con avisos"],
    ["hidden", "Ocultos"],
  ].forEach(([valor, texto]) => {
    const b = crear("button", "chip", texto);
    b.type = "button";
    b.setAttribute("aria-pressed", String(estado.filtroMuro === valor));
    b.addEventListener("click", () => {
      estado.filtroMuro = valor;
      cargarMuro();
    });
    contenedor.append(b);
  });
}

async function cargarMuro() {
  pintarFiltrosMuro();
  const listado = $("#listado-muro");
  listado.replaceChildren(crear("p", "vacio", "Cargando…"));

  try {
    const datos = await pedir("/api/admin/messages?filter=" + estado.filtroMuro);
    listado.replaceChildren();

    const reportados = datos.messages.filter((m) => m.reports > 0 && !m.hidden).length;
    const globo = $("#globo-reportados");
    globo.textContent = String(reportados);
    globo.hidden = !reportados || estado.filtroMuro !== "all";

    if (!datos.messages.length) {
      listado.append(crear("p", "vacio", "No hay mensajes en este apartado."));
      return;
    }
    datos.messages.forEach((m) => listado.append(fichaMensaje(m)));
  } catch (err) {
    listado.replaceChildren(crear("p", "vacio", err.message));
  }
}

function fichaMensaje(mensaje) {
  const art = crear("article", "msg");
  if (mensaje.hidden) art.classList.add("msg--oculto");
  if (mensaje.reports > 0) art.classList.add("msg--reportado");

  if (mensaje.photo_url) {
    const img = document.createElement("img");
    img.className = "msg__foto";
    img.src = mensaje.photo_url;
    img.alt = "Foto de " + mensaje.author;
    img.loading = "lazy";
    art.append(img);
  }

  const cuerpo = crear("div", "msg__cuerpo");
  cuerpo.append(crear("p", "msg__texto", mensaje.body));
  cuerpo.append(crear("div", "msg__firma", mensaje.author));
  cuerpo.append(
    crear(
      "div",
      "msg__meta",
      [
        mensaje.origin || "sin origen",
        fechaCorta(mensaje.created_at),
        mensaje.reports > 0 ? mensaje.reports + " aviso(s)" : null,
        mensaje.hidden ? "OCULTO" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  );
  art.append(cuerpo);

  const acciones = crear("div", "msg__acciones");

  const alternar = crear("button", "btn " + (mensaje.hidden ? "btn--ok" : "btn--no"), mensaje.hidden ? "Mostrar" : "Ocultar");
  alternar.addEventListener("click", async () => {
    alternar.disabled = true;
    try {
      await pedir("/api/admin/messages/" + mensaje.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden: !mensaje.hidden }),
      });
      cargarMuro();
    } catch {
      alternar.disabled = false;
    }
  });
  acciones.append(alternar);

  if (mensaje.reports > 0) {
    const limpiar = crear("button", "btn btn--fantasma", "Descartar avisos");
    limpiar.addEventListener("click", async () => {
      limpiar.disabled = true;
      try {
        await pedir("/api/admin/messages/" + mensaje.id, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reports: 0 }),
        });
        cargarMuro();
      } catch {
        limpiar.disabled = false;
      }
    });
    acciones.append(limpiar);
  }

  const borrar = crear("button", "btn btn--peligro", "Borrar");
  borrar.addEventListener("click", async () => {
    if (!confirm("¿Borrar el mensaje de " + mensaje.author + "? También se borra su foto.")) return;
    borrar.disabled = true;
    try {
      await pedir("/api/admin/messages/" + mensaje.id, { method: "DELETE" });
      art.remove();
    } catch {
      borrar.disabled = false;
    }
  });
  acciones.append(borrar);

  art.append(acciones);
  return art;
}

/* ---------------------------------------------------------------- ajustes -- */

async function cargarAjustes() {
  const form = $("#form-ajustes");
  form.replaceChildren(crear("p", "nota", "Cargando…"));

  try {
    const datos = await pedir("/api/admin/settings");
    form.replaceChildren();

    datos.settings.forEach((ajuste) => {
      const caja = crear("label", "ajuste");
      caja.append(crear("span", "campo-label", ajuste.key));
      const entrada = document.createElement("input");
      entrada.value = ajuste.value;
      entrada.dataset.clave = ajuste.key;
      caja.append(entrada);
      if (ajuste.label) caja.append(crear("small", null, ajuste.label));
      form.append(caja);
    });

    $("#nota-correo").textContent = datos.email_configured
      ? "El envío de correo está activo. Aquí ves los últimos avisos."
      : "No hay proveedor de correo configurado (falta RESEND_API_KEY), así que los avisos NO se envían: quedan registrados aquí y las propuestas siguen llegando a la pestaña Lugares.";

    await cargarAvisos();
  } catch (err) {
    form.replaceChildren(crear("p", "nota", err.message));
  }
}

async function guardarAjustes() {
  const salida = $("#estado-ajustes");
  const boton = $("#btn-guardar-ajustes");
  const valores = {};
  $$("#form-ajustes [data-clave]").forEach((el) => (valores[el.dataset.clave] = el.value));

  boton.disabled = true;
  mostrarEstado(salida, "Guardando…");
  try {
    await pedir("/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valores),
    });
    mostrarEstado(salida, "Ajustes guardados.", "ok");
  } catch (err) {
    mostrarEstado(salida, err.message, "mal");
  } finally {
    boton.disabled = false;
  }
}

async function cargarAvisos() {
  const listado = $("#listado-avisos");
  listado.replaceChildren();
  try {
    const datos = await pedir("/api/admin/notifications");
    if (!datos.notifications.length) {
      listado.append(crear("p", "vacio", "Todavía no se ha generado ningún aviso."));
      return;
    }
    datos.notifications.forEach((n) => {
      const fila = crear("div", "aviso-fila");
      fila.append(crear("span", "marca marca--" + (n.status === "sent" ? "approved" : n.status === "failed" ? "rejected" : "pending"), n.status));
      fila.append(crear("span", "aviso-fila__asunto", n.subject));
      fila.append(crear("span", "msg__meta", fechaCorta(n.sent_at || n.created_at)));
      if (n.error) fila.append(crear("span", "aviso-fila__error", n.error));
      listado.append(fila);
    });
  } catch (err) {
    listado.append(crear("p", "vacio", err.message));
  }
}

/* ----------------------------------------------------------------- vistas -- */

function cambiarVista(vista) {
  estado.vista = vista;
  $$(".pestana").forEach((p) => p.setAttribute("aria-selected", String(p.dataset.vista === vista)));
  $$(".vista").forEach((v) => (v.hidden = v.id !== "vista-" + vista));
  cargarVista();
}

function cargarVista() {
  if (estado.vista === "lugares") cargarLugares();
  else if (estado.vista === "muro") cargarMuro();
  else cargarAjustes();
}

/* ----------------------------------------------------------------- inicio -- */

$("#form-login").addEventListener("submit", entrar);
$("#btn-salir").addEventListener("click", salir);
$("#btn-guardar-ajustes").addEventListener("click", guardarAjustes);
$$(".pestana").forEach((p) => p.addEventListener("click", () => cambiarVista(p.dataset.vista)));

comprobarSesion();
