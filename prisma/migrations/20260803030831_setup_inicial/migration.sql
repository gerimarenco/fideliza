/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Negocio` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_slug_key" ON "Negocio"("slug");
