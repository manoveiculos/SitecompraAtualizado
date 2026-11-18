import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  MousePointerClick,
  Car,
  MessageCircle,
  Phone,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Save,
  Filter,
  Smartphone,
  Monitor,
  Clock,
  Sparkles,
  Search,
  ArrowRight,
  Lock,
  ExternalLink,
  Activity,
  Target,
  Eye,
  Calculator,
  Bot,
} from 'lucide-react';
import {
  autenticarAdminOfertas,
  getSavedAdminKey,
  formatarMoedaBRL,
} from '../../services/ofertasService';

import JornadaVisitantesSecao from './JornadaVisitantesSecao';
import {
  formatarDuracao,
  type ContextoCampanhaMeta,
  type EventoJornadaVisitante,
  type OrigemTrafegoMacro,
  type TipoAcaoVisitante,
  type VisitanteIdentificado,
} from '../../lib/trafegoInteligencia';

// Tipos vivem em lib/trafegoInteligencia (compartilhados com o servidor).
export type { EventoJornadaVisitante, OrigemTrafegoMacro, TipoAcaoVisitante };

export interface VerbaCanaisConfig {
  periodo_referencia: string;
  verba_google_ads: number;
  verba_facebook_ads: number;
  verba_openai_ads: number;
  meta_cpl_desejado: number;
  ticket_medio_lucro: number;
  vendas_google_ads: number;
  vendas_facebook_ads: number;
  vendas_openai_ads: number;
  vendas_organico: number;
  updated_at: string;
}

const CANAL_META: Record<
  OrigemTrafegoMacro,
  {
    nome: string;
    subtitulo: string;
    corTexto: string;
    corBg: string;
    corBorda: string;
    badgeCls: string;
    pago: boolean;
  }
> = {
  google_ads: {
    nome: 'Google Ads',
    subtitulo: 'Pesquisa, Performance Max & YouTube (gclid / UTM)',
    corTexto: 'text-sky-400',
    corBg: 'bg-sky-500/10',
    corBorda: 'border-sky-500/30',
    badgeCls: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    pago: true,
  },
  facebook_ads: {
    nome: 'Facebook / Instagram Ads',
    subtitulo: 'Meta Ads, Catálogo Dinâmico & Reels (fbclid / UTM)',
    corTexto: 'text-indigo-400',
    corBg: 'bg-indigo-500/10',
    corBorda: 'border-indigo-500/30',
    badgeCls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    pago: true,
  },
  openai_ads: {
    nome: 'OpenAI Ads (ChatGPT)',
    subtitulo: 'Anúncios Patrocinados no ChatGPT (oppref / CAPI)',
    corTexto: 'text-emerald-400',
    corBg: 'bg-emerald-500/10',
    corBorda: 'border-emerald-500/30',
    badgeCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    pago: true,
  },
  organico: {
    nome: 'Visitas Orgânicas & Diretas',
    subtitulo: 'Google Orgânico, ChatGPT Orgânico, Instagram Perfil & Direto',
    corTexto: 'text-amber-400',
    corBg: 'bg-amber-500/10',
    corBorda: 'border-amber-500/30',
    badgeCls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    pago: false,
  },
};

