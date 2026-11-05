-- Exportar clientes a Google Sheets (2026-11-09): conexión de cada negocio
-- con su cuenta de Google. Tabla nueva y vacía: no modifica ninguna fila
-- existente.
CREATE TABLE "ConexionGoogle" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "email" TEXT,
    "refreshTokenCifrado" TEXT NOT NULL,
    "conectadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hojaId" TEXT,
    "hojaNombre" TEXT,
    "exportandoDesde" TIMESTAMP(3),
    "ultimaExportacionEn" TIMESTAMP(3),
    "ultimaExportacionInfo" TEXT,

    CONSTRAINT "ConexionGoogle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConexionGoogle_negocioId_key" ON "ConexionGoogle"("negocioId");

ALTER TABLE "ConexionGoogle" ADD CONSTRAINT "ConexionGoogle_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
