/**
 * Ceuta nos une - Worker unico que sirve la web y la API.
 *
 * Reglas de publicacion acordadas:
 *  - Los LUGARES pasan por revision: entran como "pending" y se avisa por correo.
 *  - Los MENSAJES del muro se publican al momento; el panel permite ocultarlos.
 */

import {
  cleanCoord,
  cleanDate,
  cleanLine,
  cleanText,
  cleanTime,
  cleanUrl,
  clearSessionCookie,
  clientIp,
  createSessionToken,
  escapeHtml,
  fail,
  hashIp,
  json,
  randomKey,
  readCookie,
  SESSION_COOKIE_NAME,
  sessionCookie as buildSessionCookie,
  sniffImage,
  timingSafeEqual,
  verifySessionToken,
} from "./util";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PHOTOS: R2Bucket;
  EMAIL?: SendEmail;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  RL_MESSAGES: RateLimit;
  RL_PLACES: RateLimit;
  RL_GEOCODE: RateLimit;
  RL_REPORTS: RateLimit;
  RL_LOGIN: RateLimit;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  IP_SALT?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  PROXY_TOKEN?: string;
}

/**
 * IP del visitante. Cuando la web se sirve desde Vercel, el Worker ve la IP de
 * Vercel: la real llega en x-visitante-ip, pero solo se acepta si viene con el
 * token compartido, porque si no cualquiera podría falsear su IP llamando al
 * Worker directamente y saltarse los limites anti-spam.
 */
