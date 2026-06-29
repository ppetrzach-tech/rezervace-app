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
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
