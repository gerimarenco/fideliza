-- AlterTable
ALTER TABLE "MovimientoPuntos" ADD COLUMN     "saldoRestante" INTEGER;

-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "vencimientoPuntosMeses" INTEGER;

-- CreateIndex
CREATE INDEX "MovimientoPuntos_clienteId_saldoRestante_idx" ON "MovimientoPuntos"("clienteId", "saldoRestante");
