export const mockScenarios = [
  { id: "default", label: "Padrão", description: "Catálogo e compras sem falhas." },
  { id: "empty", label: "Catálogo vazio", description: "Nenhum NFT na listagem." },
  { id: "slow", label: "Rede lenta", description: "900 ms de latência em todas as chamadas REST." },
  { id: "variable-latency", label: "Latência variável", description: "Atraso estável entre 100 e 500 ms por URL." },
  { id: "out-of-order", label: "Respostas fora de ordem", description: "Busca por 'slow' demora mais que as demais." },
  { id: "offline", label: "Sem conexão", description: "Falha de rede nas chamadas REST." },
  { id: "server-error", label: "Erro 503", description: "API indisponível até trocar de cenário." },
  { id: "transient-error", label: "Falha transitória", description: "A primeira listagem de NFTs retorna 503." },
  { id: "request-timeout", label: "Timeout", description: "Resposta após o timeout de 10 segundos do Axios." },
  { id: "expired-session", label: "Sessão expirada", description: "Login expira após cinco segundos." },
  { id: "registration-conflict", label: "Conflito de cadastro", description: "Cadastro retorna erro 409." },
  { id: "expired-coupon", label: "Cupom expirado", description: "JUNGLE10 retorna conflito." },
  { id: "price-changed", label: "Preço alterado", description: "Emerald Ape 1/50 custa 1.49 ETH." },
  { id: "edition-sold-out", label: "Edição esgotada", description: "Emerald Ape 1/50 está indisponível." },
  { id: "order-timeout", label: "Timeout após pedido", description: "Pedido é criado, mas a primeira resposta falha." },
  { id: "payment-declined", label: "Pagamento recusado", description: "Pedido é registrado como recusado." },
] as const;

export type MockScenario = (typeof mockScenarios)[number]["id"];
