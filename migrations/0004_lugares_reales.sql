-- Los lugares reales de la convocatoria: Andalucía, Ceuta y Melilla, tal como
-- vienen en el cartel oficial. Sustituyen a los seis de muestra con los que
-- arrancó la web.
--
-- Las coordenadas salen de Nominatim (OpenStreetMap) y se han comprobado una a
-- una midiendo la distancia al centro de cada municipio, porque buscar el nombre
-- a secas engaña: "Plaza Vieja, Almería" devolvía un paraje de Pulpí a 76 km, y
-- "Plaza del Ayuntamiento, Jerez" caía en la pedanía de La Barca de la Florida.
-- Las tres convocatorias de Mijas apuntaban las tres al mismo ayuntamiento, y
-- son tres núcleos distintos. Todo eso está corregido y verificado.
--
-- Donde el cartel dice "Puerta del Ayuntamiento", el punto es el ayuntamiento:
-- es lo que el geocodificador entiende y es donde se convoca de todas formas.
--
-- Quedan fuera cuatro sitios donde el cartel todavía no da lugar:
--   · Huelva (Huelva): el cartel dice: pendiente de confirmar
--   · Córdoba (Córdoba): el cartel pone XXXXX: falta el lugar
--   · Castellar de la Frontera (Cádiz): el cartel pone XXXX (mirar bien): falta el lugar
--   · Jaén (Jaén): el cartel dice: no consta manifestación
-- Cuando se confirmen, se añaden con un INSERT igual que estos.

DELETE FROM places WHERE notes LIKE 'EJEMPLO%';

INSERT INTO places
  (city, province, venue, address, event_date, event_time, lat, lon, notes, organizer, source_url, status)
