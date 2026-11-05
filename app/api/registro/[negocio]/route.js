import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { nombreClub } from '@/lib/nombreClub';
import { filtroEmail } from '@/lib/identidad';
import { puntosBienvenida, acreditarBienvenida, mismoCelular } from '@/lib/bienvenida';
import { enviarEmailBienvenida } from '@/lib/email';
import { normalizarDni, MENSAJE_DNI_REPETIDO, MENSAJE_EMAIL_REPETIDO } from '@/lib/dni';
import { validarDatosCliente, dniYaRegistrado } from '@/lib/datosCliente';
import { ipDeEncabezados } from '@/lib/limiteLogin';
import { LIMITES, RETENCION_MS, claveDni, claveDispositivo, claveIp, limiteSuperado, bloqueadoPorProteccion, MENSAJES_LIMITE } from '@/lib/limiteRegistro';

// CORS abierto porque también la consume el widget embebible (public/widget.js)
// desde el dominio de la tienda online del negocio (ver README) — no un
// dominio propio de Retornar, así que hace falta habilitarlo explícitamente.
// No hay problema de seguridad: esta ruta nunca devuelve nada sensible.
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };


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

// Cookie anónima del dispositivo (un id al azar, sin datos de la persona),
// para el límite por dispositivo de lib/limiteRegistro.js. Solo viaja a
// esta ruta.
const COOKIE_DISPOSITIVO = 'retornar_registro';

// Anota este intento (por DNI, dispositivo e IP) y DESPUÉS cuenta, así
// varios pedidos simultáneos no pasan todos el control. Todo antes de saber
// si el DNI existe. Devuelve qué límite se superó (o null) y lo necesario
// para el modo protección (dentro de la transacción del registro) y la cookie.
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
  const contar = (where) => prisma.intentoRegistro.count({ where });
  const [dniN, dispositivoN, ipN] = await Promise.all([
    contar({ tipo: 'dni', clave: claves.dni, createdAt: desde(LIMITES.dni.ventanaMs) }),
    contar({ tipo: 'dispositivo', clave: claves.dispositivo, createdAt: desde(LIMITES.dispositivo.ventanaMs) }),
    contar({ tipo: 'ip', clave: claves.ip, createdAt: desde(LIMITES.ip.ventanaMs) }),
  ]);
  await prisma.intentoRegistro.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENCION_MS) } } }).catch(() => {});
  const superado = limiteSuperado({
    dni: dniN,
    // Sin cookie (un script, o la primera vez) no hay historial del
    // dispositivo: lo frenan los límites por IP y por DNI.
    dispositivo: cookieNueva ? null : dispositivoN,
    ip: ipN,
  });
  return { claves, negocioId, dispositivo, cookieNueva, superado };
}

