-- Revisión de DNI repetidos en las cuentas existentes. SOLO LECTURA: no
-- modifica nada. Correrla antes de publicar el DNI obligatorio y guardar el
-- resultado.
--
-- Las cuentas con DNI se crearon entre septiembre y el 24/10/2026, cuando el
-- DNI se pedía sin control de repetidos. La migración
-- 20261031000000_dni_obligatorio deja esas cuentas fuera del índice único
-- (no puede fallar por ellas) y el registro las controla igual.
--
-- No muestra los documentos: solo cuántas cuentas comparten cada uno, por
-- negocio, con los ids para revisarlas a mano. Si hay repetidos NO se borran
-- ni se fusionan solos: ver docs/tareas-futuras.md, ítem 76.

-- 1) Resumen: cuentas con DNI y grupos repetidos por negocio.
SELECT n.slug AS negocio,
       count(*) FILTER (WHERE c."dni" IS NOT NULL) AS cuentas_con_dni,
       count(*) FILTER (WHERE c."dni" IS NULL) AS cuentas_sin_dni
FROM "Cliente" c
JOIN "Negocio" n ON n.id = c."negocioId"
GROUP BY n.slug
ORDER BY n.slug;

-- 2) Documentos repetidos dentro de un mismo negocio (comparados como el
--    registro: solo dígitos, sin ceros adelante). Una fila por grupo.
SELECT n.slug AS negocio,
       count(*) AS cuentas,
       array_agg(c.id ORDER BY c."createdAt") AS ids_por_antiguedad,
       min(c."createdAt") AS primera,
       max(c."createdAt") AS ultima
FROM "Cliente" c
JOIN "Negocio" n ON n.id = c."negocioId"
WHERE c."dni" IS NOT NULL
GROUP BY n.slug, c."negocioId", ltrim(regexp_replace(c."dni", '[^0-9]', '', 'g'), '0')
HAVING count(*) > 1
ORDER BY cuentas DESC, primera;
