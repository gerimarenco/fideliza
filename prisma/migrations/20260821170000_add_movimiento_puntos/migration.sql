-- CreateTable
CREATE TABLE "MovimientoPuntos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "puntos" INTEGER NOT NULL,
    "origen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoPuntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimientoPuntos_negocioId_createdAt_idx" ON "MovimientoPuntos"("negocioId", "createdAt");
