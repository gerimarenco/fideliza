# Estimación y segunda etapa

## 1. Estimación para lanzar en Peperina (al 2026-10-22)

Separado en horas de trabajo y en esperas o dependencias. No hay fecha de
lanzamiento: depende sobre todo de las esperas de la columna de la derecha.

### Trabajo técnico restante (Claude)

| Bloque | Horas aprox. | Depende de |
|---|---|---|
| Aviso de privacidad, política por negocio, "Mis datos", aceptación en el registro | 4–6 | Textos revisados por un profesional |
| Sacar u opcionalizar DNI/género del registro (si se decide) | 1 | Decisión de Genaro |
| Aviso por mail si el agente deja de reportar | 2–3 | Destinatario y umbral |
| Vencimiento de cupones (si se decide) | 1 | Decisión de Genaro |
| Ajustes por lo que salga de la prueba real (cupones, agente) | 2–4 | Prueba real |
| Aplicar el rediseño elegido, por etapas | 16–30 | Elección de una de las tres propuestas |
| **Total** | **~26–45 h** | |

Sin el rediseño (que no es imprescindible para lanzar): **~10–15 h**.

### Trabajo manual de Genaro

| Bloque | Tiempo aprox. |
|---|---|
| Revisar y mergear el PR #114 | 30 min |
| Actualizar el agente en la PC + reiniciar + comprobar (por AnyDesk) | 30–45 min |
| Revisar Ajustes de Peperina y cargar el contacto de soporte | 15 min |
| Identificar el proveedor de la base y hacer + verificar una copia | 1–2 h la primera vez |
| Prueba integral (checklist, sección B) | 1,5–2 h, más esperar al día siguiente para B12 |
| Prueba real de cupones (sección C) | 1 h |
| Capacitación de vendedoras | 30 min |
| Cartel QR + posteo | 1–2 h |
| **Total** | **~7–10 h** repartidas en algunos días |

### Bloqueos externos (no dependen de horas de trabajo)

- **Revisión legal** de privacidad: depende de conseguir quien la haga.
- **Inscripción de la base** ante la AAIP, si corresponde: trámite online
  (TAD), con sus propios tiempos.
- **Acceso a la PC del local** (AnyDesk) en un horario en que se pueda
  reiniciar sin cortar ventas.
- **Proveedor de la base**: si el plan actual no hace copias, puede hacer
  falta un plan pago (se consulta antes de contratar nada).

### Camino más corto a lanzar

1. Mergear #114 → actualizar agente → reiniciar y comprobar (A1, A4, A5).
2. Ajustes + soporte (A2, A3).
3. Prueba integral y de cupones (A8, sección C).
4. Copia de seguridad verificada (A6).
5. Privacidad: como mínimo, aviso en el registro con texto revisado (A7).
6. Capacitación y comunicación (A9, A10).

## 2. Segunda etapa: vender a otros comercios (después de validar Peperina)

**No se empieza ahora.** Primero Peperina andando de punta a punta.

### Imprescindible para un segundo cliente

| Tema | Hoy | Qué hace falta | Esfuerzo |
|---|---|---|---|
| Elegir el club al registrarse/entrar | El link "Registrate" del login lleva fijo a Peperina | Que el login no ofrezca un registro genérico (cada negocio difunde su propio link `/club/{slug}`), o un selector | Bajo |
| Aislamiento de datos | Cada consulta ya filtra por negocio; las integraciones se identifican por tienda/base/token propio | Repasar con datos de dos negocios a la vez (prueba automatizada) | Bajo |
| Alta de negocio repetible | El admin crea el negocio y sus datos a mano | Guía paso a paso + checklist de configuración (marca, soporte, bases, premios, integraciones) | Bajo |
| Bases, privacidad y soporte por negocio | Bases y soporte ya son por negocio | Política de privacidad por negocio (de la etapa 1) | — |
| Mercado Pago | Una sola cuenta para todos | No ofrecerlo hasta resolverlo (hoy no lo usa nadie) | — |
| Acuerdo Retornar ↔ negocio | No existe | Contrato simple: servicio, precio, datos (ver `privacidad.md` 4.3) | Externo |

### Comercial (decisiones de Genaro)

- **Precio y planes**: por ejemplo, abono mensual fijo + costo de alta;
  cuánto cobrar por integraciones a medida (Dragon Fish, Fudo).
- **Cobro recurrente**: transferencia mensual al principio; automatizarlo
  recién con varios clientes.
- **Soporte**: horario y canal; quién atiende si un agente se cae.
- **Demo**: una cuenta de demostración con datos ficticios (ej. "Club
  Búfalo", ya hay un diseño de ejemplo) para mostrar sin exponer Peperina.

### Integraciones de otros sistemas (solo investigación por ahora)

| Comercio | Sistema | Factibilidad | Nota |
|---|---|---|---|
| Búfalo Burgers | Fudo | Alta | Tiene API y webhooks públicos (requiere el plan Pro de Fudo); integración parecida a Tiendanube, sin agente local |
| Angus Brother | PedidosBCN (BCN Soft) | Desconocida | No hay API documentada: preguntar a BCN Soft |
| Bastard Burgers | Pency | Baja | Pedidos por WhatsApp, sin API: solo carga manual de puntos |

### Lo que puede esperar

Autogestión completa del alta por el propio negocio, facturación
automática, multi-sucursal, app nativa. Nada de esto hace falta para un
segundo o tercer cliente.
