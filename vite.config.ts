import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { saveApiPlugin } from "./scripts/vite-save-api";

export default defineConfig({
  plugins: [react(), saveApiPlugin(path.resolve(__dirname))],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "assets"),
    },
  },
  server: {
    fs: {
      allow: [".", "assets"],
    },
  },
});
