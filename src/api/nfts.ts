import { queryOptions } from "@tanstack/react-query";
import type { Nft, NftFacets, NftListSearch, Page } from "./contracts";
import { apiClient } from "./client";

const toParams = (search: NftListSearch) => {
  const params = new URLSearchParams();
  if (search.query) params.set("query", search.query);
  search.categories?.forEach((category) => params.append("category", category));
  if (search.feed && search.feed !== "all") params.set("feed", search.feed);
  search.networks?.forEach((network) => params.append("network", network));
  if (search.minPrice !== undefined)
    params.set("minPrice", String(search.minPrice));
  if (search.maxPrice !== undefined)
    params.set("maxPrice", String(search.maxPrice));
  if (search.sort) params.set("sort", search.sort);
  if (search.page) params.set("page", String(search.page));
  if (search.pageSize) params.set("pageSize", String(search.pageSize));
  return params;
};

export const nftsQueryOptions = (search: NftListSearch) =>
  queryOptions({
    queryKey: ["nfts", search],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Page<Nft>>(`/nfts?${toParams(search).toString()}`, {
          signal,
        })
      ).data,
  });

export const nftFacetsQueryOptions = queryOptions({
  queryKey: ["nft-facets"],
  queryFn: async ({ signal }) =>
    (await apiClient.get<NftFacets>("/nfts/facets", { signal })).data,
});

export const nftQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["nft", id],
    queryFn: async ({ signal }) =>
      (await apiClient.get<Nft>(`/nfts/${id}`, { signal })).data,
  });
