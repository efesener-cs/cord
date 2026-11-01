import { defineStore } from "pinia";
import { computed, ref, markRaw } from "vue";
import { createApiClient, createRealtimeClient, ApiError } from "@cord/sdk";
import type { LoginRequest, PublicUser, RegisterRequest } from "@cord/contracts";
import { getApiBaseUrl, getSessionTransport } from "./api";

export const useSessionStore = defineStore("session", () => {
  const user = ref<PublicUser | null>(null);
  const token = ref<string | null>(null);
  const username = computed(() => user.value?.username ?? "");
  const { transport, storage } = getSessionTransport();
  const api = createApiClient({
    baseUrl: getApiBaseUrl(),
    transport,
    getToken: () => token.value,
    onUnauthorized: () => {
      void clear().catch(() => {});
    },
  });
  let restored = false;
  let locallyCleared = false;
  let clearing: Promise<void> | undefined;
  async function restore(): Promise<void> {
    if (restored) return;
    if (transport === "native" && storage) token.value = await storage.read();
    restored = true;
  }
  const authenticated = computed(() => !!user.value);
  function clear(): Promise<void> {
    user.value = null;
    token.value = null;
    restored = true;
    if (locallyCleared) return clearing ?? Promise.resolve();
    locallyCleared = true;
    clearing = Promise.resolve()
      .then(() => storage?.clear())
      .finally(() => {
        clearing = undefined;
      });
    return clearing;
  }
  async function register(input: RegisterRequest): Promise<void> {
    await api.register(input);
  }
  async function login(input: LoginRequest): Promise<void> {
    const response = await api.login(input);
    await clearing;
    locallyCleared = false;
    token.value = response.token ?? null;
    if (transport === "native" && !token.value) throw new ApiError("INTERNAL_ERROR", 500);
    restored = true;
    if (token.value && storage) await storage.write(token.value);
    user.value = response.user;
  }
  async function verify(): Promise<boolean> {
    try {
      await restore();
      if (transport === "native" && !token.value) return false;
      user.value = (await api.me()).user;
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clear().catch(() => undefined);
      return false;
    }
  }
  async function logout(): Promise<void> {
    try {
      await restore();
      await api.logout();
    } finally {
      await clear();
    }
  }
  function realtime(
    options: Omit<Parameters<typeof createRealtimeClient>[0], "baseUrl" | "transport" | "getToken">,
  ) {
    return createRealtimeClient({
      ...options,
      baseUrl: getApiBaseUrl(),
      transport,
      getToken: () => token.value,
    });
  }
  return {
    user,
    username,
    authenticated,
    register,
    login,
    verify,
    logout,
    clear,
    api: markRaw(api),
    realtime,
  };
});
