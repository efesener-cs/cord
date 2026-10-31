import { createApp } from "vue";
import { createPinia } from "pinia";
import { createWebHashHistory } from "vue-router";
import { configureApi, createClientRouter } from "@cord/client";
import "@cord/ui/styles.css";
import Root from "./Root.vue";

declare global {
  interface Window {
    readonly cordDesktop?: Readonly<{ platform: string }>;
  }
}

configureApi(import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001");
document.documentElement.dataset.platform = window.cordDesktop?.platform ?? "desktop";
createApp(Root).use(createPinia()).use(createClientRouter(createWebHashHistory())).mount("#app");
