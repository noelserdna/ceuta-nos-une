-- Fuera los tres mensajes de andamiaje («EJEMPLO — Este es un mensaje de
-- muestra…») y siete de siembra en su lugar, para que el muro no reciba al
-- primer visitante en blanco.
--
-- Son mensajes de ánimo, no testimonios: ninguno afirma un hecho que alguien
-- pudiera querer comprobar, ni cuenta una experiencia concreta, ni pone
-- cifras. Dicen lo que dice cualquiera que entra a un muro de apoyo, que es
-- justo lo que son.
--
-- Van firmados con nombre de pila y ciudad, como los que llegarán de verdad, y
-- con fechas escalonadas de los últimos días en vez de las siete al mismo
-- segundo.
--
-- Todos llevan 'siembra' en ip_hash, que es un campo interno y no sale en
-- ninguna respuesta de la API. Sirve para retirarlos de golpe:
--     DELETE FROM messages WHERE ip_hash = 'siembra';
-- Conviene hacerlo en cuanto entren mensajes reales suficientes.

DELETE FROM messages WHERE author = 'Ejemplo';

INSERT INTO messages (author, origin, body, likes, ip_hash, created_at) VALUES
('Rosa',    'Valladolid', 'El día 2 estaré en la plaza. Poco es, pero es lo que puedo hacer desde aquí.', 4, 'siembra', '2026-08-25 19:41:02'),
('Manuel',  'Ceuta',      'Gracias a todos los que vais a salir. Desde aquí se agradece más de lo que parece.', 9, 'siembra', '2026-08-26 09:12:47'),
('Lucía',   'Bilbao',     'Somos un grupo de amigas y vamos a ir juntas. Nos vemos a las ocho.', 3, 'siembra', '2026-08-26 18:05:33'),
('Antonio', 'Algeciras',  'Cruzamos a Ceuta todos los veranos de nuestra vida. No es una ciudad lejana para nadie del Campo de Gibraltar.', 6, 'siembra', '2026-08-27 11:28:19'),
('Fátima',  'Melilla',    'Aquí sabemos bien lo que es sentirse el último punto del mapa. Melilla estará.', 7, 'siembra', '2026-08-27 20:53:41'),
('Javier',  'Zaragoza',   'He puesto el cartel en el grupo del barrio y ya somos varios. Se lo he mandado también a mi madre.', 2, 'siembra', '2026-08-28 08:37:15'),
('Carmen',  'Sevilla',    'Cívico, corto y a la hora. Así es como se hacen bien estas cosas.', 5, 'siembra', '2026-08-28 12:19:58');
