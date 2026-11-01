<script setup lang="ts">
import { requestNotifications, consumeNotificationIntent } from "./notifications";
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import type { PublicServer, PublicConversation, PublicUser, MessageTarget } from "@cord/contracts";
import Icon from "@cord/ui/CordIcon.vue";
import CordLogo from "@cord/ui/CordLogo.vue";
import { ApiError } from "@cord/sdk";
import { useSessionStore } from "./session";
import { useCommunication, targetKey, resourceError } from "./communication";
import { usePreferences, type TranslationKey } from "./preferences";
import AppearanceControls from "./AppearanceControls.vue";
import AuthTerminal from "./AuthTerminal.vue";
import NotificationsPopover from "./NotificationsPopover.vue";
import RealChat from "./RealChat.vue";
import CallPanel from "./CallPanel.vue";
const preferences = usePreferences();
const { t } = preferences;
const session = useSessionStore();
const communication = useCommunication();
const router = useRouter();
const displayName = computed(() => session.username || t("user"));
const avatarInitial = computed(() =>
  displayName.value.slice(0, 1).toLocaleUpperCase(preferences.locale),
);
const section = ref<"home" | "friends" | "messages" | "server">("home");
const activeServerId = ref<string | null>(null);
const activeServer = computed(() =>
  communication.servers.find((server) => server.id === activeServerId.value),
);
const selectedChannelId = ref<string | null>(null);
const selectedConversation = ref<PublicConversation | null>(null);
const activeRoom = computed(() =>
  (communication.channels[activeServerId.value ?? ""] ?? []).find(
    (channel) => channel.id === selectedChannelId.value,
  ),
);
const isOwner = computed(() => activeServer.value?.ownerId === session.user?.id);
const activeTarget = computed<MessageTarget | null>(() =>
  selectedConversation.value
    ? { kind: "conversation", id: selectedConversation.value.id }
    : section.value === "server" && activeRoom.value
      ? { kind: "channel", id: activeRoom.value.id }
      : null,
);
const activeTitle = computed(
  () =>
    selectedConversation.value?.user.username ??
    activeRoom.value?.name ??
    activeServer.value?.name ??
    t("home"),
);
const activeSubtitle = computed(() =>
  selectedConversation.value ? t("directMessages") : (activeServer.value?.name ?? ""),
);
const mobileNav = ref(false);
const channelLoading = ref(false);
const channelError = ref<TranslationKey | null>(null);
const pageError = ref<TranslationKey | null>(null);
const working = ref(false);
const query = ref("");
const filter = ref<"online" | "all">("all");
const visibleFriends = computed(() =>
  communication.acceptedFriends.filter(
    (friend) =>
      (filter.value === "all" || communication.onlineIds.includes(friend.user.id)) &&
      friend.user.username
        .toLocaleLowerCase(preferences.locale)
        .includes(query.value.toLocaleLowerCase(preferences.locale)),
  ),
);
const onlineCount = computed(() => communication.onlineCount);
const dialog = ref<
  "friend" | "server" | "channel" | "join" | "invite" | "members" | "settings" | "confirm" | null
