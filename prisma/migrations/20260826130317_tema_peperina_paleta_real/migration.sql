-- Reemplaza la paleta aproximada anterior por los colores exactos que la
-- dueña de Peperina mandó de su propia marca. Un sexto color que envió
-- (#37A1D) llegó incompleto (5 dígitos, un hex válido necesita 6) y quedó
-- afuera hasta que lo confirme.
UPDATE "Negocio"
SET "tema" = '{
  "fondo": "#F6EFE9",
  "superficie": "#ffffff",
  "borde": "#EBDAC6",
  "texto": "#221f1a",
  "textoSecundario": "#A99886",
  "primario": "#877152",
  "primarioTexto": "#F6EFE9",
  "resaltado": "#F4D9D1",
  "fuenteTitulo": "Georgia, \"Times New Roman\", serif"
}'::jsonb
WHERE "nombre" = 'Peperina' AND "activo" = true;
