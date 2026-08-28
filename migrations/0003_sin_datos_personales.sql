-- Se deja de pedir nombre, correo y teléfono a quien propone un lugar: la web
-- no trata ningún dato personal identificativo, así que no hay nada que
-- amparar bajo el RGPD.
--
-- SQLite no permite quitar columnas de forma segura en todas las versiones, y
-- tampoco haría falta: lo que importa es que no quede ningún dato guardado y
-- que el código deje de escribirlas. Se vacían las que ya había.

UPDATE places
   SET submitter_name  = NULL,
       submitter_email = NULL,
       submitter_phone = NULL
 WHERE submitter_name IS NOT NULL
    OR submitter_email IS NOT NULL
    OR submitter_phone IS NOT NULL;
