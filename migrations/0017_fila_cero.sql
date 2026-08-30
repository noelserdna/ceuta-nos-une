-- La fila cero: la manifestación virtual del 2 de septiembre.
--
-- Quien no puede ir a una plaza entra aquí y ve pasar, en bucle, lo que sube la
-- gente. Todo cae en `messages`, que ya tenía autor, texto, foto y denuncias: no
-- hacía falta una tabla nueva para lo mismo. Lo que sí hacía falta es distinguir
-- de dónde viene cada cosa y si ya se puede enseñar.

-- De qué canal viene. Los tres se pintan igual, pero se filtran distinto:
--   muro    -> lo de siempre, se publica al momento
--   directo -> cualquiera, una sola foto por persona, pasa por el clasificador
--   equipo  -> quien tiene un código, sube fotos y vídeos, no pasa por la IA
ALTER TABLE messages ADD COLUMN canal TEXT NOT NULL DEFAULT 'muro';

-- Si se puede enseñar. 'espera' es el estado por defecto de todo lo que lleva
-- imagen: hasta que la IA no dice que sí, no sale, y si la IA falla se queda ahí.
-- Fallar hacia la cola y no hacia la pantalla es la decisión de fondo de todo esto.
ALTER TABLE messages ADD COLUMN estado TEXT NOT NULL DEFAULT 'ok';

-- Qué dijo el clasificador, o quién lo aprobó a mano y cuándo. Es el registro que
-- permite decir "esto estuvo noventa segundos y aquí está la hora" si algo se cuela.
ALTER TABLE messages ADD COLUMN moderacion TEXT;

-- Huella del navegador, no de la persona: sirve para que cada cual tenga una foto
-- en el pase y no diez. No identifica a nadie ni se cruza con nada.
ALTER TABLE messages ADD COLUMN ficha TEXT;

-- 'foto' o 'video'. Un vídeo es una tarjeta más del pase, sólo que dura más.
ALTER TABLE messages ADD COLUMN media_tipo TEXT;
ALTER TABLE messages ADD COLUMN media_ms INTEGER;

-- Coordenadas del municipio que escribió quien envía, casadas contra `places`.
-- Se guardan al insertar para no geocodificar en mitad de una avalancha.
ALTER TABLE messages ADD COLUMN lat REAL;
ALTER TABLE messages ADD COLUMN lon REAL;

-- El pase pide siempre lo mismo: lo visible, lo más reciente primero.
CREATE INDEX idx_messages_directo ON messages (estado, hidden, id DESC);

-- Para comprobar en una sola consulta si esta persona ya tiene su foto.
CREATE INDEX idx_messages_ficha ON messages (ficha) WHERE ficha IS NOT NULL;

-- Quién puede subir por el canal de equipo. Un código por persona y no un enlace
-- compartido: así se anula el de uno sin avisar a los demás, y se sabe de quién
-- viene cada foto por si hay que retirar todo lo suyo de golpe.
CREATE TABLE pases (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Los interruptores de la noche. Van en `settings` porque se cambian desde /admin
-- sin desplegar: el día 2 no hay tiempo para un despliegue.
INSERT OR IGNORE INTO settings (key, value, label) VALUES
  ('directo_modo',    'off', 'Fila cero: off, abierto, solo_fotos o solo_lectura'),
  ('directo_video',   '',    'Retransmisión externa (YouTube, Twitch o Stream)'),
  ('directo_sondeo',  '4',   'Segundos entre consultas del directo'),
  ('directo_retardo', '90',  'Segundos que tarda un mensaje en salir en pantalla'),
  ('directo_fotos',   '60',  'Cuántas tarjetas entran en el pase'),
  ('cron_pausado',    '0',   'Parar el cruce con porceuta.es durante el acto');

-- Las fotos sí las mira un clasificador, pero NO el de Meta: su modelo de visión
-- exige aceptar una licencia en la que se declara no residir en la Unión Europea,
-- y esto se lleva desde España. Se usa Qwen 3.8 27B, que no pide nada de eso.
-- Aun así queda el interruptor: si el modelo falla o se satura la noche del acto,
-- se pone a 0 y todo pasa por la cola de /admin, que sigue estando ahí.
INSERT OR IGNORE INTO settings (key, value, label) VALUES
  ('directo_ia_fotos', '1', 'Clasificar fotos con IA (0 = todo a revisión manual)');
