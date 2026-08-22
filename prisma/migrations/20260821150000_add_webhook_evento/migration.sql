-- CreateTable
CREATE TABLE "WebhookEvento" (
    "id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "referenciaExterna" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvento_proveedor_referenciaExterna_key" ON "WebhookEvento"("proveedor", "referenciaExterna");
