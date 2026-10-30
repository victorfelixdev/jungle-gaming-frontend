import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Heart, Mail, Minus, Plus, Star, ZoomIn } from "lucide-react";
import { useRef, useState } from "react";
import { apiClient } from "@/api/client";
import type { Cart, Favorite, NftEdition } from "@/api/contracts";
import { getApiError } from "@/api/error";
import { nftQueryOptions } from "@/api/nfts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addGuestCartItem } from "@/features/cart/local-cart";
import { useGuestCart } from "@/features/cart/local-cart";
import { cartQueryKey, useSession } from "@/features/auth/session";
import { HomeFooter } from "./home-footer";
import { RelatedNfts } from "./related-nfts";
import { useDialogFocus } from "@/lib/use-dialog-focus";

export function NftDetailPage() {
  const { nftId } = useParams({ from: "/nft/$nftId" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const session = useSession();
  const guestCart = useGuestCart();
  const [quantity, setQuantity] = useState(1);
  const [desktopTab, setDesktopTab] = useState<"details" | "reviews">("details");
  const [imageOpen, setImageOpen] = useState(false);
  const remoteCart = useQuery({
    queryKey: cartQueryKey(session.data?.user.id),
    enabled: Boolean(session.data),
    queryFn: async () => (await apiClient.get<Cart>("/cart")).data,
  });
  const favorites = useQuery({
    queryKey: ["favorites", session.data?.user.id],
    enabled: Boolean(session.data),
    queryFn: async () => (await apiClient.get<Favorite[]>("/favorites")).data,
  });
  const nft = useQuery(nftQueryOptions(nftId));
  const [editionId, setEditionId] = useState<string>();
  const favoriteIds = favorites.data?.map(({ nftId }) => nftId) ?? [];
  const isFavorite = favoriteIds.includes(nft.data?.id ?? "");
  const favorite = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      if (active) await apiClient.delete(`/favorites/${id}`);
      else await apiClient.post(`/favorites/${id}`);
    },
    onMutate: async ({ id, active }) => {
      const key = ["favorites", session.data?.user.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Favorite[]>(key);
      queryClient.setQueryData<Favorite[]>(
        key,
        (current = []) => active
          ? current.filter(({ nftId }) => nftId !== id)
          : [...current, { nftId: id, createdAt: new Date().toISOString() }],
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(["favorites", session.data?.user.id], context?.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["favorites", session.data?.user.id] }),
  });
  const cart = useMutation({
    mutationFn: async ({
      nftId: id,
      edition,
      quantity: amount,
    }: {
      nftId: string;
      edition: NftEdition;
      quantity?: number;
    }) => {
      const item = {
        nftId: id,
        editionId: edition.id,
        quantity: amount ?? 1,
      };
      if (session.data) {
        await apiClient.post("/cart/items", item);
      } else {
        addGuestCartItem({
          ...item,
        });
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  if (nft.isPending) return <DetailSkeleton />;
  if (nft.isError) {
    if (getApiError(nft.error).code === "NFT_NOT_FOUND") return <NotFound />;
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-16">
        <h1 className="text-xl font-bold">Não foi possível carregar este NFT.</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{getApiError(nft.error).message}</p>
        <Button className="mt-5" onClick={() => void nft.refetch()}>Tentar novamente</Button>
      </main>
    );
  }
  if (!nft.data) return <NotFound />;

  const selectedEdition =
    nft.data.editions.find(({ id }) => id === editionId) ??
    nft.data.editions.find(({ name }) => name === "1/50") ??
    nft.data.editions[0];
  const requestError = cart.error ?? favorite.error;
  const itemCount =
    guestCart.reduce((sum, item) => sum + item.quantity, 0) +
    (remoteCart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0);
  const toggleFavorite = () => {
    if (!session.data) {
      void navigate({
        to: "/login",
        search: { redirect: window.location.pathname },
      });
      return;
    }
    favorite.mutate({ id: nft.data.id, active: isFavorite });
  };
  const goBack = () => {
    sessionStorage.setItem("catalog-return", "1");
    if (window.history.length > 1) window.history.back();
    else
      void navigate({
        to: "/",
        search: { page: 1, pageSize: 9, sort: "featured" },
      });
  };
  const tokenId = nft.data.name.match(/#([\w]+)/)?.[1] ?? nft.data.id;
  const collectionName = nft.data.id === "nft-aurora" ? "Kurio Apes" : nft.data.name.replace(/\s*#\w+$/, "");
  const networkName = { ethereum: "Ethereum", polygon: "Polygon", solana: "Solana" }[nft.data.network ?? "ethereum"];
  const attributes = nft.data.id === "nft-aurora" ? "Óculos, Esmeralda, Raro" : nft.data.tags.join(", ");
  const description = nft.data.id === "nft-aurora"
    ? "Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores."
    : nft.data.description;

  return (
    <main className="min-h-dvh bg-[var(--surface-card)] md:mx-auto md:max-w-[1200px] md:bg-[var(--background)] md:pb-0 md:pt-3">
      {selectedEdition && <p role="status" className="sr-only">Edição {selectedEdition.name}: {selectedEdition.price} ETH, {selectedEdition.availableQuantity} disponíveis.</p>}
      <section className="flex min-h-dvh w-full flex-col md:hidden">
        <div className="relative bg-[var(--surface-raised)] px-5 pt-12">
          <button
            type="button"
            onClick={goBack}
            aria-label="Voltar"
            className="absolute left-5 top-4 z-10 grid size-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            <img
              src="/assets/figma/arrow-left-2.svg"
              alt=""
              width="8"
              height="14"
            />
          </button>
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={favorite.isPending}
            aria-label={isFavorite ? "Descurtir NFT" : "Curtir NFT"}
            aria-pressed={isFavorite}
            className="absolute right-5 top-4 z-10 grid size-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            {isFavorite ? (
              <Heart size={16} fill="var(--accent)" stroke="var(--accent)" />
            ) : (
              <img
                src="/assets/figma/heart.svg"
                alt=""
                width="16"
                height="15"
              />
            )}
          </button>
          <img
            src={nft.data.imageUrl}
            alt={`NFT ${nft.data.name}`}
            className="aspect-square w-full rounded-t-[20px] object-cover mt-2"
          />
        </div>
        <div className="relative -mt-6 flex-1 rounded-t-[30px] bg-[var(--surface-card)] px-5 pb-[170px] pt-7">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-sm font-bold">{nft.data.name}</h1>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--primary)] px-2 py-0.5 text-[11px]">
              <Star size={12} fill="var(--accent)" stroke="var(--accent)" />
              4.8 (19)
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
            {nft.data.description} Um colecionável digital finalizado à mão da
            coleção Kurio Editions, verificado na Ethereum.
          </p>
          <p className="mt-3 text-xs font-bold">Edição:</p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Selecionar edição"
          >
            {nft.data.editions.map((edition) => (
              <button
                key={edition.id}
                type="button"
                role="radio"
                aria-checked={selectedEdition?.id === edition.id}
                onClick={() => {
                  if (selectedEdition?.id !== edition.id) {
                    setEditionId(edition.id);
                    setQuantity(edition.availableQuantity > 0 ? 1 : 0);
                  }
                }}
                aria-label={`${edition.name}, ${edition.availableQuantity} disponíveis`}
                className={`h-[28px] rounded-[50%] border px-3 text-[13px] ${selectedEdition?.id === edition.id ? "border-[var(--primary)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}
              >
                {edition.name}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2 text-sm text-[var(--secondary)]">
            <p>
              ID do token: #
              {nft.data.name.match(/#\w+/)?.[0].slice(1) ?? nft.data.id}
            </p>
            <p>Coleção: Kurio Apes</p>
            <p>Atributos: {nft.data.tags.join(", ")}</p>
          </div>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[30px] bg-[var(--surface-card)] px-5 py-4 shadow-[0_0_20px_0_rgb(10_6_4_/_45%)]">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              Qtd:{" "}
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                aria-label="Diminuir quantidade"
                className="grid size-5 place-items-center rounded-full bg-[var(--primary)] text-[var(--background)] w-5 h-7"
              >
                <Minus size={13} />
              </button>
              {quantity}
              <button
                type="button"
                onClick={() =>
                  setQuantity(
                    Math.min(
                      selectedEdition?.availableQuantity ?? 1,
                      quantity + 1,
                    ),
                  )
                }
                aria-label="Aumentar quantidade"
                disabled={quantity >= (selectedEdition?.availableQuantity ?? 0)}
                className="grid size-5 place-items-center rounded-full bg-[var(--primary)] text-[var(--background)] w-5 h-7"
              >
                <Plus size={13} />
              </button>
            </div>
            <strong className="text-base text-[var(--accent)]">
              {(Number(selectedEdition?.price ?? 0) * quantity).toFixed(2)} ETH
            </strong>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={
                !selectedEdition ||
                selectedEdition.availableQuantity < 1 ||
                quantity < 1 ||
                cart.isPending
              }
              onClick={() =>
                selectedEdition &&
                cart.mutate(
                  { nftId: nft.data.id, edition: selectedEdition, quantity },
                  { onSuccess: () => void navigate({ to: "/cart" }) },
                )
              }
              className="h-11 w-[168px] max-w-[calc(100%-56px)] rounded-full bg-[var(--primary)] text-xs font-bold text-[var(--background)]"
            >
              Comprar NFT
            </button>
            <Link
              to="/cart"
              aria-label={`Carrinho, ${itemCount} itens`}
              className="relative grid size-11 place-items-center rounded-full bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--muted-foreground)]"
            >
              <img src="/assets/figma/shop.svg" alt="" width="20" height="20" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[var(--primary)] text-[10px] text-[var(--background)]">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
          </div>
          {requestError && (
            <p role="alert" className="mt-2 text-xs text-[var(--danger)]">
              {getApiError(requestError).message}
            </p>
          )}
        </div>
      </section>
      <div className="hidden md:block">
        <p className="text-[13px] font-bold">Início / Mercado</p>
        <section className="mt-2 grid gap-7 lg:grid-cols-[minmax(0,478px)_minmax(0,1fr)]">
          <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-5">
            <div className="flex flex-col gap-3" aria-label="Galeria do NFT">
              {Array.from({ length: 4 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setImageOpen(true)}
                  className="aspect-square w-full overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                  aria-label={`Ampliar visualização ${index + 1}`}
                >
                  <img src={nft.data.imageUrl} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
            <div className="relative self-start rounded-md bg-[var(--surface-card)] p-3.5">
              <img
                src={nft.data.imageUrl}
                alt={`NFT ${nft.data.name} por ${nft.data.artist}`}
                className="aspect-square w-full rounded-[20px] object-cover"
              />
              <button
                type="button"
                onClick={() => setImageOpen(true)}
                aria-label="Ampliar imagem do NFT"
                className="absolute right-3.5 top-3.5 grid size-7 place-items-center rounded-full bg-[var(--surface-card)] text-[var(--foreground)]"
              >
                <ZoomIn size={17} />
              </button>
            </div>
          </div>
          <section className="min-w-0">
            <h1 className="text-[23px] font-bold leading-tight">{nft.data.name}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
              <strong className="text-lg text-[var(--accent)]">{selectedEdition?.price} ETH</strong>
              <button type="button" onClick={() => setDesktopTab("reviews")} className="flex items-center gap-1 text-[11px]">
                <span className="flex gap-0.5 text-[var(--accent)]" aria-label="Avaliação 4,8 de 5">
                  {Array.from({ length: 5 }, (_, index) => <Star key={index} size={12} fill="currentColor" />)}
                </span>
                19 avaliações de colecionadores
              </button>
            </div>
            <h2 className="mt-3 text-xs font-bold">Sobre este NFT:</h2>
            <p className="mt-2 text-xs leading-[1.55] text-[var(--muted-foreground)]">{description}</p>
            <h2 className="mt-2 text-xs font-bold">Edição:</h2>
            <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label="Selecionar edição">
              {nft.data.editions.map((edition) => (
                <button
                  key={edition.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedEdition?.id === edition.id}
                  onClick={() => {
                    if (selectedEdition?.id !== edition.id) {
                      setEditionId(edition.id);
                      setQuantity(edition.availableQuantity > 0 ? 1 : 0);
                    }
                  }}
                  className={`h-[28px] rounded-[50%] border px-3 text-[13px] cursor-pointer ${selectedEdition?.id === edition.id ? "border-[var(--primary)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}
                >
                  {edition.name}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-2 text-xs" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir quantidade" disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))} className="cursor-pointer grid h-7 w-5 place-items-center rounded-full bg-[var(--primary)] text-[var(--background)] disabled:opacity-60"><Minus size={13} /></button>
                <span>{quantity}</span>
                <button type="button" aria-label="Aumentar quantidade" disabled={quantity >= (selectedEdition?.availableQuantity ?? 0)} onClick={() => setQuantity(Math.min(selectedEdition?.availableQuantity ?? 1, quantity + 1))} className="cursor-pointer grid h-7 w-5 place-items-center rounded-full bg-[var(--primary)] text-[var(--background)] disabled:opacity-60"><Plus size={13} /></button>
              </div>
              <Button
                disabled={!selectedEdition || selectedEdition.availableQuantity < 1 || quantity < 1 || cart.isPending}
                onClick={() => selectedEdition && cart.mutate({ nftId: nft.data.id, edition: selectedEdition, quantity }, { onSuccess: () => void navigate({ to: "/cart" }) })}
                className="cursor-pointer ml-auto min-h-11 px-7 text-[11px] font-bold"
              >
                {cart.isPending ? "Adicionando..." : "COMPRAR"}
              </Button>
              <Button variant="outline" disabled={favorite.isPending} onClick={toggleFavorite} aria-label={isFavorite ? "Desfavoritar NFT" : "Favoritar NFT"} aria-pressed={isFavorite} className="border-[var(--accent)] cursor-pointer min-h-11 gap-1 px-5 text-[11px] text-[var(--accent)]">
                <Heart size={13} fill={isFavorite ? "currentColor" : "none"} /> Favoritar
              </Button>
            </div>
            <div className="mt-2 space-y-1 text-[11px] text-[var(--secondary)]">
              <p>ID do token: #{tokenId}</p>
              <p>Coleção: {collectionName}</p>
              <p>Atributos: {attributes}</p>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px]">
              <span className="font-bold">Compartilhar este NFT:</span>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer" aria-label="Compartilhar no LinkedIn" className="font-bold">in</a>
              <a href={`mailto:?subject=${encodeURIComponent(nft.data.name)}&body=${encodeURIComponent(window.location.href)}`} aria-label="Compartilhar por e-mail"><Mail size={13} /></a>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer" aria-label="Compartilhar no Twitter" className="font-bold">𝕏</a>
            </div>
            {requestError && <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{getApiError(requestError).message}</p>}
          </section>
        </section>
        <section className="mt-14">
          <div className="flex gap-6 border-b border-[var(--border)] text-sm">
            <button type="button" onClick={() => setDesktopTab("details")} className={`pb-1 ${desktopTab === "details" ? "border-b-2 border-[var(--primary)] text-[var(--accent)]" : ""}`}>Detalhes do NFT</button>
            <button type="button" onClick={() => setDesktopTab("reviews")} className={`pb-1 ${desktopTab === "reviews" ? "border-b-2 border-[var(--primary)] text-[var(--accent)]" : ""}`}>Avaliações de colecionadores (19)</button>
          </div>
          {desktopTab === "details" ? (
            <div className="space-y-4 pt-3 text-xs leading-5 text-[var(--muted-foreground)]">
              <p>{nft.data.name} é uma obra digital {selectedEdition?.name} finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na {networkName}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.</p>
              <p>A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrado na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.</p>
              <div><strong className="text-[var(--foreground)]">Rede:</strong><p>Cunhado na {networkName} com procedência imutável e metadados armazenados no IPFS.</p></div>
              <div><strong className="text-[var(--foreground)]">Contrato:</strong><p>Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p></div>
              <div><strong className="text-[var(--foreground)]">Direitos autorais:</strong><p>Contrato inteligente ERC-721 verificado.</p></div>
            </div>
          ) : (
            <div className="pt-4 text-sm"><span className="inline-flex items-center gap-1 text-[var(--accent)]"><Star size={16} fill="currentColor" /> 4.8/5</span><p className="mt-2 text-[var(--muted-foreground)]">19 avaliações de colecionadores</p></div>
          )}
        </section>
        <RelatedNfts key={nft.data.id} nft={nft.data} />
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
        {imageOpen && <ImageDialog name={nft.data.name} imageUrl={nft.data.imageUrl} onClose={() => setImageOpen(false)} />}
      </div>
    </main>
  );
}

function ImageDialog({ name, imageUrl, onClose }: { name: string; imageUrl: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, true, onClose);
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Imagem ampliada de ${name}`} tabIndex={-1} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-8" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <button type="button" onClick={onClose} className="absolute right-6 top-5 text-2xl" aria-label="Fechar imagem ampliada">×</button>
      <img src={imageUrl} alt={`NFT ${name} ampliado`} className="max-h-full max-w-full rounded-2xl object-contain" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-6 py-12 lg:grid-cols-[573px_minmax(0,1fr)] lg:px-0">
      <Skeleton className="aspect-square rounded-md" />
      <div className="space-y-5">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </main>
  );
}
function NotFound() {
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-16 lg:px-0">
      <h1 className="text-3xl font-bold">NFT não encontrado</h1>
      <Link
        className="mt-6 inline-block font-bold text-[var(--accent)]"
        to="/"
        search={{ page: 1, pageSize: 9, sort: "featured" }}
      >
        Voltar ao catálogo
      </Link>
    </main>
  );
}
