/**
 * Paso 5: subir lo cosechado a R2 y anotarlo en la base.
 *
 * Va por la puerta de /admin y en lotes: cada envío lleva las fotos y el JSON
 * que dice de quién es cada una, a qué municipios documenta y de dónde salió.
 * El servidor comprueba la huella antes de subir un solo byte, así que repetir
 * este paso no duplica nada: lo ya subido sale como «saltada».
 *
 *   node scripts/cosecha/5-importar.mjs --destino local        # wrangler dev
 *   COSECHA_TOKEN=… node scripts/cosecha/5-importar.mjs --destino worker  # producción
 *   node scripts/cosecha/5-importar.mjs --tope 20              # una cata
 *
 * Antes hay que abrir la puerta en /admin: `cosecha_abierta = 1`. Y cerrarla al
 * terminar, que es parte del trabajo, no un adorno.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { leerEstado } from "./lib/estado.mjs";
import { comprobarDatos, DATOS } from "./lib/rutas.mjs";


const DESTINOS = {
  local: "http://127.0.0.1:8787",
  es: "https://ceutanosune.es",
  worker: "https://ceuta-nos-une.andresleontest.workers.dev",
};

/* Vercel corta los cuerpos grandes, así que los lotes van cortos: mejor más
   envíos que uno rechazado a mitad. */
const POR_LOTE = 8;

const args = process.argv.slice(2);
const opcion = (n, def = null) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const destino = DESTINOS[opcion("--destino", "local")] ?? opcion("--destino");
const tope = Number(opcion("--tope", 0));
const clave = opcion("--clave") ?? process.env.ADMIN_PASSWORD;
/* La llave de la importación (secreto COSECHA_TOKEN del Worker). Con ella no
   hace falta la contraseña de /admin, que es de una persona. */
const llave = process.env.COSECHA_TOKEN;

