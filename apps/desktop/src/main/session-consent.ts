import { dialog, type BrowserWindow, type MessageBoxOptions } from "electron";

export async function confirmPlaintextSession(
  window: BrowserWindow | null,
  language: unknown,
): Promise<boolean> {
  if (!window || window.isDestroyed()) return false;
  const english = language === "en";
  const options: MessageBoxOptions = {
    type: "warning",
    title: english ? "Cord — Session storage" : "Cord — Oturum saklama",
    message: english
      ? "Secure system storage is unavailable. Save your session without encryption?"
      : "Sistem güvenli depolaması kullanılamıyor. Oturumun şifresiz saklansın mı?",
    detail: english
      ? "Your session token will be saved unencrypted on this computer. Anyone who can read the file can access your account until the session expires or you log out. Your password will not be saved. If you choose Don't save, you will stay signed in until Cord closes."
      : "Oturum anahtarın bu bilgisayarda şifresiz bir dosyaya kaydedilecek. Dosyayı okuyabilen kişiler oturum süresi dolana veya çıkış yapana kadar hesabına erişebilir. Parolan kaydedilmeyecek. Saklama seçeneğiyle yalnızca Cord kapanana kadar giriş yapmış kalırsın.",
    buttons: english
      ? ["Don't save", "Confirm and save unencrypted"]
      : ["Saklama", "Onayla, şifresiz sakla"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  };
  return (await dialog.showMessageBox(window, options)).response === 1;
}
