-- AlterTable
ALTER TABLE "Premio" ADD COLUMN     "tiendanubeProductoId" TEXT,
ADD COLUMN     "tiendanubeProductoUrl" TEXT,
ADD COLUMN     "tiendanubeDescuentoPorcentaje" INTEGER;

-- AlterTable
ALTER TABLE "Canje" ADD COLUMN     "tiendanubeCuponCodigo" TEXT,
ADD COLUMN     "tiendanubeCuponError" TEXT;
