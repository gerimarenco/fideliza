# Tareas pendientes — Fideliza

> Última actualización: 2026-09-01. Marca lo hecho (`[x]`) y lo que falta
> (`[ ]`), agrupado por área. Ver `contexto-proyecto.md` para el porqué de
> cada cosa y `progreso.md`/`sesion-actual.md` para cuándo se hizo. Ver
> `tareas-futuras.md` para lo que sigue después de esta sesión.

## Ideas del programa "Friends" de Portsaid (investigado 2026-09-01)

- [x] **Bono de bienvenida**: construido, ver "Bono de bienvenida" en
      `contexto-proyecto.md`.
- [ ] **Vencimiento de puntos** (con recordatorio por mail antes de que
      caduquen): el vencimiento en sí se puede construir ya, pero el
      recordatorio por mail depende de sumar un servicio de email al
      proyecto (no existe todavía, ver la idea ya pausada de notificar
      compras por mail en `tareas-futuras.md`). Falta que Cecilia confirme
      si construir el vencimiento ahora sin el recordatorio, o esperar a
      tener las dos cosas juntas.
- [ ] **Canje como descuento flexible** (en vez de/además de premios
      fijos del catálogo): solo sería viable para "compra manual" (el
      negocio ve cuánto puede cubrir el cliente y lo aplica ahí mismo) —
      para ventas automáticas por Tiendanube/Dragon Fish, Fideliza no
      controla el checkout, así que no se puede aplicar un descuento en el
      momento. Falta que Cecilia confirme si le sirve así, limitado a
      compra manual.
- [ ] **Tope de descuento por compra** (ej. máximo 50% del total): depende
      de que exista el punto anterior.

## Dragon Fish

- [x] Endpoint `/api/webhooks/dragonfish` creado y recibiendo el webhook
      real (confirmado el formato: `Entidad`, `Evento`, `Codigo`, `Fecha`,
      `Hora`, `Version`, `BaseDeDatos` — sin datos de la venta).
- [x] Arquitectura acordada para no exponer la PC del negocio a internet:
      agente local que hace polling (nunca escucha conexiones entrantes).
- [x] Zoo Logic confirmó (2026-08-30): la consulta de la factura completa
      depende del tipo de comprobante (`/FACTURA/`, `/facturaelectronica/`,
      `/ticketfactura/`), pero `/facturagrupada/{Codigo}` agrupa las tres —
      no hace falta ramificar por tipo. Piden mandar siempre un "número de
      serie" en las consultas. Los campos de la respuesta (incluida la
      identificación del cliente) están en su swagger, no compartido
      todavía.
- [x] Tabla `FacturaPendiente` en Prisma: `negocioId`, `codigo`, `entidad`,
      `fecha`, `hora`, `procesado`, `resultado`.
- [x] El webhook pasa de solo loguear a insertar una fila en
      `FacturaPendiente` (resolviendo `negocioId` a partir de
      `BaseDeDatos`), filtrando por `Entidad` (solo tipos de comprobante de
      venta) y deduplicando reenvíos (`@@unique([negocioId, codigo])`).
- [x] Campo `Negocio.dragonfishBaseDeDatos` para mapear `BaseDeDatos` →
      `negocioId` (análogo a `tiendanubeStoreId`), cargable desde
      "Integraciones" (admin o el propio negocio).
- [x] Endpoint `GET /api/dragonfish/pendientes` — el agente pregunta qué
      facturas quedaron pendientes (autenticado con `dragonfishAgentToken`
      por `Authorization: Bearer`, no con sesión de NextAuth).
- [x] Endpoint `POST /api/dragonfish/resolver` — el agente reporta
      `{codigo, monto, email/telefono}`; dispara la misma transacción de
      idempotencia (`WebhookEvento` + `Cliente.update` + `MovimientoPuntos.
      create`) que ya usan Mercado Pago y Tiendanube, más un segundo nivel
      de idempotencia con `FacturaPendiente.procesado` para reintentos del
      propio agente. Si no hay monto o identificación de cliente, o no
      matchea ningún cliente, marca `resultado` (`sin_datos`/`sin_cliente`)
      sin sumar puntos, en vez de quedar reintentando para siempre.
