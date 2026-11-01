-- DNI obligatorio en el registro público (ver lib/dni.js). Solo agrega un
-- índice y una tabla nueva: no modifica ni borra ninguna fila existente.

-- Un DNI por negocio, garantizado por la base (también con registros
-- simultáneos). La misma persona puede tener cuenta en otro negocio.
--
-- Cubre las cuentas creadas desde el 30/10/2026. Las anteriores con DNI
-- (registradas entre septiembre y el 24/10/2026, cuando el DNI se pedía sin
-- control de repetidos) quedan fuera del índice para que la migración no
-- pueda fallar si entre ellas hubiera documentos repetidos: el registro las
-- controla igual (app/api/registro/[negocio], con un lock por documento) y
-- scripts/dni-duplicados.sql permite revisarlas. Desde el 24/10 el registro
-- no guardaba DNI, así que no hay filas que puedan chocar con este índice.
--
-- Prisma 5 no representa índices parciales en schema.prisma: si
-- `prisma migrate dev` propone borrar este índice, sacar esa línea.
CREATE UNIQUE INDEX "Cliente_negocioId_dni_key"
  ON "Cliente"("negocioId", "dni")
  WHERE "dni" IS NOT NULL AND "createdAt" >= TIMESTAMP '2026-10-30 00:00:00';

-- Registros rechazados por email o DNI ya registrados, por conexión (IP con
-- HMAC, nunca la IP ni el documento): pone un tope para que el mensaje
-- "Este DNI ya está registrado" no sirva para averiguar documentos en masa.
CREATE TABLE "IntentoRegistro" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentoRegistro_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntentoRegistro_ipHash_createdAt_idx" ON "IntentoRegistro"("ipHash", "createdAt");
CREATE INDEX "IntentoRegistro_createdAt_idx" ON "IntentoRegistro"("createdAt");
