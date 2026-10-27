-- Aviso "tus puntos vencen pronto": marca de cuándo se avisó cada lote.
-- Columna nueva y opcional: no cambia ni borra ningún dato existente.
ALTER TABLE "MovimientoPuntos" ADD COLUMN "avisoVencimientoEn" TIMESTAMP(3);
