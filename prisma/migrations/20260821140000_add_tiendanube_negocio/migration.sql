/*
  Warnings:

  - A unique constraint covering the columns `[tiendanubeStoreId]` on the table `Negocio` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "tiendanubeStoreId" TEXT,
ADD COLUMN     "tiendanubeAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_tiendanubeStoreId_key" ON "Negocio"("tiendanubeStoreId");
