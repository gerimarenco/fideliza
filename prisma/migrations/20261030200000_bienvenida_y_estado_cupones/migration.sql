-- Bonificación de bienvenida configurable por negocio.
ALTER TABLE "Negocio" ADD COLUMN "bienvenidaPuntos" INTEGER;
ALTER TABLE "Negocio" ADD COLUMN "bienvenidaDesde" TIMESTAMP(3);
ALTER TABLE "Negocio" ADD COLUMN "bienvenidaHasta" TIMESTAMP(3);
ALTER TABLE "Cliente" ADD COLUMN "bienvenidaOtorgada" BOOLEAN NOT NULL DEFAULT false;

-- Estado de los cupones de canje según Tiendanube.
ALTER TABLE "Canje" ADD COLUMN "cuponEstado" TEXT;
ALTER TABLE "Canje" ADD COLUMN "cuponVerificadoEn" TIMESTAMP(3);
ALTER TABLE "Canje" ADD COLUMN "cuponUsadoEn" TIMESTAMP(3);
ALTER TABLE "Canje" ADD COLUMN "cuponPedidoId" TEXT;

-- Promoción de Club Peperina (pedido de Genaro): 150 puntos para las cuentas
-- creadas del 30/10/2026 al 7/11/2026 inclusive, en hora de Argentina
-- (00:00 del 30/10 = 03:00 UTC; termina a las 00:00 del 8/11 = 03:00 UTC).
-- Solo configura la promoción: no toca puntos ni cuentas existentes. Se
-- puede cambiar después desde Ajustes.
UPDATE "Negocio"
SET "bienvenidaPuntos" = 150,
    "bienvenidaDesde" = '2026-10-30 03:00:00',
    "bienvenidaHasta" = '2026-11-08 03:00:00'
WHERE "slug" = 'peperina';
