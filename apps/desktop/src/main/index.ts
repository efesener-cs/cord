import {
  app,
  BrowserWindow,
  session,
  ipcMain,
  desktopCapturer,
  dialog,
  webContents,
  type IpcMainInvokeEvent,
} from "electron";
import { confirmPlaintextSession } from "./session-consent.js";
import { sessionVault } from "./session-vault.js";
import { fileURLToPath, pathToFileURL } from "node:url";

const rendererPath = fileURLToPath(new URL("../renderer/index.html", import.meta.url));
const rendererUrl = pathToFileURL(rendererPath);

function createWindow(): void {
  const window = new BrowserWindow({
    title: "Cord",
    icon: fileURLToPath(new URL("../renderer/cord-icon.png", import.meta.url)),
    width: 1360,
    height: 860,
    minWidth: 400,
    minHeight: 480,
    backgroundColor: "#0e0f0f",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
    },
  });

  window.webContents.on("before-input-event", (event, input) => {
    if (
      input.type === "keyDown" &&
      (input.key === "F5" || ((input.control || input.meta) && input.key.toLowerCase() === "r"))
    ) {
      event.preventDefault();
      window.webContents.reload();
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, target) => {
    const destination = new URL(target);
    // Only the bundled renderer and its hash routes belong in this window.
    destination.hash = "";
    if (destination.href !== rendererUrl.href) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  void window.loadFile(rendererPath, { hash: "/dashboard" }).catch((error: unknown) => {
    console.error("Unable to load the desktop renderer:", error);
    app.quit();
  });
}

void app.whenReady().then(() => {
  function trusted(event: IpcMainInvokeEvent): void {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame) throw new Error("Untrusted session caller");
    const caller = new URL(frame.url);
    caller.hash = "";
    if (caller.href !== rendererUrl.href) throw new Error("Untrusted session caller");
  }
  ipcMain.handle("cord:session:read", (event, origin: unknown) => {
    trusted(event);
    return sessionVault.read(origin);
  });
  ipcMain.handle(
    "cord:session:write",
    (event, origin: unknown, token: unknown, language: unknown) => {
      trusted(event);
      return sessionVault.write(origin, token, () =>
        confirmPlaintextSession(BrowserWindow.fromWebContents(event.sender), language),
      );
    },
  );
  ipcMain.handle("cord:session:clear", (event, origin: unknown) => {
    trusted(event);
    return sessionVault.clear(origin);
  });
  function bundled(url: string): boolean {
    try {
      const caller = new URL(url);
      caller.hash = "";
      return caller.href === rendererUrl.href;
    } catch {
      return false;
    }
  }
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(
      (permission === "media" || permission === "notifications") &&
        details.isMainFrame &&
        bundled(contents.getURL()) &&
        bundled(details.requestingUrl),
    );
  });
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, _origin, details) =>
      (permission === "media" || permission === "notifications") &&
      !!contents &&
      bundled(contents.getURL()) &&
      details.isMainFrame &&
      bundled(details.requestingUrl ?? ""),
  );
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const frame = request.frame;
    if (!frame || !request.userGesture || !bundled(frame.url)) {
      callback({});
      return;
    }
    try {
      const window = (() => {
        const contents = webContents.fromFrame(frame);
        return contents ? BrowserWindow.fromWebContents(contents) : null;
      })();
      if (!window || window.isDestroyed()) {
        callback({});
        return;
      }
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 0, height: 0 },
      });
      const english =
        (await window.webContents.executeJavaScript("document.documentElement.lang")) === "en";
      const result = await dialog.showMessageBox(window, {
        type: "question",
        title: english ? "Cord — Screen sharing" : "Cord — Ekran paylaşımı",
        message: english
          ? "Choose a screen or window to share"
          : "Paylaşılacak ekranı veya pencereyi seç",
        buttons: [english ? "Cancel" : "Vazgeç", ...sources.map((source) => source.name)],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      const source = sources[result.response - 1];
      callback(source ? { video: source } : {});
    } catch {
      callback({});
    }
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
