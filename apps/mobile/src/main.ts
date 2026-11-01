import { createApp } from "vue";
import { createPinia } from "pinia";
import { createWebHashHistory } from "vue-router";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { App } from "@capacitor/app";
import {
  configureApi,
  createClientRouter,
  configureNotifications,
  configureDownloads,
  configureScreenSharing,
  setPushDevice,
  setNotificationIntent,
} from "@cord/client";
import "@cord/ui/styles.css";
import "./safe-area.css";
import Root from "./Root.vue";

const native = Capacitor.isNativePlatform();
const apiOrigin = native
  ? (import.meta.env.VITE_API_URL ??
    (Capacitor.getPlatform() === "android"
      ? import.meta.env.VITE_ANDROID_API_URL
      : import.meta.env.VITE_IOS_API_URL) ??
    "")
  : "";
if (native && !apiOrigin) throw new Error("Native builds require a reachable VITE_API_URL.");
const storageKey = `cord.session:${apiOrigin}`;
const notificationKey = `cord.notifications:${apiOrigin}`;
let notificationsOptedIn = false;
configureApi(apiOrigin, {
  transport: native ? "native" : "web",
  ...(native
    ? {
        storage: {
          async read() {
            const value = await SecureStorage.get(storageKey, false, false);
            return typeof value === "string" && /^[\w-]{43}$/.test(value) ? value : null;
          },
          async write(token: string) {
            await SecureStorage.set(storageKey, token, false, false);
          },
          async clear() {
            await SecureStorage.remove(storageKey, false);
          },
        },
      }
    : {}),
});
if (native && !window.location.hash) window.location.hash = "/dashboard";
const router = createClientRouter(createWebHashHistory());
document.documentElement.dataset.platform = Capacitor.getPlatform();
createApp(Root).use(createPinia()).use(router).mount("#app");

if (Capacitor.getPlatform() === "android") {
  void App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) router.back();
    else void App.exitApp();
  });
}

if (native) {
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) window.dispatchEvent(new Event("cord:resume"));
  });
}

if (native) {
  configureNotifications({
    async requestPermission() {
      const result = await LocalNotifications.requestPermissions();
      if (result.display === "granted" && Capacitor.getPlatform() === "android")
        await LocalNotifications.createChannel({
          id: "messages",
          name: "Cord messages",
          importance: 4,
        });
      notificationsOptedIn = result.display === "granted";
      await SecureStorage.set(notificationKey, notificationsOptedIn, false, false);
      if (notificationsOptedIn) await registerPush();
      return result.display === "granted";
    },
    async show(title, body, resourceId) {
      if (!notificationsOptedIn) return;
      if (Capacitor.getPlatform() === "android" && import.meta.env.VITE_PUSH_ENABLED === "true")
        return;
      if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
      if (Capacitor.getPlatform() === "android")
        await LocalNotifications.createChannel({
          id: "messages",
          name: "Cord messages",
          importance: 4,
        });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1 + Math.floor(Math.random() * 2_000_000_000),
            title,
            body,
            channelId: "messages",
            extra: { resourceId },
          },
        ],
      });
    },
  });
  void LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
    const resourceId: unknown = notification.extra?.resourceId;
    if (typeof resourceId === "string")
      window.dispatchEvent(new CustomEvent("cord:notification-open", { detail: { resourceId } }));
  });
}

if (native) {
  configureDownloads(async (file, blob) => {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read attachment"));
      reader.onload = () => resolve(String(reader.result).split(",")[1]!);
      reader.readAsDataURL(blob);
    });
    const path = `cord-downloads/${file.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const result = await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({ title: file.name, url: result.uri });
  });
}
if (Capacitor.getPlatform() === "android") {
  const screen = registerPlugin<{
    start(options: { url: string; token: string }): Promise<void>;
    stop(): Promise<void>;
    addListener(
      name: string,
      listener: (event: { active: boolean }) => void,
    ): Promise<{ remove(): Promise<void> }>;
  }>("CordScreenShare");
  configureScreenSharing({
    start: (url, token) => screen.start({ url, token }),
    stop: () => screen.stop(),
    async listen(listener) {
      const handle = await screen.addListener("stateChanged", (event) => listener(event.active));
      return () => {
        void handle.remove();
      };
    },
  });
}

async function registerPush() {
  if (Capacitor.getPlatform() !== "android" || import.meta.env.VITE_PUSH_ENABLED !== "true") return;
  if ((await PushNotifications.requestPermissions()).receive === "granted")
    await PushNotifications.register();
}
if (Capacitor.getPlatform() === "android" && import.meta.env.VITE_PUSH_ENABLED === "true") {
  void PushNotifications.addListener("registration", ({ value }) => setPushDevice(value));
  void PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const resourceId: unknown = notification.data?.resourceId;
    const kind: unknown = notification.data?.kind;
    if (typeof resourceId === "string")
      setNotificationIntent(resourceId, typeof kind === "string" ? kind : "direct_message");
  });
}

if (native) {
  void SecureStorage.get(notificationKey, false, false)
    .then(async (value) => {
      notificationsOptedIn = value === true;
      if (notificationsOptedIn) await registerPush();
    })
    .catch(() => {});
}
