import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { nombreClub } from '@/lib/nombreClub';
import { normalizarEmail, filtroEmail, emailValido } from '@/lib/identidad';
import { puntosBienvenida, acreditarBienvenida, celularComparable } from '@/lib/bienvenida';
import { normalizarDni, MENSAJE_DNI_FALTA, MENSAJE_DNI_INVALIDO, MENSAJE_DNI_REPETIDO, MENSAJE_EMAIL_REPETIDO } from '@/lib/dni';
import { ipDeEncabezados } from '@/lib/limiteLogin';
import { LIMITES, RETENCION_MS, claveDni, claveDispositivo, claveIp, limiteSuperado, MENSAJES_LIMITE } from '@/lib/limiteRegistro';

// CORS abierto porque también la consume el widget embebible (public/widget.js)
// desde el dominio de la tienda online del negocio (ver README) — no un
// dominio propio de Retornar, así que hace falta habilitarlo explícitamente.
// No hay problema de seguridad: esta ruta nunca devuelve nada sensible.
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

const SEXO_VALIDO = ['femenino', 'masculino', 'otro'];
// Sin validar formato de país/área a propósito (varía mucho cómo la gente
// escribe su celular) — solo que tenga una cantidad de dígitos razonable,
// una vez sacados espacios/guiones/paréntesis. Se guarda tal cual lo separa
// esta limpieza, no se le agrega código de país: el link de WhatsApp
// (ver VistaClientes en app/page.js) hace su propio mejor esfuerzo al
// armar el número, así que puede necesitar un ajuste manual si alguien lo
// carga de forma muy distinta a la habitual.
const TELEFONO_VALIDO = /^\d{8,13}$/;

// Datos públicos del negocio para la pantalla de auto-registro (nombre real
// y mensaje/promoción propia en vez de mostrar el slug pelado) y para el
// widget embebible que muestra cuántos puntos suma una compra. Nunca
// incluir acá nada sensible: esta ruta no requiere sesión.
export async function GET(request, { params }) {
  const { negocio } = await params;

  const negocioEncontrado = await prisma.negocio.findUnique({
    where: { slug: negocio },
    select: { nombre: true, emoji: true, mensajeRegistro: true, activo: true, puntosXPeso: true, puntosReferido: true, tema: true },
  });

  if (!negocioEncontrado || !negocioEncontrado.activo) {
    return NextResponse.json({ error: 'No encontramos ese negocio.' }, { status: 404, headers: CORS_HEADERS });
  }

  const { activo, tema, nombre, ...negocioPublico } = negocioEncontrado;
  // Cara pública del programa de fidelización ("Club Peperina") en vez del
  // nombre pelado del negocio — esta ruta es exclusivamente para consumo de
  // clientes (pantalla de registro y widget embebible), nunca para el admin
  // o el propio negocio, así que siempre corresponde el prefijo acá.
  negocioPublico.nombre = nombreClub(nombre);
  negocioPublico.temaPrimario = tema?.primario;
  negocioPublico.temaPrimarioTexto = tema?.primarioTexto;
  negocioPublico.temaImagenPortada = tema?.imagenPortada;
  // La paleta completa (solo colores y tipografía de la marca, nada
  // sensible) para que la página del club y la de registro se vean con la
  // identidad del negocio y no con los colores por defecto.
  negocioPublico.tema = Object.fromEntries(
    ['fondo', 'superficie', 'borde', 'texto', 'textoSecundario', 'primario', 'primarioTexto', 'resaltado', 'fuenteTitulo', 'imagenPortada']
      .filter((clave) => typeof tema?.[clave] === 'string')
      .map((clave) => [clave, tema[clave]])
  );
  return NextResponse.json(negocioPublico, { headers: CORS_HEADERS });
}

// El DNI de la cuenta nueva ya existe en este negocio (ver más abajo).
class DniRepetido extends Error {}

// Cookie anónima del dispositivo (un id al azar, sin datos de la persona),
// para el límite por dispositivo de lib/limiteRegistro.js. Solo viaja a
// esta ruta.
const COOKIE_DISPOSITIVO = 'retornar_registro';

