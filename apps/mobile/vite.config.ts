import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    proxy: { "/api": { target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3001" } },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
