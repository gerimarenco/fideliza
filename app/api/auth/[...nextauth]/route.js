import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (credentials.email === 'cecilia@fideliza.com' && credentials.password === 'admin123') {
          return { id: 'admin', name: 'Cecilia', email: 'cecilia@fideliza.com', role: 'admin' }
        }

        const negocio = await prisma.negocio.findFirst({
          where: { email: credentials.email }
        })

        if (negocio && credentials.password === negocio.password) {
          return { id: negocio.id, name: negocio.nombre, email: credentials.email, role: 'negocio' }
        }

        const cliente = await prisma.cliente.findFirst({
          where: { email: credentials.email }
        })

        if (cliente && credentials.password === cliente.password) {
          return { id: cliente.id, name: cliente.nombre, email: credentials.email, role: 'cliente' }
        }

        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = user.role; token.id = user.id }
      return token
    },
    async session({ session, token }) {
      session.user.role = token.role
      session.user.id = token.id
      return session
    }
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET
})

export { handler as GET, handler as POST }