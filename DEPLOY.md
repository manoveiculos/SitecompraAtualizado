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

## Checklist a cada deploy

Três coisas que só dá para conferir com o build novo no ar:

1. **Feed do OpenAI Ads** — tem que responder Parquet, não HTML:
   ```bash
   curl -sI https://manosveiculoscompra.com/feeds/openai/products.parquet
   ```
   Espera-se `Content-Type: application/vnd.apache.parquet`. Se vier `text/html`,
   o build não pegou e a rota caiu no catch-all da SPA — foi exatamente assim que
   a primeira tentativa de conectar o feed falhou. Para revisar o conteúdo sem
   abrir o binário: mesma URL com `?preview=1`.

2. **Mensuração** — `curl -s https://manosveiculoscompra.com/api/health/tracking`
   responde três campos. Em `lead_scores`, as mensagens são distintas de propósito:
   - `INACESSÍVEL (...)` → conserto de tabela/RLS;
   - `tabela ok e gravável, porém nenhum lead registrado até agora` → falta tráfego,
     não tem defeito;
   - `gravando — N registro(s), último em ...` → funcionando.

3. **Pixel do OpenAI Ads** — abrir o site com a extensão *OpenAI Ads Pixel Helper*
   e completar um lead de teste. O evento `lead_created` tem que aparecer. Se
   precisar de log no console, ligue `debug:true` no `index.html`
   temporariamente — em produção ele fica `false`.

## Variáveis que o servidor espera

Ver `.env.example` para a lista completa. Sem elas o app sobe, mas com recursos
desligados em silêncio:

| Variável | Sem ela |
|---|---|
| `PANEL_PASSWORD` | `/leads-manos` responde 503 (falha fechada, de propósito) |
| `META_CAPI_TOKEN` | envio server-side para a Meta é ignorado; só o pixel do navegador reporta |

Depois de alterar o `.env`: `pm2 reload manos --update-env` (sem `--update-env`
o processo continua com os valores antigos).

## Supabase (uma vez)

A tabela `ai_visits` (radar de IA) precisa existir — rodar o SQL no SQL Editor do Supabase (ver conversa/README do radar). RLS: insert/select para `anon`.
