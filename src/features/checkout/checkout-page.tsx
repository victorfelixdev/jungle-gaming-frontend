import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MoreVertical, Wallet as WalletIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Cart, CreateOrderInput, Order, Quote, Wallet } from "@/api/contracts";
import { apiClient } from "@/api/client";
import { getApiError } from "@/api/error";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/input";
import { nftQueryOptions } from "@/api/nfts";
import { HomeFooter } from "@/features/catalog/home-footer";
import { cartQueryKey, quoteQueryKey, useSession, walletsQueryKey } from "@/features/auth/session";
import { clearPendingOrder, readPendingOrder, savePendingOrder } from "./pending-order";

export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const [coupon, setCoupon] = useState(
    () => sessionStorage.getItem("kurio:checkout-coupon") ?? "",
  );
  const [walletId, setWalletId] = useState("");
  const [provider, setProvider] = useState("Coinbase Wallet");
  const [ensSuffix, setEnsSuffix] = useState(".eth");
  const [promoOpen, setPromoOpen] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState("");
  const [marketChanged, setMarketChanged] = useState(false);
  const recoveryStarted = useRef<string | null>(null);
  const cart = useQuery({
    queryKey: cartQueryKey(session.data?.user.id),
    enabled: Boolean(session.data),
    queryFn: async () => (await apiClient.get<Cart>("/cart")).data,
  });
  const nftQueries = useQueries({
    queries: (cart.data?.items ?? []).map((item) => nftQueryOptions(item.nftId)),
  });
  const orderItems = (cart.data?.items ?? []).flatMap((item, index) => {
    const nft = nftQueries[index]?.data;
    const edition = nft?.editions.find(({ id }) => id === item.editionId);
    return nft && edition ? [{ item, nft, edition }] : [];
  });
  const wallets = useQuery({
    queryKey: walletsQueryKey(session.data?.user.id),
    enabled: Boolean(session.data),
    queryFn: async () => (await apiClient.get<Wallet[]>("/wallets")).data,
  });
  const selectedWalletId = walletId || wallets.data?.[0]?.id || "";
  const selectedWallet = wallets.data?.find(({ id }) => id === selectedWalletId);
  const quote = useQuery({
    queryKey: quoteQueryKey(session.data?.user.id, coupon, cart.data?.version),
    enabled: Boolean(cart.data?.items.length),
    queryFn: async () =>
      (await apiClient.post<Quote>("/quotes", { coupon: coupon || undefined }))
        .data,
  });
  useEffect(() => {
    const onNftUpdated = (event: Event) => {
      const { id } = (event as CustomEvent<{ id: string }>).detail;
      if (cart.data?.items.some((item) => item.nftId === id)) setMarketChanged(true);
    };
    window.addEventListener("kurio:nft-updated", onNftUpdated);
    return () => window.removeEventListener("kurio:nft-updated", onNftUpdated);
  }, [cart.data?.items]);
  const reviewMarketChange = async () => {
    await Promise.all([cart.refetch(), quote.refetch()]);
    setMarketChanged(false);
  };
  const createWallet = useMutation({
    mutationFn: async (details?: { address: string; network: "ethereum" | "polygon" }) =>
      (
        await apiClient.post<Wallet>("/wallets", {
          label: "Carteira principal",
          address: details?.address ?? "0x71A3f0e5c20aB13d4E5F7890123456789aBcDeF0",
          network: details?.network ?? "ethereum",
          isPrimary: true,
        })
      ).data,
    onSuccess: (wallet) => {
      setWalletId(wallet.id);
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
  const order = useMutation({
    mutationFn: async (walletOverride?: string) => {
      const userId = session.data?.user.id;
      if (!userId) throw new Error("Sessão indisponível.");
      const pendingOrder = readPendingOrder(userId);
      if (pendingOrder)
        return (await apiClient.post<Order>("/orders", pendingOrder)).data;
      if (marketChanged) throw new Error("Revise a cotação atualizada antes de confirmar.");
      if (!quote.data) throw new Error("Cotação indisponível.");
      const currentQuote = Date.parse(quote.data.expiresAt) <= Date.now()
        ? (await apiClient.post<Quote>("/quotes", { coupon: coupon || undefined })).data
        : quote.data;
      if (currentQuote.total !== quote.data.total || currentQuote.subtotal !== quote.data.subtotal ||
          currentQuote.discount !== quote.data.discount || currentQuote.networkFee !== quote.data.networkFee ||
          currentQuote.cartVersion !== quote.data.cartVersion) {
        queryClient.setQueryData(quoteQueryKey(userId, coupon, cart.data?.version), currentQuote);
        throw new Error("QUOTE_CHANGED");
      }
      const currentWalletId = walletOverride ?? selectedWalletId;
      const input: CreateOrderInput = {
        walletId: currentWalletId,
        provider,
        quote: currentQuote,
        idempotencyKey: crypto.randomUUID(),
      };
      savePendingOrder(userId, input);
      return (await apiClient.post<Order>("/orders", input)).data;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      if (session.data) clearPendingOrder(session.data.user.id);
      if (created.status === "declined") {
        setOrderFeedback("Pagamento recusado. Seu carrinho foi preservado; escolha outra carteira ou tente novamente.");
        return;
      }
      setOrderFeedback("");
      void navigate({ to: "/order/$orderId", params: { orderId: created.id } });
    },
    onError: (reason) => {
      const apiError = getApiError(reason);
      if (apiError.code === "STALE_QUOTE" || (reason instanceof Error && reason.message === "QUOTE_CHANGED")) {
        if (session.data) clearPendingOrder(session.data.user.id);
        void queryClient.invalidateQueries({ queryKey: ["quote"] });
        void queryClient.invalidateQueries({ queryKey: ["nft"] });
        setOrderFeedback("A cotação mudou. Revise o valor atualizado antes de confirmar novamente.");
      } else if (apiError.code === "WALLET_DISCONNECTED") {
        if (session.data) clearPendingOrder(session.data.user.id);
        setOrderFeedback(apiError.message);
      } else {
        setOrderFeedback("Não foi possível confirmar o resultado. Tente novamente para recuperar esta compra.");
      }
    },
  });
  const recoverMutation = order.mutate;
  useEffect(() => {
    const userId = session.data?.user.id;
    if (!userId || recoveryStarted.current === userId || !readPendingOrder(userId)) return;
    recoveryStarted.current = userId;
    recoverMutation();
  }, [session.data?.user.id, recoverMutation]);
  const error = quote.error ?? order.error ?? createWallet.error;
  const checkoutLoadError = cart.error ?? wallets.error ?? nftQueries.find((query) => query.error)?.error;
  const checkoutLoading = cart.isPending || wallets.isPending || nftQueries.some((query) => query.isPending);
  const submitDesktop = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quote.data || marketChanged || order.isPending || createWallet.isPending) return;
    const profile = Object.fromEntries(new FormData(event.currentTarget));
    localStorage.setItem("kurio:collector-profile", JSON.stringify(profile));
    try {
      const address = String(profile.walletAddress).trim();
      const network = profile.network === "polygon" ? "polygon" : "ethereum";
      const reuseWallet =
        !profile.useOtherWallet &&
        selectedWallet?.address.toLowerCase() === address.toLowerCase() &&
        selectedWallet.network === network;
      const currentWalletId =
        (reuseWallet ? selectedWalletId : "") ||
        (await createWallet.mutateAsync({
          address,
          network,
        })).id;
      order.mutate(currentWalletId);
    } catch {
      // A mensagem da mutação de carteira é exibida abaixo do resumo.
    }
  };
  if (checkoutLoadError)
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-12 md:px-0">
        <h1 className="text-xl font-bold">Não foi possível carregar o pagamento.</h1>
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{getApiError(checkoutLoadError).message}</p>
        <Button className="mt-5" onClick={() => {
          void cart.refetch();
          void wallets.refetch();
          nftQueries.forEach((query) => { void query.refetch(); });
        }}>Tentar novamente</Button>
      </main>
    );
  if (session.data && readPendingOrder(session.data.user.id) && !cart.data?.items.length)
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-16">
        <h1 className="text-xl font-bold">Recuperando sua compra</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">A consulta usa a mesma tentativa de pedido para evitar cobrança duplicada.</p>
        {orderFeedback && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{orderFeedback}</p>}
        <Button className="mt-5" disabled={order.isPending} onClick={() => order.mutate()}>
          {order.isPending ? "Consultando pedido..." : "Tentar novamente"}
        </Button>
      </main>
    );
  return (
    <main className="min-h-dvh bg-[var(--background)] md:mx-auto md:max-w-[1200px] md:px-0 md:pb-0 md:pt-10">
      <section className="min-h-dvh px-6 pb-28 pt-5 md:hidden">
        <header className="relative flex h-12 items-center justify-center">
          <button
            type="button"
            aria-label="Voltar ao carrinho"
            onClick={() => void navigate({ to: "/cart" })}
            className="absolute left-0 grid size-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-card)] text-[var(--muted-foreground)]"
          >
            <ArrowLeft size={17} />
          </button>
          <h1 className="text-sm font-bold">Pagamento com carteira</h1>
        </header>
        {checkoutLoading ? (
          <p className="mt-8 text-sm text-[var(--muted-foreground)]">
            Carregando checkout...
          </p>
        ) : !cart.data?.items.length ? (
          <p className="mt-8 text-sm">
            Seu carrinho está vazio.{" "}
            <Link
              to="/"
              search={{ page: 1, pageSize: 9, sort: "featured" }}
              className="text-[var(--accent)]"
            >
              Explorar NFTs
            </Link>
          </p>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between text-xs font-bold">
              <h2>Carteira conectada</h2>
              <button
                type="button"
                onClick={() => {
                  const list = wallets.data ?? [];
                  const index = list.findIndex(
                    ({ id }) => id === selectedWalletId,
                  );
                  if (list.length > 1)
                    setWalletId(list[(index + 1) % list.length].id);
                }}
                className="text-[var(--accent)]"
              >
                Trocar carteira
              </button>
            </div>
            <div
              className="mt-3 grid gap-3"
              role="radiogroup"
              aria-label="Selecionar carteira"
            >
              {wallets.data?.length ? (
                wallets.data.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedWalletId === wallet.id}
                    onClick={() => setWalletId(wallet.id)}
                    className="flex min-h-[68px] w-full items-center gap-3 rounded-xl bg-[var(--surface-card)] px-4 text-left"
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded-full border ${selectedWalletId === wallet.id ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                    >
                      {selectedWalletId === wallet.id && (
                        <span className="size-2 rounded-full bg-[var(--accent)]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-xs">{wallet.label}</strong>
                      <small className="block truncate text-[11px] text-[var(--muted-foreground)]">
                        {wallet.address}
                      </small>
                      <small className="block text-[11px] text-[var(--muted-foreground)]">
                        {wallet.network === "polygon"
                          ? "Rede Polygon"
                          : "Rede principal Ethereum"}
                      </small>
                    </span>
                    <MoreVertical
                      size={16}
                      className="text-[var(--muted-foreground)]"
                    />
                  </button>
                ))
              ) : (
                <Button
                  onClick={() => createWallet.mutate()}
                  disabled={createWallet.isPending}
                >
                  Conectar carteira simulada
                </Button>
              )}
            </div>
            <h2 className="mt-5 text-xs font-bold">Carteira e rede</h2>
            <div
              className="mt-3 grid gap-3"
              role="radiogroup"
              aria-label="Provedor da carteira"
            >
              {["WalletConnect", "MetaMask", "Coinbase Wallet"].map((name) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={provider === name}
                  onClick={() => setProvider(name)}
                  className="flex h-12 w-full items-center gap-3 rounded-xl bg-[var(--surface-card)] px-3 text-left"
                >
                  <span className="grid size-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-xs font-bold text-[var(--accent)]">
                    {name === "Coinbase Wallet" ? (
                      <WalletIcon size={16} />
                    ) : (
                      name[0]
                    )}
                  </span>
                  <span className="flex-1 text-xs">{name}</span>
                  <span
                    className={`grid size-4 place-items-center rounded-full border ${provider === name ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                  >
                    {provider === name && (
                      <span className="size-2 rounded-full bg-[var(--accent)]" />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-5 flex justify-end gap-5 text-sm font-bold">
              Total:{" "}
              <span className="text-[var(--accent)]">
                {quote.data?.total ?? "—"} ETH
              </span>
            </p>
            {(error || orderFeedback) && (
              <p role="alert" className="mt-4 text-xs text-[var(--danger)]">
                {orderFeedback || getApiError(error).message}
              </p>
            )}
            {marketChanged && <p role="alert" className="mt-3 text-xs text-[var(--accent)]">Preço ou disponibilidade alterados. <button type="button" className="underline" onClick={() => void reviewMarketChange()}>Revisar cotação</button></p>}
            <div className="fixed inset-x-0 bottom-0 z-30 bg-[var(--background)] px-6 pb-6 pt-4">
              <button
                type="button"
                disabled={!selectedWalletId || !quote.data || marketChanged || order.isPending}
                onClick={() => order.mutate()}
                className="h-12 w-full rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--background)] disabled:opacity-50"
              >
                {order.isPending ? "Enviando pedido..." : "Confirmar compra"}
              </button>
            </div>
          </>
        )}
      </section>
      <div className="hidden px-6 md:block md:px-0">
        <p className="text-xs font-bold">Início / Mercado / Pagamento</p>
        {checkoutLoading ? (
          <p className="mt-8 text-[var(--muted-foreground)]">
            Carregando checkout...
          </p>
        ) : !cart.data?.items.length ? (
          <p className="mt-8">
            Seu carrinho está vazio.{" "}
            <Link
              className="text-[var(--accent)]"
              to="/"
              search={{ page: 1, pageSize: 9, sort: "featured" }}
            >
              Explorar NFTs
            </Link>
          </p>
        ) : (
          <section className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(330px,0.9fr)]">
            <form id="desktop-checkout-form" onSubmit={(event) => void submitDesktop(event)}>
              <h1 className="text-sm font-bold">Perfil do colecionador</h1>
              <div className="mt-4 grid gap-x-5 gap-y-4 lg:grid-cols-2">
                <label className="grid gap-1.5 text-xs">
                  <span>Nome de exibição <span className="text-[var(--accent)]">*</span></span>
                  <Input name="displayName" required className="min-h-9 rounded-sm bg-transparent text-xs" />
                </label>
                <label className="grid gap-1.5 text-xs">
                  <span>Nome de usuário <span className="text-[var(--accent)]">*</span></span>
                  <Input name="username" required className="min-h-9 rounded-sm bg-transparent text-xs" />
                </label>
                <label className="grid gap-1.5 text-xs">
                  <span>Rede <span className="text-[var(--accent)]">*</span></span>
                  <select name="network" required defaultValue="" className="min-h-9 rounded-sm border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--muted-foreground)] focus-visible:border-[var(--accent)]">
                    <option value="" disabled>Selecione uma rede</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="polygon">Polygon</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs">
                  <span>Nome do perfil <span className="text-[var(--accent)]">*</span></span>
                  <Input name="profileName" required className="min-h-9 rounded-sm bg-transparent text-xs" />
                </label>
                <label className="grid gap-1.5 text-xs">
                  <span>Endereço da carteira <span className="text-[var(--accent)]">*</span></span>
                  <Input name="walletAddress" placeholder="Endereço 0x da carteira" defaultValue={selectedWallet?.address} required className="min-h-9 rounded-sm bg-transparent text-xs" />
                </label>
                <label className="grid gap-1.5 text-xs">
                  <span>Carteira secundária (opcional)</span>
                  <Input name="secondaryWallet" placeholder="ENS ou carteira secundária (opcional)" className="min-h-9 rounded-sm bg-transparent text-xs" />
                </label>
                <label className="grid gap-1.5 text-xs">
                  <span>Tipo de carteira <span className="text-[var(--accent)]">*</span></span>
                  <select name="walletType" required defaultValue="" className="min-h-9 rounded-sm border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--muted-foreground)] focus-visible:border-[var(--accent)]">
                    <option value="" disabled>Selecione uma carteira</option>
                    <option value="metamask">MetaMask</option>
                    <option value="walletconnect">WalletConnect</option>
                    <option value="coinbase">Coinbase Wallet</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs">
                  <span>Código de indicação (opcional)</span>
                  <Input name="referralCode" className="min-h-9 rounded-sm bg-transparent text-xs" />
                </label>
                <label className="grid gap-1.5 text-xs">
                  <span>E-mail <span className="text-[var(--accent)]">*</span></span>
                  <Input name="email" type="email" required className="min-h-9 rounded-sm bg-transparent text-xs" />
                </label>
                <div className="grid gap-1.5 text-xs">
                  <span>Nome ENS</span>
                  <DropdownSelect
                    name="ensSuffix"
                    value={ensSuffix}
                    onChange={setEnsSuffix}
                    options={[{ label: ".eth", value: ".eth" }, { label: ".crypto", value: ".crypto" }]}
                    ariaLabel="Sufixo ENS"
                    className="w-fit"
                    triggerClassName="min-h-9 min-w-[90px] rounded-sm border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                  />
                </div>
              </div>
              <label className="mt-5 flex cursor-pointer items-center gap-2 text-xs">
                <input name="useOtherWallet" type="checkbox" className="checkout-wallet-checkbox" />
                Usar outra carteira?
              </label>
              <label className="mt-5 grid max-w-[340px] gap-1.5 text-xs">
                Observação do colecionador (opcional)
                <textarea name="collectorNote" rows={6} className="resize-y rounded-sm border border-[var(--border)] bg-transparent p-3 text-xs outline-none focus-visible:border-[var(--accent)]" />
              </label>
            </form>
            <aside className="min-w-0">
              <h2 className="text-sm font-bold">Seus NFTs</h2>
              <div className="mt-3 flex justify-between border-b border-[var(--border)] pb-2 text-xs font-bold">
                <span>NFTs</span><span>Subtotal</span>
              </div>
              <div className="mt-2 grid gap-2">
                {orderItems.map(({ item, nft, edition }) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-sm bg-[var(--surface-card)] p-1.5">
                    <img src={nft.imageUrl} alt="" className="size-12 shrink-0 rounded-sm object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{nft.name}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">ID do token: {nft.name.match(/#\w+/)?.[0] ?? nft.id}</p>
                    </div>
                    <span className="shrink-0 text-[10px]">(× {item.quantity})</span>
                    <strong className="shrink-0 text-xs text-[var(--accent)]">{(Number(edition.price) * item.quantity).toFixed(2)} ETH</strong>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setPromoOpen((open) => !open)} className="cursor-pointer mt-3 text-xs hover:text-[var(--accent)]">Tem um código promocional? Aplique aqui</button>
              {promoOpen && (
                <form className="mt-2 flex gap-2" onSubmit={(event) => {
                  event.preventDefault();
                  setCoupon(new FormData(event.currentTarget).get("coupon")?.toString().trim().toUpperCase() ?? "");
                }}>
                  <Input name="coupon" placeholder="Código promocional" defaultValue={coupon} className="min-h-9 bg-transparent text-xs" />
                  <Button type="submit" className="min-h-9 text-xs">Aplicar</Button>
                </form>
              )}
              {quote.data ? (
                <div className="mt-3 grid gap-2 text-xs">
                  <Line label="Subtotal" value={quote.data.subtotal} />
                  <Line label="Desconto do lançamento" value={`(-) ${quote.data.discount}`} />
                  <Line label="Taxa de rede" value={quote.data.networkFee} />
                  <p className="text-right text-[10px] text-[var(--accent)]">Taxa estimada</p>
                  <div className="flex justify-between border-t border-[var(--border)] pt-2 font-bold">
                    <span>Total</span><span className="text-sm text-[var(--accent)]">{quote.data.total} ETH</span>
                  </div>
                </div>
              ) : <p className="mt-3 text-xs text-[var(--muted-foreground)]">Calculando cotação...</p>}
              <h2 className="mt-3 text-center text-sm font-bold">Carteira e rede</h2>
              <div className="mt-3 grid gap-3" role="radiogroup" aria-label="Provedor da carteira">
                {["WalletConnect", "MetaMask", "Coinbase Wallet"].map((name) => (
                  <button key={name} type="button" role="radio" aria-checked={provider === name} onClick={() => setProvider(name)} className={`flex min-h-10 items-center gap-2 rounded-sm border px-3 text-left text-xs ${provider === name ? "border-[var(--primary)]" : "border-[var(--border)]"}`}>
                    <span className={`grid size-3.5 place-items-center rounded-full border ${provider === name ? "border-[var(--primary)]" : "border-[var(--muted-foreground)]"}`}>{provider === name && <span className="size-2 rounded-full bg-[var(--primary)]" />}</span>
                    {name === "WalletConnect" ? <span className="rounded bg-[var(--surface)] px-2 py-1 text-[9px] text-[var(--accent)]">METAMASK · WALLETCONNECT · COINBASE</span> : name}
                  </button>
                ))}
              </div>
              {marketChanged && <p role="alert" className="mt-3 text-xs text-[var(--accent)]">Preço ou disponibilidade alterados. <button type="button" className="underline" onClick={() => void reviewMarketChange()}>Revisar cotação</button></p>}
              <Button type="submit" form="desktop-checkout-form" disabled={!quote.data || marketChanged || order.isPending || createWallet.isPending} className="mt-4 w-full text-xs">
                {order.isPending || createWallet.isPending ? "Enviando pedido..." : "Confirmar compra"}
              </Button>
              {(error || orderFeedback) && <p role="alert" className="mt-3 text-xs text-[var(--danger)]">{orderFeedback || getApiError(error).message}</p>}
            </aside>
          </section>
        )}
        <HomeFooter
          onSelectCategory={(category) =>
            void navigate({
              to: "/",
              search: {
                page: 1,
                pageSize: 9,
                sort: "featured",
                categories: [category],
              },
            })
          }
        />
      </div>
    </main>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span>{value} ETH</span>
    </div>
  );
}
