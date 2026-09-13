-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "codigoReferido" TEXT,
ADD COLUMN     "referidoPorId" TEXT,
ADD COLUMN     "referidoRecompensado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "puntosReferido" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_codigoReferido_key" ON "Cliente"("codigoReferido");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_referidoPorId_fkey" FOREIGN KEY ("referidoPorId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
