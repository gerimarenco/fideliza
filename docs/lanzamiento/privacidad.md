# Privacidad y datos personales — plan de cumplimiento (borrador para revisión)

> **Esto no es asesoramiento legal.** Es un relevamiento técnico de qué datos
> trata Retornar y de qué pide la Ley 25.326, para llevárselo a un abogado o
> abogada que lo revise antes de lanzar. Los textos de abajo son borradores:
> no publicarlos como definitivos sin esa revisión.
>
> Estado de la normativa al 2026-10-22: la Ley 25.326 sigue vigente (hay una
> reforma en debate en el Congreso, no aprobada). La autoridad de aplicación
> es la AAIP (Agencia de Acceso a la Información Pública). Conviene confirmar
> en argentina.gob.ar/aaip y en el Boletín Oficial si hubo cambios.

## 1. Qué datos trata Retornar hoy

| Dato | De dónde sale | Para qué se usa hoy | ¿Hace falta? |
|---|---|---|---|
| Nombre y apellido | Registro | Saludo en el panel, lista de clientes, mensaje de WhatsApp, Excel | Sí |
| Email | Registro | Cuenta, login, mails de puntos, identificar compras online (Tiendanube) y del local (Dragon Fish) | Sí |
| Celular | Registro | Identificar compras del local (Dragon Fish), botón de WhatsApp del negocio | Sí (para el local) |
| Fecha de nacimiento | Registro | Regalo de cumpleaños | Sí, si el negocio usa el regalo |
| **DNI** | Registro (obligatorio) | **Ninguno**: solo aparece en el Excel exportado | **Revisar** — ver 3.1 |
| Género | Registro (obligatorio) | Ninguno funcional (solo se guarda) | **Revisar** — ver 3.1 |
| Contraseña | Registro | Login | Sí (se guarda cifrada) |
| Compras (monto convertido a puntos), canjes, movimientos | Tiendanube, Dragon Fish, carga manual | Puntos, historial, niveles, estadísticas | Sí |

**Quién es quién**: el responsable de la base es cada negocio (Peperina para
sus clientas); Retornar trata los datos por cuenta del negocio (encargado
del tratamiento). Esto conviene dejarlo escrito en un acuerdo entre
Retornar y cada negocio (sección 4).

**Proveedores que reciben datos** (cesión/transferencia a revisar):
Netlify (hosting, EE.UU.), proveedor de PostgreSQL (a confirmar dónde
están los servidores), Resend (mails, EE.UU.), Google (login con Google),
Tiendanube (ya tiene los datos de las compras online).

## 2. Qué pide la ley (puntos a confirmar con quien revise)

1. **Informar al recolectar (art. 6)**: al registrarse, la persona tiene que
   saber para qué se usan sus datos, quién es el responsable y cómo
   contactarlo, qué datos son obligatorios, y que puede acceder,
   rectificar y suprimir. **Hoy el registro no informa nada de esto.**
2. **Consentimiento (art. 5)**: libre, expreso e informado. Un registro
   voluntario con información clara y una casilla de aceptación es el
   camino habitual.
3. **Calidad de los datos (art. 4)**: los datos tienen que ser adecuados y
   no excesivos para la finalidad. Pedir DNI y género como obligatorios sin
   usarlos para nada es difícil de justificar.
4. **Derechos de acceso, rectificación y supresión (arts. 14 a 16)**: tiene
   que haber una forma de pedirlos y responderlos en plazo (acceso: 10 días
   corridos; rectificación o supresión: 5 días hábiles).
5. **Seguridad y confidencialidad (arts. 9 y 10)**: contraseñas cifradas,
   acceso por roles, sin datos personales en logs (ver sección 5).
6. **Transferencia internacional (art. 12)**: los proveedores en EE.UU.
   pueden requerir cláusulas contractuales o consentimiento. La AAIP tiene
   cláusulas modelo para esto.
7. **Inscripción de la base (art. 21)**: ante el Registro Nacional de Bases
   de Datos de la AAIP, por la plataforma TAD (Trámites a Distancia).
   Quién tiene que inscribirla (cada negocio como responsable) y si
   corresponde en este caso es lo primero a confirmar con quien revise.
8. **Publicidad (art. 27)**: si el negocio usa la base para mandar
   promociones (WhatsApp, mail masivo con el Excel exportado), la persona
   puede pedir que no le manden más, y hay que respetarlo.

## 3. Cambios propuestos en la app

