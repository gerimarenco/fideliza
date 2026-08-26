-- Carga la paleta de marca de Peperina (negro/gris oscuro con acento beige,
-- a partir de su logo). Solo toca el negocio real y activo: si por algún
-- motivo hubiera más de un "Peperina" activo, todos quedarían con la misma
-- paleta (inofensivo), pero no afecta a ningún otro negocio.
UPDATE "Negocio"
SET "tema" = '{
  "fondo": "#0a0a0c",
  "superficie": "#1c1c1f",
  "borde": "#2e2e32",
  "texto": "#f5f5f5",
  "textoSecundario": "#9ca3af",
  "primario": "#c9a879",
  "primarioTexto": "#0a0a0c"
}'::jsonb
WHERE "nombre" = 'Peperina' AND "activo" = true;
