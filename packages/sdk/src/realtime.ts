import { io } from "socket.io-client";
import {
  messageSchema,
  typingEventSchema,
  presenceSchema,
  type MessageTarget,
  type PublicMessage,
} from "@cord/contracts";
export function createRealtimeClient(options: {
  baseUrl?: string;
  transport: "web" | "native";
  getToken: () => string | null;
  onMessage: (message: PublicMessage) => void;
  onChanged: () => void;
  onPresence: (userIds: string[]) => void;
  onTyping: (payload: ReturnType<typeof typingEventSchema.parse>) => void;
  onStatus: (status: "connected" | "connecting" | "offline") => void;
}) {
  const socket = io(options.baseUrl || undefined, {
    path: "/api/socket.io",
    autoConnect: false,
    auth: (done) =>
      done(
        options.transport === "native"
          ? { client: "native", token: options.getToken() }
          : { client: "web" },
      ),
    withCredentials: options.transport === "web",
  });
  const online = new Set<string>();
  socket.on("connect", () => {
    options.onStatus("connected");
    // HTTP state is resynced after every reconnect to fill missed event gaps.
    options.onChanged();
    socket.emit("presence:list", (payload: unknown) => {
      const result = presenceSchema.safeParse(payload);
      if (result.success) {
        online.clear();
        result.data.userIds.forEach((id) => online.add(id));
        options.onPresence([...online]);
      }
    });
  });
  socket.on("disconnect", (reason) => {
    options.onStatus("offline");
    online.clear();
    options.onPresence([]);
    if (reason === "io server disconnect") options.onChanged();
  });
  socket.on("connect_error", (error) => {
    options.onStatus("offline");
    if (error.message === "UNAUTHORIZED") options.onChanged();
  });
  socket.io.on("reconnect_attempt", () => options.onStatus("connecting"));
  socket.on("message:created", (payload: unknown) => {
    const result = messageSchema.safeParse(payload);
    if (result.success) options.onMessage(result.data);
  });
  socket.on("typing", (payload: unknown) => {
    const result = typingEventSchema.safeParse(payload);
    if (result.success) options.onTyping(result.data);
  });
  socket.on("resources:changed", () => {
    options.onChanged();
    socket.emit("presence:list", (payload: unknown) => {
      const result = presenceSchema.safeParse(payload);
      if (result.success) {
        online.clear();
        result.data.userIds.forEach((id) => online.add(id));
        options.onPresence([...online]);
      }
    });
  });
  socket.on("presence:changed", (payload: unknown) => {
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("userId" in payload) ||
      typeof payload.userId !== "string" ||
      !("online" in payload) ||
      typeof payload.online !== "boolean"
    )
      return;
    if (payload.online) online.add(payload.userId);
    else online.delete(payload.userId);
    options.onPresence([...online]);
  });
  return {
    connect: () => {
      options.onStatus("connecting");
      socket.connect();
    },
    disconnect: () => {
      socket.disconnect();
      socket.removeAllListeners();
    },
    typing: (target: MessageTarget, active: boolean) => {
      if (socket.connected) socket.emit("typing", { target, active });
    },
  };
}
