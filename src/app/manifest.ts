import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rezervace prohlídek",
    short_name: "Rezervace",
    description: "Rezervujte si termín prohlídky online.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    // Ikony pro instalaci na počítač (Mac Dock apod.) — s okrajem a squircle,
    // aby vypadaly nativně. iPhone „Přidat na plochu" bere apple-icon.png
    // (viz src/app/apple-icon.png), takže mobilní ikona zůstává beze změny.
    icons: [
      { src: "/icon-mac-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-mac-512.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
