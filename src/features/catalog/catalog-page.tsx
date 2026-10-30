import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  nftFacetsQueryOptions,
  nftQueryOptions,
  nftsQueryOptions,
} from "@/api/nfts";
import type { NftFeed, NftNetwork, NftSort } from "@/api/contracts";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeFooter } from "./home-footer";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { cn } from "@/lib/utils";

const categories = [
  { label: "Arte digital", value: "Arte" },
  { label: "Fotografia", value: "Fotografia" },
  { label: "Música", value: "Música" },
  { label: "Arte 3D", value: "Arte 3D" },
  { label: "Colecionáveis", value: "Colecionáveis" },
  { label: "Generativa", value: "Generativa" },
  { label: "Jogos", value: "Jogos" },
  { label: "Assinaturas", value: "Assinaturas" },
  { label: "Utilidade", value: "Utilidade" },
];

const networks: { label: string; value: NftNetwork }[] = [
  { label: "Ethereum", value: "ethereum" },
  { label: "Polygon", value: "polygon" },
  { label: "Solana", value: "solana" },
];

const sortOptions: { label: string; value: NftSort }[] = [
  { label: "Relevância", value: "featured" },
  { label: "Mais recentes", value: "newest" },
  { label: "Menor preço", value: "price-asc" },
  { label: "Maior preço", value: "price-desc" },
];

const formatPrice = (value: number) => value.toFixed(2).replace(".", ",");

const journalEntries = [
  {
    title: "Como funciona a propriedade de NFTs",
    date: "12 de setembro",
    readTime: "6 min",
    image: "/assets/figma/nft-4.png",
    summary: "Aprenda a colecionar, negociar e verificar ativos digitais.",
    content:
      "Um NFT registra a propriedade de um item digital em uma rede. Antes de colecionar, confira a coleção, a edição e o histórico do token. Guarde sua carteira com segurança para manter o controle sobre seus ativos.",
  },
  {
    title: "10 artistas digitais para acompanhar",
    date: "13 de setembro",
    readTime: "2 min",
    image: "/assets/figma/nft-1.png",
    summary: "Conheça criadores que moldam a cultura digital.",
    content:
      "Explore artistas de diferentes técnicas e acompanhe suas coleções. Observe a proposta de cada obra, a trajetória do criador e os projetos que surgem ao redor da comunidade.",
  },
  {
    title: "Raridade, atributos e procedência",
    date: "15 de setembro",
    readTime: "3 min",
    image: "/assets/figma/nft-2.png",
    summary: "Entenda raridade, procedência, direitos autorais e utilidade.",
    content:
      "A raridade depende da edição e dos atributos de cada NFT. Verifique o contrato, a origem da coleção e os direitos descritos pelo criador antes de decidir uma compra.",
  },
  {
    title: "Como proteger sua carteira",
    date: "15 de setembro",
    readTime: "2 min",
    image: "/assets/figma/nft-3.png",
    summary: "Proteja sua carteira, seus ativos e sua identidade.",
    content:
      "Nunca compartilhe sua frase de recuperação. Revise os endereços antes de confirmar transações e use apenas aplicativos e conexões em que você confia.",
  },
];

