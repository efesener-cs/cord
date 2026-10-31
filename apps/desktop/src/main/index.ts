import { app, BrowserWindow, session } from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";

const rendererPath = fileURLToPath(new URL("../renderer/index.html", import.meta.url));
const rendererUrl = pathToFileURL(rendererPath);

function createWindow(): void {
  const window = new BrowserWindow({
    title: "Cord",
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

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, target) => {
    const destination = new URL(target);
    // Only the bundled renderer and its hash routes belong in this window.
    destination.hash = "";
    if (destination.href !== rendererUrl.href) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  void window.loadFile(rendererPath).catch((error: unknown) => {
    console.error("Unable to load the desktop renderer:", error);
    app.quit();
  });
}

void app.whenReady().then(() => {
  // No native permissions are needed by the UI preview.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
