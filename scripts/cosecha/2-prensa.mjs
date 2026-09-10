/**
 * Paso 2a de la cosecha: la prensa y las webs municipales.
 *
 * Esta rama no necesita navegador ni sesión: 9 de cada 10 de estas páginas
 * publican la foto del artículo en su `og:image`. Por eso va primero — deja
 * ~170 publicaciones en disco antes de tocar Instagram, que es el único frente
 * que puede cortarnos el paso.
 *
 * Lo bajado se guarda con el nombre de su sha256: repetir el paso no duplica
 * nada, y dos ayuntamientos que copiaron el mismo cartel comparten fichero.
 *
 *   node scripts/cosecha/2-prensa.mjs              # sigue donde lo dejó
 *   node scripts/cosecha/2-prensa.mjs --reintentar # vuelve sólo sobre los fallos
 *   node scripts/cosecha/2-prensa.mjs --tope 20    # una cata
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { apuntar, leerEstado, yaResuelta } from "./lib/estado.mjs";
import { comprobarDatos, DATOS } from "./lib/rutas.mjs";
import { candidatas, fechaPublicacion, leerDescartes, pedir, titulo } from "./lib/web.mjs";

const HOJA = path.join(DATOS, "hoja.json");
const ESTADO = path.join(DATOS, "estado.ndjson");
const DESCARTES = path.join(DATOS, "descartes.json");
const ORIGINALES = path.join(DATOS, "originales");

/* Un logotipo de cabecera o un icono de compartir también viven en un og:image.
   Lo que los separa de una foto es el tamaño, pero medirlo por el lado menor
   descarta las apaisadas: una foto de prensa de 698×389 se quedó fuera por once
   píxeles. Se mide por los dos: lado corto decente Y superficie de fotografía.
   Con esto, 698×389 (271k) entra y el 480×360 de una miniatura de YouTube
   (172k) se queda fuera. */
const LADO_MINIMO = 300;
const AREA_MINIMA = 180_000;

/* Y lo que se anuncia a sí mismo. Ninguna foto de una concentración se llama
   `logo-cabecera.png`. */
const NOMBRE_DE_ADORNO = /(logo|icon|avatar|placeholder|default|banner|sprite|favicon)/i;

/* Tres a la vez y un respiro entre tandas. No hay prisa: son 170 páginas de
   medios pequeños, y aporrearlas sería de mala educación además de ruidoso. */
const A_LA_VEZ = 3;
const RESPIRO_MS = 800;

const args = process.argv.slice(2);
const reintentar = args.includes("--reintentar");
/* Reabre las que se descartaron por no encontrar imagen: sirve para cuando lo
   que ha cambiado es el criterio, no la página. */
const revisar = args.includes("--revisar");
/* Vuelve sobre los artículos cuya única foto se descartó a mano, para probar la
   siguiente candidata: muchas veces la buena está más abajo en la página. */
const repescar = args.includes("--repescar");
const tope = Number((args.find((a) => a.startsWith("--tope")) || "").split(/[= ]/)[1] ||
  args[args.indexOf("--tope") + 1] || 0);

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** Descarga una candidata y decide si es una foto o un adorno. */
async function bajarImagen(url) {
  const { bytes, contentType, url: final } = await pedir(url, { tipo: "imagen" });
  let medidas;
  try {
    medidas = await sharp(bytes).metadata();
  } catch {
    return { descartada: "no es una imagen que se pueda leer" };
  }
  const { width: ancho = 0, height: alto = 0, format } = medidas;
  if (Math.min(ancho, alto) < LADO_MINIMO || ancho * alto < AREA_MINIMA) {
    return { descartada: `${ancho}×${alto}, demasiado pequeña para ser la foto` };
  }
  if (NOMBRE_DE_ADORNO.test(new URL(url).pathname)) {
    return { descartada: `se llama ${new URL(url).pathname.split("/").pop()}` };
  }
  const ext = EXT[contentType.split(";")[0].trim()] || format || "jpg";
  return { bytes, ancho, alto, ext, origen_url: final };
}

