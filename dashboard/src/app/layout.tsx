import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-data",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mumbai Crime Intelligence",
  description: "High-precision forensic intelligence node for Mumbai crime analytics. Built for situational awareness and legal reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased light`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#FDFDFD] text-[#09090B]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
