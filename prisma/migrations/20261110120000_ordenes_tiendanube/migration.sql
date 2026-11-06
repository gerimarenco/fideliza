-- Acreditación de compras de Tiendanube (2026-11-10): registro de cada orden
-- recibida y fecha desde la que concilia la tarea programada. Tabla nueva y
-- columna nueva vacía: no modifica ninguna fila existente.
ALTER TABLE "Negocio" ADD COLUMN "tiendanubeConciliarDesde" TIMESTAMP(3);

CREATE TABLE "OrdenTiendanube" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "numero" TEXT,
    "estado" TEXT NOT NULL,
    "motivo" TEXT,
    "emailOculto" TEXT,
    "total" DOUBLE PRECISION,
    "pagadaEn" TIMESTAMP(3),
    "clienteId" TEXT,
    "puntos" INTEGER,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "via" TEXT NOT NULL,
    "recibidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadaEn" TIMESTAMP(3),

    CONSTRAINT "OrdenTiendanube_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrdenTiendanube_negocioId_orderId_key" ON "OrdenTiendanube"("negocioId", "orderId");

CREATE INDEX "OrdenTiendanube_negocioId_estado_idx" ON "OrdenTiendanube"("negocioId", "estado");

ALTER TABLE "OrdenTiendanube" ADD CONSTRAINT "OrdenTiendanube_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
