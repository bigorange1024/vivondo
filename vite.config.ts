import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { saveApiPlugin } from "./scripts/vite-save-api";
import { openLanBrowserPlugin } from "./scripts/vite-open-lan";

export default defineConfig({
  // Relative paths so the itch.io / ZIP build works without a fixed domain.
  base: "./",
  plugins: [
    react(),
    saveApiPlugin(path.resolve(__dirname)),
    openLanBrowserPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "assets"),
    },
  },
  server: {
    host: true,
    open: false,
    port: 5173,
    strictPort: false,
    fs: {
      allow: [".", "assets"],
    },
  },
  preview: {
    host: true,
    open: false,
    port: 4173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
