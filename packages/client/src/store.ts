import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { friends } from "./demo";
import type { TranslationKey } from "./preferences";

export interface LocalAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}
export interface LocalMessage {
  id: string;
  author: string;
  kind: "self" | "received" | "echo";
  text: string;
  textKey?: TranslationKey;
  attachments: LocalAttachment[];
  createdAt: number;
}
export interface LocalNotice {
  id: string;
  friendId: string;
  text: string;
  textKey?: TranslationKey;
  read: boolean;
}

export const useDemoStore = defineStore("demo", () => {
  const messages = ref<Record<string, LocalMessage[]>>({});
  const muted = ref(false);
  const deafened = ref(false);
  const notifications = ref<LocalNotice[]>([
    { id: "welcome-deniz", friendId: "deniz", text: "", textKey: "sampleDeniz", read: false },
    { id: "welcome-nova", friendId: "nova", text: "", textKey: "sampleNova", read: false },
    { id: "welcome-ada", friendId: "ada", text: "", textKey: "sampleAda", read: false },
  ]);
  const unreadCount = computed(() => notifications.value.filter((notice) => !notice.read).length);

  function ensureThread(threadId: string): void {
    if (messages.value[threadId]) return;
    const friend = friends.find((person) => threadId === `dm:${person.id}`);
    messages.value[threadId] = [
      {
        id: `seed:${threadId}`,
        author: friend?.name ?? "cord.local",
        kind: "received",
        text: "",
        textKey:
          friend?.id === "nova"
            ? "sampleNova"
            : friend?.id === "ada"
              ? "sampleAda"
              : friend
                ? "sampleDeniz"
                : "sampleRoom",
        attachments: [],
        createdAt: Date.now(),
      },
    ];
  }
  function markRead(friendId: string): void {
    for (const notice of notifications.value) if (notice.friendId === friendId) notice.read = true;
  }
  function receive(friendId: string, text = "", textKey?: TranslationKey): void {
    const threadId = `dm:${friendId}`;
    ensureThread(threadId);
    const id = crypto.randomUUID();
    const translated = textKey ? { textKey } : {};
    messages.value[threadId]!.push({
      id,
      author: friendId,
      kind: "received",
      text,
      ...translated,
      attachments: [],
      createdAt: Date.now(),
    });
    notifications.value.unshift({ id, friendId, text, ...translated, read: false });
  }
  function send(
    threadId: string,
    text: string,
    attachments: LocalAttachment[],
    author: string,
  ): boolean {
    const content = text.trim();
    if (!content && !attachments.length) return false;
    ensureThread(threadId);
    messages.value[threadId]!.push({
      id: crypto.randomUUID(),
      author,
      kind: "self",
      text: content,
      attachments: [...attachments],
      createdAt: Date.now(),
    });
    const reflected = content || attachments.map((file) => file.name).join(", ");
    // Local reflection makes the conversation flow testable without a network.
    messages.value[threadId]!.push({
      id: crypto.randomUUID(),
      author: "cord.echo",
      kind: "echo",
      text: reflected,
      attachments: [],
      createdAt: Date.now(),
    });
    return true;
  }
  function simulateIncoming(): void {
    receive("nova", "", "sampleIncoming");
  }
  function reset(): void {
    const urls = new Set(
      Object.values(messages.value).flatMap((thread) =>
        thread.flatMap((message) => message.attachments.map((file) => file.url)),
      ),
    );
    for (const url of urls) URL.revokeObjectURL(url);
    messages.value = {};
    muted.value = false;
    deafened.value = false;
    notifications.value = [];
  }
  return {
    messages,
    muted,
    deafened,
    notifications,
    unreadCount,
    ensureThread,
    markRead,
    receive,
    send,
    simulateIncoming,
    reset,
  };
});
