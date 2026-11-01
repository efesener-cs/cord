import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const showMessageBox = vi.hoisted(() => vi.fn());
vi.mock("electron", () => ({ dialog: { showMessageBox } }));
import { confirmPlaintextSession } from "../src/main/session-consent.js";
import type { BrowserWindow } from "electron";

const window = { isDestroyed: () => false } as BrowserWindow;
beforeEach(() => showMessageBox.mockReset());

describe("plaintext session consent", () => {
  it("defaults to refusing storage and treats dismissal as refusal", async () => {
    showMessageBox.mockResolvedValue({ response: 0 });
    expect(await confirmPlaintextSession(window, "tr")).toBe(false);
    expect(showMessageBox).toHaveBeenCalledWith(window, expect.objectContaining({
      type: "warning", defaultId: 0, cancelId: 0,
      buttons: ["Saklama", "Onayla, şifresiz sakla"],
    }));
  });
  it("accepts only the explicit confirmation and follows the selected language", async () => {
    showMessageBox.mockResolvedValue({ response: 1 });
    expect(await confirmPlaintextSession(window, "en")).toBe(true);
    expect(showMessageBox).toHaveBeenCalledWith(window, expect.objectContaining({
      buttons: ["Don't save", "Confirm and save unencrypted"],
    }));
  });
  it("refuses storage if the requesting window is gone", async () => {
    expect(await confirmPlaintextSession(null, "tr")).toBe(false);
    expect(await confirmPlaintextSession({ isDestroyed: () => true } as BrowserWindow, "tr")).toBe(false);
    expect(showMessageBox).not.toHaveBeenCalled();
  });
});
