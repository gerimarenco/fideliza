# Pruebas E2E

Pruebas de punta a punta contra el servidor de desarrollo y una base **local y
descartable**. Tiendanube, Resend y Google están simulados: ninguna prueba sale a
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
| `google-sheets.mjs` | Exportar clientes a Google Sheets: permisos, OAuth (solo `drive.file`, state firmado + cookie, vueltas falsas o de otro negocio, cuenta sin el permiso), token cifrado y nunca devuelto, crear y elegir hoja (regla de `drive.file`), exportar sin DNI y como valor (`RAW`), volver a exportar con la hoja reordenada, columnas y filas propias, dos exportaciones a la vez, multiempresa, pantalla, desconectar y acceso revocado. Google simulado (`simulaciones/google.mjs`). El servidor necesita credenciales de Google **de prueba** (ver abajo) | Nueva (2026-11-09) |
| `dragonfish-identificacion.mjs` | Ventas del local: la clienta se reconoce por email, celular (`Movil`, cualquier formato) o DNI (también del CUIT), agente viejo compatible, reporte repetido sin duplicar, compra anterior a la cuenta no suma, ventas sin identificar con monto y nombre, multiempresa y permisos, asignar con un clic (una vez, nunca a otro negocio ni a cuenta posterior), volver a revisar (60 días) y la pantalla | Nueva (2026-11-11) |
| `dragonfish-recuperacion.mjs` | Recuperación de ventas del local de Club Peperina desde el 05/11/2026: cuenta la fecha de la venta en Dragon Fish (no cuándo llegó el aviso; límites 04/11 23:59:59 y 05/11 00:00:00, reloj de la PC adelantado), lista y "Volver a revisar" solo desde el 05/11, ventas sin fecha verificable (vacía, ilegible, posterior al aviso) excluidas de la lista, de "Volver a revisar", de la asignación manual y de la vinculación de ficha, venta vieja reenviada el 05/11 (con y sin fecha), compras de hoy sin fecha o con fecha u hora inválida que quedan `sin_fecha` sin sumar ni mandar mail (y el aviso en el panel), compra con fecha válida que suma y manda mail, cuenta posterior, ambigua, ya acreditada y reporte repetido no suman, asignar a mano y vincular ficha respetan el límite, pendiente vieja queda `fuera_de_periodo`, compras nuevas (aviso real) y otro negocio sin cambios, texto del botón. Usa un negocio con base `PEPERINA`. Correr antes del 04/01/2027 (ventana de 60 días) | Nueva (2026-11-11) |
| `alertas-canje.mjs` | Alerta de canje para las empleadas: script de revisión (solo lectura), configuración por negocio y validaciones, qué muestra (puntos, siguiente premio), filtro y resumen, multiempresa y permisos, marcar/deshacer contacto sin repetir, el canje la reinicia, mensaje exacto de WhatsApp, pantallas de Inicio, Clientes y Ajustes | Nueva (2026-11-08) |
| `emails.mjs` | Emails a las clientas: ajustes de remitente y bienvenida, mail de bienvenida, remitente del club y "responder a", versión de texto, compra, canje con asunto neutro, aviso de vencimiento por lote (detalle por fecha, premios, cuánto comprar, sin repetir), contraseña y otro negocio sin cambios. Resend simulado; guarda capturas de cada mail | Nueva (2026-11-07) |
| `enlaces-stock.mjs` | Enlaces de premios con stock: página intermedia (disponible, sin stock, sin confirmar, Tiendanube lento), otros colores del mismo producto primero, alternativas configuradas solo con stock, caché de 20 s, etiquetas y canje en el panel de la clienta, "Enlace y alternativas" del negocio (API y pantalla, validaciones, permisos) y que a productos de Tiendanube solo se hagan GET. Tarda ~1,5 minutos (espera a que venza la caché) | Nueva (2026-11-06) |
| `cupones-producto.mjs` | Cupones de premios-producto atados al producto: código `RETORNAR-<PREMIO>-...`, `products` en Tiendanube, todos los colores, otro producto o combinado rechazado, una unidad, un solo uso, variantes con precios distintos, sin stock/sin publicar/borrado sin descontar puntos, cupón no atado → se retira y no se entrega, canjes viejos y el script de solo lectura. El checkout es un modelo de las reglas documentadas (`checkout-tiendanube.mjs`), no la tienda real | Nueva (2026-11-05) |
| `bienvenida-cupones.mjs` | Bonificación de bienvenida, cupones de un solo uso, estado de cupones sincronizado con Tiendanube (paginación, listado incompleto, contadores, borrados), webhook, "Mis cupones", privacidad entre clientas y negocios | La suite usada en el PR #122, traída al repo con cambios solo en rutas (antes vivía fuera del repo) |
| `dni.mjs` | DNI obligatorio: validación (también patrones llamativos), separadores, unicidad por negocio, registros simultáneos, cuentas históricas, login y recuperación, autorreferidos, bienvenida, privacidad (respuestas, log, mails, Excel) y los límites de intentos (mismo Wi-Fi, mismo DNI, mismo dispositivo, misma IP, muchas IP) | La suite usada en el PR #123, traída al repo y adaptada a los límites nuevos (secciones "Límites" nuevas). Lee el log del servidor de `RETORNAR_E2E_LOG` (por defecto `$RETORNAR_E2E_DIR/servidor.log`) |
| `bienvenida-celular.mjs` | Una bienvenida por persona: celular de una cuenta histórica, celular compartido, registros simultáneos, otro negocio, cuenta que ya la cobró y el script retroactivo (simulación, aplicar, repetir) | Nueva (2026-10-31) |
| `clientes.mjs` | Celular con país (formatos, prefijos repetidos, código de área, otros países), DNI solo números (API y pantalla), "Nuevo cliente" con los mismos campos y validaciones que el registro (API y pantalla), celulares viejos (bienvenida, Dragon Fish, WhatsApp), cuentas sin nombre (filtro, eliminación y permisos), `origen` en el script retroactivo | Nueva (2026-11-02) |

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

#    Para google-sheets.mjs, además, credenciales de Google ficticias (la
#    simulación responde por Google; no se usa ninguna cuenta real):
#    GOOGLE_SHEETS_CLIENT_ID=cliente-prueba.apps.googleusercontent.com
#    GOOGLE_SHEETS_CLIENT_SECRET=secreto-de-prueba
#    GOOGLE_PICKER_API_KEY=clave-picker-prueba GOOGLE_CLOUD_PROJECT_NUMBER=123456789

# 4. Datos ficticios y una suite (repetir la semilla antes de cada suite)
node pruebas/e2e/semilla.mjs
node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/bienvenida-cupones.mjs
```

Cada suite imprime `N ok, M mal` y termina con código 1 si algo falló.
Necesita Playwright con Chromium instalado en la máquina (no es dependencia
del proyecto).
