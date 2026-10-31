import { defineConfig, loadEnv } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiOrigin = env.VITE_API_URL ?? "http://127.0.0.1:3001";
  const address = new URL(apiOrigin);
  if (!["http:", "https:"].includes(address.protocol) || apiOrigin !== address.origin)
    throw new Error("VITE_API_URL must be an HTTP(S) origin without a trailing slash.");
  return {
    base: "./",
    plugins: [
      vue(),
      {
        name: "cord-api-csp",
        transformIndexHtml: (html: string) => html.replace("__CORD_API_ORIGIN__", address.origin),
      },
    ],
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(address.origin) },
    build: { outDir: "dist/renderer", emptyOutDir: true },
  };
});
