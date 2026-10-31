import { contextBridge } from "electron";

// Keep the bridge read-only and expose only the capability this adapter needs.
contextBridge.exposeInMainWorld("cordDesktop", Object.freeze({ platform: process.platform }));