- [x] Token secreto por negocio para autenticar al agente
      (`Negocio.dragonfishAgentToken`), generado desde "Integraciones" con
      un botón nuevo ("Generar/Regenerar token del agente") — se muestra
      una sola vez, igual que una contraseña generada. Card de Dragon Fish
      en "Integraciones" desbloqueada (antes decía "Bloqueada" fijo, sin
      campos).
- [x] Agente local escrito como script de Node (`dragonfish-agente/`,
      fuera de la app de Next.js — corre en la PC del negocio, no se
      deploya con el resto). El polling contra Fideliza
      (`pedirPendientes`/`reportarResultado`) está completo y probado; la
      consulta a la API local de Dragon Fish (`consultarDragonfish`) tiene
      placeholders documentados con TODO, ver el punto de abajo.
- [x] Zoo Logic aclaró (2026-08-31): el "número de serie" que pidieron
      mandar siempre **no va en las llamadas a la API** — es solo un dato a
      incluir cuando se los consulta por mail a su casilla de soporte, no
      un parámetro técnico de la integración. Sacado de
      `dragonfish-agente/` (código y README).
- [x] Zoo Logic mandó (2026-08-31) la documentación completa de la API
      (PDF) y el swagger real (`v16.0004.14968`) — con eso se terminó
      `consultarDragonfish` en `dragonfish-agente/index.js` con la
      implementación real, ya no hay incógnitas técnicas:
  - Endpoint: `GET /Facturaagrupada/{Codigo}/` (agrupa los tres tipos de
    comprobante, confirmado). Devuelve `Total` (monto) y `Email`; si la
    factura no tiene email cargado, se hace un segundo pedido a
    `GET /Cliente/{Codigo}/` (con el código de cliente que trae la
    factura) para sacar `EMail`/`Telefono` de la ficha del cliente.
  - Autenticación: headers `IdCliente` + `Authorization` (el JWToken) en
    cada consulta, más un chequeo de `POST /Autenticar` al arrancar el
    agente (una sola vez, no en cada request).
  - Probado contra un mock local que simula las dos respuestas reales
    (factura con email, factura sin email con fallback a `/Cliente/`) —
    el ciclo completo (consulta → reporte a Fideliza → puntos) funciona.
- [ ] **Bloqueante actual — ya no es técnico, es de configuración local**:
      3 datos que salen de configurar Dragon Fish en la PC de Peperina
      (documentado paso a paso en `dragonfish-agente/README.md`), no de
      una respuesta de soporte:
  - [ ] `DRAGONFISH_BASE_URL` — sale de armar el "Servicio REST API" en
        Dragon Fish (Configuración → Parámetros del sistema).
  - [ ] `DRAGONFISH_ID_CLIENTE` — sale de armar el "Cliente REST API".
  - [ ] `DRAGONFISH_TOKEN` — se obtiene desde el propio Dragon Fish si la
        versión es 15.0006.14682 o posterior, o si no, **llamando a Mesa
        de Ayuda de Zoo Logic (77005700)** con el `DRAGONFISH_ID_CLIENTE` +
        clave privada + usuario/contraseña de Dragon Fish. El sistema de
        Peperina tiene más de 2 años sin actualizar — es probable que
        corresponda a este segundo caso.
- [ ] Configurar el webhook de "Factura de venta" en Dragon Fish apuntando
      a `/api/webhooks/dragonfish` (paso a paso en el README del agente) —
      hoy solo está probado con webhooks simulados a mano.
- [ ] Con las 3 variables de arriba: correr el agente contra el Dragon
      Fish real de Peperina y hacer una venta de prueba de punta a punta.
