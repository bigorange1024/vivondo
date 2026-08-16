import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { saveApiPlugin } from "./scripts/vite-save-api";
import { openLanBrowserPlugin } from "./scripts/vite-open-lan";

export default defineConfig({
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
    open: false, // LAN IP opened by openLanBrowserPlugin instead of localhost
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
});
