import type { TranslationKey } from "./preferences";
export type Presence = "online" | "idle" | "offline";
export interface Friend {
  id: string;
  name: string;
  handle: string;
  initials: string;
  color: string;
  presence: Presence;
  activity: TranslationKey;
}
export const friends: Friend[] = [
  {
    id: "deniz",
    name: "deniz",
    handle: "deniz.exe",
    initials: "de",
    color: "sage",
    presence: "online",
    activity: "building",
  },
  {
    id: "nova",
    name: "nova",
    handle: "supernova",
    initials: "n",
    color: "amber",
    presence: "online",
    activity: "listening",
  },
  {
    id: "mert",
    name: "mert",
    handle: "mert.sh",
    initials: "m_",
    color: "blue",
    presence: "idle",
    activity: "away",
  },
  {
    id: "ada",
    name: "ada",
    handle: "ada.lovelace",
    initials: "a",
    color: "rose",
    presence: "online",
    activity: "designing",
  },
  {
    id: "efe",
    name: "efe",
    handle: "efe.zip",
    initials: "ef",
    color: "purple",
    presence: "offline",
    activity: "offline",
  },
];

export interface DemoRoom {
  id: string;
  label: TranslationKey;
}
export interface DemoServer {
  id: string;
  label: TranslationKey;
  icon: string;
  rooms: DemoRoom[];
}
export const servers: DemoServer[] = [
  {
    id: "forest",
    label: "forest",
    icon: "leaf",
    rooms: [
      { id: "general", label: "generalChannel" },
      { id: "campfire", label: "campfire" },
      { id: "design", label: "designChannel" },
    ],
  },
  {
    id: "terminal",
    label: "terminal",
    icon: "hash",
    rooms: [
      { id: "general", label: "generalChannel" },
      { id: "code", label: "codeRoom" },
      { id: "sandbox", label: "sandboxRoom" },
    ],
  },
  {
    id: "night",
    label: "nightOwls",
    icon: "moon",
    rooms: [
      { id: "general", label: "generalChannel" },
      { id: "late-night", label: "nightChannel" },
      { id: "music", label: "musicRoom" },
    ],
  },
];
