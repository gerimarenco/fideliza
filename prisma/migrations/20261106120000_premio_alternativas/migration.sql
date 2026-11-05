-- Enlaces con stock (2026-11-06): variante a la que apunta el enlace de un
-- premio y hasta 3 productos alternativos. Solo agrega una columna vacía y
-- una tabla nueva: no modifica ninguna fila existente.
ALTER TABLE "Premio" ADD COLUMN "tiendanubeVarianteId" TEXT;

CREATE TABLE "PremioAlternativa" (
    "id" TEXT NOT NULL,
    "premioId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tiendanubeProductoId" TEXT NOT NULL,
    "tiendanubeVarianteId" TEXT,
    "nombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremioAlternativa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PremioAlternativa_premioId_idx" ON "PremioAlternativa"("premioId");

ALTER TABLE "PremioAlternativa" ADD CONSTRAINT "PremioAlternativa_premioId_fkey" FOREIGN KEY ("premioId") REFERENCES "Premio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
