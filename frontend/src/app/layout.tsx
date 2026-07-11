import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";

// Barlow: la familia tipográfica del ADN de marca (una sola familia en todo el
// producto). Barlow no es variable en Google Fonts → se piden pesos explícitos.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rumbo — Gestión de transporte interprovincial",
  description:
    "SaaS para la gestión de empresas de transporte interprovincial de pasajeros.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${barlow.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
