# Progreso — Fideliza

> Historial resumido, en orden cronológico, reconstruido de `git log`.
> Para el detalle de la sesión más reciente, ver `sesion-actual.md`.

## 2026-06-29 — Setup inicial

Primer commit del proyecto (`create-next-app`), configuración de deploy en
Netlify, ajustes de build (`tsconfig`, fixes de deploy).

## 2026-06-30 — Base funcional

- Conexión a la base de datos (Prisma + Postgres).
- APIs iniciales de clientes, compras y canjes.
- Login con NextAuth (sesión real).
- Sumar puntos y agregar clientes funcionando desde el panel.

## 2026-07-05 — Paneles por rol

- Panel separado para negocios (`PanelNegocio`).
- Primera versión del webhook de Tiendanube.
- Fixes de sidebar del negocio y de middleware.

## 2026-07-30 — Panel de cliente

Login y panel de cliente (`PanelCliente`), generación automática de
password para clientes dados de alta por el negocio.

## 2026-08-04 — Auto-registro

Auto-registro de clientes por negocio (link público `/registro/[slug]`).

## 2026-08-11 — Fix menor

Manejo de nombre nulo en el panel de cliente.

## 2026-08-12 — Mercado Pago

Integración de Mercado Pago: `crear-preferencia` + webhook. Ajuste para
usar `sandbox_init_point` en pagos de prueba.

## 2026-08-20 — Dragon Fish (versión inicial)

Endpoint de webhook de Dragon Fish preparado, en modo "solo loguear" —
todavía no se conocía el formato real del payload.

## 2026-08-21 — Sesión grande: seguridad, integraciones, estadísticas (PR #1)

Sesión extensa de trabajo con Claude Code que terminó en el PR #1
("Add authentication, security, and webhook idempotency"), mergeado a
`main`. En orden:

1. **Tiendanube terminado (a nivel código)**: se confirmó que el webhook
   de Tiendanube manda un payload liviano (`{store_id, event, id}`, sin
   los datos de la venta) — el código anterior asumía que sí venían, y
   nunca hubiera funcionado. Se reescribió para pedir la orden completa a
   la API de Tiendanube, y se agregaron `tiendanubeStoreId` /
   `tiendanubeAccessToken` a `Negocio` más `PATCH /api/negocios` para
   cargarlos.
2. **Auditoría de seguridad de passwords**: se detectó que `Cliente` y
   `Negocio` guardaban passwords en texto plano. Se migró a bcrypt
   (`lib/password.js`) con rehash automático de las passwords legacy en
   el primer login (sin resetear nada a mano). Se sacó el admin
   hardcodeado del código a variables de entorno. Se borró `fix.js`
   (script de un solo uso ya obsoleto).
3. **Hallazgo crítico de seguridad**: `GET /api/negocios` y
   `GET /api/clientes` no tenían ningún chequeo de sesión — el middleware
   excluye `/api/*` explícitamente. Cualquiera sin loguearse podía
   bajarse todos los negocios y clientes, incluidos los hashes de
   password y el `tiendanubeAccessToken` en texto plano. Se agregó
   autenticación y autorización por rol a **todos** los endpoints de API.
4. **Bug de duplicación de puntos**: el webhook de Mercado Pago tenía un
   comentario que decía "evitar sumar puntos dos veces" pero no hacía
   nada al respecto. Se agregó idempotencia real (`WebhookEvento` +
   transacción atómica) — priorizado porque era el único de los tres
   webhooks con tráfico real en producción.
5. **Índices faltantes**: se agregaron índices en las foreign keys que no
   los tenían (`Cliente.negocioId`, `Premio.negocioId`,
   `Canje.clienteId`/`premioId`), verificado con `EXPLAIN ANALYZE` contra
   20.000 filas de prueba.
6. **README real**: se reemplazó el README genérico de `create-next-app`
   por documentación real del proyecto (setup, variables de entorno,
   estado de las integraciones).
7. **Estadísticas del negocio**: nueva tabla `MovimientoPuntos` (historial
   de puntos otorgados, algo que no existía) + endpoint
   `GET /api/negocios/estadisticas` (clientes activos, puntos otorgados
   este mes, canjes este mes) + sección visual nueva en el panel.
8. Se detectó y arregló un conflicto de merge real contra `main`
   (`README.md`, por un commit de prueba ajeno) antes de mergear el PR.
9. Se desconectó la integración de Vercel del repo (el deploy real es
   Netlify; Vercel estaba fallando por falta de configuración y no
   aportaba nada).
10. **PR #1 mergeado.**

## 2026-08-22 — Paginación de listados (PR #2)

Diseño del agente local de Dragon Fish (sin código, quedó bloqueado
esperando a Zoo Logic). Auditoría de las consultas Prisma de los paneles:
se agregaron paginación a `GET /api/clientes` y un `GET /api/canjes`
nuevo (antes solo existía el `POST`), y se conectó la lista de clientes y
una pantalla nueva de "Historial de canjes" (el ítem de sidebar
"Canjes"/"Puntos y canjes", hasta entonces decorativo) a esos endpoints.
**PR #2 mergeado.**

## 2026-08-22 (tarde) — Documentación de contexto (PR #3)

Se creó esta carpeta `docs/` (`contexto-proyecto.md`, `progreso.md`,
`sesion-actual.md`, `tareas-pendientes.md`) para poder retomar el
proyecto entre sesiones sin releer todo el código. **PR #3 mergeado.**

## 2026-08-23/24 — Conectar todo el sidebar + Ajustes de negocio (PRs #4-#9)

Sesión larga retomando el proyecto: se conectó, uno por uno, cada ítem
decorativo que quedaba en los tres paneles, más el "Ajustes" del panel
de negocio (que no existía). Ver `sesion-actual.md` para el detalle
completo de cada PR, lo probado, y las decisiones tomadas con el negocio
antes de construir cada pantalla. En orden:

1. **PR #4** (ya estaba abierto de una sesión previa): botón "Canjear" en
   el panel de cliente, conectado a `POST /api/canjes`.
2. **PR #5**: "+ Nuevo negocio" y "Editar" en el panel admin; se borró
   `borrar-cliente.sql` (resto sin uso de una tarea ya cerrada).
3. **PR #6**: "Negocios" y "Clientes"/"Mis clientes" del sidebar.
4. **PR #7**: "Premios" del panel de negocio — CRUD completo nuevo
   (`/api/premios`), con borrado lógico (`Premio.activo`).
5. **PR #8**: "Integraciones" (Tiendanube + Mercado Pago + Dragon Fish) en
   ambos paneles, más un bug real encontrado en producción (el contenido
   del panel admin no reaccionaba a `seccionActiva` sin un negocio
   elegido) y arreglado en el mismo PR.
6. **PR #9**: "Ajustes" del panel de negocio (ítem nuevo): cambio de
   contraseña, `puntosXPeso` editable.
7. Manejo de errores agregado a los botones de guardado (`try/catch` +
   mensaje visible) — pusheado a la rama, **sin PR abierto todavía**.
8. Se descubrió que la cuenta de Netlify se quedó sin créditos operativos
   — deploys de producción pausados hasta que se resuelva (ver
   `contexto-proyecto.md` y `tareas-futuras.md`). No es un bug de código.
