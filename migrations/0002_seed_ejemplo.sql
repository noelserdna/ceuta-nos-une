-- DATOS DE EJEMPLO. Sustituir por los lugares reales cuando se confirmen.
-- Para vaciarlos de golpe:  DELETE FROM places WHERE notes LIKE 'EJEMPLO%';

INSERT INTO places (city, province, venue, address, event_date, event_time, lat, lon, notes, organizer, status, reviewed_at) VALUES
  ('Ceuta',     'Ceuta',     'Plaza de los Reyes',       'Plaza de los Reyes, 51001 Ceuta',            '2026-09-02', '20:00', 35.888700, -5.316200, 'EJEMPLO — dato de muestra, sustituir por el real', 'Convocatoria ciudadana', 'approved', datetime('now')),
  ('Madrid',    'Madrid',    'Puerta del Sol',           'Puerta del Sol, 28013 Madrid',               '2026-09-02', '20:00', 40.416900, -3.703500, 'EJEMPLO — dato de muestra, sustituir por el real', 'Convocatoria ciudadana', 'approved', datetime('now')),
  ('Barcelona', 'Barcelona', 'Plaça de Catalunya',       'Plaça de Catalunya, 08002 Barcelona',        '2026-09-02', '20:00', 41.387000,  2.170000, 'EJEMPLO — dato de muestra, sustituir por el real', 'Convocatoria ciudadana', 'approved', datetime('now')),
  ('Sevilla',   'Sevilla',   'Plaza Nueva',              'Plaza Nueva, 41001 Sevilla',                 '2026-09-02', '20:00', 37.388600, -5.995300, 'EJEMPLO — dato de muestra, sustituir por el real', 'Convocatoria ciudadana', 'approved', datetime('now')),
  ('Málaga',    'Málaga',    'Plaza de la Constitución', 'Plaza de la Constitución, 29005 Málaga',     '2026-09-02', '19:30', 36.721300, -4.421400, 'EJEMPLO — dato de muestra, sustituir por el real', 'Convocatoria ciudadana', 'approved', datetime('now')),
  ('Valencia',  'Valencia',  'Plaza del Ayuntamiento',   'Plaça de l''Ajuntament, 46002 València',     '2026-09-02', '20:00', 39.469900, -0.376300, 'EJEMPLO — dato de muestra, sustituir por el real', 'Convocatoria ciudadana', 'approved', datetime('now'));

-- Uno pendiente, para ver cómo funciona la cola de revisión en /admin
INSERT INTO places (city, province, venue, address, event_date, event_time, lat, lon, notes, organizer, status, submitter_name, submitter_email) VALUES
  ('Algeciras', 'Cádiz', 'Plaza Alta', 'Plaza Alta, 11201 Algeciras, Cádiz', '2026-09-02', '20:00', 36.128600, -5.451700, 'EJEMPLO — propuesta de muestra pendiente de aprobar', 'Vecinos de Algeciras', 'pending', 'Nombre de ejemplo', 'ejemplo@correo.es');

INSERT INTO messages (author, origin, body) VALUES
  ('Ejemplo', 'Ceuta',   'EJEMPLO — Este es un mensaje de muestra para ver cómo queda el muro. Se puede borrar desde el panel de administración.'),
  ('Ejemplo', 'Madrid',  'EJEMPLO — Los mensajes se publican al momento y pueden llevar una foto. Se pueden ocultar desde /admin.'),
  ('Ejemplo', 'Melilla', 'EJEMPLO — Tercer mensaje de muestra para comprobar la retícula del muro con varias tarjetas.');
