-- Identificación de cuentas para la bonificación de bienvenida retroactiva
-- (ver scripts/bienvenida-retroactiva.mjs). SOLO LECTURA: un único SELECT,
-- no modifica nada.
--
-- Funciona antes de publicar el PR #122 (no usa las columnas nuevas): cuenta
-- las cuentas de Club Peperina creadas desde el 30/10/2026 00:00 de Argentina
-- (03:00 UTC) hasta ahora. Después de publicar, reemplazar now() por el
-- momento de la publicación (UTC), o usar directamente el script en modo
-- simulación, que además descuenta las que ya la recibieron.
--
-- "Autoregistradas" = tienen fecha de nacimiento: el registro público la pide
-- y el alta manual del negocio ("Nuevo cliente") no la carga. Solo esas
-- recibirían la bonificación, como en el registro.
-- "Celular" = últimos 10 dígitos (lib/bienvenida.js, celularComparable).
-- Misma regla que el registro y el script (motivoSinBienvenida): una cuenta
-- no la recibe si su celular coincide con CUALQUIER otra cuenta del negocio
-- creada antes, de cualquier fecha (también una clienta histórica), ni si no
-- tiene celular.
WITH negocio AS (
  SELECT id FROM "Negocio" WHERE slug = 'peperina'
),
todas AS (
  SELECT c.id,
         c."createdAt",
         right(regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g'), 10) AS celular
  FROM "Cliente" c
  JOIN negocio n ON c."negocioId" = n.id
),
periodo AS (
  SELECT c.id,
         c."createdAt",
         c."fechaNacimiento" IS NOT NULL AS autoregistrada,
         right(regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g'), 10) AS celular
  FROM "Cliente" c
  JOIN negocio n ON c."negocioId" = n.id
  WHERE c."createdAt" >= TIMESTAMP '2026-10-30 03:00:00'
    AND c."createdAt" < (now() AT TIME ZONE 'UTC')
),
evaluadas AS (
  SELECT p.*,
         EXISTS (
           SELECT 1 FROM todas t
           WHERE t.celular = p.celular
             AND t.id <> p.id
             AND (t."createdAt" < p."createdAt" OR (t."createdAt" = p."createdAt" AND t.id < p.id))
         ) AS celular_en_otra_cuenta
  FROM periodo p
  WHERE p.autoregistrada
)
SELECT
  (SELECT count(*) FROM periodo)                                                    AS cuentas_en_el_periodo,
  (SELECT count(*) FROM periodo WHERE NOT autoregistrada)                           AS creadas_por_el_negocio,
  (SELECT count(*) FROM evaluadas)                                                  AS autoregistradas,
  (SELECT count(*) FROM evaluadas WHERE celular <> '' AND NOT celular_en_otra_cuenta) AS recibirian_150,
  (SELECT count(*) FROM evaluadas WHERE celular <> '' AND celular_en_otra_cuenta)   AS sin_bonificacion_celular_en_otra_cuenta,
  (SELECT count(*) FROM evaluadas WHERE celular = '')                               AS sin_bonificacion_sin_celular,
  (SELECT min("createdAt") FROM periodo)                                            AS primera_cuenta_utc,
  (SELECT max("createdAt") FROM periodo)                                            AS ultima_cuenta_utc;
