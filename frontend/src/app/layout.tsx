import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Viddr",
  description: "Viddr - Email Automation SaaS",
  keywords: ["email", "automation", "saas", "viddr", "bulk email"],
};

import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="antialiased flex flex-col min-h-screen">
        <main className="flex-grow flex flex-col">
          {children}
        </main>
        
        <footer className="w-full py-8 mt-auto" style={{ borderTop: '1px solid rgba(0,0,0,0.1)', backgroundColor: 'transparent' }}>
          <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <div>
              &copy; 2026 Viddr by <a href="https://ismailabbasi.qzz.io/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Ismail Abbasi</a>
            </div>
            <div className="flex flex-wrap gap-4">
              <a href="https://linkedin.com/in/ismailabbasi" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">LinkedIn</a>
              <a href="https://github.com/ismailofficialGithub" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">GitHub</a>
              <a href="https://noctisai.ismailabbasi.qzz.io" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">NoctisAI</a>
              <a href="https://call.ismailabbasi.qzz.io" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">Call</a>
              <a href="https://viddr.ismailabbasi.qzz.io" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">Viddr Web</a>
            </div>
          </div>
        </footer>

        <Toaster position="bottom-right" containerStyle={{ zIndex: 999999 }} />
      </body>
    </html>
  );
}