>(null);
const modalElement = ref<HTMLElement | null>(null);
const formName = ref("");
const formError = ref<TranslationKey | null>(null);
const formSuccess = ref<TranslationKey | null>(null);
const pending = ref(false);
const invite = ref("");
const copied = ref(false);
const members = ref<{ user: PublicUser; joinedAt: string; owner: boolean }[]>([]);
const memberCursor = ref<string | null>(null);
const call = ref<{ target: MessageTarget; title: string } | null>(null);
let previousFocus: HTMLElement | null = null;
let dialogServerId: string | null = null;
let confirmation: (() => Promise<void>) | undefined;
let selectionVersion = 0;
let disposed = false;
const modalTitle = computed<TranslationKey>(
  () =>
    (
      {
        friend: "addFriend",
        server: "createServer",
        channel: "createChannel",
        join: "joinServer",
        invite: "invitePeople",
        members: "serverMembers",
        settings: "settings",
        confirm: "confirmAction",
      } as const
    )[dialog.value ?? "settings"],
);
watch(dialog, async (value) => {
  if (value) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    (
      modalElement.value?.querySelector<HTMLElement>("input, button") ?? modalElement.value
    )?.focus();
  } else {
    await nextTick();
    previousFocus?.focus();
  }
});
function closeDialog() {
  if (!pending.value) dialog.value = null;
}
function trapFocus(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const elements = modalElement.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
  );
  const first = elements?.[0];
  const last = elements?.[elements.length - 1];
  if (!first) {
    event.preventDefault();
    modalElement.value?.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function openDialog(value: NonNullable<typeof dialog.value>) {
  if (pending.value) return;
  formName.value = "";
  formError.value = null;
  formSuccess.value = null;
  invite.value = "";
  copied.value = false;
  dialogServerId = activeServerId.value;
  dialog.value = value;
  if (value === "members") {
    members.value = [];
    memberCursor.value = null;
    void loadMembers();
  }
}
async function loadMembers(append = false) {
  if (!dialogServerId || pending.value) return;
  pending.value = true;
  formError.value = null;
  try {
    const page = await session.api.listMembers(dialogServerId, {
      limit: 50,
      ...(append && memberCursor.value ? { cursor: memberCursor.value } : {}),
    });
    members.value = append ? [...members.value, ...page.members] : page.members;
    memberCursor.value = page.nextCursor;
  } catch (value) {
    formError.value = resourceError(value);
  } finally {
    pending.value = false;
  }
}
function navigate(value: "home" | "friends" | "messages") {
  selectionVersion++;
  section.value = value;
  selectedChannelId.value = null;
  selectedConversation.value = null;
  mobileNav.value = false;
}
async function openServer(server: PublicServer) {
  const version = ++selectionVersion;
  activeServerId.value = server.id;
  section.value = "server";
  selectedConversation.value = null;
  selectedChannelId.value = null;
  channelLoading.value = true;
  channelError.value = null;
  mobileNav.value = true;
  try {
    const rows = await communication.loadChannels(server.id);
    if (version === selectionVersion) selectedChannelId.value = rows[0]?.id ?? null;
  } catch (value) {
    if (version === selectionVersion) channelError.value = resourceError(value);
  } finally {
    if (version === selectionVersion) channelLoading.value = false;
  }
}
function openRoom(id: string) {
  selectedConversation.value = null;
  selectedChannelId.value = id;
  section.value = "server";
  mobileNav.value = false;
}
function openConversation(conversation: PublicConversation) {
  if (disposed) return;
  selectionVersion++;
  selectedConversation.value = conversation;
  selectedChannelId.value = null;
  section.value = "messages";
  mobileNav.value = false;
  void communication.readNotifications(conversation.id).catch(() => {});
}
async function perform(work: () => Promise<void>) {
  if (working.value) return;
  working.value = true;
  pageError.value = null;
  try {
    await work();
  } catch (value) {
    pageError.value = resourceError(value);
  } finally {
    working.value = false;
  }
}
function startChat(userId: string) {
  void perform(async () => {
    const result = await session.api.createConversation(userId);
    openConversation(result.conversation);
    await communication.refresh();
  });
}
async function openNotification(resourceId: string, kind: string) {
  if (kind !== "direct_message") {
    await communication.readNotifications(resourceId).catch(() => {});
    navigate("friends");
    return;
  }
  await communication.refresh();
  if (communication.loading)
    await new Promise<void>((resolve) => {
      const stop = watch(
        () => communication.loading,
        (loading) => {
          if (!loading) {
            stop();
            resolve();
          }
        },
      );
    });
  if (disposed) return;
  const conversation = communication.conversations.find((row) => row.id === resourceId);
  if (conversation) openConversation(conversation);
}
function confirm(work: () => Promise<void>) {
  confirmation = work;
  openDialog("confirm");
}
async function submit() {
  if (pending.value) return;
  const identity = session.user?.id;
  const mode = dialog.value;
  const serverId = dialogServerId;
  pending.value = true;
  formError.value = null;
  formSuccess.value = null;
  try {
    if (mode === "server") {
      const result = await session.api.createServer({ name: formName.value });
      if (disposed || session.user?.id !== identity) return;
      if (!communication.servers.some((server) => server.id === result.server.id))
        communication.servers.push(result.server);
      await openServer(result.server);
      dialog.value = null;
    } else if (mode === "join") {
      const result = await session.api.joinServer(formName.value.trim());
      if (disposed || session.user?.id !== identity) return;
      if (!communication.servers.some((server) => server.id === result.server.id))
        communication.servers.push(result.server);
      await openServer(result.server);
      dialog.value = null;
    } else if (mode === "channel" && serverId) {
      const result = await session.api.createChannel(serverId, { name: formName.value });
      await communication.loadChannels(serverId);
      openRoom(result.channel.id);
      dialog.value = null;
    } else if (mode === "friend") {
      await session.api.requestFriend(formName.value);
      formSuccess.value = "requestSent";
      formName.value = "";
      await communication.refresh();
    } else if (mode === "invite" && serverId) {
      const result = await session.api.createInvite(serverId);
      invite.value = result.code;
    } else if (mode === "confirm" && confirmation) {
      await confirmation();
      dialog.value = null;
      await communication.refresh();
    }
  } catch (value) {
    formError.value = resourceError(value);
  } finally {
    pending.value = false;
  }
}
async function revokeInvites() {
  if (!dialogServerId || pending.value) return;
  pending.value = true;
  try {
    await session.api.revokeInvites(dialogServerId);
    invite.value = "";
    formSuccess.value = "invitesRevoked";
  } catch (value) {
    formError.value = resourceError(value);
  } finally {
    pending.value = false;
  }
}
async function copyInvite() {
  try {
    await navigator.clipboard.writeText(invite.value);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}
function leaveServer() {
  const server = activeServer.value;
  if (!server) return;
  confirm(async () => {
    if (server.ownerId === session.user?.id) await session.api.deleteServer(server.id);
    else await session.api.leaveServer(server.id);
    navigate("home");
    activeServerId.value = null;
  });
}
async function signOut() {
  if (working.value || pending.value) return;
  working.value = true;
  call.value = null;
  let failed = false;
  try {
    await session.logout();
  } catch (value) {
    failed = !(value instanceof ApiError && value.status === 401);
  } finally {
    communication.reset();
    working.value = false;
  }
  await router.push({ path: "/login", query: failed ? { logoutFailed: "1" } : {} });
}
watch(
  () => session.user,
  (user) => {
    if (!user && !disposed) {
      call.value = null;
      void router.replace("/login");
    }
  },
);
watch(
  () => (activeTarget.value ? targetKey(activeTarget.value) : null),
  () => {
    communication.activeTarget = activeTarget.value;
    if (activeTarget.value) void communication.loadHistory(activeTarget.value);
  },
);
watch(
  () => communication.servers,
  (rows) => {
    if (
      section.value === "server" &&
      activeServerId.value &&
      !rows.some((server) => server.id === activeServerId.value)
    ) {
      navigate("home");
      activeServerId.value = null;
      call.value = null;
    }
  },
);
watch(
  () => communication.loading,
  (loading) => {
    if (!loading && activeServer.value && section.value === "server") {
      const serverId = activeServer.value.id;
      void communication.loadChannels(serverId).catch((value) => {
        channelError.value = resourceError(value);
      });
    }
  },
);
async function enableNotifications() {
  try {
    formSuccess.value = (await requestNotifications())
      ? "notificationsEnabled"
      : "notificationsDenied";
  } catch {
    formError.value = "notificationsDenied";
  }
}
function notificationIntent() {
  const value = consumeNotificationIntent();
  if (value) void openNotification(value.resourceId, value.kind);
}
function pushDevice() {
  void communication.registerPushDevice();
}
function notificationOpen(event: Event) {
  const detail = (event as CustomEvent<{ resourceId?: unknown; kind?: unknown }>).detail;
  if (typeof detail?.resourceId === "string")
    void openNotification(
      detail.resourceId,
      typeof detail.kind === "string" ? detail.kind : "direct_message",
    );
}
function resume() {
  void communication.refresh();
}
onMounted(() => {
  void communication.start();
  window.addEventListener("cord:notification-intent", notificationIntent);
  notificationIntent();
  window.addEventListener("cord:push-device", pushDevice);
  window.addEventListener("cord:notification-open", notificationOpen);
  window.addEventListener("cord:resume", resume);
  window.addEventListener("online", resume);
});
onBeforeUnmount(() => {
  selectionVersion++;
  disposed = true;
  window.removeEventListener("cord:notification-intent", notificationIntent);
  window.removeEventListener("cord:push-device", pushDevice);
  window.removeEventListener("cord:notification-open", notificationOpen);
  window.removeEventListener("cord:resume", resume);
  window.removeEventListener("online", resume);
  communication.reset();
});
</script>
<template>
  <div class="app-shell">
    <aside class="server-rail" :aria-label="t('servers')">
      <button class="brand-mark" :aria-label="t('homeLabel')" @click="navigate('home')">
        <CordLogo class="brand-logo" />
      </button>
      <div class="rail-rule"></div>
      <button
        v-for="server in communication.servers"
        :key="server.id"
        class="server-icon forest real-server"
        :class="{ 'server-selected': section === 'server' && activeServerId === server.id }"
        :title="server.name"
        :aria-label="server.name"
        :aria-pressed="section === 'server' && activeServerId === server.id"
        @click="openServer(server)"
      >
        {{ server.name.slice(0, 2).toLocaleUpperCase(preferences.locale) }}
      </button>
      <button
        class="server-icon add-server"
        :aria-label="t('createServer')"
        :title="t('createServer')"
        @click="openDialog('server')"
      >
        <Icon name="plus" :size="23" />
      </button>
      <button
        class="server-icon add-server"
        :aria-label="t('joinServer')"
        :title="t('joinServer')"
        @click="openDialog('join')"
      >
        <Icon name="arrow" :size="21" />
      </button>
      <div class="rail-bottom">
        <span
          class="connection-dot"
          :class="{ 'is-offline': communication.status !== 'connected' }"
        ></span
        ><span>cord</span>
      </div>
    </aside>
    <aside class="sidebar" :class="{ 'mobile-open': mobileNav }" :aria-label="t('navigation')">
      <div class="workspace-brand">
        <span>cord<span class="accent">_</span></span
        ><span class="version">preview</span>
      </div>
      <div class="sidebar-content">
        <button
          class="quick-search"
          :disabled="communication.loading"
          @click="communication.refresh()"
        >
          <Icon name="down" :size="16" /><span>{{
            t(communication.loading ? "loading" : "refreshResources")
          }}</span>
        </button>
        <nav class="primary-nav">
          <button :class="{ active: section === 'home' }" @click="navigate('home')">
            <Icon name="home" /><span>{{ t("home") }}</span>
          </button>
          <button :class="{ active: section === 'friends' }" @click="navigate('friends')">
            <Icon name="people" /><span>{{ t("friends") }}</span
            ><span class="count">{{ communication.incomingFriends.length || onlineCount }}</span>
          </button>
          <button :class="{ active: section === 'messages' }" @click="navigate('messages')">
            <Icon name="chat" /><span>{{ t("messages") }}</span
            ><span v-if="communication.unreadCount" class="count">{{
              communication.unreadCount
            }}</span>
          </button>
        </nav>
        <template v-if="section === 'server' && activeServer">
          <div class="section-label">
            <span>{{ t("textChannels") }}</span
            ><button v-if="isOwner" :aria-label="t('createChannel')" @click="openDialog('channel')">
              <Icon name="plus" :size="16" />
            </button>
          </div>
          <div class="server-room-heading">
            <Icon name="hash" :size="17" /><strong>{{ activeServer.name }}</strong>
          </div>
          <p v-if="channelLoading" class="resource-note" role="status">{{ t("loading") }}</p>
          <div v-if="channelError" class="resource-note" role="alert">
            {{ t(channelError)
            }}<button class="text-button" @click="openServer(activeServer)">
              {{ t("retry") }}
            </button>
          </div>
          <div class="room-list">
            <button
              v-for="room in communication.channels[activeServer.id] ?? []"
              :key="room.id"
              :class="{ 'room-active': activeRoom?.id === room.id }"
              :aria-pressed="activeRoom?.id === room.id"
              @click="openRoom(room.id)"
            >
              <Icon name="hash" :size="17" /><span>{{ room.name }}</span>
            </button>
          </div>
          <p
            v-if="
              !channelLoading && !channelError && !communication.channels[activeServer.id]?.length
            "
            class="resource-note"
          >
            {{ t("noChannels") }}
          </p>
          <div class="server-actions">
            <button class="text-button" @click="openDialog('members')">
              <Icon name="people" :size="16" />{{ t("serverMembers") }}</button
            ><button v-if="isOwner" class="text-button" @click="openDialog('invite')">
              <Icon name="plus" :size="16" />{{ t("invitePeople") }}</button
            ><button class="text-button" @click="leaveServer">
              {{ t(isOwner ? "deleteServer" : "leaveServer") }}
            </button>
          </div>
        </template>
      </div>
      <div class="profile">
        <span class="avatar small self">{{ avatarInitial }}<span class="accent">.</span></span>
        <div>
          <strong>{{ displayName }}</strong
          ><span>{{ t(communication.status === "connected" ? "online" : "offline") }}</span>
        </div>
        <button :aria-label="t('settings')" @click="openDialog('settings')">
          <Icon name="settings" :size="18" />
        </button>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          <button
            class="mobile-toggle"
            :aria-label="t('toggleNavigation')"
            :aria-expanded="mobileNav"
            @click="mobileNav = !mobileNav"
          >
            <Icon name="home" /></button
          ><Icon name="home" :size="18" /><span>{{
            section === "server" ? activeServer?.name : t("personalSpace")
          }}</span
          ><span class="slash">/</span
          ><strong>{{
            activeTarget
              ? activeTitle
              : t(
                  section === "home"
                    ? "home"
                    : section === "friends"
                      ? "friends"
                      : section === "messages"
                        ? "messages"
                        : "serverScope",
                )
          }}</strong>
        </div>
        <div class="topbar-right">
          <button
            :aria-label="t('signOut')"
            :title="t('signOut')"
            :disabled="working || pending"
            @click="signOut"
          >
            <Icon name="exit" :size="18" /></button
          ><AppearanceControls /><NotificationsPopover @open="openNotification" />
        </div>
      </header>
      <div v-if="communication.error || pageError" class="resource-banner" role="alert">
        {{ t(pageError ?? communication.error!)
        }}<button
          class="text-button"
          :disabled="communication.loading"
          @click="
            pageError = null;
            communication.refresh();
          "
        >
          {{ t("retry") }}
        </button>
      </div>
      <CallPanel
        v-if="call"
        :key="targetKey(call.target)"
        :target="call.target"
        :title="call.title"
        @close="call = null"
      />
      <RealChat
        v-if="activeTarget"
        :key="targetKey(activeTarget)"
        :target="activeTarget"
        :title="activeTitle"
        :subtitle="activeSubtitle"
        @back="navigate(selectedConversation ? 'messages' : 'home')"
        @call="call = { target: activeTarget!, title: activeTitle }"
      />
      <main v-else class="dashboard">
        <div class="main-column">
          <template v-if="section === 'home'">
            <section class="welcome">
              <div class="welcome-content">
                <div class="eyebrow"><span></span>{{ t("realWorkspace") }}</div>
                <h1>{{ t("welcome", { name: displayName }) }}<span>_</span></h1>
                <p>{{ t("internetCorner") }}</p>
                <button class="welcome-action" @click="openDialog('server')">
                  {{ t("createServer") }}<Icon name="arrow" :size="16" />
                </button>
              </div>
              <AuthTerminal class="welcome-terminal" />
              <div class="welcome-footer">
                <span
                  ><span class="connection-dot"></span>{{ onlineCount }}
                  {{ t("friendsHere") }}</span
                ><span>{{ t("makeAtHome") }}</span>
              </div>
            </section>
            <section class="recommendations">
              <div class="section-heading">
                <div>
                  <Icon name="leaf" :size="21" />
                  <h2>{{ t("yourServers") }}</h2>
                </div>
                <button class="text-button" @click="openDialog('join')">
                  {{ t("joinServer") }}
                </button>
              </div>
              <p
                v-if="communication.loading && !communication.servers.length"
                class="resource-note"
                role="status"
              >
                {{ t("loading") }}
              </p>
              <p
                v-else-if="!communication.servers.length && !communication.error"
                class="recommendation-intro"
              >
                {{ t("noServers") }}
              </p>
              <div class="recommendation-grid">
                <button
                  v-for="server in communication.servers"
                  :key="server.id"
                  class="recommendation-card"
                  @click="openServer(server)"
                >
                  <span class="recommendation-icon">{{
                    server.name.slice(0, 2).toLocaleUpperCase(preferences.locale)
                  }}</span
                  ><span class="recommendation-copy"
                    ><strong>{{ server.name }}</strong
                    ><small>{{
                      t(server.ownerId === session.user?.id ? "owner" : "member")
                    }}</small></span
                  ><Icon name="arrow" :size="17" />
                </button>
              </div>
            </section>
          </template>
          <template v-else-if="section === 'friends'">
            <div class="section-heading">
              <div>
                <Icon name="people" :size="21" />
                <h2>{{ t("yourFriends") }}</h2>
                <span class="total-count">{{ communication.acceptedFriends.length }}</span>
              </div>
              <button class="text-button" @click="openDialog('friend')">
                <Icon name="plus" :size="16" />{{ t("addFriend") }}
              </button>
            </div>
            <h3 v-if="communication.incomingFriends.length" class="resume-heading">
              {{ t("incomingRequests") }}
            </h3>
            <article
              v-for="friend in communication.incomingFriends"
              :key="friend.id"
              class="friend-row"
            >
              <span class="friend-info"
                ><strong>{{ friend.user.username }}</strong
                ><small>{{ t("pendingRequest") }}</small></span
              ><button
                class="text-button"
                :disabled="working"
                @click="
                  perform(async () => {
                    await session.api.acceptFriend(friend.id);
                    await communication.refresh();
                  })
                "
              >
                {{ t("accept") }}</button
              ><button
                class="text-button"
                :disabled="working"
                @click="
                  perform(async () => {
                    await session.api.removeFriend(friend.id);
                    await communication.refresh();
                  })
                "
              >
                {{ t("decline") }}
              </button>
            </article>
            <div class="friend-toolbar">
              <div class="tabs">
                <button
                  :class="{ active: filter === 'all' }"
                  :aria-pressed="filter === 'all'"
                  @click="filter = 'all'"
                >
                  {{ t("all") }}</button
                ><button
                  :class="{ active: filter === 'online' }"
                  :aria-pressed="filter === 'online'"
                  @click="filter = 'online'"
                >
                  {{ t("online") }}<span>{{ onlineCount }}</span>
                </button>
              </div>
              <label class="friend-search"
                ><Icon name="search" :size="16" /><input
                  v-model="query"
                  :placeholder="t('searchFriends')"
                  :aria-label="t('searchFriends')"
              /></label>
            </div>
            <article v-for="friend in visibleFriends" :key="friend.id" class="friend-row">
              <span class="avatar sage"
                >{{ friend.user.username.slice(0, 1)
                }}<i
                  :class="communication.onlineIds.includes(friend.user.id) ? 'online' : 'offline'"
                ></i></span
              ><span class="friend-info"
                ><strong>{{ friend.user.username }}</strong
                ><span>{{
                  t(communication.onlineIds.includes(friend.user.id) ? "online" : "offline")
                }}</span></span
              ><button
                class="text-button"
                :disabled="working"
                :aria-label="t('startChat')"
                @click="startChat(friend.user.id)"
              >
                <Icon name="chat" /></button
              ><button
                class="text-button"
                :aria-label="t('removeFriend')"
                @click="
                  confirm(async () => {
                    await session.api.removeFriend(friend.id);
                  })
                "
              >
                <Icon name="close" :size="17" />
              </button>
            </article>
            <p v-if="!visibleFriends.length && !communication.loading" class="resource-note">
              {{ t(communication.acceptedFriends.length ? "noFriends" : "noRealFriends") }}
            </p>
            <h3
              v-if="communication.friends.some((friend) => !friend.accepted && !friend.incoming)"
              class="resume-heading"
            >
              {{ t("outgoingRequests") }}
            </h3>
            <article
              v-for="friend in communication.friends.filter(
                (friend) => !friend.accepted && !friend.incoming,
              )"
              :key="friend.id"
              class="friend-row"
            >
              <span class="friend-info"
                ><strong>{{ friend.user.username }}</strong
                ><span>{{ t("pendingRequest") }}</span></span
              ><button
                class="text-button"
                :disabled="working"
                @click="
                  perform(async () => {
                    await session.api.removeFriend(friend.id);
                    await communication.refresh();
                  })
                "
              >
                {{ t("cancel") }}
              </button>
            </article>
          </template>
          <template v-else-if="section === 'messages'"
            ><div class="section-heading">
              <h2>{{ t("messages") }}</h2>
              <button class="text-button" @click="navigate('friends')">
                {{ t("browseFriends") }}
              </button>
            </div>
            <button
              v-for="conversation in communication.conversations"
              :key="conversation.id"
              class="friend-row"
              :class="{
                'conversation-unread': communication.notifications.some(
                  (notice) => notice.resourceId === conversation.id && !notice.read,
                ),
              }"
              @click="openConversation(conversation)"
            >
              <span class="avatar sage">{{ conversation.user.username.slice(0, 1) }}</span
              ><span class="friend-info"
                ><strong>{{ conversation.user.username }}</strong
                ><span>{{
                  communication.messages[
                    targetKey({ kind: "conversation", id: conversation.id })
                  ]?.at(-1)?.content || t("noMessageYet")
                }}</span></span
              ><Icon name="chat" />
            </button>
            <p
              v-if="!communication.conversations.length && !communication.loading"
              class="resource-note"
            >
              {{ t("noConversations") }}
            </p></template
          >
          <section v-else class="simple-page">
            <h1>{{ activeServer?.name }}</h1>
            <p>{{ t(channelLoading ? "loading" : "chooseChannel") }}</p>
            <button v-if="activeServer" class="primary-button" @click="mobileNav = true">
              {{ t("textChannels") }}
            </button>
          </section>
        </div>
        <aside v-if="section === 'home'" class="activity-column">
          <h2>{{ t("incomingRequests") }}</h2>
          <p class="recommendation-intro">{{ communication.incomingFriends.length }}</p>
          <button class="text-button" @click="navigate('friends')">
            {{ t("yourFriends") }}<Icon name="arrow" :size="16" />
          </button>
          <div class="activity-divider"></div>
          <h2>{{ t("createSpace") }}</h2>
          <p class="recommendation-intro">{{ t("createServerHint") }}</p>
          <button class="primary-button" @click="openDialog('server')">
            <Icon name="plus" :size="16" />{{ t("createServer") }}
          </button>
        </aside>
      </main>
      <footer class="statusbar">
        <span
          ><span
            class="connection-dot"
            :class="{ 'is-offline': communication.status !== 'connected' }"
          ></span
          >{{
            t(
              communication.status === "connected"
                ? "realtimeConnected"
                : communication.status === "connecting"
                  ? "realtimeConnecting"
                  : "realtimeOffline",
            )
          }}</span
        ><span>{{ t("yourRules") }}</span>
      </footer>
    </div>
    <div
      v-if="dialog"
      class="modal-backdrop"
      @click.self="closeDialog"
      @keydown.esc.stop="closeDialog"
    >
      <section
        ref="modalElement"
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabindex="-1"
        :aria-busy="pending"
        @keydown="trapFocus"
      >
        <button
          class="modal-close"
          :disabled="pending"
          :aria-label="t('close')"
          @click="closeDialog"
        >
          <Icon name="close" />
        </button>
        <div class="eyebrow">cord_</div>
        <h2 id="modal-title">{{ t(modalTitle) }}</h2>
        <form
          v-if="
            dialog === 'server' || dialog === 'channel' || dialog === 'join' || dialog === 'friend'
          "
          @submit.prevent="submit"
        >
          <p>
            {{
              t(
                dialog === "server"
                  ? "createServerHint"
                  : dialog === "channel"
                    ? "channelNameHint"
                    : dialog === "join"
                      ? "inviteCodeHint"
                      : "friendRequestDescription",
              )
            }}
          </p>
          <label for="resource-name">{{
            t(
              dialog === "server"
                ? "serverName"
                : dialog === "channel"
                  ? "channelName"
                  : dialog === "join"
                    ? "inviteCode"
                    : "username",
            )
          }}</label
          ><input
            id="resource-name"
            v-model="formName"
            :disabled="pending"
            required
            :maxlength="dialog === 'server' ? 80 : dialog === 'channel' ? 64 : 32"
            :pattern="
              dialog === 'channel'
                ? '[A-Za-z0-9][A-Za-z0-9-]{0,63}'
                : dialog === 'join'
                  ? '[A-Za-z0-9_-]{32}'
                  : undefined
            "
            :aria-describedby="dialog === 'server' ? 'server-name-hint' : undefined"
            autocomplete="off"
          />
          <p v-if="dialog === 'server'" id="server-name-hint">{{ t("serverNameHint") }}</p>
          <button class="primary-button" type="submit" :disabled="pending || !formName.trim()">
            {{ t(pending ? "authPending" : dialog === "friend" ? "sendRequest" : modalTitle)
            }}<Icon name="arrow" :size="16" />
          </button>
        </form>
        <template v-else-if="dialog === 'invite'"
          ><p>{{ t("inviteReady") }}</p>
          <label v-if="invite" for="invite-code">{{ t("inviteCode") }}</label
          ><input
            v-if="invite"
            id="invite-code"
            :value="invite"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
          /><button v-if="invite" class="primary-button" @click="copyInvite">
            {{ t(copied ? "copied" : "copy") }}</button
          ><button v-else class="primary-button" :disabled="pending" @click="submit">
            {{ t(pending ? "authPending" : "invitePeople") }}</button
          ><button class="text-button resource-block" :disabled="pending" @click="revokeInvites">
            {{ t("revokeInvites") }}
          </button></template
        >
        <template v-else-if="dialog === 'members'"
          ><p v-if="pending" role="status">{{ t("loading") }}</p>
          <article v-for="member in members" :key="member.user.id" class="friend-row">
            <span class="friend-info"
              ><strong>{{ member.user.username }}</strong
              ><span>{{ t(member.owner ? "owner" : "member") }}</span></span
            ><button
              v-if="isOwner && !member.owner"
              class="text-button"
              :aria-label="t('removeMember')"
              @click="
                confirm(async () => {
                  if (activeServerId)
                    await session.api.removeMember(activeServerId, member.user.id);
                })
              "
            >
              <Icon name="close" :size="16" />
            </button>
          </article>
          <button
            v-if="memberCursor"
            class="primary-button"
            :disabled="pending"
            @click="loadMembers(true)"
          >
            {{ t("more") }}
          </button></template
        >
        <template v-else-if="dialog === 'settings'"
          ><p>{{ t("accountPreferences") }}</p>
          <AppearanceControls /><button class="primary-button" @click="enableNotifications">
            {{ t("enableNotifications") }}</button
          ><button class="primary-button" @click="openDialog('friend')">
            {{ t("addFriend") }}
          </button></template
        >
        <template v-else-if="dialog === 'confirm'"
          ><p>{{ t("destructiveHint") }}</p>
          <button class="primary-button" :disabled="pending" @click="submit">
            {{ t(pending ? "authPending" : "confirmAction") }}</button
          ><button class="text-button resource-block" :disabled="pending" @click="closeDialog">
            {{ t("cancel") }}
          </button></template
        >
        <p v-if="formError" class="form-feedback" role="alert">{{ t(formError) }}</p>
        <p v-if="formSuccess" class="form-feedback" role="status">{{ t(formSuccess) }}</p>
      </section>
    </div>
  </div>