VALUES

  ('Almería', 'Almería', 'Plaza de la Constitución (Plaza Vieja)', 'Plaza de la Constitución (Plaza Vieja), Almería, 04001', '2026-09-02', '20:00', 36.8400856, -2.4677447, NULL, NULL, NULL, 'approved'),
  ('Adra', 'Almería', 'Plaza Puerta del Mar', 'Plaza Puerta del Mar, Adra', '2026-09-02', '20:00', 36.7491203, -3.0145023, NULL, NULL, NULL, 'approved'),
  ('Berja', 'Almería', 'Plaza de la Constitución', 'Plaza de la Constitución, Berja', '2026-09-02', '20:00', 36.8464341, -2.9497167, NULL, NULL, NULL, 'approved'),
  ('Benahadux', 'Almería', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Benahadux, 04410', '2026-09-02', '20:00', 36.925822, -2.455777, NULL, NULL, NULL, 'approved'),
  ('El Ejido', 'Almería', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, El Ejido, 04700', '2026-09-02', '20:00', 36.7748608, -2.8127504, NULL, NULL, NULL, 'approved'),
  ('Dalías', 'Almería', 'Plaza Cristo de la Luz (Ayuntamiento)', 'Plaza Cristo de la Luz (Ayuntamiento), Dalías, 04750', '2026-09-02', '20:00', 36.8210663, -2.8705271, NULL, NULL, NULL, 'approved'),
  ('Olula del Río', 'Almería', 'Ayuntamiento', 'Ayuntamiento, Olula del Río, 04860', '2026-09-02', '20:00', 37.3522006, -2.2981705, NULL, NULL, NULL, 'approved'),
  ('Roquetas de Mar', 'Almería', 'Plaza de la Constitución', 'Plaza de la Constitución, Roquetas de Mar, 04740', '2026-09-02', '20:00', 36.7645313, -2.6148553, NULL, NULL, NULL, 'approved'),
  ('Sorbas', 'Almería', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Sorbas, 04270', '2026-09-02', '20:00', 37.0980785, -2.1242361, NULL, NULL, NULL, 'approved'),
  ('Vera', 'Almería', 'Plaza Mayor', 'Plaza Mayor, Vera, 04620', '2026-09-02', '20:00', 37.2471401, -1.8685718, NULL, NULL, NULL, 'approved'),
  ('Sevilla', 'Sevilla', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Sevilla', '2026-09-02', '20:00', 37.388654, -5.9944781, NULL, NULL, NULL, 'approved'),
  ('Écija', 'Sevilla', 'Plaza de España', 'Plaza de España, Écija, 41400', '2026-09-02', '20:00', 37.5411551, -5.079263, NULL, NULL, NULL, 'approved'),
  ('Estepa', 'Sevilla', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Estepa, 41560', '2026-09-02', '20:00', 37.2916129, -4.8780688, NULL, NULL, NULL, 'approved'),
  ('La Roda de Andalucía', 'Sevilla', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, La Roda de Andalucía, 41590', '2026-09-02', '20:00', 37.2011153, -4.7793579, NULL, NULL, NULL, 'approved'),
  ('Lebrija', 'Sevilla', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Lebrija, 41740', '2026-09-02', '20:00', 36.9197133, -6.0785932, NULL, NULL, NULL, 'approved'),
  ('Osuna', 'Sevilla', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Osuna, 41640', '2026-09-02', '20:00', 37.237094, -5.1029935, NULL, NULL, NULL, 'approved'),
  ('Tomares', 'Sevilla', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Tomares, 41940', '2026-09-02', '20:00', 37.3739071, -6.0445144, NULL, NULL, NULL, 'approved'),
  ('Utrera', 'Sevilla', 'Plaza de Gibaxa', 'Plaza de Gibaxa, Utrera, 41710', '2026-09-02', '20:00', 37.183257, -5.781598, NULL, NULL, NULL, 'approved'),
  ('Sevilla', 'Sevilla', 'Desde Puerta Jerez hasta Plaza de San Francisco', 'Desde Puerta Jerez hasta Plaza de San Francisco, Sevilla, 41004', '2026-09-03', '19:30', 37.3817849, -5.99436, 'Marcha del 3 de septiembre', NULL, NULL, 'approved'),
  ('Almonte', 'Huelva', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Almonte, 21730', '2026-09-02', '20:00', 37.2623116, -6.5182252, NULL, NULL, NULL, 'approved'),
  ('Ayamonte', 'Huelva', 'Ayuntamiento de Ayamonte', 'Ayuntamiento de Ayamonte, Ayamonte, 21400', '2026-09-02', '20:00', 37.2143429, -7.4090158, NULL, NULL, NULL, 'approved'),
  ('Cartaya', 'Huelva', 'Ayuntamiento de Cartaya', 'Ayuntamiento de Cartaya, Cartaya, 21450', '2026-09-02', '20:00', 37.2829019, -7.1551065, NULL, NULL, NULL, 'approved'),
  ('Lepe', 'Huelva', 'Ayuntamiento de Lepe', 'Ayuntamiento de Lepe, Lepe, 21440', '2026-09-02', '20:00', 37.2541241, -7.2032461, NULL, NULL, NULL, 'approved'),
  ('Palos de la Frontera', 'Huelva', 'Plaza de la Constitución', 'Plaza de la Constitución, Palos de la Frontera', '2026-09-02', '20:00', 37.2238994, -6.8875882, NULL, NULL, NULL, 'approved'),
  ('Punta Umbría', 'Huelva', 'Plaza de la Constitución', 'Plaza de la Constitución, Punta Umbría, 21100', '2026-09-02', '20:00', 37.182464, -6.9671427, NULL, NULL, NULL, 'approved'),
  ('San Juan del Puerto', 'Huelva', 'Ayuntamiento', 'Ayuntamiento, San Juan del Puerto, 21610', '2026-09-02', '20:00', 37.3142068, -6.840786, NULL, NULL, NULL, 'approved'),
  ('Alhendín', 'Granada', 'Plaza de España', 'Plaza de España, Alhendín, 18620', '2026-09-02', '20:00', 37.1078764, -3.6457852, 'El cartel lo pone en Córdoba; corregido a Granada, que es su provincia', NULL, NULL, 'approved'),
  ('Benamejí', 'Córdoba', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Benamejí, 14910', '2026-09-02', '20:00', 37.2675446, -4.5405026, NULL, NULL, NULL, 'approved'),
  ('Cabra', 'Córdoba', 'Plaza de España', 'Plaza de España, Cabra, 14940', '2026-09-02', '20:00', 37.4731021, -4.4432755, NULL, NULL, NULL, 'approved'),
  ('Hornachuelos', 'Córdoba', 'Ayuntamiento', 'Ayuntamiento, Hornachuelos, 14740', '2026-09-02', '20:00', 37.8309611, -5.2428203, NULL, NULL, NULL, 'approved'),
  ('La Rambla', 'Córdoba', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, La Rambla, 14540', '2026-09-02', '20:00', 37.6081252, -4.7419177, NULL, NULL, NULL, 'approved'),
  ('Lucena', 'Córdoba', 'Plaza Nueva', 'Plaza Nueva, Lucena, 14900', '2026-09-02', '20:00', 37.4088641, -4.4850796, NULL, NULL, NULL, 'approved'),
  ('Puente Genil', 'Córdoba', 'Paseo del Romeral', 'Paseo del Romeral, Puente Genil, 14500', '2026-09-02', '20:00', 37.3900049, -4.7710453, NULL, NULL, NULL, 'approved'),
  ('Cádiz', 'Cádiz', 'Plaza San Juan de Dios', 'Plaza San Juan de Dios, Cádiz', '2026-09-02', '20:00', 36.5302274, -6.2924416, NULL, NULL, NULL, 'approved'),
  ('Algeciras', 'Cádiz', 'Plaza Alta', 'Plaza Alta, Algeciras, 11201', '2026-09-02', '20:00', 36.1312494, -5.447319, NULL, NULL, NULL, 'approved'),
  ('Arcos de la Frontera', 'Cádiz', 'Paseo de Andalucía', 'Paseo de Andalucía, Arcos de la Frontera', '2026-09-02', '20:00', 36.7507361, -5.8144143, NULL, NULL, NULL, 'approved'),
  ('Barbate', 'Cádiz', 'Ayuntamiento de Barbate', 'Ayuntamiento de Barbate, Barbate, 11160', '2026-09-02', '20:00', 36.1928972, -5.9188807, NULL, NULL, NULL, 'approved'),
  ('Benalup-Casas Viejas', 'Cádiz', 'Ayuntamiento', 'Ayuntamiento, Benalup-Casas Viejas, 11190', '2026-09-02', '20:00', 36.3465024, -5.8121141, NULL, NULL, NULL, 'approved'),
  ('Chiclana de la Frontera', 'Cádiz', 'Ayuntamiento de Chiclana', 'Ayuntamiento de Chiclana, Chiclana de la Frontera, 11130', '2026-09-02', '20:00', 36.4196082, -6.1493454, NULL, NULL, NULL, 'approved'),
  ('Chipiona', 'Cádiz', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Chipiona, 11550', '2026-09-02', '20:00', 36.7408967, -6.4358834, NULL, NULL, NULL, 'approved'),
  ('Jerez de la Frontera', 'Cádiz', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Jerez de la Frontera, 11403', '2026-09-02', '20:00', 36.6830408, -6.1403948, NULL, NULL, NULL, 'approved'),
  ('Los Barrios', 'Cádiz', 'Puertas de la Casa Consistorial', 'Puertas de la Casa Consistorial, Los Barrios, 11370', '2026-09-02', '20:00', 36.1856385, -5.4928868, NULL, NULL, NULL, 'approved'),
  ('Rota', 'Cádiz', 'Castillo de la Luna', 'Castillo de la Luna, Rota, 11520', '2026-09-02', '20:00', 36.6169332, -6.3580723, NULL, NULL, NULL, 'approved'),
  ('San Martín del Tesorillo', 'Cádiz', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, San Martín del Tesorillo, 11340', '2026-09-02', '20:00', 36.3399688, -5.321205, NULL, NULL, NULL, 'approved'),
  ('San Roque', 'Cádiz', 'Plaza de las Constituciones', 'Plaza de las Constituciones, San Roque, 11360', '2026-09-02', '20:00', 36.2104798, -5.391614, NULL, NULL, NULL, 'approved'),
  ('Setenil de las Bodegas', 'Cádiz', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Setenil de las Bodegas, 11692', '2026-09-02', '20:00', 36.8640542, -5.1814492, NULL, NULL, NULL, 'approved'),
  ('Tarifa', 'Cádiz', 'Ayuntamiento de Tarifa', 'Ayuntamiento de Tarifa, Tarifa, 11380', '2026-09-02', '20:00', 36.0117733, -5.6020591, NULL, NULL, NULL, 'approved'),
  ('Viator', 'Almería', 'Plaza de la Constitución', 'Plaza de la Constitución, Viator, 04240', '2026-09-02', '19:00', 36.8896494, -2.4261881, NULL, NULL, NULL, 'approved'),
  ('Villamartín', 'Cádiz', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Villamartín', '2026-09-02', '20:00', 36.8609598, -5.6417149, NULL, NULL, NULL, 'approved'),
  ('Granada', 'Granada', 'Plaza del Carmen', 'Plaza del Carmen, Granada', '2026-09-02', '20:00', 37.174107, -3.5988522, NULL, NULL, NULL, 'approved'),
  ('Almuñécar', 'Granada', 'Plaza de España', 'Plaza de España, Almuñécar, 18690', '2026-09-02', '20:00', 36.7337969, -3.6911076, NULL, NULL, NULL, 'approved'),
  ('Churriana de la Vega', 'Granada', 'Plaza de la Constitución', 'Plaza de la Constitución, Churriana de la Vega', '2026-09-02', '20:00', 37.1478348, -3.6462413, NULL, NULL, NULL, 'approved'),
  ('Loja', 'Granada', 'Puerta del Palacio de Narváez', 'Puerta del Palacio de Narváez, Loja', '2026-09-02', '20:00', 37.1523601, -4.2057079, 'El punto del mapa es aproximado: señala el centro del municipio', NULL, NULL, 'approved'),
  ('Motril', 'Granada', 'Plaza de España', 'Plaza de España, Motril', '2026-09-02', '20:00', 36.7451873, -3.5208166, NULL, NULL, NULL, 'approved'),
  ('Ogíjares', 'Granada', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Ogíjares, 18151', '2026-09-02', '20:00', 37.1200582, -3.6069119, NULL, NULL, NULL, 'approved'),
  ('Málaga', 'Málaga', 'Ayuntamiento de Málaga', 'Ayuntamiento de Málaga, Málaga, 29015', '2026-09-02', '20:00', 36.7203687, -4.4150247, NULL, NULL, NULL, 'approved'),
  ('Árchez', 'Málaga', 'Paseo del Río Turvilla', 'Paseo del Río Turvilla, Árchez', '2026-09-02', '20:00', 36.8390459, -3.9907148, 'El punto del mapa es aproximado: señala el centro del municipio', NULL, NULL, 'approved'),
  ('Alhaurín de la Torre', 'Málaga', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Alhaurín de la Torre, 29130', '2026-09-02', '20:00', 36.6616896, -4.5655804, NULL, NULL, NULL, 'approved'),
  ('Alhaurín el Grande', 'Málaga', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Alhaurín el Grande, 29120', '2026-09-02', '20:00', 36.6419103, -4.6917297, NULL, NULL, NULL, 'approved'),
  ('Antequera', 'Málaga', 'Plaza de la Constitución (Puerta de Estepa)', 'Plaza de la Constitución (Puerta de Estepa), Antequera, 29200', '2026-09-02', '20:00', 37.0218381, -4.5656866, NULL, NULL, NULL, 'approved'),
  ('Benahavís', 'Málaga', 'Ayuntamiento de Benahavís', 'Ayuntamiento de Benahavís, Benahavís, 29679', '2026-09-02', '20:00', 36.5184736, -5.0453293, NULL, NULL, NULL, 'approved'),
  ('Benalmádena', 'Málaga', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Benalmádena, 29639', '2026-09-02', '20:00', 36.5950065, -4.5733774, NULL, NULL, NULL, 'approved'),
  ('Benaoján', 'Málaga', 'Plaza de San Marcos', 'Plaza de San Marcos, Benaoján, 29370', '2026-09-02', '20:00', 36.718796, -5.2531734, NULL, NULL, NULL, 'approved'),
  ('Canillas de Aceituno', 'Málaga', 'Plaza de la Constitución', 'Plaza de la Constitución, Canillas de Aceituno', '2026-09-02', '20:00', 36.8731778, -4.0820778, NULL, NULL, NULL, 'approved'),
  ('Canillas de Albaida', 'Málaga', 'Plaza Nuestra Señora del Rosario', 'Plaza Nuestra Señora del Rosario, Canillas de Albaida', '2026-09-02', '20:00', 36.8461633, -3.9877126, NULL, NULL, NULL, 'approved'),
  ('Cortes de la Frontera', 'Málaga', 'Plaza Carlos III', 'Plaza Carlos III, Cortes de la Frontera, 29380', '2026-09-02', '20:00', 36.6171132, -5.3426671, NULL, NULL, NULL, 'approved'),
  ('Estepona', 'Málaga', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Estepona, 29680', '2026-09-02', '20:00', 36.4247785, -5.1498665, NULL, NULL, NULL, 'approved'),
  ('Fuengirola', 'Málaga', 'Plaza de España', 'Plaza de España, Fuengirola', '2026-09-02', '20:00', 36.5368729, -4.6264499, NULL, NULL, NULL, 'approved'),
  ('Gaucín', 'Málaga', 'Plaza del Santo Niño', 'Plaza del Santo Niño, Gaucín', '2026-09-02', '20:00', 36.5187311, -5.3176839, NULL, NULL, NULL, 'approved'),
  ('Jimera de Líbar', 'Málaga', 'Plaza Virgen de la Salud', 'Plaza Virgen de la Salud, Jimera de Líbar, 29392', '2026-09-02', '20:00', 36.6511711, -5.2740986, NULL, NULL, NULL, 'approved'),
  ('Manilva', 'Málaga', 'Plaza del Donante, Sabinillas, hasta calle Virgen de África', 'Plaza del Donante, Sabinillas, hasta calle Virgen de África, Manilva, 29691', '2026-09-02', '20:00', 36.367303, -5.227807, NULL, NULL, NULL, 'approved'),
  ('Marbella', 'Málaga', 'Parque de la Alameda', 'Parque de la Alameda, Marbella, 29602', '2026-09-02', '20:00', 36.5087178, -4.8857015, NULL, NULL, NULL, 'approved'),
  ('Mijas', 'Málaga', 'Mijas Pueblo (Ayuntamiento de Mijas)', 'Mijas Pueblo (Ayuntamiento de Mijas), Mijas, 29650', '2026-09-02', '20:00', 36.5965552, -4.6367511, NULL, NULL, NULL, 'approved'),
  ('Mijas', 'Málaga', 'Las Lagunas (Tenencia de Alcaldía)', 'Las Lagunas (Tenencia de Alcaldía), Mijas', '2026-09-02', '20:00', 36.5445591, -4.6396852, NULL, NULL, NULL, 'approved'),
  ('Mijas', 'Málaga', 'La Cala (Tenencia de Alcaldía)', 'La Cala (Tenencia de Alcaldía), Mijas', '2026-09-02', '20:00', 36.5043738, -4.6807143, NULL, NULL, NULL, 'approved'),
  ('Rincón de la Victoria', 'Málaga', 'Plaza Al-Andalus', 'Plaza Al-Andalus, Rincón de la Victoria', '2026-09-02', '20:00', 36.715627, -4.2854662, NULL, NULL, NULL, 'approved'),
  ('Ronda', 'Málaga', 'Plaza Duquesa de Parcent', 'Plaza Duquesa de Parcent, Ronda', '2026-09-02', '20:00', 36.7369254, -5.1653638, NULL, NULL, NULL, 'approved'),
  ('Sierra de Yeguas', 'Málaga', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Sierra de Yeguas, 29328', '2026-09-02', '20:00', 37.124639, -4.8687135, NULL, NULL, NULL, 'approved'),
  ('Torremolinos', 'Málaga', 'Plaza Blas Infante', 'Plaza Blas Infante, Torremolinos, 29620', '2026-09-02', '20:00', 36.6213562, -4.5077405, NULL, NULL, NULL, 'approved'),
  ('Vélez-Málaga', 'Málaga', 'Plaza de los Carmelitas', 'Plaza de los Carmelitas, Vélez-Málaga, 29700', '2026-09-02', '20:00', 36.781456, -4.1042865, NULL, NULL, NULL, 'approved'),
  ('Andújar', 'Jaén', 'Plaza de España', 'Plaza de España, Andújar', '2026-09-02', '20:00', 38.0372031, -4.0543265, NULL, NULL, NULL, 'approved'),
  ('Alcalá la Real', 'Jaén', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Alcalá la Real, 23680', '2026-09-02', '20:00', 37.4635096, -3.9250244, NULL, NULL, NULL, 'approved'),
  ('Baeza', 'Jaén', 'Puerta del Ayuntamiento', 'Puerta del Ayuntamiento, Baeza, 23440', '2026-09-02', '20:00', 37.9935455, -3.4697381, NULL, NULL, NULL, 'approved'),
  ('La Carolina', 'Jaén', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, La Carolina', '2026-09-02', '20:00', 38.2741414, -3.6157378, NULL, NULL, NULL, 'approved'),
  ('Los Villares', 'Jaén', 'Plaza Fernando Feijoo', 'Plaza Fernando Feijoo, Los Villares', '2026-09-02', '20:00', 37.6890726, -3.8184569, NULL, NULL, NULL, 'approved'),
  ('Linares', 'Jaén', 'Plaza del Ayuntamiento', 'Plaza del Ayuntamiento, Linares', '2026-09-02', '20:00', 38.0935469, -3.6359646, NULL, NULL, NULL, 'approved'),
  ('Melilla', 'Melilla', 'Monolito de la Constitución', 'Monolito de la Constitución, Melilla, 52001', '2026-09-02', '20:00', 35.2921882, -2.9379196, NULL, NULL, NULL, 'approved'),
  ('Ceuta', 'Ceuta', 'Murallas Reales', 'Murallas Reales, Ceuta, 51002', '2026-09-02', '19:00', 35.8889186, -5.3188995, 'Marcha desde las Murallas Reales hasta la Delegación del Gobierno', NULL, NULL, 'approved'),
  ('Ceuta', 'Ceuta', 'Plaza de los Reyes', 'Plaza de los Reyes, Ceuta', '2026-09-02', '20:00', 35.8871919, -5.308373, 'Frente a la Delegación del Gobierno', NULL, NULL, 'approved');
