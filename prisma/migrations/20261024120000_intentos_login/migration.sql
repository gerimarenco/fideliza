-- Tabla nueva para limitar intentos de login (ver lib/limiteLogin.js).
-- Solo crea la tabla y sus índices: no toca datos existentes.
CREATE TABLE "IntentoLogin" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentoLogin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntentoLogin_emailHash_ipHash_createdAt_idx" ON "IntentoLogin"("emailHash", "ipHash", "createdAt");

CREATE INDEX "IntentoLogin_ipHash_createdAt_idx" ON "IntentoLogin"("ipHash", "createdAt");

CREATE INDEX "IntentoLogin_createdAt_idx" ON "IntentoLogin"("createdAt");
