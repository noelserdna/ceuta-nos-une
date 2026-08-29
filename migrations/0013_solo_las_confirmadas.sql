-- Se retiran 92 concentraciones que el listado oficial de «Ceuta nos une»
-- del 29 de agosto no confirma, y se corrigen las horas que sí cambia.
--
-- Ninguna se borra: pasan a status='rejected' con el motivo en review_note. Se
-- ven en /admin y vuelven con un UPDATE. Importa porque el propio cartel se
-- presenta como «un recopilatorio de las PRINCIPALES convocatorias oficiales»,
-- no como lista cerrada: 87 de estas no están desmentidas, sólo no salen.
--
--     1  el cartel dice que no se suma: Jaén capital, que «no participará»
--        aunque sus municipios sí
--     4  marcadas con asterisco, sin fuente de confirmación: Gijón,
--        Santander, Huelva y Bilbao, difundidas en redes
--    87  no aparecen
--
-- Se busca por ciudad, provincia y sitio, nunca por id: los ids cambian al
-- reconstruir la base desde las migraciones y esto tiene que poder repetirse.
-- Se descubrió probándolo en local, donde los UPDATE por id no tocaban nada.

UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Albatera' AND province='Alicante' AND venue='Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Calp' AND province='Alicante' AND venue='Plaza Miguel Roselló';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Granja de Rocamora' AND province='Alicante' AND venue='Junto al Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Guardamar del Segura' AND province='Alicante' AND venue='Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Polop de la Marina' AND province='Alicante' AND venue='Puertas del Ayuntamiento, Av. de Sagi Barba 34';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Santa Pola' AND province='Alicante' AND venue='Inicio del Paseo Adolfo Suárez';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Sax' AND province='Alicante' AND venue='Plaza ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Teulada' AND province='Alicante' AND venue='Plaça de l''Ajuntament';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Torrevieja' AND province='Alicante' AND venue='Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Vila Joiosa, la/Villajoyosa' AND province='Alicante' AND venue='Parque de la Barbera dels Aragonés';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Xàbia/Jávea' AND province='Alicante' AND venue='Plaça de l''Església, frente al Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Albox' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Alhabia' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Arboleas' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Cuevas del Almanzora' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Fines' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Garrucha' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Gádor' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Huércal de Almería' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Huércal-Overa' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Macael' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Níjar' AND province='Almería' AND venue='Plaza de la Glorieta';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Zurgena' AND province='Almería' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='el listado oficial la marca sin confirmar: sin datos de convocatoria oficial' WHERE status='approved' AND city='Gijón' AND province='Asturias' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Lena' AND province='Asturias' AND venue='Frente al Ayuntamiento de Lena, C. Vital Aza 20';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Azuaga' AND province='Badajoz' AND venue='Plaza de La Merced';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Fregenal de la Sierra' AND province='Badajoz' AND venue='Paseo de la Constitución, 1';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Los Santos de Maimona' AND province='Badajoz' AND venue='Puerta del Ayuntamiento, Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Valencia del Mombuey' AND province='Badajoz' AND venue='Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='L''Hospitalet de Llobregat' AND province='Barcelona' AND venue='Plaça de l''Ajuntament, frente al Ayuntamiento';
UPDATE places SET status='rejected', review_note='el listado oficial la marca sin confirmar: ubicación no especificada' WHERE status='approved' AND city='Santander' AND province='Cantabria' AND venue='Plaza del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Almassora' AND province='Castellón' AND venue='Puertas del Ayuntamiento, Plaça de Pere Cornell';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Borriana/Burriana' AND province='Castellón' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Nules' AND province='Castellón' AND venue='Faro Playa Nules';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Guadalmez' AND province='Ciudad Real' AND venue='Puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Miguelturra' AND province='Ciudad Real' AND venue='Plaza de España, frente al Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Horcajo de Santiago' AND province='Cuenca' AND venue='Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Casar de Cáceres' AND province='Cáceres' AND venue='Puertas del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='El Puerto de Santa María' AND province='Cádiz' AND venue='Plaza Isaac Peral, ante el Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Vejer de la Frontera' AND province='Cádiz' AND venue='Plaza de España, ante el Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Bujalance' AND province='Córdoba' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Cañete de las Torres' AND province='Córdoba' AND venue='Puerta del Ayuntamiento, Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='El Carpio' AND province='Córdoba' AND venue='Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Rute' AND province='Córdoba' AND venue='Ayuntamiento de Rute';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Villa del Río' AND province='Córdoba' AND venue='Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Alovera' AND province='Guadalajara' AND venue='Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Torrejón del Rey' AND province='Guadalajara' AND venue='Frente al Ayuntamiento, Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Aracena' AND province='Huelva' AND venue='Plaza Marqués de Aracena';
UPDATE places SET status='rejected', review_note='el listado oficial la marca sin confirmar: pendiente de confirmar' WHERE status='approved' AND city='Huelva' AND province='Huelva' AND venue='Plaza del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='La Palma del Condado' AND province='Huelva' AND venue='Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Monzón' AND province='Huesca' AND venue='Plaza Mayor, 4 (frente al Ayuntamiento)';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Bailén' AND province='Jaén' AND venue='Puertas del Ayuntamiento';
UPDATE places SET status='rejected', review_note='el listado oficial dice que no se suma: la capital NO participará; los municipios de la provincia sí' WHERE status='approved' AND city='Jaén' AND province='Jaén' AND venue='Plaza de las Batallas';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Astorga' AND province='León' AND venue='Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Alcobendas' AND province='Madrid' AND venue='Plaza Mayor, frente al Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Arroyomolinos' AND province='Madrid' AND venue='Plaza Mayor del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Boadilla del Monte' AND province='Madrid' AND venue='Ayuntamiento de Boadilla, Sede Administrativa';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Brunete' AND province='Madrid' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Chinchón' AND province='Madrid' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Colmenar Viejo' AND province='Madrid' AND venue='Plaza del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Colmenarejo' AND province='Madrid' AND venue='Plaza de la Constitución, puerta del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='El Escorial' AND province='Madrid' AND venue='Ayuntamiento de El Escorial, Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Fuenlabrada' AND province='Madrid' AND venue='Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Griñón' AND province='Madrid' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Guadarrama' AND province='Madrid' AND venue='Plaza Mayor, frente al Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Hoyo de Manzanares' AND province='Madrid' AND venue='Plaza Mayor, frente al Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Las Rozas de Madrid' AND province='Madrid' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Loeches' AND province='Madrid' AND venue='Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Majadahonda' AND province='Madrid' AND venue='Frente al Ayuntamiento, Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Navacerrada' AND province='Madrid' AND venue='Ayuntamiento de Navacerrada, Plaza de los Ángeles 1';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Paracuellos de Jarama' AND province='Madrid' AND venue='Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Pinto' AND province='Madrid' AND venue='Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Torrejón de la Calzada' AND province='Madrid' AND venue='Plaza de España';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Torrelodones' AND province='Madrid' AND venue='Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Alcantarilla' AND province='Murcia' AND venue='Plaza de San Pedro, frente al Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Caravaca de la Cruz' AND province='Murcia' AND venue='Plaza del Arco';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Jumilla' AND province='Murcia' AND venue='Parking piscina cubierta';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Mazarrón' AND province='Murcia' AND venue='Puertas del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Archidona' AND province='Málaga' AND venue='Plaza Ochavada';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Coín' AND province='Málaga' AND venue='Plaza Alameda';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Nerja' AND province='Málaga' AND venue='Bajos del Ayuntamiento de Nerja (Plaza de España)';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Nueva Andalucía' AND province='Málaga' AND venue='Centro Polivalente';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Bargas' AND province='Toledo' AND venue='Plaza del Ayuntamiento / Plaza de la Constitución';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Dosbarrios' AND province='Toledo' AND venue='Puerta del ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Ocaña' AND province='Toledo' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Villatobas' AND province='Toledo' AND venue='Plaza del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Yepes' AND province='Toledo' AND venue='Plaza Mayor';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Gandia' AND province='Valencia' AND venue='Plaza del Ayuntamiento';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='L''Alcúdia de Crespins' AND province='Valencia' AND venue='Puertas del Ayuntamiento, Plaça de la Constitució 3';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='La Pobla de Vallbona' AND province='Valencia' AND venue='Centro Social';
UPDATE places SET status='rejected', review_note='el listado oficial la marca sin confirmar: convocatoria difundida, sin fuente de confirmación' WHERE status='approved' AND city='Bilbao' AND province='Vizcaya' AND venue='Plaza Moyúa';
UPDATE places SET status='rejected', review_note='no aparece en el listado oficial del 29 de agosto' WHERE status='approved' AND city='Caspe' AND province='Zaragoza' AND venue='Puertas de la Casa Consistorial, Plaza de España 1';

