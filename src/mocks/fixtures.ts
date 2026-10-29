import type { Nft, User } from "@/api/contracts";
import { seededNfts } from "./catalog-seed";

export const users: Array<User & { password: string }> = [
  {
    id: "u-ana",
    name: "Ana Silva",
    email: "ana@junglegaming.test",
    password: "jungle123",
    avatarUrl: "https://i.pravatar.cc/160?img=47",
  },
  {
    id: "u-caio",
    name: "Caio Alves",
    email: "caio@junglegaming.test",
    password: "jungle123",
    avatarUrl: "https://i.pravatar.cc/160?img=12",
  },
];

const originalNfts: Nft[] = [
  {
    id: "nft-aurora",
    slug: "emerald-ape-042",
    name: "Emerald Ape #042",
    artist: "Kurio Studio",
    description: "Retrato digital da coleção Emerald Ape.",
    imageUrl: "/assets/figma/nft-1.png",
    category: "Arte",
    network: "ethereum",
    tags: ["ape", "digital"],
    editions: [
      {
        id: "ed-aurora-10-a",
        name: "1/10",
        price: "1.19",
        availableQuantity: 10,
      },
      {
        id: "ed-aurora-10-b",
        name: "1/10",
        price: "1.19",
        availableQuantity: 10,
      },
      { id: "ed-aurora", name: "1/50", price: "1.19", availableQuantity: 50 },
      {
        id: "ed-aurora-open",
        name: "ABERTA",
        price: "1.19",
        availableQuantity: 100,
      },
    ],
    createdAt: "2026-10-01T10:00:00.000Z",
    version: 1,
  },
  {
    id: "nft-jungle",
    slug: "sage-nomad-009",
    name: "Sage Nomad #009",
    artist: "Kurio Studio",
    description: "Retrato digital da coleção Sage Nomad.",
    imageUrl: "/assets/figma/nft-2.png",
    category: "Fotografia",
    network: "polygon",
    tags: ["ape", "portrait"],
    editions: [
      { id: "ed-jungle-a", name: "Open", price: "1.69", availableQuantity: 12 },
      {
        id: "ed-jungle-b",
        name: "Collector",
        price: "2.20",
        availableQuantity: 2,
      },
    ],
    createdAt: "2026-10-10T10:00:00.000Z",
    version: 1,
  },
  {
    id: "nft-neon",
    slug: "neon-vessel-455",
    name: "Neon Vessel #455",
    artist: "Kurio Studio",
    description: "Retrato digital Neon Vessel.",
    imageUrl: "/assets/figma/nft-3.png",
    category: "Arte",
    network: "ethereum",
    tags: ["ape", "rare"],
    editions: [
      { id: "ed-neon", name: "Standard", price: "1.99", availableQuantity: 20 },
    ],
    createdAt: "2026-10-15T10:00:00.000Z",
    version: 1,
  },
  {
    id: "nft-tide",
    slug: "golden-echo-007",
    name: "Golden Echo #007",
    artist: "Kurio Studio",
    description: "Retrato digital Golden Echo.",
    imageUrl: "/assets/figma/nft-4.png",
    category: "Fotografia",
    network: "solana",
    tags: ["ape", "gold"],
    editions: [
      {
        id: "ed-tide",
        name: "One of One",
        price: "2.50",
        availableQuantity: 1,
      },
    ],
    createdAt: "2026-09-20T10:00:00.000Z",
    version: 1,
  },
];

export const nfts: Nft[] = [
  originalNfts[0],
  originalNfts[1],
  ...seededNfts.slice(0, 7),
  originalNfts[2],
  originalNfts[3],
  ...seededNfts.slice(7),
];
