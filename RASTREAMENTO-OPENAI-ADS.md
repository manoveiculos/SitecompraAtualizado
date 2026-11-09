# Rastreamento do OpenAI Ads (Pixel `oaiq` + Conversions API)

Guia técnico da integração oficial do **OpenAI Ads** (anúncios no ChatGPT) no site da **Manos Veículos** (`manosveiculoscompra.com`), seguindo integralmente a documentação oficial em:
- https://developers.openai.com/ads/conversions-api
- https://developers.openai.com/ads/measurement-pixel
- https://developers.openai.com/ads/supported-events
- https://developers.openai.com/ads/conversion-tracking

---

## 1. Arquitetura Híbrida (Measurement Pixel + Conversions API)

O rastreamento opera em dupla camada com **deduplicação determinística por `event_id`**:

1. **Measurement Pixel (`oaiq`) no navegador**:
   - Carregado em `index.html` (SPA) e em `server/catalog.ts` (páginas SSR de `/estoque` e `/estoque/:slug`).
   - Grava automaticamente dois cookies primários (`first-party`) no domínio:
     - `__oppref` (validade de 30 dias): armazena o identificador de clique do anúncio (`?oppref=`) quando o visitante chega pelo ChatGPT.
     - `__obref` (validade de 365 dias): referência opaca do navegador (`opaque browser reference`) usada pela OpenAI para unir os eventos de navegador com os eventos server-side.
2. **Conversions API (`https://bzr.openai.com/v1/events`) no servidor (`server/openaiAds.ts`)**:
   - Recebe o mesmo `event_id` gerado no navegador (`events[].id = event_id`).
   - Envia os identificadores de atribuição (`events[].oppref` e `events[].user.obref`) e os dados do usuário normalizados e hasheados em SHA-256 (`events[].user`).

---

## 2. Regras Críticas da Especificação Oficial Implementadas

### 2.1. Formato dos Campos de Usuário (`user`) — Diferença entre Pixel e CAPI
- **No Conversions API (`server/openaiAds.ts` -> `events[].user`)**:
  Todos os campos de correspondência pessoal e geográfica são **listas no plural (`list[string]`, máximo de 3 itens únicos por lista)**:
  - `phone_numbers_sha256`: `string[]` — SHA-256 do telefone apenas com dígitos e DDI `55` (8 a 15 dígitos, sem `+` e sem zeros à esquerda).
  - `emails_sha256`: `string[]` — SHA-256 do e-mail com `trim()` e em minúsculas.
  - `external_ids_sha256`: `string[]` — SHA-256 com `trim()` **preservando maiúsculas/minúsculas** (inclui o cookie anônimo `manos_vid` e o telefone E.164).
  - `first_names_sha256` e `last_names_sha256`: `string[]` — SHA-256 do nome/sobrenome em minúsculas, sem espaços e sem pontuação ASCII, **preservando acentos e caracteres não-ASCII** (ex.: `José` -> `josé`).
  - `cities`: `string[]` — texto puro (ex.: `["Rio do Sul"]`).
  - `regions`: `string[]` — texto puro (ex.: `["SC"]`).
  - `postal_codes`: `string[]` — texto puro quando disponível.
  - `countries`: `["BR"]` — código ISO 3166-1 alpha-2 em texto puro.
  - `obref`: `string` — valor cru do cookie `__obref` (sem hash).
  - `ip_address` e `user_agent`: strings cruas da requisição HTTP.
- **No Measurement Pixel (`src/lib/tracking.ts` -> `oaiq("init", { pixelId, user })`)**:
  Os campos são **singulares**:
  `phone_number_sha256`, `email_sha256`, `external_id_sha256`, `first_name_sha256`, `last_name_sha256`, `country`, `region`, `city`.

### 2.2. Valores Monetários em Centavos (Menor Unidade ISO 4217)
- A especificação exige que `data.amount` e `contents[].amount` sejam inteiros na **menor unidade da moeda ISO 4217**.
- Para `BRL` (2 casas decimais), `R$ 89.900,00` é enviado como `8990000` (`Math.round(valorReais * 100)`).
- Quando um evento não possui valor monetário (`undefined` ou `<= 0`, como cliques gerais de WhatsApp/telefone sem veículo atrelado), `amount` e `currency` são omitidos para não reportar `0`.

