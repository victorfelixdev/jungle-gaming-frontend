import type {
  Cart,
  Favorite,
  Order,
  Session,
  User,
  Wallet,
} from "@/api/contracts";
import { nfts, users } from "./fixtures";
import { hashPassword, newPasswordSalt } from "./password";
import { getMockScenario } from "./scenarios";

export interface MockUser extends User {
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
}

export interface MockOrder extends Order {
  requestFingerprint: string;
}

interface MockState {
  users: MockUser[];
  nfts: typeof nfts;
  session: Session | null;
  favoritesByUser: Record<string, Favorite[]>;
  cartsByUser: Record<string, Cart>;
  walletsByUser: Record<string, Wallet[]>;
  ordersByUser: Record<string, MockOrder[]>;
}

type StoredMockState = MockState & {
  registeredUsers?: MockState["users"];
};

const storageKey = "kurio:mock-state:v1";

const readStoredState = (): Partial<StoredMockState> => {
  if (typeof localStorage === "undefined") return {};
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};

const initialWallets = (): MockState["walletsByUser"] =>
  Object.fromEntries(
    users.map((user) => [
      user.id,
      [
        {
          id: `wallet-reserve-${user.id}`,
          label: "Reserva",
          address: "nova.kurio.eth",
          network: "polygon" as const,
          isPrimary: false,
        },
        {
          id: `wallet-main-${user.id}`,
          label: "Principal",
          address: "0xA91F...E82C",
          network: "ethereum" as const,
          isPrimary: true,
        },
      ],
    ]),
  );

const initialState = (): MockState => {
  const stored = readStoredState();
  const allUsers: MockUser[] = Array.isArray(stored.users)
    ? stored.users
    : [
        ...structuredClone(users),
        ...(Array.isArray(stored.registeredUsers) ? stored.registeredUsers : []),
      ];
  const session = stored.session;
  const isValidSession =
    session &&
    Date.parse(session.expiresAt) > Date.now() &&
    allUsers.some(({ id }) => id === session.user.id);

  const catalog = stored.nfts ? structuredClone(stored.nfts) : structuredClone(nfts);
  const scenario = getMockScenario();
  if (!stored.nfts && scenario === "empty") catalog.length = 0;
  const featuredEdition = catalog.find(({ id }) => id === "nft-aurora")?.editions.find(({ id }) => id === "ed-aurora");
  if (!stored.nfts && featuredEdition && scenario === "price-changed") featuredEdition.price = "1.49";
  if (!stored.nfts && featuredEdition && scenario === "edition-sold-out") featuredEdition.availableQuantity = 0;
  if (!stored.nfts && featuredEdition && ["price-changed", "edition-sold-out"].includes(scenario)) {
    const featured = catalog.find(({ id }) => id === "nft-aurora");
    if (featured) featured.version += 1;
  }
  return {
    users: allUsers,
    nfts: catalog,
    session: isValidSession ? session : null,
    favoritesByUser: stored.favoritesByUser ?? {},
    cartsByUser: stored.cartsByUser ?? {},
    walletsByUser: { ...initialWallets(), ...stored.walletsByUser },
    ordersByUser: Object.fromEntries(Object.entries(stored.ordersByUser ?? {}).map(([userId, orders]) => [
      userId,
      orders.map((order) => ({
        ...order,
        requestFingerprint: order.requestFingerprint ?? JSON.stringify({ walletId: order.walletId, provider: order.provider, quote: order.quote }),
      })),
    ])),
  };
};

let state = initialState();

const persistState = () => {
  if (typeof localStorage === "undefined") return;
  const stored: StoredMockState = {
    users: state.users.map(({ password: _password, ...user }) => {
      void _password;
      return user;
    }),
    nfts: state.nfts,
    session: state.session,
    favoritesByUser: state.favoritesByUser,
    cartsByUser: state.cartsByUser,
    walletsByUser: state.walletsByUser,
    ordersByUser: state.ordersByUser,
  };
  localStorage.setItem(storageKey, JSON.stringify(stored));
};

const activeSession = () => {
  if (state.session && Date.parse(state.session.expiresAt) <= Date.now()) {
    state.session = null;
    persistState();
  }
  return state.session;
};

export const mockState = {
  get: () => state,
  session: activeSession,
  persist: persistState,
  prepare: async () => {
    for (const user of state.users) {
      if (user.password && !users.some(({ id }) => id === user.id)) {
        user.passwordSalt = newPasswordSalt();
        user.passwordHash = await hashPassword(user.password, user.passwordSalt);
      }
      delete user.password;
    }
    persistState();
  },
  reset: () => {
    if (typeof localStorage !== "undefined") {
      for (const key of Object.keys(localStorage)) {
        if ((key.startsWith("kurio:") && key !== "kurio:mock-scenario") || key.startsWith("favorites:")) {
          localStorage.removeItem(key);
        }
      }
    }
    if (typeof sessionStorage !== "undefined") {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith("kurio:") || key.startsWith("catalog-")) sessionStorage.removeItem(key);
      }
    }
    state = initialState();
    for (const user of state.users) delete user.password;
    persistState();
  },
  requireUser: () => activeSession()?.user ?? null,
  cartFor: (userId: string) =>
    (state.cartsByUser[userId] ??= {
      id: `cart-${userId}`,
      items: [],
      version: 1,
    }),
  favoritesFor: (userId: string) => (state.favoritesByUser[userId] ??= []),
  walletsFor: (userId: string) => (state.walletsByUser[userId] ??= []),
  ordersFor: (userId: string) => (state.ordersByUser[userId] ??= []),
};
