export interface NotificationAdapter {
  requestPermission(): Promise<boolean>;
  show(title: string, body: string, resourceId: string): Promise<void>;
}
let native: NotificationAdapter | undefined;
export function configureNotifications(adapter: NotificationAdapter) {
  native = adapter;
}
export async function requestNotifications(): Promise<boolean> {
  if (native) return native.requestPermission();
  return (
    typeof Notification !== "undefined" && (await Notification.requestPermission()) === "granted"
  );
}
export async function notifyMessage(title: string, body: string, resourceId: string) {
  if (native) {
    await native.show(title, body, resourceId);
    return;
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const notification = new Notification(title, { body, tag: resourceId });
  notification.onclick = () => {
    window.focus();
    window.dispatchEvent(new CustomEvent("cord:notification-open", { detail: { resourceId } }));
    notification.close();
  };
}

let pushToken: string | undefined;
export function setPushDevice(token: string) {
  pushToken = token;
  window.dispatchEvent(new Event("cord:push-device"));
}
export const getPushDevice = () => pushToken;

let pendingIntent: { resourceId: string; kind: string } | undefined;
export function setNotificationIntent(resourceId: string, kind = "direct_message") {
  pendingIntent = { resourceId, kind };
  window.dispatchEvent(new Event("cord:notification-intent"));
}
export function consumeNotificationIntent() {
  const value = pendingIntent;
  pendingIntent = undefined;
  return value;
}
