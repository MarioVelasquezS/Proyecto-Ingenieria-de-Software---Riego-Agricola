import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Riego Agrícola | Gestión de Usuarios",
  description:
    "Sistema de gestión para Proyecto de Riego Agrícola con Next.js, SQLite y migraciones Prisma.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}

