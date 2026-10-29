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
| Cotação | `['quote', userId, cartVersion]` | Sempre revalidada antes do pedido. |
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
- O cliente Query usa um retry para consultas. A sessão tem `staleTime: 0` para revalidar a proteção de rotas; as demais consultas seguem os valores padrão da biblioteca até a política detalhada da etapa de integração.
- No mock, a sessão e os dados da conta sobrevivem ao refresh no armazenamento local. As senhas das contas criadas e alteradas são persistidas apenas como hash com salt. Credenciais de fixture ficam no código de demonstração. Isso não representa autenticação segura de produção: o mock inteiro executa no navegador.
- Busca, filtros, ordenação e paginação do catálogo pertencem aos parâmetros da rota inicial e são normalizados antes da tela usar os valores.

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

Os contratos e cenários REST disponíveis estão em `docs/API.md`. Eventos Socket.IO e a UX de recuperação serão registrados nas etapas correspondentes.
