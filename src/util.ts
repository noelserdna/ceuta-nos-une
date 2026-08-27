/**
 * Utilidades compartidas por los distintos endpoints del Worker.
 */

export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...Object.fromEntries(new Headers(extraHeaders)) },
  });
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: message, ...extra }, status);
}

// Caracteres de control: se eliminan siempre. La segunda variante conserva el
// salto de linea (LF) porque los mensajes del muro son multilinea.
const CONTROL_ALL = /[\u0000-\u001F\u007F]/g;
const CONTROL_KEEP_LF = /[\u0000-\u0009\u000B-\u001F\u007F]/g;

/** Texto de un solo renglon: recorta, quita caracteres de control y limita longitud. */
export function cleanLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_ALL, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Texto multilinea: conserva los saltos de parrafo pero limpia el resto. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(CONTROL_KEEP_LF, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export function cleanEmail(value: unknown): string {
  const email = cleanLine(value, 160).toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}

/** AAAA-MM-DD valido. */
export function cleanDate(value: unknown): string {
  const raw = cleanLine(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const d = new Date(raw + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? "" : raw;
}

/** HH:MM en 24h. Acepta "8:00" o "8.00" y devuelve "08:00". */
export function cleanTime(value: unknown): string {
  const raw = cleanLine(value, 6).replace(/[.h]/g, ":");
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return String(h).padStart(2, "0") + ":" + m[2];
}

/** Solo se aceptan enlaces http(s); evita javascript: y data: en la web publica. */
export function cleanUrl(value: unknown): string {
  const raw = cleanLine(value, 300);
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export function cleanCoord(value: unknown, limit: number): number | null {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return Math.round(n * 1e6) / 1e6;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}

/**
 * Nunca se guarda la IP en claro: se guarda un hash con sal, suficiente para
 * detectar abusos y borrar por lotes, pero no reversible.
 */
export async function hashIp(request: Request, salt: string): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
  return (await sha256Hex(salt + "|" + ip)).slice(0, 32);
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

/** Comparacion en tiempo constante para no filtrar informacion por temporizacion. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const SESSION_COOKIE_NAME = "cnu_session";

export async function createSessionToken(secret: string, ttlSeconds: number): Promise<string> {
  const exp = String(Math.floor(Date.now() / 1000) + ttlSeconds);
  return exp + "." + (await hmacHex(exp, secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(sig, await hmacHex(exp, secret));
}

export function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return (
    SESSION_COOKIE_NAME + "=" + token +
    "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + maxAge +
    (secure ? "; Secure" : "")
  );
}

export function clearSessionCookie(secure: boolean): string {
  return (
    SESSION_COOKIE_NAME + "=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" + (secure ? "; Secure" : "")
  );
}

export function readCookie(request: Request, name: string): string {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

/** Tipos de imagen admitidos en el muro y su firma binaria. */
const IMAGE_SIGNATURES: Array<{ type: string; ext: string; test: (b: Uint8Array) => boolean }> = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    ext: "png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: "image/webp",
    ext: "webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  { type: "image/gif", ext: "gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
];

/**
 * No basta con fiarse del content-type que declara el navegador: se comprueban
 * los primeros bytes del fichero para no acabar sirviendo HTML o SVG desde R2.
 */
export function sniffImage(bytes: ArrayBuffer): { type: string; ext: string } | null {
  const head = new Uint8Array(bytes.slice(0, 16));
  if (head.length < 12) return null;
  return IMAGE_SIGNATURES.find((s) => s.test(head)) ?? null;
}

export function randomKey(prefix: string, ext: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const day = new Date().toISOString().slice(0, 10);
  return prefix + "/" + day + "/" + hex + "." + ext;
}

/** Escapa texto para incrustarlo en el HTML del correo de aviso. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
