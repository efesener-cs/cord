import { notifyMessage, getPushDevice } from "./notifications";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { ApiError } from "@cord/sdk";
import type {
  PublicServer,
  PublicChannel,
  PublicFriend,
  PublicConversation,
  PublicNotification,
  PublicMessage,
  PublicUser,
  MessageTarget,
  SendMessageRequest,
} from "@cord/contracts";
import { useSessionStore } from "./session";
import { usePreferences, type TranslationKey } from "./preferences";

export const targetKey = (target: MessageTarget) => `${target.kind}:${target.id}`;
export function resourceError(error: unknown): TranslationKey {
  if (!(error instanceof ApiError)) return "resourceFailure";
  if (error.status === 401) return "sessionExpired";
  if (error.code === "NETWORK_ERROR") return "authNetwork";
  if (error.code === "CHANNEL_EXISTS") return "channelDuplicate";
  if (error.code === "CONFLICT") return "resourceConflict";
  if (error.code === "MEDIA_UNAVAILABLE") return "mediaUnavailable";
  if (error.status === 403) return "resourceForbidden";
  if (error.status === 404) return "resourceMissing";
  if (error.status === 413) return "attachmentLimit";
  if (error.status === 429) return "authRateLimit";
  if (error.status === 400) return "resourceValidation";
  return "resourceFailure";
}
export const useCommunication = defineStore("communication", () => {
  const session = useSessionStore();
  const preferences = usePreferences();
  const servers = ref<PublicServer[]>([]);
  const channels = ref<Record<string, PublicChannel[]>>({});
  const friends = ref<PublicFriend[]>([]);
  const conversations = ref<PublicConversation[]>([]);
  const notifications = ref<PublicNotification[]>([]);
  const notificationCursor = ref<string | null>(null);
  const unreadCount = ref(0);
  const onlineIds = ref<string[]>([]);
  const messages = ref<Record<string, PublicMessage[]>>({});
  const historyCursor = ref<Record<string, string | null>>({});
  const historyLoading = ref<Record<string, boolean>>({});
  const historyErrors = ref<Record<string, TranslationKey | null>>({});
  const typing = ref<Record<string, { user: PublicUser; until: number }[]>>({});
  const status = ref<"connecting" | "connected" | "offline">("offline");
  const loading = ref(false);
  const error = ref<TranslationKey | null>(null);
  const activeTarget = ref<MessageTarget | null>(null);
  let generation = 0;
  let client: ReturnType<typeof session.realtime> | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let preferenceTimer: ReturnType<typeof setTimeout> | undefined;
  let applyingPreferences = false;
  let preferencesReady = false;
  let refreshAgain = false;
  const acceptedFriends = computed(() => friends.value.filter((friend) => friend.accepted));
  const incomingFriends = computed(() =>
    friends.value.filter((friend) => !friend.accepted && friend.incoming),
  );
  const onlineCount = computed(
    () => acceptedFriends.value.filter((friend) => onlineIds.value.includes(friend.user.id)).length,
  );
  function mergeMessages(target: MessageTarget, rows: PublicMessage[]) {
    const key = targetKey(target);
    const map = new Map((messages.value[key] ?? []).map((row) => [row.id, row]));
    rows.forEach((row) => map.set(row.id, row));
    messages.value[key] = [...map.values()].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  }
  async function handle(errorValue: unknown) {
    if (errorValue instanceof ApiError && errorValue.status === 401)
      await session.clear().catch(() => {});
    return resourceError(errorValue);
  }
  async function collect<T>(
    load: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
  ): Promise<T[]> {
    const rows: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await load(cursor);
      rows.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return rows;
  }
  async function loadChannels(serverId: string) {
    const current = generation;
    const rows = await collect(async (cursor) => {
      const page = await session.api.listChannels(serverId, {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      return { items: page.channels, nextCursor: page.nextCursor };
    });
    if (current === generation) channels.value[serverId] = rows;
    return rows;
  }
  async function loadHistory(target: MessageTarget, older = false) {
    const key = targetKey(target);
    if (historyLoading.value[key]) return;
    const current = generation;
    historyLoading.value[key] = true;
    historyErrors.value[key] = null;
    try {
      const cursor = older ? historyCursor.value[key] : undefined;
      if (older && !cursor) return;
      const previousNewest = messages.value[key]?.at(-1)?.id;
      let page = await session.api.listMessages(target, {
        limit: 50,
        ...(cursor ? { cursor } : {}),
      });
      if (current !== generation) return;
      const firstCursor = page.nextCursor;
      const collected = [...page.messages];
      // Recover every missed page after reconnect, even if more than fifty messages arrived.
      while (
        !older &&
        previousNewest &&
        page.nextCursor &&
        !page.messages.some((message) => message.id === previousNewest)
      ) {
        page = await session.api.listMessages(target, { limit: 100, cursor: page.nextCursor });
        if (current !== generation) return;
        collected.push(...page.messages);
      }
      mergeMessages(target, collected);
      if (older || !(key in historyCursor.value)) historyCursor.value[key] = firstCursor;
    } catch (value) {
      if (current === generation) historyErrors.value[key] = await handle(value);
    } finally {
      if (current === generation) historyLoading.value[key] = false;
    }
  }
  async function refresh() {
    if (!session.user) return;
    if (loading.value) {
      refreshAgain = true;
      return;
    }
    const current = generation;
    loading.value = true;
    error.value = null;
    try {
      const [serverRows, friendRows, conversationRows, notices] = await Promise.all([
        collect(async (cursor) => {
          const page = await session.api.listServers({ limit: 100, ...(cursor ? { cursor } : {}) });
          return { items: page.servers, nextCursor: page.nextCursor };
        }),
        session.api.listFriends(),
        collect(async (cursor) => {
          const page = await session.api.listConversations({
            limit: 100,
            ...(cursor ? { cursor } : {}),
          });
          return { items: page.conversations, nextCursor: page.nextCursor };
        }),
        session.api.listNotifications({ limit: 50 }),
      ]);
      if (current !== generation) return;
      servers.value = serverRows;
      friends.value = friendRows.friends;
      conversations.value = conversationRows;
      notifications.value = notices.notifications;
      unreadCount.value = notices.unreadCount;
      notificationCursor.value = notices.nextCursor;
      const joined = new Set(serverRows.map((server) => server.id));
      for (const id of Object.keys(channels.value))
        if (!joined.has(id)) {
          for (const channel of channels.value[id] ?? [])
            delete messages.value[targetKey({ kind: "channel", id: channel.id })];
          delete channels.value[id];
        }
      if (activeTarget.value) await loadHistory(activeTarget.value);
    } catch (value) {
      if (current === generation) error.value = await handle(value);
    } finally {
      if (current === generation) {
        loading.value = false;
        if (refreshAgain) {
          refreshAgain = false;
          scheduleRefresh();
        }
      }
    }
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void refresh();
    }, 150);
  }
  async function moreNotifications() {
    const cursor = notificationCursor.value;
    const current = generation;
    if (!cursor) return;
    const page = await session.api.listNotifications({ cursor });
    if (current !== generation) return;
    const seen = new Set(notifications.value.map((notice) => notice.id));
    notifications.value.push(...page.notifications.filter((notice) => !seen.has(notice.id)));
    notificationCursor.value = page.nextCursor;
    unreadCount.value = page.unreadCount;
  }
  async function readNotifications(resourceId?: string) {
    await session.api.readNotifications(resourceId);
    for (const notice of notifications.value)
      if (!resourceId || notice.resourceId === resourceId) notice.read = true;
    scheduleRefresh();
  }
  async function registerPushDevice() {
    const token = getPushDevice();
    if (token && session.user) await session.api.registerDevice(token).catch(() => {});
  }
  async function start() {
    const current = generation;
    await refresh();
    if (current !== generation || !session.user) return;
    try {
      const result = await session.api.getPreferences();
      if (current !== generation) return;
      applyingPreferences = true;
      preferences.locale = result.preferences.locale;
      preferences.theme = result.preferences.theme;
      applyingPreferences = false;
      preferencesReady = true;
    } catch {
      preferencesReady = true;
    }
    if (current !== generation) return;
    client?.disconnect();
    client = session.realtime({
      onMessage(message) {
        const target: MessageTarget = message.channelId
          ? { kind: "channel", id: message.channelId }
          : { kind: "conversation", id: message.conversationId! };
        const unseen = !(messages.value[targetKey(target)] ?? []).some(
          (row) => row.id === message.id,
        );
        mergeMessages(target, [message]);
        if (
          unseen &&
          target.kind === "conversation" &&
          message.author.id !== session.user?.id &&
          (document.hidden || !document.hasFocus())
        ) {
          void notifyMessage(
            "Cord",
            preferences.t("notificationMessage", { name: message.author.username }),
            target.id,
          ).catch(() => {});
        }
        if (target.kind === "conversation" && activeTarget.value?.id === target.id)
          void readNotifications(target.id).catch(() => {});
      },
      onChanged: scheduleRefresh,
      onPresence: (ids) => {
        onlineIds.value = ids;
      },
      onTyping(payload) {
        const key = targetKey(payload.target);
        typing.value[key] = (typing.value[key] ?? []).filter(
          (row) => row.user.id !== payload.user.id,
        );
        if (payload.active)
          typing.value[key]!.push({ user: payload.user, until: Date.now() + 4000 });
      },
      onStatus: (value) => {
        status.value = value;
      },
    });
    client.connect();
    await registerPushDevice();
  }
  function reset() {
    generation++;
    client?.disconnect();
    client = undefined;
    clearTimeout(refreshTimer);
    clearTimeout(preferenceTimer);
    servers.value = [];
    channels.value = {};
    friends.value = [];
    conversations.value = [];
    notifications.value = [];
    unreadCount.value = 0;
    messages.value = {};
    historyCursor.value = {};
    historyLoading.value = {};
    historyErrors.value = {};
    typing.value = {};
    activeTarget.value = null;
    onlineIds.value = [];
    status.value = "offline";
    loading.value = false;
    preferencesReady = false;
    refreshAgain = false;
    error.value = null;
  }
  watch(
    () => session.user?.id,
    () => reset(),
    { flush: "sync" },
  );
  watch(
    () => [preferences.locale, preferences.theme] as const,
    () => {
      if (!preferencesReady || applyingPreferences || !session.user) return;
      const current = generation;
      clearTimeout(preferenceTimer);
      preferenceTimer = setTimeout(() => {
        void session.api
          .savePreferences({ locale: preferences.locale, theme: preferences.theme })
          .catch(async (value) => {
            if (current === generation) error.value = await handle(value);
          });
      }, 350);
    },
    { flush: "sync" },
  );
  async function send(target: MessageTarget, input: SendMessageRequest) {
    const current = generation;
    const result = await session.api.sendMessage(target, input);
    if (current === generation) mergeMessages(target, [result.message]);
  }
  return {
    servers,
    channels,
    friends,
    acceptedFriends,
    incomingFriends,
    conversations,
    notifications,
    notificationCursor,
    unreadCount,
    onlineIds,
    onlineCount,
    messages,
    historyCursor,
    historyLoading,
    historyErrors,
    typing,
    status,
    loading,
    error,
    activeTarget,
    start,
    reset,
    refresh,
    loadChannels,
    loadHistory,
    moreNotifications,
    readNotifications,
    send,
    registerPushDevice,
    sendTyping: (target: MessageTarget, active: boolean) => client?.typing(target, active),
  };
});
