import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
