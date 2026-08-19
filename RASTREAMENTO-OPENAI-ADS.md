# Rastreamento de conversões — OpenAI Ads

Medição das campanhas do ChatGPT no `manosveiculoscompra.com`.

## Estratégia: Pixel + CAPI

Os dois, porque a stack permite e porque um cobre o buraco do outro.

| | Cobre | Perde |
|---|---|---|
| **Pixel** (`oaiq`, navegador) | contexto de navegação, clique, cookie de atribuição | bloqueador, iOS/ATT, aba fechada antes do envio |
| **CAPI** (servidor) | o que o navegador não entregou; conversão confirmada no backend | contexto que só existe no navegador |

O que faz os dois somarem em vez de dobrarem é o **`event_id`**: um único id por
conversão, gerado em `src/lib/tracking.ts`, enviado ao pixel e ao servidor. A
OpenAI reconhece que navegador e servidor descrevem o mesmo acontecimento e
conta uma vez só.

## Stack

- **Front**: Vite + React (SPA do funil). Pixel no `index.html`, eventos em `src/lib/tracking.ts`.
- **Back**: Express (`server.ts`). CAPI em `server/openaiAds.ts`.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | carrega o SDK e inicializa o pixel com o id vindo do build |
| `src/lib/tracking.ts` | camada única de eventos: dataLayer + Meta + OpenAI |
| `src/lib/attribution.ts` | captura e persiste o `oppref` e demais ids de clique |
| `server/openaiAds.ts` | envio pela Conversions API |
| `server.ts` | dispara a CAPI nas rotas de lead e recebe o beacon de WhatsApp |

## Eventos configurados

| Ação | Evento OpenAI | `data.type` | Pixel | CAPI |
|---|---|---|---|---|
| Lead qualificado (funil e venda rápida) | `lead_created` | `customer_action` | ✅ | ✅ |
| Contato capturado no início do funil | `custom` → `lead_parcial` | `custom` | ✅ | — |
| Veículo aberto | `contents_viewed` | `contents` | ✅ | — |
| Veículo escolhido no funil | `items_added` | `contents` | ✅ | — |
| Clique em WhatsApp | `custom` → `whatsapp` | `custom` | ✅ | ✅ |
| Clique em telefone | `custom` → `telefone` | `custom` | ✅ | ✅ |

Duas decisões que valem registro:

- **Lead parcial não é `lead_created`.** Os dois com o mesmo nome fariam a
  campanha otimizar por quem só deixa telefone.
- **Clique de WhatsApp vai também pela CAPI.** Para uma revenda é conversão de
  verdade, e é o evento que o bloqueador derruba primeiro. O navegador manda um
  `navigator.sendBeacon` para `/api/ads/conversao` — que sobrevive à saída da
  página — e o servidor reenvia com o mesmo `event_id`.

## Variáveis de ambiente

| Variável | Onde | Sem ela |
|---|---|---|
| `VITE_OPENAI_ADS_PIXEL_ID` | build do front | o pixel não inicializa (guarda no `index.html`) |
| `OPENAI_ADS_PIXEL_ID` | servidor | a CAPI não envia |
| `OPENAI_ADS_API_KEY` | servidor (**segredo**) | a CAPI não envia |

A chave é o único segredo: ela nunca vai para o navegador e só existe no `.env`
do VPS. O **pixel id não é segredo** — ele chega ao navegador de qualquer jeito.
Está em variável para trocar de conta sem editar código, e para o servidor não
ter um default embutido que mandaria conversão para a conta errada.

Depois de alterar o `.env`: `pm2 reload manos --update-env`.

## Validação

**1. O pixel subiu com o id certo**
```bash
curl -s https://manosveiculoscompra.com/ | grep -o 'oaiq.min.js", "[^"]*"'
```
Tem que mostrar o id. Vazio ou começando com `%` = variável faltando no build.

**2. As chaves estão configuradas**
```bash
curl -s https://manosveiculoscompra.com/api/health/tracking
```
`openai_ads_capi` precisa dizer `configurado`.

**3. Os eventos disparam** — abrir o site com a extensão *OpenAI Ads Pixel
Helper*, completar um lead e clicar no WhatsApp. Devem aparecer `lead_created` e
o custom `whatsapp`. Para log no console, trocar `debug: false` por `true` no
`index.html` temporariamente.

**4. A deduplicação está funcionando** — em Ads Manager → Conversões → Fluxo de
eventos, a mesma conversão deve aparecer uma vez, com origem nos dois caminhos.
Se o número dobrar, o `event_id` não está batendo entre pixel e servidor.

**5. O espelho recusa evento inventado**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://manosveiculoscompra.com/api/ads/conversao \
  -H "Content-Type: application/json" -d '{"evento":"compra_falsa","event_id":"x"}'
```
Tem que devolver `400`.

## Melhorias futuras

1. **Pixel nas páginas SSR.** `/estoque` e as páginas de veículo são renderizadas
   por `server/catalog.ts`, que não usa o `index.html` — logo não têm pixel
   nenhum. É justamente a superfície que os buscadores leem e por onde deve
   chegar o tráfego orgânico do ChatGPT. Cobrir isso vale mais que qualquer
   outro item desta lista.
2. **`contents_viewed` e `items_added` pela CAPI.** Hoje só no pixel; são os
   eventos que mais sofrem com bloqueador.
3. **Correspondência por e-mail.** A API aceita `email_sha256`, que casa melhor
   que `external_id`. O funil não pede e-mail hoje.
4. **Reenvio em caso de falha.** O envio é fire-and-forget: se a OpenAI responder
   erro, o evento se perde. Uma fila com retentativa recuperaria.
5. **`order_created` quando a venda fecha.** Fecharia o ciclo de lead até receita
   real, mas depende de o CRM avisar o site.
