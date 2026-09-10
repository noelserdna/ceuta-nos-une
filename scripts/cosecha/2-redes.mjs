/**
 * Paso 2b de la cosecha: Instagram y Facebook, con el navegador identificado.
 *
 * Sin sesión no hay nada que hacer, y está medido: Instagram enseña el post unos
 * segundos y luego te echa al login, y Facebook contesta 400 a dos de cada tres
 * publicaciones. Así que esto abre un Chrome de verdad con un perfil APARTE —el
 * Chrome del dueño no se toca, ni se copia, ni se lee— y trabaja con la sesión
 * que él mismo abra la primera vez.
 *
 *   node scripts/cosecha/2-redes.mjs --entrar          # identificarse (una vez)
 *   node scripts/cosecha/2-redes.mjs --solo facebook   # 53 publicaciones
 *   node scripts/cosecha/2-redes.mjs --solo instagram --tope 300
 *   node scripts/cosecha/2-redes.mjs --reintentar
 *
 * Sale con código 2 si la red social corta el paso: es una parada, no un fallo.
 * Lo cosechado hasta ese momento está en disco y sirve igual.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { apuntar, leerEstado, yaResuelta } from "./lib/estado.mjs";
import { comprobarDatos, DATOS } from "./lib/rutas.mjs";
import { cosecharPublicacion, estaBloqueado } from "./lib/redes.mjs";

const HOJA = path.join(DATOS, "hoja.json");
const ESTADO = path.join(DATOS, "estado.ndjson");
const ORIGINALES = path.join(DATOS, "originales");
const PERFIL = process.env.PERFIL ?? path.join(os.homedir(), ".cosecha-ceuta", "perfil");

/* El ritmo. No es prudencia de más: una tanda rápida se paga con un bloqueo de
   días, y aquí no hay prisa ninguna. */
const ESPERA_BASE_MS = 8000;
const ESPERA_EXTRA_MS = 7000;
const CADA_CUANTAS_DESCANSA = 40;
/* Chrome no devuelve la memoria de las páginas que ya ha dejado atrás, así que
   en una tanda larga acaba comiéndose la máquina y el sistema mata la cosecha.
   Cerrarlo y volver a abrirlo cada pocas publicaciones la devuelve entera; la
   sesión no se pierde porque vive en el perfil, no en el proceso. */
const RECICLAR_CADA = 20;
const DESCANSO_MS = [180_000, 300_000];
/* Varias seguidas sin traer nada suele querer decir que nos han visto. Con
   Facebook hay que ser menos nervioso: allí volver de vacío es normal —la
   página se pinta distinta en cada visita— y cortar a las tres paraba cosechas
   que iban bien. */
const FALLOS_SEGUIDOS_PARA_PARAR = 6;

const args = process.argv.slice(2);
const opcion = (nombre, def = null) => {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const entrar = args.includes("--entrar");
const reintentar = args.includes("--reintentar");
/* Vuelve a cosechar lo ya cosechado: para cuando lo que ha cambiado es el
   método, no la publicación. */
const rehacer = args.includes("--rehacer");
const solo = opcion("--solo");
const tope = Number(opcion("--tope", 0));
const unaSola = opcion("--url");

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const alAzar = (a, b) => Math.floor(a + Math.random() * (b - a));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function abrirNavegador() {
  await mkdir(PERFIL, { recursive: true });
  /* `channel: "chrome"` usa el Chrome instalado, no el Chromium de Playwright:
     misma huella que un navegador normal, que es lo que menos llama la atención.
     Y headless nunca: un navegador sin ventana se detecta a la primera. */
  return chromium.launchPersistentContext(PERFIL, {
    channel: "chrome",
    headless: false,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    /* 1280 de ancho no es capricho: con menos, la foto de la publicación se
       pinta más pequeña y deja de separarse de las miniaturas de la rejilla,
       que es el criterio con el que se distingue una de otra. */
    viewport: { width: 1280, height: 900 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-features=Translate,MediaRouter",
      "--renderer-process-limit=2",
    ],
  });
}

/** ¿Hay sesión? Se mira en las cookies del perfil, que es lo único que hace
 *  falta saber y no obliga a navegar por encima de lo que el dueño esté
 *  haciendo mientras escribe su contraseña. */
async function sesiones(ctx) {
  const galletas = await ctx.cookies();
  const tiene = (dominio, nombre) => galletas.some(
    (c) => c.domain.includes(dominio) && c.name === nombre && c.value);
  return {
    instagram: tiene("instagram.com", "sessionid"),
    facebook: tiene("facebook.com", "c_user"),
  };
}

async function identificarse() {
  const ctx = await abrirNavegador();
  const page = ctx.pages()[0] ?? await ctx.newPage();
  console.log(`\nPerfil aparte: ${PERFIL}`);
  console.log("Tu Chrome de siempre no se toca: esto es una ventana con su propio perfil.");
  console.log("Entra en Instagram y en Facebook. Nadie más ve lo que escribes.\n");
  await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "domcontentloaded" })
    .catch(() => {});

  /* Se espera mirando las cookies, no pidiendo que pulse una tecla: así el
     dueño sólo tiene que ocuparse del navegador. */
  const HASTA = Date.now() + 20 * 60 * 1000;
  let avisadoIg = false;
  while (Date.now() < HASTA) {
    const { instagram, facebook } = await sesiones(ctx);
    if (instagram && facebook) {
      console.log("\n✓ Instagram   ✓ Facebook");
      console.log(`sesión guardada en ${PERFIL}`);
      await ctx.close();
      return;
    }
    if (instagram && !avisadoIg) {
      avisadoIg = true;
      console.log("✓ Instagram listo. Te llevo a Facebook…");
      await page.goto("https://www.facebook.com/login/", { waitUntil: "domcontentloaded" })
        .catch(() => {});
    }
    await dormir(4000);
  }
  const { instagram, facebook } = await sesiones(ctx);
  console.log(`\n${instagram ? "✓" : "✗"} Instagram   ${facebook ? "✓" : "✗"} Facebook`);
  console.log("Se acabó la espera. Lo que hayas dejado entrado queda guardado.");
  await ctx.close();
}

