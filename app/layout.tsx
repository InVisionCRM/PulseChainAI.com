import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import GlobalFooter from "@/components/GlobalFooter";
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "PulseChain AI",
  description: "Your comprehensive dashboard for blockchain analytics and AI-powered insights",
  icons: {
    icon: "/LogoVector.svg",
    shortcut: "/LogoVector.svg",
    apple: "/LogoVector.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col bg-black`}
      >
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        <GlobalFooter />
        <Analytics />
      </body>
    </html>
  );
}
