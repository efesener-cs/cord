<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "@cord/ui/CordIcon.vue";
import { useDemoStore, type LocalAttachment } from "./store";
import { usePreferences } from "./preferences";
import { useSessionStore } from "./session";

const props = defineProps<{
  threadId: string;
  title: string;
  subtitle: string;
  friendId?: string;
}>();
const emit = defineEmits<{ back: [] }>();
const store = useDemoStore();
const preferences = usePreferences();
const { t } = preferences;
const session = useSessionStore();
const draft = ref("");
const pending = ref<LocalAttachment[]>([]);
const menuOpen = ref(false);
const fileError = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const fileAccept = ref("");
const list = ref<HTMLElement | null>(null);
const composerMenu = ref<HTMLElement | null>(null);
const addButton = ref<HTMLButtonElement | null>(null);
const textInput = ref<HTMLTextAreaElement | null>(null);
const displayName = computed(() => session.username || t("user"));
store.ensureThread(props.threadId);
const messages = computed(() => store.messages[props.threadId] ?? []);
const canSend = computed(() => !!draft.value.trim() || pending.value.length > 0);
watch(
  () => messages.value.length,
  async () => {
    if (props.friendId) store.markRead(props.friendId);
    await nextTick();
    list.value?.scrollTo({ top: list.value.scrollHeight, behavior: "auto" });
  },
  { immediate: true, flush: "post" },
);
function send(): void {
  if (!store.send(props.threadId, draft.value, pending.value, displayName.value)) return;
  pending.value = [];
  draft.value = "";
  fileError.value = false;
  menuOpen.value = false;
  textInput.value?.focus();
}
function enter(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
}
async function chooseFiles(images = false): Promise<void> {
  fileAccept.value = images ? "image/*" : "";
  menuOpen.value = false;
  await nextTick();
  fileInput.value?.click();
}
function attach(event: Event): void {
  const input = event.target as HTMLInputElement;
  fileError.value = false;
  for (const file of Array.from(input.files ?? [])) {
    if (pending.value.length >= 4 || file.size > 10 * 1024 * 1024) {
      fileError.value = true;
      continue;
    }
    pending.value.push({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    });
  }
  input.value = "";
  textInput.value?.focus();
}
function removeAttachment(id: string): void {
  const file = pending.value.find((item) => item.id === id);
  if (file) URL.revokeObjectURL(file.url);
  pending.value = pending.value.filter((item) => item.id !== id);
}
function isImage(file: LocalAttachment): boolean {
  return /^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(file.type);
}
function size(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}
function time(value: number): string {
  return new Intl.DateTimeFormat(preferences.locale, { hour: "2-digit", minute: "2-digit" }).format(
    value,
  );
}
function closeOutside(event: PointerEvent): void {
  if (event.target instanceof Node && !composerMenu.value?.contains(event.target))
    menuOpen.value = false;
}
function closeMenu(): void {
  menuOpen.value = false;
  addButton.value?.focus();
}
onMounted(() => {
  document.addEventListener("pointerdown", closeOutside);
  if (window.matchMedia("(min-width: 721px)").matches) textInput.value?.focus();
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeOutside);
  for (const file of pending.value) URL.revokeObjectURL(file.url);
});
</script>
<template>
  <main class="conversation">
    <header class="conversation-header">
      <span class="conversation-symbol"
        ><Icon :name="friendId ? 'chat' : 'hash'" :size="23"
      /></span>
      <div class="conversation-heading">
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>
      <button class="back-button" @click="emit('back')">
        {{ t("goBack") }}<Icon name="close" :size="17" />
      </button>
    </header>
    <div
      ref="list"
      class="conversation-messages"
      role="log"
      :aria-label="title"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div class="conversation-intro">
        <span class="eyebrow"
          >{{ t("localConversation") }} / {{ friendId ? "@" : "#" }}{{ title }}</span
        >
        <h1>{{ friendId ? t("chatWith", { name: title }) : `# ${title}` }}<span>_</span></h1>
        <p>{{ t(friendId ? "chatPreview" : "roomPreview") }}</p>
      </div>
      <article
        v-for="message in messages"
        :key="message.id"
        class="conversation-message"
        :class="{ 'echo-message': message.kind === 'echo' }"
      >
        <span class="message-avatar" :class="message.kind">{{
          message.kind === "echo"
            ? ">_"
            : message.author.slice(0, 1).toLocaleUpperCase(preferences.locale)
        }}</span>
        <div class="message-content">
          <div class="message-meta">
            <strong>{{ message.kind === "echo" ? message.author : message.author }}</strong
            ><span v-if="message.kind === 'echo'" class="echo-label">{{ t("echoLabel") }}</span
            ><time :datetime="new Date(message.createdAt).toISOString()">{{
              time(message.createdAt)
            }}</time>
          </div>
          <p v-if="message.text || message.textKey">
            {{
              message.textKey
                ? t(message.textKey)
                : message.kind === "echo"
                  ? t("echoText", { text: message.text })
                  : message.text
            }}
          </p>
          <div v-if="message.attachments.length" class="sent-attachments">
            <a
              v-for="file in message.attachments"
              :key="file.id"
              class="attachment-card"
              :href="file.url"
              :download="file.name"
              :aria-label="t('downloadAttachment', { name: file.name })"
              ><img v-if="isImage(file)" :src="file.url" :alt="file.name" /><span
                class="file-details"
                ><Icon :name="isImage(file) ? 'image' : 'file'" :size="18" /><span
                  ><strong>{{ file.name }}</strong
                  ><small>{{ size(file.size) }}</small></span
                ><Icon name="download" :size="16" /></span
            ></a>
          </div>
        </div>
      </article>
    </div>
    <div class="composer-area">
      <div v-if="pending.length" class="pending-attachments">
        <div v-for="file in pending" :key="file.id" class="pending-file">
          <img v-if="isImage(file)" :src="file.url" :alt="file.name" /><Icon
            v-else
            name="file"
            :size="23"
          /><span
            ><strong>{{ file.name }}</strong
            ><small>{{ size(file.size) }}</small></span
          ><button
            type="button"
            :aria-label="t('removeAttachment', { name: file.name })"
            @click="removeAttachment(file.id)"
          >
            <Icon name="close" :size="15" />
          </button>
        </div>
      </div>
      <p v-if="fileError" class="file-error" role="alert">{{ t("attachmentLimit") }}</p>
      <form class="conversation-composer" @submit.prevent="send">
        <textarea
          ref="textInput"
          v-model="draft"
          rows="2"
          maxlength="2000"
          :aria-label="t('messageFor', { name: title })"
          :placeholder="
            friendId ? t('writeTo', { name: title }) : t('roomPlaceholder', { name: title })
          "
          @keydown="enter"
        ></textarea>
        <div ref="composerMenu" class="composer-add" @keydown.esc.stop="closeMenu">
          <button
            ref="addButton"
            type="button"
            class="add-button"
            :aria-label="t('addAttachment')"
            :aria-expanded="menuOpen"
            aria-controls="attachment-menu"
            @click="menuOpen = !menuOpen"
          >
            <Icon name="plus" :size="19" />
          </button>
          <div v-if="menuOpen" id="attachment-menu" class="attachment-menu">
            <button type="button" @click="chooseFiles()">
              <Icon name="file" :size="17" />{{ t("addFiles") }}</button
            ><button type="button" @click="chooseFiles(true)">
              <Icon name="image" :size="17" />{{ t("addImages") }}
            </button>
            <p>{{ t("localFiles") }}</p>
          </div>
        </div>
        <button type="submit" class="send-button" :aria-label="t('send')" :disabled="!canSend">
          <Icon name="send" :size="19" />
        </button>
      </form>
      <input
        ref="fileInput"
        type="file"
        :accept="fileAccept"
        multiple
        hidden
        :aria-label="t('addFiles')"
        @change="attach"
      />
      <p class="composer-hint">{{ t("composerHint") }}</p>
    </div>
  </main>
