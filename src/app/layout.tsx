import type { Metadata } from "next";
// Brand fonts (self-hosted): Nunito Sans for titles and headers, Plus Jakarta Sans for body text.
import "@fontsource-variable/nunito-sans";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simpliskool — Simplifying school management",
  description: "School management and portal platform for African schools, by Dream Savvy Solutions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
