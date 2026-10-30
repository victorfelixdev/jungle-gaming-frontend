import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Heart, Search } from "lucide-react";
import type { Cart } from "@/api/contracts";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { cartQueryKey, clearPrivateCache, sessionQueryKey, signOut, useSession } from "@/features/auth/session";
import { useGuestCart } from "@/features/cart/local-cart";
import { useEffect, useRef, useState } from "react";
import { AuthForm } from "@/features/auth/auth-form";
import { RealtimeSync } from "@/features/realtime/realtime-sync";

export function RootLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = useLocation({ select: (location) => location.pathname });
  const catalogSearch = useLocation({
    select: (location) => location.pathname === "/" ? location.search : null,
  });
  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [searchOpen]);
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isMarketPage = pathname.startsWith("/nft/") || pathname === "/cart" || pathname === "/checkout";
  const hasMobileCheckoutBar = useLocation({
    select: (location) =>
      location.pathname.startsWith("/nft/") ||
      location.pathname.startsWith("/order/") ||
      location.pathname === "/cart" ||
      location.pathname === "/checkout" ||
      location.pathname === "/login" ||
      location.pathname === "/register",
  });
  const session = useSession();
  useEffect(() => {
    const expire = () => {
      queryClient.setQueryData(sessionQueryKey, null);
      clearPrivateCache(queryClient);
      if (["/checkout", "/profile", "/wallets"].includes(pathname) || pathname.startsWith("/order/")) {
        void navigate({ to: "/login", search: { redirect: window.location.pathname + window.location.search } });
      }
    };
    window.addEventListener("kurio:session-expired", expire);
    return () => window.removeEventListener("kurio:session-expired", expire);
  }, [navigate, pathname, queryClient]);
  useEffect(() => {
    if (!session.data) return;
    const delay = Math.max(0, Date.parse(session.data.expiresAt) - Date.now());
    const timer = window.setTimeout(() => window.dispatchEvent(new Event("kurio:session-expired")), delay);
    return () => window.clearTimeout(timer);
  }, [session.data]);
  const guestCart = useGuestCart();
  const cart = useQuery({
    queryKey: cartQueryKey(session.data?.user.id),
    enabled: Boolean(session.data),
    queryFn: async () => (await apiClient.get<Cart>("/cart")).data,
  });
  const guestItemCount = guestCart.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const serverItemCount =
    cart.data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const itemCount = guestItemCount + serverItemCount;
  return (
    <div className={`min-h-screen bg-[var(--background)] text-[var(--foreground)] md:pb-0 ${isAuthPage ? "pb-0" : "pb-24"}`}>
      <RealtimeSync userId={session.data?.user.id} />
      <header className="hidden bg-[var(--background)] px-6 md:block lg:px-[120px]">
        <nav
          aria-label="Principal"
          className={`mx-auto grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--border)] ${pathname === "/cart" ? "max-w-[1236px]" : "max-w-[1200px]"}`}
        >
          <Link
            to="/"
            search={{ page: 1, pageSize: 9, sort: "featured" }}
            className="w-fit text-xs font-bold tracking-[0.1em]"
          >
            KURIO
          </Link>
          <div className="flex h-full -translate-x-12 items-center gap-9 text-sm">
            <Link
              to="/"
              search={{ page: 1, pageSize: 9, sort: "featured" }}
              className={`relative flex h-full items-center ${isMarketPage ? "" : "font-bold text-[var(--primary)] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[var(--primary)]"}`}
            >
              Início
            </Link>
            <Link
              to="/"
              search={{ page: 1, pageSize: 9, sort: "featured" }}
              className={`relative flex h-full items-center ${isMarketPage ? "font-bold text-[var(--primary)] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[var(--primary)]" : ""}`}
            >
              Mercado
            </Link>
            <span>Criadores</span>
            <span>Aprenda</span>
          </div>
          <div className="flex items-center justify-self-end gap-6">
            <form
              ref={searchRef}
              role="search"
              className="relative size-8"
              onSubmit={(event) => {
                event.preventDefault();
                const query = searchQuery.trim() || undefined;
                setSearchOpen(false);
                void navigate({
                  to: "/",
                  search: {
                    ...(catalogSearch ?? {}),
                    page: 1,
                    pageSize: 9,
                    sort: catalogSearch?.sort ?? "featured",
                    query,
                  },
                }).then(() => {
                  document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  searchButtonRef.current?.focus();
                }
              }}
            >
              <input
                ref={searchInputRef}
                id="header-search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar NFTs"
                aria-label="Buscar NFTs"
                disabled={!searchOpen}
                className={`absolute right-10 top-1/2 h-9 -translate-y-1/2 rounded-md bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)] outline-none transition-[width,opacity] duration-200 placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${searchOpen ? "w-40 border border-[var(--border)] opacity-100 lg:w-52" : "pointer-events-none w-0 border-0 opacity-0"}`}
              />
              <button
                ref={searchButtonRef}
                type="button"
                className="cursor-pointer grid size-8 place-items-center text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                aria-label={searchOpen ? "Buscar" : "Abrir busca"}
                aria-expanded={searchOpen}
                aria-controls="header-search-input"
                onClick={() => {
                  if (searchOpen) {
                    searchRef.current?.requestSubmit();
                  } else {
                    setSearchQuery(typeof catalogSearch?.query === "string" ? catalogSearch.query : "");
                    setSearchOpen(true);
                  }
                }}
              >
                <Search size={20} strokeWidth={1.75} />
              </button>
            </form>
            <Link
              to="/cart"
              className="relative grid size-8 place-items-center text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              aria-label="Abrir carrinho"
            >
              <img src="/assets/figma/cart.svg" alt="" aria-hidden="true" width="20" height="20" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 top-1 grid size-4 place-items-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-[var(--background)]">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
            {session.data && (
              <Link
                to="/profile"
                aria-label="Meu perfil"
                className="grid size-8 place-items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <img src="/assets/figma/user.svg" alt="" width="20" height="20" />
              </Link>
            )}
            {session.data ? (
              <Button
                variant="outline"
                className="cursor-pointer min-h-8 px-2.5 text-sm"
                onClick={() => void signOut(queryClient).then(() => navigate({ to: "/", search: { page: 1, pageSize: 9, sort: "featured" } }))}
              >
                Sair
              </Button>
            ) : (
              <Button
                aria-label="Abrir login"
                className="cursor-pointer min-h-8 gap-1 px-2.5 text-sm font-medium"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
              >
                <img src="/assets/figma/login.svg" alt="" aria-hidden="true" />
                Entrar
              </Button>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
      {authOpen && (
        <div
          className="fixed inset-0 z-50 hidden items-center justify-center bg-[rgb(10_6_4_/_40%)] md:flex"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAuthOpen(false);
          }}
        >
          <AuthForm
            mode={authMode}
            modal
            onClose={() => setAuthOpen(false)}
            onComplete={() => setAuthOpen(false)}
            onModeChange={setAuthMode}
          />
        </div>
      )}
      <nav
        aria-label="Navegação mobile"
        className={`fixed inset-x-0 bottom-0 z-20 h-[135px] md:hidden ${hasMobileCheckoutBar ? "hidden" : ""}`}
      >
        <div className="relative mx-auto size-full max-w-[414px]">
          <img
            src="/assets/figma/bottom-menu.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
          />
          <div className="absolute inset-x-0 bottom-0 h-[95px]">
            <Link
              to="/"
              search={{ page: 1, pageSize: 9, sort: "featured" }}
              className="absolute left-[11.1%] top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              aria-label="Início"
            >
              <Home size={20} fill="#e89b55" stroke="#e89b55" />
            </Link>
            <Link
              to="/login"
              search={{ redirect: undefined }}
              className="absolute left-[28.3%] top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[#cfb28c] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              aria-label="Favoritos"
            >
              <Heart size={20} fill="#cfb28c" stroke="#cfb28c" />
            </Link>
            <div className="absolute left-1/2 top-[-40px] grid size-[78px] -translate-x-1/2 place-items-center">
              <button
                type="button"
                aria-label="Escanear"
                className="grid size-[65px] place-items-center rounded-full bg-[linear-gradient(137deg,rgb(210_138_76_/_40%)_0%,#d28a4c_100%)] shadow-[0_4px_12px_rgb(20_13_10_/_35%)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              >
                <img
                  src="/assets/figma/scan.svg"
                  alt=""
                  width="27"
                  height="24"
                />
              </button>
            </div>
            <Link
              to="/cart"
              className="absolute left-[72.9%] top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[#cfb28c] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              aria-label={`Compras, ${itemCount} ${itemCount === 1 ? "item" : "itens"} no carrinho`}
            >
              <img
                src="/assets/figma/shop.svg"
                alt=""
                aria-hidden="true"
                width="20"
                height="20"
              />
              {itemCount > 0 && (
                <span className="absolute right-0 top-0 grid min-w-4 h-4 place-items-center rounded-full bg-[var(--primary)] px-0.5 text-[10px] font-bold leading-none text-[var(--background)]">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
            <Link
              to={session.data ? "/profile" : "/login"}
              search={session.data ? undefined : { redirect: undefined }}
              className="absolute left-[87.9%] top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[#cfb28c] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              aria-label="Conta"
            >
              <img
                src="/assets/figma/user.svg"
                alt=""
                aria-hidden="true"
                width="20"
                height="20"
              />
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
}
