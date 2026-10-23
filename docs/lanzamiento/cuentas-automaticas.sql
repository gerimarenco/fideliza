-- Cuentas que Dragon Fish creó solas antes de que se sacara esa función
-- (2026-09-22, ver docs/tareas-futuras.md ítem 52).
--
-- SOLO LECTURA: estas consultas no modifican nada. Correrlas en una consola
-- SQL de la base de producción (o mejor, en una copia restaurada).
-- No borrar ni modificar nada sin un backup verificado y sin la aprobación
-- de Genaro sobre el criterio y la lista final.
--
-- Criterio: el viejo flujo de Dragon Fish creaba la cuenta y le acreditaba
-- la compra en el mismo pedido, así que la cuenta tiene un movimiento de
-- origen 'dragonfish' a menos de 2 minutos de su creación. Una clienta que se
-- registró sola nunca tiene eso (su cuenta existe antes de cualquier compra).
-- No hay ningún otro campo en el esquema que distinga estas cuentas.

-- 1) Resumen: cuántas cuentas cumplen el criterio y cuántas tuvieron
--    actividad propia después (señal de que la persona sí usa la cuenta).
WITH automaticas AS (
  SELECT c.id, c."createdAt", c.puntos, c.dni IS NOT NULL AS tiene_dni
  FROM "Cliente" c
  WHERE c."createdAt" < '2026-09-23'
    AND EXISTS (
      SELECT 1 FROM "MovimientoPuntos" m
      WHERE m."clienteId" = c.id
        AND m.origen = 'dragonfish'
        AND m."createdAt" BETWEEN c."createdAt" AND c."createdAt" + interval '2 minutes'
    )
),
actividad AS (
  SELECT a.id,
    (SELECT count(*) FROM "Canje" k WHERE k."clienteId" = a.id) AS canjes,
    (SELECT count(*) FROM "MovimientoPuntos" m WHERE m."clienteId" = a.id AND m.origen IN ('tiendanube', 'manual', 'mercadopago')) AS compras_otros_canales,
    (SELECT count(*) FROM "PasswordResetToken" t WHERE t."usuarioId" = a.id AND t.tipo = 'cliente') AS pidio_cambio_clave,
    (SELECT count(*) FROM "Cliente" r WHERE r."referidoPorId" = a.id) AS invito_amigas
  FROM automaticas a
)
SELECT
  count(*) AS cuentas_automaticas,
  count(*) FILTER (WHERE a.tiene_dni) AS completaron_registro,
  count(*) FILTER (WHERE x.canjes > 0) AS con_canjes,
  count(*) FILTER (WHERE x.compras_otros_canales > 0) AS con_compras_por_otros_canales,
  count(*) FILTER (WHERE x.pidio_cambio_clave > 0) AS pidieron_cambio_de_clave,
  count(*) FILTER (WHERE x.invito_amigas > 0) AS invitaron_amigas,
  count(*) FILTER (WHERE NOT a.tiene_dni AND x.canjes = 0 AND x.compras_otros_canales = 0 AND x.pidio_cambio_clave = 0 AND x.invito_amigas = 0) AS sin_ninguna_actividad_propia,
  sum(a.puntos) AS puntos_totales_en_juego
FROM automaticas a JOIN actividad x ON x.id = a.id;

-- 2) Detalle por cuenta, sin datos personales (solo id, fechas y conteos),
--    para revisar caso por caso antes de decidir.
WITH automaticas AS (
  SELECT c.id, c."createdAt", c.puntos, c.dni IS NOT NULL AS tiene_dni
  FROM "Cliente" c
  WHERE c."createdAt" < '2026-09-23'
    AND EXISTS (
      SELECT 1 FROM "MovimientoPuntos" m
      WHERE m."clienteId" = c.id
        AND m.origen = 'dragonfish'
        AND m."createdAt" BETWEEN c."createdAt" AND c."createdAt" + interval '2 minutes'
    )
)
SELECT a.id, a."createdAt", a.puntos, a.tiene_dni,
  (SELECT count(*) FROM "Canje" k WHERE k."clienteId" = a.id) AS canjes,
  (SELECT count(*) FROM "MovimientoPuntos" m WHERE m."clienteId" = a.id) AS movimientos,
  (SELECT max(m."createdAt") FROM "MovimientoPuntos" m WHERE m."clienteId" = a.id) AS ultima_actividad
FROM automaticas a
ORDER BY a."createdAt";

-- Propuesta (NO ejecutar todavía): solo las cuentas "sin ninguna actividad
-- propia" del resumen son candidatas a retirarse. Antes de cualquier
-- borrado: (1) backup verificado restaurándolo en una base aparte, (2) copia
-- de esas filas y de sus MovimientoPuntos a una tabla de respaldo, (3)
-- aprobación de Genaro sobre la lista. Una clienta con canjes, compras
-- online, cambio de clave o referidas se conserva siempre.
