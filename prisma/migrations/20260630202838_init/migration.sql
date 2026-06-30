-- CreateTable
CREATE TABLE "Negocio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "puntosXPeso" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "puntos" INTEGER NOT NULL DEFAULT 0,
    "negocioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Premio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "puntos" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,

    CONSTRAINT "Premio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Canje" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "premioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Canje_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Premio" ADD CONSTRAINT "Premio_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canje" ADD CONSTRAINT "Canje_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canje" ADD CONSTRAINT "Canje_premioId_fkey" FOREIGN KEY ("premioId") REFERENCES "Premio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
