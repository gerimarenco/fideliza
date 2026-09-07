import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';

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
    select: { nombre: true, emoji: true, mensajeRegistro: true, activo: true, puntosXPeso: true, tema: true },
  });

  if (!negocioEncontrado || !negocioEncontrado.activo) {
    return NextResponse.json({ error: 'No encontramos ese negocio.' }, { status: 404, headers: CORS_HEADERS });
  }

  const { activo, tema, ...negocioPublico } = negocioEncontrado;
  negocioPublico.temaPrimario = tema?.primario;
  negocioPublico.temaPrimarioTexto = tema?.primarioTexto;
  return NextResponse.json(negocioPublico, { headers: CORS_HEADERS });
}

export async function POST(request, { params }) {
  try {
    const { negocio } = await params;
    const { email, password } = await request.json();

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

    // Buscar el negocio por su slug (el que viene en la URL)
    const negocioEncontrado = await prisma.negocio.findUnique({
      where: { slug: negocio },
    });

    if (!negocioEncontrado) {
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