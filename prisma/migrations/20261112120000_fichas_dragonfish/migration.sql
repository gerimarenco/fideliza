-- Fichas de Dragon Fish vinculadas a cuentas de Retornar (2026-11-12). Tabla
-- nueva y columnas vacías: no modifica ninguna fila existente.
ALTER TABLE "FacturaPendiente" ADD COLUMN "codigoFicha" TEXT;
ALTER TABLE "FacturaPendiente" ADD COLUMN "candidatas" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "FichaDragonfish" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombreFicha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichaDragonfish_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FichaDragonfish_negocioId_codigo_key" ON "FichaDragonfish"("negocioId", "codigo");

CREATE INDEX "FichaDragonfish_clienteId_idx" ON "FichaDragonfish"("clienteId");

ALTER TABLE "FichaDragonfish" ADD CONSTRAINT "FichaDragonfish_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
