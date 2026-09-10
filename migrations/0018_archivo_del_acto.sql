-- El archivo gráfico del 2 de septiembre.
--
-- La web deja de contar dónde y a qué hora es la concentración —eso ya pasó— y
-- pasa a guardar lo que se vio: carteles, fotos y vídeos, municipio a municipio.
--
-- Tablas nuevas y no `places` por tres razones, todas duras. `places` tiene
-- `venue`, `address` y `event_time` NOT NULL, y 765 municipios documentados sin
-- plaza ni hora obligarían a inventarse los datos. `places` alimenta
-- /api/places, /lugares, el CSV, el sitemap y el cruce con porceuta.es, así que
-- meter ahí 765 filas cambia los recuentos de todo eso y estropea la
-- comprobación «403/93» que este proyecto usa como red contra las
-- duplicaciones. Y sobre todo: un municipio documentado no es una convocatoria
-- aprobada. Son dos cosas distintas y conviene que sigan siéndolo.
--
-- Aquí no hay ni un INSERT de datos, y es a propósito. El 30/08/2026 una
-- reaplicación de migraciones en remoto duplicó 325 lugares y 7 mensajes del
-- muro porque las migraciones de datos llevan INSERT sin protección. Con sólo
-- CREATE TABLE, una reaplicación falla con «table already exists» y no corrompe
-- nada. Los datos entran por el endpoint de importación, que sí sabe repetirse
-- sin duplicar.

