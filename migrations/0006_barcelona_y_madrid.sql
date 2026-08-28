-- Barcelona y Madrid, que hasta ahora no tenían nada confirmado. En Madrid hay
-- dos convocatorias distintas a la misma hora, así que se distinguen por quién
-- las convoca: la tarjeta enseña ese dato.
--
-- Coordenadas de Nominatim, contrastadas con la posición conocida de cada sitio:
-- las tres caen a menos de 100 metros.

INSERT INTO places
  (city, province, venue, address, event_date, event_time, lat, lon, notes, organizer, source_url, status)
VALUES
  ('Barcelona', 'Barcelona', 'Plaça de Sant Jaume', 'Plaça de Sant Jaume, Barcelona',
   '2026-09-02', '20:00', 41.3826, 2.17701, NULL, NULL, NULL, 'approved'),

  ('Madrid', 'Madrid', 'Congreso de los Diputados', 'Plaza de las Cortes, Madrid',
   '2026-09-02', '20:00', 40.41644, -3.69703, NULL, 'Ceutíes en Madrid', NULL, 'approved'),

  ('Madrid', 'Madrid', 'Plaza de Cibeles', 'Plaza de Cibeles, Madrid',
   '2026-09-02', '20:00', 40.41942, -3.69254, NULL, 'Ayuntamiento de Madrid', NULL, 'approved');
