export interface ScreenShareAdapter {
  start(url: string, token: string): Promise<void>;
  stop(): Promise<void>;
  listen(listener: (active: boolean) => void): Promise<() => void>;
}
let adapter: ScreenShareAdapter | undefined;
export function configureScreenSharing(value: ScreenShareAdapter) {
  adapter = value;
}
export const nativeScreenSharing = () => adapter;