async function cosechar(pub, descartadas) {
  const { texto: html, url: paginaFinal } = await pedir(pub.url);
  /* Al repescar, sólo lo que el medio declara como imagen del artículo: el
     respaldo que rebusca en el cuerpo sirve para una web municipal sin OG, no
     para saltar a la segunda foto de un periódico. */
  const lista = candidatas(html, paginaFinal).filter((c) => !repescar || c.fuente === "meta");
  if (!lista.length) return { estado: "sin_medios", nota: "ninguna imagen anunciada en la página" };

  const descartes = [];
  for (const { url: candidata } of lista.slice(0, 6)) {
    let img;
    try {
      img = await bajarImagen(candidata);
    } catch (err) {
      descartes.push(`${candidata.slice(-60)}: ${err.message}`);
      continue;
    }
    if (img.descartada) {
      descartes.push(`${candidata.slice(-60)}: ${img.descartada}`);
      continue;
    }
    const huella = sha(img.bytes);
    if (descartadas.has(huella)) {
      descartes.push(`${candidata.slice(-60)}: ya se descartó a mano`);
      continue;
    }
    await mkdir(ORIGINALES, { recursive: true });
    await writeFile(path.join(ORIGINALES, `${huella}.${img.ext}`), img.bytes);
    return {
      estado: "ok",
      titulo: titulo(html),
      fecha_pub: fechaPublicacion(html),
      fotos: [{
        sha256: huella, ancho: img.ancho, alto: img.alto,
        bytes: img.bytes.length, ext: img.ext, origen_url: img.origen_url, orden: 0,
      }],
      nota: descartes.length ? `descartadas antes: ${descartes.join(" | ")}` : null,
    };
  }
  return {
    estado: "sin_medios",
    titulo: titulo(html),
    nota: `ninguna candidata servía: ${descartes.join(" | ")}`,
  };
}

async function main() {
  const hoja = JSON.parse(await readFile(HOJA, "utf8"));
  const estado = await leerEstado(ESTADO);
  const descartadas = await leerDescartes(DESCARTES);

  /* Un artículo cuya foto se tiró a mano vuelve a estar pendiente: no para
     bajar lo mismo, sino para probar la siguiente candidata. */
  const sinFotoUtil = (url) => {
    const fila = estado.porUrl.get(url);
    const fotos = fila?.fotos ?? [];
    return fotos.length > 0 && fotos.every((f) => descartadas.has(f.sha256));
  };

  let pendientes = hoja.publicaciones
    .filter((p) => p.forma === "articulo")
    .filter((p) => (repescar && sinFotoUtil(p.url)) ||
      !yaResuelta(estado, p.url, { reintentar, tambien: revisar ? ["sin_medios"] : [] }));
  if (tope) pendientes = pendientes.slice(0, tope);

  const total = hoja.publicaciones.filter((p) => p.forma === "articulo").length;
  console.log(`prensa y webs municipales: ${total} publicaciones · ${pendientes.length} por cosechar` +
    (reintentar ? " (reintentando fallos)" : ""));

  const cuenta = { ok: 0, sin_medios: 0, fallo: 0 };
  for (let i = 0; i < pendientes.length; i += A_LA_VEZ) {
    const tanda = pendientes.slice(i, i + A_LA_VEZ);
    await Promise.all(tanda.map(async (pub) => {
      let fila;
      try {
        fila = await cosechar(pub, descartadas);
      } catch (err) {
        fila = {
          estado: err.status === 404 ? "404" : "fallo",
          nota: `${err.name}: ${err.message}`,
        };
      }
      cuenta[fila.estado] = (cuenta[fila.estado] ?? 0) + 1;
      await apuntar(ESTADO, { url: pub.url, clave: pub.clave, forma: pub.forma, ...fila });
      const marca = fila.estado === "ok" ? "✓" : fila.estado === "fallo" ? "✗" : "·";
      console.log(`${marca} ${fila.estado.padEnd(10)} ${pub.url.slice(0, 78)}`);
    }));
    if (i + A_LA_VEZ < pendientes.length) await dormir(RESPIRO_MS);
  }

  console.log("\nresumen: " + Object.entries(cuenta).map(([k, v]) => `${k} ${v}`).join(" · "));
  console.log(`originales en ${path.relative(process.cwd(), ORIGINALES)}`);
}

comprobarDatos();
await main();
