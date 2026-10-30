export type EthAmount = string;

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type NftSort = "featured" | "price-asc" | "price-desc" | "newest";
export type NftNetwork = "ethereum" | "polygon" | "solana";
export type NftFeed = "all" | "new" | "trending";

export interface NftEdition {
  id: string;
  name: string;
  price: EthAmount;
  availableQuantity: number;
}

export interface Nft {
  id: string;
  slug: string;
  name: string;
  artist: string;
  description: string;
  imageUrl: string;
  category: string;
  network?: NftNetwork;
  isNew?: boolean;
  popularity?: number;
  tags: string[];
  editions: NftEdition[];
  createdAt: string;
  version: number;
}

export interface NftListSearch {
  query?: string;
  categories?: string[];
  feed?: NftFeed;
  networks?: NftNetwork[];
  minPrice?: number;
  maxPrice?: number;
  sort?: NftSort;
  page?: number;
  pageSize?: number;
}

export interface NftFacets {
  categories: Record<string, number>;
  networks: Record<NftNetwork, number>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  username?: string;
  ensName?: string;
  walletNickname?: string;
}

export interface Session {
  user: User;
  expiresAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}
export interface RegisterInput extends Credentials {
  name: string;
}

export interface Favorite {
  nftId: string;
  createdAt: string;
}

export interface CartItem {
  id: string;
  nftId: string;
  editionId: string;
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  version: number;
}

export interface CartItemInput {
  nftId: string;
  editionId: string;
  quantity: number;
}

export interface Quote {
  cartVersion: number;
  subtotal: EthAmount;
  discount: EthAmount;
  networkFee: EthAmount;
  total: EthAmount;
  coupon?: string;
  expiresAt: string;
}

export interface Wallet {
  id: string;
  label: string;
  address: string;
  network: "ethereum" | "polygon";
  isPrimary: boolean;
  displayName?: string;
  profileName?: string;
  secondaryEns?: string;
  walletType?: string;
  referralCode?: string;
  email?: string;
  ensName?: string;
}

export type OrderStatus = "pending" | "confirmed" | "declined";

export interface OrderLineItem {
  id: string;
  nftId: string;
  editionId: string;
  quantity: number;
  nftName: string;
  imageUrl: string;
  editionName: string;
  unitPrice: EthAmount;
  subtotal: EthAmount;
}

export interface Order {
  id: string;
  walletId?: string;
  provider?: string;
  status: OrderStatus;
  transactionId: string;
  items: CartItem[];
  lines?: OrderLineItem[];
  quote: Quote;
  idempotencyKey: string;
  createdAt: string;
  version: number;
}

export interface CreateOrderInput {
  walletId: string;
  provider?: string;
  quote: Quote;
  idempotencyKey: string;
}