-- ---------------------------------------------------------------------------
-- Los municipios del mapa nuevo. Uno por fila.
-- ---------------------------------------------------------------------------
CREATE TABLE municipios_acto (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  municipio TEXT NOT NULL,          -- como lo publica su fuente: «Hospitalet de Llobregat, L'»
  provincia TEXT NOT NULL,
  ccaa      TEXT,
  -- Nombre normalizado + provincia, tal y como los deja src/union.ts. Es lo que
  -- hace que «A Coruña» y «Coruña, A» sean el mismo sitio, y lo que impide que
  -- entren dos veces cuando la misma concentración llega por dos fuentes.
  clave     TEXT NOT NULL,
  ine       TEXT,                   -- código del Registro de Entidades Locales
  poblacion INTEGER,
  lat REAL,
  lon REAL,
  -- De dónde salió el punto: 'places', 'porceuta' o 'a mano'. Sin esto, una
  -- coordenada mala no hay por dónde rastrearla, y en este proyecto ya ha habido
  -- dos a 88 km de su municipio (ver la cabecera de src/union.ts).
  origen_pto TEXT,
  place_id  INTEGER REFERENCES places(id) ON DELETE SET NULL,
  -- El mapa sólo pinta los publicados. Nace apagado: un municipio se enciende
  -- cuando tiene al menos una foto comprobada, no cuando entra su fila.
  publicado INTEGER NOT NULL DEFAULT 0,
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_municipios_acto_clave ON municipios_acto (clave);
CREATE INDEX idx_municipios_acto_mapa ON municipios_acto (publicado, provincia, municipio);

-- ---------------------------------------------------------------------------
-- Una fila por PUBLICACIÓN, no por municipio.
--
-- Hace falta porque hay galerías de prensa que cubren once pueblos de una vez:
-- si se guardara una fila por municipio, se visitaría once veces la misma
-- página y se guardarían once copias del mismo JPEG.
-- ---------------------------------------------------------------------------
CREATE TABLE publicaciones (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  url    TEXT NOT NULL,          -- normalizada: sin utm_, sin igsh, con barra final
  red    TEXT NOT NULL,          -- instagram | facebook | prensa | web_oficial
  forma  TEXT NOT NULL,          -- ig_post | ig_reel | fb_post | fb_pagina | articulo
  cuenta TEXT,                   -- '@aytobalanegra' o el dominio del medio
  medio  TEXT,
  -- Ni el crédito ni el enlace pueden faltar: son fotos de otros. Una foto sin
  -- autoría o sin enlace a su publicación no se pinta en ningún sitio, y la
  -- forma de garantizarlo es que la base no la admita.
  credito TEXT NOT NULL,
  pie     TEXT,                  -- el texto de la publicación, capturado al cosechar
  fecha_pub TEXT,
  hay_video INTEGER NOT NULL DEFAULT 0,
  -- Para poder cambiar de criterio por clase sin volver a cosechar: las de
  -- agencia (EFE, Europa Press) no se publican igual que las de un ayuntamiento
  -- hablando de su propio acto.
  licencia TEXT NOT NULL DEFAULT 'sin_clasificar',
  -- Quién firma o convoca cuando NO es la institución: «PP de Lena». Se decidió
  -- publicar también lo que firma un partido, pero diciéndolo: la web se
  -- presenta como ciudadana, y un cartel del PP sin su firma al lado pasaría
  -- por lo que no es. NULL = lo publica o convoca la propia institución.
  convocante TEXT,
  -- NULL = viva. Con texto, retirada: el motivo y la fecha. Se marca y no se
  -- borra la fila, para poder decir cuándo se retiró y por qué.
  retirada TEXT,
  creado  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_publicaciones_url ON publicaciones (url);
-- El índice que hace instantáneo «retira todo lo de esta cuenta».
CREATE INDEX idx_publicaciones_fuente ON publicaciones (red, cuenta);

-- ---------------------------------------------------------------------------
-- El vínculo entre las dos. Una publicación puede documentar varios municipios
-- y un municipio tener varias publicaciones.
-- ---------------------------------------------------------------------------
CREATE TABLE publicacion_municipio (
  publicacion_id INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  municipio_id   INTEGER NOT NULL REFERENCES municipios_acto(id) ON DELETE CASCADE,
  tipo  TEXT NOT NULL,   -- cartel | acto | cartel_y_acto | prensa | solo_pagina
  lugar TEXT,
  -- Lo que anotó quien la encontró. NO es el pie de la publicación: sirve para
  -- cotejar que lo cosechado es de verdad de este municipio.
  notas TEXT,
  PRIMARY KEY (publicacion_id, municipio_id)
);
CREATE INDEX idx_publicacion_municipio ON publicacion_municipio (municipio_id, tipo);

-- ---------------------------------------------------------------------------
-- Las copias guardadas. Una fila por imagen: el carrusel de una publicación son
-- varias filas de la misma, distinguidas por `orden`.
-- ---------------------------------------------------------------------------
CREATE TABLE fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publicacion_id INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL DEFAULT 0,
  -- Mismo molde que randomKey(): <prefijo>/AAAA-MM-DD/<32 hex>.<ext>. Dos
  -- prefijos propios, `acto` y `mini`, para poder vaciar la cosecha entera con
  -- un borrado por prefijo sin rozar una sola foto del muro.
  clave      TEXT NOT NULL,   -- acto/2026-09-06/<32 hex>.webp   (1600 px)
  clave_mini TEXT NOT NULL,   -- mini/2026-09-06/<32 hex>.webp   (400 px)
  ancho INTEGER,
  alto  INTEGER,
  bytes INTEGER,
  -- Del fichero original descargado. Es lo que hace que importar dos veces no
  -- duplique nada, y lo que evita guardar diez veces el cartel que diez
  -- ayuntamientos compartieron.
  sha256 TEXT NOT NULL,
  -- La URL del CDN de donde salió. No se enseña —caduca y no le dice nada a
  -- nadie—, pero permite saber si dos copias vienen del mismo sitio.
  origen_url TEXT,
  clase TEXT NOT NULL DEFAULT 'foto',  -- foto | portada (fotograma de un vídeo)
  alt   TEXT,
  retirada TEXT,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_fotos_sha ON fotos (sha256);
CREATE UNIQUE INDEX idx_fotos_clave ON fotos (clave);
CREATE INDEX idx_fotos_publicacion ON fotos (publicacion_id, orden);

-- Los dos interruptores, en `settings` como todo lo demás: se cambian desde
-- /admin sin desplegar. El primero abre la puerta de la importación sólo
-- mientras dura; el segundo enciende el mapa nuevo cuando esté listo.
INSERT OR IGNORE INTO settings (key, value, label) VALUES
  ('cosecha_abierta', '0', 'Admitir la importación del archivo del acto (1 sí / 0 no)'),
  ('mapa_acto',       '0', 'Enseñar el mapa de fotos del acto (1 sí / 0 no)');
