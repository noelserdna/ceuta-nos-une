-- El cruce de las dos listas, guardado.
--
-- La hoja de cálculo lee un CSV con las convocatorias nuestras y las de
-- porceuta.es ya cruzadas. Ese cruce cuesta unos 18 ms de CPU: demasiado para
-- calcularlo en cada visita, pero nada para un Cron Trigger, que dispone de 30
-- segundos. Así que el cron lo hace una vez por hora y lo deja aquí, y la ruta
-- que sirve el CSV sólo tiene que leer una fila.
--
-- Dos tablas y no una porque resuelven cosas distintas: `copias` guarda la
-- última respuesta buena de porceuta, para que si su API cae el cruce siguiente
-- no pierda 122 convocatorias de golpe; `vuelcos` guarda el CSV ya montado.

CREATE TABLE copias (
  clave    TEXT PRIMARY KEY,
  json     TEXT NOT NULL,
  guardado TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE vuelcos (
  clave    TEXT PRIMARY KEY,
  csv      TEXT NOT NULL,
  filas    INTEGER NOT NULL,
  suyas    INTEGER NOT NULL,
  -- 0 cuando el cruce se hizo con la copia guardada porque su API no respondió.
  al_dia   INTEGER NOT NULL DEFAULT 1,
  generado TEXT NOT NULL DEFAULT (datetime('now'))
);
