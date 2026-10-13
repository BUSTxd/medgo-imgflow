import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web 100% estática para GitHub Pages: todo el procesamiento ocurre en el navegador.
  output: "export",
  // En GitHub Pages la web vive en /medgo-imgflow; el workflow define PAGES_BASE_PATH.
  basePath: process.env.PAGES_BASE_PATH || "",
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
