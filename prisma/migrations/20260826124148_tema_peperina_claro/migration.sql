-- Ajusta la paleta de Peperina: la marca pidió algo más claro (blanco con
-- detalles en beige) en vez del negro inicial, para acercarse al diseño
-- real de peperina.com, más una tipografía serif para los títulos.
UPDATE "Negocio"
SET "tema" = '{
  "fondo": "#f7f4ef",
  "superficie": "#ffffff",
  "borde": "#e6e1d8",
  "texto": "#221f1a",
  "textoSecundario": "#8f8779",
  "primario": "#c9a879",
  "primarioTexto": "#221f1a",
  "fuenteTitulo": "Georgia, \"Times New Roman\", serif"
}'::jsonb
WHERE "nombre" = 'Peperina' AND "activo" = true;
