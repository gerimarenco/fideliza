-- Canje: clave de idempotencia y datos del premio al momento del canje.
-- Columnas nuevas y opcionales: los canjes existentes quedan igual (null).
ALTER TABLE "Canje" ADD COLUMN "claveIdempotencia" TEXT;
ALTER TABLE "Canje" ADD COLUMN "premioNombre" TEXT;
ALTER TABLE "Canje" ADD COLUMN "puntosUsados" INTEGER;
ALTER TABLE "Canje" ADD COLUMN "premioBeneficio" JSONB;
CREATE UNIQUE INDEX "Canje_claveIdempotencia_key" ON "Canje"("claveIdempotencia");

-- MovimientoPuntos: cuándo salió el mail de puntos vencidos.
ALTER TABLE "MovimientoPuntos" ADD COLUMN "avisoVencidoEn" TIMESTAMP(3);
-- Los vencimientos ya registrados se mandaban en el momento: se marcan como
-- avisados para que la tarea no los vuelva a mandar. Solo completa la
-- columna nueva; no toca puntos, saldos ni ningún otro dato.
UPDATE "MovimientoPuntos" SET "avisoVencidoEn" = "createdAt" WHERE "origen" = 'vencimiento';
