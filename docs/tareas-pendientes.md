# Tareas pendientes — Fideliza

> Última actualización: 2026-08-22. Marca lo hecho (`[x]`) y lo que falta
> (`[ ]`), agrupado por área. Ver `contexto-proyecto.md` para el porqué de
> cada cosa y `progreso.md`/`sesion-actual.md` para cuándo se hizo.

## Dragon Fish

- [x] Endpoint `/api/webhooks/dragonfish` creado y recibiendo el webhook
      real (confirmado el formato: `Entidad`, `Evento`, `Codigo`, `Fecha`,
      `Hora`, `Version`, `BaseDeDatos` — sin datos de la venta).
- [x] Arquitectura acordada para no exponer la PC del negocio a internet:
      agente local que hace polling (nunca escucha conexiones entrantes).
- [ ] **Bloqueante actual**: esperando respuesta del soporte de **Zoo
      Logic** sobre cómo consultar la factura completa (cliente, monto,
      artículos) usando el `Codigo` contra la API REST local de Dragon
      Fish, y qué dato de identificación del cliente devuelve (email,
      DNI, teléfono, o alguna combinación) — no asumir nada hasta tener
      la respuesta.
- [ ] Definir la lógica de matching de cliente en Fideliza una vez que se
      sepa qué campo(s) trae la respuesta de Dragon Fish.
- [ ] Diseñar/construir el agente local con polling:
  - [ ] Tabla nueva en Prisma (`FacturaPendiente` o similar): `codigo`,
        `negocioId`, `fecha`, `hora`, `procesado`.
  - [ ] El webhook actual pasa de solo loguear a insertar una fila acá
        (resolviendo `negocioId` a partir de `BaseDeDatos`).
  - [ ] Campo nuevo en `Negocio` para mapear `BaseDeDatos` → `negocioId`
        (análogo a `tiendanubeStoreId`).
  - [ ] Endpoint `GET /api/dragonfish/pendientes` (el agente pregunta qué
        hay pendiente).
  - [ ] Endpoint `POST /api/dragonfish/resolver` (el agente reporta el
        resultado; dispara la misma lógica de "buscar cliente, calcular
        puntos, sumarlos" que ya usan Mercado Pago y las compras
        manuales).
  - [ ] Token secreto por negocio para autenticar al agente
        (`dragonfishAgentToken`, mismo patrón que `tiendanubeAccessToken`).
  - [ ] Decidir dónde corre el agente (misma PC que Dragon Fish u otra
        máquina de la red del local) y en qué lo escribimos (probablemente
        un script chico de Node).
- [ ] Agregar protección de idempotencia (`WebhookEvento`) — hoy Dragon
      Fish no la tiene, a diferencia de Mercado Pago.
- [ ] Sacar el `console.log` del payload crudo en
      `app/api/webhooks/dragonfish/route.js` una vez terminada la
      integración (hoy está ahí a propósito, para poder inspeccionar
      payloads reales en los logs de Netlify).

## Tiendanube

- [x] Webhook reescrito para pedir la orden completa a la API de
      Tiendanube (el webhook real solo manda `{store_id, event, id}`, no
      los datos de la venta — esto ya está resuelto).
- [x] Campos `tiendanubeStoreId` / `tiendanubeAccessToken` en `Negocio`.
- [x] `PATCH /api/negocios` para cargar esas credenciales.
- [ ] **Pausado**: el flujo OAuth2 de Tiendanube (de donde sale el
      `tiendanubeAccessToken` real) todavía no está armado. Se decidió no
      construirlo hasta que la tienda esté activa en Tiendanube — no hay
      apuro, no hay tráfico real hoy.
- [ ] Una vez que la tienda esté activa: armar el flujo OAuth2, cargar
      `tiendanubeStoreId`/`tiendanubeAccessToken` reales.
- [ ] Agregar protección de idempotencia (`WebhookEvento`) — hoy no la
      tiene, a diferencia de Mercado Pago.

## Seguridad (grueso ya resuelto)

- [x] Passwords hasheadas con bcrypt + rehash perezoso de las que
      quedaban en texto plano.
- [x] Admin sacado del código fuente a variables de entorno.
- [x] Autenticación y autorización por rol en **todos** los endpoints de
      API (antes, `GET /api/negocios` y `GET /api/clientes` eran
      alcanzables sin login por cualquiera, exponiendo hashes de password
      y el `tiendanubeAccessToken` en texto plano — ya arreglado).
- [x] Índices en las foreign keys que faltaban (`Cliente.negocioId`,
      `Premio.negocioId`, `Canje.clienteId`/`premioId`).
- [x] Idempotencia real en el webhook de Mercado Pago (arreglaba un bug
      de duplicar puntos si Mercado Pago reenviaba la misma notificación).
- [ ] Separar el endpoint `GET /api/negocios` por rol en vez de que el
      negocio/cliente pidan todo y filtren del lado del cliente (mejora
      de diseño, no urgente — quedó explícitamente pospuesta).
- [ ] Unificar el manejo de errores entre los tres webhooks (hoy cada uno
      responde distinto ante los mismos tipos de falla — status codes y
      logging inconsistentes entre Mercado Pago, Tiendanube y Dragon
      Fish). Pospuesto a propósito, foco puesto en el bug de Mercado Pago
      primero por ser el único con tráfico real.

## Paginación de listados

- [x] Backend: `GET /api/clientes` y `GET /api/canjes` (nuevo) paginados
      por offset (`skip`/`take`), con `{ items, page, pageSize, total,
      totalPages }`.
- [x] Frontend: paginación numerada en la lista de "Clientes", pantalla
      nueva de "Historial de canjes" conectada al ítem de sidebar que
      antes era decorativo.
- [ ] **PR #2 abierto**, pendiente de mergear a `main`.

## Otros cabos sueltos observados en el código

- [x] El panel de cliente (`PanelCliente`) ahora tiene un botón "Canjear"
      conectado a `POST /api/canjes` en cada premio disponible. Probado en
      el navegador: descuenta puntos, refresca la lista, y el canje queda
      registrado (visible en el historial de canjes del negocio).
- [x] El botón "+ Nuevo negocio" (panel admin) y el botón "Editar" de cada
      tarjeta de negocio no tenían ninguna acción conectada. Ahora
      "+ Nuevo negocio" abre un formulario que llama a `POST /api/negocios`
      (se extendió para pedir email y generar una contraseña, igual que ya
      pasaba en `POST /api/clientes` — antes no se podía loguear un negocio
      creado por acá) y "Editar" abre edición inline en la tarjeta que llama
      a `PATCH /api/negocios` (se extendió para permitir que el admin edite
      nombre/tipo/ciudad/emoji, antes solo aceptaba credenciales de
      Tiendanube). Probado en el navegador con Postgres real: negocio creado,
      logueado con la contraseña generada, y editado correctamente.
## Cerrado / ya no aplica

- [x] `fix.js` (script de un solo uso, con IDs hardcodeados de un negocio
      ya borrado) — eliminado.
- [x] `borrar-cliente.sql` (`DELETE FROM "Cliente"` sin `WHERE`, resto de una
      tarea ya cerrada, no referenciado desde ningún lado del código) —
      eliminado por el mismo motivo que `fix.js`.
- [x] Integración de Vercel — desconectada (el deploy real es Netlify).
