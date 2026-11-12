import type { Metadata, Viewport } from "next";
import { Montserrat, Quicksand } from "next/font/google";
import "./globals.css";

// Títulos y subtítulos: Quicksand. Resto del texto: Montserrat. Ambas de Google Fonts.
const quicksand = Quicksand({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-titulo" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-texto" });

export const metadata: Metadata = {
  title: "Asistente IA de Planta",
  description: "Plataforma para que el personal de planta y oficina use la IA con tareas y skills simples.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#22343c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${quicksand.variable} ${montserrat.variable}`}>
      <body>
        {/* Fotografía de paisaje fija detrás de los paneles de vidrio (public/fondo.webp) */}
        <div className="fondo" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
