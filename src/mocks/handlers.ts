import { HttpResponse, http, type HttpResponseResolver } from "msw";
import type {
  ApiError,
  CartItemInput,
  CreateOrderInput,
  Credentials,
  NftListSearch,
  Quote,
  RegisterInput,
  User,
  Wallet,
} from "@/api/contracts";
import { mockState } from "./state";
import type { MockOrder } from "./state";
import { users as fixtureUsers } from "./fixtures";
import { hashPassword, newPasswordSalt } from "./password";
import { applyMockNetwork, getMockScenario, mockScenarios, resetNetworkCounters, setMockScenario, type MockScenario } from "./scenarios";

const api = "/api";
const withNetwork = (resolver: HttpResponseResolver): HttpResponseResolver => async (info) => {
  const response = await applyMockNetwork(info.request);
  return response ?? resolver(info);
};
const mockHttp = {
  get: (path: string, resolver: HttpResponseResolver) => http.get(path, withNetwork(resolver)),
  post: (path: string, resolver: HttpResponseResolver) => http.post(path, withNetwork(resolver)),
  patch: (path: string, resolver: HttpResponseResolver) => http.patch(path, withNetwork(resolver)),
  delete: (path: string, resolver: HttpResponseResolver) => http.delete(path, withNetwork(resolver)),
};
const error = (
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
) => HttpResponse.json<ApiError>({ code, message, fieldErrors }, { status });
const unauthorized = () =>
  error(401, "UNAUTHORIZED", "Faça login para continuar.");