export default function TrafegoRoiPanel({ standalone = false }: { standalone?: boolean }) {
  const [autenticado, setAutenticado] = useState<boolean>(() => Boolean(getSavedAdminKey()));
  const [senhaInput, setSenhaInput] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [autenticando, setAutenticando] = useState(false);

  const [eventos, setEventos] = useState<EventoJornadaVisitante[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvandoVerba, setSalvandoVerba] = useState(false);
  const [msgSucessoVerba, setMsgSucessoVerba] = useState('');

  // Filtros de visualização
  const [periodoDias, setPeriodoDias] = useState<number>(30); // 1 = Hoje, 7 = 7d, 30 = 30d, 0 = Tudo
  const [filtroCanal, setFiltroCanal] = useState<'todos' | OrigemTrafegoMacro>('todos');
  const [visitantes, setVisitantes] = useState<Record<string, VisitanteIdentificado>>({});
  const [campanhas, setCampanhas] = useState<Record<string, ContextoCampanhaMeta>>({});
  const [integracoes, setIntegracoes] = useState<{ crm: boolean; meta_ads: boolean } | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  // Estado editável de Verba & ROI
  const [verba, setVerba] = useState<VerbaCanaisConfig>({
    periodo_referencia: 'Mês Atual',
    verba_google_ads: 0,
    verba_facebook_ads: 0,
    verba_openai_ads: 0,
    meta_cpl_desejado: 40,
    ticket_medio_lucro: 4500,
    vendas_google_ads: 0,
    vendas_facebook_ads: 0,
    vendas_openai_ads: 0,
    vendas_organico: 0,
    updated_at: new Date().toISOString(),
  });

  // `silencioso` = atualização automática: sem spinner e SEM tocar na verba, para
  // não apagar o que a pessoa está digitando no formulário de verba/metas.
  const carregarDados = async (silencioso = false) => {
    const adminKey = getSavedAdminKey();
    if (!adminKey) return;
    if (!silencioso) setCarregando(true);
    try {
      const res = await fetch('/api/trafego/resumo', {
        headers: { 'x-ofertas-admin-key': adminKey },
      });
      if (res.status === 401) {
        setAutenticado(false);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.eventos)) setEventos(json.eventos);
        if (json.visitantes) setVisitantes(json.visitantes);
        if (json.campanhas) setCampanhas(json.campanhas);
        if (json.integracoes) setIntegracoes(json.integracoes);
        if (json.verba && !silencioso) setVerba(json.verba);
        setUltimaAtualizacao(new Date());
      }
    } catch (err) {
      console.error('Erro ao carregar painel de tráfego:', err);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  };

  useEffect(() => {
    if (!autenticado) return;
    carregarDados();
    // Tempo real: o dwell time de quem está no site agora cresce a cada ~20s.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void carregarDados(true);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [autenticado]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutenticando(true);
    setErroLogin('');
    const res = await autenticarAdminOfertas(senhaInput.trim());
    setAutenticando(false);
    if (res.ok) {
      setAutenticado(true);
    } else {
      setErroLogin(res.error || 'Senha incorreta.');
    }
  };

  const handleSalvarVerba = async (e: React.FormEvent) => {
    e.preventDefault();
    const adminKey = getSavedAdminKey();
    setSalvandoVerba(true);
    setMsgSucessoVerba('');
    try {
      const res = await fetch('/api/trafego/verba', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ofertas-admin-key': adminKey,
        },
        body: JSON.stringify(verba),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.verba) setVerba(json.verba);
        setMsgSucessoVerba('Verba e metas salvas com sucesso! Cálculos de ROI atualizados.');
        setTimeout(() => setMsgSucessoVerba(''), 4000);
      }
    } catch {
      /* ignore */
    } finally {
      setSalvandoVerba(false);
    }
  };

  // Filtra eventos pelo período selecionado
  const eventosPeriodo = useMemo(() => {
    if (periodoDias <= 0) return eventos;
    const limiteMs =
      periodoDias === 1
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : Date.now() - periodoDias * 24 * 60 * 60 * 1000;
    return eventos.filter((e) => new Date(e.timestamp).getTime() >= limiteMs);
  }, [eventos, periodoDias]);

  // Calcula métricas detalhadas para cada um dos 4 canais
  const estatisticasPorCanal = useMemo(() => {
    const canais: OrigemTrafegoMacro[] = ['google_ads', 'facebook_ads', 'openai_ads', 'organico'];

    const mapa = {} as Record<
      OrigemTrafegoMacro,
      {
        visitantesUnicos: number;
        totalAcessos: number;
        veiculosVistos: number;
        simulacoesEPlacas: number;
        cliquesWhatsApp: number;
        leadsFormulario: number;
        totalConversoes: number;
        taxaConversao: number;
        verbaGasta: number;
        vendasConfirmadas: number;
        cpcReal: number;
        cplReal: number;
        receitaLucroEstimado: number;
        roasMultiplicador: number;
        statusRoi: 'otimo' | 'atencao' | 'critico' | 'organico';
        diagnosticoTexto: string;
      }
    >;

    for (const c of canais) {
      const evs = eventosPeriodo.filter((e) => e.origem_macro === c);
      const visitantesSet = new Set(evs.map((e) => e.visitor_id));
      const visitantesUnicos = visitantesSet.size;
      const totalAcessos = evs.filter((e) => e.acao === 'page_view').length || visitantesUnicos;
      const veiculosVistos = evs.filter(
        (e) => e.acao === 'view_vehicle' || e.acao === 'select_vehicle',
      ).length;
      const simulacoesEPlacas = evs.filter(
        (e) => e.acao === 'simulacao' || e.acao === 'plate_lookup' || e.acao === 'consultor_ia',
      ).length;
      const cliquesWhatsApp = evs.filter(
        (e) => e.acao === 'whatsapp_click' || e.acao === 'phone_click',
      ).length;
      const leadsFormulario = evs.filter(
        (e) => e.acao === 'lead_completo' || e.acao === 'lead_parcial',
      ).length;

      // Visitantes únicos que converteram (para taxa de conversão real sem inflar se clicou 2x)
      const visitantesQueConverteram = new Set(
        evs
          .filter(
            (e) =>
              e.acao === 'whatsapp_click' ||
              e.acao === 'phone_click' ||
              e.acao === 'lead_completo' ||
              e.acao === 'lead_parcial',
          )
          .map((e) => e.visitor_id),
      ).size;

      const totalConversoes = cliquesWhatsApp + leadsFormulario;
      const taxaConversao =
        visitantesUnicos > 0 ? (visitantesQueConverteram / visitantesUnicos) * 100 : 0;

      const verbaGasta =
        c === 'google_ads'
          ? verba.verba_google_ads
          : c === 'facebook_ads'
            ? verba.verba_facebook_ads
            : c === 'openai_ads'
              ? verba.verba_openai_ads
              : 0;

      const vendasConfirmadas =
        c === 'google_ads'
          ? verba.vendas_google_ads
          : c === 'facebook_ads'
            ? verba.vendas_facebook_ads
            : c === 'openai_ads'
              ? verba.vendas_openai_ads
              : verba.vendas_organico;

      const cpcReal = visitantesUnicos > 0 ? verbaGasta / visitantesUnicos : 0;
      const cplReal = totalConversoes > 0 ? verbaGasta / totalConversoes : 0;
      const receitaLucroEstimado = vendasConfirmadas * (verba.ticket_medio_lucro || 4500);
      const roasMultiplicador = verbaGasta > 0 ? receitaLucroEstimado / verbaGasta : 0;

      let statusRoi: 'otimo' | 'atencao' | 'critico' | 'organico' = 'organico';
      let diagnosticoTexto = 'Tráfego gratuito gerando visitas e leads sem custo de clique.';

      if (c !== 'organico') {
        if (verbaGasta <= 0) {
          statusRoi = 'atencao';
          diagnosticoTexto =
            visitantesUnicos > 0
              ? 'Recebendo visitantes! Informe a verba gasta abaixo para calcular seu CPL.'
              : 'Sem verba informada e sem tráfego registrado neste período.';
        } else if (totalConversoes === 0) {
          statusRoi = 'critico';
          diagnosticoTexto =
            visitantesUnicos > 0
              ? `Alerta: ${visitantesUnicos} visitante(s) entraram mas ninguém converteu ainda. Revise público ou oferta.`
              : 'Verba alocada, mas nenhum clique chegou ao site ainda (confira UTMs/links).';
        } else if (cplReal <= verba.meta_cpl_desejado) {
          statusRoi = 'otimo';
          diagnosticoTexto = `Excelente! Cada conversão custou ${formatarMoedaBRL(cplReal)} (dentro da meta de ${formatarMoedaBRL(verba.meta_cpl_desejado)}).`;
        } else if (cplReal <= verba.meta_cpl_desejado * 1.5) {
          statusRoi = 'atencao';
          diagnosticoTexto = `Atenção: CPL em ${formatarMoedaBRL(cplReal)} (acima da meta de ${formatarMoedaBRL(verba.meta_cpl_desejado)}). Otimize criativos.`;
        } else {
          statusRoi = 'critico';
          diagnosticoTexto = `Custo elevado: CPL em ${formatarMoedaBRL(cplReal)}. Considere realocar parte da verba para o canal com menor CPL.`;
        }
      }

      mapa[c] = {
        visitantesUnicos,
        totalAcessos,
        veiculosVistos,
        simulacoesEPlacas,
        cliquesWhatsApp,
        leadsFormulario,
        totalConversoes,
        taxaConversao,
        verbaGasta,
        vendasConfirmadas,
        cpcReal,
        cplReal,
        receitaLucroEstimado,
        roasMultiplicador,
        statusRoi,
        diagnosticoTexto,
      };
    }

    return mapa;
  }, [eventosPeriodo, verba]);

  // Totais gerais consolidados
  const totaisGerais = useMemo(() => {
    const g = estatisticasPorCanal.google_ads;
    const f = estatisticasPorCanal.facebook_ads;
    const o = estatisticasPorCanal.openai_ads;
    const org = estatisticasPorCanal.organico;

    const visitantesPagos = g.visitantesUnicos + f.visitantesUnicos + o.visitantesUnicos;
    const visitantesTotais = visitantesPagos + org.visitantesUnicos;
    const verbaTotal = g.verbaGasta + f.verbaGasta + o.verbaGasta;
    const conversoesPagas = g.totalConversoes + f.totalConversoes + o.totalConversoes;
    const conversoesTotais = conversoesPagas + org.totalConversoes;
    const cplMedioPago = conversoesPagas > 0 ? verbaTotal / conversoesPagas : 0;

    return {
      visitantesPagos,
      visitantesTotais,
      verbaTotal,
      conversoesPagas,
      conversoesTotais,
      cplMedioPago,
    };
  }, [estatisticasPorCanal]);

  // Top veículos: visualizações, tempo médio ativo, conversão e cidades de origem
  const topVeiculos = useMemo(() => {
    interface Acc {
      chave: string;
      nome: string;
      valor: number | null;
      viewEvents: number;
      selectEvents: number;
      tempoTotalSeg: number;
      viewsComTempo: number;
      viewers: Set<string>;
      conversores: Set<string>;
      whatsapp: number;
      cidades: Map<string, Set<string>>;
      google_ads: number;
      facebook_ads: number;
      openai_ads: number;
      organico: number;
    }
    const mapa = new Map<string, Acc>();

    for (const ev of eventosPeriodo) {
      if (!ev.veiculo_nome && !ev.veiculo_id) continue;
      const nome = (ev.veiculo_nome || '').trim();
      const chave = ev.veiculo_id || nome.toLowerCase();
      if (!chave) continue;

      const item: Acc = mapa.get(chave) || {
        chave,
        nome: nome || `Veículo ${ev.veiculo_id}`,
        valor: ev.valor_veiculo,
        viewEvents: 0,
        selectEvents: 0,
        tempoTotalSeg: 0,
        viewsComTempo: 0,
        viewers: new Set<string>(),
        conversores: new Set<string>(),
        whatsapp: 0,
        cidades: new Map<string, Set<string>>(),
        google_ads: 0,
        facebook_ads: 0,
        openai_ads: 0,
        organico: 0,
      };
      if (nome && item.nome.startsWith('Veículo ')) item.nome = nome;

      if (ev.acao === 'view_vehicle' || ev.acao === 'select_vehicle') {
        item.viewers.add(ev.visitor_id);
        if (ev.acao === 'view_vehicle') {
          item.viewEvents += 1;
          const t = Number(ev.tempo_segundos) || 0;
          if (t > 0) {
            item.tempoTotalSeg += t;
            item.viewsComTempo += 1;
          }
        } else {
          item.selectEvents += 1;
        }
        if (ev.cidade) {
          const set = item.cidades.get(ev.cidade) || new Set<string>();
          set.add(ev.visitor_id);
          item.cidades.set(ev.cidade, set);
        }
      }
      if (ev.acao === 'whatsapp_click' || ev.acao === 'lead_completo' || ev.acao === 'lead_parcial') {
        item.whatsapp += 1;
        item.conversores.add(ev.visitor_id);
      }
      item[ev.origem_macro] += 1;
      if (!item.valor && ev.valor_veiculo) item.valor = ev.valor_veiculo;
      mapa.set(chave, item);
    }

    return Array.from(mapa.values())
      .map((a) => ({
        chave: a.chave,
        nome: a.nome,
        valor: a.valor,
        views: a.viewEvents || a.selectEvents,
        tempoMedioSeg: a.viewsComTempo > 0 ? Math.round(a.tempoTotalSeg / a.viewsComTempo) : 0,
        taxaConversao: a.viewers.size > 0 ? Math.min(100, (a.conversores.size / a.viewers.size) * 100) : 0,
        whatsapp: a.whatsapp,
        cidades: Array.from(a.cidades.entries())
          .map(([nome, set]) => ({ nome, visitantes: set.size }))
          .sort((x, y) => y.visitantes - x.visitantes)
          .slice(0, 3),
        google_ads: a.google_ads,
        facebook_ads: a.facebook_ads,
        openai_ads: a.openai_ads,
        organico: a.organico,
      }))
      .sort((a, b) => b.whatsapp - a.whatsapp || b.views - a.views)
      .slice(0, 10);
  }, [eventosPeriodo]);


  // Tela de login quando acessado diretamente por /admin/trafego
  if (!autenticado) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121215] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center text-[#E50914]">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E50914]">
                Manos Veículos • Inteligência de Mídia
              </span>
              <h1 className="text-xl font-black text-white">Painel de Tráfego Pago & ROI</h1>
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Acompanhe quantos visitantes vêm do <strong>Google Ads</strong>,{' '}
            <strong>Facebook Ads</strong>, <strong>OpenAI Ads</strong> e{' '}
            <strong>Visitas Orgânicas</strong>, o que fazem no site e o retorno da verba investida.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Senha do Administrador
              </label>
              <input
                type="password"
                required
                autoFocus
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                placeholder="Digite a senha de acesso (ex: manos2026)..."
                className="w-full px-4 py-3.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-white text-sm focus:outline-none focus:border-[#E50914]"
              />
            </div>

            {erroLogin && (
              <div className="p-3 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 text-xs font-bold text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                <span>{erroLogin}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={autenticando}
              className="w-full py-4 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-black text-sm uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
            >
              {autenticando ? 'Verificando...' : 'Entrar no Painel de Tráfego & ROI'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const content = (
    <div className="space-y-8">
      {/* Cabeçalho e Seletor de Período */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121215] border border-white/10 rounded-2xl p-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#E50914]">
            <Activity className="w-4 h-4" />
            <span>Monitoramento em Tempo Real • Site Todo</span>
          </div>
          <h2 className="text-2xl font-black text-white">
            Origem dos Visitantes, Comportamento & Retorno da Verba (ROI)
          </h2>
          <p className="text-xs text-zinc-400">
            Separação exata entre <strong>Google Ads</strong>, <strong>Facebook Ads</strong>,{' '}
            <strong>OpenAI Ads</strong> e <strong>Visitas Orgânicas</strong> + rastreamento do que cada visitante faz no site.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Hoje', dias: 1 },
            { label: 'Últimos 7 dias', dias: 7 },
            { label: 'Últimos 30 dias', dias: 30 },
            { label: 'Todo o período', dias: 0 },
          ].map((p) => (
            <button
              key={p.dias}
              type="button"
              onClick={() => setPeriodoDias(p.dias)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                periodoDias === p.dias
                  ? 'bg-[#E50914] text-white shadow-lg shadow-[#E50914]/25'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => carregarDados()}
            disabled={carregando}
            title={ultimaAtualizacao ? `Atualizado às ${ultimaAtualizacao.toLocaleTimeString('pt-BR')} (automático a cada 20s)` : undefined}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* 1. OS 4 PILARES DE TRÁFEGO: GOOGLE ADS | FACEBOOK ADS | OPENAI ADS | ORGÂNICO */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(['google_ads', 'facebook_ads', 'openai_ads', 'organico'] as OrigemTrafegoMacro[]).map(
          (canalKey) => {
            const info = CANAL_META[canalKey];
            const stat = estatisticasPorCanal[canalKey];
            const pctVisitantes =
              totaisGerais.visitantesTotais > 0
                ? Math.round((stat.visitantesUnicos / totaisGerais.visitantesTotais) * 100)
                : 0;

            return (
              <div
                key={canalKey}
                onClick={() => setFiltroCanal(filtroCanal === canalKey ? 'todos' : canalKey)}
                className={`rounded-2xl p-5 border transition-all cursor-pointer ${
                  filtroCanal === canalKey
                    ? `${info.corBg} ${info.corBorda} ring-2 ring-white/20`
                    : 'bg-[#121215] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${info.badgeCls}`}
                    >
                      {info.pago ? 'Anúncio Pago' : 'Tráfego Gratuito'}
                    </span>
                    <h3 className={`text-lg font-black mt-1.5 ${info.corTexto}`}>{info.nome}</h3>
                    <p className="text-[11px] text-zinc-400 leading-tight">{info.subtitulo}</p>
                  </div>
                  <span className="text-xs font-black text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg">
                    {pctVisitantes}% do site
                  </span>
                </div>

                {/* Número Principal: Visitantes Únicos */}
                <div className="my-4 py-3 px-4 rounded-xl bg-black/40 border border-white/5 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Visitantes Únicos
                    </span>
                    <span className="text-3xl font-black text-white tabular-nums">
                      {stat.visitantesUnicos}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Páginas Vistas
                    </span>
                    <span className="text-lg font-extrabold text-zinc-200 tabular-nums">
                      {stat.totalAcessos}
                    </span>
                  </div>
                </div>

                {/* Ações dentro do site */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">Viram Carros</span>
                    <strong className="text-sm font-black text-white tabular-nums">
                      {stat.veiculosVistos}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[10px] text-zinc-400 block">Simularam / Placa</span>
                    <strong className="text-sm font-black text-white tabular-nums">
                      {stat.simulacoesEPlacas}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-300 block">Cliques WhatsApp</span>
                    <strong className="text-sm font-black text-emerald-400 tabular-nums">
                      {stat.cliquesWhatsApp}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                    <span className="text-[10px] text-sky-300 block">Leads Formulário</span>
                    <strong className="text-sm font-black text-sky-400 tabular-nums">
                      {stat.leadsFormulario}
                    </strong>
                  </div>
                </div>

                {/* Rodapé Financeiro do Card */}
                {info.pago ? (
                  <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Verba Gasta:</span>
                      <strong className="text-white font-extrabold">
                        {formatarMoedaBRL(stat.verbaGasta)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Custo por Visitante (CPC):</span>
                      <strong className="text-zinc-200">
                        {stat.verbaGasta > 0 && stat.visitantesUnicos > 0
                          ? formatarMoedaBRL(stat.cpcReal)
                          : '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Custo por Conversão (CPL):</span>
                      <strong
                        className={
                          stat.statusRoi === 'otimo'
                            ? 'text-emerald-400 font-black'
                            : stat.statusRoi === 'critico'
                              ? 'text-red-400 font-black'
                              : 'text-amber-400 font-black'
                        }
                      >
                        {stat.verbaGasta > 0 && stat.totalConversoes > 0
                          ? formatarMoedaBRL(stat.cplReal)
                          : '—'}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Custo de Mídia:</span>
                      <strong className="text-emerald-400 font-extrabold">R$ 0,00 (Orgânico)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Total de Conversões:</span>
                      <strong className="text-white font-black">{stat.totalConversoes}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Taxa de Conversão:</span>
                      <strong className="text-amber-400 font-black">
                        {stat.taxaConversao.toFixed(1)}%
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      {/* 2. SIMULADOR E CONTROLE DE VERBA GASTA X RESULTADO (ROI) */}
      <div className="bg-[#121215] border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              <span>Controle Financeiro de Mídia Paga</span>
            </span>
            <h3 className="text-lg font-black text-white">
              A Verba Gasta Está Dando o Resultado que Queremos?
            </h3>
            <p className="text-xs text-zinc-400">
              Preencha quanto foi investido em cada canal para calcular automaticamente o Custo por Visitante, o Custo por Lead/WhatsApp (CPL) e se o canal está batendo a meta.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Investimento Total Pago
            </span>
            <span className="text-2xl font-black text-emerald-400">
              {formatarMoedaBRL(totaisGerais.verbaTotal)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSalvarVerba} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-sky-400 mb-1.5">
                Verba Google Ads (R$)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={verba.verba_google_ads || ''}
                onChange={(e) =>
                  setVerba((v) => ({ ...v, verba_google_ads: Number(e.target.value) || 0 }))
                }
                placeholder="Ex: 1500"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-sky-500/30 text-white text-sm font-bold focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 mb-1.5">
                Verba Facebook/Meta Ads (R$)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={verba.verba_facebook_ads || ''}
                onChange={(e) =>
                  setVerba((v) => ({ ...v, verba_facebook_ads: Number(e.target.value) || 0 }))
                }
                placeholder="Ex: 2500"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-indigo-500/30 text-white text-sm font-bold focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 mb-1.5">
                Verba OpenAI Ads / ChatGPT (R$)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={verba.verba_openai_ads || ''}
                onChange={(e) =>
                  setVerba((v) => ({ ...v, verba_openai_ads: Number(e.target.value) || 0 }))
                }
                placeholder="Ex: 1000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-emerald-500/30 text-white text-sm font-bold focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-amber-400 mb-1.5">
                Meta Máx. por Lead/Whats (R$)
              </label>
              <input
                type="number"
                min="1"
                step="5"
                value={verba.meta_cpl_desejado || ''}
                onChange={(e) =>
                  setVerba((v) => ({ ...v, meta_cpl_desejado: Number(e.target.value) || 40 }))
                }
                placeholder="Ex: 40"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-amber-500/30 text-white text-sm font-bold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={salvandoVerba}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-extrabold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 h-[42px]"
              >
                <Save className="w-4 h-4" />
                <span>{salvandoVerba ? 'Salvando...' : 'Salvar Verba'}</span>
              </button>
            </div>
          </div>

          {msgSucessoVerba && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{msgSucessoVerba}</span>
            </div>
          )}
        </form>

        {/* Diagnóstico de Eficiência por Canal */}
        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                <th className="py-3 px-4">Canal de Aquisição</th>
                <th className="py-3 px-4">Verba Gasta</th>
                <th className="py-3 px-4">Visitantes</th>
                <th className="py-3 px-4">Carros Vistos</th>
                <th className="py-3 px-4">Conversões (Whats + Leads)</th>
                <th className="py-3 px-4">Taxa Conv.</th>
                <th className="py-3 px-4">CPL Real</th>
                <th className="py-3 px-4">Diagnóstico do Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(['google_ads', 'facebook_ads', 'openai_ads', 'organico'] as OrigemTrafegoMacro[]).map(
                (c) => {
                  const info = CANAL_META[c];
                  const st = estatisticasPorCanal[c];
                  return (
                    <tr key={c} className="hover:bg-white/[0.02]">
                      <td className="py-3.5 px-4 font-bold">
                        <span className={info.corTexto}>{info.nome}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white tabular-nums">
                        {info.pago ? formatarMoedaBRL(st.verbaGasta) : 'R$ 0,00'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white tabular-nums">
                        {st.visitantesUnicos}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300 tabular-nums">
                        {st.veiculosVistos}
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-400 tabular-nums">
                        {st.totalConversoes}{' '}
                        <span className="text-[10px] font-normal text-zinc-400">
                          ({st.cliquesWhatsApp} Whats / {st.leadsFormulario} Leads)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-zinc-200 tabular-nums">
                        {st.taxaConversao.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 font-black tabular-nums">
                        {info.pago ? (
                          st.verbaGasta > 0 && st.totalConversoes > 0 ? (
                            <span
                              className={
                                st.statusRoi === 'otimo'
                                  ? 'text-emerald-400'
                                  : st.statusRoi === 'critico'
                                    ? 'text-red-400'
                                    : 'text-amber-400'
                              }
                            >
                              {formatarMoedaBRL(st.cplReal)}
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )
                        ) : (
                          <span className="text-emerald-400">Gratuito</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {st.statusRoi === 'otimo' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          )}
                          {st.statusRoi === 'atencao' && (
                            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          )}
                          {st.statusRoi === 'critico' && (
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          )}
                          {st.statusRoi === 'organico' && (
                            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          )}
                          <span className="text-zinc-300">{st.diagnosticoTexto}</span>
                        </div>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. VEÍCULOS MAIS PROCURADOS: tempo médio, conversão e cidades */}
      {topVeiculos.length > 0 && (
        <div className="bg-white/[0.025] backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E50914]">
              Interesse no Estoque
            </span>
            <h3 className="text-lg font-black text-white">
              Quais Carros os Visitantes Estão Olhando e Chamando no WhatsApp
            </h3>
          </div>

          <div className="overflow-x-auto border border-white/10 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/5 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                  <th className="py-3 px-4">Veículo</th>
                  <th className="py-3 px-4">Visualizações</th>
                  <th className="py-3 px-4">Tempo médio na página</th>
                  <th className="py-3 px-4">Conversão</th>
                  <th className="py-3 px-4">WhatsApp / Leads</th>
                  <th className="py-3 px-4">Cidades principais</th>
                  <th className="py-3 px-4 text-sky-400">Google Ads</th>
                  <th className="py-3 px-4 text-indigo-400">Facebook Ads</th>
                  <th className="py-3 px-4 text-emerald-400">OpenAI Ads</th>
                  <th className="py-3 px-4 text-amber-400">Orgânico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topVeiculos.map((v) => (
                  <tr key={v.chave} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-bold text-white">
                      {v.nome}
                      {v.valor ? (
                        <span className="ml-2 text-zinc-400 font-normal">({formatarMoedaBRL(v.valor)})</span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 font-bold text-zinc-200 tabular-nums">{v.views}</td>
                    <td className="py-3 px-4 font-bold text-sky-300 tabular-nums">
                      {v.tempoMedioSeg > 0 ? formatarDuracao(v.tempoMedioSeg) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-3 px-4 font-bold tabular-nums">
                      <span className={v.taxaConversao >= 10 ? 'text-emerald-400' : v.taxaConversao > 0 ? 'text-amber-300' : 'text-zinc-500'}>
                        {v.taxaConversao.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 font-black text-emerald-400 tabular-nums">{v.whatsapp}</td>
                    <td className="py-3 px-4 text-zinc-300">
                      {v.cidades.length > 0 ? (
                        v.cidades.map((c) => (
                          <span key={c.nome} className="inline-block mr-1.5 whitespace-nowrap">
                            {c.nome} <span className="text-zinc-500">({c.visitantes})</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sky-300 tabular-nums">{v.google_ads}</td>
                    <td className="py-3 px-4 text-indigo-300 tabular-nums">{v.facebook_ads}</td>
                    <td className="py-3 px-4 text-emerald-300 tabular-nums">{v.openai_ads}</td>
                    <td className="py-3 px-4 text-amber-300 tabular-nums">{v.organico}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. JORNADA INDIVIDUAL AO VIVO: o que cada visitante está fazendo dentro do site */}
      <JornadaVisitantesSecao
        eventos={eventosPeriodo}
        visitantes={visitantes}
        campanhas={campanhas}
        integracoes={integracoes}
        filtroCanal={filtroCanal}
        onFiltroCanal={setFiltroCanal}
      />
    </div>
  );

  if (!standalone) {
    return content;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans">
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png"
              alt="Manos Veículos"
              className="h-9 w-auto object-contain"
            />
            <div className="hidden sm:block h-6 w-px bg-white/10" />
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#E50914] block">
                Painel Administrativo
              </span>
              <span className="text-sm font-bold text-white">
                Inteligência de Tráfego Pago, Comportamento & ROI
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/ofertas/admin"
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <Car className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Gerenciador de Anúncios (/ofertas/admin)</span>
            </a>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Ver Site</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{content}</main>
    </div>
  );
}
