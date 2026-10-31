import { createApp } from "vue";
import { createPinia } from "pinia";
import { createWebHistory } from "vue-router";
import { createClientRouter } from "@cord/client";
import "@cord/ui/styles.css";
import App from "./App.vue";
import cordLogoUrl from "@cord/ui/cord-logo.svg";

const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/svg+xml";
favicon.href = cordLogoUrl;
document.head.append(favicon);

const router = createClientRouter(createWebHistory());

createApp(App).use(createPinia()).use(router).mount("#app");
