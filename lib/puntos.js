// Cuántos puntos corresponde acreditar por una compra de `monto` pesos,
// según el negocio (`Negocio.puntosXPeso`: cuántos pesos equivalen a 1
// punto). Se redondea siempre hacia abajo, nunca para arriba.
//
// Esta cuenta se hacía por separado en 5 lugares (carga manual, el
// resolver de Dragon Fish, los webhooks de Tiendanube y Mercado Pago, y
// la vista previa del formulario de carga manual en app/page.js) — una
// auditoría anterior (ver docs/tareas-futuras.md, ítem 19) confirmó que
// las cuatro del backend coincidían exactamente, pero seguían siendo
// copias independientes con el mismo riesgo de divergir si alguna se
// edita sin tocar las otras. Unificadas acá.
export function calcularPuntosPorCompra(monto, puntosXPeso) {
  if (!Number.isFinite(monto) || monto <= 0) return 0
  if (!Number.isFinite(puntosXPeso) || puntosXPeso <= 0) return 0
  return Math.floor(monto / puntosXPeso)
}
