import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Neo - 2FA Manager",
    short_name: "Neo",
    description: "A modern two-factor authentication manager",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#171717",
    theme_color: "#7c3aed",
    categories: ["security", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Secrets",
        description: "View your 2FA secrets",
        url: "/dashboard",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Backup",
        short_name: "Backup",
        description: "Manage backups",
        url: "/dashboard/backup",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Tools",
        short_name: "Tools",
        description: "Import, export, and test OTPs",
        url: "/dashboard/tools",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    protocol_handlers: [
      {
        protocol: "web+otpauth",
        url: "/dashboard?otpauth=%s",
      },
    ],
  };
}
