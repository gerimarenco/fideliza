# Cupones de premios atados al producto (2026-11-05)

## El problema

El cupón del pañuelo ($29.000) era un cupón de **monto fijo para toda la
tienda** con compra mínima de $29.000. Tiendanube lo aceptaba con cualquier
producto: con un aromatizante de $32.000 se pagaban $3.000.

## Qué permite Tiendanube

Consultado el 2026-11-05. Desde la sesión no se pudo abrir la documentación
directamente (la red no deja salir a `tiendanube.github.io` ni a
`ayuda.tiendanube.com`): esto sale del buscador, que cita las dos fuentes.

- **API de cupones** (`POST /coupons`): tiene el campo `products`, una lista
  de ids de producto, que no se puede usar junto con `categories`.
  Documentación: <https://tiendanube.github.io/api-documentation/resources/coupon>.
- **Centro de ayuda** ("¿Cómo crear cupones de descuento?", Argentina y
  Colombia): "Si usás 'Categorías' o 'Productos', **todos los productos del
  carrito de tu cliente deben estar dentro de las categorías o productos
  configurados** para que aplique el cupón". También dice que **no se puede
  configurar un cupón para una sola variante**: al elegir un producto, vale
  para todas sus variantes.
- Una vez activo, **no se pueden cambiar las condiciones** de un cupón: hay
  que desactivarlo y crear otro.

Eso cubre lo pedido:

| Regla pedida | Cómo se cumple |
|---|---|
| El cupón del pañuelo solo sirve para el pañuelo | `products: [id del pañuelo]` |
| Todos los colores y variantes | La restricción por producto incluye todas sus variantes |
| No sirve en otro producto aunque cueste parecido | Otro producto en el carrito → Tiendanube no acepta el cupón |
| No se puede combinar con otros productos | Ídem: el carrito tiene que ser solo ese producto |
| Un solo uso | `max_uses: 1` (ya estaba) |
| Dos unidades no salen gratis | Es un monto fijo (una unidad), no un 100% |

## Cómo quedó (lib/tiendanube.js, lib/cuponCanje.js)

- **Código identificable**: `RETORNAR-<PREMIO>-<8 caracteres>`, por ejemplo
  `RETORNAR-PANUELO-AB12CD34`. La etiqueta es la primera palabra con sentido
  del nombre del premio, sin tildes ni ñ (como mucho 10 letras). Se usan 8
  caracteres y no 4 para que dos canjes no puedan chocar (Tiendanube no
  acepta códigos repetidos). El nombre es solo para reconocerlo: **la
  restricción real es `products`**.
- **Valor**: el de una unidad de la variante **más barata con stock**
  (decisión de Genaro). Si todos los colores cuestan lo mismo, es ese
  precio. Si hay precio promocional vigente, se toma ese.
- **Comprobación**: después de crearlo se mira que Tiendanube lo haya
  guardado atado a ese producto (en la respuesta o leyéndolo de nuevo). Si
  no (por ejemplo, si la API ignorara el campo), el cupón se borra (o se
  desactiva) en el acto y **no se le entrega a la clienta**; el canje queda
  con error y "Reintentar" en Canjes. Si tampoco se pudo borrar, el error
  dice qué código desactivar a mano.
- **Stock**: antes de descontar puntos se lee el producto; si no tiene stock
  en ninguna variante, no está publicado o ya no existe, el canje se
  rechaza **sin descontar puntos**. Si la tienda no responde, también (se
  pide reintentar en unos minutos). Un negocio sin Tiendanube conectado
  canjea como siempre.
- **Sin cambios**: los puntos de cada premio, el valor de los premios, los
  premios de porcentaje y de monto fijo (siguen siendo para toda la tienda,
  a propósito), y los negocios sin Tiendanube.

## Lo que no se puede garantizar desde acá

- **El comportamiento real del checkout** no se probó contra la tienda: las
  pruebas automáticas usan un modelo de las reglas documentadas
  (`pruebas/e2e/checkout-tiendanube.mjs`). Hay que hacer la prueba real de
  abajo antes de darlo por bueno.
- **Promociones automáticas de la tienda**: si el pañuelo tiene además una
  promoción automática (configurada en Tiendanube, no un precio
  promocional del producto), con dos unidades el cupón podría cubrir algo
  más que una unidad con descuento. No se ve por API.
- **Variantes más caras**: con la variante más barata sale gratis; con una
  más cara, la clienta paga la diferencia (decisión tomada).
- **Stock que se agota después del canje**: el cupón sigue valiendo y sirve
  cuando vuelva a haber stock (no tiene fecha de vencimiento).

## Cupones ya emitidos

No se modificó, invalidó ni borró ningún cupón. Los cupones de
premio-producto emitidos antes de este cambio **siguen sirviendo para
cualquier producto** hasta que se usen. Para verlos (solo lectura):

```bash
DATABASE_URL=... node scripts/cupones-producto-sin-restriccion.mjs --mostrar
```

Opciones, a decidir por Genaro (ninguna está implementada):

1. **Dejarlos como están** (recomendado si son pocos): se respetan los que
   ya se entregaron; los nuevos ya salen atados.
2. **Reemplazarlos**: desactivarlos en Tiendanube y entregarle a cada
   clienta un cupón nuevo atado al producto, avisándole el código nuevo.
   Requiere autorización expresa, y cambia el código que la clienta ya
   tiene.

Los canjes viejos cuyo cupón había fallado, al reintentarlos desde Canjes,
usan su código de siempre pero se crean atados al producto.

## Prueba real en la tienda (requiere autorización de Genaro)

Crea cupones reales. Usar un premio de prueba de pocos puntos con un
producto barato y una cuenta de prueba; al terminar, borrar los cupones en
Tiendanube → Descuentos → Cupones. No hace falta comprar: alcanza con
aplicar el cupón en el checkout y ver el resultado, sin pagar.

| # | Prueba | Resultado esperado | Hecho |
|---|---|---|---|
| R1 | Canjear el premio de prueba | Código `RETORNAR-<PREMIO>-XXXXXXXX`; en Tiendanube → Cupones el cupón figura limitado a ese producto | [ ] |
| R2 | Carrito con ese producto, en cada color | El cupón se acepta; el producto queda en $0 (más envío) | [ ] |
| R3 | Carrito con otro producto de precio parecido | El cupón **no** se acepta | [ ] |
| R4 | Carrito con el producto + otro producto | El cupón **no** se acepta | [ ] |
| R5 | Dos unidades del producto | Se descuenta una sola unidad | [ ] |
| R6 | Usar el mismo cupón en una segunda compra | No se acepta (un solo uso) | [ ] |
| R7 | Producto sin stock (poner el stock en 0) y canjear | El panel dice que no hay stock y no descuenta puntos | [ ] |

Si R1 falla (el cupón no queda limitado al producto), Retornar ya lo retira
solo y no lo entrega: revisar los permisos de la app de Tiendanube y avisar.
Si R3 o R4 fallan, Tiendanube no aplica la restricción como documenta:
**no usar premios-producto** hasta resolverlo.