const toPublicUser = ({
  id,
  name,
  email,
  avatarUrl,
  username,
  ensName,
  walletNickname,
}: User) => ({ id, name, email, avatarUrl, username, ensName, walletNickname });
const toPublicOrder = ({ requestFingerprint: _fingerprint, ...order }: MockOrder) => {
  void _fingerprint;
  return order;
};
const walletErrors = (wallet: Partial<Wallet>) => {
  const errors: Record<string, string> = {};
  if (!wallet.label?.trim()) errors.label = "Informe o apelido da carteira.";
  if (!wallet.address?.trim()) errors.address = "Informe o endereço da carteira.";
  if (wallet.network !== "ethereum" && wallet.network !== "polygon") errors.network = "Selecione uma rede válida.";
  if (wallet.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wallet.email)) errors.email = "Informe um e-mail válido.";
  return errors;
};
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
const quoteFor = (userId: string, coupon?: string): Quote | ApiError => {
  const cart = mockState.cartFor(userId);
  let subtotal = 0n;
  for (const item of cart.items) {
    const nft = mockState.get().nfts.find(({ id }) => id === item.nftId);
    const edition = nft?.editions.find(({ id }) => id === item.editionId);
    if (!edition || edition.availableQuantity < item.quantity)
      return {
        code: "AVAILABILITY_CONFLICT",
        message: "Uma edição não está mais disponível.",
      };
    subtotal += toWei(edition.price) * BigInt(item.quantity);
  }
  if (coupon === "JUNGLE10" && getMockScenario() === "expired-coupon")
    return { code: "COUPON_EXPIRED", message: "Este cupom expirou." };
  if (coupon && coupon !== "JUNGLE10")
    return {
      code: "INVALID_COUPON",
      message: "Este cupom é inválido ou expirou.",
    };
  const discount = coupon ? subtotal / 10n : 0n;
  const networkFee = subtotal === 0n ? 0n : 16n * 10n ** 15n;
  return {
    cartVersion: cart.version,
    subtotal: fromWei(subtotal),
    discount: fromWei(discount),
    networkFee: fromWei(networkFee),
    total: fromWei(subtotal - discount + networkFee),
    coupon,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
};

export const handlers = [
  http.get(`${api}/mock/scenario`, () => HttpResponse.json({ current: getMockScenario(), scenarios: mockScenarios })),
  http.put(`${api}/mock/scenario`, async ({ request }) => {
    const { scenario } = await request.json() as { scenario: string };
    if (!mockScenarios.some(({ id }) => id === scenario)) return error(422, "INVALID_SCENARIO", "Cenário desconhecido.");
    setMockScenario(scenario as MockScenario);
    mockState.reset();
    resetNetworkCounters();
    return HttpResponse.json({ current: getMockScenario() });
  }),
  http.post(`${api}/mock/reset`, () => {
    mockState.reset();
    resetNetworkCounters();
    return HttpResponse.json({ current: getMockScenario() });
  }),
  mockHttp.get(`${api}/session`, () => {
    const session = mockState.session();
    return session ? HttpResponse.json(session) : unauthorized();
  }),
  mockHttp.post(`${api}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as Credentials;
    const account = mockState
      .get()
      .users.find(({ email }) => email === body.email);
    const fixturePassword = fixtureUsers.find(({ id }) => id === account?.id)?.password;
    const validPassword = account && (account.passwordHash && account.passwordSalt
      ? account.passwordHash === await hashPassword(body.password, account.passwordSalt)
      : fixturePassword === body.password);
    if (!validPassword)
      return error(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");
    mockState.get().session = {
      user: toPublicUser(account),
      expiresAt: new Date(Date.now() + (getMockScenario() === "expired-session" ? 5_000 : 60 * 60_000)).toISOString(),
    };
    mockState.persist();
    return HttpResponse.json(mockState.get().session);
  }),
  mockHttp.post(`${api}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as RegisterInput;
    if (getMockScenario() === "registration-conflict")
      return error(409, "EMAIL_CONFLICT", "Este e-mail já está em uso.", { email: "E-mail já cadastrado." });
    const fieldErrors: Record<string, string> = {};
    if (!body.name?.trim()) fieldErrors.name = "Informe o nome de usuário.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email ?? "")) fieldErrors.email = "Informe um e-mail válido.";
    if (!body.password || body.password.length < 8) fieldErrors.password = "Use ao menos 8 caracteres.";
    if (Object.keys(fieldErrors).length)
      return error(422, "VALIDATION_ERROR", "Revise os campos obrigatórios.", fieldErrors);
    if (mockState.get().users.some(({ email }) => email.toLowerCase() === body.email.toLowerCase()))
      return error(409, "EMAIL_CONFLICT", "Este e-mail já está em uso.", {
        email: "E-mail já cadastrado.",
      });
    const passwordSalt = newPasswordSalt();
    const user = {
      id: `u-${crypto.randomUUID()}`,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      passwordSalt,
      passwordHash: await hashPassword(body.password, passwordSalt),
    };
    mockState.get().users.push(user);
    mockState.get().session = {
      user: toPublicUser(user),
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    };
    mockState.persist();
    return HttpResponse.json(mockState.get().session, { status: 201 });
  }),
  mockHttp.post(`${api}/auth/logout`, () => {
    mockState.get().session = null;
    mockState.persist();
    return new HttpResponse(null, { status: 204 });
  }),
  mockHttp.get(`${api}/profile`, () => {
    const user = mockState.requireUser();
    return user ? HttpResponse.json(user) : unauthorized();
  }),
  mockHttp.patch(`${api}/profile`, async ({ request }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const input = (await request.json()) as Pick<
      User,
      "name" | "email" | "username" | "ensName" | "walletNickname"
    > & {
      avatarUrl?: string | null;
      currentPassword?: string;
      newPassword?: string;
    };
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const fieldErrors: Record<string, string> = {};
    if (!name) fieldErrors.name = "Informe o nome de exibição.";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Informe um e-mail válido.";
    if (Object.keys(fieldErrors).length)
      return error(422, "VALIDATION_ERROR", "Preencha nome e e-mail válidos.", fieldErrors);
    const account = mockState.get().users.find(({ id }) => id === user.id);
    if (!account) return unauthorized();
    if (mockState.get().users.some(({ id, email: saved }) => id !== user.id && saved === email))
      return error(409, "EMAIL_CONFLICT", "Este e-mail já está em uso.", { email: "E-mail já cadastrado." });
    if (input.newPassword) {
      const fixturePassword = fixtureUsers.find(({ id }) => id === account.id)?.password;
      const passwordMatches = fixturePassword && !account.passwordHash
        ? fixturePassword === input.currentPassword
        : Boolean(account.passwordHash && account.passwordSalt && input.currentPassword &&
            account.passwordHash === await hashPassword(input.currentPassword, account.passwordSalt));
      if (!passwordMatches)
        return error(400, "INVALID_PASSWORD", "Senha atual incorreta.");
      if (input.newPassword.length < 8)
        return error(422, "VALIDATION_ERROR", "Use ao menos 8 caracteres na nova senha.");
    }
    account.name = name;
    account.email = email;
    account.username = input.username?.trim();
    account.ensName = input.ensName?.trim();
    account.walletNickname = input.walletNickname?.trim();
    if (input.avatarUrl !== undefined)
      account.avatarUrl = input.avatarUrl ?? undefined;
    if (input.newPassword) {
      account.passwordSalt = newPasswordSalt();
      account.passwordHash = await hashPassword(input.newPassword, account.passwordSalt);
    }
    const session = mockState.get().session!;
    session.user = toPublicUser(account);
    mockState.persist();
    return HttpResponse.json(session);
  }),
  mockHttp.get(`${api}/nfts`, ({ request }) => {
    const url = new URL(request.url);
    const search: NftListSearch = {
      query: url.searchParams.get("query") ?? undefined,
      categories: url.searchParams.getAll("category"),
      feed: (url.searchParams.get("feed") as NftListSearch["feed"]) ?? "all",
      networks: url.searchParams.getAll("network") as NftListSearch["networks"],
      minPrice: url.searchParams.has("minPrice")
        ? Number(url.searchParams.get("minPrice"))
        : undefined,
      maxPrice: url.searchParams.has("maxPrice")
        ? Number(url.searchParams.get("maxPrice"))
        : undefined,
      sort:
        (url.searchParams.get("sort") as NftListSearch["sort"]) ?? "featured",
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 9),
    };
    let items = [...mockState.get().nfts];
    if (search.query) {
      const query = search.query.toLowerCase();
      items = items.filter((nft) =>
        `${nft.name} ${nft.artist} ${nft.tags.join(" ")}`
          .toLowerCase()
          .includes(query),
      );
    }
    if (search.categories?.length)
      items = items.filter((nft) => search.categories?.includes(nft.category));
    if (search.feed === "new") items = items.filter((nft) => nft.isNew);
    if (search.feed === "trending")
      items = items.filter((nft) => (nft.popularity ?? 0) >= 70);
    if (search.networks?.length)
      items = items.filter(
        (nft) => nft.network && search.networks?.includes(nft.network),
      );
    if (search.minPrice !== undefined)
      items = items.filter(
        (nft) => Number(nft.editions[0]?.price) >= search.minPrice!,
      );
    if (search.maxPrice !== undefined)
      items = items.filter(
        (nft) => Number(nft.editions[0]?.price) <= search.maxPrice!,
      );
    if (search.sort === "featured" && search.feed === "new")
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (search.sort === "featured" && search.feed === "trending")
      items.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    if (search.sort === "newest")
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (search.sort?.startsWith("price"))
      items.sort(
        (a, b) =>
          (Number(a.editions[0].price) - Number(b.editions[0].price)) *
          (search.sort === "price-asc" ? 1 : -1),
      );
    const page = Math.max(search.page ?? 1, 1);
    const pageSize = Math.min(Math.max(search.pageSize ?? 9, 1), 24);
    return HttpResponse.json({
      items: items.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    });
  }),
  mockHttp.get(`${api}/nfts/facets`, () => {
    const categories: Record<string, number> = {};
    const networks = { ethereum: 0, polygon: 0, solana: 0 };
    for (const nft of mockState.get().nfts) {
      categories[nft.category] = (categories[nft.category] ?? 0) + 1;
      if (nft.network) networks[nft.network] += 1;
    }
    return HttpResponse.json({ categories, networks });
  }),
  mockHttp.get(`${api}/nfts/:id`, ({ params }) => {
    const nft = mockState
      .get()
      .nfts.find(({ id, slug }) => id === params.id || slug === params.id);
    return nft
      ? HttpResponse.json(nft)
      : error(404, "NFT_NOT_FOUND", "NFT não encontrado.");
  }),
  http.post(`${api}/mock/nfts/:id`, async ({ params, request }) => {
    const nft = mockState.get().nfts.find(({ id }) => id === params.id);
    if (!nft) return error(404, "NFT_NOT_FOUND", "NFT não encontrado.");
    const input = await request.json() as { editionId: string; price?: string; availableQuantity?: number };
    const edition = nft.editions.find(({ id }) => id === input.editionId);
    if (!edition) return error(404, "EDITION_NOT_FOUND", "Edição não encontrada.");
    if (input.price !== undefined && !/^\d+(?:\.\d{1,18})?$/.test(input.price))
      return error(422, "VALIDATION_ERROR", "Preço inválido.", { price: "Informe ETH decimal positivo." });
    if (input.availableQuantity !== undefined && (!Number.isInteger(input.availableQuantity) || input.availableQuantity < 0))
      return error(422, "VALIDATION_ERROR", "Disponibilidade inválida.", { availableQuantity: "Informe um inteiro não negativo." });
    if (input.price !== undefined) edition.price = input.price;
    if (input.availableQuantity !== undefined) edition.availableQuantity = input.availableQuantity;
    nft.version += 1;
    mockState.persist();
    return HttpResponse.json(nft);
  }),
  mockHttp.get(`${api}/favorites`, () => {
    const user = mockState.requireUser();
    return user
      ? HttpResponse.json(mockState.favoritesFor(user.id))
      : unauthorized();
  }),
  mockHttp.post(`${api}/favorites/:nftId`, ({ params }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    if (!mockState.get().nfts.some(({ id }) => id === params.nftId))
      return error(404, "NFT_NOT_FOUND", "NFT não encontrado.");
    const favorites = mockState.favoritesFor(user.id);
    if (!favorites.some(({ nftId }) => nftId === params.nftId))
      favorites.push({
        nftId: String(params.nftId),
        createdAt: new Date().toISOString(),
      });
    mockState.persist();
    return HttpResponse.json(favorites, { status: 201 });
  }),
  mockHttp.delete(`${api}/favorites/:nftId`, ({ params }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const favorites = mockState.favoritesFor(user.id);
    const index = favorites.findIndex(({ nftId }) => nftId === params.nftId);
    if (index >= 0) favorites.splice(index, 1);
    mockState.persist();
    return new HttpResponse(null, { status: 204 });
  }),
  mockHttp.get(`${api}/cart`, () => {
    const user = mockState.requireUser();
    return user
      ? HttpResponse.json(mockState.cartFor(user.id))
      : unauthorized();
  }),
  mockHttp.post(`${api}/cart/items`, async ({ request }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const item = (await request.json()) as CartItemInput;
    const edition = mockState
      .get()
      .nfts.find(({ id }) => id === item.nftId)
      ?.editions.find(({ id }) => id === item.editionId);
    if (
      !edition ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > edition.availableQuantity
    )
      return error(409, "AVAILABILITY_CONFLICT", "Quantidade indisponível.");
    const cart = mockState.cartFor(user.id);
    const current = cart.items.find(
      ({ nftId, editionId }) =>
        nftId === item.nftId && editionId === item.editionId,
    );
    if (current && current.quantity + item.quantity > edition.availableQuantity)
      return error(409, "AVAILABILITY_CONFLICT", "Quantidade indisponível.");
    if (current) current.quantity += item.quantity;
    else cart.items.push({ id: crypto.randomUUID(), ...item });
    cart.version++;
    mockState.persist();
    return HttpResponse.json(cart, { status: 201 });
  }),
  mockHttp.patch(`${api}/cart/items/:itemId`, async ({ params, request }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const cart = mockState.cartFor(user.id);
    const item = cart.items.find(({ id }) => id === params.itemId);
    if (!item) return error(404, "CART_ITEM_NOT_FOUND", "Item não encontrado.");
    const { quantity } = (await request.json()) as { quantity: number };
    const edition = mockState
      .get()
      .nfts.find(({ id }) => id === item.nftId)
      ?.editions.find(({ id }) => id === item.editionId);
    if (!edition || !Number.isInteger(quantity) || quantity < 1 || quantity > edition.availableQuantity)
      return error(409, "AVAILABILITY_CONFLICT", "Quantidade indisponível.");
    item.quantity = quantity;
    cart.version++;
    mockState.persist();
    return HttpResponse.json(cart);
  }),
  mockHttp.delete(`${api}/cart/items/:itemId`, ({ params }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const cart = mockState.cartFor(user.id);
    const index = cart.items.findIndex(({ id }) => id === params.itemId);
    if (index < 0) return error(404, "CART_ITEM_NOT_FOUND", "Item não encontrado.");
    cart.items.splice(index, 1);
    cart.version++;
    mockState.persist();
    return new HttpResponse(null, { status: 204 });
  }),
  mockHttp.post(`${api}/quotes`, async ({ request }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const { coupon } = (await request.json()) as { coupon?: string };
    const quote = quoteFor(user.id, coupon);
    return "code" in quote
      ? error(409, quote.code, quote.message)
      : HttpResponse.json(quote);
  }),
  mockHttp.get(`${api}/wallets`, () => {
    const user = mockState.requireUser();
    return user
      ? HttpResponse.json(mockState.walletsFor(user.id))
      : unauthorized();
  }),
  mockHttp.post(`${api}/wallets`, async ({ request }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const input = (await request.json()) as Omit<Wallet, "id">;
    const fieldErrors = walletErrors(input);
    if (Object.keys(fieldErrors).length)
      return error(422, "VALIDATION_ERROR", "Revise os dados da carteira.", fieldErrors);
    if (mockState.walletsFor(user.id).some(({ address, network }) =>
      address.toLowerCase() === input.address.toLowerCase() && network === input.network))
      return error(409, "WALLET_CONFLICT", "Esta carteira já está cadastrada.", { address: "Endereço já cadastrado." });
    const wallet = {
      id: crypto.randomUUID(),
      ...input,
    };
    const wallets = mockState.walletsFor(user.id);
    if (wallet.isPrimary) wallets.forEach((item) => { item.isPrimary = false; });
    wallets.push(wallet);
    mockState.persist();
    return HttpResponse.json(wallet, { status: 201 });
  }),
  mockHttp.patch(`${api}/wallets/:walletId`, async ({ params, request }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const wallets = mockState.walletsFor(user.id);
    const wallet = wallets.find(({ id }) => id === params.walletId);
    if (!wallet) {
      const belongsToAnotherUser = Object.entries(mockState.get().walletsByUser)
        .some(([ownerId, wallets]) => ownerId !== user.id && wallets.some(({ id }) => id === params.walletId));
      return belongsToAnotherUser
        ? error(403, "FORBIDDEN", "Carteira de outro usuário.")
        : error(404, "WALLET_NOT_FOUND", "Carteira não encontrada.");
    }
    const changes = (await request.json()) as Partial<Omit<Wallet, "id">>;
    const fieldErrors = walletErrors({ ...wallet, ...changes });
    if (Object.keys(fieldErrors).length)
      return error(422, "VALIDATION_ERROR", "Revise os dados da carteira.", fieldErrors);
    if (changes.isPrimary) wallets.forEach((item) => { item.isPrimary = false; });
    Object.assign(wallet, changes);
    mockState.persist();
    return HttpResponse.json(wallet);
  }),
  mockHttp.get(`${api}/orders/:orderId`, ({ params }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const order =
      user &&
      mockState.ordersFor(user.id).find(({ id }) => id === params.orderId);
    if (order) return HttpResponse.json(toPublicOrder(order));
    const belongsToAnotherUser = Object.entries(mockState.get().ordersByUser)
      .some(([ownerId, orders]) => ownerId !== user?.id && orders.some(({ id }) => id === params.orderId));
    return belongsToAnotherUser
      ? error(403, "FORBIDDEN", "Pedido de outro usuário.")
      : error(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
  }),
  mockHttp.post(`${api}/orders`, async ({ request }) => {
    const user = mockState.requireUser();
    if (!user) return unauthorized();
    const input = (await request.json()) as CreateOrderInput;
    if (!input.idempotencyKey || !input.quote || !input.walletId)
      return error(422, "VALIDATION_ERROR", "Pedido incompleto.");
    if (!mockState.walletsFor(user.id).some(({ id }) => id === input.walletId))
      return error(422, "WALLET_NOT_FOUND", "Selecione uma carteira cadastrada.", { walletId: "Carteira inválida." });
    const orders = mockState.ordersFor(user.id);
    const requestFingerprint = JSON.stringify({ walletId: input.walletId, provider: input.provider, quote: input.quote });
    const existing = orders.find(
      ({ idempotencyKey }) => idempotencyKey === input.idempotencyKey,
    );
    if (existing) return existing.requestFingerprint === requestFingerprint
      ? HttpResponse.json(toPublicOrder(existing))
      : error(409, "IDEMPOTENCY_CONFLICT", "Esta chave já foi usada com outro pedido.");
    if (!Number.isFinite(Date.parse(input.quote.expiresAt)) || Date.parse(input.quote.expiresAt) <= Date.now())
      return error(409, "STALE_QUOTE", "A cotação expirou.");
    const quote = quoteFor(user.id, input.quote.coupon);
    if ("code" in quote || quote.total !== input.quote.total ||
        quote.cartVersion !== input.quote.cartVersion ||
        quote.subtotal !== input.quote.subtotal ||
        quote.discount !== input.quote.discount ||
        quote.networkFee !== input.quote.networkFee)
      return error(409, "STALE_QUOTE", "A cotação foi alterada.");
    const cart = mockState.cartFor(user.id);
    if (!cart.items.length) return error(409, "EMPTY_CART", "O carrinho está vazio.");
    const declined = getMockScenario() === "payment-declined";
    const order: MockOrder = {
      id: crypto.randomUUID(),
      status: declined ? "declined" : "confirmed",
      walletId: input.walletId,
      provider: input.provider,
      transactionId: `0x${crypto.randomUUID().replaceAll("-", "")}`,
      items: structuredClone(cart.items),
      quote,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
      createdAt: new Date().toISOString(),
      version: 1,
    };
    orders.push(order);
    if (!declined) {
      cart.items = [];
      cart.version++;
    }
    mockState.persist();
    if (getMockScenario() === "order-timeout") return HttpResponse.error();
    return HttpResponse.json(toPublicOrder(order), { status: 201 });
  }),
];
