-- Cómo se creó cada cuenta nueva: "registro" (la clienta) o "panel" (el
-- negocio, con "Nuevo cliente"). Columna nueva y vacía: no modifica ninguna
-- fila existente (las cuentas anteriores quedan con null).
ALTER TABLE "Cliente" ADD COLUMN "origen" TEXT;
