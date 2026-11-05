-- Alerta de canje para las empleadas (2026-11-08): qué premio dispara la
-- alerta en cada negocio y cuándo se contactó a cada clienta. Columnas nuevas
-- y vacías: ningún negocio tiene la alerta activada hasta que la configure en
-- Ajustes, y no cambia ningún puntaje, premio ni saldo.
ALTER TABLE "Negocio" ADD COLUMN "alertaCanjePremioId" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "alertaContactadaEn" TIMESTAMP(3);
ALTER TABLE "Cliente" ADD COLUMN "alertaContactadaPuntos" INTEGER;
