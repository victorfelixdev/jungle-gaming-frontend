# Kurio — marketplace de NFTs

Solução do [desafio frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge), baseada no [Figma do projeto](https://www.figma.com/design/oepxABnOLz97wt5NOVqCWl/Frontend-Challenge--Copy-?node-id=0-1). Inclui catálogo, detalhe, favoritos, carrinho, checkout, recibo, autenticação, perfil e carteiras em desktop e mobile. Compras, carteiras e eventos são simulados; nenhuma transação blockchain ou pagamento real é feito.

## Requisitos

- Node.js `^20.19.0` ou `>=22.12.0` (exigência do Vite 8) e npm.
- Chrome para a auditoria Lighthouse. O Playwright instala seu próprio Chromium para os testes.
- Nenhum backend, conta externa ou chave de API é necessário.

## Instalação e execução

```bash
npm ci
npm run dev
```

Abra a URL exibida pelo Vite, normalmente `http://localhost:5173`. O MSW inicia automaticamente no navegador e atende `/api`. Para conferir o build de produção local:

```bash
npm run build
npm run preview
```

O preview usa normalmente `http://localhost:4173`. Navegação direta e refresh das rotas funcionam no Vite preview. O arquivo `public/mockServiceWorker.js` precisa ser servido na raiz também quando a aplicação for publicada.

Na Vercel, `vercel.json` reescreve as URLs da aplicação para `index.html`, permitindo acesso direto e refresh em `/mock`, `/nft/:id`, `/cart` e demais rotas do TanStack Router. Configure o projeto como Vite com saída em `dist`; após publicar uma mudança de rota, faça um novo deploy e confira também `/mockServiceWorker.js` na raiz do domínio.

### Variáveis de ambiente

O arquivo `.env.example` mostra as opções. Copiar para `.env` é opcional: os valores padrão já habilitam o mock e escolhem o cenário normal.

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `VITE_ENABLE_MSW` | `true` | Use `false` somente se houver uma API compatível em `/api`; o projeto de demonstração usa `true`. |
| `VITE_MOCK_SCENARIO` | `default` | Cenário inicial. A seleção feita em `/mock` e salva no navegador tem prioridade. |

As variáveis `VITE_` são incorporadas ao build. Reinicie o servidor de desenvolvimento ou gere um novo build após alterá-las.

## Credenciais de demonstração

| E-mail | Senha |
| --- | --- |
| `ana@junglegaming.test` | `jungle123` |
| `caio@junglegaming.test` | `jungle123` |

Cada conta começa com carteiras fictícias “Reserva” e “Principal”. O cupom `JUNGLE10` aplica 10% de desconto no cenário normal. Dados de conta, carrinho, favoritos, NFTs e pedidos do mock persistem no armazenamento local do navegador. As senhas criadas ou alteradas são armazenadas no mock como hash com salt; esta simulação no navegador não é uma autenticação de produção.

## Como explorar os fluxos

1. Na home, pesquise, combine filtros e ordenação, ou abra um NFT. Os parâmetros ficam na URL e sobrevivem ao refresh e ao histórico.
2. No detalhe, escolha a edição e a quantidade, favorite após entrar na conta e adicione ao carrinho.
3. Abra o carrinho, altere quantidades ou use `JUNGLE10`; siga para o pagamento.
4. Entre com uma das contas, revise dados, carteira, rede, cotação e confirme. O pedido confirmado abre o recibo com os valores capturados na compra.
5. No perfil, edite dados e senha; em Carteiras, cadastre ou altere as carteiras da conta.

O carrinho de visitante é preservado ao autenticar. Rotas privadas encaminham ao login e retomam o destino depois da autenticação.

## Cenários de falha e tempo real

Abra `/mock`, escolha um cenário e volte à loja. **Trocar o cenário restaura os dados iniciais e encerra a sessão**; faça login novamente para os fluxos privados. “Resetar dados” restaura o cenário selecionado. A lista completa e os contratos dos controles REST estão em [docs/API.md](docs/API.md).

| Para reproduzir | Cenário e passos |
| --- | --- |
| Carregamento e recuperação | Selecione `slow`, `offline`, `server-error` ou `transient-error` e abra a home. Troque para `default` ou use a ação de nova tentativa quando disponível. |
| Respostas fora de ordem | Selecione `out-of-order` e alterne rapidamente buscas, incluindo `slow`. A listagem deve seguir a busca mais recente. |
| Expiração da sessão | Selecione `expired-session`, entre na conta e aguarde cinco segundos. Ao acessar uma rota privada, o login deve preservar o destino. |
| Cupom recusado | Selecione `expired-coupon`, entre, adicione um NFT e aplique `JUNGLE10` no carrinho. |
| Edição esgotada ou preço alterado | Selecione `edition-sold-out` ou `price-changed` e abra Emerald Ape #042. |
| Favorito revertido | Selecione `favorite-error`, entre e curta um NFT. A interface mostra a alteração imediata e a desfaz após a resposta 503. |
| Pedido após timeout | Selecione `order-timeout`, entre, compre um NFT e confirme. Use “Tentar novamente” para recuperar a mesma tentativa sem criar outro pedido. |
| Recusa ou desconexão | Selecione `payment-declined` ou `wallet-disconnected` antes de comprar. O carrinho deve permanecer. |
| Pedido pendente | Selecione `order-pending`, confirme uma compra e use o controle `POST /api/mock/orders/:id/status` para concluir ou recusar o ID mostrado na URL do pedido. |

Para simular uma mudança durante o checkout, deixe Emerald Ape #042 no carrinho e execute no Console do navegador, na mesma origem:

```js
await fetch('/api/mock/nfts/nft-aurora', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ editionId: 'ed-aurora', price: '1.49' }),
})
```

O endpoint altera a resposta REST e emite `nft.updated` pelo Socket.IO simulado. Carrinho e checkout devem avisar sobre a mudança e exigir revisão da cotação. O controle `PUT /api/mock/realtime` com `{ "connected": false }` e depois `true` simula desconexão e reconexão; os dados ativos são reconciliados com a API. Consulte [docs/API.md](docs/API.md) para os demais eventos e formatos.

## Verificações

```bash
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm run lighthouse
```

O Playwright inicia seu próprio build e preview em `127.0.0.1:4173`, usa Chromium desktop e mobile, produz `playwright-report/` e guarda trace na primeira repetição de uma falha. Os baselines visuais versionados foram gerados no Windows; em outro sistema operacional, revise e gere baselines próprios antes de comparar pixels. Para abrir o relatório, use `npx playwright show-report`.

`npm run lighthouse` precisa do Chrome local, mede home e detalhe três vezes em desktop e mobile e grava HTML, JSON e medianas em `reports/lighthouse/`. Resultados e condições da medição entregue estão em [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Estrutura e decisões

- `src/api/`: Axios, contratos e cliente Socket.IO.
- `src/mocks/`: fixtures, persistência, handlers MSW, cenários e eventos Socket.IO.
- `src/features/`: telas e fluxos; `src/routes/`: rotas TanStack Router.
- `tests/e2e/`: fluxos Playwright e regressão visual.
- [ARCHITECTURE.md](ARCHITECTURE.md): sessão, cache, idempotência, tempo real, acessibilidade, limitações e decisões de UX.
- [docs/API.md](docs/API.md): contratos REST, cenários e eventos.

Imagens e fontes necessárias à interface são servidas localmente em `public/assets/` e no build. O mock foi feito para demonstração e testes; pagamentos, carteiras e links de transação não representam serviços reais.
