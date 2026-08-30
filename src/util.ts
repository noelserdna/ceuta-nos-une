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
export async function hashIp(ip: string, salt: string): Promise<string> {
  return (await sha256Hex(salt + "|" + (ip || "0.0.0.0"))).slice(0, 32);
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

// ---------------------------------------------------------------------------
// La fila cero
// ---------------------------------------------------------------------------

/**
 * Clave para los limites por conexion.
 *
 * Con la IP literal el limite no sirve de nada en IPv6: cualquier maquina
 * alquilada tiene un /64 entero para ella y cambia de direccion en cada
 * peticion. Se agrupa por los cuatro primeros grupos, que es la red que de
 * verdad identifica a alguien.
 */
export function claveRed(ip: string): string {
  if (!ip.includes(":")) return ip;
  return ip.split(":").slice(0, 4).join(":") + "::/64";
}

/**
 * Deja el texto como lo lee una persona antes de clasificarlo.
 *
 * Sin esto, cambiar una "a" latina por una "а" cirilica salta cualquier lista de
 * palabras, y los caracteres de ancho cero parten una palabra por dentro sin que
 * se note en pantalla.
 */
const ANCHO_CERO = /[​-‍⁠﻿]/g;
const CONFUSABLES: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "ѕ": "s",
  "і": "i", "ј": "j", "һ": "h", "ԁ": "d", "ɡ": "g", "ν": "v", "ο": "o", "ι": "i",
  "α": "a", "ε": "e", "ρ": "p", "τ": "t", "υ": "u", "κ": "k", "μ": "m", "ѵ": "v",
};
export function normalizarTexto(value: string): string {
  return value
    .normalize("NFKC")
    .replace(ANCHO_CERO, "")
    .replace(/[Ѐ-ӿͰ-Ͽɐ-ʯ]/g, (c) => CONFUSABLES[c] ?? c)
    .toLowerCase();
}

/** Un enlace en una pantalla con el nombre de la convocatoria detras es phishing. */
export function llevaEnlace(value: string): boolean {
  return /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|es|net|org|io|me|link|xyz|top|ru|cc|gl|ly)\b/i
    .test(normalizarTexto(value));
}

/** Tipos que admite la fila cero. El GIF se queda fuera a proposito: ver sniffMedia. */
const MEDIA_SIGNATURES: Array<{ type: string; ext: string; clase: "foto" | "video"; test: (b: Uint8Array) => boolean }> = [
  { type: "image/jpeg", ext: "jpg", clase: "foto", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png", ext: "png", clase: "foto",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: "image/webp", ext: "webp", clase: "foto",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  // Todo MP4 y MOV empieza con una caja "ftyp" en el byte 4. La marca de los
  // bytes 8-12 dice el sabor; los moviles graban isom/mp42 (Android) o qt (iPhone).
  {
    type: "video/mp4", ext: "mp4", clase: "video",
    test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  },
];

/**
 * Igual que sniffImage pero para el directo, con dos diferencias pensadas:
 *
 * - **Sin GIF.** El navegador no los recodifica (perderian la animacion), asi que
 *   llegan tal cual: un GIF parpadeando a 20 Hz proyectado en una plaza es un
 *   riesgo real para quien tiene epilepsia fotosensible, y un clasificador que
 *   mira un fotograma no lo ve venir.
 * - **Con video**, solo si se pide.
 */
export function sniffMedia(bytes: ArrayBuffer, conVideo = false): { type: string; ext: string; clase: "foto" | "video" } | null {
  const head = new Uint8Array(bytes.slice(0, 16));
  if (head.length < 12) return null;
  const hallado = MEDIA_SIGNATURES.find((s) => s.test(head));
  if (!hallado) return null;
  if (hallado.clase === "video" && !conVideo) return null;
  return { type: hallado.type, ext: hallado.ext, clase: hallado.clase };
}

/**
 * Ancho y alto sin decodificar la imagen.
 *
 * Un PNG de 20.000 x 20.000 ocupa 300 KB comprimido y 1,6 GB al abrirlo. Aqui no
 * se abre, pero se abriria en el movil de cada persona que ve el pase, y a
 * pantalla completa eso es la pantalla congelada para todo el mundo.
 */
export function medidasImagen(bytes: ArrayBuffer): { ancho: number; alto: number } | null {
  const b = new Uint8Array(bytes);
  const dv = new DataView(bytes);

  // PNG: el IHDR va siempre en la misma posicion.
  if (b[0] === 0x89 && b[1] === 0x50) {
    if (b.length < 24) return null;
    return { ancho: dv.getUint32(16), alto: dv.getUint32(20) };
  }

  // WEBP: solo el formato simple (VP8X lleva las medidas en 24 bits).
  if (b[0] === 0x52 && b[8] === 0x57) {
    if (b[15] === 0x58 && b.length > 30) {
      return { ancho: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1, alto: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1 };
    }
    return null;   // las otras variantes se dejan pasar: pesan poco por definicion
  }

  // JPEG: hay que recorrer los segmentos hasta dar con un SOFn.
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marca = b[i + 1];
      if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
        return { alto: dv.getUint16(i + 5), ancho: dv.getUint16(i + 7) };
      }
      if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { i += 2; continue; }
      i += 2 + dv.getUint16(i + 2);
    }
  }
  return null;
}

