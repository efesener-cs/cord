import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL("../../", import.meta.url));
  const env = loadEnv(mode, envDir, "VITE_");
  const apiOrigin = env.VITE_API_URL ?? env.VITE_DESKTOP_API_URL ?? "http://127.0.0.1:3001";
  const address = new URL(apiOrigin);
  if (!["http:", "https:"].includes(address.protocol) || apiOrigin !== address.origin)
    throw new Error("VITE_API_URL must be an HTTP(S) origin without a trailing slash.");
  const socketOrigin = new URL(apiOrigin);
  socketOrigin.protocol = address.protocol === "https:" ? "wss:" : "ws:";
  const mediaOrigin = new URL(env.VITE_MEDIA_URL ?? "ws://localhost:7880");
  if (
    !["ws:", "wss:"].includes(mediaOrigin.protocol) ||
    mediaOrigin.username ||
    mediaOrigin.password
  )
    throw new Error("VITE_MEDIA_URL must be a ws/wss media origin.");
  return {
    envDir,
    base: "./",
    plugins: [
      vue(),
      {
        name: "cord-api-csp",
        transformIndexHtml: (html: string) =>
          html.replace(
            "__CORD_CONNECT_ORIGINS__",
            `${address.origin} ${socketOrigin.origin} ${mediaOrigin.origin}`,
          ),
      },
    ],
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(address.origin) },
    test: { environment: "node", include: ["test/**/*.test.ts"] },
    build: { outDir: "dist/renderer", emptyOutDir: true },
  };
});
