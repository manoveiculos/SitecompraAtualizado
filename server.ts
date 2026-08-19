
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  getVehicles,
  renderCatalog,
  renderVehicle,
  renderAbout,
  renderFAQ,
  renderPrivacy,
  renderLlms,
  renderSitemap,
  renderRobots,
  renderSold,
  findBySlug,
  findSimilar,
  aplicarFiltro,
} from "./server/catalog";
import { radarMiddleware } from "./server/radar";
import { calcularScore, acaoRecomendada } from "./server/scoring";
import { enviarEventoCapi, capiConfigurado } from "./server/meta";
import { enviarEventoOpenAiAds, openAiAdsConfigurado } from "./server/openaiAds";
import { registrarScore, lerScores, diagnosticoScores } from "./server/leadStats";
import { renderLeadsPanel } from "./server/leadsPanel";
import { basicAuth } from "./server/auth";
import { digitosNacionais } from "./server/telefone";
import { montarProdutos, produtosParaParquet } from "./server/openaiFeed";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// OTP (WhatsApp verification code) store.
// The code is generated and verified server-side only — it is never sent to
// the browser — so only the code delivered via WhatsApp can be used to enter.
// In-memory: codes are cleared on restart and assume a single server instance.
// ---------------------------------------------------------------------------
type OtpEntry = { code: string; expiresAt: number; attempts: number };
const otpStore = new Map<string, OtpEntry>();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

// Mesma normalização usada no score e no Meta CAPI (server/telefone.ts), para
// os três não divergirem sobre o que é código de país e o que é DDD.
const normalizePhone = digitosNacionais;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

/**
 * Evento de lead QUALIFICADO para a Meta.
 *
 * A otimização "leads de conversão" precisa de um evento que separe lead bom de
 * lead qualquer — sem ele a campanha só sabe contar formulário preenchido e
 * aprende a buscar volume. O site já calcula essa distinção em
 * server/scoring.ts; aqui ela vira sinal para a plataforma.
 *
 * Só faixa `quente` (nota >= 70) conta. Mandar morno junto diluiria o sinal até
 * ele virar sinônimo de `Lead` e a otimização não teria o que aprender.
 *
 * `event_id` derivado do id do Lead: nome de evento diferente já basta para a
 * Meta não deduplicar um contra o outro, e derivar mantém os dois rastreáveis
 * até a mesma pessoa.
 */
function enviarLeadQualificado(
  qualificacao: { faixa: string; score: number },
  base: Parameters<typeof enviarEventoCapi>[0],
): void {
  if (qualificacao.faixa !== "quente") return;
  void enviarEventoCapi({
    ...base,
    eventName: "QualifiedLead",
    eventId: `${base.eventId}-qualified`,
  });
}

/** Lê um cookie do cabeçalho cru — evita uma dependência só para isto. */
function lerCookie(req: express.Request, nome: string): string | undefined {
  const cru = req.headers.cookie;
  if (!cru) return undefined;
  for (const parte of cru.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) {
      return decodeURIComponent(parte.slice(i + 1).trim()) || undefined;
    }
  }
  return undefined;
}

/**
 * Cookies `_fbp` e `_fbc`, que o pixel da Meta grava no navegador.
 *
 * São o sinal de correspondência mais forte que existe para evento de web —
 * bem mais que telefone e cidade, que dependem de a pessoa ter os mesmos dados
 * cadastrados na Meta. O código já sabia enviá-los, mas ninguém os lia: os
 * eventos saíam com correspondência pior do que a disponível.
 *
 * Quando o `_fbc` ainda não existe (primeira visita: o clique chegou mas o
 * pixel não gravou o cookie a tempo), ele é montado a partir do `fbclid` que a
 * atribuição capturou, no formato que a Meta especifica.
 */
