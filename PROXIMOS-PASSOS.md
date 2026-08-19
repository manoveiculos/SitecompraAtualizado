# Próximos passos — funil de conversão

> **Situação em 19/08/2026.** Tudo já foi mesclado na `main` e publicado. O que
> falta é **configuração em sistemas externos** — nenhuma delas quebra o site se
> ficar faltando, mas cada uma desliga um número em silêncio.
>
> Verificado direto na produção nesta data:
>
> | Item | Estado |
> |---|---|
> | 2. Tabela `lead_scores` | ✅ **feita** — já gravando leads reais |
> | 5. Senha do painel | ❌ **pendente** — `/leads-manos` responde **503**, nunca abriu |
> | 6. Meta CAPI | ❌ **pendente** — `sem META_CAPI_TOKEN` |
> | 8. OpenAI Ads CAPI | ❌ **pendente** — `sem OPENAI_ADS_API_KEY` |
>
> Confira a qualquer momento com:
> `curl -s https://manosveiculoscompra.com/api/health/tracking`

Ordem sugerida pelo retorno: **5 → 6 → 8 → 3 → 4 → 7**.

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

## 2. Supabase — criar a tabela `lead_scores` ✅ FEITO

A tabela existe, a RLS está correta e já há leads reais gravados (um mesmo
`lead_id` nos estágios `parcial` e `completo`, que é o comportamento esperado:
uma pessoa, dois momentos, sem duplicar).

Nada a fazer aqui. O texto abaixo fica como referência de como foi montada.

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

## 5. Senha do painel `/leads-manos` ⚠️ PENDENTE — e está bloqueando você

Conferido em 19/08/2026: o painel responde **503**. Ou seja, `PANEL_PASSWORD`
nunca foi definida e **o painel nunca abriu para ninguém** — inclusive para
você. Os leads estão sendo gravados, mas não há como olhá-los pela interface.

É o item de maior retorno imediato da lista: dois minutos de configuração
destravam a leitura de tudo que já está sendo medido.

O painel está protegido por Basic Auth, e **falha fechada**: sem senha definida
ele responde 503 em vez de ficar aberto. Ou seja, ou você configura, ou o painel
não abre para ninguém.

No `.env` do servidor:

```bash
PANEL_USER="manos"
PANEL_PASSWORD="cole-aqui-a-senha-gerada"
```

Gerar uma senha longa:

```bash
openssl rand -base64 24
```

Depois de mexer no `.env`, o PM2 precisa recarregar o ambiente:

```bash
pm2 reload manos --update-env
```

**Conferir:** abrir `/leads-manos` no navegador — tem que aparecer a caixa de
usuário e senha. O resto do site (`/`, `/estoque`, `/vendasrapidas`) continua
público, sem senha nenhuma.

> Basic Auth trafega a senha em base64, não criptografada — só é seguro sobre
> HTTPS. O site já está em HTTPS, então está tudo certo; só não use essa senha
> em nenhum outro lugar.

---

## 6. Meta — token do Conversions API ⚠️ PENDENTE

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

## 8. OpenAI Ads — pixel e Conversions API ⚠️ PENDENTE

Anúncios dentro do ChatGPT. O código está pronto e publicado; falta a chave.

Em Ads Manager → Conversões → **Criar chave de conversão**. Depois, no `.env` do
servidor:

```bash
OPENAI_ADS_API_KEY="a-chave-gerada"
OPENAI_ADS_PIXEL_ID="QhX8YkwW1KcmEMR9JPQD8Q"
VITE_OPENAI_ADS_PIXEL_ID="QhX8YkwW1KcmEMR9JPQD8Q"
```

As duas últimas recebem o mesmo id: uma é lida no build do front, a outra em
tempo de execução no servidor (as páginas SSR do catálogo carregam o pixel por
outro caminho). Por isso é preciso **rebuildar**, não só recarregar o pm2 —
`bash deploy.sh` já faz os dois.

**Conferir:** `/api/health/tracking` deve mostrar `"openai_ads_capi":
"configurado"`.

Detalhes de eventos, deduplicação e validação estão em
**[RASTREAMENTO-OPENAI-ADS.md](RASTREAMENTO-OPENAI-ADS.md)**.

---

## 7. Primeira semana — o que olhar

Abra `/leads-manos` (protegido por senha, ver passo 5).

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

- **O funil não está recebendo tráfego.** Levantamento de 15 dias em agosto: o
  radar registrou 481 leituras de robô e **1 visita humana** vinda de busca.
  No mesmo período o CRM recebeu 184 leads — todos por WhatsApp, Google e
  Facebook, nenhum pelo funil. Nada disso é defeito de código: as campanhas não
  estão apontando para cá. É a pendência de maior impacto da lista.
- **Largura de 500px no desktop.** Não mexi: alargar a casca mexe na composição
  de todas as telas e eu não teria como avaliar o resultado visual daqui. Veja a
  home nova primeiro e decida.
- **Descarte por geografia.** No plano eu tinha escrito que lead fora da área
  seria descartado. Implementei como sinal negativo, não veto — só telefone
  inválido descarta. O campo `fora_do_raio` está no payload se você quiser
  endurecer.
- **Lista de cidades atendidas** em `server/scoring.ts` foi montada por mim a
  partir do Alto Vale + litoral. Vale revisar se falta alguma praça sua.
