import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Nft } from "@/api/contracts";
import { nftsQueryOptions } from "@/api/nfts";

const firstSlide = [
  "cosmic-bloom-118",
  "violet-nomad-314",
  "ivory-baron-088",
  "golden-beat-207",
  "golden-signal-160",
];

export function RelatedNfts({
  nft,
  excludeIds = [],
  title = "Mais desta coleção",
  variant = "default",
}: {
  nft?: Nft;
  excludeIds?: string[];
  title?: string;
  variant?: "default" | "cart";
}) {
  const [slide, setSlide] = useState(0);
  const catalog = useQuery(nftsQueryOptions({ page: 1, pageSize: 24, sort: "featured" }));

  const related = (catalog.data?.items ?? [])
    .filter(
      (item) =>
        item.id !== nft?.id &&
        !excludeIds.includes(item.id) &&
        (!nft || item.artist === nft.artist),
    )
    .sort((a, b) => {
      const aIndex = firstSlide.indexOf(a.slug);
      const bIndex = firstSlide.indexOf(b.slug);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  const slideCount = Math.min(3, Math.ceil(related.length / 5));
  const currentSlide = Math.min(slide, Math.max(slideCount - 1, 0));
  const visible = related.slice(currentSlide * 5, currentSlide * 5 + 5);

  if (!catalog.isPending && related.length === 0) return null;

  return (
    <section className="mt-20" aria-labelledby="related-nfts-title">
      <h2
        id="related-nfts-title"
        className="border-b border-[var(--border)] pb-2 text-sm font-bold text-[var(--accent)]"
      >
        {title}
      </h2>
      <div className={`${variant === "cart" ? "mt-8" : "mt-5"} grid grid-cols-3 gap-5 lg:grid-cols-5`}>
        {catalog.isPending
          ? Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="aspect-square animate-pulse rounded-md bg-[var(--surface-card)]" />
            ))
          : visible.map((item) => (
              <Link
                key={item.id}
                to="/nft/$nftId"
                params={{ nftId: item.id }}
                className="group min-w-0"
              >
                <div className="rounded-md bg-[var(--surface-card)] p-3">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl object-cover transition-transform group-hover:scale-[1.02]"
                  />
                </div>
                <p className="mt-2 truncate text-xs group-hover:text-[var(--accent)]">{item.name}</p>
                <p className="text-xs font-bold text-[var(--accent)]">{item.editions[0]?.price} ETH</p>
              </Link>
            ))}
      </div>
      {slideCount > 1 && (
        <div className="mt-6 flex justify-center gap-2" aria-label="Páginas de NFTs relacionados">
          {Array.from({ length: slideCount }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSlide(index)}
              aria-label={`Ver página ${index + 1} de NFTs relacionados`}
              aria-current={currentSlide === index ? "page" : undefined}
              className={`cursor-pointer size-2 rounded-full border border-[var(--primary)] ${currentSlide === index ? "bg-[var(--primary)]" : ""}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
