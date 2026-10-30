# Auditoria Lighthouse

Data UTC: 2026-10-30T16:12:39.490Z

Ambiente: win32 10.0.26300 (x64); Node v26.8.1; Chrome 156.0.0.0; Lighthouse 13.6.0; Vite 8.3.5.
Build de produção com Vite preview em 127.0.0.1:4173; MSW habilitado, cenário default; perfis padrão Lighthouse mobile e desktop com throttling simulado; Chrome headless; armazenamento do navegador isolado por execução.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | desktop | 98 | 96 | 96 | 100 | 1118 ms | 0.002 | 0 ms |
| nft-detail | desktop | 100 | 96 | 96 | 100 | 787 ms | 0.001 | 0 ms |
| home | mobile | 91 | 100 | 96 | 100 | 3495 ms | 0.000 | 83 ms |
| nft-detail | mobile | 91 | 100 | 96 | 100 | 3443 ms | 0.004 | 57 ms |

Cada valor da tabela é a mediana de 3 execução(ões). Os relatórios individuais HTML/JSON e dados brutos estão nesta pasta.