</template>
<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  max-height: 100vh;
  max-height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
.server-rail {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  width: 76px;
  background: var(--rail);
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 22px 0 16px;
  gap: 15px;
  flex-shrink: 0;
  border-right: 1px solid var(--line);
}
.server-rail > *,
.sidebar-content > *,
.workspace-brand,
.profile,
.topbar,
.statusbar {
  flex-shrink: 0;
}
.brand-mark {
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 15px;
  background: transparent;
  padding: 0;
  display: grid;
  place-items: center;
}
.brand-logo {
  display: block;
  width: 100%;
  height: 100%;
}
.brand-mark::before {
  content: "";
  position: absolute;
  height: 28px;
  width: 3px;
  background: var(--green);
  left: -15px;
  top: 9px;
  border-radius: 0 3px 3px 0;
}
.rail-rule {
  width: 28px;
  height: 1px;
  background: var(--line);
  margin: 1px 0 2px;
}
.server-icon {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: var(--surface);
  display: grid;
  place-items: center;
  transition:
    border-radius 0.2s,
    background 0.2s;
}
.server-icon:hover {
  border-radius: 10px;
  background: var(--hover);
}
.forest {
  color: var(--green);
}
.terminal {
  background: var(--amber-bg);
  color: var(--amber);
  font: 20px var(--mono);
}
.sunset {
  background: var(--purple-bg);
  color: var(--purple-text);
  font: 24px serif;
}
.add-server {
  background: transparent;
  border: 1px dashed var(--accent-line);
  color: var(--green);
}
.rail-bottom {
  margin-top: auto;
  padding-top: 25px;
  display: grid;
  justify-items: center;
  gap: 9px;
  color: var(--muted);
  font: 8px var(--mono);
  letter-spacing: 1px;
}
.connection-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--green);
  border-radius: 50%;
  flex-shrink: 0;
}
.sidebar {
  min-height: 0;
  overflow: hidden;
  width: 235px;
  background: var(--sidebar);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  flex-shrink: 0;
}
.workspace-brand {
  height: 73px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
}
.workspace-brand > span:first-child {
  font: 700 25px var(--mono);
  letter-spacing: -2px;
}
.accent {
  color: var(--green);
}
.version {
  font: 9px var(--mono);
  color: var(--muted);
}
.sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 21px 13px;
  display: flex;
  flex-direction: column;
}
.quick-search {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  color: var(--muted);
  font-size: 12px;
  text-align: left;
}
.keycap {
  margin-left: auto;
  color: var(--muted);
}
.primary-nav {
  display: grid;
  gap: 5px;
  margin-top: 23px;
}
.primary-nav button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  color: var(--muted);
  border-radius: 5px;
  background: transparent;
  text-align: left;
  font-size: 13px;
}
.primary-nav button.active {
  background: var(--active);
  color: var(--green);
}
.primary-nav button:hover,
.dm-list button:hover {
  background: var(--hover);
}
.nav-tail {
  margin-left: auto;
  font-size: 23px;
  line-height: 14px;
}
.count {
  margin-left: auto;
  font: 10px var(--mono);
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 4px;
}
.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 34px 11px 11px;
  font: 9px var(--mono);
  letter-spacing: 1.3px;
  color: var(--muted);
}
.section-label button {
  color: var(--muted);
  display: flex;
  background: none;
  padding: 2px;
}
.dm-list {
  display: grid;
  gap: 6px;
}
.dm-list button {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 10px;
  background: transparent;
  border-radius: 5px;
  color: var(--muted);
  font-size: 13px;
}
.dm-list button.dm-active {
  background: var(--active);
}
.dm-note {
  margin-left: auto;
  color: var(--green);
}
.avatar {
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: 600 17px var(--mono);
  position: relative;
}
.avatar.small {
  width: 32px;
  height: 32px;
  border-radius: 11px;
  font-size: 13px;
}
.avatar i {
  position: absolute;
  width: 10px;
  height: 10px;
  bottom: -1px;
  right: -1px;
  border: 2px solid var(--bg);
  border-radius: 50%;
}
.avatar i.online {
  background: var(--green);
}
.avatar i.idle {
  background: var(--idle);
}
.avatar i.offline {
  background: var(--offline);
}
.sage {
  background: var(--sage-bg);
  color: var(--sage-text);
}
.amber {
  background: var(--amber-bg);
  color: var(--amber-text);
}
.blue {
  background: var(--blue-bg);
  color: var(--blue-text);
}
.rose {
  background: var(--rose-bg);
  color: var(--rose-text);
}
.purple {
  background: var(--purple-bg);
  color: var(--purple-text);
}
.self {
  background: var(--sage-bg);
  color: var(--sage-text);
}
.sidebar-note {
  margin: auto 10px 17px;
  padding-top: 66px;
  color: var(--muted);
}
.tiny-spark {
  font-size: 25px;
  color: var(--green);
}
.sidebar-note p {
  font-size: 11px;
  line-height: 1.9;
  margin: 8px 0 0;
}
.sidebar-note p span {
  color: var(--muted);
}
.profile {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 16px 13px;
  border-top: 1px solid var(--line);
  background: var(--sidebar);
}
.profile > div {
  flex: 1;
  display: grid;
  gap: 3px;
}
.profile strong {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}
.profile > div > span {
  font-size: 10px;
  color: var(--green);
}
.profile button {
  background: none;
  color: var(--muted);
  padding: 2px;
}
.profile button.toggled {
  color: var(--danger);
  text-decoration: line-through;
  background: var(--danger-bg);
}
.main-shell {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  height: 73px;
  border-bottom: 1px solid var(--line);
  padding: 0 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 13px;
  font-size: 11px;
  color: var(--muted);
}
.breadcrumb strong {
  font-weight: 500;
  color: var(--text);
}
.slash {
  color: var(--muted);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
.preview-badge {
  font: 8px var(--mono);
  letter-spacing: 1.4px;
  color: var(--muted);
}
.topbar-divider {
  background: var(--line);
  height: 18px;
  width: 1px;
}
.topbar-right button {
  background: none;
  color: var(--muted);
  display: flex;
  padding: 3px;
}
.mobile-toggle {
  display: none;
}
.dashboard {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex: 1;
  gap: 34px;
  padding: 32px 30px 20px;
  max-width: 1580px;
  width: 100%;
  margin: 0 auto;
}
.main-column {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  flex: 1;
  min-width: 0;
}
.welcome {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.welcome-content {
  position: relative;
  z-index: 1;
  padding: 28px 28px 24px;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font: 9px var(--mono);
  letter-spacing: 1.6px;
  color: var(--green);
}
.eyebrow > span {
  width: 5px;
  height: 5px;
  background: var(--green);
  box-shadow: 0 0 8px var(--art-glow);
  border-radius: 50%;
}
h1 {
  overflow-wrap: anywhere;
  font-size: clamp(24px, 2.2vw, 34px);
  font-weight: 550;
  letter-spacing: -1.2px;
  margin: 22px 0 13px;
}
h1 > span {
  color: var(--green);
}
.welcome p {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.85;
  margin: 0;
}
.welcome-action {
  background: none;
  display: inline-flex;
  gap: 16px;
  align-items: center;
  color: var(--green);
  font-size: 11px;
  padding: 0;
  margin-top: 25px;
}
.welcome-action:hover {
  color: var(--text);
}
.welcome-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 22px;
  border-top: 1px solid var(--line);
  background: var(--welcome-footer);
  color: var(--muted);
  gap: 8px;
}
.welcome-footer > span:first-child {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
}
.welcome-footer > span:last-child {
  font: 8px var(--mono);
  letter-spacing: 1px;
  color: var(--muted);
}
.friends-section {
  margin-top: 32px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.section-heading > div {
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-heading svg {
  color: var(--green);
}
h2 {
  font-weight: 550;
  font-size: 15px;
  margin: 0;
}
.total-count {
  font: 10px var(--mono);
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 2px 5px;
}
.text-button {
  background: none;
  color: var(--green);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 0;
}
.text-button:hover {
  color: var(--text);
}
.friend-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 21px;
  gap: 12px;
  border-bottom: 1px solid var(--line);
}
.tabs {
  display: flex;
  gap: 23px;
  align-self: stretch;
}
.tabs button {
  background: none;
  color: var(--muted);
  font-size: 11px;
  padding: 0 0 14px;
  display: flex;
  gap: 7px;
  align-items: center;
  border-bottom: 2px solid transparent;
}
.tabs button.active {
  color: var(--green);
  border-bottom-color: var(--green);
}
.tabs button > span {
  color: var(--green);
  background: var(--surface);
  border-radius: 4px;
  padding: 2px 5px;
  font: 9px var(--mono);
}
.friend-search {
  display: flex;
  align-items: center;
  color: var(--muted);
  gap: 7px;
  padding-bottom: 13px;
}
.friend-search input {
  color: var(--text);
  width: 102px;
  border: none;
  background: none;
  font-size: 11px;
  min-width: 0;
}
.friend-search input::placeholder {
  color: var(--muted);
}
.list-label {
  color: var(--muted);
  font: 9px var(--mono);
  letter-spacing: 1.2px;
  padding: 20px 0 9px;
}
.friend-row {
  width: 100%;
  background: none;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px 2px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.friend-row:hover {
  background: var(--hover);
}
.friend-info {
  display: grid;
  gap: 7px;
  flex: 1;
  min-width: 0;
}
.friend-info strong {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 550;
}
.friend-info small {
  font-size: 10px;
  font-weight: 400;
  color: var(--muted);
}
.friend-info > span {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
.music-note {
  color: var(--green);
}
.friend-chat {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface);
  display: grid;
  place-items: center;
  color: var(--muted);
}
.bottom-note {
  display: flex;
  gap: 9px;
  align-items: center;
  color: var(--muted);
  font-size: 10px;
  margin-top: 29px;
}
.bottom-line {
  height: 1px;
  flex: 1;
  background: var(--line);
  margin: 0 8px;
}
.mono {
  font: 8px var(--mono);
}
.activity-column {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  width: 278px;
  flex-shrink: 0;
  border-left: 1px solid var(--line);
  padding-left: 27px;
}
.activity-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin: 3px 0 9px;
}
.activity-title h2 {
  font-size: 12px;
}
.live-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: 7px var(--mono);
  letter-spacing: 0.5px;
  color: var(--green);
  white-space: nowrap;
}
.live-label i {
  width: 4px;
  height: 4px;
  background: var(--green);
  border-radius: 50%;
}
.aside-caption {
  margin: 0 0 25px;
  font-size: 10px;
  color: var(--muted);
}
.voice-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 17px 16px 15px;
}
.card-overline {
  display: flex;
  align-items: center;
  gap: 7px;
  font: 8px var(--mono);
  letter-spacing: 1.1px;
  color: var(--green);
}
.card-overline .connection-dot {
  width: 5px;
  height: 5px;
}
.voice-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}
.channel-icon {
  width: 40px;
  height: 40px;
  background: var(--surface);
  color: var(--green);
  border-radius: 11px;
  display: grid;
  place-items: center;
}
h3 {
  font-size: 13px;
  font-weight: 550;
  margin: 0;
}
.voice-title > div > span {
  display: block;
  font-size: 10px;
  color: var(--muted);
  margin-top: 6px;
}
.dim {
  padding: 0 4px;
  color: var(--muted);
}
.voice-members {
  display: flex;
  align-items: center;
  padding: 21px 0 17px 4px;
}
.avatar.mini {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  font-size: 9px;
  margin-left: -4px;
}
.voice-members > span:last-child {
  margin-left: 9px;
  font-size: 10px;
  color: var(--muted);
}
.join-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--accent-line);
  border-radius: 5px;
  font-size: 11px;
  background: var(--active);
  color: var(--green);
}
.join-button:hover {
  background: var(--active-hover);
}
.listening-card {
  margin-top: 15px;
  padding: 17px 15px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}
