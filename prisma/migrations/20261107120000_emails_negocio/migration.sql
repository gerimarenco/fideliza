-- Emails a las clientas (2026-11-07): nombre visible del remitente y mail de
-- bienvenida, por negocio. Columnas nuevas: el nombre queda vacío (los mails
-- siguen saliendo como hasta ahora) y la bienvenida desactivada, para todos
-- los negocios, hasta que cada uno lo cambie en Ajustes.
ALTER TABLE "Negocio" ADD COLUMN "emailRemitenteNombre" TEXT;
ALTER TABLE "Negocio" ADD COLUMN "emailBienvenida" BOOLEAN NOT NULL DEFAULT false;
