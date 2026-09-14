import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "zCRM",
    short_name: "zCRM",
    description: "Pipeline and follow-up tracking.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d0a18",
    theme_color: "#6d45d9",
    icons: [
      { src: "/icons/zcrm-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/zcrm-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/zcrm-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
