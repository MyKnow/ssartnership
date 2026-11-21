import type { MetadataRoute } from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_THEME_COLOR_LIGHT,
  SITE_TITLE,
} from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable id keeps installed apps recognized if start_url ever changes.
    id: "/",
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // No orientation lock: tablets and foldables rotate the installed app.
    // The manifest has a single theme color, so it follows the light token;
    // the dark variant comes from the viewport media queries.
    background_color: SITE_THEME_COLOR_LIGHT,
    theme_color: SITE_THEME_COLOR_LIGHT,
    lang: "ko-KR",
    categories: ["lifestyle", "shopping"],
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
  };
}
