import { defineStore } from "pinia";
import { ref } from "vue";

// UI preview state only. This is not an authenticated session.
export const useSessionStore = defineStore("session", () => {
  const username = ref("");
  function enter(name: string) {
    username.value = name.trim();
  }
  function clear() {
    username.value = "";
  }
  return { username, enter, clear };
});