.listening-card .card-overline {
  color: var(--muted);
}
.track {
  display: flex;
  gap: 9px;
  align-items: center;
  margin-top: 16px;
}
.album-art {
  height: 38px;
  width: 38px;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  background: var(--album-bg);
  border-radius: 5px;
  transform: rotate(-3deg);
}
.album-art span {
  position: absolute;
  width: 10px;
  height: 70px;
  background: var(--album-orange);
  transform: rotate(30deg);
  top: -15px;
  left: 3px;
}
.album-art span:nth-child(2) {
  background: var(--album-yellow);
  left: 15px;
  transform: rotate(42deg);
}
.album-art span:nth-child(3) {
  background: var(--album-green);
  left: 28px;
}
.album-art span:nth-child(4) {
  background: var(--album-red);
  left: -14px;
}
.track > div:nth-child(2) {
  min-width: 0;
}
.track strong {
  display: block;
  font-size: 10px;
  font-weight: 550;
}
.track > div > span:not(.album-art span) {
  display: block;
  font-size: 9px;
  color: var(--muted);
  margin-top: 6px;
}
.equalizer {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}
.equalizer i {
  width: 2px;
  height: 12px;
  background: var(--green);
}
.equalizer i:nth-child(2) {
  height: 19px;
}
.equalizer i:nth-child(3) {
  height: 8px;
}
.track-progress {
  height: 3px;
  background: var(--line);
  margin-top: 17px;
  border-radius: 5px;
}
.track-progress > span {
  display: block;
  width: 60%;
  height: 100%;
  background: var(--green);
  border-radius: inherit;
}
.track-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 9px;
  color: var(--muted);
  font: 8px var(--mono);
}
.track-footer .connection-dot {
  width: 4px;
  height: 4px;
  margin-right: 4px;
}
.activity-divider {
  height: 1px;
  background: var(--line);
  margin: 26px 0;
}
.invite-card {
  padding: 1px 9px;
}
.invite-art {
  position: relative;
  color: var(--green);
  width: 68px;
  margin-bottom: 16px;
}
.invite-art > svg {
  transform: rotate(-16deg);
}
.invite-art > span {
  position: absolute;
  right: 2px;
  top: 0;
  font: 20px var(--mono);
  color: var(--green);
}
.invite-card h3 {
  font-size: 19px;
  line-height: 1.45;
  letter-spacing: -0.4px;
}
.invite-card p {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
  margin: 11px 0;
}
.invite-card .text-button {
  font-size: 10px;
  gap: 13px;
}
.aside-footer {
  margin: 34px 9px 12px;
  padding-top: 18px;
  border-top: 1px dashed var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.cord-mini {
  font: 600 14px var(--mono);
  color: var(--green);
  letter-spacing: -1px;
}
.aside-footer > span:last-child {
  font-size: 8px;
  color: var(--muted);
}
.statusbar {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 30px;
  border-top: 1px solid var(--active);
  font: 8px var(--mono);
  color: var(--muted);
}
.statusbar > span:first-child {
  display: flex;
  gap: 7px;
  align-items: center;
}
.statusbar .connection-dot {
  width: 4px;
  height: 4px;
}
.status-divider {
  margin: 0 3px;
  color: var(--muted);
}
.statusbar > span:last-child {
  letter-spacing: 0.5px;
}
.empty-state {
  padding: 36px 0;
  color: var(--muted);
  font-size: 13px;
}
.simple-page {
  padding: 40px 10px;
}
.simple-page p {
  max-width: 470px;
  color: var(--muted);
  line-height: 1.8;
  font-size: 14px;
}
.primary-button {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--accent-line);
  background: var(--active);
  color: var(--green);
  border-radius: 5px;
  padding: 11px 16px;
  font-size: 12px;
  margin-top: 18px;
}
.primary-button:hover {
  background: var(--active-hover);
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: grid;
  place-items: center;
  z-index: 20;
  padding: 24px;
  backdrop-filter: blur(5px);
}
.modal {
  max-height: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 35px;
  max-width: 450px;
  width: 100%;
  position: relative;
}
.modal-close {
  position: absolute;
  right: 13px;
  top: 13px;
  color: var(--muted);
  padding: 4px;
  background: none;
}
.modal h2 {
  font-size: 26px;
  margin: 22px 0 15px;
  letter-spacing: -0.8px;
}
.modal p {
  color: var(--muted);
  line-height: 1.8;
  font-size: 13px;
}
.modal label {
  display: block;
  font-size: 12px;
  margin: 22px 0 9px;
}
.modal input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--accent-line);
  border-radius: 5px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}