async function guardarMedios(medios) {
  await mkdir(ORIGINALES, { recursive: true });
  const fotos = [];
  for (const m of medios) {
    const huella = sha(m.bytes);
    await writeFile(path.join(ORIGINALES, `${huella}.${m.ext}`), m.bytes);
    fotos.push({
      sha256: huella, bytes: m.bytes.length, ext: m.ext,
      clase: m.clase, alt: m.alt, origen_url: m.origen_url, orden: m.orden,
    });
  }
  return fotos;
}

async function main() {
  if (entrar) return identificarse();

  const hoja = JSON.parse(await readFile(HOJA, "utf8"));
  const estado = await leerEstado(ESTADO);

  const deRedes = (p) => ["ig_post", "ig_reel", "fb_post"].includes(p.forma);
  const deLaTanda = (p) => !solo || (solo === "instagram" ? p.forma.startsWith("ig")
    : solo === "facebook" ? p.forma.startsWith("fb") : p.forma === solo);

  let pendientes = hoja.publicaciones
    .filter(deRedes)
    .filter(deLaTanda)
    .filter((p) => (unaSola ? p.url === unaSola
      : rehacer || !yaResuelta(estado, p.url, { reintentar })));

  /* Facebook antes que Instagram cuando se piden las dos: Instagram es el único
     que puede cortar, y si corta conviene tener lo demás ya en disco. */
  pendientes.sort((a, b) => a.forma.localeCompare(b.forma));
  if (tope) pendientes = pendientes.slice(0, tope);

  if (!pendientes.length) {
    console.log("no queda nada por cosechar con esos filtros");
    return;
  }
  console.log(`${pendientes.length} publicaciones por cosechar` +
    (tope ? ` (tope de esta tanda)` : "") + `\nperfil: ${PERFIL}\n`);

  let ctx = await abrirNavegador();
  let page = ctx.pages()[0] ?? await ctx.newPage();

  /* Si la sesión se ha caído, mejor saberlo antes de gastar la primera visita. */
  await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" }).catch(() => {});
  if (await estaBloqueado(page)) {
    console.error("✗ la sesión no está abierta. Ejecuta primero:  node scripts/cosecha/2-redes.mjs --entrar");
    await ctx.close();
    process.exitCode = 2;
    return;
  }

  const cuenta = {};
  let seguidos = 0, hechas = 0;
  for (const pub of pendientes) {
    let fila;
    try {
      const salida = await cosecharPublicacion(page, pub);
      fila = salida.medios
        ? { ...salida, fotos: await guardarMedios(salida.medios), medios: undefined }
        : salida;
      seguidos = salida.estado === "ok" ? 0 : seguidos + 1;
    } catch (err) {
      if (err.bloqueo) {
        await apuntar(ESTADO, { url: pub.url, clave: pub.clave, forma: pub.forma,
          estado: "bloqueado", nota: err.message });
        console.error(`\n✋ ${err.message}`);
        console.error(`   Cosechadas ${hechas} en esta tanda. Lo bajado está en disco y sirve igual.`);
        console.error("   Deja pasar un día y vuelve con --tope 120. No insistas ahora:");
        console.error("   insistir es lo que convierte un corte de horas en uno de días.");
        await ctx.close();
        process.exitCode = 2;
        return;
      }
      fila = { estado: "fallo", nota: `${err.name}: ${err.message}`.slice(0, 200) };
      seguidos++;
    }

    delete fila.medios;
    cuenta[fila.estado] = (cuenta[fila.estado] ?? 0) + 1;
    await apuntar(ESTADO, { url: pub.url, clave: pub.clave, forma: pub.forma, ...fila });
    hechas++;

    const marca = fila.estado === "ok" ? "✓" : fila.estado === "fallo" ? "✗" : "·";
    const cuantas = fila.fotos?.length ? ` ${fila.fotos.length} img` : "";
    console.log(`${marca} ${String(hechas).padStart(3)}/${pendientes.length} ${fila.estado.padEnd(10)}` +
      `${cuantas.padEnd(7)} ${pub.url.slice(0, 66)}`);

    if (seguidos >= FALLOS_SEGUIDOS_PARA_PARAR) {
      console.error(`\n✋ ${seguidos} publicaciones seguidas sin traer nada: eso no es mala suerte.`);
      console.error("   Se para aquí. Mira una a mano en el navegador antes de volver.");
      await ctx.close();
      process.exitCode = 2;
      return;
    }

    if (hechas % RECICLAR_CADA === 0 && hechas < pendientes.length) {
      await ctx.close();
      ctx = await abrirNavegador();
      page = ctx.pages()[0] ?? await ctx.newPage();
    }

    if (hechas % CADA_CUANTAS_DESCANSA === 0 && hechas < pendientes.length) {
      const descanso = alAzar(...DESCANSO_MS);
      console.log(`   … descanso de ${Math.round(descanso / 60000)} min (llevamos ${hechas})`);
      await dormir(descanso);
    } else {
      await dormir(ESPERA_BASE_MS + Math.random() * ESPERA_EXTRA_MS);
    }
  }

  await ctx.close();
  console.log("\nresumen: " + Object.entries(cuenta).map(([k, v]) => `${k} ${v}`).join(" · "));
}

comprobarDatos();
await main();