// Anota este intento (por DNI, dispositivo e IP) y DESPUÉS cuenta, así
// varios pedidos simultáneos no pasan todos el control. Todo antes de saber
// si el DNI existe. Devuelve qué límite se superó (o null) y lo necesario
// para anotar un "DNI ya registrado" y devolver la cookie.
async function anotarIntento(request, negocioId, dni) {
  let dispositivo = request.cookies.get(COOKIE_DISPOSITIVO)?.value;
  const cookieNueva = !/^[0-9a-f]{32}$/.test(dispositivo || '');
  if (cookieNueva) dispositivo = randomBytes(16).toString('hex');
  const claves = {
    dni: claveDni(negocioId, dni),
    dispositivo: claveDispositivo(dispositivo),
    ip: claveIp(ipDeEncabezados(Object.fromEntries(request.headers))),
  };
  await prisma.intentoRegistro.createMany({
    data: [
      { tipo: 'dni', clave: claves.dni, negocioId },
      { tipo: 'dispositivo', clave: claves.dispositivo, negocioId },
      { tipo: 'ip', clave: claves.ip, negocioId },
    ],
  });
  const desde = (ms) => ({ gte: new Date(Date.now() - ms) });
  const p = LIMITES.proteccion;
  const contar = (where) => prisma.intentoRegistro.count({ where });
  const [dniN, dispositivoN, ipN, rechazosNegocio, rechazosDispositivo, rechazosIp] = await Promise.all([
    contar({ tipo: 'dni', clave: claves.dni, createdAt: desde(LIMITES.dni.ventanaMs) }),
    contar({ tipo: 'dispositivo', clave: claves.dispositivo, createdAt: desde(LIMITES.dispositivo.ventanaMs) }),
    contar({ tipo: 'ip', clave: claves.ip, createdAt: desde(LIMITES.ip.ventanaMs) }),
    contar({ tipo: 'rechazo_dni_ip', negocioId, createdAt: desde(p.ventanaMs) }),
    contar({ tipo: 'rechazo_dni_dispositivo', clave: claves.dispositivo, createdAt: desde(p.ventanaMs) }),
    contar({ tipo: 'rechazo_dni_ip', clave: claves.ip, createdAt: desde(p.ventanaMs) }),
  ]);
  await prisma.intentoRegistro.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENCION_MS) } } }).catch(() => {});
  const superado = limiteSuperado({
    dni: dniN,
    // Sin cookie (un script, o la primera vez) no hay historial del
    // dispositivo: lo frenan los límites por IP y por DNI.
    dispositivo: cookieNueva ? null : dispositivoN,
    ip: ipN,
    rechazosNegocio,
    rechazosDispositivo: cookieNueva ? 0 : rechazosDispositivo,
    rechazosIp,
  });
  return { claves, negocioId, dispositivo, cookieNueva, superado };
}

// Una respuesta "DNI ya registrado", para el modo protección.
async function anotarRechazoDni(intento) {
  await prisma.intentoRegistro.createMany({
    data: [
      { tipo: 'rechazo_dni_ip', clave: intento.claves.ip, negocioId: intento.negocioId },
      { tipo: 'rechazo_dni_dispositivo', clave: intento.claves.dispositivo, negocioId: intento.negocioId },
    ],
  }).catch(() => {});
}