### 2.3. Formas de Dados (`data.type`) e Restrição de `contents`
- `lead_created`, `appointment_scheduled`, `registration_completed` exigem `data.type: "customer_action"`. A especificação **proíbe** o campo `contents` dentro de `customer_action`.
- `contents_viewed`, `items_added`, `checkout_started`, `order_created`, `page_viewed` exigem `data.type: "contents"` e aceitam `contents: [{ id, name, content_type: "product", quantity: 1, amount, currency }]`.
- Eventos customizados (`type: "custom"`) usam `data.type: "custom"`:
  - No Pixel (`oaiq`), `custom_event_name` vai no 4º argumento (`opcoes`).
  - No CAPI (`server/openaiAds.ts`), `custom_event_name` vai na raiz do evento (`events[].custom_event_name`).

### 2.4. Consentimento LGPD (`oaiq("consent", ...)`)
- Integrado ao `LGPDBanner.tsx` e ao `index.html`: se o visitante desativar cookies de Marketing, `oaiq("consent", false)` é invocado para suspender o envio e limpar `__oppref` e `__obref`.

---

## 3. Mapa Completo de Eventos no Site

| Ação do Visitante | Evento no Pixel (`oaiq`) | Evento na CAPI (`server/openaiAds.ts`) | `data.type` | Onde é Disparado |
| :--- | :--- | :--- | :--- | :--- |
| Visualização de página | `page_viewed` (automático no `init`) | — | `contents` | `index.html` e `server/catalog.ts` |
| Abrir detalhe de veículo (`/estoque/:slug`, `/ofertas/:slug`, `/:consultor/:slug`) | `contents_viewed` | `contents_viewed` (em `/ofertas`) | `contents` | `tracking.ts`, `catalog.ts`, `ofertasService.ts`, `consultores.ts` |
| Selecionar veículo no funil ou catálogo | `items_added` | — | `contents` | `tracking.ts`, `track.ts` |
| Deixar nome + WhatsApp no início do funil (lead parcial) | `custom` (`lead_parcial`) | — (apenas lead completo vai ao CAPI) | `custom` | `App.tsx`, `VendasRapidasPage.tsx`, `ConsignacaoPage.tsx`, `ConsultorPanel.tsx` |
| Concluir envio de lead (Compra, Venda, Financiamento, Consignação, Consultor IA, Alerta de Estoque) | `lead_created` | `lead_created` | `customer_action` | `/api/leads`, `/api/vendas/finalizar`, `/api/consultor/lead`, `/api/ads/conversao` |
| Clicar em WhatsApp ou Telefone (qualquer página, card, topo, rodapé, calculadora, ofertas, consultores) | `custom` (`whatsapp` / `telefone`) | `custom` (`whatsapp` / `telefone`) | `custom` | `tracking.ts`, `track.ts`, `catalog.ts`, `ofertas.ts`, `/api/ads/conversao` |
| Venda confirmada no CRM (`POST /api/meta/venda-confirmada`) | — (evento offline) | `order_created` (`action_source: "offline"`) | `contents` | `server.ts` (`/api/meta/venda-confirmada`) |

---

## 4. Variáveis de Ambiente e Diagnóstico

No arquivo `.env` de produção:

```env
# ID do Pixel da OpenAI Ads (mesmo valor nas duas variáveis)
VITE_OPENAI_ADS_PIXEL_ID=seu_pixel_id_aqui
OPENAI_ADS_PIXEL_ID=seu_pixel_id_aqui

# Chave secreta da Conversions API (Ads Manager -> Conversões -> Criar chave)
OPENAI_ADS_API_KEY=sua_chave_secreta_aqui
```

Após publicar, consulte `GET https://manosveiculoscompra.com/api/health/tracking` para verificar:
- `openai_ads_capi`: `"configurado"`
- `openai_ads_pixel_catalogo`: ID configurado no servidor
- `openai_ads_pixel_funil`: `"igual ao servidor"`
- `openai_ads_catalogo_feed`: `"https://manosveiculoscompra.com/feeds/openai/products.parquet"`
