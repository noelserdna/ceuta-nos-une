/**
 * Paso 3 de la cosecha: de lo bajado a lo que sirve la web.
 *
 * Dos derivadas por foto y ninguna más: `web` (1600 px) para verla a pantalla
 * completa y `mini` (400 px) para el mapa y las rejillas. Con 761 municipios en
 * el mapa, la diferencia entre una miniatura de 20 KB y una de 200 es que el
 * mapa se abra o no en un móvil.
 *
 * Se procesa desde `datos/originales/`, nunca desde la red: el día que haga
 * falta cambiar el tamaño o la calidad, esto se repite en minutos sin volver a
 * pasar por Instagram, que es lo que no se puede repetir a voluntad.
 *
 * WEBP porque `serveImage` ya lo admite, pesa un tercio menos que el JPEG a
 * igualdad de vista y lo lee cualquier navegador vivo.
 *
 *   node scripts/cosecha/3-procesar.mjs            # sólo lo que falte
 *   node scripts/cosecha/3-procesar.mjs --rehacer  # todo otra vez
 */
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { leerEstado } from "./lib/estado.mjs";
import { comprobarDatos, DATOS } from "./lib/rutas.mjs";
import { leerDescartes } from "./lib/web.mjs";

const ORIGINALES = path.join(DATOS, "originales");
const WEB = path.join(DATOS, "web");
const MINI = path.join(DATOS, "mini");

const LADO_WEB = 1600;
const LADO_MINI = 400;

const rehacer = process.argv.includes("--rehacer");

const existe = (f) => stat(f).then(() => true, () => false);

async function derivar(origen, destinoWeb, destinoMini) {
  /* .rotate() sin argumento aplica la orientación EXIF y luego la tira. Sin
     esta llamada, una foto hecha con el móvil de lado sale girada. Y como no
     se llama a .withMetadata(), sharp descarta el resto de metadatos: ahí es
     donde vive el GPS de quien hizo la foto. */
  const base = sharp(origen, { failOn: "error", limitInputPixels: 40e6 }).rotate();

  const info = await base.clone()
    .resize({ width: LADO_WEB, height: LADO_WEB, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 5 })
    .toFile(destinoWeb);

  const mini = await base.clone()
    .resize({ width: LADO_MINI, height: LADO_MINI, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 68, effort: 6 })
    .toFile(destinoMini);

  return { ancho: info.width, alto: info.height, bytes: info.size, bytes_mini: mini.size };
}

