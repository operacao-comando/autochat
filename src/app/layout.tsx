import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SCRIPT_TEMA } from "./painel/tema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Autochat",
  description: "Responde comentarios do Instagram com DM automatica.",
  manifest: "/manifest.webmanifest",
  // Faz o atalho abrir em tela cheia no iPhone, sem barra do navegador.
  appleWebApp: { capable: true, title: "Autochat", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewportFit cobre o recorte da tela (notch) sem cortar conteudo.
  viewportFit: "cover",
  themeColor: "#0a1400",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica o tema salvo antes da primeira pintura, senao a tela
            pisca branca antes de escurecer. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
