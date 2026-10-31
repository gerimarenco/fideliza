-- Límites del registro separados por DNI, dispositivo e IP (ver
-- lib/limiteRegistro.js). Solo cambia "IntentoRegistro", la tabla de
-- conteo que creó la migración anterior de este mismo cambio
-- (20261031000000_dni_obligatorio): en producción se crean juntas, vacías.
-- No toca cuentas, puntos, canjes ni ninguna otra tabla.
--
-- Cada fila es un intento o un rechazo: el tipo de límite, el HMAC de lo que
-- se cuenta (nunca la IP, el documento ni la cookie en claro) y el negocio.
ALTER TABLE "IntentoRegistro" RENAME COLUMN "ipHash" TO "clave";
ALTER TABLE "IntentoRegistro" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'ip';
ALTER TABLE "IntentoRegistro" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "IntentoRegistro" ADD COLUMN "negocioId" TEXT;

DROP INDEX "IntentoRegistro_ipHash_createdAt_idx";
CREATE INDEX "IntentoRegistro_tipo_clave_createdAt_idx" ON "IntentoRegistro"("tipo", "clave", "createdAt");
CREATE INDEX "IntentoRegistro_tipo_negocioId_createdAt_idx" ON "IntentoRegistro"("tipo", "negocioId", "createdAt");
