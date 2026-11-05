-- Código del cupón de Tiendanube que se pide para cada canje nuevo
-- (RETORNAR-<PREMIO>-<8 caracteres>). Columna nueva y vacía: no modifica
-- ninguna fila existente (los canjes anteriores quedan con null y siguen
-- usando su código de siempre).
ALTER TABLE "Canje" ADD COLUMN "cuponCodigoPrevisto" TEXT;
