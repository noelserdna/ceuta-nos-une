-- Concentraciones de toda España recogidas de prensa, no del cartel oficial:
-- Asturias, Canarias, Cantabria, Castilla y León, Comunidad Valenciana,
-- Extremadura, Galicia, Baleares, La Rioja, Navarra, País Vasco y Murcia, más
-- las capitales de Córdoba y Jaén, que el cartel dejaba sin lugar.
--
-- Cada una lleva en sus notas el medio del que sale, porque no vienen de la
-- organización y conviene que quien las lea sepa de dónde salen. No se pisa
-- ninguna del cartel: las dieciocho que ya estaban se han descartado al cruzar.
--
-- Dos nombres no coincidían con los del mapa: la plaza de Burgos es "Plaza del
-- Mío Cid" (buscar "Plaza del Cid" devolvía Caleruega, a 60 km) y la de Vigo es
-- "Praza de Compostela", en gallego.

INSERT INTO places
  (city, province, venue, address, event_date, event_time, lat, lon, notes, organizer, source_url, status)
VALUES
  ('Córdoba', 'Córdoba', 'Plaza de las Tendillas', 'Plaza de las Tendillas, Córdoba', '2026-09-02', '20:00', 37.8845063, -4.7795552, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('La Palma del Condado', 'Huelva', 'Plaza de España', 'Plaza de España, La Palma del Condado', '2026-09-02', '20:00', 37.3874866, -6.5534536, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Jaén', 'Jaén', 'Plaza de las Batallas', 'Plaza de las Batallas, Jaén', '2026-09-02', '20:00', 37.7726971, -3.7887146, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Nueva Andalucía', 'Málaga', 'Centro Polivalente', 'Centro Polivalente, Nueva Andalucía', '2026-09-02', '20:00', 36.50598, -4.966, 'Recogido de prensa (El Faro de Ceuta)', NULL, NULL, 'approved'),
  ('San Pedro de Alcántara', 'Málaga', 'Plaza de la Iglesia', 'Plaza de la Iglesia, San Pedro de Alcántara', '2026-09-02', '20:00', 36.4869728, -4.989644, 'Recogido de prensa (El Faro de Ceuta)', NULL, NULL, 'approved'),
  ('Gijón', 'Asturias', 'Plaza Mayor', 'Plaza Mayor, Gijón, 33201', '2026-09-02', '20:00', 43.5449908, -5.6625808, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Oviedo', 'Asturias', 'Plaza de la Escandalera', 'Plaza de la Escandalera, Oviedo', '2026-09-02', '20:00', 43.3622053, -5.8480485, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Las Palmas de Gran Canaria', 'Las Palmas', 'Plaza de Santa Ana', 'Plaza de Santa Ana, Las Palmas de Gran Canaria, 35001', '2026-09-02', '20:00', 28.1005011, -15.4155749, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Puerto del Rosario', 'Las Palmas', 'Calle Primero de Mayo', 'Calle Primero de Mayo, Puerto del Rosario', '2026-09-02', '19:00', 28.5012761, -13.8594991, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Santa Cruz de Tenerife', 'Santa Cruz de Tenerife', 'Plaza de España', 'Plaza de España, Santa Cruz de Tenerife, 38002', '2026-09-02', '20:00', 28.4670666, -16.2467142, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Santander', 'Cantabria', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Santander, 39002', '2026-09-02', '20:00', 43.4618795, -3.8103163, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Burgos', 'Burgos', 'Plaza del Mío Cid', 'Plaza del Mío Cid, Burgos', '2026-09-02', '20:00', 42.34061, -3.69954, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Astorga', 'León', 'Plaza de España', 'Plaza de España, Astorga', '2026-09-02', '20:00', 42.454585, -6.0530918, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Salamanca', 'Salamanca', 'Plaza Mayor', 'Plaza Mayor, Salamanca', '2026-09-02', '20:00', 40.9650282, -5.6640558, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Valladolid', 'Valladolid', 'Plaza Mayor', 'Plaza Mayor, Valladolid', '2026-09-02', '20:00', 41.6520609, -4.7285484, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Puertollano', 'Ciudad Real', 'Plaza de la Constitución', 'Plaza de la Constitución, Puertollano', '2026-09-02', '20:00', 38.6866267, -4.1105819, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Tarragona', 'Tarragona', 'Plaça de la Font', 'Plaça de la Font, Tarragona, 43003', '2026-09-02', '20:00', 41.1170793, 1.2550573, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Alicante', 'Alicante', 'Plaza de los Luceros', 'Plaza de los Luceros, Alicante', '2026-09-02', '20:00', 38.3460097, -0.4906781, 'Otras fuentes sitúan la concentración en Plaza de la Montañeta (fuentes discrepan). Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Castellón de la Plana', 'Castellón', 'Plaza María Agustina', 'Plaza María Agustina, Castellón de la Plana, 12001', '2026-09-02', '20:00', 39.9884844, -0.0343737, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Nules', 'Castellón', 'Faro Playa Nules', 'Faro Playa Nules, Nules, 12520', '2026-09-02', '20:00', 39.8532265, -0.1550092, 'El punto del mapa es aproximado: señala el centro del municipio. Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Valencia', 'Valencia', 'Plaça de l''Ajuntament', 'Plaça de l''Ajuntament, Valencia', '2026-09-02', '20:00', 39.4706473, -0.3768264, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Badajoz', 'Badajoz', 'Plaza Alta', 'Plaza Alta, Badajoz', '2026-09-02', '20:00', 38.8812287, -6.9682714, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('A Coruña', 'A Coruña', 'Plaza de María Pita', 'Plaza de María Pita, A Coruña, 15001', '2026-09-02', '20:00', 43.3710378, -8.395942, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Santiago de Compostela', 'A Coruña', 'Praza do Obradoiro', 'Praza do Obradoiro, Santiago de Compostela, 15705', '2026-09-02', '20:00', 42.8805003, -8.54576, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Vigo', 'Pontevedra', 'Praza de Compostela', 'Praza de Compostela, Vigo', '2026-09-02', '20:00', 42.23921, -8.723, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Palma de Mallorca', 'Baleares', 'Plaça de Cort', 'Plaça de Cort, Palma de Mallorca', '2026-09-02', '20:00', 39.569615, 2.650064, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Logroño', 'La Rioja', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Logroño', '2026-09-02', '20:00', 42.4662779, -2.4397496, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Brunete', 'Madrid', 'Plaza Mayor', 'Plaza Mayor, Brunete', '2026-09-02', '20:00', 40.4053238, -3.9980686, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Torrelodones', 'Madrid', 'Plaza de la Constitución', 'Plaza de la Constitución, Torrelodones, 28250', '2026-09-02', '20:00', 40.5758422, -3.9291313, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Pamplona', 'Navarra', 'Plaza del Castillo', 'Plaza del Castillo, Pamplona', '2026-09-02', '20:00', 42.8168147, -1.6427624, 'Otras fuentes sitúan la concentración en Plaza del Ayuntamiento (fuentes discrepan). Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('San Sebastián', 'Guipúzcoa', 'Jardines de Alderdi Eder', 'Jardines de Alderdi Eder, San Sebastián, 20004', '2026-09-02', '20:00', 43.3205409, -1.9851737, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Bilbao', 'Vizcaya', 'Plaza Moyúa', 'Plaza Moyúa, Bilbao', '2026-09-02', '20:00', 43.2629819, -2.9349696, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved'),
  ('Cartagena', 'Murcia', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Cartagena, 30201', '2026-09-02', '20:00', 37.5990274, -0.9856173, 'Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Jumilla', 'Murcia', 'Parking piscina cubierta', 'Parking piscina cubierta, Jumilla', '2026-09-02', '20:00', 38.4735408, -1.3285417, 'El punto del mapa es aproximado: señala el centro del municipio. Recogido de prensa (El Distrito)', NULL, NULL, 'approved'),
  ('Murcia', 'Murcia', 'Plaza de Santo Domingo', 'Plaza de Santo Domingo, Murcia', '2026-09-02', '20:00', 37.98735, -1.12919, 'Recogido de prensa (El Diario de Madrid)', NULL, NULL, 'approved');
