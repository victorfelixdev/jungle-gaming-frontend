# Auditoria de performance

Execute `npm run lighthouse` a partir da raiz do projeto com o Chrome instalado. O comando compila a aplicação, inicia o preview local e mede a home (`/`) e o detalhe (`/nft/nft-aurora`) três vezes em cada perfil. As metas e URLs estão em `lighthouserc.cjs`; o script em `scripts/lighthouse-audit.mjs` valida o perfil efetivo de cada execução e falha se alguma mediana ficar abaixo da meta.

Os 12 relatórios HTML e JSON, os valores individuais e o ambiente de execução estão versionados em `reports/lighthouse/`. O resumo abaixo é a mediana de cada grupo de três medições, coletado em 30 de outubro de 2026 com build de produção, Vite preview, MSW no cenário padrão e Chrome headless. Lighthouse usou seus perfis desktop e mobile com throttling simulado. Não havia outras tarefas pesadas rodando durante a medição.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Desktop | 98 | 96 | 96 | 100 | 1.118 ms | 0,002 | 0 ms |
| Detalhe | Desktop | 100 | 96 | 96 | 100 | 787 ms | 0,001 | 0 ms |
| Início | Mobile | 91 | 100 | 96 | 100 | 3.495 ms | 0,000 | 83 ms |
| Detalhe | Mobile | 91 | 100 | 96 | 100 | 3.443 ms | 0,004 | 57 ms |

Todas as medianas atingiram as metas do desafio. A home mobile variou entre 89 e 91 em execuções individuais; a mediana foi 91. Resultados podem variar conforme máquina, versão do Chrome e concorrência de processos.

## Análise e decisões

- O maior elemento da home mobile era o SVG de fundo do hero. Antes da alteração, o navegador só descobria esse arquivo depois de carregar o JavaScript; a mediana de Performance era 86 e o LCP, 4,19 s. O preload no HTML e `fetchPriority="high"` anteciparam o recurso sem modificar o visual.
- O módulo do MSW era carregado depois do JavaScript principal, criando uma segunda etapa de rede antes de renderizar a aplicação. A importação inicial eliminou essa dependência em sequência. O MSW continua ativo no build e os testes de compra e Socket.IO passaram depois da alteração.
- `robots.txt` evita que a rota de fallback entregue HTML para o robô, e o favicon elimina um 404 no carregamento. O SEO passou a 100. Best Practices permaneceu em 96 porque a consulta anônima de `/api/session` retorna 401, resposta esperada pelo contrato da API simulada.
- O bundle inicial ainda contém a interface e o MSW: cerca de 1,04 MB antes de gzip e 345 KB após gzip no build medido. A nota e o LCP mobile dependem da inicialização do mock no navegador. Separar mais código por rota é uma melhoria possível, desde que preserve os fluxos e a fidelidade visual auditados.

Os números detalhados, as versões exatas de Node, Chrome, Lighthouse e Vite, e os parâmetros de throttling de cada execução estão em `reports/lighthouse/summary.json` e nos relatórios JSON individuais.
