import type { Metadata, Viewport } from "next";
import { ScrollTop } from "@/components/ScrollTop";
// Brand fonts (self-hosted): Nunito Sans for titles and headers, Plus Jakarta Sans for body text.
import "@fontsource-variable/nunito-sans";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simpliskool — Simplifying school management",
  description: "School management and portal platform for African schools, by Dream Savvy Solutions.",
  // Installed on a phone's home screen, it opens full screen like an app.
  appleWebApp: { capable: true, title: "Simpliskool", statusBarStyle: "default" },
  applicationName: "Simpliskool",
};

export const viewport: Viewport = {
  themeColor: "#173B70",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ScrollTop />
        {children}
      </body>
    </html>
  );
}