/** Las cabeceras con las que se identifica cada envío. */
async function entrar() {
  if (llave) return { authorization: `Bearer ${llave}` };
  if (!clave) throw new Error("falta la llave (COSECHA_TOKEN) o la contraseña de admin (ADMIN_PASSWORD)");
  const res = await fetch(`${destino}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: clave }),
  });
  if (!res.ok) throw new Error(`no se pudo entrar en /admin: ${res.status}`);
  const galleta = res.headers.get("set-cookie");
  if (!galleta) throw new Error("el login no devolvió sesión");
  return { cookie: galleta.split(";")[0] };
}

async function main() {
  const hoja = JSON.parse(await readFile(path.join(DATOS, "hoja.json"), "utf8"));
  const fotos = JSON.parse(await readFile(path.join(DATOS, "fotos.json"), "utf8"));
  const estado = await leerEstado(path.join(DATOS, "estado.ndjson"));

  const municipios = new Map(hoja.municipios.map((m) => [`${m.municipio}|${m.provincia}`, m]));
  const publicaciones = new Map(hoja.publicaciones.map((p) => [p.url, p]));
  const vinculosPorUrl = new Map();
  for (const v of hoja.vinculos) {
    if (!vinculosPorUrl.has(v.url)) vinculosPorUrl.set(v.url, []);
    vinculosPorUrl.get(v.url).push(v);
  }

  /* Una foto sin crédito o sin enlace no se sube: la base tampoco la admitiría,
     pero es mejor no gastar el viaje ni dejar un objeto suelto en R2. */
  const listas = fotos.filter((f) => publicaciones.get(f.url)?.credito);
  const sinCredito = fotos.length - listas.length;
  const aSubir = tope ? listas.slice(0, tope) : listas;

  console.log(`${aSubir.length} fotos por subir a ${destino}` +
    (sinCredito ? ` · ${sinCredito} descartadas por no tener crédito` : ""));

  const identidad = await entrar();
  const cuenta = {};

  for (let i = 0; i < aSubir.length; i += POR_LOTE) {
    const tanda = aSubir.slice(i, i + POR_LOTE);
    const form = new FormData();
    const lote = [];

    for (const [n, f] of tanda.entries()) {
      const pub = publicaciones.get(f.url);
      const vins = vinculosPorUrl.get(f.url) ?? [];
      const fila = estado.porUrl.get(f.url);

      lote.push({
        municipios: vins.map((v) => {
          const m = municipios.get(v.municipio) ?? {};
          return {
            // El nombre para enseñar; la clave de cruce va aparte y no cambia.
            municipio: m.nombre ?? m.municipio, provincia: m.provincia_nombre ?? m.provincia,
            ccaa: m.ccaa ?? null,
            clave: m.clave, ine: m.ine ?? null, poblacion: m.poblacion ?? null,
            lat: m.lat ?? null, lon: m.lon ?? null, origen_pto: m.origen_pto ?? null,
            tipo: v.tipo, lugar: v.lugar ?? null, notas: v.notas ?? null,
          };
        }).filter((m) => m.clave),
        publicacion: {
          url: pub.url, red: pub.red, forma: pub.forma, cuenta: pub.cuenta ?? null,
          medio: pub.medio ?? null, credito: pub.credito,
          /* El texto capturado al cosechar NO se sube, y no por pereza: la
             auditoría encontró que arrastra los comentarios de desconocidos
             debajo de la publicación y, en Facebook, la columna de accesos
             directos de la cuenta con la que se cosechó —es decir, lo que sigue
             en Facebook quien hizo la cosecha—. Nada de eso es de la
             publicación ni debe acabar en la base. Se queda en el disco de la
             cosecha, que es para auditar, y la web enseña crédito y enlace. */
          pie: null,
          fecha_pub: fila?.fecha_pub ?? null,
          hay_video: fila?.hay_video ?? pub.hay_video ?? 0,
          licencia: pub.licencia ?? "sin_clasificar",
          convocante: pub.convocante ?? null,
        },
        foto: {
          sha256: f.sha256, orden: f.orden ?? 0, clase: f.clase ?? "foto",
          // Las calculó sharp al procesar; el servidor las usa si no sabe leerlas.
          ancho: f.ancho ?? null, alto: f.alto ?? null,
          alt: f.alt ?? null, origen_url: f.origen_url ?? null,
        },
      });

      const grande = await readFile(path.join(DATOS, "web", `${f.sha256}.webp`));
      const mini = await readFile(path.join(DATOS, "mini", `${f.sha256}.webp`));
      form.append(`f${n}`, new Blob([grande], { type: "image/webp" }), `${f.sha256}.webp`);
      form.append(`f${n}m`, new Blob([mini], { type: "image/webp" }), `${f.sha256}-m.webp`);
    }

    form.append("lote", JSON.stringify(lote));
    const res = await fetch(`${destino}/api/admin/cosecha`, {
      method: "POST", headers: identidad, body: form,
    });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`✗ lote ${i / POR_LOTE + 1}: ${res.status} ${cuerpo.error ?? ""}`);
      if (res.status === 403) return;   // la puerta está cerrada: no insistir
      continue;
    }
    for (const [k, v] of Object.entries(cuerpo.cuenta ?? {})) cuenta[k] = (cuenta[k] ?? 0) + v;
    const hechas = Math.min(i + POR_LOTE, aSubir.length);
    console.log(`  ${String(hechas).padStart(4)}/${aSubir.length}  ` +
      Object.entries(cuerpo.cuenta ?? {}).map(([k, v]) => `${k} ${v}`).join(" · "));
  }

  console.log("\nresumen: " + Object.entries(cuenta).map(([k, v]) => `${k} ${v}`).join(" · "));
  // Con la misma identidad del envío: la llave abre también el recuento.
  const recuento = await fetch(`${destino}/api/admin/cosecha/recuento`, { headers: identidad });
  console.log("recuento R2 ↔ base: " + (recuento.ok ? JSON.stringify(await recuento.json()) : recuento.status));
}

comprobarDatos();
await main();
