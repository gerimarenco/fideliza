import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';

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

    // Crear el cliente, asociado al negocio encontrado. Si el negocio tiene
    // configurado un bono de bienvenida, se acredita en la misma transacción
    // junto con su MovimientoPuntos (mismo patrón que el resto de los
    // orígenes de puntos) — transacción interactiva porque MovimientoPuntos
    // necesita el id del cliente recién creado.
    const puntosBienvenida = negocioEncontrado.puntosBienvenida || 0;
    const nuevoCliente = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: {
          email,
          password: await hashPassword(password),
          negocioId: negocioEncontrado.id,
          puntos: puntosBienvenida,
        },
      });
      if (puntosBienvenida > 0) {
        await tx.movimientoPuntos.create({
          data: { clienteId: cliente.id, negocioId: negocioEncontrado.id, puntos: puntosBienvenida, origen: 'bienvenida' },
        });
      }
      return cliente;
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