### 3.1 Datos que conviene dejar de pedir como obligatorios — decisión de Genaro

- **DNI**: no se usa para nada. Opciones: (a) dejar de pedirlo, (b) pedirlo
  como opcional, (c) mantenerlo si hay un uso concreto previsto (por
  ejemplo, buscar a la clienta por DNI en Dragon Fish) y decirlo en la
  información del registro.
- **Género**: tampoco se usa. Mismas opciones.

No se tocó nada de esto: es una decisión de producto y no se borra ningún
dato ya guardado.

### 3.2 Aviso y aceptación en el registro — se implementa cuando los textos estén revisados

- Debajo del botón "Registrarme": "Al registrarte aceptás las [Bases y
  condiciones] y la [Política de privacidad] de {Club}". Con casilla de
  aceptación si quien revisa lo considera necesario.
- Página pública `/club/{negocio}/privacidad` con la política del negocio
  (mismo criterio que las bases y condiciones: un texto por negocio).
- Guardar fecha y versión de la aceptación en la cuenta.

### 3.3 Derechos de las personas

- Opción "Mis datos" en el menú de la clienta: ver lo que hay guardado y
  pedir corrección o baja (a la casilla o WhatsApp de soporte del negocio).
- Procedimiento del lado del negocio para dar de baja una cuenta (hoy no
  existe forma de borrar una clienta desde el panel).

### 3.4 Exportación a Excel

El Excel exportado sale de Retornar con datos personales completos. Sumar
un aviso al exportar ("Este archivo tiene datos personales de tus clientas:
guardalo en un lugar seguro y no lo compartas").

## 4. Borradores de textos (para revisión)

### 4.1 Información en el registro (texto corto)

> Tus datos los usa {Negocio} para tu cuenta del {Club}: sumar los puntos
> de tus compras en el local y en la tienda online, avisarte por mail cuando
> sumás o canjeás, y tu regalo de cumpleaños. Son obligatorios nombre,
> email, celular y fecha de nacimiento. Podés pedir ver, corregir o borrar
> tus datos escribiendo a {contacto de soporte}. Más detalle en la
> [Política de privacidad].

### 4.2 Política de privacidad (estructura)

1. Quién es el responsable: {Negocio}, {domicilio}, {contacto}.
2. Qué datos se piden y por qué (tabla de la sección 1, solo los que se
   sigan pidiendo).
3. Para qué se usan: programa de puntos, mails del club, regalo de
   cumpleaños, comunicaciones del negocio (si se decide usarlos para
   promociones, decirlo acá y explicar cómo darse de baja).
4. Con quién se comparten: proveedores que hacen funcionar el servicio
   (Retornar, hosting, envío de mails), solo para eso.
5. Dónde se guardan y con qué medidas de seguridad.
6. Cuánto tiempo se guardan: mientras la cuenta esté activa y hasta
   {plazo} después de darla de baja.
7. Derechos: acceso, rectificación, supresión; cómo pedirlos y plazos.
8. Texto obligatorio de la AAIP sobre su rol de control (confirmar redacción
   vigente con quien revise).

### 4.3 Acuerdo Retornar ↔ negocio (puntos mínimos)

Retornar trata los datos solo para prestar el servicio, no los usa para
otra cosa ni los cede, aplica medidas de seguridad, avisa si hay un
incidente, y los devuelve o borra al terminar el servicio.

## 5. Ya resuelto en código

- Contraseñas cifradas (bcrypt); links de recuperación de un solo uso con
  vencimiento de 1 hora.
- Cada negocio solo ve sus clientas; una clienta solo ve sus datos.
- Los logs del servidor ya no guardan el email completo de las clientas
  (2026-10-22), y el agente de Dragon Fish no escribe emails ni teléfonos
  en su log.
- Ninguna cuenta se crea sin que la persona se registre (desde 2026-09-22).

## 6. Pendiente

| Acción | Responsable | Estado |
|---|---|---|
| Revisión legal de este documento | Genaro + profesional | Pendiente de intervención manual |
| Decidir DNI y género (3.1) | Genaro | Pendiente de decisión |
| Inscripción de la base ante la AAIP, si corresponde | Peperina (responsable) | Pendiente de decisión |
| Implementar aviso, política y "Mis datos" (3.2, 3.3) | Claude | Bloqueado hasta tener textos revisados |
| Confirmar país de los servidores de la base de datos | Genaro | Pendiente de diagnóstico |