/**
 * Duracion de un MP4 en milisegundos, leyendo la cabecera de pelicula (mvhd).
 *
 * Se busca la caja por el fichero entero en vez de recorrer el arbol: el mvhd
 * puede estar al principio o al final segun como se grabara, y para ocho megas
 * en memoria no compensa escribir un lector de cajas completo.
 */
export function duracionMp4(bytes: ArrayBuffer): number | null {
  const b = new Uint8Array(bytes);
  const dv = new DataView(bytes);
  for (let i = 0; i + 32 < b.length; i++) {
    if (b[i] !== 0x6d || b[i + 1] !== 0x76 || b[i + 2] !== 0x68 || b[i + 3] !== 0x64) continue;
    const version = b[i + 4];
    const escala = version === 1 ? dv.getUint32(i + 20) : dv.getUint32(i + 12);
    const duracion = version === 1 ? Number(dv.getBigUint64(i + 24)) : dv.getUint32(i + 16);
    if (!escala || !duracion) return null;
    return Math.round((duracion / escala) * 1000);
  }
  return null;
}

/**
 * Si el JPEG lleva las coordenadas de donde se hizo la foto.
 *
 * El README promete que el EXIF se quita, pero eso lo hace el lienzo del
 * navegador y tiene escapes: si createImageBitmap falla se sube el original, y
 * quien envia con curl no pasa por ahi. Publicar el sitio exacto desde el que
 * alguien fue a una concentracion es el peor dano que puede hacer esta pantalla,
 * asi que la foto se rechaza y se le pide otra.
 */
export function llevaGps(bytes: ArrayBuffer): boolean {
  const b = new Uint8Array(bytes);
  if (b[0] !== 0xff || b[1] !== 0xd8) return false;
  const dv = new DataView(bytes);
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    if (b[i + 1] === 0xda) return false;                 // empieza la imagen: ya no hay metadatos
    const largo = dv.getUint16(i + 2);
    if (b[i + 1] === 0xe1 && i + 10 < b.length) {        // APP1, que es donde vive el EXIF
      const fin = Math.min(i + 2 + largo, b.length);
      const alineado = b[i + 10] === 0x4d;               // MM (big endian) o II (little)
      for (let j = i + 10; j + 12 < fin; j += 2) {
        const etiqueta = alineado ? dv.getUint16(j) : dv.getUint16(j, true);
        if (etiqueta === 0x8825) return true;            // GPSInfo IFD
      }
    }
    i += 2 + largo;
  }
  return false;
}

/**
 * La ficha de quien entra en la fila cero.
 *
 * Se emite una sola vez, al entrar, despues de pasar el anti-robots. Turnstile no
 * se puede pedir en cada mensaje: cada token vale una vez y tarda segundos en
 * renovarse, asi que en un chat la mitad de los envios contestarian "no hemos
 * podido comprobar que no eres un robot" sin que nadie hubiera hecho nada mal.
 *
 * Va firmada para que no valga inventarsela, y no lleva dentro nada de nadie:
 * son ocho bytes al azar y una fecha de caducidad.
 */
export async function crearFicha(secret: string): Promise<string> {
  const azar = toHex(crypto.getRandomValues(new Uint8Array(8)).buffer);
  const cuerpo = azar + ":" + (Math.floor(Date.now() / 1000) + 60 * 60 * 12);
  return cuerpo + "." + (await hmacHex(cuerpo, secret)).slice(0, 32);
}

export async function fichaValida(ficha: string, secret: string): Promise<boolean> {
  const corte = ficha.lastIndexOf(".");
  if (corte < 1) return false;
  const cuerpo = ficha.slice(0, corte);
  const firma = ficha.slice(corte + 1);
  const exp = Number(cuerpo.split(":")[1]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(firma, (await hmacHex(cuerpo, secret)).slice(0, 32));
}
