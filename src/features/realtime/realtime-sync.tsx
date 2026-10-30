import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import type { Nft, Order, Page } from "@/api/contracts";
import type { NftUpdatedEvent, OrderUpdatedEvent } from "@/api/realtime";
import { orderQueryKey } from "@/features/auth/session";

export function RealtimeSync({ userId }: { userId?: string }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let socket: Socket | undefined;
    let disposed = false;
    const seenNfts = new Map<string, number>();
    const seenOrders = new Map<string, number>();

    const reconcile = () => {
      socket?.emit("subscribe", { userId });
      void queryClient.invalidateQueries({ queryKey: ["nfts"] });
      void queryClient.invalidateQueries({ queryKey: ["nft"] });
      void queryClient.invalidateQueries({ queryKey: ["nft-facets"] });
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: ["cart", userId] });
        void queryClient.invalidateQueries({ queryKey: ["quote", userId] });
        void queryClient.invalidateQueries({ queryKey: ["order", userId] });
      }
    };

    const onNftUpdated = (event: NftUpdatedEvent) => {
      if (!event || event.nft?.id !== event.id || !Number.isInteger(event.version) || event.nft.version !== event.version) return;
      if ((seenNfts.get(event.id) ?? 0) >= event.version) return;
      const newestCachedVersion = Math.max(0, ...queryClient.getQueriesData<Nft>({ queryKey: ["nft"] })
        .map(([, nft]) => nft?.id === event.id ? nft.version : 0));
      if (newestCachedVersion >= event.version) return;
      seenNfts.set(event.id, event.version);
      void (async () => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: ["nfts"] }),
          queryClient.cancelQueries({ queryKey: ["nft"] }),
        ]);
        queryClient.setQueriesData<Nft>({ queryKey: ["nft"] }, (old) =>
          old?.id === event.id && old.version < event.version ? event.nft : old);
        queryClient.setQueriesData<Page<Nft>>({ queryKey: ["nfts"] }, (old) => {
          if (!old?.items.some((nft) => nft.id === event.id && nft.version < event.version)) return old;
          return { ...old, items: old.items.map((nft) => nft.id === event.id && nft.version < event.version ? event.nft : nft) };
        });
        if (userId) void queryClient.invalidateQueries({ queryKey: ["quote", userId] });
        window.dispatchEvent(new CustomEvent("kurio:nft-updated", { detail: { id: event.id, version: event.version } }));
      })();
    };

    const onOrderUpdated = (event: OrderUpdatedEvent) => {
      if (!userId || event?.userId !== userId || event.order?.id !== event.id ||
          !Number.isInteger(event.version) || event.order.version !== event.version) return;
      if ((seenOrders.get(event.id) ?? 0) >= event.version) return;
      const key = orderQueryKey(userId, event.id);
      const current = queryClient.getQueryData<Order>(key);
      if (current && current.version >= event.version) return;
      seenOrders.set(event.id, event.version);
      queryClient.setQueryData<Order>(key, event.order);
      if (event.order.status === "confirmed") {
        void queryClient.invalidateQueries({ queryKey: ["cart", userId] });
        void queryClient.invalidateQueries({ queryKey: ["quote", userId] });
      }
    };

    // Engine.IO captures WebSocket when imported. Load it after MSW starts.
    void import("socket.io-client").then(({ io }) => {
      if (disposed) return;
      socket = io(window.location.origin, {
        path: "/socket.io",
        transports: ["websocket"],
        reconnectionDelay: 400,
        reconnectionDelayMax: 2_000,
        autoConnect: false,
      });
      socket.on("connect", reconcile);
      socket.on("nft.updated", onNftUpdated);
      socket.on("order.updated", onOrderUpdated);
      socket.connect();
    });
    return () => {
      disposed = true;
      socket?.off("connect", reconcile);
      socket?.off("nft.updated", onNftUpdated);
      socket?.off("order.updated", onOrderUpdated);
      socket?.disconnect();
    };
  }, [queryClient, userId]);

  return null;
}
