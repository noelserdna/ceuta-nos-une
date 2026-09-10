/** Hojas de contactos numeradas, para revisar la cosecha a ojo. */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const D = "/Volumes/1T/fotos_ceutaweb";
const args = process.argv.slice(2);
const desde = Number(args[0] ?? 0);
const hasta = Number(args[1] ?? Infinity);
const prefijo = args[2] ?? "hoja";
const todas = JSON.parse(await readFile(`${D}/fotos.json`, "utf8"));
// Se conserva el número global de cada foto: es con lo que luego se señala.
const fotos = todas.map((f, i) => ({ ...f, n: i })).filter((f) => f.n >= desde && f.n <= hasta);
const L = 175, COLS = 12, FILAS = 6, POR_HOJA = COLS * FILAS;

for (let h = 0; h * POR_HOJA < fotos.length; h++) {
  const trozo = fotos.slice(h * POR_HOJA, (h + 1) * POR_HOJA);
  const alto = Math.ceil(trozo.length / COLS) * L;
  const piezas = await Promise.all(trozo.map(async (f, i) => ({
    input: await sharp(`${D}/mini/${f.sha256}.webp`).resize(L, L, { fit: "cover" }).toBuffer(),
    left: (i % COLS) * L, top: Math.floor(i / COLS) * L,
  })));
  // El número global de cada foto, encima: sin él no se puede señalar cuál es.
  const etiquetas = trozo.map((_, i) => {
    const x = (i % COLS) * L + 3, y = Math.floor(i / COLS) * L + 15;
    return `<rect x="${x - 2}" y="${y - 12}" width="34" height="15" fill="#000" opacity="0.65"/>` +
      `<text x="${x}" y="${y}" font-family="monospace" font-size="12" fill="#fff">${trozo[i].n}</text>`;
  }).join("");
  const overlay = Buffer.from(
    `<svg width="${COLS * L}" height="${alto}">${etiquetas}</svg>`);

  await sharp({ create: { width: COLS * L, height: alto, channels: 3, background: "#1a1a1a" } })
    .composite([...piezas, { input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 72 })
    .toFile(`${D}/${prefijo}-${String(h).padStart(2, "0")}.jpg`);
}
console.log(`${Math.ceil(fotos.length / POR_HOJA)} hojas de ${POR_HOJA} · ${fotos.length} fotos`);
