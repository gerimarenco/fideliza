-- Dragon Fish (2026-11-11): datos de cada venta procesada, para reconocer a
-- la clienta por más datos y mostrar las ventas sin identificar. Columnas
-- nuevas vacías: no modifica ninguna fila existente.
ALTER TABLE "FacturaPendiente" ADD COLUMN "monto" DOUBLE PRECISION;
ALTER TABLE "FacturaPendiente" ADD COLUMN "nombreFicha" TEXT;
ALTER TABLE "FacturaPendiente" ADD COLUMN "clienteId" TEXT;
ALTER TABLE "FacturaPendiente" ADD COLUMN "identificadaPor" TEXT;
ALTER TABLE "FacturaPendiente" ADD COLUMN "procesadaEn" TIMESTAMP(3);
