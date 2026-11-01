import { createApp } from "vue";
import { createPinia } from "pinia";
import { createWebHashHistory } from "vue-router";
import { configureApi, createClientRouter } from "@cord/client";
import "@cord/ui/styles.css";
import Root from "./Root.vue";

declare global {
  interface Window {
    readonly cordDesktop?: Readonly<{
      platform: string;
      session: {
        read(origin: string): Promise<string | null>;
        write(origin: string, token: string, language: string): Promise<void>;
        clear(origin: string): Promise<void>;
      };
    }>;
  }
}

const apiOrigin = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";
const vault = window.cordDesktop?.session;
configureApi(apiOrigin, {
  transport: "native",
  ...(vault
    ? {
        storage: {
          read: () => vault.read(apiOrigin),
          write: (token: string) => vault.write(apiOrigin, token, document.documentElement.lang),
          clear: () => vault.clear(apiOrigin),
        },
      }
    : {}),
});
document.documentElement.dataset.platform = window.cordDesktop?.platform ?? "desktop";
createApp(Root).use(createPinia()).use(createClientRouter(createWebHashHistory())).mount("#app");
