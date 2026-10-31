<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import Icon from "@cord/ui/CordIcon.vue";
import CordLogo from "@cord/ui/CordLogo.vue";
import { ApiError } from "@cord/sdk";
import { friends, servers, type Friend } from "./demo";
import { useDemoStore } from "./store";
import { useSessionStore } from "./session";
import { useRouter } from "vue-router";
import AppearanceControls from "./AppearanceControls.vue";
import ChatPanel from "./ChatPanel.vue";
import AuthTerminal from "./AuthTerminal.vue";
import NotificationsPopover from "./NotificationsPopover.vue";
import { usePreferences } from "./preferences";

const preferences = usePreferences();
const { t } = preferences;

const store = useDemoStore();
const session = useSessionStore();
const router = useRouter();
const displayName = computed(() => session.username || t("user"));
const avatarInitial = computed(() =>
  displayName.value.slice(0, 1).toLocaleUpperCase(preferences.locale),
);
const signOutPending = ref(false);
const signOutError = ref(false);
async function signOut() {
  if (signOutPending.value) return;
  signOutPending.value = true;
  signOutError.value = false;
  try {
    await session.logout();
  } catch (error) {
    signOutError.value = !(error instanceof ApiError && error.status === 401);
  } finally {
    signOutPending.value = false;
  }
  store.reset();
  void router.push({ path: "/login", query: signOutError.value ? { logoutFailed: "1" } : {} });
}
const section = ref("home");
const filter = ref("online");
const hasUnread = (id: string): boolean =>
  store.notifications.some((notice) => notice.friendId === id && !notice.read);