.form-feedback {
  padding: 12px;
  border: 1px solid var(--accent-line);
  border-radius: 5px;
}
.setting-toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 14px 0;
  background: none;
  font-size: 12px;
  width: 100%;
}
.setting-toggle strong {
  margin-left: auto;
  color: var(--green);
}
@media (min-width: 1600px) {
  .dashboard {
    padding-top: 45px;
  }
  .welcome-content {
    padding: 40px 32px;
  }
  .friend-row {
    padding: 20px 2px;
  }
  .activity-column {
    width: 310px;
    padding-left: 30px;
  }
}
@media (max-width: 1220px) {
  .sidebar {
    width: 210px;
  }
  .dashboard {
    gap: 23px;
    padding: 25px 22px 20px;
  }
  .activity-column {
    width: 248px;
    padding-left: 20px;
  }
  .activity-title {
    flex-wrap: wrap;
    gap: 8px;
  }
  .welcome-content {
    padding-left: 22px;
  }
  .welcome-footer > span:last-child {
    display: none;
  }
  .friend-info small {
    display: none;
  }
  .topbar {
    padding: 0 22px;
  }
}
@media (max-width: 1050px) {
  .activity-column {
    display: none;
  }
  .dashboard {
    padding: 28px;
  }
  .welcome-content {
    padding: 30px;
  }
  .welcome-footer > span:last-child {
    display: inline;
  }
  .sidebar {
    width: 220px;
  }
}
@media (max-width: 720px) {
  .preview-badge {
    display: none;
  }
  .server-rail {
    width: 60px;
    padding-top: 17px;
    gap: 14px;
  }
  .brand-mark {
    width: 39px;
    height: 39px;
    border-radius: 12px;
  }
  .brand-mark::before {
    left: -11px;
    top: 7px;
    height: 25px;
  }
  .server-icon {
    width: 37px;
    height: 37px;
    border-radius: 12px;
  }
  .sidebar {
    display: none;
    position: fixed;
    z-index: 10;
    top: 61px;
    left: 60px;
    bottom: 0;
    width: 230px;
    box-shadow: 20px 0 40px var(--shadow);
  }
  .sidebar.mobile-open {
    display: flex;
  }
  .workspace-brand {
    display: none;
  }
  .mobile-toggle {
    display: flex;
    padding: 0;
    background: none;
    color: var(--green);
  }
  .breadcrumb > svg {
    display: none;
  }
  .breadcrumb {
    gap: 10px;
    font-size: 10px;
  }
  .breadcrumb > span:first-of-type,
  .breadcrumb .slash {
    display: none;
  }
  .topbar {
    height: 61px;
    padding: 0 19px;
  }
  .topbar-right {
    gap: 12px;
  }
  .preview-badge {
    font-size: 7px;
    letter-spacing: 0.5px;
  }
  .topbar-divider {
    display: none;
  }
  .dashboard {
    padding: 22px 18px;
  }
  .welcome-content {
    padding: 25px 21px;
  }
  .eyebrow {
    font-size: 7px;
    letter-spacing: 1px;
  }
  .welcome h1 {
    font-size: 25px;
    max-width: 240px;
    line-height: 1.35;
  }
  .welcome p {
    font-size: 12px;
  }
  .welcome-footer {
    padding: 12px 17px;
  }
  .welcome-footer > span:last-child {
    display: none;
  }
  .section-heading h2 {
    font-size: 14px;
  }
  .section-heading .text-button {
    font-size: 10px;
    gap: 4px;
  }
  .friend-row {
    padding: 16px 0;
    gap: 11px;
  }
  .friend-info > span {
    font-size: 10px;
  }
  .avatar {
    width: 37px;
    height: 37px;
    border-radius: 12px;
    font-size: 14px;
  }
  .friend-search input {
    width: 85px;
  }
  .tabs {
    gap: 18px;
  }
  .bottom-note {
    font-size: 9px;
    gap: 6px;
  }
  .bottom-note .mono {
    display: none;
  }
  .statusbar {
    padding: 11px 18px;
    font-size: 7px;
  }
  .statusbar > span:last-child {
    display: none;
  }
  .status-divider {
    display: none;
  }
  .modal {
    padding: 30px 24px;
  }
  .simple-page {
    padding: 30px 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}

.welcome {
  box-shadow: 0 8px 30px var(--card-shadow);
}
@media (max-width: 720px) {
  .topbar-right {
    gap: 10px;
  }
}

.server-icon.server-selected {
  outline: 1px solid var(--green);
  outline-offset: 3px;
}
.server-room-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 11px 13px;
  color: var(--green);
}
.server-room-heading strong {
  font-size: 12px;
  font-weight: 550;
}
.server-room-heading .version {
  margin-left: auto;
  font-size: 7px;
}
.room-list {
  display: grid;
  gap: 4px;
}
.room-list button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border-radius: 5px;
  background: none;
  color: var(--muted);
  font-size: 12px;
  text-align: left;
}
.room-list button > span {
  flex: 1;
}
.room-list button:hover {
  background: var(--hover);
}
.room-list button.room-active {
  background: var(--active);
  color: var(--green);
}

