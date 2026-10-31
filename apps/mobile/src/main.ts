import { createApp } from "vue";
import { createPinia } from "pinia";
import { createWebHashHistory } from "vue-router";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { createClientRouter } from "@cord/client";
import "@cord/ui/styles.css";
import "./safe-area.css";
import Root from "./Root.vue";

const router = createClientRouter(createWebHashHistory());
document.documentElement.dataset.platform = Capacitor.getPlatform();
createApp(Root).use(createPinia()).use(router).mount("#app");

if (Capacitor.getPlatform() === "android") {
  void App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) router.back();
    else void App.exitApp();
  });
}
