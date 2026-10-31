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
