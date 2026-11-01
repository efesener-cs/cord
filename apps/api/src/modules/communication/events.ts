import type { PublicMessage } from "@cord/contracts";
export interface CommunicationEvents {
  message(message: PublicMessage): Promise<void>;
  changed(userIds: string[]): void;
}
export const silentEvents: CommunicationEvents = { message: async () => {}, changed: () => {} };
