import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { nombreClub } from '@/lib/nombreClub';
import { normalizarEmail, filtroEmail, emailValido } from '@/lib/identidad';
import { puntosBienvenida, acreditarBienvenida } from '@/lib/bienvenida';

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

export async function POST(request, { params }) {
  try {
    const { negocio } = await params;
    // El DNI ya no se pide (decisión de Genaro, 2026-10-24: no se usaba para
    // nada y es un dato personal más para cuidar). Si un formulario viejo
    // todavía lo manda, se ignora: no se guarda.
    const { nombre, email: emailIngresado, password, fechaNacimiento, sexo, telefono, codigoReferido } = await request.json();
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

    if (clienteExistente) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email.' },
        { status: 409 }
      );
    }

    // Código de invitación de otra clienta (ver "Referí a una amiga" en el
    // panel del cliente, lib/referidos.js) — opcional, y si no matchea a
    // nadie de este mismo negocio se ignora en silencio: un código viejo,
    // mal tipeado, o de otro negocio no tiene por qué frenar el registro.
    let referidoPorId = null;
    if (codigoReferido) {
      const invitador = await prisma.cliente.findFirst({
        where: { codigoReferido: codigoReferido.trim().toUpperCase(), negocioId: negocioEncontrado.id },
        select: { id: true },
      });
      referidoPorId = invitador?.id || null;
    }

    // Crear el cliente, asociado al negocio encontrado. Si el negocio tiene
    // una bonificación de bienvenida vigente (ver lib/bienvenida.js), se
    // acredita en la misma transacción: o se crean la cuenta y sus puntos de
    // regalo juntos, o nada.
    const puntosRegalo = puntosBienvenida(negocioEncontrado, new Date());
    const passwordHash = await hashPassword(password);
    const { nuevoCliente, bienvenida } = await prisma.$transaction(async (tx) => {
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
          referidoPorId,
        },
      });
      // Si no corresponde (por ejemplo, el celular ya está en otra cuenta),
      // la cuenta se crea igual, sin los puntos, y el motivo queda guardado
      // en la cuenta. La respuesta no lo dice: revelaría que ese celular
      // tiene otra cuenta.
      const { puntos: bienvenida } = await acreditarBienvenida(tx, nuevoCliente, negocioEncontrado, puntosRegalo);
      return { nuevoCliente, bienvenida };
    });

    return NextResponse.json(
      { message: 'Cliente creado con éxito', clienteId: nuevoCliente.id, puntosBienvenida: bienvenida },
      { status: 201 }
    );
  } catch (error) {
    // Dos registros simultáneos con el mismo email: el segundo choca con el
    // índice único (y su transacción, con la bonificación, se deshace).
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email.' },
        { status: 409 }
      );
    }
    console.error('Error en registro:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al crear la cuenta.' },
      { status: 500 }
    );
  }
}