.welcome {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
  align-items: center;
}
.welcome-terminal {
  width: calc(100% - 20px);
  margin: 16px 20px 16px 0;
  transform: none;
}
.welcome-footer {
  grid-column: 1 / -1;
}
.recommendations {
  margin-top: 30px;
}
.recommendation-label {
  font: 8px var(--mono);
  color: var(--muted);
}
.recommendation-intro {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}
.recommendation-grid {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}
.recommendation-card {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  text-align: left;
}
.recommendation-card:hover {
  background: var(--hover);
  border-color: var(--accent-line);
}
.recommendation-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--active);
  color: var(--green);
  flex-shrink: 0;
}
.recommendation-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 6px;
}
.recommendation-copy small {
  font: 8px var(--mono);
  color: var(--green);
}
.recommendation-copy strong {
  font-size: 14px;
}
.recommendation-copy > span {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.6;
}
.recommendation-card > svg {
  color: var(--green);
  flex-shrink: 0;
}
.resume-heading {
  margin: 28px 0 8px;
}
.friend-row.conversation-unread {
  background: var(--active);
  border-radius: 6px;
  padding-left: 12px;
  padding-right: 12px;
  box-shadow: inset 3px 0 var(--green);
}
.friend-row.conversation-unread .friend-info > span {
  color: var(--text);
}
.friend-info small.unread-label {
  color: var(--green);
  font: 9px var(--mono);
  margin-left: auto;
}
@media (max-width: 1220px) and (min-width: 1051px), (max-width: 850px) {
  .welcome {
    grid-template-columns: minmax(0, 1fr);
  }
  .welcome-terminal {
    width: calc(100% - 40px);
    max-width: none;
    margin: 0 20px 20px;
  }
}
@media (max-width: 480px) {
  .recommendation-label {
    display: none;
  }
  .friend-info strong {
    flex-wrap: wrap;
  }
  .recommendation-card {
    padding: 13px;
    gap: 10px;
  }
}
</style>

<style scoped>
.real-server {
  font: 600 13px var(--mono);
}
.server-room-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
.server-actions {
  display: grid;
  gap: 9px;
  margin: 20px 11px;
}
.resource-note {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
  padding: 8px 11px;
}
.resource-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 20px;
  background: var(--active);
  color: var(--text);
  font-size: 12px;
  gap: 12px;
}
.resource-block {
  display: flex;
  margin-top: 18px;
}
.is-offline {
  background: var(--muted);
}
.room-list button > span,
.recommendation-copy > strong {
  overflow-wrap: anywhere;
  min-width: 0;
}
.profile > div {
  min-width: 0;
}
.profile strong {
  overflow: hidden;
  text-overflow: ellipsis;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.friend-row > button {
  flex-shrink: 0;
}
.breadcrumb {
  min-width: 0;
}
.breadcrumb > strong,
.breadcrumb > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 480px) {
  .friend-row {
    flex-wrap: wrap;
  }
  .friend-info {
    min-width: 90px;
  }
}
</style>
