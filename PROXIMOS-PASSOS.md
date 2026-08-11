# Próximos passos — funil de conversão

Branch: `cro/funil-conversao-2026-08` (3 commits)

O código está pronto e testado (typecheck, build e rotas). O que falta é
**configuração em quatro sistemas externos**. Enquanto os itens 2 e 3 não
estiverem feitos, o site funciona normalmente — mas você não vai ver os números
novos, e o CRM vai receber cada lead duas vezes.

Ordem sugerida: **1 → 2 → 3 → 4 → 5 → 6**. Reserve umas 2 horas.

---

## 1. Subir em homologação e percorrer os dois funis no celular

```bash
git checkout cro/funil-conversao-2026-08
npm ci && npm run build
NODE_ENV=production node server.js
```

Percorra **no celular**, não no desktop — é onde está o tráfego:

- [ ] Home abre com carros visíveis e busca funcionando
- [ ] Tocar num carro leva direto à tela de contato, **com o carro na tela**
- [ ] Buscar um modelo que não existe (ex.: "Ferrari") mostra saída, não tela branca
- [ ] "Avaliar meu Carro agora" leva ao `/vendasrapidas`
- [ ] Financiamento: o botão "Finalizar" aparece na tela do formulário
- [ ] Link da Política de Privacidade abre
- [ ] Recarregar no meio do funil retoma de onde parou
- [ ] Abrir um carro em `/estoque`, clicar "Tenho interesse" e conferir que ele
      aparece na tela de contato
- [ ] `/estoque/qualquer-coisa-inventada` mostra "Esse carro já foi vendido"
- [ ] Desligar o JavaScript no navegador e abrir `/` → tem que aparecer telefone,
      WhatsApp e endereço (não tela preta)

> Se algo estiver visualmente errado, me diga antes de ir para produção. O que eu
> validei foi lógica, rotas e build — a sensação das telas novas no aparelho não
> tem como eu julgar daqui.

---

## 2. Supabase — criar a tabela `lead_scores`

Sem isso o painel `/leads-manos` fica vazio (nada mais quebra).

O SQL está pronto em **[`supabase/lead_scores.sql`](supabase/lead_scores.sql)** —
abrir o arquivo, copiar tudo, colar no **SQL Editor** do Supabase e dar Run.
Pode rodar mais de uma vez sem quebrar nada.

Além da tabela, ele cria:

- índice único em `(lead_id, stage)` — o servidor grava com upsert, então
  reenvio atualiza a nota em vez de contar a mesma pessoa duas vezes
- índices para o painel (data, campanha, canal)
- as policies de RLS para `anon`

No fim do arquivo há três consultas prontas em comentário: últimos registros,
desempenho por campanha, e a **fila de contatos que não finalizaram**.

Não há dado pessoal nessa tabela de propósito — nome, telefone e placa ficam só
no n8n/CRM, que tem controle de acesso. Se um dia entrar qualquer campo pessoal
ali, troque a chave para a service role e feche o `select`.

**Conferir:** abrir `/api/health/tracking`. O campo `lead_scores` deve sair de
"sem registros ainda" para "gravando" depois do primeiro lead.

> **Limpar o registro de teste.** Ao validar a tabela eu gravei uma linha
> `_smoke_test_` pelo caminho real (REST + chave publishable) para confirmar que
> o upsert funciona. Ela ainda está lá e apareceria no painel. Rode uma vez:
>
> ```sql
> delete from public.lead_scores where lead_id = '_smoke_test_';
> ```

---

## 3. n8n — deduplicar por `lead_id` ⚠️ o mais importante

**Sem este passo o volume de registros dobra.** Cada lead agora chega duas vezes
no mesmo webhook:

| Quando | `stage` | Conteúdo |
|---|---|---|
| A pessoa digita nome e WhatsApp | `parcial` | contato + carro (se já escolheu) |
| A pessoa termina o funil | `completo` | tudo + qualificação |

Os dois carregam o **mesmo `lead_id`**. Nos três workflows (Compra, Venda,
Financiamento) e no de Vendas Rápidas:

1. Buscar registro existente por `lead_id`
2. Se existir → **atualizar**; se não → criar
3. Nunca sobrescrever campo preenchido com valor vazio (o parcial tem menos dados
   que o completo)

### Campos novos que chegam no payload