- [ ] Decidir formalmente dónde corre el agente en la PC de Peperina
      (arranque automático, gestor de procesos tipo `pm2`) — hoy solo está
      documentado un `npm start` manual en `dragonfish-agente/README.md`.
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
- [x] Protección de idempotencia (`WebhookEvento`) y registro en
      `MovimientoPuntos` (PR #28) — mismo patrón que Mercado Pago,
      `referenciaExterna` es `storeId:orderId` porque el orderId de
      Tiendanube solo es único dentro de una tienda.

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
- [x] Condición de carrera en `POST /api/canjes` (PR #36): dos canjes
      simultáneos podían pasar los dos la validación de saldo antes de
      que cualquiera descontara — verificado con 8 canjes en paralelo
      contra un cliente con 1000 puntos y un premio de 600, entraban
      5-6 en vez de 1, dejando saldo negativo. Arreglado con
      `updateMany` condicional (`puntos: { gte: premio.puntos }`) en
      una transacción, mismo patrón que la idempotencia de arriba.
- [ ] Separar el endpoint `GET /api/negocios` por rol en vez de que el
      negocio/cliente pidan todo y filtren del lado del cliente (mejora
      de diseño, no urgente — quedó explícitamente pospuesta).
- [ ] Unificar el manejo de errores entre los tres webhooks (hoy cada uno
      responde distinto ante los mismos tipos de falla — status codes y
      logging inconsistentes entre Mercado Pago, Tiendanube y Dragon
      Fish). Pospuesto a propósito, foco puesto en el bug de Mercado Pago
      primero por ser el único con tráfico real.

## Login (PRs #19-#20)

- [x] Toggle de mostrar/ocultar contraseña en el form de credentials de
      `/login`.
- [x] Login con Google, para los tres roles (admin/negocio/cliente). El
      email de la cuenta de Google se busca contra `ADMIN_EMAIL` →
      `Negocio.email` → `Cliente.email`, en ese orden; si no matchea
      ninguno, se rechaza el login (no crea cuentas nuevas) con un
      mensaje en español en `/login`.
- [x] Fix: los errores de login (incluido el rechazo de Google) ahora
      redirigen a `/login` en vez de a la página de error genérica de
      NextAuth en inglés (faltaba `error: '/login'` en `pages` de
      `authOptions`).
- [x] Configuración real en Netlify: `GOOGLE_CLIENT_ID`,
      `GOOGLE_CLIENT_SECRET` y `NEXTAUTH_URL` (esta última no existía,
      causaba `redirect_uri_mismatch` apuntando a `localhost:3000`).
      Validado en producción: rechazo de un email sin cuenta funciona
      correctamente.
- [ ] Falta probar en producción el caso de éxito (login con Google con
      un email que sí tiene cuenta existente).

## Suma de puntos y Mercado Pago del cliente (PR #26)

- [x] Se sacó "Cargar puntos con Mercado Pago" del panel de cliente —
      exigía que la clienta pagara *de nuevo*, a mano, el monto ya
      gastado (a la cuenta de MP de la plataforma, no la del negocio), lo
      que contradice que la clienta no debe hacer nada para sumar puntos.
      Se borró la UI/estado/handler de `PanelCliente`; el backend
      (`crear-preferencia`, webhook, `Integraciones`) queda intacto por
      si se rediseña como cobro real más adelante.
- [ ] Los únicos dos caminos hoy que no requieren ninguna acción ni de la
      clienta ni del negocio son Tiendanube (ya andando) y Dragon Fish
      (bloqueado). Para el volumen real del local físico de Peperina,
      destrabar Dragon Fish importa más que cualquier otro ajuste.
- [x] El webhook de Tiendanube ya escribe en `MovimientoPuntos` y tiene
      protección de idempotencia, igual que Mercado Pago (PR #28) — los
      tres webhooks activos (MP, Tiendanube; Dragon Fish cuando se
      destrabe) van a poder alimentar el email de notificación desde la
      misma tabla, sin gaps.

## Paginación de listados

- [x] Backend: `GET /api/clientes` y `GET /api/canjes` (nuevo) paginados
      por offset (`skip`/`take`), con `{ items, page, pageSize, total,
      totalPages }`.
- [x] Frontend: paginación numerada en la lista de "Clientes", pantalla
      nueva de "Historial de canjes" conectada al ítem de sidebar que
      antes era decorativo.
- [x] PR #2 mergeado a `main`.

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
- [ ] **Relevamiento de ítems del menú lateral sin conectar** (los tres
      paneles): solo "Inicio" andaba de fábrica; "Canjes" y los botones
      de negocio ya se conectaron en items anteriores. Estado actual:
  - [x] "Negocios" (admin) — conectado: vuelve a la grilla general de
        negocios (no tenía backend nuevo, ya existía la vista, solo
        faltaba cablear el click).
  - [x] "Clientes" (admin) y "Mis clientes" (negocio) — conectados:
        pantalla dedicada con el listado paginado completo, mismo patrón
        que "Canjes" (el backend, `GET /api/clientes`, ya soportaba
        paginación).
  - [x] "Premios" (negocio) — conectado. Se construyó el CRUD completo
        que faltaba: `GET/POST/PATCH /api/premios` (mismo patrón de
        autorización y paginación que clientes), con `activo Boolean`
        agregado al modelo `Premio` para borrado lógico — "Desactivar"
        no borra la fila, solo la saca de "Premios disponibles" del
        cliente y de nuevos canjes; conserva el historial de canjes
        pasados intacto (`Canje.premioId` nunca queda huérfano).
        `GET /api/negocios` y `POST /api/canjes` filtran/validan por
        `activo` (defensa en profundidad además del filtro de UI).
        Decidido con el negocio: solo el negocio administra sus propios
        premios (el admin sigue viendo la lista de solo lectura como
        hoy, sin ítem de sidebar propio); alcanza con nombre/puntos/
        emoji, sin descripción ni límite de stock por ahora. Probado en
        el navegador con Postgres real: alta, edición, desactivar/
        reactivar, y verificado que un canje contra un premio
        desactivado es rechazado por el backend aunque se lo llame
        directo (bypaseando la UI).
  - [x] "Integraciones" (admin y negocio) — conectado. `GET /api/negocios`
        ahora expone `tiendanubeStoreId` (no es secreto) y un booleano
        calculado `tiendanubeConectado` (nunca el `tiendanubeAccessToken`
        en sí). `PATCH /api/negocios` gana soporte para `slug` (con
        validación de formato y manejo del error de unicidad de Prisma,
        `P2002`, con un mensaje claro en vez de un 500) — antes el `slug`
        que habilita Mercado Pago solo se podía cargar a mano en la base
        (era el hallazgo colateral anotado más abajo, ya resuelto). De
        paso se corrige que `PATCH /api/negocios` devolvía el objeto
        crudo del negocio, incluyendo el hash de password y el
        `tiendanubeAccessToken` en texto plano — ahora responde con la
        misma forma segura que el resto de los endpoints. Pantalla nueva
        con tres bloques: Tiendanube (Store ID + Access Token, éste
        último nunca precargado), Mercado Pago (el `slug`, con aviso de
        que cambiarlo rompe links ya compartidos), y Dragon Fish (card
        fija "Bloqueada", sin campos, mientras se espera a Zoo Logic).
        Decidido con el negocio: el propio negocio también puede editar
        su `slug` (no solo el admin). Probado en el navegador con
        Postgres real: carga de credenciales de Tiendanube y del slug,
        badges "Conectada"/"No conectada" correctos, validación de
        formato del slug, error 409 al repetir un slug ya usado por otro
        negocio, persistencia tras recargar la página (con el Access
        Token siempre en blanco), y la misma pantalla funcionando para
        el admin viendo el panel de un negocio puntual.
  - [x] "Ajustes" (admin) — conectado (PR #23). Versión mínima: email de
        acceso de solo lectura, mismo patrón que "Ajustes" (negocio). No
        incluye cambio de contraseña (la del admin es fija por
        `ADMIN_PASSWORD_HASH`, variable de entorno, no está en la base —
        migrarla queda pendiente para cuando haya un pedido concreto).
  - [x] "Ajustes" (negocio) — conectado (este ítem no existía en el
        sidebar de Negocio, se agregó de cero; es distinto del "Ajustes"
        del admin de arriba, que sigue sin definir). Tres bloques:
        cambio de contraseña (endpoint nuevo, `POST
        /api/negocios/password`, verifica la contraseña actual con
        `verifyPassword` antes de aceptar la nueva, mínimo 6
        caracteres, siempre sobre la propia cuenta — el id sale de la
        sesión, nunca del body), `puntosXPeso` editable (se agregó a
        `PATCH /api/negocios`, entero positivo, mismo criterio de
        autorización que `slug`/Tiendanube: admin o el propio negocio),
        y un dato de cuenta de solo lectura (el email de acceso, ya
        disponible en la sesión, sin costo de backend). El precio en
        puntos de un premio individual ya se podía editar desde la
        pantalla "Premios" (edición inline, `PATCH /api/premios` ya
        aceptaba `puntos`) — no hizo falta duplicarlo acá. Probado en
        el navegador con Postgres real: error claro con la contraseña
        actual incorrecta, error cuando la confirmación no coincide,
        cambio exitoso verificado logueándose con la contraseña nueva,
        y persistencia de `puntosXPeso` en la base.
  - [x] **Bug encontrado en producción** (reportado por Cecilia, no en
        el relevamiento original): en el panel admin, con la grilla de
        negocios a la vista (sin ningún negocio elegido), tocar
        "Clientes", "Puntos y canjes" o "Integraciones" resaltaba el
        ítem del sidebar pero la pantalla seguía mostrando la grilla —
        esas secciones viven dentro del panel de un negocio puntual y
        el contenido no reaccionaba a `seccionActiva` mientras no había
        ninguno elegido. Se agrega un mensaje "Elegí un negocio para ver
        sus [clientes/canjes/integraciones]" con un botón que lleva de
        vuelta a la grilla, en vez de quedarse en silencio. Probado en
        el navegador reproduciendo el flujo exacto (Negocios → Clientes
        sin elegir ninguno) y verificado que dentro del panel de un
        negocio sigue andando igual que antes.

## Deploy / Netlify

- [x] **Resuelto**: la cuenta de Netlify (`gerimarenco`) se había quedado
      sin créditos operativos y Cecilia actualizó el plan — los deploys de
      producción volvieron a funcionar con normalidad (2026-08-25).
- [x] Manejo de errores en los botones de guardado del frontend: varias
      funciones (`crearNegocio`, `guardarEdicionNegocio`, `crearPremio`,
      `guardarEdicionPremio`, `togglePremioActivo`, `guardarIntegraciones`,
      `guardarPuntosXPeso`, `cambiarPassword`, `agregarCliente`,
      `sumarPuntos`) llamaban a `fetch` sin `try/catch`. Si el servidor
      devolvía algo que no era JSON válido, la promesa se rechazaba en
      silencio y el botón "no hacía nada" a los ojos de quien lo usa. Ahora
      todos esos casos muestran un `alert()` claro. **Mergeado (PR #10)**.
- [x] **Causa de fondo real de "Guardar negocio no hace nada" encontrada y
      arreglada**: el comando de build de Netlify nunca corría
      `prisma migrate deploy`, solo `prisma generate` — la base de
      producción se había quedado atrás de varias migraciones (la más
      grave, `Premio.activo`, hacía que `GET /api/negocios` rompiera con
      un 500 sin cuerpo, apenas disimulado antes por la falta de manejo de
      errores de arriba). Build command corregido a
      `prisma migrate deploy && prisma generate && npm run build`.
      **Mergeado (PR #11)**.
- [x] Bug de navegación fantasma: cualquier acción que recargaba la lista
      de negocios (crear, editar, y el toggle de activo/inactivo nuevo)
      sacaba al admin de la grilla y lo mandaba de golpe al panel del
      primer negocio de la lista, aunque estuviera parado en "Negocios" a
      propósito — el auto-select del primer negocio corría en cada
      recarga, no solo en la carga inicial tras login. **Mergeado (PR
      #13)**, junto con conectar desactivar/reactivar negocio (`Negocio.
      activo`, ya existía en el schema sin usar).
- [x] Texto invisible en campos de formulario con el sistema en modo
      oscuro: `globals.css` tenía una regla `prefers-color-scheme: dark`
      heredada del template inicial (nunca usada a propósito) que ponía
      el texto del body en gris claro sin tocar el fondo blanco por
      defecto de los `<input>` — texto claro sobre fondo blanco,
      invisible. Afectaba cualquier campo de la app (login incluido), no
      algo específico de un negocio. Sacada la regla, agregado
      `color-scheme: light` explícito. **Mergeado (PR #17)**.
- [x] Resuelto (PR #32): el check de deploy-preview quedaba en rojo en
      todo PR desde el #11 porque `DATABASE_URL` no está configurada
      para ese contexto. El build ahora saltea `prisma migrate deploy`
      cuando no hay `DATABASE_URL` disponible (el build de Next no
      necesita la base) — sin exponerle la base de producción a los
      previews. Ver `contexto-proyecto.md`.

## Marca propia por negocio (tema visual)

- [x] `Negocio.tema` (JSON opcional) agregado al schema — colores
      (`fondo`, `superficie`, `borde`, `texto`, `textoSecundario`,
      `primario`, `primarioTexto`, `resaltado`), tipografía de títulos
      (`fuenteTitulo`) e imagen de portada (`imagenPortada`, URL).
      Validado en `PATCH /api/negocios` (admin-only). **Mergeado (PR
      #14, #16)**.
- [x] Aplicado a `PanelNegocio` (todas sus secciones) y `PanelCliente`,
      nunca al chrome del Admin. 7 selectores de color + 2 campos de
      texto agregados a "Editar negocio". **Mergeado (PR #14, #16)**.
- [x] Paleta de Peperina cargada vía migraciones de datos (no hay pantalla
      de autogestión todavía): primero una aproximación negro/beige
      pensada a partir del logo de Instagram (PR #14), después la paleta
      real que mandó la dueña de la marca — blanco/crema con acentos en
      beige y tipografía serif (PR #15).
- [x] Imagen de portada tipo "muro de Facebook" (PR #16) — probado
      pegando la URL real de Peperina (subida a imgur) en producción.
- [x] Un sexto color que la dueña de Peperina mandó (`#37A1D`) había
      llegado incompleto (5 dígitos, un hex válido necesita 6). Cecilia
      decidió (2026-08-27) no perseguirlo — se cierra sin cargar, la
      paleta se queda con los 5 colores ya confirmados.
- [x] Pedido de la usuaria "meterle detalles, los mini dibujitos" — se
      interpretó como el color de "resaltado" en los chips de puntos/
      avatares (antes reusaban el mismo tono que los botones). Cecilia
      confirmó (2026-08-27) que ya está resuelto, se cierra sin más
      cambios.
- [ ] No hay pantalla de autogestión del tema para el propio negocio (hoy
      solo lo carga el admin) — evaluar si hace falta cuando se sume un
      segundo negocio real.

## Cerrado / ya no aplica

- [x] `fix.js` (script de un solo uso, con IDs hardcodeados de un negocio
      ya borrado) — eliminado.
- [x] `borrar-cliente.sql` (`DELETE FROM "Cliente"` sin `WHERE`, resto de una
      tarea ya cerrada, no referenciado desde ningún lado del código) —
      eliminado por el mismo motivo que `fix.js`.
- [x] Integración de Vercel — desconectada (el deploy real es Netlify).
