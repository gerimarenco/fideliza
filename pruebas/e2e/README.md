# Pruebas E2E

Pruebas de punta a punta contra el servidor de desarrollo y una base **local y
descartable**. Tiendanube y Resend están simulados: ninguna prueba sale a
internet, crea cupones reales ni manda mails reales.

**Nunca contra producción.** `entorno.mjs` corta antes de hacer nada si
`DATABASE_URL` no apunta a una base local cuyo nombre incluya `test` o
`prueba`. `semilla.mjs` **vacía todas las tablas** antes de cargar los datos
ficticios.

No corren en el CI de GitHub (necesitan Postgres, el servidor y un
navegador); el CI corre `npm test` (las pruebas de `lib/`).

## Suites

| Archivo | Qué prueba | Origen |
|---|---|---|
| `emails.mjs` | Emails a las clientas: ajustes de remitente y bienvenida, mail de bienvenida, remitente del club y "responder a", versión de texto, compra, canje con asunto neutro, aviso de vencimiento por lote (detalle por fecha, premios, cuánto comprar, sin repetir), contraseña y otro negocio sin cambios. Resend simulado; guarda capturas de cada mail | Nueva (2026-11-07) |
| `enlaces-stock.mjs` | Enlaces de premios con stock: página intermedia (disponible, sin stock, sin confirmar, Tiendanube lento), otros colores del mismo producto primero, alternativas configuradas solo con stock, caché de 20 s, etiquetas y canje en el panel de la clienta, "Enlace y alternativas" del negocio (API y pantalla, validaciones, permisos) y que a productos de Tiendanube solo se hagan GET. Tarda ~1,5 minutos (espera a que venza la caché) | Nueva (2026-11-06) |
| `cupones-producto.mjs` | Cupones de premios-producto atados al producto: código `RETORNAR-<PREMIO>-...`, `products` en Tiendanube, todos los colores, otro producto o combinado rechazado, una unidad, un solo uso, variantes con precios distintos, sin stock/sin publicar/borrado sin descontar puntos, cupón no atado → se retira y no se entrega, canjes viejos y el script de solo lectura. El checkout es un modelo de las reglas documentadas (`checkout-tiendanube.mjs`), no la tienda real | Nueva (2026-11-05) |
| `bienvenida-cupones.mjs` | Bonificación de bienvenida, cupones de un solo uso, estado de cupones sincronizado con Tiendanube (paginación, listado incompleto, contadores, borrados), webhook, "Mis cupones", privacidad entre clientas y negocios | La suite usada en el PR #122, traída al repo con cambios solo en rutas (antes vivía fuera del repo) |
| `dni.mjs` | DNI obligatorio: validación (también patrones llamativos), separadores, unicidad por negocio, registros simultáneos, cuentas históricas, login y recuperación, autorreferidos, bienvenida, privacidad (respuestas, log, mails, Excel) y los límites de intentos (mismo Wi-Fi, mismo DNI, mismo dispositivo, misma IP, muchas IP) | La suite usada en el PR #123, traída al repo y adaptada a los límites nuevos (secciones "Límites" nuevas). Lee el log del servidor de `RETORNAR_E2E_LOG` (por defecto `$RETORNAR_E2E_DIR/servidor.log`) |
| `bienvenida-celular.mjs` | Una bienvenida por persona: celular de una cuenta histórica, celular compartido, registros simultáneos, otro negocio, cuenta que ya la cobró y el script retroactivo (simulación, aplicar, repetir) | Nueva (2026-10-31) |

## Cómo correrlas

```bash
# 1. Postgres local con una base de prueba vacía
export DATABASE_URL="postgresql://postgres@localhost:5432/retornar_test"
npx prisma migrate deploy

# 2. Carpeta compartida entre las pruebas y el servidor
export RETORNAR_E2E_DIR=/tmp/retornar-e2e

# 3. Servidor de desarrollo con las simulaciones (en otra terminal, con las
#    mismas variables y NEXTAUTH_SECRET / NEXTAUTH_URL de prueba)
RESEND_API_KEY=re_prueba_local NODE_OPTIONS="--import ./pruebas/e2e/simulaciones/todas.mjs" \
  npx next dev -p 3000 > $RETORNAR_E2E_DIR/servidor.log 2>&1

# 4. Datos ficticios y una suite (repetir la semilla antes de cada suite)
node pruebas/e2e/semilla.mjs
node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/bienvenida-cupones.mjs
```

Cada suite imprime `N ok, M mal` y termina con código 1 si algo falló.
Necesita Playwright con Chromium instalado en la máquina (no es dependencia
del proyecto).
