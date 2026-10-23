import { Newsreader, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// Dirección de diseño "Editorial" (elegida por Genaro, ver
// docs/plan-lanzamiento.md D-02): serif para títulos y números grandes,
// sans legible para el resto. Un negocio puede pisar la de títulos con su
// propia tipografía (Negocio.tema.fuenteTitulo).
const fuenteTitulo = Newsreader({
  variable: "--font-titulo",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const fuenteTexto = Hanken_Grotesk({
  variable: "--font-texto",
  subsets: ["latin"],
});

export const metadata = {
  title: "Retornar",
  description: "Plataforma de fidelización de clientes",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${fuenteTitulo.variable} ${fuenteTexto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