-- ---------------------------------------------------------------------------
-- Horas que el listado oficial corrige en lugares que ya teníamos.
-- ---------------------------------------------------------------------------

-- Canarias entera va a las 19:00, hora canaria. Sólo lo teníamos así en Telde y
-- Puerto del Rosario; las dos capitales estaban a las 20:00, que allí es una
-- hora después de que todo haya acabado.
UPDATE places SET event_time='19:00',
  notes=TRIM(COALESCE(notes || ' ', '') || '19:00 hora canaria.')
  WHERE status='approved' AND city='Las Palmas de Gran Canaria' AND event_time='20:00';
UPDATE places SET event_time='19:00',
  notes=TRIM(COALESCE(notes || ' ', '') || '19:00 hora canaria.')
  WHERE status='approved' AND city='Santa Cruz de Tenerife' AND event_time='20:00';

-- Mérida la adelanta a mediodía por su feria.
UPDATE places SET event_time='12:00',
  notes=TRIM(COALESCE(notes || ' ', '') || 'A las 12:00 por la feria de la ciudad.')
  WHERE status='approved' AND city='Mérida' AND province='Badajoz';

-- Espartinas, también a mediodía.
UPDATE places SET event_time='12:00'
  WHERE status='approved' AND city='Espartinas' AND province='Sevilla';

-- La marcha de Sevilla del 3 de septiembre queda anulada: el cartel la
-- reunifica con la del día 2, que ya está publicada. Se retira en vez de
-- moverla, porque cambiar de día una marcha con su recorrido sería inventarse
-- un dato que el cartel no da.
UPDATE places SET status='rejected',
  review_note='Anulada: el listado oficial del 29 de agosto la reunifica con la concentración del día 2'
  WHERE status='approved' AND city='Sevilla' AND event_date='2026-09-03';
