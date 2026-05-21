import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mcees — Sync Dashboard",
  description: "E-Commerce & ERP Sync Engine — Administrative Console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-slate-800 antialiased">{children}</body>
    </html>
  );
}
