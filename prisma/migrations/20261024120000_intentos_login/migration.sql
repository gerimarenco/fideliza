-- Tabla nueva para limitar intentos de login fallidos. No toca datos existentes.
CREATE TABLE "IntentoLogin" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentoLogin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntentoLogin_emailHash_createdAt_idx" ON "IntentoLogin"("emailHash", "createdAt");
