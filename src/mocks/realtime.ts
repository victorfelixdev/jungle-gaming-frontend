import { toSocketIo } from "@mswjs/socket.io-binding";
import { ws } from "msw";
import type { NftUpdatedEvent, OrderUpdatedEvent } from "@/api/realtime";
import { mockState } from "./state";
import { getMockScenario } from "./scenarios";

const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const socketLink = ws.link(`${protocol}//${location.host}/`);
type Connection = ReturnType<typeof toSocketIo>;
const connections = new Map<string, { connection: Connection; userId: string | null }>();
let online = true;

export const realtimeHandler = socketLink.addEventListener("connection", (connection) => {
  if (!online || getMockScenario() === "offline") {
    connection.client.close(1013, "Rede indisponível");
    return;
  }
  const bound = toSocketIo(connection);
  connections.set(connection.client.id, { connection: bound, userId: null });
  bound.client.on("subscribe", (_event, payload: { userId?: string }) => {
    const entry = connections.get(connection.client.id);
    if (entry) entry.userId = payload?.userId && payload.userId === mockState.session()?.user.id ? payload.userId : null;
  });
  connection.client.addEventListener("close", () => connections.delete(connection.client.id));
});

export function setRealtimeOnline(next: boolean) {
  online = next;
  if (!online) disconnectRealtime();
}

export function disconnectRealtime() {
  for (const { connection } of connections.values())
    connection.rawClient.close(1013, "Rede indisponível");
  connections.clear();
}

export function publishNftUpdated(event: NftUpdatedEvent) {
  if (!online || getMockScenario() === "offline") return;
  for (const { connection } of connections.values())
    connection.client.emit("nft.updated", event);
}

export function publishOrderUpdated(event: OrderUpdatedEvent) {
  if (!online || getMockScenario() === "offline") return;
  for (const { connection, userId } of connections.values())
    if (userId === event.userId) connection.client.emit("order.updated", event);
}
