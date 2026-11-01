import type { PublicAttachment } from "@cord/contracts";
let save: ((file: PublicAttachment, blob: Blob) => Promise<void>) | undefined;
export function configureDownloads(adapter: (file: PublicAttachment, blob: Blob) => Promise<void>) {
  save = adapter;
}
export async function saveNativeDownload(file: PublicAttachment, blob: Blob): Promise<boolean> {
  if (!save) return false;
  await save(file, blob);
  return true;
}
