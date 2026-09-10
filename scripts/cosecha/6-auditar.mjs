/**
 * Paso 6: auditar lo cosechado antes de importarlo.
 *
 * Revisar a ojo pregunta «¿es del acto?». Esto pregunta otra cosa: «¿hay algo que
 * no queremos publicar?», y lo pregunta por escrito, con evidencia, para que la
 * decisión la tome una persona sabiendo por qué salta cada aviso.
 *
 * Mira en cuatro sitios a la vez: el texto pintado DENTRO de la imagen (el OCR,
 * que es donde está una pancarta o el logo de un partido), el pie de la
 * publicación, lo que anotó quien la encontró, y quién la publica. Y a la imagen
 * misma: si está casi vacía o si es la misma que otra de otro pueblo.
 *
 * Las categorías siguen la línea que este proyecto ya trazó: nada de odio; nada
 * que presente como ciudadano lo que convoca un partido (migración 0011); nada de
 * lo que no tengamos derecho a publicar; y cuidado con los datos de particulares.
 *
 *   node scripts/cosecha/6-auditar.mjs && open <datos>/auditoria.html
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { leerEstado } from "./lib/estado.mjs";
import { comprobarDatos, DATOS } from "./lib/rutas.mjs";

comprobarDatos();

const sinAcentos = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");

/* ------------------------------------------------------------------ reglas --
   Cada regla dice dónde mira. Lo que aparece DENTRO de la imagen pesa más que lo
   que aparece en el pie: el pie capturado de una red social arrastra a veces el
   primer comentario, y un comentario ajeno no es la publicación. */
const REGLAS = [
  // --- odio y xenofobia: lo único que no admite discusión --------------------
  { cat: "odio", grave: true, en: ["imagen", "pie", "notas"],
    re: /\bmoros?\b(?! y cristianos)|\bmoracos?\b|\bmoritos?\b/i, que: "insulto étnico" },
  { cat: "odio", grave: true, en: ["imagen", "pie", "notas"],
    re: /invasi[oó]n|invasores?|\binvadid|reconquista|remigraci|islamizaci|\byihad/i,
    que: "discurso de invasión o reconquista" },
  { cat: "odio", grave: true, en: ["imagen", "pie", "notas"],
    re: /\bfuera\b.{0,25}(moro|marroqu|inmigr|ilegal|menas?\b)|(moro|marroqu|inmigr|menas?\b).{0,25}\bfuera\b/i,
    que: "consigna de expulsión" },
  { cat: "odio", grave: true, en: ["imagen"],
    re: /\b(puta|putos?|mierda|cabr[oó]n|escoria|basura)\b/i, que: "insulto en la imagen" },
  { cat: "fiesta", grave: false, en: ["imagen", "pie", "notas"],
    re: /moros y cristianos/i, que: "fiestas de moros y cristianos: no es el acto" },

  // --- partidos: la línea de la migración 0011 -------------------------------
  // En mayúsculas y con límite de palabra: «PP» y «VOX» en un cartel son siglas;
  // «podemos» en minúscula es un verbo.
  { cat: "partido", grave: true, en: ["imagen"], sensible: true,
    re: /\bPP\b|\bVOX\b|\bPSOE\b|\bNNGG\b|\bSUMAR\b|\bPODEMOS\b|\bJUNTS\b|\bERC\b|\bPNV\b|\bBILDU\b/,
    que: "siglas de partido dentro de la imagen" },
  { cat: "partido", grave: true, en: ["imagen", "pie", "notas", "credito"],
    re: /partido popular|nuevas generaciones|partido socialista|grupo municipal/i,
    que: "nombre de partido o grupo municipal" },
  { cat: "partido", grave: false, en: ["pie", "notas"],
    re: /\bel pp\b|\bdel pp\b|\bvox\b|\bpsoe\b|\bnngg\b/i, que: "menciona un partido" },

  // --- derechos --------------------------------------------------------------
  { cat: "derechos", grave: true, en: ["imagen", "credito"],
    re: /\bEFE\b|europa press|reuters|\bAFP\b|getty|shutterstock|alamy|©|copyright/i,
    que: "agencia o marca de agua" },

  // --- datos de particulares -------------------------------------------------
  { cat: "datos", grave: false, en: ["imagen"],
    re: /\b[67]\d{2}[ .]?\d{3}[ .]?\d{3}\b/, que: "número de móvil" },
  { cat: "datos", grave: false, en: ["imagen"],
    re: /[\w.-]+@(gmail|hotmail|yahoo|outlook|icloud)\.\w+/i, que: "correo de particular" },
  { cat: "datos", grave: true, en: ["imagen"], re: /\b\d{8}[ -]?[A-Z]\b/, que: "posible DNI" },
];

/** El fragmento que rodea la coincidencia, para ver de un vistazo el contexto. */
function evidencia(texto, re) {
  const m = texto.match(re);
  if (!m) return null;
  const i = m.index ?? 0;
  return (i > 40 ? "…" : "") + texto.slice(Math.max(0, i - 40), i + m[0].length + 60).trim() + "…";
}

/* dHash: la huella de cómo se reparte la luz en la imagen. Dos fotos iguales
   —aunque se hayan recomprimido o cambiado de tamaño— dan huellas casi iguales. */
async function huella(ruta) {
  const px = await sharp(ruta).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return bits;
}
const distancia = (a, b) => {
  let x = a ^ b, n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
};