function ipVisitante(request: Request, env: Env): string {
  const token = request.headers.get("x-proxy-token");
  if (env.PROXY_TOKEN && token && timingSafeEqual(token, env.PROXY_TOKEN)) {
    const real = request.headers.get("x-visitante-ip");
    if (real) return real;
  }
  return clientIp(request);
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SESSION_TTL = 60 * 60 * 8;
const MESSAGES_PAGE = 24;

// ---------------------------------------------------------------------------
// Ajustes (tabla settings)
// ---------------------------------------------------------------------------

type Settings = Record<string, string>;

async function loadSettings(env: Env): Promise<Settings> {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{
    key: string;
    value: string;
  }>();
  const out: Settings = {};
  for (const row of results ?? []) out[row.key] = row.value;
  return out;
}

// ---------------------------------------------------------------------------
// Correo de aviso
// ---------------------------------------------------------------------------

/**
 * El aviso se guarda SIEMPRE en la tabla notifications, se consiga enviar o no.
 * Asi ninguna propuesta se pierde por un fallo del proveedor de correo, y el
 * panel de administracion puede mostrar lo que quedo sin enviar.
 */
async function queueAndSendEmail(
  env: Env,
  opts: { placeId: number; to: string; subject: string; text: string; html: string },
): Promise<void> {
  // Vía preferida: el envío nativo de Cloudflare (sin claves ni terceros).
  // Resend queda como alternativa por si el dominio aún no está listo.
  const via = env.EMAIL ? "cloudflare" : env.RESEND_API_KEY ? "resend" : null;

  const inserted = await env.DB.prepare(
    "INSERT INTO notifications (place_id, to_email, subject, body, status) VALUES (?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(opts.placeId, opts.to, opts.subject, opts.text, via ? "pending" : "skipped")
    .first<{ id: number }>();

  if (!via || !inserted) return;

  const marcarEnviado = () =>
    env.DB.prepare("UPDATE notifications SET status = 'sent', sent_at = datetime('now') WHERE id = ?")
      .bind(inserted.id)
      .run();

  const marcarFallo = (detalle: string) =>
    env.DB.prepare("UPDATE notifications SET status = 'failed', error = ? WHERE id = ?")
      .bind(detalle.slice(0, 400), inserted.id)
      .run();

  if (via === "cloudflare") {
    try {
      await env.EMAIL!.send({
        to: opts.to,
        from: {
          email: env.EMAIL_FROM || "avisos@avisos.ceutanosune.com",
          name: env.EMAIL_FROM_NAME || "Ceuta nos une",
        },
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      await marcarEnviado();
    } catch (err) {
      await marcarFallo("Cloudflare Email: " + String(err));
    }
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + env.RESEND_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || "Ceuta nos une <onboarding@resend.dev>",
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });
    if (res.ok) await marcarEnviado();
    else await marcarFallo("Resend HTTP " + res.status + ": " + (await res.text()));
  } catch (err) {
    await marcarFallo("Resend: " + String(err));
  }
}

// ---------------------------------------------------------------------------
// Turnstile (opcional: si no hay clave configurada, no se exige)
// ---------------------------------------------------------------------------

async function turnstileOk(env: Env, token: string, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sesion de administracion
// ---------------------------------------------------------------------------

function adminSecret(env: Env): string | null {
  const secret = env.SESSION_SECRET || env.ADMIN_PASSWORD;
  return secret && secret.length >= 8 ? secret : null;
}

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const secret = adminSecret(env);
  if (!secret) return false;
  const token = readCookie(request, SESSION_COOKIE_NAME);
  return token ? verifySessionToken(token, secret) : false;
}

function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

// ---------------------------------------------------------------------------
// Endpoints publicos
// ---------------------------------------------------------------------------

async function getConfig(env: Env): Promise<Response> {
  const settings = await loadSettings(env);
  return json(
    {
      ok: true,
      site_title: settings.site_title ?? "Ceuta nos une",
      site_claim: settings.site_claim ?? "",
      event_date: settings.event_date ?? "",
      event_label: settings.event_label ?? "",
      contact_email: settings.contact_email ?? "",
      places_open: settings.places_open !== "0",
      messages_open: settings.messages_open !== "0",
      turnstile_site_key: env.TURNSTILE_SITE_KEY ?? "",
    },
    200,
    { "cache-control": "public, max-age=60" },
  );
}

async function listPlaces(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, city, province, venue, address, event_date, event_time, lat, lon,
            notes, organizer, source_url
       FROM places
      WHERE status = 'approved'
      ORDER BY province COLLATE NOCASE, city COLLATE NOCASE, event_time`,
  ).all();

  return json({ ok: true, places: results ?? [] }, 200, {
    "cache-control": "public, max-age=60",
  });
}

async function createPlace(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const settings = await loadSettings(env);
  if (settings.places_open === "0") {
    return fail("Las propuestas de lugares están cerradas por ahora.", 403);
  }

  const ip = ipVisitante(request, env);
  const { success } = await env.RL_PLACES.limit({ key: ip });
  if (!success) return fail("Demasiadas propuestas seguidas. Prueba dentro de un minuto.", 429);

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("No se ha podido leer el formulario.");
  }

  if (!(await turnstileOk(env, String(payload.turnstile_token ?? ""), ip))) {
    return fail("No hemos podido comprobar que no eres un robot. Vuelve a pulsar el botón.", 403);
  }

  const place = {
    city: cleanLine(payload.city, 80),
    province: cleanLine(payload.province, 80),
    venue: cleanLine(payload.venue, 140),
    address: cleanLine(payload.address, 240),
    event_date: cleanDate(payload.event_date) || settings.event_date || "",
    event_time: cleanTime(payload.event_time),
    lat: cleanCoord(payload.lat, 90),
    lon: cleanCoord(payload.lon, 180),
    notes: cleanText(payload.notes, 600),
    organizer: cleanLine(payload.organizer, 140),
    source_url: cleanUrl(payload.source_url),
  };

  const missing: string[] = [];
  if (!place.city) missing.push("localidad");
  if (!place.province) missing.push("provincia");
  if (!place.venue) missing.push("lugar");
  if (!place.address) missing.push("direccion");
  if (!place.event_time) missing.push("hora");
  if (!place.event_date) missing.push("fecha");
  if (missing.length) return fail("Faltan datos obligatorios: " + missing.join(", ") + ".");

  const ipHash = await hashIp(ipVisitante(request, env), env.IP_SALT ?? "sin-sal");

  const row = await env.DB.prepare(
    `INSERT INTO places (city, province, venue, address, event_date, event_time, lat, lon,
                         notes, organizer, source_url, ip_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
     RETURNING id`,
  )
    .bind(
      place.city, place.province, place.venue, place.address, place.event_date, place.event_time,
      place.lat, place.lon, place.notes || null, place.organizer || null, place.source_url || null,
      ipHash,
    )
    .first<{ id: number }>();

  const placeId = row?.id ?? 0;
  const to = settings.notify_email;
  const origin = new URL(request.url).origin;

  if (to) {
    const lines = [
      "Nueva propuesta de lugar pendiente de revision",
      "",
      "Localidad:  " + place.city + " (" + place.province + ")",
      "Lugar:      " + place.venue,
      "Direccion:  " + place.address,
      "Fecha/hora: " + place.event_date + " a las " + place.event_time,
      "Coordenadas:" + (place.lat !== null && place.lon !== null ? " " + place.lat + ", " + place.lon : " sin fijar"),
      "Convoca:    " + (place.organizer || "-"),
      "Enlace:     " + (place.source_url || "-"),
      "Notas:      " + (place.notes || "-"),
      "",
      "Se envia de forma anonima: la web no pide datos de contacto.",
      "",
      "Aprobar o rechazar en: " + origin + "/admin",
    ];
    const html =
      '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">' +
      "<h2>Nueva propuesta de lugar</h2><table cellpadding=\"4\">" +
      [
        ["Localidad", place.city + " (" + place.province + ")"],
        ["Lugar", place.venue],
        ["Direccion", place.address],
        ["Fecha y hora", place.event_date + " a las " + place.event_time],
        ["Coordenadas", place.lat !== null && place.lon !== null ? place.lat + ", " + place.lon : "sin fijar"],
        ["Convoca", place.organizer || "-"],
        ["Enlace", place.source_url || "-"],
        ["Notas", place.notes || "-"],
      ]
        .map(([k, v]) => "<tr><td><b>" + escapeHtml(k) + "</b></td><td>" + escapeHtml(v) + "</td></tr>")
        .join("") +
      "</table><p><a href=\"" + escapeHtml(origin) + "/admin\">Revisar en el panel</a></p></div>";

    ctx.waitUntil(
      queueAndSendEmail(env, {
        placeId,
        to,
        subject: "[Ceuta nos une] Lugar propuesto: " + place.city + " (" + place.province + ")",
        text: lines.join("\n"),
        html,
      }),
    );
  }

  return json({
    ok: true,
    id: placeId,
    message: "Gracias. Revisaremos el lugar y aparecerá en el mapa en cuanto lo confirmemos.",
  });
}

async function listMessages(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const beforeRaw = url.searchParams.get("before");
  const before = beforeRaw && /^\d+$/.test(beforeRaw) ? Number(beforeRaw) : null;

  const query = before
    ? env.DB.prepare(
        `SELECT id, author, origin, body, photo_key, created_at
           FROM messages WHERE hidden = 0 AND id < ? ORDER BY id DESC LIMIT ?`,
      ).bind(before, MESSAGES_PAGE)
    : env.DB.prepare(
        `SELECT id, author, origin, body, photo_key, created_at
           FROM messages WHERE hidden = 0 ORDER BY id DESC LIMIT ?`,
      ).bind(MESSAGES_PAGE);

  const { results } = await query.all<{
    id: number;
    author: string;
    origin: string | null;
    body: string;
    photo_key: string | null;
    created_at: string;
  }>();

  const rows = results ?? [];
  const messages = rows.map((m) => ({
    id: m.id,
    author: m.author,
    origin: m.origin,
    body: m.body,
    created_at: m.created_at,
    photo_url: m.photo_key ? "/img/" + m.photo_key : null,
  }));

  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE hidden = 0").first<{
    n: number;
  }>();

  return json(
    {
      ok: true,
      messages,
      total: total?.n ?? messages.length,
      next: rows.length === MESSAGES_PAGE ? rows[rows.length - 1].id : null,
    },
    200,
    { "cache-control": "no-store" },
  );
}

async function createMessage(request: Request, env: Env): Promise<Response> {
  const settings = await loadSettings(env);
  if (settings.messages_open === "0") {
    return fail("El muro de apoyo está cerrado por ahora.", 403);
  }

  const ip = ipVisitante(request, env);
  const { success } = await env.RL_MESSAGES.limit({ key: ip });
  if (!success) return fail("Estamos recibiendo muchos mensajes desde tu conexión. Espera un minuto y vuelve a pulsar Publicar: no se pierde nada de lo que has escrito.", 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("No se ha podido leer el formulario.");
  }

  if (!(await turnstileOk(env, String(form.get("turnstile_token") ?? ""), ip))) {
    return fail("No hemos podido comprobar que no eres un robot. Vuelve a pulsar el botón.", 403);
  }

  // Campo trampa: los formularios automatizados lo rellenan, las personas no.
  if (cleanLine(form.get("website"), 50)) {
    // Misma forma que una publicación normal: el cliente pinta la respuesta y
    // con un string en vez de un objeto se rompía a la vista del usuario.
    return json({
      ok: true,
      message: {
        id: 0,
        author: cleanLine(form.get("author"), 60),
        origin: null,
        body: cleanText(form.get("body"), 800),
        created_at: new Date().toISOString(),
        photo_url: null,
      },
    });
  }

  const author = cleanLine(form.get("author"), 60);
  const origin = cleanLine(form.get("origin"), 60);
  const body = cleanText(form.get("body"), 800);

  if (!author) return fail("Falta la firma. Pon tu nombre o un apodo.");
  if (body.length < 1) return fail("Escribe tu mensaje de apoyo.");   // un emoji o un "sí" también es apoyo

  let photoKey: string | null = null;
  let photoType: string | null = null;
  let photoBytes = 0;

  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return fail("Esa foto pesa demasiado. Prueba con otra.", 413);
    }
    const buffer = await photo.arrayBuffer();
    const kind = sniffImage(buffer);
    if (!kind) return fail("El archivo no parece una imagen (admitimos JPG, PNG, WEBP o GIF).");

    photoKey = randomKey("muro", kind.ext);
    photoType = kind.type;
    photoBytes = buffer.byteLength;
    await env.PHOTOS.put(photoKey, buffer, {
      httpMetadata: { contentType: kind.type, cacheControl: "public, max-age=31536000, immutable" },
    });
  }

  const ipHash = await hashIp(ipVisitante(request, env), env.IP_SALT ?? "sin-sal");

  try {
    const row = await env.DB.prepare(
      `INSERT INTO messages (author, origin, body, photo_key, photo_type, photo_bytes, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at`,
    )
      .bind(author, origin || null, body, photoKey, photoType, photoBytes || null, ipHash)
      .first<{ id: number; created_at: string }>();

    return json({
      ok: true,
      message: {
        id: row?.id ?? 0,
        author,
        origin: origin || null,
        body,
        created_at: row?.created_at ?? new Date().toISOString(),
        photo_url: photoKey ? "/img/" + photoKey : null,
      },
    });
  } catch (err) {
    // Si la fila no llega a guardarse, la imagen quedaria huerfana en R2.
    if (photoKey) await env.PHOTOS.delete(photoKey).catch(() => {});
    throw err;
  }
}

async function reportMessage(request: Request, env: Env, id: number): Promise<Response> {
  const { success } = await env.RL_REPORTS.limit({ key: ipVisitante(request, env) });
  if (!success) return fail("Demasiados avisos seguidos.", 429);

  await env.DB.prepare("UPDATE messages SET reports = reports + 1 WHERE id = ?").bind(id).run();
  return json({ ok: true, message: "Gracias, lo revisaremos." });
}

async function serveImage(request: Request, env: Env, key: string): Promise<Response> {
  if (!/^muro\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{32}\.(jpg|png|webp|gif)$/.test(key)) {
    return new Response("No encontrado", { status: 404 });
  }

  const object = await env.PHOTOS.get(key);
  if (!object) return new Response("No encontrado", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-disposition", "inline");
  // El navegador nunca debe ejecutar nada servido desde aqui.
  headers.set("content-security-policy", "default-src 'none'; img-src 'self'; sandbox");

  if (request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
}

/**
 * Busqueda de direcciones contra Nominatim (OpenStreetMap). Se hace desde el
 * Worker para poder enviar un User-Agent identificable, limitar el ritmo y
 * cachear en el borde, como pide su politica de uso.
 */
async function geocode(request: Request, env: Env): Promise<Response> {
  const { success } = await env.RL_GEOCODE.limit({ key: ipVisitante(request, env) });
  if (!success) return fail("Demasiadas búsquedas seguidas.", 429);

  const q = cleanLine(new URL(request.url).searchParams.get("q"), 200);
  if (q.length < 3) return json({ ok: true, results: [] });

  const upstream = new URL("https://nominatim.openstreetmap.org/search");
  upstream.searchParams.set("q", q);
  upstream.searchParams.set("format", "jsonv2");
  upstream.searchParams.set("addressdetails", "1");
  upstream.searchParams.set("limit", "5");
  upstream.searchParams.set("countrycodes", "es");
  upstream.searchParams.set("accept-language", "es");

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        "user-agent": "ceuta-nos-une/1.0 (web de convocatoria; contacto en /)",
        accept: "application/json",
      },
      cf: { cacheEverything: true, cacheTtl: 86400 },
    });
    if (!res.ok) return json({ ok: true, results: [] });

    const data = (await res.json()) as Array<Record<string, any>>;
    const results = data.map((r) => ({
      label: String(r.display_name ?? ""),
      lat: Number(r.lat),
      lon: Number(r.lon),
      city: String(
        r.address?.city ?? r.address?.town ?? r.address?.village ?? r.address?.municipality ?? "",
      ),
      province: String(r.address?.province ?? r.address?.state ?? ""),
    }));
    return json({ ok: true, results }, 200, { "cache-control": "public, max-age=3600" });
  } catch {
    return json({ ok: true, results: [] });
  }
}


/**
 * Teselas del mapa. Se sirven a traves del Worker en lugar de ir directas al
 * proveedor: asi se manda un User-Agent identificable como pide la politica de
 * uso de OpenStreetMap y, sobre todo, la cache del borde de Cloudflare absorbe
 * casi todas las peticiones (una convocatoria puede traer picos de visitas).
 */
async function serveTile(path: string): Promise<Response> {
  const m = path.match(/^\/tiles\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/);
  if (!m) return new Response("No encontrado", { status: 404 });

  const [, z, x, y] = m;
  const zoom = Number(z);
  const maximo = 2 ** zoom;
  if (zoom > 19 || Number(x) >= maximo || Number(y) >= maximo) {
    return new Response("Fuera de rango", { status: 404 });
  }

  try {
    const res = await fetch("https://tile.openstreetmap.org/" + z + "/" + x + "/" + y + ".png", {
      headers: {
        "user-agent": "ceuta-nos-une/1.0 (+https://ceuta-nos-une.workers.dev)",
        accept: "image/png,image/*",
      },
      cf: { cacheEverything: true, cacheTtl: 604800 },
    });
    if (!res.ok) return new Response(null, { status: 204 });

    return new Response(res.body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=604800, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    // Un hueco vacio es preferible a romper el mapa entero.
    return new Response(null, { status: 204 });
  }
}

// ---------------------------------------------------------------------------
// Endpoints de administracion
// ---------------------------------------------------------------------------

async function adminLogin(request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_PASSWORD) {
    return fail(
      "El panel no está configurado. Ejecuta: npx wrangler secret put ADMIN_PASSWORD",
      503,
    );
  }
  const secret = adminSecret(env);
  if (!secret) return fail("SESSION_SECRET o ADMIN_PASSWORD deben tener al menos 8 caracteres.", 503);

  const { success } = await env.RL_LOGIN.limit({ key: ipVisitante(request, env) });
  if (!success) return fail("Demasiados intentos. Espera un minuto.", 429);

  let payload: { password?: string };
  try {
    payload = (await request.json()) as { password?: string };
  } catch {
    return fail("Petición no válida.");
  }

  const given = String(payload.password ?? "");
  if (given.length !== env.ADMIN_PASSWORD.length || !timingSafeEqual(given, env.ADMIN_PASSWORD)) {
    return fail("Contraseña incorrecta.", 401);
  }

  const token = await createSessionToken(secret, SESSION_TTL);
  return json({ ok: true }, 200, {
    "set-cookie": buildSessionCookie(token, SESSION_TTL, isHttps(request)),
  });
}

async function adminPlaces(request: Request, env: Env): Promise<Response> {
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const valid = ["pending", "approved", "rejected", "all"];
  const filter = valid.includes(status) ? status : "pending";

  const query =
    filter === "all"
      ? env.DB.prepare("SELECT * FROM places ORDER BY created_at DESC LIMIT 500")
      : env.DB.prepare("SELECT * FROM places WHERE status = ? ORDER BY created_at DESC LIMIT 500").bind(
          filter,
        );

  const { results } = await query.all();
  const counts = await env.DB.prepare(
    "SELECT status, COUNT(*) AS n FROM places GROUP BY status",
  ).all<{ status: string; n: number }>();

  return json({ ok: true, places: results ?? [], counts: counts.results ?? [] });
}

async function adminUpdatePlace(request: Request, env: Env, id: number): Promise<Response> {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Petición no válida.");
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  const push = (column: string, value: unknown) => {
    sets.push(column + " = ?");
    values.push(value);
  };

  if (typeof payload.status === "string") {
    if (!["pending", "approved", "rejected"].includes(payload.status)) {
      return fail("Estado no válido.");
    }
    push("status", payload.status);
    sets.push("reviewed_at = datetime('now')");
  }

  const textFields: Array<[string, number]> = [
    ["city", 80], ["province", 80], ["venue", 140], ["address", 240],
    ["organizer", 140], ["review_note", 400],
  ];
  for (const [field, max] of textFields) {
    if (typeof payload[field] === "string") push(field, cleanLine(payload[field], max));
  }
  if (typeof payload.notes === "string") push("notes", cleanText(payload.notes, 600));
  if (typeof payload.source_url === "string") push("source_url", cleanUrl(payload.source_url) || null);
  if (payload.event_date !== undefined) {
    const d = cleanDate(payload.event_date);
    if (!d) return fail("Fecha no válida.");
    push("event_date", d);
  }
  if (payload.event_time !== undefined) {
    const t = cleanTime(payload.event_time);
    if (!t) return fail("Hora no válida.");
    push("event_time", t);
  }
  if (payload.lat !== undefined) push("lat", cleanCoord(payload.lat, 90));
  if (payload.lon !== undefined) push("lon", cleanCoord(payload.lon, 180));

  if (!sets.length) return fail("Nada que actualizar.");

  values.push(id);
  await env.DB.prepare("UPDATE places SET " + sets.join(", ") + " WHERE id = ?").bind(...values).run();

  const place = await env.DB.prepare("SELECT * FROM places WHERE id = ?").bind(id).first();
  return json({ ok: true, place });
}

async function adminDeletePlace(env: Env, id: number): Promise<Response> {
  await env.DB.prepare("DELETE FROM places WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function adminMessages(request: Request, env: Env): Promise<Response> {
  const filter = new URL(request.url).searchParams.get("filter") ?? "all";
  let sql = `SELECT id, author, origin, body, photo_key, hidden, reports, created_at
               FROM messages`;
  if (filter === "hidden") sql += " WHERE hidden = 1";
  else if (filter === "reported") sql += " WHERE reports > 0";
  sql += " ORDER BY id DESC LIMIT 300";

  const { results } = await env.DB.prepare(sql).all<Record<string, any>>();
  const messages = (results ?? []).map((m) => ({
    ...m,
    photo_url: m.photo_key ? "/img/" + m.photo_key : null,
  }));
  return json({ ok: true, messages });
}

async function adminUpdateMessage(request: Request, env: Env, id: number): Promise<Response> {
  let payload: { hidden?: boolean; reports?: number };
  try {
    payload = (await request.json()) as { hidden?: boolean; reports?: number };
  } catch {
    return fail("Petición no válida.");
  }
  if (typeof payload.hidden === "boolean") {
    await env.DB.prepare("UPDATE messages SET hidden = ? WHERE id = ?")
      .bind(payload.hidden ? 1 : 0, id)
      .run();
  }
  if (payload.reports === 0) {
    await env.DB.prepare("UPDATE messages SET reports = 0 WHERE id = ?").bind(id).run();
  }
  return json({ ok: true });
}

async function adminDeleteMessage(env: Env, id: number): Promise<Response> {
  const row = await env.DB.prepare("SELECT photo_key FROM messages WHERE id = ?")
    .bind(id)
    .first<{ photo_key: string | null }>();
  if (row?.photo_key) await env.PHOTOS.delete(row.photo_key).catch(() => {});
  await env.DB.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function adminGetSettings(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT key, value, label, updated_at FROM settings ORDER BY key",
  ).all();
  return json({
    ok: true,
    settings: results ?? [],
    email_configured: Boolean(env.EMAIL || env.RESEND_API_KEY),
    email_via: env.EMAIL ? "Cloudflare Email Sending" : env.RESEND_API_KEY ? "Resend" : null,
    email_from: env.EMAIL ? env.EMAIL_FROM ?? "" : env.RESEND_FROM ?? "",
    turnstile_configured: Boolean(env.TURNSTILE_SECRET_KEY),
  });
}

async function adminSaveSettings(request: Request, env: Env): Promise<Response> {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Petición no válida.");
  }

  const statements: D1PreparedStatement[] = [];
  for (const [key, raw] of Object.entries(payload)) {
    const k = cleanLine(key, 40);
    if (!/^[a-z0-9_]+$/.test(k)) continue;
    const value = cleanLine(raw, 300);
    statements.push(
      env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      ).bind(k, value),
    );
  }
  if (!statements.length) return fail("Nada que guardar.");
  await env.DB.batch(statements);
  return adminGetSettings(env);
}

async function adminNotifications(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, place_id, to_email, subject, status, error, created_at, sent_at
       FROM notifications ORDER BY id DESC LIMIT 100`,
  ).all();
  return json({ ok: true, notifications: results ?? [] });
}

// ---------------------------------------------------------------------------
// Enrutado
// ---------------------------------------------------------------------------

function matchId(path: string, prefix: string, suffix = ""): number | null {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  const value = suffix ? (rest.endsWith(suffix) ? rest.slice(0, -suffix.length) : null) : rest;
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path.startsWith("/tiles/")) {
        if (method !== "GET" && method !== "HEAD") return fail("Método no permitido", 405);
        return await serveTile(path);
      }

      if (path.startsWith("/img/")) {
        if (method !== "GET" && method !== "HEAD") return fail("Método no permitido", 405);
        return await serveImage(request, env, decodeURIComponent(path.slice(5)));
      }

      // ---- API publica --------------------------------------------------
      if (path === "/api/config" && method === "GET") return await getConfig(env);
      if (path === "/api/places" && method === "GET") return await listPlaces(env);
      if (path === "/api/places" && method === "POST") return await createPlace(request, env, ctx);
      if (path === "/api/messages" && method === "GET") return await listMessages(request, env);
      if (path === "/api/messages" && method === "POST") return await createMessage(request, env);
      if (path === "/api/geocode" && method === "GET") return await geocode(request, env);

      const reportId = matchId(path, "/api/messages/", "/report");
      if (reportId !== null && method === "POST") return await reportMessage(request, env, reportId);

      // ---- Administracion ------------------------------------------------
      if (path === "/api/admin/login" && method === "POST") return await adminLogin(request, env);

      if (path === "/api/admin/logout" && method === "POST") {
        return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(isHttps(request)) });
      }

      if (path.startsWith("/api/admin/")) {
        if (path === "/api/admin/session" && method === "GET") {
          return json({ ok: true, authenticated: await isAdmin(request, env) });
        }
        if (!(await isAdmin(request, env))) return fail("Necesitas iniciar sesión.", 401);

        if (path === "/api/admin/places" && method === "GET") return await adminPlaces(request, env);
        if (path === "/api/admin/messages" && method === "GET") return await adminMessages(request, env);
        if (path === "/api/admin/settings" && method === "GET") return await adminGetSettings(env);
        if (path === "/api/admin/settings" && method === "PUT") return await adminSaveSettings(request, env);
        if (path === "/api/admin/notifications" && method === "GET") return await adminNotifications(env);

        const placeId = matchId(path, "/api/admin/places/");
        if (placeId !== null && method === "PATCH") return await adminUpdatePlace(request, env, placeId);
        if (placeId !== null && method === "DELETE") return await adminDeletePlace(env, placeId);

        const messageId = matchId(path, "/api/admin/messages/");
        if (messageId !== null && method === "PATCH") return await adminUpdateMessage(request, env, messageId);
        if (messageId !== null && method === "DELETE") return await adminDeleteMessage(env, messageId);

        return fail("Ruta no encontrada.", 404);
      }

      if (path.startsWith("/api/")) return fail("Ruta no encontrada.", 404);

      return await env.ASSETS.fetch(request);
    } catch (err) {
      console.error("Error en", method, path, err);
      return fail("Ha ocurrido un error inesperado. Inténtalo de nuevo.", 500);
    }
  },
} satisfies ExportedHandler<Env>;
