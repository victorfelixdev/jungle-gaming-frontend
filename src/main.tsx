import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type {
  NftFeed,
  NftListSearch,
  NftNetwork,
  NftSort,
} from "./api/contracts";
import { requireSession } from "./features/auth/session";
import { RootLayout } from "./routes/layout";
import {
  CartRoute,
  CatalogRoute,
  CheckoutRoute,
  LoginRoute,
  MockControlsRoute,
  NftRoute,
  NotFoundRoute,
  OrderRoute,
  ProfileRoute,
  RegisterRoute,
  WalletsRoute,
} from "./routes/placeholders";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

interface RouterContext {
  queryClient: QueryClient;
}
interface CatalogSearch extends NftListSearch {
  page: number;
  pageSize: number;
  sort: NftSort;
  feed?: NftFeed;
}

const parseCatalogSearch = (raw: Record<string, unknown>): CatalogSearch => ({
  query:
    typeof raw.query === "string" && raw.query.trim()
      ? raw.query.trim()
      : undefined,
  categories: Array.isArray(raw.categories)
    ? raw.categories.filter(
        (value): value is string => typeof value === "string",
      )
    : undefined,
  feed: ["all", "new", "trending"].includes(String(raw.feed))
    ? (raw.feed as NftFeed)
    : "all",
  networks: Array.isArray(raw.networks)
    ? raw.networks.filter(
        (value): value is NftNetwork =>
          value === "ethereum" || value === "polygon" || value === "solana",
      )
    : undefined,
  minPrice:
    Number.isFinite(Number(raw.minPrice)) && Number(raw.minPrice) >= 0
      ? Number(raw.minPrice)
      : undefined,
  maxPrice:
    Number.isFinite(Number(raw.maxPrice)) && Number(raw.maxPrice) >= 0
      ? Number(raw.maxPrice)
      : undefined,
  sort: ["featured", "price-asc", "price-desc", "newest"].includes(
    String(raw.sort),
  )
    ? (raw.sort as NftSort)
    : "featured",
  page:
    Number.isInteger(Number(raw.page)) && Number(raw.page) > 0
      ? Number(raw.page)
      : 1,
  pageSize: 9,
});
const requirePrivateRoute = async ({
  context,
  location,
}: {
  context: RouterContext;
  location: { pathname: string; searchStr: string };
}) => {
  if (await requireSession(context.queryClient)) return;
  throw redirect({ to: "/login", search: { redirect: location.pathname + location.searchStr } });
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundRoute,
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: parseCatalogSearch,
  component: CatalogRoute,
});
const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nft/$nftId",
  component: NftRoute,
});
const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cart",
  component: CartRoute,
});
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (raw) => ({
    redirect: typeof raw.redirect === "string" ? raw.redirect : undefined,
  }),
  component: LoginRoute,
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: (raw) => ({
    redirect: typeof raw.redirect === "string" ? raw.redirect : undefined,
  }),
  component: RegisterRoute,
});
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checkout",
  beforeLoad: requirePrivateRoute,
  component: CheckoutRoute,
});
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/order/$orderId",
  beforeLoad: requirePrivateRoute,
  component: OrderRoute,
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  beforeLoad: requirePrivateRoute,
  component: ProfileRoute,
});
const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wallets",
  beforeLoad: requirePrivateRoute,
  component: WalletsRoute,
});
const mockControlsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mock",
  component: MockControlsRoute,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    nftRoute,
    cartRoute,
    loginRoute,
    registerRoute,
    checkoutRoute,
    orderRoute,
    profileRoute,
    walletsRoute,
    mockControlsRoute,
  ]),
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MSW !== "false") {
    const { enableMocking } = await import("./mocks/browser");
    await enableMocking();
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
