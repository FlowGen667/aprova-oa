# Yamileth Gill — landing + painel

Landing page com popup de cadastro, rastreamento próprio de visitas/cliques e um painel em `/dashboard`
(métricas, CRM, tráfego, cliques e pixel). Roda em **Cloudflare Workers + D1**, e tudo funciona localmente.

## Rodar no computador

```bash
npm install          # só na primeira vez
npm run setup        # cria as tabelas no banco local (só na primeira vez)
npm run dev          # sobe o servidor
```

- Landing: http://localhost:8787
- Painel: http://localhost:8787/dashboard
- Senha do painel: está em `.dev.vars` (linha `DASHBOARD_PASSWORD`). Pode trocar à vontade; reinicie o `npm run dev` depois.

O banco local fica em `.wrangler/state` (não vai para o Git). Para começar do zero, apague essa pasta e rode `npm run setup` de novo.

## Estrutura

```
public/                  arquivos estáticos
  index.html             landing (hero, fita, sobre, por qué, catálogo, cierre, popup)
  site.js                rastreamento, pixels e popup de cadastro
  dashboard/
    login.html           tela de login
    index.html           painel (SPA com rotas #/resumen, #/crm, ...)
    assets/app.js        lógica do painel
    assets/charts.js     gráficos em SVG (sem bibliotecas)
    assets/app.css       visual do painel
src/worker.js            API (/api/*) e proteção do /dashboard
migrations/              tabelas do banco D1
wrangler.jsonc           configuração do Cloudflare
.dev.vars                senha e chave de sessão locais (não versionar)
```

## O que é rastreado

| Evento        | Quando                                         | Pixel Meta         | GA4              |
|---------------|------------------------------------------------|--------------------|------------------|
| `pageview`    | abriu a landing                                | `PageView`         | `page_view`      |
| `section`     | viu uma seção (sobre, por-que, cursos, empezar)| —                  | —                |
| `scroll`      | rolou 25 / 50 / 75 / 100%                      | —                  | —                |
| `click`       | clicou num botão com `data-track`              | `ViewContent` (cursos) | `view_item`  |
| `form_open`   | abriu o popup                                  | `InitiateCheckout` | `begin_checkout` |
| `lead`        | enviou o formulário                            | `Lead`             | `generate_lead`  |

A origem vem dos parâmetros UTM (`?utm_source=instagram&utm_medium=bio&utm_campaign=...`) ou, sem UTM,
do site de onde a pessoa veio. O painel tem um gerador de links com UTM na aba **Tráfico**.

Os IDs do Pixel da Meta e do GA4 são colados no painel, aba **Pixel**. A landing passa a carregar os scripts sozinha.

## Botões dos cursos

Os botões "Ver el curso" estão com `href="#"`. Enquanto estiverem assim, abrem o popup de cadastro já com o curso
como interesse. Quando tiver o link de checkout (Hotmart etc.), troque o `href` no `public/index.html`:
o clique continua sendo contado e a pessoa vai direto para o link.

## Dados de demonstração

O painel está com 30 dias de dados fictícios (marcados como **Demo**) para dar para ver tudo funcionando.
Para apagar: painel → **Ajustes** → *Borrar datos de demo*. Os dados reais não são tocados.

## Publicar no Cloudflare (quando quiser)

```bash
npx wrangler login
npx wrangler d1 create yg-db          # copie o database_id que aparecer
# cole o id em wrangler.jsonc, no campo "database_id"
npx wrangler secret put DASHBOARD_PASSWORD
npx wrangler secret put SESSION_SECRET   # uma string longa e aleatória
npm run deploy                           # aplica as tabelas no banco remoto e publica
```

Depois é só apontar o domínio para o Worker no painel do Cloudflare.
