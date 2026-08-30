-- Cuatro concentraciones más, del endpoint público que porceuta.es ha abierto en
-- /api/public/convocatorias. Trae 603 y dice de sí mismo «datos reutilizables
-- libremente», así que sustituye a la lectura directa de su base que se hacía
-- hasta ahora.
--
-- De las 603 sólo entran cuatro, y es por el mismo criterio de siempre: sólo las
-- que su propio sistema marca con pin dorado —66 de 603— y sin partido detrás
-- —51—; de esas, 22 no las teníamos, y al mirarlas una a una once ya estaban en
-- el desván, una la convoca «Populares de Villanueva de la Concepción», dos no
-- son del día 2 y tres eran el mismo sitio con otro nombre.
--
-- Los tres descartes por duplicado, para que no se repita el trabajo:
--   · San Sebastián: su punto está a CERO metros del nuestro.
--   · Ciudad Real, Plazoleta Río Becea: es donde arranca la marcha cuyo final ya
--     está publicado, y nuestra nota ya lo dice. Sería el mismo acto dos veces.
--   · Guadalajara: su punto cae a 664 m del ayuntamiento y el nuestro a 0.
--
-- El convocante entra sólo cuando es una institución. Su listado trae también
-- nombres y apellidos de particulares que han firmado la comunicación, y aunque
-- ellos los publiquen, aquí no se copian: quien convoca una manifestación en su
-- pueblo no tiene por qué aparecer en un listado nacional.
--
-- Las cuatro coordenadas se han comprobado al revés: las cuatro caen dentro de
-- su municipio, tres a menos de 60 metros del centro.

INSERT INTO places (city, province, venue, address, event_date, event_time, lat, lon, notes, organizer, status) VALUES
('Almendralejo', 'Badajoz', 'Plaza del ayuntamiento', 'Plaza del ayuntamiento, 06200', '2026-09-02', '20:00', 38.684679, -6.40678, NULL, NULL, 'approved'),
('Santoña', 'Cantabria', 'Frente al Ayuntamiento, C. Manzanedo 27', 'Frente al Ayuntamiento, C. Manzanedo 27, 39749', '2026-09-02', '20:00', 43.44485, -3.45615, NULL, 'Convocatoria local / iniciativa Por Ceuta', 'approved'),
('Ares del Maestrat', 'Castellón', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, 12165', '2026-09-02', '20:00', 40.456535, -0.131962, NULL, NULL, 'approved'),
('Algodonales', 'Cádiz', 'Plaza de la Constitución', 'Plaza de la Constitución, 11680', '2026-09-02', '20:00', 36.879693, -5.404776, NULL, NULL, 'approved');


-- ---------------------------------------------------------------------------
-- Oviedo: dos fuentes y dos plazas distintas.
-- ---------------------------------------------------------------------------
-- El cartel oficial dice Plaza de la Escandalera y así está publicado. El
-- listado de porceuta.es, con su marca de confianza más alta, dice Plaza de la
-- Constitución. Están a 331 metros y no son la misma.
--
-- Lo comprobado: el Ayuntamiento de Oviedo está EN la Plaza de la Constitución,
-- a 15 metros de su punto, y la FEMP convocó frente a los ayuntamientos. Eso
-- apunta a que la suya es la buena, pero no basta para cambiar el dato del
-- cartel oficial.
--
-- Así que se hace lo mismo que en Alicante y Pamplona cuando las fuentes no
-- coinciden: se avisa. Quien vaya a Oviedo lee que hay dos sitios citados y
-- puede comprobarlo antes de salir de casa, que es mejor que plantarse en la
-- plaza equivocada por nuestra culpa.
UPDATE places SET notes = TRIM(COALESCE(notes || ' ', '') ||
  'Otras fuentes sitúan la concentración en la Plaza de la Constitución, frente al Ayuntamiento, a 300 metros de aquí (fuentes discrepan).')
  WHERE status='approved' AND city='Oviedo' AND venue LIKE '%Escandalera%';
