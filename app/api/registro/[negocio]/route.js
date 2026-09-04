import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';

// Datos públicos del negocio para la pantalla de auto-registro (nombre real
// y mensaje/promoción propia en vez de mostrar el slug pelado). Nunca
// incluir acá nada sensible: esta ruta no requiere sesión.
export async function GET(request, { params }) {
  const { negocio } = await params;

  const negocioEncontrado = await prisma.negocio.findUnique({
    where: { slug: negocio },
    select: { nombre: true, emoji: true, mensajeRegistro: true, activo: true },
  });

  if (!negocioEncontrado || !negocioEncontrado.activo) {
    return NextResponse.json({ error: 'No encontramos ese negocio.' }, { status: 404 });
  }

  const { activo, ...negocioPublico } = negocioEncontrado;
  return NextResponse.json(negocioPublico);
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