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
-- "Autoregistradas" = Cliente.origen = 'registro' o, en las cuentas
-- anteriores al 2026-11-02 (sin origen), las que tienen fecha de nacimiento
-- (que entonces solo pedía el registro; desde ese día "Nuevo cliente" del
-- panel también la pide). Solo esas recibirían la bonificación, como en el
-- registro. Usa la columna "origen" (migración 20261102120000_cliente_origen):
-- antes de publicarla, usar la versión de esta consulta que está en main.
-- "Celular" = últimos 10 dígitos (lib/bienvenida.js, celularComparable).
-- Misma regla que el registro y el script (motivoSinBienvenida): una cuenta
-- no la recibe si su celular coincide con CUALQUIER otra cuenta del negocio
-- creada antes, de cualquier fecha (también una clienta histórica), ni si no
-- tiene celular.
-- Aproximada: compara los últimos 10 dígitos y no reconoce el mismo celular
-- escrito con "15" (por ejemplo "02324 15 555000"). La simulación del script
-- (scripts/bienvenida-retroactiva.mjs, sin --aplicar) usa la regla exacta
-- (mismoCelular en lib/bienvenida.js) y es la que vale.
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
         (c."origen" = 'registro' OR (c."origen" IS NULL AND c."fechaNacimiento" IS NOT NULL)) AS autoregistrada,
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
