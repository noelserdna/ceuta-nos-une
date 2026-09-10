/**
 * El registro de la cosecha: NDJSON que sólo crece.
 *
 * Append-only y una línea por publicación porque un Ctrl-C a mitad no puede
 * corromper lo ya escrito, y porque `wc -l` dice cuánto llevas sin abrir nada.
 * Al arrancar se lee entero y se salta lo que ya tenga un veredicto firme: eso
 * es todo el mecanismo de reanudación, y no hace falta más.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Veredictos que no se vuelven a intentar. `fallo` sí, con --reintentar. */
const FIRMES = new Set(["ok", "sin_medios", "solo_pagina", "privado", "404", "saltado"]);

/* Lo marcado a mano para rehacer vuelve siempre, sin pedir --reintentar: se
   apunta precisamente cuando lo cosechado ya no vale y hay que repetirlo. Sin
   esto, marcarlo tenía el efecto contrario y las dejaba fuera. */
const A_REHACER = new Set(["rehacer"]);

export async function leerEstado(ruta) {
  let crudo = "";
  try {
    crudo = await readFile(ruta, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    return { porUrl: new Map(), lineas: 0 };
  }
  const porUrl = new Map();
  let lineas = 0;
  for (const linea of crudo.split("\n")) {
    if (!linea.trim()) continue;
    lineas++;
    try {
      const fila = JSON.parse(linea);
      // La última línea de una URL manda: un reintento pisa al fallo anterior.
      porUrl.set(fila.url, fila);
    } catch {
      // Una línea rota (corte de luz a media escritura) no puede tirar la cosecha.
    }
  }
  return { porUrl, lineas };
}

export function yaResuelta(estado, url, { reintentar = false, tambien = [] } = {}) {
  const fila = estado.porUrl.get(url);
  if (!fila) return false;
  // `tambien` reabre veredictos firmes cuando cambia el criterio con el que se
  // dieron: si hoy se acepta una foto que ayer se descartó por pequeña, hay que
  // poder volver sobre las descartadas sin borrar el registro.
  if (A_REHACER.has(fila.estado)) return false;
  if (tambien.includes(fila.estado)) return false;
  if (FIRMES.has(fila.estado)) return true;
  return !reintentar;
}

export async function apuntar(ruta, fila) {
  await mkdir(dirname(ruta), { recursive: true });
  await appendFile(ruta, JSON.stringify({ t: new Date().toISOString(), ...fila }) + "\n", "utf8");
}