export function CatalogPage() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const result = useQuery({
    ...nftsQueryOptions(search),
    placeholderData: keepPreviousData,
  });
  const facets = useQuery(nftFacetsQueryOptions);
  const featured = useQuery(nftQueryOptions("violet-nomad-314"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLElement>(null);
  useDialogFocus(filtersRef, filtersOpen, () => setFiltersOpen(false));
  const restoredScroll = useRef(false);
  useEffect(() => {
    if (!result.data || restoredScroll.current) return;
    restoredScroll.current = true;
    if (sessionStorage.getItem("catalog-return") !== "1") return;
    sessionStorage.removeItem("catalog-return");
    const saved = sessionStorage.getItem(
      `catalog-scroll:${window.location.search}`,
    );
    if (saved) requestAnimationFrame(() => window.scrollTo(0, Number(saved)));
  }, [result.data]);

  const setSearch = (next: Partial<typeof search>) =>
    navigate({
      search: (previous) => ({ ...previous, ...next, page: next.page ?? 1 }),
    });
  const toggleCategory = (category: string) => {
    const selected = search.categories ?? [];
    setSearch({
      categories: selected.includes(category)
        ? selected.filter((item) => item !== category)
        : [...selected, category],
    });
  };
  const toggleNetwork = (network: NftNetwork) => {
    const selected = search.networks ?? [];
    setSearch({
      networks: selected.includes(network)
        ? selected.filter((item) => item !== network)
        : [...selected, network],
    });
  };

  return (
    <main className="mx-auto max-w-[1200px] px-6 pb-20 pt-10 md:px-0 md:pt-8">
      <SearchForm
        search={search.query}
        onSearch={(query) => setSearch({ query })}
        onFilter={() => setFiltersOpen(true)}
        className="md:hidden"
      />
      {filtersOpen && (
        <div className="fixed inset-0 z-50 bg-black/70" onMouseDown={(event) => { if (event.target === event.currentTarget) setFiltersOpen(false); }}>
          <section ref={filtersRef} role="dialog" aria-modal="true" aria-labelledby="mobile-filters-title" className="ml-auto flex h-dvh w-full max-w-[390px] flex-col overflow-y-auto bg-[var(--surface-card)] px-6 pb-8 pt-5 md:hidden">
            <div className="flex items-center justify-between">
              <h2 id="mobile-filters-title" className="text-lg font-bold">Filtros</h2>
              <button type="button" aria-label="Fechar filtros" onClick={() => setFiltersOpen(false)} className="grid size-10 place-items-center"><X size={20} /></button>
            </div>
            <h3 className="mt-6 text-base font-bold">Coleções</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {categories.map((category) => <button key={category.value} type="button" aria-pressed={Boolean(search.categories?.includes(category.value))} onClick={() => toggleCategory(category.value)} className={`rounded border px-3 py-2 text-left text-xs ${search.categories?.includes(category.value) ? "border-[var(--primary)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>{category.label} ({facets.data?.categories[category.value] ?? 0})</button>)}
            </div>
            <PriceFilter key={`${search.minPrice ?? "default"}-${search.maxPrice ?? "default"}`} initialMin={search.minPrice ?? 0.02} initialMax={search.maxPrice ?? 12.3} onApply={(minPrice, maxPrice) => setSearch({ minPrice, maxPrice })} />
            <h3 className="mt-7 text-base font-bold">Rede</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {networks.map((network) => <button key={network.value} type="button" aria-pressed={Boolean(search.networks?.includes(network.value))} onClick={() => toggleNetwork(network.value)} className={`rounded border px-3 py-2 text-left text-xs ${search.networks?.includes(network.value) ? "border-[var(--primary)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>{network.label} ({facets.data?.networks[network.value] ?? 0})</button>)}
            </div>
            <div className="mt-7"><SortDropdown value={search.sort} onChange={(sort) => setSearch({ sort })} mobile /></div>
            <div className="mt-auto flex gap-3 pt-8">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSearch({ categories: undefined, networks: undefined, minPrice: undefined, maxPrice: undefined })}>Limpar</Button>
              <Button type="button" className="flex-1" onClick={() => setFiltersOpen(false)}>Ver resultados</Button>
            </div>
          </section>
        </div>
      )}
      <Hero />

      <section
        id="catalog"
        className="mt-10 grid gap-8 md:mt-12 md:grid-cols-[287px_minmax(0,1fr)]"
      >
        <aside className="hidden self-start md:block">
          <div className="bg-[var(--surface-card)] px-[18px] pb-5 pt-4">
            <h2 className="text-base font-bold">Coleções</h2>
            <div className="mt-2 grid">
              {categories.map((category, index) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => toggleCategory(category.value)}
                  aria-pressed={Boolean(
                    search.categories?.includes(category.value),
                  )}
                  className={`flex h-[37px] items-center justify-between px-3 text-left text-sm ${search.categories?.includes(category.value) || (!search.categories?.length && index === 0) ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}
                >
                  <span>{category.label}</span>
                  <span>
                    {facets.data
                      ? `(${facets.data.categories[category.value] ?? 0})`
                      : "(…)"}
                  </span>
                </button>
              ))}
            </div>
            <PriceFilter
              key={`${search.minPrice ?? "default"}-${search.maxPrice ?? "default"}`}
              initialMin={search.minPrice ?? 0.02}
              initialMax={search.maxPrice ?? 12.3}
              onApply={(minPrice, maxPrice) =>
                setSearch({ minPrice, maxPrice })
              }
            />
            <div className="mt-8">
              <h3 className="text-base font-bold">Rede</h3>
              <div className="mt-2 grid">
                {networks.map((network) => (
                  <button
                    key={network.value}
                    type="button"
                    onClick={() => toggleNetwork(network.value)}
                    aria-pressed={Boolean(
                      search.networks?.includes(network.value),
                    )}
                    className={`flex h-[37px] items-center justify-between px-3 text-left text-sm ${search.networks?.includes(network.value) ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}
                  >
                    <span>{network.label}</span>
                    <span>
                      {facets.data
                        ? `(${facets.data.networks[network.value]})`
                        : "(…)"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Link
            to="/nft/$nftId"
            params={{ nftId: "violet-nomad-314" }}
            className="mt-5 block overflow-hidden bg-[var(--surface-raised)]"
            aria-label="Ver NFT em destaque: Violet Nomad #314"
          >
            <div className="flex h-24 flex-col items-center justify-center gap-1 text-center">
              <strong className="text-base text-[var(--accent)]">
                NFT EM DESTAQUE
              </strong>
              <span className="text-sm font-bold">OFERTA LIMITADA</span>
            </div>
            <img
              src={featured.data?.imageUrl ?? "/assets/figma/nft-2.png"}
              alt={featured.data?.name ?? "Violet Nomad #314"}
              className="aspect-[0.86] w-full rounded-t-2xl object-cover"
            />
          </Link>
        </aside>
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3 text-xs md:gap-4 md:text-sm">
              {(
                [
                  ["all", "Todos os NFTs"],
                  ["new", "Novos lançamentos"],
                  ["trending", "Em alta"],
                ] as const
              ).map(([feed, label]) => (
                <button
                  key={feed}
                  type="button"
                  onClick={() => setSearch({ feed: feed as NftFeed })}
                  aria-pressed={(search.feed ?? "all") === feed}
                  className={`border-b-2 pb-1 cursor-pointer ${
                    (search.feed ?? "all") === feed
                      ? "border-[var(--primary)] font-bold text-[var(--accent)]"
                      : "border-transparent text-[var(--muted-foreground)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <SearchForm
                search={search.query}
                onSearch={(query) => setSearch({ query })}
                className="hidden gap-2 md:flex"
              />
              <SortDropdown value={search.sort} onChange={(sort) => setSearch({ sort })} />
            </div>
          </div>
          {result.isPending ? <CatalogSkeleton /> : null}
          {result.isError ? (
            <State
              title="Não foi possível carregar o catálogo."
              action="Tentar novamente"
              onAction={() => void result.refetch()}
            />
          ) : null}
          {result.data?.items.length === 0 ? (
            <State
              title="Nenhum NFT corresponde à sua busca."
              action="Limpar filtros"
              onAction={() =>
                setSearch({
                  query: undefined,
                  categories: undefined,
                  networks: undefined,
                  minPrice: undefined,
                  maxPrice: undefined,
                  feed: "all",
                })
              }
            />
          ) : null}
          {result.data?.items.length ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-3 md:gap-x-5">
                {result.data.items.map((nft) => (
                  <Link
                    key={nft.id}
                    to="/nft/$nftId"
                    params={{ nftId: nft.slug }}
                    className="group block"
                    onClick={() =>
                      sessionStorage.setItem(
                        `catalog-scroll:${window.location.search}`,
                        String(window.scrollY),
                      )
                    }
                  >
                    <div className="aspect-[0.86] overflow-hidden rounded-2xl bg-[var(--surface-raised)] p-1 md:rounded-none md:pt-8">
                      <img
                        src={nft.imageUrl}
                        alt={`NFT ${nft.name} por ${nft.artist}`}
                        className="size-full rounded-[12px] object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none md:aspect-square md:h-auto md:w-full"
                      />
                    </div>
                    <p className="mt-3 truncate text-sm">{nft.name}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--accent)]">
                      {nft.editions[0]?.price} ETH
                    </p>
                  </Link>
                ))}
              </div>
              <Pagination
                page={result.data.page}
                totalPages={result.data.totalPages}
                onPage={(page) => setSearch({ page })}
              />
            </>
          ) : null}
        </div>
      </section>
      <section
        aria-label="Explorar coleções"
        className="mt-16 grid gap-5 lg:grid-cols-2"
      >
        <PromoCard
          image="/assets/figma/nft-1.png"
          title="Lançamentos gênesis de edição limitada"
          description="Colecione edições escassas diretamente dos criadores antes da revelação pública."
          onExplore={() => {
            setSearch({
              feed: "new",
              sort: "featured",
              query: undefined,
              categories: undefined,
              networks: undefined,
              minPrice: undefined,
              maxPrice: undefined,
            });
            document
              .getElementById("catalog")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
        <PromoCard
          image="/assets/figma/nft-4.png"
          title="Arte digital selecionada e muito mais"
          description="Explore novos artistas, coleções verificadas e obras digitais que definem a cultura da internet."
          onExplore={() => {
            setSearch({
              feed: "all",
              sort: "featured",
              query: undefined,
              categories: ["Arte"],
              networks: undefined,
              minPrice: undefined,
              maxPrice: undefined,
            });
            document
              .getElementById("catalog")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </section>
      <section aria-labelledby="journal-heading" className="mt-20">
        <div className="text-center">
          <h2 id="journal-heading" className="text-2xl font-bold">
            Diário da Cunhagem
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Histórias, guias e insights para colecionadores sobre o universo da
            propriedade digital.
          </p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {journalEntries.map((entry) => (
            <details
              key={entry.title}
              className="group self-start overflow-hidden rounded-lg bg-[var(--surface-card)]"
            >
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <img
                  src={entry.image}
                  alt=""
                  loading="lazy"
                  className="aspect-[1.38] w-full object-cover"
                />
                <div className="px-4 pb-4 pt-3">
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {entry.date} <span aria-hidden="true">|</span> Leitura de{" "}
                    {entry.readTime}
                  </p>
                  <h3 className="mt-2 text-sm font-bold leading-5">
                    {entry.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                    {entry.summary}
                  </p>
                  <span className="mt-2 block text-xs font-bold text-[var(--accent)]">
                    Ler mais →
                  </span>
                </div>
              </summary>
              <p className="border-t border-[var(--border)] px-4 py-4 text-xs leading-5 text-[var(--muted-foreground)]">
                {entry.content}
              </p>
            </details>
          ))}
        </div>
      </section>
      <HomeFooter
        onSelectCategory={(category) => {
          setSearch({
            feed: "all",
            sort: "featured",
            query: undefined,
            categories: [category],
            networks: undefined,
            minPrice: undefined,
            maxPrice: undefined,
          });
          document.getElementById("catalog")?.scrollIntoView({
            behavior: "smooth",
          });
        }}
      />
    </main>
  );
}

function SortDropdown({ value, onChange, mobile = false }: { value: NftSort; onChange: (value: NftSort) => void; mobile?: boolean }) {
  return (
    <div className={`${mobile ? "flex" : "hidden md:flex"} items-center gap-2 text-xs text-[var(--muted-foreground)]`}>
      <span>Ordenar</span>
      <DropdownSelect
        value={value}
        options={sortOptions}
        onChange={onChange}
        ariaLabel="Ordenar por"
        listLabel="Ordenar NFTs"
        triggerClassName="min-h-8"
        menuClassName="min-w-[170px]"
        align="right"
      />
    </div>
  );
}

function PromoCard({
  image,
  title,
  description,
  onExplore,
}: {
  image: string;
  title: string;
  description: string;
  onExplore: () => void;
}) {
  return (
    <article className="grid overflow-hidden rounded-xl bg-[var(--surface-card)] sm:h-[250px] sm:grid-cols-2">
      <div className="relative h-48 overflow-hidden sm:h-full">
        <img
          src={image}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-28 -left-24 size-48 rounded-full border border-[var(--primary)]"
        />
      </div>
      <div className="flex flex-col items-end justify-center p-5 text-right">
        <h2 className="max-w-56 text-base font-bold leading-5">{title}</h2>
        <p className="mt-3 max-w-56 text-xs leading-5 text-[var(--muted-foreground)]">
          {description}
        </p>
        <Button
          type="button"
          onClick={onExplore}
          className="mt-3 min-h-9 px-5 text-xs"
        >
          Explorar <ArrowRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

function PriceFilter({
  initialMin,
  initialMax,
  onApply,
}: {
  initialMin: number;
  initialMax: number;
  onApply: (minPrice: number, maxPrice: number) => void;
}) {
  const [minPrice, setMinPrice] = useState(initialMin);
  const [maxPrice, setMaxPrice] = useState(initialMax);

  return (
    <div className="mt-8">
      <h3 className="text-base font-bold">Faixa de preço</h3>
      <div className="relative mx-3 mt-2 h-5">
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--primary)]" />
        <input
          type="range"
          min="0.02"
          max="16"
          step="0.01"
          value={minPrice}
          onChange={(event) =>
            setMinPrice(Math.min(Number(event.target.value), maxPrice - 0.01))
          }
          aria-label="Preço mínimo"
          className="catalog-price-range absolute inset-0 w-full"
        />
        <input
          type="range"
          min="0.02"
          max="16"
          step="0.01"
          value={maxPrice}
          onChange={(event) =>
            setMaxPrice(Math.max(Number(event.target.value), minPrice + 0.01))
          }
          aria-label="Preço máximo"
          className="catalog-price-range absolute inset-0 w-full"
        />
      </div>
      <p className="mx-3 mt-2 text-sm">
        Preço: {formatPrice(minPrice)} - {formatPrice(maxPrice)} ETH
      </p>
      <Button
        type="button"
        onClick={() => onApply(minPrice, maxPrice)}
        className="mx-3 mt-2 min-h-[33px] rounded px-3 text-sm"
      >
        Aplicar
      </Button>
    </div>
  );
}

function Hero() {
  return (
    <>
      <section className="relative hidden h-[450px] items-center overflow-hidden pl-10 md:flex">
        <div className="flex w-full items-center justify-between">
          <div className="flex w-[600px] flex-col items-end gap-11">
            <div className="flex w-full flex-col gap-8">
              <div>
                <p className="text-sm font-medium tracking-[0.1em]">
                  Bem-vindo à Kurio
                </p>
                <h1 className="mt-2 text-[43px] font-bold leading-[70px]">
                  SEJA DONO DO FUTURO
                  <br />
                  DA ARTE DIGITAL
                </h1>
              </div>
              <p className="w-[557px] text-sm leading-6 text-[var(--muted-foreground)]">
                Descubra NFTs selecionados de criadores emergentes e
                consagrados. Colecione arte digital rara, apoie artistas e tenha
                uma parte da cultura da internet.
              </p>
              <a
                href="#catalog"
                className="flex h-10 w-[140px] items-center justify-center rounded-md bg-[var(--primary)] px-7 text-base font-bold text-[var(--accent-foreground)]"
              >
                EXPLORAR
              </a>
            </div>
            <img
              src="/assets/figma/hero-desktop-dots.svg"
              alt=""
              width="40"
              height="8"
            />
          </div>
          <img
            src="/assets/figma/hero-desktop.png"
            alt="Arte NFT em destaque"
            className="size-[450px] rounded-3xl object-cover"
          />
        </div>
      </section>
      <section className="relative mt-4 h-[190px] overflow-hidden rounded-xl p-4 md:hidden">
        <img
          src="/assets/figma/hero-mobile-mask.svg"
          alt=""
          className="absolute inset-0 size-full"
        />
        <div className="relative h-full w-full">
          <div className="absolute left-0 top-0 z-10 w-[190px] max-[390px]:w-[180px]">
            <p className="text-xs font-medium">Bem-vindo à Kurio</p>
            <h1 className="mt-1 text-lg font-bold leading-[29px]">
              SEJA DONO DA
              <br />
              CULTURA DIGITAL
            </h1>
            <p className="mt-2 text-xs leading-[18px] text-[var(--muted-foreground)]">
              Descubra NFTs selecionados de criadores do mundo todo.
            </p>
            <a
              href="#catalog"
              className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[var(--accent)]"
            >
              EXPLORAR <ArrowRight size={16} strokeWidth={2} />
            </a>
          </div>
          <div className="absolute right-0 top-0 size-[138px] max-[390px]:size-[120px]">
            <img
              src="/assets/figma/hero-mobile-main.png"
              alt="NFT em destaque"
              className="size-full rounded-2xl object-cover"
            />
            <img
              src="/assets/figma/hero-mobile-overlay.png"
              alt=""
              className="absolute left-[14px] top-[88px] size-[58px] rounded-2xl object-cover max-[390px]:left-[12px] max-[390px]:top-[76px] max-[390px]:size-[52px]"
            />
          </div>
          <img
            src="/assets/figma/hero-mobile-dots.svg"
            alt=""
            width="33"
            height="7"
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
          />
        </div>
      </section>
    </>
  );
}

function SearchForm({
  search,
  onSearch,
  onFilter,
  className,
}: {
  search?: string;
  onSearch: (query?: string) => void;
  onFilter?: () => void;
  className?: string;
}) {
  return (
    <form
      className={cn("mb-4 flex gap-2 md:hidden", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("query");
        onSearch(
          typeof value === "string" && value.trim() ? value.trim() : undefined,
        );
      }}
    >
      <Input
        key={search}
        name="query"
        defaultValue={search}
        placeholder="Explorar coleções"
        aria-label="Buscar no catálogo"
        className="min-w-0"
      />
      <Button
        type={onFilter ? "button" : "submit"}
        size="icon"
        aria-label={onFilter ? "Abrir filtros" : "Buscar"}
        onClick={onFilter}
        className="search-button rounded-[14px]"
      >
        {onFilter ? <img src="/assets/figma/filter.svg" alt="" /> : <Search size={18} aria-hidden="true" />}
      </Button>
    </form>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Paginação"
      className="mt-10 flex items-center justify-end gap-2"
    >
      {page > 1 && (
        <Button
          variant="outline"
          size="icon"
          className="size-8 min-h-8 rounded"
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </Button>
      )}
      {Array.from({ length: totalPages }, (_, index) => index + 1).map(
        (item) => (
          <Button
            key={item}
            variant={item === page ? "primary" : "outline"}
            size="icon"
            className="size-8 min-h-8 rounded"
            onClick={() => onPage(item)}
            aria-current={item === page ? "page" : undefined}
          >
            {item}
          </Button>
        ),
      )}
      {page < totalPages && (
        <Button
          variant="outline"
          size="icon"
          className="size-8 min-h-8 rounded"
          onClick={() => onPage(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight size={16} />
        </Button>
      )}
    </nav>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
      {Array.from({ length: 9 }, (_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[0.86] rounded-2xl" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
function State({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface-card)] p-8 text-center">
      <p>{title}</p>
      <Button variant="outline" className="mt-4" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
