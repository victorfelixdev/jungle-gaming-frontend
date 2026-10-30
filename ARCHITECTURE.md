# Arquitetura

## Princípios

- A interface consome contratos tipados por Axios; componentes e hooks não simulam dados de negócio.
- MSW é a camada de simulação REST, persistência e falhas. A rota `/mock` seleciona cenários determinísticos para desenvolvimento e testes.
- TanStack Query é a fonte do estado remoto; chaves incluem usuário e parâmetros da consulta.
- TanStack Router controla rotas, URL do catálogo e proteção dos fluxos privados.
- Eventos passam por `socket.io-client` e pelo binding Socket.IO do MSW, com versão para ignorar duplicatas e eventos antigos.

## Convenções iniciais de cache

| Recurso | Chave | Política inicial |
| --- | --- | --- |
| Catálogo | `['nfts', search]` | Atualização em segundo plano; filtros e paginação pertencem à URL. |
| Detalhe | `['nft', id]` | Invalidado por mutation ou `nft.updated`. |
| Dados privados | `['user', userId, resource]` | Removidos no logout, expiração ou troca de usuário. |
| Cotação | `['quote', userId, coupon, cartVersion]` | Sempre revalidada antes do pedido. |
| Pedido | `['order', userId, orderId]` | Reconciliado após reconexão e atualizado por `order.updated`. |

## Regras de integridade

- ETH trafega como string decimal; cálculos futuros usarão decimal arithmetic, nunca `number`.
- Pedidos receberão chave de idempotência; um reenvio com a mesma chave recupera o mesmo pedido.
- O recibo é um snapshot imutável do pedido.
- O carrinho anônimo será persistido localmente e conciliado ao autenticar.

## Sessão e rotas

- A sessão é consultada por TanStack Query antes de entrar em checkout, perfil, carteiras e pedidos. Rotas privadas forçam uma nova consulta REST; a consulta também é repetida ao voltar à aba e a cada 15 segundos enquanto há sessão.
- Uma rota privada sem sessão redireciona para `/login` com caminho e parâmetros originais em `redirect`. A expiração durante a navegação limpa as consultas privadas e leva ao login; o carrinho e o cupom permanecem para a retomada.
- Logout e novo login limpam as consultas privadas. As chaves de carrinho, carteiras, cotação, favoritos e pedido incluem o ID do usuário; consultas públicas de NFTs não são apagadas.
- O cliente Query usa um retry para consultas. A sessão tem `staleTime: 0` para revalidar a proteção de rotas. Catálogo e detalhe mostram erro e ação de nova tentativa quando a API falha.
- O carrinho consulta cada NFT por ID, independentemente da página em que ele aparece no catálogo. Para usuários autenticados, valores e cupom exibidos vêm de `POST /quotes`, indexados por usuário, cupom e versão do carrinho. O carrinho anônimo mostra uma estimativa local até o login.
- Favoritos exibidos no detalhe usam a resposta da API no cache Query. A mutação cancela consultas pendentes, atualiza o cache imediatamente e restaura o valor anterior se a API falhar; ao terminar, revalida a lista. Os dados privados não usam uma segunda cópia local da lista de favoritos.
- Antes de enviar um pedido, o checkout grava payload e chave de idempotência no `sessionStorage`, separados pelo ID do usuário. Um timeout mantém a tentativa; retry ou refresh a reenvia com o mesmo payload. Uma resposta terminal limpa a tentativa. Se a cotação expira e seus valores mudam, a compra para e exige revisão do novo total.
- Pedidos podem estar pendentes, confirmados ou recusados. O evento privado `order.updated` atualiza o pedido em tempo real. A página ainda consulta a API a cada dois segundos enquanto ele está pendente, para recuperar mudanças caso a conexão caia, e revalida ao retornar à aba.
- `RealtimeSync` só importa o cliente Socket.IO após o MSW iniciar, pois o Engine.IO captura a implementação de `WebSocket` no carregamento do módulo. Na conexão e reconexão, consultas REST de catálogo, detalhe, carrinho, cotação e pedido são revalidadas. Eventos trazem ID e versão; versões antigas ou repetidas são ignoradas. A inscrição privada acompanha o usuário autenticado e é removida quando ele sai ou troca de conta.
- Quando um NFT do carrinho muda, o carrinho avisa sobre preço ou disponibilidade. O checkout desabilita a confirmação até a pessoa revisar a cotação atual; o servidor também rejeita cotações antigas ou indisponibilidade.
- O mock grava `lines` no pedido com nome, imagem, edição e preço no momento da compra. O recibo usa esse snapshot, independentemente de mudanças posteriores no catálogo. Ao confirmar, o mock retira apenas as quantidades compradas do carrinho; uma recusa o preserva.
- No mock, a sessão e os dados da conta sobrevivem ao refresh no armazenamento local. As senhas das contas criadas e alteradas são persistidas apenas como hash com salt. Credenciais de fixture ficam no código de demonstração. Isso não representa autenticação segura de produção: o mock inteiro executa no navegador.
- Busca, filtros, ordenação e paginação do catálogo pertencem aos parâmetros da rota inicial e são normalizados antes da tela usar os valores.

## Acessibilidade e responsividade

- Controles interativos exibem foco visível. O modal de autenticação, a imagem ampliada do NFT e o painel de filtros mobile retêm o foco por teclado, fecham com Escape e devolvem o foco ao controle que os abriu. O recibo também mantém o foco no diálogo enquanto está aberto.
- No mobile, o ícone de filtros abre um painel com coleção, rede e faixa de preço. A busca continua pelo campo de texto com Enter; os filtros combinados permanecem na URL.
- Skeletons usam shimmer apenas quando a pessoa não solicita movimento reduzido; catálogo, detalhe e carregamento do carrinho preservam espaço para o conteúdo. Alterações de preço e disponibilidade têm feedback anunciado no detalhe, no carrinho e no checkout.
- Os testes de navegador verificam ausência de overflow horizontal em 390, 768 e 1440 px nas páginas principais, de conta e de pagamento.
- Playwright cobre busca, filtros, ordenação e paginação na URL, navegação direta para NFT ausente e reversão de favorito após falha. Capturas de home, detalhe, carrinho e checkout têm baselines separados para desktop e mobile em `tests/e2e/visual.spec.ts-snapshots/`.
- Para verificar localmente, execute `npm run test:e2e`; o relatório HTML fica em `playwright-report/`. Quando uma mudança visual for intencional, revise as diferenças antes de atualizar baselines com `npx playwright test tests/e2e/visual.spec.ts --update-snapshots`.

## Estrutura alvo

```text
src/
  api/           cliente Axios e contratos de transporte
  components/    componentes visuais compartilhados e shadcn/ui
  features/      catálogo, carrinho, checkout, conta e pedidos
  lib/           utilitários transversais
  mocks/         fixtures, estado e handlers MSW/Socket.IO
  routes/        composição de rotas TanStack Router
  styles/        tokens e estilos globais
```

Os contratos REST, eventos Socket.IO e cenários de falha estão em `docs/API.md`.