async function main() {
  await mkdir(WEB, { recursive: true });
  await mkdir(MINI, { recursive: true });

  const estado = await leerEstado(path.join(DATOS, "estado.ndjson"));

  /* Sólo se procesa lo que sigue teniendo publicación en la lista de trabajo.
     Al limpiar los enlaces que no eran noticias, sus fotos se quedaron en el
     registro sin nada detrás: sin crédito ni enlace, que es justo lo que no
     puede publicarse. El registro no se toca —es el diario de lo que se hizo—,
     pero de aquí no sale nada huérfano. */
  const hoja = JSON.parse(await readFile(path.join(DATOS, "hoja.json"), "utf8"));
  const conPublicacion = new Set(hoja.publicaciones.map((p) => p.url));
  let huerfanasDeLista = 0;
  /* Lo que alguien miró y tiró no vuelve por la puerta de atrás: ni se
     convierte, ni se queda una derivada suelta que luego se suba sin querer. */
  const descartadas = await leerDescartes(path.join(DATOS, "descartes.json"));
  const ficheros = new Map(
    (await readdir(ORIGINALES).catch(() => [])).map((f) => [f.split(".")[0], f]));

  /* Lo que sale en varias publicaciones de municipios distintos no es de
     ninguna de ellas: es del entorno de la red social. Así se cazó un vídeo de
     un gato que Facebook sugería al lado del post y que se coló en ocho de cada
     doce fotos. Con tres se corta: dos publicaciones pueden compartir foto de
     verdad —dos ediciones del mismo periódico, sin ir más lejos—, tres ya no.
     No se borran: se apartan, por si alguna era un cartel oficial repetido. */
  const publicacionesPorFoto = new Map();
  for (const fila of estado.porUrl.values()) {
    if (!conPublicacion.has(fila.url)) { huerfanasDeLista += (fila.fotos ?? []).length; continue; }
    for (const foto of fila.fotos ?? []) {
      if (!publicacionesPorFoto.has(foto.sha256)) publicacionesPorFoto.set(foto.sha256, new Set());
      publicacionesPorFoto.get(foto.sha256).add(fila.url);
    }
  }
  const sospechosas = new Map();

  const fotos = [];
  let hechas = 0, saltadas = 0, rotas = 0, tiradas = 0;

  for (const fila of estado.porUrl.values()) {
    if (!conPublicacion.has(fila.url)) { huerfanasDeLista += (fila.fotos ?? []).length; continue; }
    for (const foto of fila.fotos ?? []) {
      const enCuantas = publicacionesPorFoto.get(foto.sha256)?.size ?? 1;
      if (enCuantas >= 3) {
        sospechosas.set(foto.sha256, [...publicacionesPorFoto.get(foto.sha256)]);
        continue;
      }
      if (descartadas.has(foto.sha256)) {
        for (const f of [path.join(WEB, `${foto.sha256}.webp`), path.join(MINI, `${foto.sha256}.webp`)]) {
          await rm(f, { force: true });
        }
        tiradas++;
        continue;
      }
      const fichero = ficheros.get(foto.sha256);
      if (!fichero) {
        console.log(`✗ falta el original de ${foto.sha256.slice(0, 12)} (${fila.url.slice(0, 60)})`);
        rotas++;
        continue;
      }
      const destinoWeb = path.join(WEB, `${foto.sha256}.webp`);
      const destinoMini = path.join(MINI, `${foto.sha256}.webp`);

      let medidas;
      if (!rehacer && await existe(destinoWeb) && await existe(destinoMini)) {
        const [w, m] = await Promise.all([sharp(destinoWeb).metadata(), stat(destinoMini)]);
        medidas = { ancho: w.width, alto: w.height, bytes: (await stat(destinoWeb)).size, bytes_mini: m.size };
        saltadas++;
      } else {
        try {
          medidas = await derivar(path.join(ORIGINALES, fichero), destinoWeb, destinoMini);
          hechas++;
        } catch (err) {
          console.log(`✗ ${foto.sha256.slice(0, 12)}: ${err.message}`);
          rotas++;
          continue;
        }
      }

      fotos.push({
        sha256: foto.sha256,
        url: fila.url,
        clave_origen: fila.clave,
        orden: foto.orden ?? 0,
        clase: foto.clase ?? "foto",
        alt: foto.alt ?? null,
        origen_url: foto.origen_url ?? null,
        ...medidas,
      });
    }
  }

  await writeFile(path.join(DATOS, "fotos.json"), JSON.stringify(fotos, null, 1), "utf8");

  /* Barrido: en `web/` y `mini/` sólo puede quedar lo que está en fotos.json.
     Una foto descartada a mano, o sustituida al repescar el artículo, deja su
     derivada en disco; y una derivada huérfana es justo la que acaba subida a
     R2 sin que nadie la haya mirado. Se comprueba contra la lista vigente, no
     contra la de descartes, porque así cubre también los cambios de criterio. */
  await writeFile(path.join(DATOS, "sospechosas.json"),
    JSON.stringify(Object.fromEntries(sospechosas), null, 1), "utf8");

  const vigentes = new Set(fotos.map((f) => f.sha256));
  let huerfanas = 0;
  for (const carpeta of [WEB, MINI]) {
    for (const fichero of await readdir(carpeta).catch(() => [])) {
      if (vigentes.has(fichero.split(".")[0])) continue;
      await rm(path.join(carpeta, fichero), { force: true });
      huerfanas++;
    }
  }

  const suma = (k) => fotos.reduce((t, f) => t + (f[k] || 0), 0);
  console.log(`\n${fotos.length} fotos · ${hechas} convertidas · ${saltadas} ya estaban · ` +
    `${tiradas} descartadas a mano · ${rotas} sin salida`);
  if (huerfanas) console.log(`${huerfanas} derivadas huérfanas barridas`);
  if (huerfanasDeLista) {
    console.log(`${huerfanasDeLista} fotos ignoradas: su publicación ya no está en la lista`);
  }
  if (sospechosas.size) {
    console.log(`${sospechosas.size} apartadas por salir en 3 o más publicaciones ` +
      `(ver datos/sospechosas.json)`);
  }
  console.log(`web ${(suma("bytes") / 1e6).toFixed(1)} MB · miniaturas ${(suma("bytes_mini") / 1e6).toFixed(1)} MB` +
    (fotos.length ? ` · miniatura media ${Math.round(suma("bytes_mini") / fotos.length / 1024)} KB` : ""));
}

comprobarDatos();
await main();
