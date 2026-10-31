-- Motivo por el que una cuenta no recibió la bonificación de bienvenida
-- (ver lib/bienvenida.js). Columna nueva y vacía: no modifica ninguna fila,
-- punto ni movimiento existente.
ALTER TABLE "Cliente" ADD COLUMN "bienvenidaMotivo" TEXT;
