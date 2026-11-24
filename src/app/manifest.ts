import type { MetadataRoute } from "next";

/** Lets phones install Simpliskool as an app: own icon, full screen, opens on the person's home page. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Simpliskool",
    short_name: "Simpliskool",
    description: "Your school's portal: registers, scores, homework, results, fees and notices.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F8FC",
    theme_color: "#173B70",
    categories: ["education"],
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
