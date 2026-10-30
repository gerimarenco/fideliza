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
-- "Celular" = últimos 10 dígitos (lib/bienvenida.js, celularComparable): de
-- varias cuentas con el mismo celular, solo la primera en registrarse.
WITH negocio AS (
  SELECT id FROM "Negocio" WHERE slug = 'peperina'
),
periodo AS (
  SELECT c.id,
         c."createdAt",
         c."fechaNacimiento" IS NOT NULL AS autoregistrada,
         right(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), 10) AS celular
  FROM "Cliente" c
  JOIN negocio n ON c."negocioId" = n.id
  WHERE c."createdAt" >= TIMESTAMP '2026-10-30 03:00:00'
    AND c."createdAt" < (now() AT TIME ZONE 'UTC')
),
orden AS (
  SELECT *,
         row_number() OVER (PARTITION BY celular ORDER BY "createdAt", id) AS n
  FROM periodo
  WHERE autoregistrada
)
SELECT
  (SELECT count(*) FROM periodo)                              AS cuentas_en_el_periodo,
  (SELECT count(*) FROM periodo WHERE NOT autoregistrada)     AS creadas_por_el_negocio,
  (SELECT count(*) FROM periodo WHERE autoregistrada)         AS autoregistradas,
  (SELECT count(*) FROM orden WHERE n = 1 OR celular = '')    AS recibirian_150,
  (SELECT count(*) FROM orden WHERE n > 1 AND celular <> '')  AS omitidas_por_celular_repetido,
  (SELECT min("createdAt") FROM periodo)                      AS primera_cuenta_utc,
  (SELECT max("createdAt") FROM periodo)                      AS ultima_cuenta_utc;
