import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { nombreClub } from '@/lib/nombreClub';

// CORS abierto porque también la consume el widget embebible (public/widget.js)
// desde el dominio de la tienda online del negocio (ver README) — no un
// dominio propio de Retornar, así que hace falta habilitarlo explícitamente.
// No hay problema de seguridad: esta ruta nunca devuelve nada sensible.
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

const SEXO_VALIDO = ['femenino', 'masculino', 'otro'];
// DNI argentino: 7 u 8 dígitos, sin puntos ni espacios.
const DNI_VALIDO = /^\d{7,8}$/;
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
    select: { nombre: true, emoji: true, mensajeRegistro: true, activo: true, puntosXPeso: true, tema: true },
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
  return NextResponse.json(negocioPublico, { headers: CORS_HEADERS });
}

export async function POST(request, { params }) {
  try {
    const { negocio } = await params;
    const { email, password, fechaNacimiento, dni, sexo, telefono } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son obligatorios.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    if (!fechaNacimiento || !dni || !sexo || !telefono) {
      return NextResponse.json(
        { error: 'Fecha de nacimiento, DNI, sexo y celular son obligatorios.' },
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

    if (!DNI_VALIDO.test(dni)) {
      return NextResponse.json(
        { error: 'El DNI tiene que tener 7 u 8 números, sin puntos.' },
        { status: 400 }
      );
    }

    if (!SEXO_VALIDO.includes(sexo)) {
      return NextResponse.json(
        { error: 'Sexo inválido.' },
        { status: 400 }
      );
    }

    // Buscar el negocio por su slug (el que viene en la URL)
    const negocioEncontrado = await prisma.negocio.findUnique({
      where: { slug: negocio },
    });

    if (!negocioEncontrado || !negocioEncontrado.activo) {
      return NextResponse.json(
        { error: 'No encontramos ese negocio.' },
        { status: 404 }
      );
    }

    // Verificar que el email no esté ya registrado
    const clienteExistente = await prisma.cliente.findUnique({
      where: { email },
    });

    if (clienteExistente) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email.' },
        { status: 409 }
      );
    }

    // Crear el cliente, asociado al negocio encontrado
    const nuevoCliente = await prisma.cliente.create({
      data: {
        email,
        password: await hashPassword(password),
        negocioId: negocioEncontrado.id,
        puntos: 0,
        fechaNacimiento: fechaNacimientoDate,
        dni,
        sexo,
        telefono: telefonoLimpio,
      },
    });

    return NextResponse.json(
      { message: 'Cliente creado con éxito', clienteId: nuevoCliente.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error en registro:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al crear la cuenta.' },
      { status: 500 }
    );
  }
}