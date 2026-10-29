import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { Cart, Quote } from "@/api/contracts";
import { apiClient } from "@/api/client";
import { getApiError } from "@/api/error";
import { nftsQueryOptions } from "@/api/nfts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeFooter } from "@/features/catalog/home-footer";
import { RelatedNfts } from "@/features/catalog/related-nfts";
import { cartQueryKey, quoteQueryKey, useSession } from "@/features/auth/session";
import {
  removeGuestCartItem,
  updateGuestCartItem,
  useGuestCart,
} from "./local-cart";

const toWei = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 10n ** 18n +
    BigInt((fraction + "0".repeat(18)).slice(0, 18))
  );
};
const fromWei = (value: bigint) => {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
};

export function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [couponInput, setCouponInput] = useState(() => sessionStorage.getItem("kurio:checkout-coupon") ?? "");
  const [coupon, setCoupon] = useState(() => sessionStorage.getItem("kurio:checkout-coupon") ?? "");
  const [couponError, setCouponError] = useState("");
  const guestItems = useGuestCart();
  const session = useSession();
  const remoteCart = useQuery({
    queryKey: cartQueryKey(session.data?.user.id),
    enabled: Boolean(session.data),
    queryFn: async () => (await apiClient.get<Cart>("/cart")).data,
  });
  const quote = useQuery({
    queryKey: quoteQueryKey(session.data?.user.id, coupon, remoteCart.data?.version),
    enabled: Boolean(session.data && remoteCart.data?.items.length),
    queryFn: async () => (await apiClient.post<Quote>("/quotes", { coupon: coupon || undefined })).data,
  });
  const remoteItems = remoteCart.data?.items ?? [];
  const remoteIds = new Set(remoteItems.map(({ id }) => id));
  const items = session.data
    ? [...remoteItems, ...guestItems.filter(({ id }) => !remoteIds.has(id))]
    : guestItems;
  const cartItemMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity?: number }) => {
      if (session.data && remoteIds.has(id)) {
        if (quantity === undefined) await apiClient.delete(`/cart/items/${id}`);
        else await apiClient.patch(`/cart/items/${id}`, { quantity });
      } else if (quantity === undefined) {
        removeGuestCartItem(id);
      } else {
        updateGuestCartItem(id, quantity);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["quote"] });
    },
  });
  const nfts = useQuery(
    nftsQueryOptions({ page: 1, pageSize: 24, sort: "featured" }),
  );
  if (nfts.isPending || session.isPending || (session.data && remoteCart.isPending))
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-12 md:px-0">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-6 h-72 w-full" />
      </main>
    );
  const rows = items.flatMap((item) => {
    const nft = nfts.data?.items.find(({ id }) => id === item.nftId);
    const edition = nft?.editions.find(({ id }) => id === item.editionId);
    return nft && edition ? [{ item, nft, edition }] : [];
  });
  const subtotal = rows.reduce(
    (total, { item, edition }) =>
      total + toWei(edition.price) * BigInt(item.quantity),
    0n,
  );
  const discount = coupon === "JUNGLE10" ? subtotal / 10n : 0n;
  const discountLabel = discount === 0n ? "00.00" : `${fromWei(discount)} ETH`;
  const networkFee = rows.length > 0 ? 16n * 10n ** 15n : 0n;
  const total = subtotal - discount + networkFee;
  const displaySubtotal = session.data ? quote.data?.subtotal ?? "—" : fromWei(subtotal);
  const displayDiscount = session.data ? quote.data?.discount ?? "—" : fromWei(discount);
  const displayNetworkFee = session.data ? quote.data?.networkFee ?? "—" : fromWei(networkFee);
  const displayTotal = session.data ? quote.data?.total ?? "—" : fromWei(total);
  const canCheckout = !session.data || Boolean(quote.data && !quote.isError);
  const applyCoupon = async () => {
    const next = couponInput.trim().toUpperCase();
    if (session.data) {
      try {
        const validated = (await apiClient.post<Quote>("/quotes", { coupon: next || undefined })).data;
        queryClient.setQueryData(quoteQueryKey(session.data.user.id, next, remoteCart.data?.version), validated);
      } catch (reason) {
        setCouponError(getApiError(reason).message);
        return;
      }
    } else if (next && next !== "JUNGLE10") {
      setCouponError("Cupom inválido ou expirado.");
      return;
    }
    setCouponError("");
    setCoupon(next);
    sessionStorage.setItem("kurio:checkout-coupon", next);
  };
  return (
    <main className="min-h-dvh bg-[var(--background)] md:mx-auto md:max-w-[1236px] md:px-0 md:pb-0 md:pt-8">
      <div className="px-6 pb-[310px] pt-6 md:hidden">
        <div className="relative flex h-12 items-center justify-center">
          <button
            type="button"
            onClick={() =>
              window.history.length > 1
                ? window.history.back()
                : void navigate({
                    to: "/",
                    search: { page: 1, pageSize: 9, sort: "featured" },
                  })
            }
            aria-label="Voltar"
            className="cursor-pointer absolute left-0 grid size-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-card)] text-[var(--muted-foreground)]"
          >
            <img
              src="/assets/figma/arrow-left-2.svg"
              alt=""
              width="8"
              height="14"
            />
          </button>
          <h1 className="text-base font-bold">Carrinho de NFTs</h1>
        </div>
        {cartItemMutation.error && (
          <p role="alert" className="mt-3 text-xs text-[var(--danger)]">
            {getApiError(cartItemMutation.error).message}
          </p>
        )}
        {rows.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="mt-5 grid gap-4">
            {rows.map(({ item, nft, edition }) => (
              <article
                key={item.id}
                className="flex min-h-[86px] overflow-hidden rounded-xl bg-[var(--surface-card)] shadow-[0_4px_12px_rgb(10_6_4_/_25%)]"
              >
                <Link
                  to="/nft/$nftId"
                  params={{ nftId: nft.slug }}
                  className="w-[86px] shrink-0"
                >
                  <img
                    src={nft.imageUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1 px-2 py-2.5">
                  <Link
                    to="/nft/$nftId"
                    params={{ nftId: nft.slug }}
                    className="block truncate text-xs font-bold"
                  >
                    {nft.name}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                    Edição: {edition.name}
                  </p>
                  <p className="mt-2 text-sm font-bold text-[var(--accent)]">
                    {fromWei(toWei(edition.price) * BigInt(item.quantity))} ETH
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between py-2.5 pr-2">
                  <button
                    type="button"
                    onClick={() => cartItemMutation.mutate({ id: item.id })}
                    disabled={cartItemMutation.isPending}
                    aria-label={`Remover ${nft.name}`}
                    className="cursor-pointer grid size-6 place-items-center text-[var(--muted-foreground)]"
                  >
                    <img src="/assets/figma/delete.svg" alt="" width="24" height="24" />
                  </button>
                  <Quantity
                    item={item}
                    max={edition.availableQuantity}
                    compact
                    disabled={cartItemMutation.isPending}
                    onChange={(quantity) => cartItemMutation.mutate({ id: item.id, quantity })}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <aside className="fixed inset-x-0 bottom-0 z-30 rounded-t-[30px] bg-[var(--surface-card)] px-5 pb-7 pt-5 shadow-[0_0_20px_0_rgb(10_6_4_/_45%)] md:hidden">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void applyCoupon();
            }}
            className="flex h-11 items-center rounded-full border border-[var(--border)] shadow-[0_6px_20px_0_rgb(10_6_4_/_45%)]"
          >
            <input
              value={couponInput}
              onChange={(event) => setCouponInput(event.target.value)}
              aria-label="Código promocional"
              placeholder="Digite o código promocional..."
              className="min-w-0 flex-1 bg-transparent px-3 text-[10px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
            />
            <button
              type="submit"
              className="cursor-pointer h-11 rounded-full bg-[var(--primary)] px-4 text-xs font-bold text-[var(--foreground)]"
            >
              Aplicar
            </button>
          </form>
          {(couponError || quote.error) && (
            <p role="alert" className="mt-1 text-xs text-[var(--danger)]">
              {couponError || getApiError(quote.error).message}
            </p>
          )}
          <div className="mt-3 grid gap-2 text-xs">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{displaySubtotal} ETH</span>
            </div>
            <div className="flex justify-between">
              <span>Desconto do lançamento</span>
              <span>(-) {session.data ? `${displayDiscount} ETH` : discountLabel}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa de rede</span>
              <span className="flex flex-col items-end">{displayNetworkFee} ETH <br /> <span className="text-xs text-[var(--accent)]">Taxa estimada</span></span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-[var(--accent)] text-base">{displayTotal} ETH</span>
            </div>
          </div>
          <Link
            to="/checkout"
            onClick={(event) => { if (!canCheckout) event.preventDefault(); }}
            aria-disabled={!canCheckout}
            className="mt-5 grid h-12 w-full place-items-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--background)] aria-disabled:opacity-50"
          >
            Conectar e finalizar
          </Link>
        </aside>
      )}
      <div className="hidden px-6 md:block md:px-0">
        <p className="text-[15px] font-bold">Início / Mercado / Carrinho</p>
        {cartItemMutation.error && (
          <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
            {getApiError(cartItemMutation.error).message}
          </p>
        )}
        {rows.length === 0 ? (
          <EmptyCart />
        ) : (
          <section className="mt-3 grid gap-10 xl:grid-cols-[minmax(0,1fr)_342px] xl:gap-[88px]">
            <div className="min-w-0">
              <div className="grid grid-cols-[minmax(230px,1fr)_120px_120px_140px_32px] items-center gap-2 border-b border-[var(--border)] pb-2 text-base font-bold">
                <span>NFTs</span>
                <span>Preço</span>
                <span>Edições</span>
                <span>Total</span>
                <span />
              </div>
              <div className="mt-3 grid gap-3">
                {rows.map(({ item, nft, edition }) => (
                  <article
                    key={item.id}
                    className="grid min-h-[72px] grid-cols-[minmax(230px,1fr)_120px_120px_140px_32px] items-center gap-2 bg-[var(--surface-card)] pr-5"
                  >
                    <Link
                      to="/nft/$nftId"
                      params={{ nftId: nft.slug }}
                      className="flex min-w-0 items-center gap-4"
                    >
                      <img
                        src={nft.imageUrl}
                        alt=""
                        className="size-[72px] shrink-0 rounded-md object-cover"
                      />
                      <span className="min-w-0">
                        <b className="block truncate text-base">{nft.name}</b>
                        <small className="mt-1 block truncate text-sm text-[var(--muted-foreground)]">
                          ID do token: {nft.name.match(/#\d+/)?.[0] ?? nft.id}
                        </small>
                      </span>
                    </Link>
                    <span className="text-base font-bold text-[var(--muted-foreground)]">{edition.price} ETH</span>
                    <Quantity
                      item={item}
                      max={edition.availableQuantity}
                      disabled={cartItemMutation.isPending}
                      onChange={(quantity) => cartItemMutation.mutate({ id: item.id, quantity })}
                    />
                    <b className="text-base text-[var(--accent)]">
                      {fromWei(toWei(edition.price) * BigInt(item.quantity))}{" "}
                      ETH
                    </b>
                    <button
                      type="button"
                      onClick={() => cartItemMutation.mutate({ id: item.id })}
                      disabled={cartItemMutation.isPending}
                      aria-label={`Remover ${nft.name}`}
                      className="cursor-pointer grid size-8 place-items-center text-[var(--muted-foreground)] hover:text-[var(--accent)] disabled:opacity-50"
                    >
                      <img src="/assets/figma/delete.svg" alt="" width="24" height="24" />
                    </button>
                  </article>
                ))}
              </div>
            </div>
            <aside className="h-fit min-w-0">
              <h2 className="border-b border-[var(--border)] pb-2 text-lg font-bold">Resumo da carteira</h2>
              <form
                onSubmit={(event) => { event.preventDefault(); void applyCoupon(); }}
                className="cart-desktop-coupon mt-5"
              >
                <label htmlFor="desktop-coupon" className="text-sm font-bold">Código promocional</label>
                <div className="mt-2 flex h-[42px] overflow-hidden rounded-sm border border-[var(--primary)]">
                  <input
                    id="desktop-coupon"
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value)}
                    placeholder="Digite o código promocional..."
                    className="min-w-0 flex-1 bg-transparent px-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                  />
                  <button type="submit" className="bg-[var(--primary)] px-5 text-sm font-bold text-[var(--background)]">Aplicar</button>
                </div>
                {(couponError || quote.error) && <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{couponError || getApiError(quote.error).message}</p>}
              </form>
              <div className="mt-6 grid gap-3 text-base">
                <div className="flex justify-between gap-3"><span>Subtotal</span><span>{displaySubtotal} ETH</span></div>
                <div className="flex justify-between gap-3"><span>Desconto do lançamento</span><span>(-) {session.data ? `${displayDiscount} ETH` : discountLabel}</span></div>
                <div className="flex justify-between gap-3">
                  <span>Taxa de rede</span>
                  <span className="text-right">{displayNetworkFee} ETH <small className="mt-1 block text-xs text-[var(--accent)]">Taxa estimada</small></span>
                </div>
              </div>
              <div className="mt-5 flex justify-between gap-3 text-lg font-bold">
                <span>Total</span>
                <span className="text-[var(--accent)]">{displayTotal} ETH</span>
              </div>
              <Link to="/checkout" onClick={(event) => { if (!canCheckout) event.preventDefault(); }} aria-disabled={!canCheckout} className="mt-5 grid h-[42px] place-items-center rounded-sm bg-[var(--primary)] text-sm font-bold text-[var(--background)] aria-disabled:opacity-50">
                Conectar e finalizar
              </Link>
              <Link to="/" search={{ page: 1, pageSize: 9, sort: "featured" }} className="mt-3 block text-center text-base text-[var(--accent)] hover:underline">
                Continuar explorando
              </Link>
            </aside>
          </section>
        )}
      </div>
      <div className="hidden md:block">
        <RelatedNfts
          key={rows[0]?.nft.id ?? "empty-cart"}
          excludeIds={rows.map(({ nft }) => nft.id)}
          title={rows.length > 0 ? "Colecionadores também viram" : "Explore mais NFTs"}
          variant="cart"
        />
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

function Quantity({
  item,
  max,
  compact = false,
  disabled = false,
  onChange,
}: {
  item: { id: string; quantity: number };
  max: number;
  compact?: boolean;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}) {
  return (
    <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
      <Button
        variant={compact ? "outline" : "primary"}
        size="icon"
        className={compact ? "min-h-5 size-5 rounded-full p-0" : "h-[30px] min-h-[30px] w-[20px] rounded-full p-0 text-[var(--background)]"}
        disabled={disabled || item.quantity === 1}
        onClick={() => onChange(item.quantity - 1)}
        aria-label="Diminuir quantidade"
      >
        <Minus size={14} />
      </Button>
      <span className={`${compact ? "w-4 text-xs" : "w-5"} text-center`}>
        {item.quantity}
      </span>
      <Button
        variant={compact ? "outline" : "primary"}
        size="icon"
        className={compact ? "min-h-5 size-5 rounded-full p-0" : "h-[30px] min-h-[30px] w-[20px] rounded-full p-0 text-[var(--background)]"}
        disabled={disabled || item.quantity >= max}
        onClick={() => onChange(item.quantity + 1)}
        aria-label="Aumentar quantidade"
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}
function EmptyCart() {
  return (
    <section className="mt-8 bg-[var(--surface-card)] p-8 text-center">
      <h2 className="text-xl font-bold">Seu carrinho está vazio</h2>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Explore o catálogo para adicionar um NFT.
      </p>
      <Button asChild className="mt-5">
        <Link to="/" search={{ page: 1, pageSize: 9, sort: "featured" }}>
          Explorar NFTs
        </Link>
      </Button>
    </section>
  );
}
