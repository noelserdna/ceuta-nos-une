-- Cada denuncia queda registrada con la huella de quien la hace, para que cuente
-- una sola vez por mensaje. Sin esto, el ocultado automático sería un arma: el
-- límite por IP es de 10 por minuto en total, así que una sola persona podía
-- pulsar diez veces el mismo mensaje y tumbarlo ella sola en segundos.
--
-- La huella es el mismo hash con sal que ya se usa para frenar el spam: no
-- guarda la dirección IP, solo un resumen que no permite volver atrás.

CREATE TABLE message_reports (
  message_id  INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  ip_hash     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, ip_hash)
);

CREATE INDEX idx_reports_mensaje ON message_reports (message_id);
