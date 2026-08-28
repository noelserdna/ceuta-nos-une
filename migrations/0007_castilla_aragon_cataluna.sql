-- Castilla-La Mancha, Aragón y Cataluña, del segundo cartel oficial.
--
-- Las coordenadas se validan contra el centro de cada municipio antes de
-- aceptarlas, y la comprobación descartó cinco resultados que caían entre 27 y
-- 79 km fuera: "Plaza del Pilar, Zaragoza" devolvía un sitio a 79 km y "Plaza
-- del Ayuntamiento, Toledo" otro a 60. Ciudad Real necesitó búsqueda
-- estructurada, porque la normal devolvía Campo de Criptana y hasta Piedrabuena.
--
-- Quedan fuera cuatro entradas que repiten municipios en provincias que no son:
-- Albacete lista Las Ventas de Retamosa y Madridejos, que son de Toledo y ya
-- salen allí; Huesca y Teruel listan Tomares y Utrera, que son de Sevilla y ya
-- salen en el cartel anterior. Parece un error de montaje del cartel.

INSERT INTO places
  (city, province, venue, address, event_date, event_time, lat, lon, notes, organizer, source_url, status)
VALUES
  ('Toledo', 'Toledo', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Toledo, 45071', '2026-09-02', '20:00', 39.8565436, -4.0249439, NULL, NULL, NULL, 'approved'),
  ('Almonacid de Toledo', 'Toledo', 'Plaza de la Constitución', 'Plaza de la Constitución, Almonacid de Toledo, 45440', '2026-09-02', '20:00', 39.7527754, -3.8552029, 'El cartel pone solo Almonacid', NULL, NULL, 'approved'),
  ('El Viso de San Juan', 'Toledo', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, El Viso de San Juan, 45215', '2026-09-02', '20:00', 40.1423027, -3.9210789, NULL, NULL, NULL, 'approved'),
  ('Fuensalida', 'Toledo', 'Plaza del Conde', 'Plaza del Conde, Fuensalida, 45510', '2026-09-02', '20:00', 40.0528693, -4.2091415, NULL, NULL, NULL, 'approved'),
  ('Illescas', 'Toledo', 'Ayuntamiento', 'Ayuntamiento, Illescas, 45200', '2026-09-02', '20:00', 40.1236984, -3.8503188, NULL, NULL, NULL, 'approved'),
  ('Las Ventas de Retamosa', 'Toledo', 'Plaza de la Villa', 'Plaza de la Villa, Las Ventas de Retamosa, 45183', '2026-09-02', '20:00', 40.1549993, -4.1132714, NULL, NULL, NULL, 'approved'),
  ('Madridejos', 'Toledo', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Madridejos, 45710', '2026-09-02', '20:00', 39.4692725, -3.5356376, NULL, NULL, NULL, 'approved'),
  ('Magán', 'Toledo', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Magán, 45270', '2026-09-02', '20:00', 39.9618165, -3.930576, NULL, NULL, NULL, 'approved'),
  ('Mocejón', 'Toledo', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Mocejón, 45270', '2026-09-02', '20:00', 39.9396947, -3.9163783, NULL, NULL, NULL, 'approved'),
  ('Nambroca', 'Toledo', 'Plaza de la Constitución', 'Plaza de la Constitución, Nambroca, 45190', '2026-09-02', '20:00', 39.7980047, -3.9444943, NULL, NULL, NULL, 'approved'),
  ('Navahermosa', 'Toledo', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Navahermosa, 45150', '2026-09-02', '20:00', 39.6337383, -4.4724804, NULL, NULL, NULL, 'approved'),
  ('Numancia de la Sagra', 'Toledo', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Numancia de la Sagra, 45230', '2026-09-02', '20:00', 40.0762953, -3.8545988, NULL, NULL, NULL, 'approved'),
  ('Quintanar de la Orden', 'Toledo', 'Plaza de la Constitución', 'Plaza de la Constitución, Quintanar de la Orden, 45800', '2026-09-02', '20:00', 39.5909487, -3.0441108, NULL, NULL, NULL, 'approved'),
  ('Talavera de la Reina', 'Toledo', 'Plaza del Pan', 'Plaza del Pan, Talavera de la Reina, 45600', '2026-09-02', '20:00', 39.9583698, -4.8329505, NULL, NULL, NULL, 'approved'),
  ('Seseña', 'Toledo', 'Plaza Bayona (Ayuntamiento)', 'Plaza Bayona (Ayuntamiento), Seseña', '2026-09-02', '20:00', 40.104381, -3.6971754, NULL, NULL, NULL, 'approved'),
  ('Sonseca', 'Toledo', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Sonseca, 45100', '2026-09-02', '20:00', 39.675878, -3.9751504, NULL, NULL, NULL, 'approved'),
  ('Urda', 'Toledo', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Urda, 45480', '2026-09-02', '20:00', 39.4125049, -3.7165379, NULL, NULL, NULL, 'approved'),
  ('Villasequilla', 'Toledo', 'Plaza Mayor', 'Plaza Mayor, Villasequilla', '2026-09-02', '20:00', 39.8763348, -3.7308655, NULL, NULL, NULL, 'approved'),
  ('Yuncos', 'Toledo', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Yuncos, 45210', '2026-09-02', '20:00', 40.0872817, -3.8741464, NULL, NULL, NULL, 'approved'),
  ('Ciudad Real', 'Ciudad Real', 'Plaza Mayor (fin de la marcha)', 'Plaza Mayor (fin de la marcha), Ciudad Real, 13001', '2026-09-02', '19:30', 38.98539, -3.92854, 'La marcha sale de la Plazoleta Río Becea a las 19:30 y termina aquí sobre las 20:30. El punto del mapa es el final del recorrido.', NULL, NULL, 'approved'),
  ('Argamasilla de Alba', 'Ciudad Real', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Argamasilla de Alba, 13710', '2026-09-02', '20:00', 39.1286309, -3.0901018, NULL, NULL, NULL, 'approved'),
  ('Membrilla', 'Ciudad Real', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Membrilla', '2026-09-02', '20:00', 38.9725271, -3.3487688, NULL, NULL, NULL, 'approved'),
  ('Pedro Muñoz', 'Ciudad Real', 'Plaza de España', 'Plaza de España, Pedro Muñoz', '2026-09-02', '20:00', 39.4059161, -2.9471059, NULL, NULL, NULL, 'approved'),
  ('Socuéllamos', 'Ciudad Real', 'Plaza de la Constitución', 'Plaza de la Constitución, Socuéllamos', '2026-09-02', '20:00', 39.2865312, -2.7931113, NULL, NULL, NULL, 'approved'),
  ('Villarrubia de los Ojos', 'Ciudad Real', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Villarrubia de los Ojos, 13670', '2026-09-02', '20:00', 39.2179661, -3.6076339, NULL, NULL, NULL, 'approved'),
  ('Guadalajara', 'Guadalajara', 'Plaza Mayor (Ayuntamiento)', 'Plaza Mayor (Ayuntamiento), Guadalajara, 19001', '2026-09-02', '20:00', 40.6336948, -3.1674415, NULL, NULL, NULL, 'approved'),
  ('El Casar', 'Guadalajara', 'Plaza de la Constitución', 'Plaza de la Constitución, El Casar, 19170', '2026-09-02', '20:00', 40.7024507, -3.4279241, NULL, NULL, NULL, 'approved'),
  ('Yebes', 'Guadalajara', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Yebes, 19141', '2026-09-02', '20:00', 40.5339432, -3.1106976, NULL, NULL, NULL, 'approved'),
  ('Yunquera de Henares', 'Guadalajara', 'Patio del Palacio de los Mendoza', 'Patio del Palacio de los Mendoza, Yunquera de Henares, 19210', '2026-09-02', '20:00', 40.7540224, -3.1674304, NULL, NULL, NULL, 'approved'),
  ('Albacete', 'Albacete', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Albacete, 02005', '2026-09-02', '20:00', 38.9961404, -1.8556734, NULL, NULL, NULL, 'approved'),
  ('Hellín', 'Albacete', 'Plaza de la Iglesia', 'Plaza de la Iglesia, Hellín', '2026-09-02', '20:00', 38.5120521, -1.7025267, NULL, NULL, NULL, 'approved'),
  ('Cuenca', 'Cuenca', 'Plaza Mayor', 'Plaza Mayor, Cuenca, 16001', '2026-09-02', '20:00', 40.077943, -2.1302316, NULL, NULL, NULL, 'approved'),
  ('El Pedernoso', 'Cuenca', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, El Pedernoso', '2026-09-02', '20:00', 39.4855109, -2.7463772, NULL, NULL, NULL, 'approved'),
  ('Zaragoza', 'Zaragoza', 'Plaza del Pilar', 'Plaza del Pilar, Zaragoza, 50001', '2026-09-02', '20:00', 41.6567713, -0.8785235, NULL, NULL, NULL, 'approved'),
  ('Maella', 'Zaragoza', 'Plaza de España', 'Plaza de España, Maella, 50710', '2026-09-02', '20:00', 41.12218, 0.1397423, NULL, NULL, NULL, 'approved'),
  ('María de Huerva', 'Zaragoza', 'Plaza de España', 'Plaza de España, María de Huerva, 50430', '2026-09-02', '20:00', 41.5377155, -0.9965213, NULL, NULL, NULL, 'approved'),
  ('Utebo', 'Zaragoza', 'Ayuntamiento', 'Ayuntamiento, Utebo, 50180', '2026-09-02', '20:00', 41.7098105, -0.9982786, 'El cartel escribe Uteba; el municipio de Zaragoza es Utebo', NULL, NULL, 'approved'),
  ('Huesca', 'Huesca', 'Puerta del Casino de Huesca', 'Puerta del Casino de Huesca, Huesca, 22002', '2026-09-02', '20:00', 42.1361596, -0.4096186, NULL, NULL, NULL, 'approved'),
  ('Jaca', 'Huesca', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Jaca, 22700', '2026-09-02', '20:00', 42.5692811, -0.5494241, NULL, NULL, NULL, 'approved'),
  ('Teruel', 'Teruel', 'Plaza de San Juan (Subdelegación del Gobierno)', 'Plaza de San Juan (Subdelegación del Gobierno), Teruel, 44001', '2026-09-02', '20:00', 40.34044, -1.10677, NULL, 'Subdelegación del Gobierno', NULL, 'approved'),
  ('Teruel', 'Teruel', 'Plaza de la Catedral (Ayuntamiento)', 'Plaza de la Catedral (Ayuntamiento), Teruel, 44001', '2026-09-02', '20:00', 40.34332, -1.10802, NULL, 'Ayuntamiento de Teruel', NULL, 'approved'),
  ('Montalbán', 'Teruel', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Montalbán, 44700', '2026-09-02', '20:00', 40.8326222, -0.7983878, NULL, NULL, NULL, 'approved'),
  ('Badalona', 'Barcelona', 'Plaza de la Vila', 'Plaza de la Vila, Badalona', '2026-09-02', '20:00', 41.449907, 2.2475683, NULL, NULL, NULL, 'approved'),
  ('Terrassa', 'Barcelona', 'Raval de Montserrat (Ajuntament de Terrassa)', 'Raval de Montserrat (Ajuntament de Terrassa), Terrassa, 08221', '2026-09-02', '20:00', 41.5631581, 2.0101093, NULL, NULL, NULL, 'approved'),
  ('Figueres', 'Girona', 'Plaça de l''Ajuntament', 'Plaça de l''Ajuntament, Figueres, 17600', '2026-09-02', '20:00', 42.267257, 2.9608552, NULL, NULL, NULL, 'approved');