function cookiesMeta(
  req: express.Request,
  atribuicao: Record<string, string | undefined>,
): { fbp?: string; fbc?: string } {
  const fbp = lerCookie(req, "_fbp");
  let fbc = lerCookie(req, "_fbc");
  if (!fbc && atribuicao.fbclid) {
    fbc = `fb.1.${Date.now()}.${atribuicao.fbclid}`;
  }
  return { fbp, fbc };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Em produção o nginx faz proxy reverso para esta porta. Sem isto, req.ip é
  // sempre 127.0.0.1 — e o IP do visitante é um dos sinais que a Meta usa para
  // casar o evento do Conversions API com a pessoa certa.
  app.set("trust proxy", 1);

  app.use(express.json());

  // AI Visit Radar — logs crawler hits + AI/search referrals (fire-and-forget)
  app.use(radarMiddleware);

  // API Proxy for Altimus Stock to avoid CORS
  app.get("/api/stock", async (req, res) => {
    try {
      const url = 'https://estoque.altimus.com.br/api/estoquexml?estoque=997c9e91-40d7-4bec-95cb-68e18a2668a3';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch from Altimus');
      const xml = await response.text();
      res.set('Content-Type', 'text/xml');
      res.send(xml);
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({ error: 'Failed to fetch stock' });
    }
  });

  // -------------------------------------------------------------------------
  // Leads do funil principal (/) — Compra, Venda e Financiamento.
  //
  // Antes, o navegador gravava no Firestore e SÓ ENTÃO chamava o webhook do n8n.
  // Qualquer falha na gravação (bloqueador de anúncio, rede de celular ruim,
  // regra recusada) derrubava as duas coisas e o consultor nunca ficava sabendo
  // do lead. Aqui a ordem se inverte: a entrega ao n8n — que é o que chega no
  // time comercial — acontece no servidor, sem depender do navegador do cliente.
  //
  // O mesmo endpoint recebe o lead PARCIAL (contato capturado no início do
  // funil) e o COMPLETO (qualificação inteira). Os dois carregam o mesmo
  // `lead_id`, para o n8n atualizar o registro em vez de duplicar.
  // -------------------------------------------------------------------------
  // Sobrescrevíveis por ambiente para dar para apontar a um mock em homologação
  // sem gerar lead falso na fila do consultor.
  const LEAD_WEBHOOKS: Record<string, string> = {
    Compra: process.env.N8N_WEBHOOK_COMPRA || "https://n8n.drivvoo.com/webhook/c238d26a-ebce-4c00-ac3c-ba506042ab46",
    Venda: process.env.N8N_WEBHOOK_VENDA || "https://n8n.drivvoo.com/webhook/684eb74d-9112-47c5-94af-a0982dbdcf35",
    Financiamento: process.env.N8N_WEBHOOK_FINANCIAMENTO || "https://n8n.drivvoo.com/webhook/a5d2e1c0-cf84-4206-9a79-5957bc8fda00",
  };

  app.post("/api/leads", async (req, res) => {
    try {
      const body = req.body ?? {};
      const leadType = String(body.lead_type || "");
      const name = String(body.name || "").trim();
      const phone = normalizePhone(body.phone ?? "");

      if (!LEAD_WEBHOOKS[leadType]) {
        return res.status(400).json({ ok: false, error: "lead_type inválido" });
      }
      if (!name || phone.length < 10) {
        return res.status(400).json({ ok: false, error: "Nome e WhatsApp são obrigatórios" });
      }

      const stage = body.stage === "completo" ? "completo" : "parcial";
      const atribuicao = (body.atribuicao ?? {}) as Record<string, string | undefined>;
      const details = (body.details ?? {}) as Record<string, unknown>;

      // Nota de qualificação. O consultor recebe a nota, a faixa e o porquê —
      // em vez de uma fila indistinta onde "quero fechar essa semana" e "só
      // estou avaliando" chegam iguais.
      const qualificacao = calcularScore({
        lead_type: leadType,
        phone,
        cidade: String(details.cidade ?? ""),
        canal: atribuicao.canal,
        details,
      });

      // Registro analítico ANTES da entrega, de propósito. Se o n8n estiver
      // fora do ar, o lead se perde — mas a medição não pode se perder junto:
      // é exatamente aí que interessa saber qual campanha trouxe a pessoa.
      // Antes isto rodava só depois do webhook responder ok, então uma queda
      // do n8n apagava o desempenho da campanha em vez de só atrasar o lead.
      registrarScore({
        lead_id: String(body.lead_id ?? ""),
        stage,
        lead_type: leadType,
        score: qualificacao.score,
        faixa: qualificacao.faixa,
        descartado: qualificacao.descartar,
        fora_do_raio: qualificacao.fora_do_raio,
        canal: atribuicao.canal ?? null,
        utm_source: atribuicao.utm_source ?? null,
        utm_campaign: atribuicao.utm_campaign ?? null,
        utm_content: atribuicao.utm_content ?? null,
        cidade: String(details.cidade ?? "") || null,
      });

      const payload = {
        ...body,
        name,
        phone,
        // stage: "parcial" = só contato; "completo" = qualificação inteira.
        stage,
        score: qualificacao.score,
        faixa: qualificacao.faixa,
        score_motivos: qualificacao.motivos,
        fora_do_raio: qualificacao.fora_do_raio,
        descartar: qualificacao.descartar,
        acao_recomendada: acaoRecomendada(qualificacao),
        source: body.source || "Funil Manos Web App",
        server_received_at: new Date().toISOString(),
        user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
      };

      const response = await fetch(LEAD_WEBHOOKS[leadType], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Lead webhook respondeu ${response.status} para ${leadType}`);
        return res.status(502).json({ ok: false, error: "Falha ao entregar o lead" });
      }

      // Só o lead completo vira conversão no Meta. O parcial é sinal de funil,
      // não de negócio — otimizar por ele treinaria a campanha a buscar quem
      // apenas deixa telefone.
      if (stage === "completo" && body.event_id) {
        const eventoMeta = {
          eventName: "Lead" as const,
          eventId: String(body.event_id),
          phone,
          firstName: name,
          city: String(details.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          ...cookiesMeta(req, atribuicao),
          // Valor da conversão ponderado pela nota: a Meta passa a buscar quem
          // se parece com lead bom, não com lead qualquer.
          value: Math.round((Number(details.valor_veiculo) || 0) * (qualificacao.score / 100)),
          contentIds: details.id_veiculo ? [String(details.id_veiculo)] : undefined,
          contentName: details.nome_veiculo ? String(details.nome_veiculo) : undefined,
        };
        void enviarEventoCapi(eventoMeta);
        enviarLeadQualificado(qualificacao, eventoMeta);

        // Mesmo event_id do pixel oaiq: e o que faz a OpenAI entender que
        // navegador e servidor descrevem a mesma conversao.
        void enviarEventoOpenAiAds({
          eventName: "lead_created",
          eventId: String(body.event_id),
          phone,
          city: String(details.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          oppref: atribuicao.oppref ?? null,
          value: Math.round((Number(details.valor_veiculo) || 0) * (qualificacao.score / 100)),
        });
      }

      res.json({ ok: true, lead_id: body.lead_id ?? null, score: qualificacao.score, faixa: qualificacao.faixa });
    } catch (error) {
      console.error("Lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Falha ao entregar o lead" });
    }
  });

  // API Proxy for n8n Webhooks to avoid CORS.
  // Generates the WhatsApp verification code server-side and forwards it to n8n
  // (field `codigo`) so it can be delivered via WhatsApp. The code is NOT
  // returned to the browser.
  app.post("/api/bolao/lead", async (req, res) => {
    try {
      const phone = normalizePhone(req.body?.whatsapp ?? req.body?.telefone ?? "");
      const codigo = generateOtp();
      if (phone) {
        otpStore.set(phone, { code: codigo, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
      }

      const response = await fetch("https://n8n.drivvoo.com/webhook/f3f66db5-444d-4ba0-a403-3584c432cf23", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...req.body, codigo }),
      });
      // Never echo the code (or n8n's body) back to the client
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Webhook lead proxy error:", error);
      res.status(500).json({ error: "Failed to forward lead to webhook" });
    }
  });

  // Verifies the WhatsApp code. Only the code generated above (and delivered
  // via WhatsApp) is accepted; the code is consumed on success.
  app.post("/api/bolao/verify", (req, res) => {
    const phone = normalizePhone(req.body?.whatsapp ?? req.body?.telefone ?? "");
    const codigo = String(req.body?.codigo ?? "").replace(/\D/g, "");
    const entry = otpStore.get(phone);

    if (!entry || Date.now() > entry.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ valid: false, error: "expired" });
    }
    entry.attempts += 1;
    if (entry.attempts > OTP_MAX_ATTEMPTS) {
      otpStore.delete(phone);
      return res.status(429).json({ valid: false, error: "too_many_attempts" });
    }
    if (codigo && codigo === entry.code) {
      otpStore.delete(phone);
      return res.json({ valid: true });
    }
    return res.status(400).json({ valid: false, error: "invalid" });
  });

  app.post("/api/bolao/palpite", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2ed8336e-1a2a-4681-bf68-3c844c665f2d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Webhook palpite proxy error:", error);
      res.status(500).json({ error: "Failed to forward palpite to webhook" });
    }
  });

  app.post("/api/bolao/finalizar", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2196b31c-775d-4d8d-861d-ea65faf321f6", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Webhook finalizar proxy error:", error);
      res.status(500).json({ error: "Failed to forward finalizar to webhook" });
    }
  });

  // -------------------------------------------------------------------------
  // Vendas Rápidas — funil de compra de veículos (/vendasrapidas).
  // Lead (nome/telefone/cidade) -> placa (apiplacas) -> detalhes -> finaliza.
  // -------------------------------------------------------------------------
  const PLACA_TOKEN = process.env.PLACA_TOKEN || "97e59dd0a4790f25a020ca4623f9a902";

  // Step 1: captura inicial (enviada cedo p/ não perder o contato se desistir).
  app.post("/api/vendas/lead", async (req, res) => {
    try {
      const response = await fetch("https://n8n.drivvoo.com/webhook/2ea982be-39f1-4224-b378-c45dee5230c7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Vendas lead proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward vendas lead" });
    }
  });

  // Placa lookup (apiplacas/wdapi2). Token fica no servidor; nunca no client.
  app.get("/api/placa/:placa", async (req, res) => {
    try {
      const placa = String(req.params.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
      if (!/^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(placa)) {
        return res.status(200).json({ ok: false, error: "Placa inválida. Use o formato ABC1D23 ou ABC1234." });
      }
      const r = await fetch(`https://wdapi2.com.br/consulta/${placa}/${PLACA_TOKEN}`);
      const data: any = await r.json().catch(() => null);
      if (!data || data.message || (!data.marca && !data.MARCA)) {
        return res.status(200).json({ ok: false, error: "Não encontramos os dados dessa placa. Você pode seguir sem ela." });
      }
      // FIPE: escolhe o maior score (melhor correspondência) p/ valor + versão.
      let fipeValor = "";
      let versaoFipe = "";
      const fipeList = data?.fipe?.dados;
      if (Array.isArray(fipeList) && fipeList.length) {
        const best = [...fipeList].sort((a: any, b: any) => (b?.score || 0) - (a?.score || 0))[0];
        fipeValor = best?.texto_valor || "";
        versaoFipe = best?.texto_modelo || "";
      }
      const veiculo = {
        marca: data.marca || data.MARCA || "",
        modelo: data.modelo || data.MODELO || "",
        versao: versaoFipe || data.VERSAO || data.SUBMODELO || "",
        ano: data.ano || data.anoModelo || "",
        cor: data.cor || "",
        combustivel: data?.extra?.combustivel || "",
        municipio: data.municipio || data?.extra?.municipio || "",
        uf: data.uf || data?.extra?.uf_placa || "",
        fipeValor,
        logo: data.logo || "",
      };
      res.json({ ok: true, veiculo });
    } catch (error) {
      console.error("Placa lookup error:", error);
      res.status(200).json({ ok: false, error: "Erro ao consultar a placa. Você pode seguir sem ela." });
    }
  });

  // Final: envia todos os dados coletados p/ a equipe de compras.
  app.post("/api/vendas/finalizar", async (req, res) => {
    try {
      const body = req.body ?? {};
      const atribuicao = (body.atribuicao ?? {}) as Record<string, string | undefined>;

      // Em Venda a nota mede viabilidade do negócio, não intenção: o peso maior
      // está em ter placa/FIPE e no preço pedido bater com a tabela. Preço muito
      // acima da FIPE é o principal motivo de avaliação que não fecha.
      const qualificacao = calcularScore({
        lead_type: "Venda",
        phone: String(body.telefone ?? ""),
        cidade: String(body.cidade ?? ""),
        canal: atribuicao.canal,
        venda: {
          placa: body.placa ?? null,
          fipe: body.fipe ?? null,
          valor_desejado: body.valor_desejado ?? null,
          km: body.km ?? null,
          marca: body.marca ?? null,
        },
      });

      // Antes da entrega, pelo mesmo motivo da rota /api/leads: se o fetch
      // estourar (rede, DNS, timeout), a execução pula direto para o catch e a
      // medição desta avaliação sumiria junto com o lead.
      registrarScore({
        lead_id: String(body.lead_id ?? body.event_id ?? ""),
        stage: "completo",
        lead_type: "Venda",
        score: qualificacao.score,
        faixa: qualificacao.faixa,
        descartado: qualificacao.descartar,
        fora_do_raio: qualificacao.fora_do_raio,
        canal: atribuicao.canal ?? null,
        utm_source: atribuicao.utm_source ?? null,
        utm_campaign: atribuicao.utm_campaign ?? null,
        utm_content: atribuicao.utm_content ?? null,
        cidade: String(body.cidade ?? "") || null,
      });

      const response = await fetch("https://n8n.drivvoo.com/webhook/b612877b-56f9-4a22-88d2-acd74541c812", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          score: qualificacao.score,
          faixa: qualificacao.faixa,
          score_motivos: qualificacao.motivos,
          fora_do_raio: qualificacao.fora_do_raio,
          descartar: qualificacao.descartar,
          acao_recomendada: acaoRecomendada(qualificacao),
          server_received_at: new Date().toISOString(),
        }),
      });

      if (body.event_id) {
        const eventoMeta = {
          eventName: "Lead" as const,
          eventId: String(body.event_id),
          phone: String(body.telefone ?? ""),
          firstName: String(body.nome ?? ""),
          city: String(body.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          ...cookiesMeta(req, atribuicao),
          value: Math.round((Number(body.valor_desejado) || 0) * (qualificacao.score / 100)),
          contentName: [body.marca, body.modelo].filter(Boolean).join(" ") || undefined,
          sourceUrl: "https://manosveiculoscompra.com/vendasrapidas",
        };
        void enviarEventoCapi(eventoMeta);
        enviarLeadQualificado(qualificacao, eventoMeta);

        void enviarEventoOpenAiAds({
          eventName: "lead_created",
          eventId: String(body.event_id),
          phone: String(body.telefone ?? ""),
          city: String(body.cidade ?? ""),
          clientIp: req.ip,
          userAgent: String(req.headers["user-agent"] || ""),
          oppref: atribuicao.oppref ?? null,
          value: Math.round((Number(body.valor_desejado) || 0) * (qualificacao.score / 100)),
          sourceUrl: "https://manosveiculoscompra.com/vendasrapidas",
        });
      }

      res.status(response.ok ? 200 : response.status).json({ ok: response.ok });
    } catch (error) {
      console.error("Vendas finalizar proxy error:", error);
      res.status(500).json({ ok: false, error: "Failed to forward vendas finalizar" });
    }
  });

  // -------------------------------------------------------------------------
  // AEO/SEO server-rendered catalog (indexable by AI engines + crawlers).
  // Registered BEFORE the SPA catch-all so these paths return real HTML/XML.
  // -------------------------------------------------------------------------
  app.get("/robots.txt", (_req, res) => {
    res.set("Content-Type", "text/plain").send(renderRobots());
  });

  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "application/xml").send(renderSitemap(vehicles));
    } catch (err) {
      console.error("sitemap error:", err);
      res.status(500).send("error");
    }
  });

  app.get("/sobre", (_req, res) => {
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(renderAbout());
  });

  app.get("/perguntas-frequentes", (_req, res) => {
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(renderFAQ());
  });

  app.get("/politica-de-privacidade", (_req, res) => {
    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(renderPrivacy());
  });

  // Painel interno: leads por origem, campanha, criativo e nota.
  // Protegido por Basic Auth — expõe desempenho por campanha, que é informação
  // de negócio. Sem PANEL_PASSWORD no .env, responde 503 em vez de abrir.
  app.get("/leads-manos", basicAuth("Painel Manos"), async (_req, res) => {
    try {
      const linhas = await lerScores(500);
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "no-store")
        .set("X-Robots-Tag", "noindex, nofollow")
        .send(renderLeadsPanel(linhas));
    } catch (err) {
      console.error("leads panel error:", err);
      res.status(500).send("error");
    }
  });

  // Diagnóstico rápido da mensuração — evita descobrir só depois da campanha
  // no ar que o token do CAPI nunca foi configurado.
  app.get("/api/health/tracking", async (_req, res) => {
    const scores = await diagnosticoScores();
    res.json({
      meta_capi: capiConfigurado() ? "configurado" : "sem META_CAPI_TOKEN",
      openai_ads_capi: openAiAdsConfigurado() ? "configurado" : "sem OPENAI_ADS_API_KEY",
      // Tabela quebrada e tabela vazia pedem ações opostas — conserto de RLS
      // versus falta de tráfego. Antes as duas apareciam na mesma frase e o
      // diagnóstico mandava procurar defeito onde não havia.
      lead_scores: !scores.acessivel
        ? `INACESSÍVEL (${scores.erro}) — confira a tabela e a RLS`
        : scores.total
          ? `gravando — ${scores.total} registro(s), último em ${scores.ultimo}`
          : "tabela ok e gravável, porém nenhum lead registrado até agora",
      webhooks_n8n: {
        compra: LEAD_WEBHOOKS.Compra.includes("n8n.drivvoo.com") ? "produção" : "sobrescrito",
        venda: LEAD_WEBHOOKS.Venda.includes("n8n.drivvoo.com") ? "produção" : "sobrescrito",
      },
    });
  });

  // -------------------------------------------------------------------------
  // Espelho server-side de conversões que acontecem só no navegador.
  //
  // Clique de WhatsApp é a conversão mais importante de uma revenda e a mais
  // frágil de medir: a pessoa sai da página no mesmo instante e o evento é o
  // primeiro que um bloqueador derruba. O navegador manda um beacon aqui e o
  // servidor reenvia pela Conversions API, com o MESMO event_id — então quando
  // os dois chegam, a OpenAI conta uma conversão, não duas.
  //
  // Só eventos da lista são aceitos: o endpoint é público, e sem a lista
  // qualquer um poderia inventar conversão e sujar a otimização da campanha.
  // -------------------------------------------------------------------------
  const EVENTOS_ESPELHADOS = new Set(["whatsapp", "telefone"]);

  app.post("/api/ads/conversao", (req, res) => {
    try {
      const body = req.body ?? {};
      const evento = String(body.evento || "");
      const eventId = String(body.event_id || "");

      if (!EVENTOS_ESPELHADOS.has(evento) || !eventId) {
        return res.status(400).json({ ok: false });
      }

      const atribuicao = (body.atribuicao ?? {}) as Record<string, string | undefined>;

      void enviarEventoOpenAiAds({
        eventName: "custom",
        customEventName: evento,
        eventId,
        clientIp: req.ip,
        userAgent: String(req.headers["user-agent"] || ""),
        oppref: atribuicao.oppref ?? null,
        sourceUrl: typeof body.source_url === "string" ? body.source_url : undefined,
      });

      // 204: o navegador está saindo da página e não vai ler resposta nenhuma.
      res.status(204).end();
    } catch (err) {
      console.error("espelho de conversao falhou:", err);
      res.status(204).end();
    }
  });

  // -------------------------------------------------------------------------
  // Product feed do OpenAI Ads (snapshot completo em Parquet).
  //
  // É esta URL que se cola em Ads Manager › Feeds › "Conecte seu feed via URL".
  // O painel aceita os parâmetros `file_type=full-parquet` e `prefix`; ambos
  // são inofensivos aqui — a rota sempre devolve o catálogo inteiro, então a
  // URL funciona com ou sem eles.
  //
  // `?preview=1` devolve as mesmas linhas em JSON, para conferir o conteúdo
  // sem precisar abrir o binário.
  // -------------------------------------------------------------------------
  app.get("/feeds/openai/products.parquet", async (req, res) => {
    try {
      const vehicles = await getVehicles();
      const produtos = montarProdutos(vehicles);

      if (req.query.preview) {
        return res
          .set("Cache-Control", "no-store")
          .set("X-Robots-Tag", "noindex, nofollow")
          .json({
            total_estoque: vehicles.length,
            total_no_feed: produtos.length,
            descartados_sem_preco_ou_foto: vehicles.length - produtos.length,
            produtos,
          });
      }

      const parquet = produtosParaParquet(produtos);
      res
        .set("Content-Type", "application/vnd.apache.parquet")
        .set("Content-Disposition", 'attachment; filename="products.parquet"')
        .set("Content-Length", String(parquet.length))
        // O catálogo em memória tem TTL de 10 min; alinhar evita servir cache
        // mais velho que a fonte.
        .set("Cache-Control", "public, max-age=600")
        .set("X-Robots-Tag", "noindex, nofollow")
        .send(parquet);
    } catch (err) {
      console.error("openai feed error:", err);
      res.status(500).json({ error: "failed to build feed" });
    }
  });

  app.get("/llms.txt", async (_req, res) => {
    try {
      const vehicles = await getVehicles();
      res.set("Content-Type", "text/plain; charset=utf-8").send(renderLlms(vehicles));
    } catch (err) {
      console.error("llms.txt error:", err);
      res.status(500).send("error");
    }
  });

  app.get("/estoque", async (req, res) => {
    try {
      const todos = await getVehicles();
      // Filtros vêm por query string e são renderizados como links, então
      // continuam navegáveis por crawler e sem JavaScript.
      const filtro = {
        faixa: typeof req.query.faixa === "string" ? req.query.faixa : undefined,
        marca: typeof req.query.marca === "string" ? req.query.marca : undefined,
      };
      const vehicles = aplicarFiltro(todos, filtro);
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "public, max-age=600")
        .send(renderCatalog(vehicles, filtro, todos));
    } catch (err) {
      console.error("catalog error:", err);
      res.status(500).send("error");
    }
  });

  app.get("/estoque/:slug", async (req, res) => {
    try {
      const vehicles = await getVehicles();
      const vehicle = findBySlug(vehicles, req.params.slug);
      if (!vehicle) {
        // Carro vendido (ou URL antiga). Antes isto caía no catch-all da SPA e
        // devolvia a home do quiz com status 200 — porta na cara para o
        // comprador e soft-404 para o Google.
        return res
          .status(410)
          .set("Content-Type", "text/html; charset=utf-8")
          .send(renderSold(req.params.slug, findSimilar(vehicles, req.params.slug)));
      }
      res
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "public, max-age=600")
        .send(renderVehicle(vehicle));
    } catch (err) {
      console.error("vehicle page error:", err);
      res.status(500).send("error");
    }
  });

  // Vite middleware for development.
  // Imported dynamically so production (npm ci --omit=dev, no vite) doesn't
  // need it at startup — only loaded when actually running in dev.
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
