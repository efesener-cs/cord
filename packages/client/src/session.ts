import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { createApiClient, ApiError } from "@cord/sdk";
import type { LoginRequest, PublicUser, RegisterRequest } from "@cord/contracts";
import { getApiBaseUrl } from "./api";

export const useSessionStore = defineStore("session", () => {
  const user = ref<PublicUser | null>(null);
  const token = ref<string | null>(null);
  const username = computed(() => user.value?.username ?? "");
  const api = createApiClient({ baseUrl: getApiBaseUrl(), getToken: () => token.value });
  const authenticated = computed(() => !!user.value && !!token.value);
  function clear(): void {
    user.value = null;
    token.value = null;
  }
  async function register(input: RegisterRequest): Promise<void> {
    await api.register(input);
  }
  async function login(input: LoginRequest): Promise<void> {
    const response = await api.login(input);
    token.value = response.token;
    user.value = response.user;
  }
  async function verify(): Promise<boolean> {
    if (!token.value) return false;
    try {
      user.value = (await api.me()).user;
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clear();
      return false;
    }
  }
  async function logout(): Promise<void> {
    try {
      if (token.value) await api.logout();
    } finally {
      clear();
    }
  }
  return { user, username, authenticated, register, login, verify, logout, clear };
});