async function main() {
  const fotos = JSON.parse(await readFile(path.join(DATOS, "fotos.json"), "utf8"));
  const hoja = JSON.parse(await readFile(path.join(DATOS, "hoja.json"), "utf8"));
  const estado = await leerEstado(path.join(DATOS, "estado.ndjson"));
  const ocr = new Map();
  for (const l of (await readFile(path.join(DATOS, "ocr.ndjson"), "utf8")).split("\n")) {
    if (!l.trim()) continue;
    const o = JSON.parse(l);
    ocr.set(o.sha256, o.texto ?? "");
  }

  const pubs = new Map(hoja.publicaciones.map((p) => [p.url, p]));
  const vinculos = new Map();
  for (const v of hoja.vinculos) {
    if (v.tipo === "descartada") continue;
    if (!vinculos.has(v.url)) vinculos.set(v.url, []);
    vinculos.get(v.url).push(v);
  }

  const informe = [];
  const huellas = [];

  for (const [n, f] of fotos.entries()) {
    const pub = pubs.get(f.url) ?? {};
    const vins = vinculos.get(f.url) ?? [];
    const textos = {
      imagen: ocr.get(f.sha256) ?? "",
      pie: estado.porUrl.get(f.url)?.texto ?? estado.porUrl.get(f.url)?.titulo ?? "",
      notas: vins.map((v) => v.notas ?? "").join(" · "),
      credito: [pub.credito, pub.medio, pub.cuenta].filter(Boolean).join(" · "),
    };

    const avisos = [];
    for (const r of REGLAS) {
      for (const donde of r.en) {
        const t = r.sensible ? textos[donde] : sinAcentos(textos[donde]);
        const re = r.sensible ? r.re : new RegExp(sinAcentos(r.re.source), r.re.flags);
        const ev = evidencia(t, re);
        if (ev) { avisos.push({ cat: r.cat, grave: r.grave, que: r.que, donde, ev }); break; }
      }
    }

    // Quién publica: una cuenta que no es de ninguna institución es de alguien.
    if (["instagram", "facebook"].includes(pub.red) &&
        !/ayunt|ayto|concello|ajuntament|udal|oficial|consistori|diputaci|cabildo|mancomun|\bcity\b|ciutat/i
          .test(sinAcentos(textos.credito))) {
      avisos.push({ cat: "derechos", grave: false, que: "cuenta que no es de una institución",
        donde: "credito", ev: textos.credito.slice(0, 120) });
    }
    if (pub.licencia === "agencia") {
      avisos.push({ cat: "derechos", grave: true, que: "clasificada como foto de agencia",
        donde: "credito", ev: textos.credito.slice(0, 120) });
    }

    // Una galería de prensa que documenta varios pueblos: la foto puede ser de otro.
    const municipios = [...new Set(vins.map((v) => v.municipio))];
    if (municipios.length >= 3) {
      avisos.push({ cat: "atribucion", grave: false,
        que: `la misma publicación documenta ${municipios.length} municipios`,
        donde: "notas", ev: municipios.slice(0, 5).map((m) => m.split("|")[0]).join(", ") });
    }

    // La imagen misma: casi vacía, o demasiado pequeña para decir nada.
    const ruta = path.join(DATOS, "web", `${f.sha256}.webp`);
    try {
      const st = await sharp(ruta).stats();
      if (st.entropy < 3.2) {
        avisos.push({ cat: "calidad", grave: false, que: `imagen casi vacía (entropía ${st.entropy.toFixed(1)})`,
          donde: "imagen", ev: textos.imagen.slice(0, 80) || "sin texto" });
      }
      huellas.push({ n, h: await huella(ruta), municipios });
    } catch {
      avisos.push({ cat: "calidad", grave: true, que: "no se puede leer la imagen", donde: "imagen", ev: "" });
    }

    informe.push({
      n, sha256: f.sha256, url: f.url, red: pub.red, credito: pub.credito,
      municipios: municipios.map((m) => m.replace("|", " · ")), avisos,
      ocr: textos.imagen.slice(0, 300),
    });
  }

  // La misma imagen en publicaciones de pueblos distintos: una de las dos está
  // atribuida a quien no es, salvo que sea el cartel común de la FEMP.
  for (let i = 0; i < huellas.length; i++) {
    for (let j = i + 1; j < huellas.length; j++) {
      const a = huellas[i], b = huellas[j];
      if (distancia(a.h, b.h) > 5) continue;
      const comun = a.municipios.some((m) => b.municipios.includes(m));
      if (comun) continue;
      for (const [x, y] of [[a, b], [b, a]]) {
        informe[x.n].avisos.push({ cat: "atribucion", grave: false,
          que: "la misma imagen aparece en otro municipio", donde: "imagen",
          ev: `igual que la ${y.n} (${y.municipios.map((m) => m.split("|")[0]).join(", ")})` });
      }
    }
  }

  await writeFile(path.join(DATOS, "auditoria.json"), JSON.stringify(informe, null, 1), "utf8");

  const cuenta = {};
  for (const r of informe) for (const a of r.avisos) {
    const k = `${a.cat}${a.grave ? " (grave)" : ""}`;
    cuenta[k] = (cuenta[k] ?? 0) + 1;
  }
  const conAviso = informe.filter((r) => r.avisos.length);
  console.log(`${informe.length} fotos auditadas · ${conAviso.length} con algún aviso`);
  for (const [k, v] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(v).padStart(4)}  ${k}`);
  }
}

await main();
