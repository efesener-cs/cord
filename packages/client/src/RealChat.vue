<script setup lang="ts">
import { saveNativeDownload } from "./downloads";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { MessageTarget, PublicAttachment } from "@cord/contracts";
import Icon from "@cord/ui/CordIcon.vue";
import { useCommunication, targetKey, resourceError } from "./communication";
import { useSessionStore } from "./session";
import { usePreferences, type TranslationKey } from "./preferences";
const props = defineProps<{ target: MessageTarget; title: string; subtitle: string }>();
const emit = defineEmits<{ back: []; call: [] }>();
const communication = useCommunication();
const session = useSessionStore();
const preferences = usePreferences();
const { t } = preferences;
const key = computed(() => targetKey(props.target));
const rows = computed(() => communication.messages[key.value] ?? []);
const draft = ref("");
const files = ref<PublicAttachment[]>([]);
const uploading = ref(false);
const sending = ref(false);
const error = ref<TranslationKey | null>(null);
const list = ref<HTMLElement | null>(null);
const input = ref<HTMLTextAreaElement | null>(null);
const picker = ref<HTMLInputElement | null>(null);
const previewUrls = ref<Record<string, string>>({});
const fileBusy = ref<Record<string, boolean>>({});
let clientId = crypto.randomUUID();
let disposed = false;
let lastTyped = 0;
const now = ref(Date.now());
const clock = setInterval(() => {
  now.value = Date.now();
}, 1000);
const typers = computed(() =>
  (communication.typing[key.value] ?? [])
    .filter((row) => row.until > now.value)
    .map((row) => row.user.username)
    .join(", "),
);
const canSend = computed(
  () => !sending.value && !uploading.value && (!!draft.value.trim() || files.value.length > 0),
);
watch(draft, () => {
  clientId = crypto.randomUUID();
  if (Date.now() - lastTyped > 1000) {
    communication.sendTyping(props.target, !!draft.value);
    lastTyped = Date.now();
  }
});
watch(
  () => rows.value.at(-1)?.id,
  async () => {
    const nearBottom =
      !list.value || list.value.scrollHeight - list.value.scrollTop - list.value.clientHeight < 140;
    await nextTick();
    if (nearBottom || rows.value.at(-1)?.author.id === session.user?.id)
      list.value?.scrollTo({ top: list.value.scrollHeight });
  },
  { flush: "post" },
);
async function older() {
  const height = list.value?.scrollHeight ?? 0;
  const position = list.value?.scrollTop ?? 0;
  await communication.loadHistory(props.target, true);
  await nextTick();
  if (list.value) list.value.scrollTop = position + list.value.scrollHeight - height;
}
async function send() {
  if (!canSend.value) return;
  sending.value = true;
  error.value = null;
  try {
    await communication.send(props.target, {
      clientId,
      content: draft.value,
      attachmentIds: files.value.map((file) => file.id),
    });
    if (disposed) return;
    files.value = [];
    draft.value = "";
    clientId = crypto.randomUUID();
    communication.sendTyping(props.target, false);
    await nextTick();
    list.value?.scrollTo({ top: list.value.scrollHeight });
    input.value?.focus();
  } catch (value) {
    if (!disposed) error.value = resourceError(value);
  } finally {
    sending.value = false;
  }
}
function enter(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void send();
  }
}
async function attach(event: Event) {
  const element = event.target as HTMLInputElement;
  const selected = Array.from(element.files ?? []);
  element.value = "";
  if (uploading.value || sending.value) return;
  uploading.value = true;
  error.value = null;
  try {
    for (const file of selected) {
      if (files.value.length >= 4 || file.size > 10 * 1024 * 1024 || file.size === 0) {
        error.value = "attachmentLimit";
        continue;
      }
      const uploaded = await session.api.upload(file);
      if (disposed) {
        await session.api.deleteUpload(uploaded.id).catch(() => {});
        break;
      }
      files.value.push(uploaded);
      clientId = crypto.randomUUID();
    }
  } catch (value) {
    if (!disposed) error.value = resourceError(value);
  } finally {
    uploading.value = false;
  }
}
async function remove(file: PublicAttachment) {
  if (sending.value) return;
  files.value = files.value.filter((row) => row.id !== file.id);
  clientId = crypto.randomUUID();
  await session.api.deleteUpload(file.id).catch(() => {});
}
function isImage(file: PublicAttachment) {
  return /^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(file.mediaType);
}
async function openFile(file: PublicAttachment, preview = false) {
  if (fileBusy.value[file.id]) return;
  fileBusy.value[file.id] = true;
  try {
    const blob = await session.api.download(file.id);
    if (disposed) return;
    if (!preview && (await saveNativeDownload(file, blob))) return;
    const url = URL.createObjectURL(
      new Blob([blob], { type: isImage(file) ? file.mediaType : "application/octet-stream" }),
    );
    if (previewUrls.value[file.id]) URL.revokeObjectURL(previewUrls.value[file.id]!);
    previewUrls.value[file.id] = url;
    if (!preview) {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
    }
  } catch {
    if (!disposed) error.value = "attachmentFailed";
  } finally {
    fileBusy.value[file.id] = false;
  }
}
const time = (date: string) =>
  new Intl.DateTimeFormat(preferences.locale, { hour: "2-digit", minute: "2-digit" }).format(
    new Date(date),
  );
