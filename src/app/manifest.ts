import type { MetadataRoute } from "next";

// Lets phones install the site as an app: home screen icon, its own window,
// no browser toolbar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MTVFR Equipment Checks",
    short_name: "MTVFR Checks",
    description: "Weekly and monthly apparatus checks for Mud Tavern Volunteer Fire and Rescue",
    start_url: "/status",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2e5f7f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
