<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@cord/ui/CordIcon.vue";
import { useCommunication, resourceError } from "./communication";
import { usePreferences, type TranslationKey } from "./preferences";
const emit = defineEmits<{ open: [resourceId: string, kind: string] }>();
const communication = useCommunication();
const { t } = usePreferences();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);
const busy = ref(false);
const error = ref<TranslationKey | null>(null);
async function toggle() {
  open.value = !open.value;
  if (open.value) {
    error.value = null;
    await nextTick();
    root.value?.querySelector<HTMLElement>("[data-popover] button")?.focus();
  }
}
function close() {
  open.value = false;
  button.value?.focus();
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false;
}
async function read() {
  busy.value = true;
  error.value = null;
  try {
    await communication.readNotifications();
  } catch (value) {
    error.value = resourceError(value);
  } finally {
    busy.value = false;
  }
}
async function more() {
  busy.value = true;
  error.value = null;
  try {
    await communication.moreNotifications();
  } catch (value) {
    error.value = resourceError(value);
  } finally {
    busy.value = false;
  }
}
function select(id: string, kind: string) {
  open.value = false;
  emit("open", id, kind);
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
</script>
<template>
  <div ref="root" class="notifications" @keydown.esc.stop="close">
    <button
      ref="button"
      class="bell"
      :aria-label="t('notifications')"
      :aria-expanded="open"
      aria-controls="notification-popover"
      @click="toggle"
    >
      <Icon name="bell" :size="19" /><span
        v-if="communication.unreadCount"
        class="notification-count"
        >{{ communication.unreadCount > 99 ? "99+" : communication.unreadCount }}</span
      >
    </button>
    <section
      v-if="open"
      id="notification-popover"
      data-popover
      class="notification-popover"
      :aria-label="t('notificationHeading')"
    >
      <header>
        <strong>{{ t("notificationHeading") }}</strong
        ><button :aria-label="t('close')" @click="close"><Icon name="close" :size="17" /></button>
      </header>
      <button class="read-all" :disabled="busy || !communication.unreadCount" @click="read">
        {{ t("notificationsRead") }}
      </button>
      <div class="notice-list">
        <button
          v-for="notice in communication.notifications"
          :key="notice.id"
          class="notice"
          :class="{ unread: !notice.read }"
          :aria-label="t('notificationOpen')"
          @click="select(notice.resourceId, notice.kind)"
        >
          <span>{{
            t(
              notice.kind === "friend_request"
                ? "notificationFriendRequest"
                : notice.kind === "friend_accepted"
                  ? "notificationFriendAccepted"
                  : "notificationMessage",
              { name: notice.actorName },
            )
          }}</span
          ><small v-if="!notice.read">{{ t("unread") }}</small>
        </button>
        <p v-if="!communication.notifications.length">{{ t("noNotificationsReal") }}</p>
        <button
          v-if="communication.notificationCursor"
          class="read-all"
          :disabled="busy"
          @click="more"
        >
          {{ t(busy ? "loading" : "more") }}
        </button>
      </div>
      <p v-if="error" role="alert">{{ t(error) }}</p>
    </section>
  </div>
</template>
<style scoped>
.notifications {
  position: relative;
}
.bell {
  position: relative;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: none;
  color: var(--muted);
}
.notification-count {
  position: absolute;
  top: -8px;
  right: -9px;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 2px solid var(--bg);
  background: var(--green);
  color: var(--bg);
  font: 600 11px var(--mono);
}
.notification-popover {
  position: absolute;
  right: -8px;
  top: 42px;
  z-index: 15;
  width: min(340px, calc(100vw - 85px));
  max-height: min(450px, calc(100dvh - 110px));
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 9px;
  box-shadow: 0 15px 40px var(--shadow);
  padding: 14px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  font-size: 13px;
}
header button {
  background: none;
  color: var(--muted);
}
.read-all {
  background: none;
  color: var(--green);
  font-size: 11px;
  padding: 7px 0;
  text-align: left;
}
.notice-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.notice {
  width: 100%;
  display: grid;
  gap: 7px;
  padding: 13px 10px;
  margin: 5px 0;
  border-radius: 5px;
  text-align: left;
  font-size: 12px;
  line-height: 1.7;
  background: var(--surface);
  color: var(--text);
}
.notice.unread {
  background: var(--active);
  box-shadow: inset 3px 0 var(--green);
}
.notice small {
  color: var(--green);
  font: 9px var(--mono);
}
p {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.7;
}
button:disabled {
  opacity: 0.5;
}
</style>