onBeforeUnmount(() => {
  disposed = true;
  clearInterval(clock);
  communication.sendTyping(props.target, false);
  for (const url of Object.values(previewUrls.value)) URL.revokeObjectURL(url);
  for (const file of files.value) void session.api.deleteUpload(file.id).catch(() => {});
});
</script>
<template>
  <main class="conversation">
    <header class="conversation-header">
      <span class="conversation-symbol"
        ><Icon :name="target.kind === 'channel' ? 'hash' : 'chat'" :size="23"
      /></span>
      <div class="conversation-heading">
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>
      <button class="back-button" :title="t('startCall')" @click="emit('call')">
        <Icon name="headset" :size="18" /><span>{{ t("startCall") }}</span>
      </button>
      <button class="back-button" :aria-label="t('goBack')" @click="emit('back')">
        <Icon name="close" :size="17" />
      </button>
    </header>
    <div
      ref="list"
      class="conversation-messages"
      role="log"
      :aria-label="t('messageHistory')"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div class="conversation-intro">
        <h1>{{ target.kind === "channel" ? "#" : "@" }} {{ title }}<span>_</span></h1>
        <p>{{ t("persistentChatHint") }}</p>
      </div>
      <button
        v-if="communication.historyCursor[key]"
        class="back-button"
        :disabled="communication.historyLoading[key]"
        @click="older"
      >
        {{ t("olderMessages") }}
      </button>
      <p v-if="communication.historyLoading[key]" role="status">{{ t("loading") }}</p>
      <div v-if="communication.historyErrors[key]" class="file-error" role="alert">
        {{ t(communication.historyErrors[key]!) }}
        <button class="back-button" @click="communication.loadHistory(target)">
          {{ t("retry") }}
        </button>
      </div>
      <p
        v-if="
          !rows.length && !communication.historyLoading[key] && !communication.historyErrors[key]
        "
        class="composer-hint"
      >
        {{ t("emptyMessages") }}
      </p>
      <article v-for="message in rows" :key="message.id" class="conversation-message">
        <span
          class="message-avatar"
          :class="message.author.id === session.user?.id ? 'self' : 'received'"
          >{{ message.author.username.slice(0, 1).toLocaleUpperCase(preferences.locale) }}</span
        >
        <div class="message-content">
          <div class="message-meta">
            <strong>{{ message.author.username }}</strong
            ><time :datetime="message.createdAt">{{ time(message.createdAt) }}</time>
          </div>
          <p v-if="message.content">{{ message.content }}</p>
          <div v-if="message.attachments.length" class="sent-attachments">
            <div v-for="file in message.attachments" :key="file.id" class="attachment-card">
              <img
                v-if="previewUrls[file.id] && isImage(file)"
                :src="previewUrls[file.id]"
                :alt="file.name"
              />
              <span class="file-details"
                ><Icon :name="isImage(file) ? 'image' : 'file'" :size="18" /><span
                  ><strong>{{ file.name }}</strong
                  ><small>{{ Math.max(1, Math.ceil(file.size / 1024)) }} KB</small></span
                ></span
              >
              <div class="file-actions">
                <button
                  v-if="isImage(file) && !previewUrls[file.id]"
                  :disabled="fileBusy[file.id]"
                  @click="openFile(file, true)"
                >
                  {{ t("lookInside") }}</button
                ><button :disabled="fileBusy[file.id]" @click="openFile(file)">
                  {{ t("download") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
    <footer class="composer-area">
      <p v-if="typers" class="composer-hint" role="status">
        {{ t("typingUsers", { names: typers }) }}
      </p>
      <p v-if="communication.status === 'offline'" class="composer-hint">
        {{ t("reconnectHint") }}
      </p>
      <p v-if="error" class="file-error" role="alert">{{ t(error) }}</p>
      <p v-if="uploading" class="composer-hint" role="status">{{ t("uploading") }}</p>
      <div v-if="files.length" class="pending-attachments">
        <div v-for="file in files" :key="file.id" class="pending-file">
          <Icon name="file" :size="15" /><strong>{{ file.name }}</strong
          ><button
            :disabled="sending"
            :aria-label="t('removeAttachment', { name: file.name })"
            @click="remove(file)"
          >
            <Icon name="close" :size="14" />
          </button>
        </div>
      </div>
      <form class="composer-row" @submit.prevent="send">
        <input ref="picker" type="file" multiple hidden @change="attach" />
        <button
          type="button"
          class="composer-add"
          :disabled="uploading || sending || files.length >= 4"
          :aria-label="t('addFiles')"
          @click="picker?.click()"
        >
          <Icon name="plus" />
        </button>
        <textarea
          ref="input"
          v-model="draft"
          :disabled="sending"
          :aria-label="t('messageText')"
          :placeholder="
            target.kind === 'channel'
              ? t('roomPlaceholder', { name: title })
              : t('writeTo', { name: title })
          "
          maxlength="4000"
          rows="1"
          @keydown="enter"
        ></textarea>
        <button
          class="composer-send"
          type="submit"
          :disabled="!canSend"
          :aria-label="t(sending ? 'sending' : 'send')"
        >
          <Icon name="send" :size="19" />
        </button>
      </form>
      <p class="composer-hint">{{ t("messageLimit") }} · Enter / Shift+Enter</p>
    </footer>
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

<style scoped>
.file-actions {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
}
.file-actions button {
  background: none;
  color: var(--green);
  font-size: 11px;
}
.composer-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 38px;
  align-items: end;
  gap: 10px;
}
.composer-row textarea {
  width: 100%;
  resize: vertical;
  max-height: 140px;
  min-height: 40px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.composer-add,
.composer-send {
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: var(--active);
  color: var(--green);
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.back-button {
  gap: 6px;
}
@media (max-width: 480px) {
  .back-button > span {
    display: none;
  }
}
</style>
