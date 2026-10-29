# API REST simulada

O MSW atende `/api` no navegador. Os tipos estão em `src/api/contracts.ts`, os handlers em `src/mocks/handlers.ts`. O mock não representa uma API de produção.

## Convenções

- JSON nas requisições e respostas, exceto exclusões e logout (`204`).
- Erros: `{ "code": string, "message": string, "fieldErrors"?: Record<string, string> }`. `401` indica sessão ausente ou expirada; `403`, recurso de outra conta; `404`, recurso inexistente; `409`, conflito de estado; `422`, campos inválidos.
- ETH é uma string decimal. A cotação calcula em wei, inclui a versão do carrinho e expira em cinco minutos.
- Sessão, favoritos, carrinho, carteiras, catálogo mutável e pedidos persistem no `localStorage`. Dados privados são separados por usuário.
- Contas de demonstração: `ana@junglegaming.test` e `caio@junglegaming.test`, senha `jungle123`.

## Endpoints

| Método e rota | Corpo/parâmetros | Resultado principal |
| --- | --- | --- |
| `GET /api/session` | — | Sessão atual ou `401`. |
| `POST /api/auth/login` | `{ email, password }` | Sessão ou `401 INVALID_CREDENTIALS`. |
| `POST /api/auth/register` | `{ name, email, password }` | Sessão `201`, `409 EMAIL_CONFLICT` ou `422`. |
| `POST /api/auth/logout` | — | `204`. |
| `GET /api/profile` | — | Usuário autenticado. |
| `PATCH /api/profile` | `{ name, email, username?, ensName?, walletNickname?, avatarUrl?, currentPassword?, newPassword? }` | Sessão atualizada; valida e-mail e senha atual. |
| `GET /api/nfts` | `query`, `category` e `network` repetíveis, `feed=all\|new\|trending`, `minPrice`, `maxPrice`, `sort=featured\|newest\|price-asc\|price-desc`, `page`, `pageSize` | `{ items, page, pageSize, total, totalPages }`; tamanho máximo de página 24. |
| `GET /api/nfts/facets` | — | Contagens reais por categoria e rede. |
| `GET /api/nfts/:id` | ID ou slug | NFT e edições; `404 NFT_NOT_FOUND`. |
| `GET /api/favorites` | — | Favoritos da conta. |
| `POST /api/favorites/:nftId` | — | Adiciona favorito (`201`). |
| `DELETE /api/favorites/:nftId` | — | Remove favorito (`204`). |
| `GET /api/cart` | — | `{ items, version }` da conta. |
| `POST /api/cart/items` | `{ nftId, editionId, quantity }` | Carrinho (`201`); soma a um item existente e verifica estoque. |
| `PATCH /api/cart/items/:itemId` | `{ quantity }` | Carrinho; quantidade inteira entre 1 e o estoque disponível. |
| `DELETE /api/cart/items/:itemId` | — | `204`. |
| `POST /api/quotes` | `{ coupon? }` | `{ cartVersion, subtotal, discount, networkFee, total, coupon?, expiresAt }`; `JUNGLE10` aplica 10%. |
| `GET /api/wallets` | — | Carteiras da conta. |
| `POST /api/wallets` | Dados de `Wallet` sem `id` | Carteira (`201`); valida campos e endereço duplicado. |
| `PATCH /api/wallets/:walletId` | Campos parciais de `Wallet` | Carteira atualizada; `403` se pertencer a outra conta. |
| `POST /api/orders` | `{ walletId, provider?, quote, idempotencyKey }` | Pedido (`201`); repetição da mesma chave e corpo devolve o pedido (`200`). |
| `GET /api/orders/:orderId` | — | Pedido da conta; `403` para pedido de outra conta. |

O pedido só confirma com itens, carteira da conta, estoque e cotação atuais. Chave de idempotência reutilizada com outro corpo retorna `409 IDEMPOTENCY_CONFLICT`. Confirmação limpa o carrinho; recusa o preserva. O recibo usa um snapshot dos itens e da cotação.

## Cenários determinísticos

A rota `/mock` permite escolher um cenário e reiniciar o estado. A troca de cenário reinicia os dados da demonstração. Controles REST:

| Método e rota | Efeito |
| --- | --- |
| `GET /api/mock/scenario` | Retorna `current` e a lista de cenários. |
| `PUT /api/mock/scenario` | `{ "scenario": "id" }` seleciona o cenário e reinicia os dados. |
| `POST /api/mock/reset` | Reinicia os dados mantendo o cenário selecionado. |
| `POST /api/mock/nfts/:id` | `{ "editionId": "...", "price"?: "1.49", "availableQuantity"?: 0 }` altera a edição, incrementa `version` e persiste até o próximo reset. |

Os controles permanecem acessíveis mesmo nos cenários de desconexão e 503.

| Cenário | Comportamento |
| --- | --- |
| `default` | Fluxo normal. |
| `empty` | Catálogo vazio. |
| `slow` | 900 ms por chamada REST. |
| `variable-latency` | Atraso estável de 100–500 ms por URL. |
| `out-of-order` | Busca `query=slow` termina depois das demais. |
| `offline` | Falha de rede nas chamadas REST. |
| `server-error` | Chamadas REST respondem 503. |
| `transient-error` | Primeira listagem de NFTs responde 503; seguinte funciona. |
| `request-timeout` | Resposta ultrapassa os 10 segundos de timeout do Axios. |
| `expired-session` | Login cria sessão que expira em cinco segundos. |
| `registration-conflict` | Cadastro responde `409 EMAIL_CONFLICT`. |
| `expired-coupon` | `JUNGLE10` responde `409 COUPON_EXPIRED`. |
| `price-changed` | Edição `ed-aurora` passa a 1.49 ETH. |
| `edition-sold-out` | Edição `ed-aurora` fica sem estoque. |
| `order-timeout` | Primeiro envio cria o pedido, mas perde a resposta; reenvio com a mesma chave o recupera. |
| `payment-declined` | Pedido recebe status `declined` e preserva o carrinho. |

A ligação completa dessas respostas a todas as telas e os eventos Socket.IO ficam para as próximas etapas.
