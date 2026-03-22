import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

export const metadata: Metadata = {
  title: "FitCheck",
  description: "AI fashion platform",
  icons: {
    icon: [{ url: "/2.png", type: "image/png" }],
    apple: [{ url: "/2.png", type: "image/png" }],
    shortcut: "/2.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-surface-muted font-sans text-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
