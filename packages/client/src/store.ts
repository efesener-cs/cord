import { defineStore } from "pinia";
import { ref } from "vue";

export const useDemoStore = defineStore("demo", () => {
  const messages = ref<Record<string, string[]>>({});
  const muted = ref(false);
  const deafened = ref(false);
  function send(friendId: string, text: string) {
    const content = text.trim();
    if (!content) return;
    (messages.value[friendId] ??= []).push(content);
  }
  return { messages, muted, deafened, send };
});
