-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "dragonfishUltimoContacto" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FacturaPendiente" ADD COLUMN     "intentos" INTEGER NOT NULL DEFAULT 0;