</template>
<style scoped>
.conversation {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.conversation-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 19px 28px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.conversation-symbol {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  background: var(--surface);
  border-radius: 11px;
  color: var(--green);
  flex-shrink: 0;
}
.conversation-heading {
  min-width: 0;
}
.conversation-heading h2 {
  font-size: 15px;
  font-weight: 550;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-heading p {
  font-size: 10px;
  color: var(--muted);
  margin: 6px 0 0;
}
.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  background: none;
  color: var(--muted);
  margin-left: auto;
  flex-shrink: 0;
}
.conversation-messages {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 25px 30px;
}
.conversation-intro {
  padding: 15px 0 22px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 24px;
}
.eyebrow {
  font: 8px var(--mono);
  letter-spacing: 1.2px;
  color: var(--green);
}
.conversation-intro h1 {
  font-size: 27px;
  font-weight: 500;
  letter-spacing: -0.8px;
  overflow-wrap: anywhere;
}
.conversation-intro h1 span {
  color: var(--green);
}
.conversation-intro p {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}
.conversation-message {
  display: flex;
  gap: 12px;
  margin: 23px 0;
}
.message-avatar {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: var(--sage-bg);
  color: var(--sage-text);
  border-radius: 10px;
  font: 12px var(--mono);
}
.message-avatar.received {
  background: var(--amber-bg);
  color: var(--amber-text);
}
.message-avatar.echo {
  background: var(--surface);
  color: var(--green);
}
.message-content {
  flex: 1;
  min-width: 0;
}
.message-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  align-items: center;
  min-height: 20px;
}
.message-meta strong {
  font-size: 12px;
  font-weight: 550;
  overflow-wrap: anywhere;
}
.message-meta time {
  color: var(--muted);
  font: 8px var(--mono);
}
.echo-label {
  color: var(--green);
  font: 8px var(--mono);
}
.message-content > p {
  font-size: 13px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 6px 0 0;
}
.echo-message .message-content > p {
  color: var(--muted);
}
.sent-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}
.attachment-card {
  display: flex;
  flex-direction: column;
  width: min(280px, 100%);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: var(--panel);
  color: var(--text);
  text-decoration: none;
}
.attachment-card > img {
  width: 100%;
  height: 170px;
  object-fit: contain;
  background: var(--bg);
}
.file-details {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
}
.file-details > span {
  flex: 1;
  min-width: 0;
}
.file-details strong,
.pending-file strong {
  display: block;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
.file-details small,
.pending-file small {
  display: block;
  color: var(--muted);
  font: 8px var(--mono);
  margin-top: 5px;
}
.file-details > svg {
  flex-shrink: 0;
  color: var(--green);
}
.composer-area {
  flex-shrink: 0;
  padding: 12px 28px 13px;
  background: var(--bg);
  min-width: 0;
}
.conversation-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px 40px;
  gap: 9px;
  align-items: end;
  border: 1px solid var(--line);
  background: var(--panel);
  padding: 9px;
  border-radius: 8px;
}
.conversation-composer:focus-within {
  border-color: var(--accent-line);
}
.conversation-composer textarea {
  min-width: 0;
  width: 100%;
  min-height: 44px;
  max-height: 128px;
  resize: vertical;
  padding: 6px 8px;
  border: 0;
  background: none;
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
  outline-offset: 0;
  border-radius: 4px;
}
.conversation-composer textarea::placeholder {
  color: var(--muted);
}
.composer-add {
  position: relative;
}
.add-button,
.send-button {
  width: 100%;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
}
.send-button {
  background: var(--active);
  color: var(--green);
  border-color: var(--accent-line);
}
.add-button:hover,
.send-button:not(:disabled):hover {
  background: var(--hover);
}
.composer-hint {
  color: var(--muted);
  font: 8px/1.6 var(--mono);
  margin: 8px 3px 0;
}
.attachment-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 12px);
  z-index: 5;
  width: 230px;
  padding: 7px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 9px;
  box-shadow: 0 12px 35px var(--shadow);
}
.attachment-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px;
  border-radius: 5px;
  font-size: 12px;
  background: none;
  text-align: left;
}
.attachment-menu button:hover {
  background: var(--hover);
}
.attachment-menu p {
  font: 8px/1.8 var(--mono);
  color: var(--muted);
  padding: 8px 10px 2px;
  border-top: 1px solid var(--line);
}
.pending-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 155px;
  overflow-y: auto;
  margin-bottom: 10px;
}
.pending-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 240px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}
.pending-file > span {
  min-width: 0;
}
.pending-file > img {
  width: 34px;
  height: 34px;
  object-fit: cover;
  border-radius: 4px;
}
.pending-file > svg {
  flex-shrink: 0;
  color: var(--green);
}
.pending-file button {
  background: none;
  display: grid;
  place-items: center;
  padding: 5px;
  color: var(--muted);
}
.file-error {
  color: var(--danger);
  font-size: 11px;
  margin: 0 0 10px;
}
@media (max-width: 720px) {
  .conversation-header {
    padding: 14px 17px;
    gap: 9px;
  }
  .conversation-heading p {
    display: none;
  }
  .back-button {
    font-size: 10px;
  }
  .conversation-messages {
    padding: 18px;
  }
  .conversation-intro h1 {
    font-size: 23px;
  }
  .composer-area {
    padding: 10px 14px;
  }
  .conversation-composer {
    gap: 6px;
    grid-template-columns: minmax(0, 1fr) 33px 36px;
    padding: 7px;
  }
  .composer-hint {
    font-size: 7px;
  }
  .message-meta {
    gap: 6px;
  }
}
@media (max-height: 500px) {
  .conversation-intro {
    padding: 0 0 12px;
    margin-bottom: 15px;
  }
  .conversation-intro h1 {
    margin: 12px 0;
  }
  .conversation-intro p,
  .composer-hint {
    display: none;
  }
  .conversation-header {
    padding-top: 10px;
    padding-bottom: 10px;
  }
}
</style>
