import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { branding } from "@/lib/branding";
import { brandCssVariables } from "@/lib/colors";

export const metadata: Metadata = {
  title: `${branding.businessName} — rezervace`,
  description: branding.tagline,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandCssVariables() }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
