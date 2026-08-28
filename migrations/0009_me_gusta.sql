-- Los "me gusta" del muro. Se cuentan por huella, igual que las denuncias: sin
-- cuentas de usuario, es la única forma de que insistir no sume. Y como se puede
-- quitar, la fila se borra al retirarlo.
--
-- Contrapartida conocida: quienes comparten salida a internet (una casa, una
-- oficina, algunas redes móviles) cuentan como una sola persona. Se asume, igual
-- que en las denuncias: el muro no pide registrarse y no se va a empezar ahora.

CREATE TABLE message_likes (
  message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  ip_hash     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, ip_hash)
);

CREATE INDEX idx_likes_mensaje ON message_likes (message_id);

-- El total vive también en messages para no contar en cada carga del muro.
ALTER TABLE messages ADD COLUMN likes INTEGER NOT NULL DEFAULT 0;
