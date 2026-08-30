-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "dragonfishAgentToken" TEXT,
ADD COLUMN     "dragonfishBaseDeDatos" TEXT;

-- CreateTable
CREATE TABLE "FacturaPendiente" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "resultado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacturaPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacturaPendiente_negocioId_procesado_idx" ON "FacturaPendiente"("negocioId", "procesado");

-- CreateIndex
CREATE UNIQUE INDEX "FacturaPendiente_negocioId_codigo_key" ON "FacturaPendiente"("negocioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_dragonfishBaseDeDatos_key" ON "Negocio"("dragonfishBaseDeDatos");

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_dragonfishAgentToken_key" ON "Negocio"("dragonfishAgentToken");

-- AddForeignKey
ALTER TABLE "FacturaPendiente" ADD CONSTRAINT "FacturaPendiente_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

