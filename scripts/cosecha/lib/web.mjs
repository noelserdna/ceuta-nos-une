/**
 * Bajar la foto de un artículo de prensa o de una web municipal.
 *
 * Aquí no hace falta navegador: el 93% de estas páginas publican la foto del
 * artículo en su `og:image`, que es justo la que enseñan al compartir en redes
 * (medido sobre 15 al azar el 05/09/2026). Lo demás son respaldos para el resto.
 */
const NAVEGADOR =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** 15 MB: una foto de portada no pesa más, y así una descarga rara no llena el disco. */
const TOPE_BYTES = 15 * 1024 * 1024;

export async function pedir(url, { tiempo = 20000, tipo = "text" } = {}) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(tiempo),
    headers: {
      "user-agent": NAVEGADOR,
      "accept-language": "es-ES,es;q=0.9",
      accept: tipo === "text"
        ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        : "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (tipo === "text") return { url: res.url, texto: await res.text() };

  const largo = Number(res.headers.get("content-length") || 0);
  if (largo > TOPE_BYTES) throw new Error(`imagen de ${Math.round(largo / 1e6)} MB, se salta`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > TOPE_BYTES) throw new Error("imagen demasiado grande");
  return { url: res.url, bytes, contentType: res.headers.get("content-type") || "" };
}

function meta(html, clave) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*["']${clave}["'][^>]*content\\s*=\\s*["']([^"']+)["']`, "i");
  const otra = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${clave}["']`, "i");
  return (html.match(re) || html.match(otra) || [])[1] || null;
}

/**
 * Candidatas por orden de confianza, cada una con su procedencia.
 *
 * Las `meta` son las que el propio medio declara como imagen del artículo: es
 * la que enseña al compartir en redes, y acierta casi siempre. Las `dom` son un
 * respaldo para las webs municipales viejas que no tienen OG, y hay que tratarlas
 * con recelo: en un periódico, lo que viene después de la foto de portada suele
 * ser de otra noticia — el bloque de «lo más leído» o una publicidad. Probado:
 * saltando la portada de tres artículos salieron una rueda de prensa del
 * Ministerio de Hacienda y el render de una nave logística.
 */
export function candidatas(html, base) {
  const salida = [];
  const meter = (u, fuente) => {
    if (!u) return;
    try {
      const abs = new URL(u.replace(/&amp;/g, "&"), base).href;
      if (/^https?:/.test(abs) && !salida.some((c) => c.url === abs)) salida.push({ url: abs, fuente });
    } catch { /* una URL mal escrita en la página no es motivo para parar */ }
  };

  meter(meta(html, "og:image:secure_url"), "meta");
  meter(meta(html, "og:image"), "meta");
  meter(meta(html, "twitter:image"), "meta");
  meter(meta(html, "twitter:image:src"), "meta");
  meter((html.match(/<link[^>]+rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i) || [])[1], "meta");

  // Respaldo: la mayor del srcset de la primera figura o del cuerpo del artículo.
  const cuerpo = (html.match(/<(?:article|figure)[\s\S]{0,20000}?<\/(?:article|figure)>/i) || [])[0] || "";
  for (const m of cuerpo.matchAll(/<img[^>]+(?:data-src|srcset|src)\s*=\s*["']([^"']+)["']/gi)) {
    const primera = m[1].split(",").pop().trim().split(/\s+/)[0];
    meter(primera, "dom");
  }
  return salida;
}

/**
 * Lo descartado a mano, por su sha256. Se consulta ANTES de dar una candidata
 * por buena: así, al repescar un artículo cuya foto se rechazó, se prueba la
 * siguiente en vez de volver a bajar la misma.
 */
export async function leerDescartes(ruta) {
  try {
    const { readFile } = await import("node:fs/promises");
    return new Set(JSON.parse(await readFile(ruta, "utf8")).sha256 ?? []);
  } catch {
    return new Set();
  }
}

export function titulo(html) {
  return (meta(html, "og:title") || (html.match(/<title[^>]*>([^<]{1,200})/i) || [])[1] || "")
    .replace(/\s+/g, " ").trim() || null;
}

export function fechaPublicacion(html) {
  return meta(html, "article:published_time") || meta(html, "datePublished") ||
    (html.match(/<time[^>]+datetime\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
}