// Modo protección (lib/limiteRegistro.js), dentro de la transacción del
// registro: el lock por IP y por dispositivo hace que los pedidos simultáneos
// de una misma conexión se evalúen de a uno, y cada uno ve los "DNI ya
// registrado" que anotaron los anteriores (en la misma transacción que los
// detectó). Sin eso, una ráfaga desde una IP pasaba entera con el conteo viejo.
async function frenadoPorProteccion(tx, intento) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registro-ip:${intento.claves.ip}`}))`;
  if (!intento.cookieNueva) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`registro-dispositivo:${intento.claves.dispositivo}`}))`;
  }
  const desde = { gte: new Date(Date.now() - LIMITES.proteccion.ventanaMs) };
  const negocio = await tx.intentoRegistro.count({ where: { tipo: 'rechazo_dni_ip', negocioId: intento.negocioId, createdAt: desde } });
  const ip = await tx.intentoRegistro.count({ where: { tipo: 'rechazo_dni_ip', clave: intento.claves.ip, createdAt: desde } });
  const dispositivo = intento.cookieNueva
    ? 0
    : await tx.intentoRegistro.count({ where: { tipo: 'rechazo_dni_dispositivo', clave: intento.claves.dispositivo, createdAt: desde } });
  return bloqueadoPorProteccion({ negocio, ip, dispositivo });
}

// Una respuesta "DNI ya registrado", para el modo protección.
function anotarRechazoDni(db, intento) {
  return db.intentoRegistro.createMany({
    data: [
      { tipo: 'rechazo_dni_ip', clave: intento.claves.ip, negocioId: intento.negocioId },
      { tipo: 'rechazo_dni_dispositivo', clave: intento.claves.dispositivo, negocioId: intento.negocioId },
    ],
  });
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
    const cuerpo = await request.json();
    const { password, codigoReferido } = cuerpo;

    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'La contraseña es obligatoria.' }, { status: 400 });
    }

    // Mismos datos y reglas que "Nuevo cliente" del panel (lib/datosCliente.js):
    // nombre y apellido, email, fecha de nacimiento, DNI (solo números),
    // celular (país + código de área + número, guardado como +549…) y
    // género opcional.
    const validacion = validarDatosCliente(cuerpo);
    if (validacion.error) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }
    const { nombre, email, fechaNacimiento, dni, telefono, sexo } = validacion.datos;

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
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
        mismoCelular(invitador.telefono, telefono) ||
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
    const resultado = await prisma.$transaction(async (tx) => {
      // Antes de mirar el DNI, para que la respuesta no dependa de si existe.
      if (await frenadoPorProteccion(tx, intento)) return { proteccion: true };

      // Un documento por negocio. El lock serializa los registros
      // simultáneos con el mismo DNI en este negocio; la consulta cubre
      // también las cuentas anteriores al índice único (septiembre a
      // octubre de 2026, que pueden tener el DNI con ceros adelante), y el
      // índice (negocioId, dni) lo garantiza en la base para las nuevas.
      if (await dniYaRegistrado(tx, negocioEncontrado.id, dni)) {
        // Se anota en esta misma transacción (que no crea ninguna cuenta),
        // antes de soltar el lock de la IP.
        await anotarRechazoDni(tx, intento);
        return { dniRepetido: true };
      }

      const nuevoCliente = await tx.cliente.create({
        data: {
          nombre,
          email,
          password: passwordHash,
          negocioId: negocioEncontrado.id,
          puntos: 0,
          fechaNacimiento,
          sexo,
          telefono,
          dni,
          referidoPorId,
          origen: 'registro',
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

    if (resultado.proteccion) {
      return conDispositivo(NextResponse.json({ error: MENSAJES_LIMITE.proteccion }, { status: 429 }), intento);
    }
    if (resultado.dniRepetido) {
      return conDispositivo(NextResponse.json({ error: MENSAJE_DNI_REPETIDO }, { status: 409 }), intento);
    }
    const { nuevoCliente, bienvenida } = resultado;
    // Mail de bienvenida, si el negocio lo activó en Ajustes. Va después de
    // crear la cuenta y nunca la frena: si el mail falla, la cuenta queda
    // igual (se registra en el log). Se manda una sola vez: es el único
    // lugar donde se crea una cuenta por registro.
    if (negocioEncontrado.emailBienvenida) {
      await enviarEmailBienvenida({
        email,
        nombre: nombre.trim(),
        puntos: bienvenida || 0,
        puntosBienvenida: bienvenida || 0,
        negocioNombre: negocioEncontrado.nombre,
        negocioId: negocioEncontrado.id,
      }).catch((error) => console.error('Error al enviar el email de bienvenida', error.message));
    }
    return conDispositivo(NextResponse.json(
      { message: 'Cliente creado con éxito', clienteId: nuevoCliente.id, puntosBienvenida: bienvenida },
      { status: 201 }
    ), intento);
  } catch (error) {
    // Dos registros simultáneos con el mismo email (o, si algo saltara el
    // lock, con el mismo DNI): el segundo choca con el índice único y su
    // transacción (con la bonificación) se deshace entera.
    if (error?.code === 'P2002' && String(error.meta?.target ?? '').includes('dni') && intento) {
      await anotarRechazoDni(prisma, intento).catch(() => {});
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