import { createApp } from "vue";
import { createPinia } from "pinia";
import { createWebHashHistory } from "vue-router";
import { createClientRouter } from "@cord/client";
import "@cord/ui/styles.css";
import Root from "./Root.vue";

declare global {
  interface Window {
    readonly cordDesktop?: Readonly<{ platform: string }>;
  }
}

document.documentElement.dataset.platform = window.cordDesktop?.platform ?? "desktop";
createApp(Root).use(createPinia()).use(createClientRouter(createWebHashHistory())).mount("#app");
