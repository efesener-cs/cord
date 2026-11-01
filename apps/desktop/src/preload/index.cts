import { contextBridge, ipcRenderer } from "electron";

// Expose only session operations; never generic IPC or filesystem access.
contextBridge.exposeInMainWorld(
  "cordDesktop",
  Object.freeze({
    platform: process.platform,
    session: Object.freeze({
      read: (origin: string): Promise<string | null> =>
        ipcRenderer.invoke("cord:session:read", origin),
      write: (origin: string, token: string, language: string): Promise<void> =>
        ipcRenderer.invoke("cord:session:write", origin, token, language),
      clear: (origin: string): Promise<void> => ipcRenderer.invoke("cord:session:clear", origin),
    }),
  }),
);
