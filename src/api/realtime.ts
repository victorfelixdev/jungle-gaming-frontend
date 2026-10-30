import type { Nft, Order } from "./contracts";

export interface NftUpdatedEvent {
  id: string;
  version: number;
  nft: Nft;
}

export interface OrderUpdatedEvent {
  id: string;
  userId: string;
  version: number;
  order: Order;
}
