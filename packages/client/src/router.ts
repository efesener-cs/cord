import { createRouter, type RouterHistory } from "vue-router";
import { useSessionStore } from "./session";
import { usePreferences, type TranslationKey } from "./preferences";

export function createClientRouter(history: RouterHistory) {
  const router = createRouter({
    history,
    routes: [
      {
        path: "/",
        name: "landing",
        component: () => import("./LandingScreen.vue"),
        meta: { title: "landingTitle" },
      },
      {
        path: "/login",
        name: "login",
        component: () => import("./AuthScreen.vue"),
        props: { mode: "login" },
        meta: { title: "login" },
      },
      {
        path: "/register",
        name: "register",
        component: () => import("./AuthScreen.vue"),
        props: { mode: "register" },
        meta: { title: "register" },
      },
      {
        path: "/dashboard",
        name: "dashboard",
        component: () => import("./DashboardScreen.vue"),
        meta: { title: "dashboardTitle" },
      },
      { path: "/:pathMatch(.*)*", redirect: "/" },
    ],
    scrollBehavior: () => ({ top: 0 }),
  });
  router.beforeEach(async (to) => {
    if (to.name !== "dashboard") return true;
    const session = useSessionStore();
    if (await session.verify()) return true;
    return { name: "login" };
  });
  router.afterEach((to) => {
    usePreferences().page = to.meta.title as TranslationKey;
  });
  return router;
}
