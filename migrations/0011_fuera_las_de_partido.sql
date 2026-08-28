-- Fuera las ocho convocatorias que convoca un partido.
--
-- Esta web se presenta como convocatoria ciudadana sin partido ni organización
-- detrás. Publicar actos de PP, VOX o Nuevas Generaciones junto a los demás
-- convierte esa frase en falsa, y ponerles el convocante al lado no basta:
-- quien mira el mapa ve un punto igual que todos.
--
-- Dos de ellas eran lo único que había en su provincia, así que Álava y Soria
-- vuelven a quedarse sin nada. Sale más caro tener el mapa lleno que tenerlo
-- cierto.
--
-- La de Soria es la discutible: su origen es un llamamiento de la FEMP, que es
-- institucional, y el PP local sólo lo difundía. Se va con las otras porque no
-- consta que la convoque el ayuntamiento, y ante la duda es mejor faltar que
-- atribuirle a un consistorio algo que no ha hecho.

DELETE FROM places WHERE status='approved' AND organizer IN (
  'PP de Vitoria-Gasteiz',
  'VOX Caudete',
  'PP de Almagro',
  'Nuevas Generaciones de Conil',
  'PP de Alcorcón',
  'PP de Casarrubios del Monte',
  'VOX Massalfassar'
);

-- La de Soria entró sin convocante en el campo: su nota decía «difundido por»
-- en vez de «convoca», así que la extracción no la vio.
DELETE FROM places WHERE status='approved' AND city='Soria' AND province='Soria'
  AND venue LIKE '%Plaza Mayor%';