function conDispositivo(respuesta, intento) {
  if (intento?.cookieNueva) {
    respuesta.cookies.set(COOKIE_DISPOSITIVO, intento.dispositivo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/registro',
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  return respuesta;
}

export async function POST(request, { params }) {
  let intento = null;
  try {
    const { negocio } = await params;
    // DNI obligatorio otra vez desde 2026-10-30 (decisión de Genaro): una
    // cuenta por documento en cada negocio, para que nadie cobre varias
    // veces la bienvenida o el bono de referidos con otros emails. Se
    // guarda normalizado (lib/dni.js) y nunca se devuelve ni se loguea.
    const { nombre, email: emailIngresado, password, fechaNacimiento, sexo, telefono, codigoReferido, dni: dniIngresado } = await request.json();
    const email = normalizarEmail(emailIngresado);

    if (!nombre?.trim() || !email || !password) {
      return NextResponse.json(
        { error: 'Nombre, email y contraseña son obligatorios.' },
        { status: 400 }
      );
    }

    if (!emailValido(email)) {
      return NextResponse.json(
        { error: 'El email no es válido.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    if (!fechaNacimiento || !telefono) {
      return NextResponse.json(
        { error: 'Fecha de nacimiento y celular son obligatorios.' },
        { status: 400 }
      );
    }

    if (dniIngresado == null || String(dniIngresado).trim() === '') {
      return NextResponse.json({ error: MENSAJE_DNI_FALTA }, { status: 400 });
    }
    const dni = normalizarDni(dniIngresado);
    if (!dni) {
      return NextResponse.json({ error: MENSAJE_DNI_INVALIDO }, { status: 400 });
    }

    const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');
    if (!TELEFONO_VALIDO.test(telefonoLimpio)) {
      return NextResponse.json(
        { error: 'El celular tiene que tener solo números (con código de área), sin espacios.' },
        { status: 400 }
      );
    }

    const fechaNacimientoDate = new Date(fechaNacimiento);
    if (Number.isNaN(fechaNacimientoDate.getTime()) || fechaNacimientoDate > new Date()) {
      return NextResponse.json(
        { error: 'La fecha de nacimiento no es válida.' },
        { status: 400 }
      );
    }

    // El género es opcional (decisión de Genaro, 2026-10-24): se guarda si la
    // clienta lo elige, para campañas futuras del negocio, y queda vacío si
    // no. Si viene, tiene que ser uno de los valores del formulario.
    const sexoElegido = typeof sexo === 'string' && sexo.trim() !== '' ? sexo.trim() : null;
    if (sexoElegido && !SEXO_VALIDO.includes(sexoElegido)) {
      return NextResponse.json(
        { error: 'Género inválido.' },
        { status: 400 }
      );
    }

    // Buscar el negocio por su slug (el que viene en la URL) y verificar que
    // el email no esté ya registrado -- las dos consultas son independientes
    // entre sí, se piden juntas en vez de una detrás de la otra para no
    // sumar esa demora extra a cada registro.
    const [negocioEncontrado, clienteExistente] = await Promise.all([
      prisma.negocio.findUnique({ where: { slug: negocio } }),
      prisma.cliente.findFirst({ where: { email: filtroEmail(email) } }),
    ]);

    if (!negocioEncontrado || !negocioEncontrado.activo) {
      return NextResponse.json(
        { error: 'No encontramos ese negocio.' },
        { status: 404 }
      );
    }

    // Límites por DNI, dispositivo e IP (lib/limiteRegistro.js), antes de
    // responder nada que dependa de si el email o el DNI ya existen.
    intento = await anotarIntento(request, negocioEncontrado.id, dni);
    if (intento.superado) {
      return conDispositivo(NextResponse.json({ error: MENSAJES_LIMITE[intento.superado] }, { status: 429 }), intento);
    }

    // El email es único en toda la base (no solo en el negocio): con él se
    // inicia sesión, sin elegir negocio (ver lib/auth.js).
    if (clienteExistente) {
      return conDispositivo(NextResponse.json({ error: MENSAJE_EMAIL_REPETIDO }, { status: 409 }), intento);
    }

    // Código de invitación de otra clienta (ver "Referí a una amiga" en el
    // panel del cliente, lib/referidos.js) — opcional, y si no matchea a
    // nadie de este mismo negocio se ignora en silencio: un código viejo,
    // mal tipeado, o de otro negocio no tiene por qué frenar el registro.
    //
    // Autorreferido: si quien invita tiene el mismo celular o el mismo DNI
    // que la cuenta nueva, es la misma persona con otro email; el código se
    // ignora igual que uno inválido (la cuenta se crea, sin bono). El DNI
    // repetido además rechaza la cuenta entera más abajo.
    let referidoPorId = null;
    if (codigoReferido) {
      const invitador = await prisma.cliente.findFirst({
        where: { codigoReferido: String(codigoReferido).trim().toUpperCase(), negocioId: negocioEncontrado.id },
        select: { id: true, telefono: true, dni: true },
      });
      const mismaPersona = invitador && (
        celularComparable(invitador.telefono) === celularComparable(telefonoLimpio) ||
        (invitador.dni && normalizarDni(invitador.dni) === dni)
      );
      referidoPorId = invitador && !mismaPersona ? invitador.id : null;
    }

    // Crear el cliente, asociado al negocio encontrado. Si el negocio tiene
    // una bonificación de bienvenida vigente (ver lib/bienvenida.js), se
    // acredita en la misma transacción: o se crean la cuenta y sus puntos de
    // regalo juntos, o nada.
    const puntosRegalo = puntosBienvenida(negocioEncontrado, new Date());
    const passwordHash = await hashPassword(password);
    const { nuevoCliente, bienvenida } = await prisma.$transaction(async (tx) => {
      // Un documento por negocio. El lock serializa los registros
      // simultáneos con el mismo DNI en este negocio; la consulta cubre
      // también las cuentas anteriores al índice único (septiembre a
      // octubre de 2026, que pueden tener el DNI con ceros adelante), y el
      // índice (negocioId, dni) lo garantiza en la base para las nuevas.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dni:${negocioEncontrado.id}:${dni}`}))`;
      const conMismoDni = await tx.$queryRaw`
        SELECT 1 FROM "Cliente"
        WHERE "negocioId" = ${negocioEncontrado.id}
          AND "dni" IS NOT NULL
          AND ltrim(regexp_replace("dni", '[^0-9]', '', 'g'), '0') = ${dni}
        LIMIT 1`;
      if (conMismoDni.length > 0) throw new DniRepetido();

      const nuevoCliente = await tx.cliente.create({
        data: {
          nombre: nombre.trim(),
          email,
          password: passwordHash,
          negocioId: negocioEncontrado.id,
          puntos: 0,
          fechaNacimiento: fechaNacimientoDate,
          sexo: sexoElegido,
          telefono: telefonoLimpio,
          dni,
          referidoPorId,
        },
        select: { id: true, telefono: true },
      });
      // Si no corresponde (por ejemplo, el celular ya está en otra cuenta),
      // la cuenta se crea igual, sin los puntos, y el motivo queda guardado
      // en la cuenta. La respuesta no lo dice: revelaría que ese celular
      // tiene otra cuenta.
      const { puntos: bienvenida } = await acreditarBienvenida(tx, nuevoCliente, negocioEncontrado, puntosRegalo);
      return { nuevoCliente, bienvenida };
    });

    return conDispositivo(NextResponse.json(
      { message: 'Cliente creado con éxito', clienteId: nuevoCliente.id, puntosBienvenida: bienvenida },
      { status: 201 }
    ), intento);
  } catch (error) {
    // Con el mismo DNI, o dos registros simultáneos con el mismo email o
    // DNI: el segundo choca con el lock o con el índice único, y su
    // transacción (con la bonificación) se deshace entera.
    const dniRepetido = error instanceof DniRepetido ||
      (error?.code === 'P2002' && String(error.meta?.target ?? '').includes('dni'));
    if (dniRepetido && intento) {
      await anotarRechazoDni(intento);
      return conDispositivo(NextResponse.json({ error: MENSAJE_DNI_REPETIDO }, { status: 409 }), intento);
    }
    if (error?.code === 'P2002') {
      return conDispositivo(NextResponse.json({ error: MENSAJE_EMAIL_REPETIDO }, { status: 409 }), intento);
    }
    // Sin el objeto del error: los de Prisma pueden incluir los datos de la
    // consulta (email, celular, DNI) y el log de Netlify no es lugar para eso.
    console.error('Error en registro:', error?.code || error?.name || 'desconocido');
    return NextResponse.json(
      { error: 'Ocurrió un error al crear la cuenta.' },
      { status: 500 }
    );
  }
}