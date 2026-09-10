#!/bin/bash
# Cosecha Instagram en tandas cortas, cada una en su propio proceso.
#
# Chrome no devuelve del todo la memoria mientras vive, y en esta máquina una
# tanda larga acaba con el proceso muerto a mitad. Un proceso por tanda la
# devuelve entera al terminar, y como el registro es reanudable, encadenarlas
# equivale a una tanda larga sin el riesgo.
#
#   bash scripts/cosecha/tandas.sh [cuántas tandas] [tamaño]
cd "$(dirname "$0")/../.." || exit 1
TANDAS=${1:-22}
TAM=${2:-25}
for i in $(seq 1 "$TANDAS"); do
  echo "── tanda $i/$TANDAS ─────────────────────────"
  # Se filtra el ruido, pero NUNCA los errores: veinte tandas seguidas fallaron
  # en silencio porque el grep sólo dejaba pasar las líneas de éxito, y desde
  # fuera eso se ve igual que «no había nada que cosechar».
  node scripts/cosecha/2-redes.mjs --solo instagram --tope "$TAM" 2>&1 \
    | grep -E "^[✓·✗]|resumen|✋|Error|error|no queda"
  salida=${PIPESTATUS[0]}
  if [ "$salida" = "2" ]; then
    echo "✋ parada pedida por el cosechador; no se encadena más"
    exit 2
  fi
  pendientes=$(node --input-type=module -e '
    import { readFile } from "node:fs/promises";
    import { DATOS } from "./scripts/cosecha/lib/rutas.mjs";
    import { leerEstado, yaResuelta } from "./scripts/cosecha/lib/estado.mjs";
    const hoja = JSON.parse(await readFile(`${DATOS}/hoja.json`, "utf8"));
    const estado = await leerEstado(`${DATOS}/estado.ndjson`);
    // Se pregunta con la MISMA función que usa el cosechador: si se cuenta con
    // otra regla, el contador y la cosecha dicen cosas distintas.
    console.log(hoja.publicaciones
      .filter((p) => p.forma.startsWith("ig") && !yaResuelta(estado, p.url)).length);
  ')
  echo "   quedan $pendientes publicaciones de Instagram"
  [ "$pendientes" = "0" ] && break
  sleep 45
done