const query = ref("");
const selectedFriend = ref<Friend | null>(null);
const dialog = ref<"friend" | "server" | "settings" | null>(null);
const friendHandle = ref("");
const feedback = ref("");
const activeServer = ref(servers[0]!);
const selectedRoomId = ref<string | null>(null);
const activeRoom = computed(() =>
  activeServer.value.rooms.find((room) => room.id === selectedRoomId.value),
);
const activeThread = computed(() =>
  selectedFriend.value
    ? `dm:${selectedFriend.value.id}`
    : activeRoom.value
      ? `server:${activeServer.value.id}:${activeRoom.value.id}`
      : null,
);
const activeTitle = computed(
  () => selectedFriend.value?.name ?? t(activeRoom.value?.label ?? "generalChannel"),
);
const activeSubtitle = computed(() =>
  selectedFriend.value
    ? t(selectedFriend.value.activity)
    : `${t(activeServer.value.label)} / ${t("room")}`,
);
const mobileNav = ref(false);
const modalElement = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;
watch(dialog, async (value) => {
  if (value) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    modalElement.value?.querySelector<HTMLButtonElement>("button")?.focus();
  } else {
    previousFocus?.focus();
  }
});
function trapFocus(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const elements = modalElement.value?.querySelectorAll<HTMLElement>(
    'button, input, [tabindex="0"]',
  );
  const first = elements?.[0];
  const last = elements?.[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
async function focusSearch() {
  navigate("friends");
  await nextTick();
  document.getElementById("friend-search")?.focus();
}
const onlineCount = friends.filter((friend) => friend.presence !== "offline").length;
const visibleFriends = computed(() =>
  friends.filter(
    (friend) =>
      (filter.value === "all" || friend.presence !== "offline") &&
      `${friend.name} ${friend.handle}`
        .toLocaleLowerCase(preferences.locale)
        .includes(query.value.toLocaleLowerCase(preferences.locale)),
  ),
);
function navigate(value: string) {
  const server = servers.find((item) => item.id === value);
  selectedFriend.value = null;
  if (server) {
    activeServer.value = server;
    selectedRoomId.value = server.rooms[0]!.id;
    section.value = "server";
    mobileNav.value = true;
  } else {
    selectedRoomId.value = null;
    section.value = value;
    mobileNav.value = false;
  }
}
function openRoom(id: string): void {
  selectedFriend.value = null;
  selectedRoomId.value = id;
  section.value = "server";
  mobileNav.value = false;
}
function openChat(friend: Friend) {
  selectedFriend.value = friend;
  selectedRoomId.value = null;
  section.value = "messages";
  store.markRead(friend.id);
  mobileNav.value = false;
}
function openChatById(id: string): void {
  const friend = friends.find((item) => item.id === id);
  if (friend) openChat(friend);
}
function previewFor(id: string): string {
  const latest = store.messages[`dm:${id}`]?.at(-1);
  if (!latest) {
    const notice = store.notifications.find((item) => item.friendId === id);
    return notice ? (notice.textKey ? t(notice.textKey) : notice.text) : t("noMessageYet");
  }
  return latest.textKey
    ? t(latest.textKey)
    : latest.text || latest.attachments.map((file) => file.name).join(", ");
}
function openDialog(value: "friend" | "server" | "settings") {
  feedback.value = "";
  friendHandle.value = "";
  dialog.value = value;
}
function submitFriend() {
  if (friendHandle.value.trim()) feedback.value = "friend";
}
</script>

<template>
  <div class="app-shell">
    <aside class="server-rail" :aria-label="t('servers')">
      <button class="brand-mark selected" :aria-label="t('homeLabel')" @click="navigate('home')">
        <CordLogo class="brand-logo" />
      </button>
      <div class="rail-rule"></div>
      <button
        class="server-icon forest"
        :class="{ 'server-selected': activeServer.id === 'forest' && !!activeRoom }"
        :aria-label="t('forestPreview')"
        @click="navigate('forest')"
      >
        <Icon name="leaf" :size="25" />
      </button>
      <button
        class="server-icon terminal"
        :class="{ 'server-selected': activeServer.id === 'terminal' && !!activeRoom }"
        :aria-label="t('terminalPreview')"
        @click="navigate('terminal')"
      >
        &gt;_
      </button>
      <button
        class="server-icon sunset"
        :class="{ 'server-selected': activeServer.id === 'night' && !!activeRoom }"
        :aria-label="t('nightPreview')"
        @click="navigate('night')"
      >
        月
      </button>
      <button
        class="server-icon add-server"
        :aria-label="t('addServer')"
        @click="openDialog('server')"
      >
        <Icon name="plus" :size="23" />
      </button>
      <div class="rail-bottom">
        <span class="connection-dot"></span><span>{{ t("local") }}</span>
      </div>
    </aside>

    <aside class="sidebar" :class="{ 'mobile-open': mobileNav }" :aria-label="t('navigation')">
      <div class="workspace-brand">
        <span>cord<span class="accent">_</span></span
        ><span class="version">preview / 01</span>
      </div>
      <div class="sidebar-content">
        <button class="quick-search" @click="focusSearch">
          <Icon name="search" :size="16" /><span>{{ t("findSomeone") }}</span
          ><span class="keycap">⌕</span>
        </button>
        <nav class="primary-nav">
          <button
            :class="{ active: section === 'home' && !selectedFriend }"
            @click="navigate('home')"
          >
            <Icon name="home" /><span>{{ t("home") }}</span
            ><span class="nav-tail">⌁</span>
          </button>
          <button
            :class="{ active: section === 'friends' && !selectedFriend }"
            @click="navigate('friends')"
          >
            <Icon name="people" /><span>{{ t("friends") }}</span
            ><span class="count">{{ onlineCount }}</span>
          </button>
          <button :class="{ active: section === 'messages' }" @click="navigate('messages')">
            <Icon name="chat" /><span>{{ t("messages") }}</span
            ><span v-if="store.unreadCount" class="count">{{ store.unreadCount }}</span>
          </button>
        </nav>
        <template v-if="section === 'server'">
          <div class="section-label">
            <span>{{ t("serverRooms") }}</span
            ><Icon name="hash" :size="14" />
          </div>
          <div class="server-room-heading">
            <Icon :name="activeServer.icon" :size="17" /><strong>{{ t(activeServer.label) }}</strong
            ><span class="version">LOCAL</span>
          </div>
          <div class="room-list">
            <button
              v-for="room in activeServer.rooms"
              :key="room.id"
              :class="{ 'room-active': activeRoom?.id === room.id }"
              @click="openRoom(room.id)"
            >
              <Icon name="hash" :size="17" /><span>{{ t(room.label) }}</span
              ><Icon v-if="activeRoom?.id === room.id" name="chevron" :size="13" />
            </button>
          </div>
        </template>
      </div>
      <div class="profile">
        <span class="avatar small self"
          >{{ avatarInitial }}<span class="accent">.</span><i class="online"></i
        ></span>
        <div>
          <strong>{{ displayName }}</strong
          ><span>{{ t("online") }}</span>
        </div>
        <button
          :class="{ toggled: store.muted }"
          :aria-pressed="store.muted"
          :aria-label="store.muted ? t('unmute') : t('mute')"
          @click="store.muted = !store.muted"
        >
          <Icon name="mic" :size="17" /></button
        ><button :aria-label="t('settings')" @click="openDialog('settings')">
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
            selectedFriend
              ? t("dmBreadcrumb")
              : activeRoom
                ? t(activeServer.label)
                : t("personalSpace")
          }}</span
          ><span class="slash">/</span
          ><strong>{{
            (activeThread ? activeTitle : null) ??
            (section === "home"
              ? t("home")
              : section === "friends"
                ? t("friends")
                : section === "messages"
                  ? t("messages")
                  : t("serverPreview"))
          }}</strong>
        </div>
        <div class="topbar-right">
          <button
            :aria-label="t('signOut')"
            :title="t('signOut')"
            :disabled="signOutPending"
            @click="signOut"
          >
            <Icon name="exit" :size="18" />
          </button>
          <AppearanceControls />
          <span class="preview-badge">{{ t("localPreview") }}</span
          ><span class="topbar-divider"></span><NotificationsPopover @open-dm="openChatById" />
        </div>
      </header>

      <main v-if="!activeThread" class="dashboard">
        <div class="main-column">
          <template v-if="section === 'home' || section === 'friends'">
            <section v-if="section === 'home'" class="welcome">
              <div class="welcome-content">
                <div class="eyebrow"><span></span> {{ t("connected") }}</div>
                <h1>{{ t("welcome", { name: displayName }) }}<span>_</span></h1>
                <p>{{ t("startConversation") }}<br />{{ t("internetCorner") }}</p>
                <button class="welcome-action" @click="openDialog('friend')">
                  {{ t("bringFriend") }} <Icon name="arrow" :size="16" />
                </button>
              </div>
              <AuthTerminal class="welcome-terminal" />
              <div class="welcome-footer">
                <span
                  ><span class="connection-dot"></span> {{ onlineCount }}
                  {{ t("friendsHere") }}</span
                ><span>{{ t("makeAtHome") }}</span>
              </div>
            </section>
            <section v-if="section === 'home'" class="recommendations">
              <div class="section-heading">
                <div>
                  <Icon name="leaf" :size="21" />
                  <h2>{{ t("forYou") }}</h2>
                </div>
                <span class="recommendation-label">{{ t("localPreview") }}</span>
              </div>
              <p class="recommendation-intro">{{ t("recommendationIntro") }}</p>
              <div class="recommendation-grid">
                <button
                  v-for="server in servers"
                  :key="server.id"
                  class="recommendation-card"
                  @click="navigate(server.id)"
                >
                  <span class="recommendation-icon"><Icon :name="server.icon" :size="23" /></span>
                  <span class="recommendation-copy"
                    ><small>{{ t("discoverServer") }}</small
                    ><strong>{{ t(server.label) }}</strong
                    ><span>{{ t("serverSuggestion") }}</span></span
                  >
                  <Icon name="arrow" :size="17" />
                </button>
              </div>
              <h3 class="resume-heading">{{ t("continueConversation") }}</h3>
              <button
                v-for="friend in friends.slice(0, 2)"
                :key="friend.id"
                class="friend-row"
                :class="{ 'conversation-unread': hasUnread(friend.id) }"
                @click="openChat(friend)"
              >
                <span class="avatar" :class="friend.color"
                  >{{ friend.initials }}<i :class="friend.presence"></i
                ></span>
                <span class="friend-info"
                  ><strong
                    >{{ friend.name
                    }}<small v-if="hasUnread(friend.id)" class="unread-label">{{
                      t("unread")
                    }}</small></strong
                  ><span>{{ previewFor(friend.id) }}</span></span
                >
                <Icon name="arrow" :size="17" />
              </button>
            </section>
            <section v-if="section === 'friends'" class="friends-section">
              <div class="section-heading">
                <div>
                  <Icon name="people" :size="21" />
                  <h2>{{ t("yourFriends") }}</h2>
                  <span class="total-count">{{ friends.length }}</span>
                </div>
                <button class="text-button" @click="openDialog('friend')">
                  <Icon name="plus" :size="16" /> {{ t("addFriend") }}
                </button>
              </div>
              <div class="friend-toolbar">
                <div class="tabs" :aria-label="t('friendFilter')">
                  <button
                    :class="{ active: filter === 'online' }"
                    :aria-pressed="filter === 'online'"
                    @click="filter = 'online'"
                  >
                    {{ t("online") }} <span>{{ onlineCount }}</span></button
                  ><button
                    :class="{ active: filter === 'all' }"
                    :aria-pressed="filter === 'all'"
                    @click="filter = 'all'"
                  >
                    {{ t("all") }}
                  </button>
                </div>
                <label class="friend-search"
                  ><Icon name="search" :size="16" /><input
                    id="friend-search"
                    v-model="query"
                    :placeholder="t('searchFriends')"
                    :aria-label="t('searchFriends')"
                /></label>
              </div>
              <div class="list-label">
                {{ filter === "all" ? t("allFriends") : t("aroundNow") }} —
                {{ visibleFriends.length }}
              </div>
              <div class="friend-list">
                <button
                  v-for="friend in visibleFriends"
                  :key="friend.id"
                  class="friend-row"
                  @click="openChat(friend)"
                >
                  <span class="avatar" :class="friend.color"
                    >{{ friend.initials }}<i :class="friend.presence"></i></span
                  ><span class="friend-info"
                    ><strong
                      >{{ friend.name }}<small>{{ friend.handle }}</small></strong
                    ><span
                      ><span v-if="friend.id === 'nova'" class="music-note">♫ </span
                      >{{ t(friend.activity) }}</span
                    ></span
                  ><span class="friend-chat"><Icon name="chat" :size="19" /></span>
                </button>
                <div v-if="!visibleFriends.length" class="empty-state">
                  {{ t("noFriends") }}
                </div>
              </div>
            </section>
            <div class="bottom-note">
              <Icon name="leaf" :size="15" /><span>{{ t("lessNoise") }}</span
              ><span class="bottom-line"></span><span class="mono">est. 2026</span>
            </div>
          </template>
          <section v-else class="simple-page">
            <span class="eyebrow">{{ t("dmBreadcrumb") }}</span>
            <h1>{{ t("openMessages") }}<span>_</span></h1>
            <button
              v-for="friend in friends"
              :key="friend.id"
              class="friend-row"
              :class="{ 'conversation-unread': hasUnread(friend.id) }"
              @click="openChat(friend)"
            >
              <span class="avatar" :class="friend.color"
                >{{ friend.initials }}<i :class="friend.presence"></i></span
              ><span class="friend-info"
                ><strong
                  >{{ friend.name }}<small>{{ friend.handle }}</small
                  ><small v-if="hasUnread(friend.id)" class="unread-label">{{
                    t("unread")
                  }}</small></strong
                ><span>{{ previewFor(friend.id) }}</span></span
              ><Icon name="chat" :size="19" />
            </button>
          </section>
        </div>

        <aside v-if="section === 'home'" class="activity-column" :aria-label="t('activities')">
          <div class="activity-title">
            <h2>{{ t("happening") }}</h2>
            <span class="live-label"><i></i> {{ t("liveDemo") }}</span>
          </div>
          <p class="aside-caption">{{ t("sameFrequency") }}</p>
          <article class="voice-card">
            <div class="card-overline">
              <span class="connection-dot"></span> {{ t("voiceChat") }}
            </div>
            <div class="voice-title">
              <span class="channel-icon"><Icon name="headset" :size="23" /></span>
              <div>
                <h3>{{ t("campfire") }}</h3>
                <span>{{ t("forest") }} <span class="dim">/</span> {{ t("voiceChannel") }}</span>
              </div>
            </div>
            <div class="voice-members">
              <span class="avatar mini sage">de</span><span class="avatar mini blue">m_</span
              ><span class="avatar mini amber">n</span><span>{{ t("hangingOut") }}</span>
            </div>
            <button
              class="join-button"
              @click="
                feedback = t('voiceUnavailable');
                dialog = 'server';
              "
            >
              {{ t("joinChat") }} <Icon name="exit" :size="17" />
            </button>
          </article>
          <article class="listening-card">
            <div class="card-overline">
              <span class="music-note">♫</span> {{ t("listenTogether") }}
            </div>
            <div class="track">
              <div class="album-art" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </div>
              <div><strong>Weird Fishes / Arpeggi</strong><span>Radiohead · In Rainbows</span></div>
              <div class="equalizer" aria-hidden="true"><i></i><i></i><i></i></div>
            </div>
            <div class="track-progress"><span></span></div>
            <div class="track-footer">
              <span><i class="connection-dot"></i> {{ t("novaListening") }}</span
              ><span>03:12 / 05:18</span>
            </div>
          </article>
          <div class="activity-divider"></div>
          <article class="invite-card">
            <div class="invite-art" aria-hidden="true">
              <Icon name="leaf" :size="40" /><span>+</span>
            </div>
            <h3>{{ t("yourPeople") }}<br />{{ t("yourPlace") }}</h3>
            <p>{{ t("createBeginning") }}<br />{{ t("startSomething") }}</p>
            <button class="text-button" @click="openDialog('server')">
              {{ t("createSpace") }} <Icon name="arrow" :size="16" />
            </button>
          </article>
          <div class="aside-footer">
            <span class="cord-mini">cord_</span><span>{{ t("closer") }}</span>
          </div>
        </aside>
      </main>

      <ChatPanel
        v-else
        :key="activeThread"
        :thread-id="activeThread"
        :title="activeTitle"
        :subtitle="activeSubtitle"
        v-bind="selectedFriend ? { friendId: selectedFriend.id } : {}"
        @back="navigate(selectedFriend ? 'messages' : 'home')"
      />
      <footer class="statusbar">
        <span
          ><span class="connection-dot"></span> {{ t("systemsQuiet") }}
          <span class="status-divider">/</span> {{ t("interfacePreview") }}</span
        ><span>{{ t("yourRules") }}<span class="accent"> ▪</span></span>
      </footer>
    </div>

    <div
      v-if="dialog"
      class="modal-backdrop"
      @click.self="dialog = null"
      @keydown.esc="dialog = null"
    >
      <section
        ref="modalElement"
        @keydown="trapFocus"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        class="modal"
        tabindex="-1"
      >
        <button class="modal-close" :aria-label="t('close')" autofocus @click="dialog = null">
          <Icon name="close" />
        </button>
        <div class="eyebrow">{{ t("cordPreview") }}</div>
        <h2 id="modal-title">
          {{
            dialog === "friend"
              ? t("makeConnection")
              : dialog === "settings"
                ? t("yourFrequency")
                : t("spaceTogether")
          }}
        </h2>
        <template v-if="dialog === 'friend'"
          ><p>{{ t("friendDescription") }}</p>
          <form @submit.prevent="submitFriend">
            <label for="friend-handle">{{ t("username") }}</label
            ><input
              id="friend-handle"
              v-model="friendHandle"
              required
              maxlength="64"
              :placeholder="t('exampleHandle')"
            /><button class="primary-button" type="submit">
              {{ t("previewRequest") }} <Icon name="arrow" :size="17" />
            </button></form></template
        ><template v-else-if="dialog === 'settings'"
          ><p>
            {{ t("settingsDescription") }}
          </p>
          <button
            class="setting-toggle"
            :aria-pressed="store.deafened"
            @click="store.deafened = !store.deafened"
          >
            <Icon name="headset" /> {{ t("deafenPreview") }}
            <strong>{{ store.deafened ? t("on") : t("off") }}</strong>
          </button></template
        >
        <p v-else>
          {{ (feedback === "voice" ? t("voiceUnavailable") : "") || t("serverUnavailable") }}
        </p>
        <p v-if="feedback && dialog === 'friend'" class="form-feedback" role="status">
          {{ t("requestFeedback", { handle: friendHandle.trim() }) }}
        </p>
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
