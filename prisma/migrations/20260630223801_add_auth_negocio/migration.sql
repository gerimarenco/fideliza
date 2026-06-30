/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Negocio` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "email" TEXT,
ADD COLUMN     "password" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_email_key" ON "Negocio"("email");
