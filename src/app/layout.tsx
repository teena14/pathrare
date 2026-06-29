import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from '@/providers/auth-provider';
import { LanguageProvider } from '@/providers/language-provider';
import I18nController from '@/components/I18nController';

export const metadata: Metadata = {
  title: "PathRare - Navigation for Rare Diseases",
  description: "An AI-powered health intelligence platform for rare diseases.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Noto Sans Arabic for RTL support */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-white text-slate-900 flex flex-col font-sans">
        <LanguageProvider>
          <AuthProvider>
            <I18nController />
            {children}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
