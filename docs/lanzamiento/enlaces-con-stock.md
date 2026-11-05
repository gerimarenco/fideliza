# Enlaces de premios con stock real (2026-11-06)

## Cómo era

El enlace de un premio era el campo "URL del producto" (cargado a mano) y
llevaba directo a la tienda desde el panel de la clienta, el cartel del cupón
y el mail de canje. Retornar no miraba el stock, el enlace apuntaba al
producto entero (no a un color) y el link y el ID del producto se cargaban
por separado (podían apuntar a productos distintos).

## Cómo quedó

**Página intermedia** `/club/<negocio>/producto/<premio>` (pública, como la
página del club). Todos los enlaces de premios con producto pasan por ahí:
panel de la clienta, cartel del cupón ("Ver el producto en la tienda") y
mail de canje. Consulta Tiendanube en el momento y muestra uno de tres
estados:

| Estado | Qué ve la clienta |
|---|---|
| Disponible | La foto, "Disponible en la tienda." y el botón "Ver en la tienda" (al color elegido) |
| Sin stock | «Este producto se encuentra sin stock por el momento» (o «… en Visón» si el enlace es de un color), **sin** botón al producto agotado, y: 1) **Disponible en otros colores**: el mismo producto en otros colores/variantes con stock, primero los del mismo precio; 2) **También te puede gustar**: las alternativas que eligió el negocio, solo las que tienen stock confirmado |
| Sin confirmar | «No pudimos confirmar la disponibilidad en este momento.» y el botón a la tienda (decisión de Genaro), sin decir que hay stock |

Nunca se sugieren productos de otro tipo por tener un precio parecido: solo
el mismo producto o las alternativas elegidas a mano.

**Panel de la clienta**: cada premio con producto muestra "Sin stock por el
momento", "Sin stock en este color · hay otros colores" o "Disponibilidad sin
confirmar". Si no hay stock en ninguna variante, el botón dice "Sin stock" y
no deja canjear (lo mismo controla el servidor desde el PR #125). Si solo se
agotó el color del enlace, se puede canjear: el cupón vale para cualquier
color.

**Panel del negocio** (Premios → "Enlace y alternativas", en premios de
producto):
- Se busca el producto en la tienda por nombre y se elige; el link sale de
  Tiendanube (ya no se puede apuntar a un producto con el link de otro).
- Se elige el color o variante del enlace (o "cualquier color"), viendo el
  stock de cada una.
- Hasta 3 alternativas (recomendado 2 o 3 del mismo tipo de producto), cada
  una con su color opcional y su stock actual. No se puede elegir el mismo
  producto del premio (sus colores ya se ofrecen solos) ni repetir.
- Al guardar, cada producto se comprueba en Tiendanube; si la tienda no
  responde, no se guarda nada.

Cambiar el producto del premio desde acá también cambia el producto del
cupón de los canjes nuevos (es el mismo campo).

## Stock en Tiendanube (lib/disponibilidad.js)

Según la documentación de la API (recurso Product Variant):
- `stock_management: false` → stock infinito (siempre disponible).
- `stock_management: true` → `stock` es la cantidad: disponible si es 1 o más.
- Cualquier otra cosa (sin datos, texto raro) → **sin confirmar**, nunca
  disponible.
- Producto sin publicar o variante que ya no existe → sin stock.

Lecturas:
- Solo `GET /products/<id>` (y `GET /products?q=` para buscar en el panel).
  Nunca se escribe en productos, precios ni stock; la prueba automática lo
  verifica.
- Tiempo máximo de 4 segundos; si se pasa, "sin confirmar".
- Lo leído se reutiliza 20 segundos (la API limita las consultas por tienda,
  unas 2 por segundo según fuentes no oficiales); un error, 10 segundos. Un
  cambio de stock se ve como mucho 20 segundos después.

## Lo que hay que verificar con la tienda real

1. **Varias ubicaciones de stock.** Si Peperina tiene más de una ubicación en
   Tiendanube (por ejemplo, el local y el depósito), `stock` es la suma de
   todas: podría decir "disponible" con stock solo en el local. Correr (solo
   lectura):

   ```bash
   DATABASE_URL=... node scripts/diagnostico-productos-tiendanube.mjs
   ```

   Muestra las ubicaciones y el stock de cada variante por ubicación. Si hay
   más de una, decidir qué ubicación cuenta para la tienda online (es el
   mismo tema pendiente del stock de los canjes en el local).
2. **El color en el link.** El link a un color usa `?variant=<id>`; que la
   página de la tienda abra ese color depende de la plantilla. Probarlo
   abriendo un enlace de un color.
3. **Búsqueda.** El buscador del panel usa `GET /products?q=`; confirmar que
   encuentra los productos por nombre en la tienda real.

## Límites

- El enlace de un mail viejo (anterior a este cambio) sigue yendo directo a
  la tienda.
- Las fotos vienen del CDN de la tienda; si una no carga, se oculta.
- La página es pública (como la del club): muestra solo datos públicos de la
  tienda y del premio.
