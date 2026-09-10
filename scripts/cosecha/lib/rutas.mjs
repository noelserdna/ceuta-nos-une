/**
 * Dónde vive lo cosechado.
 *
 * Fuera del disco del sistema: son ~800 MB de originales que no caben cómodos
 * en el portátil y que no son nuestros. Si el disco no está montado, esto se
 * para con un aviso claro en vez de ponerse a escribir cientos de megas en el
 * sistema sin que nadie se entere.
 *
 * Se puede cambiar de sitio sin tocar código:  COSECHA_DATOS=/otra/ruta node …
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREDETERMINADO = "/Volumes/1T/fotos_ceutaweb";
const DENTRO_DEL_REPO = path.join(
  path.dirname(fileURLToPath(import.meta.url)), "..", "datos");

export const DATOS = process.env.COSECHA_DATOS ?? PREDETERMINADO;

export function comprobarDatos() {
  if (existsSync(DATOS)) return DATOS;
  if (DATOS === PREDETERMINADO) {
    console.error(`✗ No encuentro ${DATOS}.`);
    console.error("  El disco externo no está montado. Enchúfalo, o di dónde están los");
    console.error(`  datos:  COSECHA_DATOS=${DENTRO_DEL_REPO} node …`);
  } else {
    console.error(`✗ No encuentro ${DATOS} (COSECHA_DATOS).`);
  }
  process.exit(1);
}
