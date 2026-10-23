# Visita a Peperina: pruebas presenciales antes de lanzar

Guion para una sola visita al local (calcular 1 h 30). Junta lo que no se
puede probar desde afuera: el agente de la caja, ventas reales, una compra
online y los cupones. Cada paso dice qué tiene que pasar y qué guardar como
evidencia (captura o foto). Lo que salga distinto, anotarlo tal cual y
mandárselo a Claude.

Las pruebas automáticas ya cubren la lógica contra una base de prueba;
esto confirma que **las integraciones reales** se comportan igual.

## 0. Antes de ir

- [ ] Publicado en producción el último hito (incluye la migración que crea
      la tabla de intentos de login; Netlify la aplica sola al publicar).
- [ ] Una **cuenta de prueba propia** registrada en
      retornar.com.ar/club/peperina, con un email tuyo y tu celular. Nunca la
      cuenta de una clienta real.
- [ ] Para los cupones (paso 5): autorización tuya y tres premios de prueba
      de pocos puntos (ver `checklist-lanzamiento.md`, sección C). Cargarle
      a la cuenta de prueba los puntos necesarios con "Cargar una compra".
- [ ] Acceso a Netlify, a Tiendanube (administrador) y al panel del negocio.

## 1. Agente de Dragon Fish (20 min)

Si todavía no se copiaron los archivos nuevos: `dragonfish-agente/README.md`,
"Actualizar el agente en una PC donde ya está instalado" (copiar `index.js`,
los dos `.bat`, `package.json`, `package-lock.json` y el README; **no borrar
`.env` ni `node_modules`**).

1. Reiniciar la PC. Entrar a Windows y abrir Dragon Fish como siempre.
2. Esperar 2 minutos. Doble clic en `verificar-agente.bat`.

| Lo que muestra | Qué significa | Qué hacer |
|---|---|---|
| `[OK] El agente esta corriendo` y una línea con la hora de hoy que dice "Agente Dragon Fish arrancado" | Arranca solo | Seguir. **Foto de la pantalla** |
| La última línea dice "Dragon Fish todavía no responde" | El agente anda pero no ve a Dragon Fish | Confirmar que Dragon Fish esté abierto; mirar de nuevo en 2 min |
| `El agente NO esta corriendo` | La tarea programada no se ejecutó | Programador de tareas → la tarea → "Resultado de la última ejecución". Si no es `(0x0)` ni `(0x41301)`, volver a cargar la contraseña de Windows en la pestaña General. Foto y mandársela a Claude |
| No existe `agente.log` | Nunca se abrió con el `.bat` nuevo | Revisar que en el Programador figure `iniciar-agente.bat` **de esta carpeta** |
| Línea con "401" o "No autorizado" | El token del `.env` no coincide | Integraciones → Dragon Fish → "Regenerar token" y pegarlo en `.env` (`FIDELIZA_AGENT_TOKEN`) |

3. En el panel (Integraciones → Caja del local) tiene que decir "Agente
   funcionando — último contacto hace X minutos". **Captura.**

## 2. Ventas en la caja (20 min)

Hacerlas como cualquier venta, con un monto chico. Después de cada una,
esperar 1 minuto y mirar `verificar-agente.bat` (la última línea dice qué
pasó con esa factura) y el panel de la cuenta de prueba.

| # | Venta | Resultado esperado en el log | Además |
|---|---|---|---|
| 2.1 | Con el **email** de la cuenta de prueba, escrito con alguna mayúscula | `acreditado (+N puntos)` | Llega el mail "sumaste puntos"; aparece en "Mis movimientos" |
| 2.2 | Con el **celular** de la cuenta de prueba, con guiones | `acreditado` | Igual que 2.1 |
| 2.3 | Sin email ni celular | `sin_datos` | No se suma nada a nadie |
| 2.4 | Con un email que **no** está registrado | `sin_cliente` | **No** se crea ninguna cuenta (buscarlo en Clientes) |
| 2.5 | Un cambio facturado en $0, o un monto menor a $100, con el email de prueba | `sin_puntos` | **No** llega mail de "0 puntos" |

Si el negocio hace notas de crédito por devoluciones, hacer una de la venta
2.1: hoy **no** descuenta puntos (es una decisión pendiente, L-27). Anotar
qué muestra el log.

## 3. Compra online (10 min)

1. En peperina.com, con el email de la cuenta de prueba, una compra pagada
   (puede ser con un cupón de 100% creado para la prueba, si Tiendanube lo
   permite, o una compra real chica).
2. En 1-2 minutos: puntos sumados y mail. **Captura de "Mis movimientos".**
3. Anotar si los puntos se calcularon sobre el total **con** envío o sin
   envío (hoy se usa el total de la orden, que incluye el envío: decisión
   pendiente, L-34).
4. Un pedido que quede **pendiente de pago** (por ejemplo, transferencia sin
   pagar): no tiene que sumar nada.

## 4. Canje en el local (5 min)

Panel → Clientes → la cuenta de prueba → "Canjear un premio en el local"
con un premio sin cupón. Los puntos se descuentan una vez, aparece en
Canjes y llega el mail.

## 5. Cupones reales de Tiendanube (20 min, con tu autorización)

Seguir `checklist-lanzamiento.md`, sección C (C1 a C6). Lo más importante
para el premio de $70.000: **C4** (compra mínima con una promoción activa) y
**C5** (si el envío cuenta para la compra mínima). Al terminar, borrar los
cupones de prueba en Tiendanube → Descuentos y desactivar los premios de
prueba en el panel.

## 6. Copia de seguridad (15 min, puede ser desde tu casa)

`backups.md`, puntos 1 a 3: identificar el proveedor de la base, hacer una
copia y restaurarla en una base aparte. Anotar la fila en el registro del
final de ese documento.

## 7. Al terminar

- Mandarle a Claude: las fotos/capturas, el resultado de cada fila, y
  cualquier cosa distinta de lo esperado.
- En `checklist-lanzamiento.md`, marcar A4, A5, A6, B4–B8 con la evidencia.
