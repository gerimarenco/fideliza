-- CreateIndex
CREATE INDEX "Cliente_negocioId_idx" ON "Cliente"("negocioId");

-- CreateIndex
CREATE INDEX "Premio_negocioId_idx" ON "Premio"("negocioId");

-- CreateIndex
CREATE INDEX "Canje_clienteId_idx" ON "Canje"("clienteId");

-- CreateIndex
CREATE INDEX "Canje_premioId_idx" ON "Canje"("premioId");
