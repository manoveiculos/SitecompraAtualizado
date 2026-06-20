# Deploy — manosveiculoscompra.com

App = Vite/React (funil) + Express (SSR catálogo AEO + APIs), em VPS com PM2.

## Deploy (um comando, na pasta do projeto no servidor)

```bash
bash deploy.sh
```

Isso faz: `git pull` → `npm ci` → `npm run build` (gera `dist/` e `server.js`) → `pm2 startOrReload` com `NODE_ENV=production` na porta `3000`.

### Primeira vez
```bash
npm ci && npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup   # opcional: subir o pm2 no boot
```

> ⚠️ `dist/` e `server.js` são gerados pelo build (gitignored). O deploy **sempre** roda `npm run build`. `NODE_ENV=production` é obrigatório (sem isso o servidor tenta entrar em modo dev/Vite).

O nginx deve fazer proxy reverso de `manosveiculoscompra.com` → `http://127.0.0.1:3000`.

## Checklist pós-deploy (1ª vez)

1. Abrir e conferir: `/estoque`, `/estoque/<um-carro>`, `/sobre`, `/perguntas-frequentes`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/radar-manos`.
2. **Google Search Console**: adicionar a propriedade → enviar `sitemap.xml` → "Solicitar indexação" em `/estoque` e `/sobre`.
3. **Bing Webmaster Tools**: enviar o mesmo `sitemap.xml` (o ChatGPT usa o índice do Bing).
4. **Rich Results Test** (search.google.com/test/rich-results): validar `Car`/`Offer`/`AutoDealer` numa página de veículo e `FAQPage` em `/perguntas-frequentes`.

## Supabase (uma vez)

A tabela `ai_visits` (radar de IA) precisa existir — rodar o SQL no SQL Editor do Supabase (ver conversa/README do radar). RLS: insert/select para `anon`.