| Campo | Para que serve |
|---|---|
| `lead_id` | chave de deduplicação |
| `stage` | `parcial` ou `completo` |
| `score` | 0 a 100 |
| `faixa` | `quente` / `morno` / `frio` |
| `score_motivos` | lista em texto — mostrar direto para o consultor |
| `acao_recomendada` | `ligar_agora_meta_5min` / `fila_do_dia_whatsapp` / `nutricao_automatica` / `descartar_telefone_invalido` |
| `fora_do_raio` | fora da área de atendimento (não é descarte) |
| `atribuicao` | canal, utm_*, gclid, fbclid, first_touch |

### Roteamento sugerido

- `faixa = quente` → notificação imediata ao consultor de plantão, meta de 5 min
- `faixa = morno` → fila normal do dia, WhatsApp
- `faixa = frio` → automação, sem consumir consultor
- `stage = parcial` sem completo depois de 30 min → mensagem de retomada citando
  o carro que a pessoa estava olhando (é o resgate mais barato que existe, e
  antes nem era visível)

---

## 4. GTM — criar os gatilhos

O código já publica os eventos no `dataLayer`. Falta o GTM escutar.
Container: `GTM-MNL7Z6XR`.

| Evento | O que fazer |
|---|---|
| `lead` | **Conversão principal** do Google Ads + evento `generate_lead` no GA4 |
| `lead_parcial` | Conversão **secundária** (marcar como "secundária" no Google Ads) |
| `funnel_start`, `funnel_step` | Eventos GA4, para ver onde as pessoas param |
| `select_vehicle`, `view_vehicle` | Eventos GA4 |
| `contato_direto` | Eventos GA4 (cliques em WhatsApp e telefone) |

**Não deixe `lead_parcial` como conversão principal.** O lance passaria a
otimizar por quem só deixa telefone, que é exatamente o oposto do que queremos.

Variáveis do dataLayer que vale criar no GTM: `lead_tipo`, `canal`,
`utm_source`, `utm_campaign`, `utm_content`, `value`, `event_id`.

**Conferir:** modo Preview do GTM, percorrer o funil, ver `lead` disparar uma vez.

---

## 5. Meta — token do Conversions API

No Gerenciador de Eventos → pixel `3253946971444443` → Configurações → gerar
token de acesso. Depois, no servidor:

```bash
# adicionar ao .env do servidor
META_CAPI_TOKEN="o-token-gerado"
# opcional, só enquanto estiver testando:
META_TEST_EVENT_CODE="TEST12345"
```

Sem o token o envio é ignorado em silêncio — o funil nunca quebra por
mensuração.

**Conferir:** `/api/health/tracking` deve mostrar `"meta_capi": "configurado"`.
Depois, no Gerenciador de Eventos, o evento `Lead` tem que aparecer como
**"Navegador e servidor"** com deduplicação — não como dois eventos separados.
Se aparecer duplicado, o `event_id` não está casando.

---

## 6. Primeira semana — o que olhar

Abra `/leads-manos` (não indexado, mas **sem senha** — ver aviso abaixo).

Quatro números que antes não existiam:

1. **Contatos sem finalizar** — gente que deixou telefone e não terminou. Antes
   era invisível; agora é fila de resgate.
2. **% de quentes por campanha** — compare as campanhas por esta coluna, **não**
   pelo total de leads. Campanha com muito lead e pouca nota está enchendo a fila
   do consultor sem trazer negócio.
3. **Nota média por canal** — decide onde colocar verba.
4. **Custo por lead qualificado** — cruze o gasto da plataforma com a contagem de
   quentes, não com o total.

Depois de uns **200 leads com nota gravada**, cruze nota × negócio fechado e
recalibre os pesos em `server/scoring.ts`. Os pesos atuais são um ponto de
partida defensável, não verdade revelada.

---

## Pendências conhecidas

- **`/leads-manos` não tem autenticação.** Está `noindex,nofollow` e não tem dado
  pessoal, mas quem souber a URL consegue ver os números de campanha. Se isso
  incomodar, dá para pôr atrás de Basic Auth no nginx — me avise.
- **Largura de 500px no desktop.** Não mexi: alargar a casca mexe na composição
  de todas as telas e eu não teria como avaliar o resultado visual daqui. Veja a
  home nova primeiro e decida.
- **Descarte por geografia.** No plano eu tinha escrito que lead fora da área
  seria descartado. Implementei como sinal negativo, não veto — só telefone
  inválido descarta. O campo `fora_do_raio` está no payload se você quiser
  endurecer.
- **Lista de cidades atendidas** em `server/scoring.ts` foi montada por mim a
  partir do Alto Vale + litoral. Vale revisar se falta alguma praça sua.
