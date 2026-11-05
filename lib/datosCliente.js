import { normalizarEmail, emailValido } from './identidad.js'
import { normalizarDni, MENSAJE_DNI_FALTA, MENSAJE_DNI_INVALIDO } from './dni.js'
import { normalizarCelular, PAIS_PREDETERMINADO } from './telefono.js'

// Datos de una clienta nueva, con las mismas reglas en el registro público
// (app/api/registro/[negocio]) y en "Nuevo cliente" del panel
// (app/api/clientes): nombre y apellido, email, fecha de nacimiento, DNI,
// celular y género opcional. La contraseña se valida aparte (en el panel la
// genera el sistema).

export const SEXO_VALIDO = ['femenino', 'masculino', 'otro']

const PARECE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// body → { datos } listos para guardar, o { error } para mostrar.
export function validarDatosCliente(body) {
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim().replace(/\s+/g, ' ') : ''
  if (!nombre) return { error: 'El nombre y el apellido son obligatorios.' }
  // Sin esto, una cuenta cargada con el email como nombre se ve en el panel
  // como si no tuviera nombre (ver scripts/eliminar-cuentas-sin-nombre.mjs).
  if (PARECE_EMAIL.test(nombre)) return { error: 'Escribí el nombre y el apellido, no el email.' }

  const email = normalizarEmail(body?.email)
  if (!email) return { error: 'El email es obligatorio.' }
  if (!emailValido(email)) return { error: 'El email no es válido.' }

  if (!body?.fechaNacimiento) return { error: 'La fecha de nacimiento es obligatoria.' }
  const fechaNacimiento = new Date(body.fechaNacimiento)
  if (Number.isNaN(fechaNacimiento.getTime()) || fechaNacimiento > new Date()) {
    return { error: 'La fecha de nacimiento no es válida.' }
  }

  if (body?.dni == null || String(body.dni).trim() === '') return { error: MENSAJE_DNI_FALTA }
  const dni = normalizarDni(body.dni)
  if (!dni) return { error: MENSAJE_DNI_INVALIDO }

  const celular = normalizarCelular(body?.telefono, body?.paisTelefono || PAIS_PREDETERMINADO)
  if (celular.error) return { error: celular.error }

  // El género es opcional (decisión de Genaro, 2026-10-24): si viene, tiene
  // que ser uno de los valores del formulario.
  const sexo = typeof body?.sexo === 'string' && body.sexo.trim() !== '' ? body.sexo.trim() : null
  if (sexo && !SEXO_VALIDO.includes(sexo)) return { error: 'Género inválido.' }

  return { datos: { nombre, email, fechaNacimiento, dni, telefono: celular.telefono, sexo } }
}

// ¿Ya hay una cuenta con este DNI en el negocio? Dentro de la transacción
// que crea la cuenta: el lock serializa las altas simultáneas del mismo
// documento y la consulta cubre también las cuentas anteriores al índice
// único (septiembre a octubre de 2026, que pueden tener el DNI con ceros
// adelante o con otra forma); el índice (negocioId, dni) lo garantiza en la
// base para las nuevas.
export async function dniYaRegistrado(tx, negocioId, dni) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dni:${negocioId}:${dni}`}))`
  const existentes = await tx.$queryRaw`
    SELECT 1 FROM "Cliente"
    WHERE "negocioId" = ${negocioId}
      AND "dni" IS NOT NULL
      AND ltrim(regexp_replace("dni", '[^0-9]', '', 'g'), '0') = ${dni}
    LIMIT 1`
  return existentes.length > 0
}
