import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { brandCssVariables } from "@/lib/colors";

export const metadata: Metadata = {
  title: "Rezervační systém",
  description: "Vlastní rezervační stránka pro váš byznys za 5 minut.",
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
