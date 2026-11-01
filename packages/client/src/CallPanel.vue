<script setup lang="ts">
import { nativeScreenSharing } from "./screen-sharing";
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type LocalTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalTrackPublication,
  type LocalParticipant,
} from "livekit-client";
import type { MessageTarget } from "@cord/contracts";
import Icon from "@cord/ui/CordIcon.vue";
import { useSessionStore } from "./session";
import { usePreferences } from "./preferences";
import { resourceError } from "./communication";
import type { TranslationKey } from "./preferences";
const props = defineProps<{ target: MessageTarget; title: string }>();
const emit = defineEmits<{ close: [] }>();
const { t } = usePreferences();
const session = useSessionStore();
const room = new Room({ adaptiveStream: true, dynacast: true });
const tracks = ref<HTMLElement | null>(null);
const connecting = ref(true);
const busy = ref(false);
const microphone = ref(false);
const camera = ref(false);
const screen = ref(false);
const canPlay = ref(true);
const names = ref<string[]>([]);
const error = ref<TranslationKey | null>(null);
let disposed = false;
const nativeScreen = nativeScreenSharing();
let stopScreenListener: (() => void) | undefined;
function update() {
  names.value = [
    room.localParticipant.name || t("you"),
    ...Array.from(room.remoteParticipants.values()).map((person) => person.name || person.identity),
  ];
  microphone.value = room.localParticipant.isMicrophoneEnabled;
  camera.value = room.localParticipant.isCameraEnabled;
  if (!nativeScreen) screen.value = room.localParticipant.isScreenShareEnabled;
}
function attach(track: RemoteTrack | LocalTrack) {
  if (track.kind === Track.Kind.Audio && track.isLocal) return;
  const element = track.attach();
  element.autoplay = true;
  if (element instanceof HTMLVideoElement) {
    element.playsInline = true;
    if (track.isLocal) element.muted = true;
  }
  tracks.value?.append(element);
}
function detach(track: RemoteTrack | LocalTrack) {
  track.detach().forEach((element) => element.remove());
}
room.on(
  RoomEvent.TrackSubscribed,
  (track: RemoteTrack, _publication: RemoteTrackPublication, _participant: RemoteParticipant) =>
    attach(track),
);
room.on(RoomEvent.TrackUnsubscribed, (track) => detach(track));
room.on(
  RoomEvent.LocalTrackPublished,
  (publication: LocalTrackPublication, _participant: LocalParticipant) => {
    if (publication.track) attach(publication.track);
    update();
  },
);
room.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
  if (publication.track) detach(publication.track);
  update();
});
room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
  canPlay.value = room.canPlaybackAudio;
});
room.on(RoomEvent.ParticipantConnected, update);
room.on(RoomEvent.ParticipantDisconnected, update);
room.on(RoomEvent.Disconnected, () => {
  if (!disposed) emit("close");
});
room.on(RoomEvent.MediaDevicesError, () => {
  error.value = "mediaPermission";
});
onMounted(async () => {
  try {
    if (nativeScreen)
      stopScreenListener = await nativeScreen.listen((active) => {
        screen.value = active;
      });
    if (disposed) {
      stopScreenListener?.();
      return;
    }
    const connection = await session.api.mediaToken(props.target);
    if (disposed) return;
    await room.connect(connection.url, connection.token);
    if (disposed) {
      await room.disconnect();
      return;
    }
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch {
      error.value = "mediaPermission";
    }
    update();
  } catch (value) {
    if (!disposed) error.value = resourceError(value);
  } finally {
    connecting.value = false;
  }
});
async function toggle(kind: "microphone" | "camera" | "screen") {
  if (busy.value || connecting.value) return;
  if (kind === "screen" && !nativeScreen && !navigator.mediaDevices?.getDisplayMedia) {
    error.value = "screenShareUnavailable";
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    if (kind === "microphone") await room.localParticipant.setMicrophoneEnabled(!microphone.value);
    else if (kind === "camera") await room.localParticipant.setCameraEnabled(!camera.value);
    else if (nativeScreen) {
      if (screen.value) {
        await nativeScreen.stop();
        screen.value = false;
      } else {
        const connection = await session.api.mediaScreenToken(props.target);
        await nativeScreen.start(connection.url, connection.token);
        screen.value = true;
      }
    } else await room.localParticipant.setScreenShareEnabled(!screen.value, { audio: false });
    update();
  } catch {
    error.value = "mediaPermission";
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  stopScreenListener?.();
  if (nativeScreen) void nativeScreen.stop().catch(() => {});
  void room.disconnect();
});
</script>
<template>
  <section class="call-panel" :aria-label="t('callParticipants')">
    <header>
      <Icon name="headset" :size="18" /><strong>{{ title }}</strong
      ><span>{{ names.join(", ") }}</span
      ><button @click="emit('close')">{{ t("leaveCall") }}</button>
    </header>
    <p v-if="connecting" role="status">{{ t("callConnecting") }}</p>
    <p v-if="error" role="alert">{{ t(error) }}</p>
    <div ref="tracks" class="call-tracks"></div>
    <div class="call-controls">
      <button
        v-if="!canPlay"
        @click="
          room.startAudio().catch(() => {
            error = 'mediaPermission';
          })
        "
      >
        {{ t("enableAudio") }}
      </button>
      <button
        :disabled="busy || connecting"
        :aria-pressed="microphone"
        @click="toggle('microphone')"
      >
        <Icon name="mic" :size="17" />{{ t(microphone ? "mute" : "unmute") }}
      </button>
      <button :disabled="busy || connecting" :aria-pressed="camera" @click="toggle('camera')">
        {{ t(camera ? "cameraOff" : "cameraOn") }}
      </button>
      <button :disabled="busy || connecting" :aria-pressed="screen" @click="toggle('screen')">
        {{ t(screen ? "stopSharing" : "shareScreen") }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.call-panel {
  flex-shrink: 0;
  max-height: 45dvh;
  overflow: auto;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  flex-wrap: wrap;
}
header > span {
  flex: 1;
  color: var(--muted);
  overflow-wrap: anywhere;
}
button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--accent-line);
  background: var(--active);
  color: var(--green);
  border-radius: 5px;
  padding: 7px 10px;
  font-size: 11px;
}
button:disabled {
  opacity: 0.5;
}
p {
  font-size: 12px;
  color: var(--muted);
}
.call-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.call-tracks {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.call-tracks :deep(video) {
  width: min(100%, 340px);
  max-height: 24dvh;
  border-radius: 8px;
  background: var(--surface);
  object-fit: contain;
}
</style>
