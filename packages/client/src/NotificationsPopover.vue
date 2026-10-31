<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@cord/ui/CordIcon.vue";
import { useDemoStore } from "./store";
import { usePreferences } from "./preferences";
const emit = defineEmits<{ openDm: [friendId: string] }>();
const store = useDemoStore();
const { t } = usePreferences();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
async function toggle(): Promise<void> {
  open.value = !open.value;
  if (open.value) {
    await nextTick();
    panel.value?.focus();
  }
}
function close(): void {
  open.value = false;
  trigger.value?.focus();
}
function select(friendId: string): void {
  store.markRead(friendId);
  open.value = false;
  emit("openDm", friendId);
}
function outside(event: PointerEvent): void {
  if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false;
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
</script>
<template>
  <div ref="root" class="notifications" @keydown.esc.stop="close">
    <button
      ref="trigger"
      class="bell-trigger"
      :aria-label="t('notifications')"
      :aria-expanded="open"
      aria-haspopup="dialog"
      aria-controls="notification-panel"
      @click="toggle"
    >
      <Icon name="bell" :size="19" /><span v-if="store.unreadCount" class="notice-count">{{
        store.unreadCount
      }}</span>
    </button>
    <section
      v-if="open"
      id="notification-panel"
      ref="panel"
      class="notification-panel"
      role="dialog"
      :aria-label="t('notificationTitle')"
      tabindex="-1"
    >
      <header>
        <h2>{{ t("notificationTitle") }}</h2>
        <button :aria-label="t('close')" @click="close"><Icon name="close" :size="17" /></button>
      </header>
      <div class="notice-list">
        <button
          v-for="notice in store.notifications"
          :key="notice.id"
          class="notice"
          :class="{ unread: !notice.read }"
          @click="select(notice.friendId)"
        >
          <span class="notice-avatar">{{ notice.friendId.slice(0, 1) }}</span
          ><span
            ><strong
              >{{ notice.friendId }}<small v-if="!notice.read">{{ t("unread") }}</small></strong
            ><span>{{ notice.textKey ? t(notice.textKey) : notice.text }}</span></span
          ><Icon name="chevron" :size="15" />
        </button>
        <p v-if="!store.notifications.length" class="notice-empty">{{ t("emptyNotifications") }}</p>
      </div>
      <footer>
        <button @click="store.notifications.forEach((notice) => (notice.read = true))">
          {{ t("markAllRead") }}</button
        ><button @click="store.simulateIncoming()">
          <Icon name="plus" :size="14" />{{ t("simulateMessage") }}
        </button>
      </footer>
    </section>
  </div>
</template>
<style scoped>
.notifications {
  position: relative;
  flex-shrink: 0;
}
.bell-trigger {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 32px;
  background: none;
  color: var(--muted);
}
.notice-count {
  position: absolute;
  right: -4px;
  top: -2px;
  font: 8px var(--mono);
  background: var(--green);
  color: var(--on-accent);
  border: 2px solid var(--bg);
  border-radius: 8px;
  min-width: 16px;
  padding: 1px 3px;
}
.notification-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 16px);
  z-index: 15;
  width: min(360px, calc(100vw - 100px));
  max-height: min(490px, calc(100dvh - 100px));
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 18px 50px var(--shadow);
  overflow: hidden;
}
.notification-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 17px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.notification-panel h2 {
  font-size: 14px;
  font-weight: 550;
  margin: 0;
}
.notification-panel header button {
  background: none;
  color: var(--muted);
  padding: 3px;
  display: grid;
  place-items: center;
}
.notice-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 5px;
}
.notice {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 13px 9px;
  background: none;
  border-radius: 6px;
  text-align: left;
}
.notice:hover {
  background: var(--hover);
}
.notice.unread {
  background: var(--active);
  box-shadow: inset 3px 0 var(--green);
}
.notice.unread > span > span {
  color: var(--text);
}
.notice + .notice {
  margin-top: 4px;
}
.notice-avatar {
  flex-shrink: 0;
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  background: var(--sage-bg);
  color: var(--sage-text);
  border-radius: 10px;
  font: 13px var(--mono);
}
.notice > span:nth-child(2) {
  flex: 1;
  min-width: 0;
}
.notice strong {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 550;
}
.notice small {
  font: 7px var(--mono);
  color: var(--green);
}
.notice > span > span {
  display: block;
  margin-top: 5px;
  font-size: 10px;
  line-height: 1.7;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.notice > svg {
  flex-shrink: 0;
  color: var(--muted);
}
.notice-empty {
  font-size: 12px;
  padding: 20px;
  color: var(--muted);
}
.notification-panel footer {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  border-top: 1px solid var(--line);
  padding: 12px 15px;
  flex-shrink: 0;
}
.notification-panel footer button {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  padding: 3px 0;
  color: var(--green);
  font-size: 9px;
}
</style>
