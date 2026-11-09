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

export type OrigemTrafegoMacro = 'google_ads' | 'facebook_ads' | 'openai_ads' | 'organico';

export type TipoAcaoVisitante =
  | 'page_view'
  | 'view_vehicle'
  | 'select_vehicle'
  | 'plate_lookup'
  | 'simulacao'
  | 'consultor_ia'
  | 'lead_parcial'
  | 'lead_completo'
  | 'whatsapp_click'
  | 'phone_click';

export interface EventoJornadaVisitante {
  id: string;
  timestamp: string;
  visitor_id: string;
  session_id: string;
  origem_macro: OrigemTrafegoMacro;
  sub_origem: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  oppref: string | null;
  referrer: string | null;
  acao: TipoAcaoVisitante;
  pagina: string;
  veiculo_id: string | null;
  veiculo_nome: string | null;
  valor_veiculo: number | null;
  detalhe: string | null;
  dispositivo: 'Mobile' | 'Desktop';
}

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

function labelAcao(acao: TipoAcaoVisitante): {
  titulo: string;
  cor: string;
  icone: React.ReactNode;
} {
  switch (acao) {
    case 'page_view':
      return {
        titulo: 'Acessou Página',
        cor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        icone: <Eye className="w-3.5 h-3.5 text-zinc-400" />,
      };
    case 'view_vehicle':
      return {
        titulo: 'Viu Veículo',
        cor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        icone: <Car className="w-3.5 h-3.5 text-sky-400" />,
      };
    case 'select_vehicle':
      return {
        titulo: 'Selecionou Carro',
        cor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        icone: <MousePointerClick className="w-3.5 h-3.5 text-indigo-400" />,
      };
    case 'plate_lookup':
      return {
        titulo: 'Consultou Placa (Troca/Venda)',
        cor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        icone: <Search className="w-3.5 h-3.5 text-purple-400" />,
      };
    case 'simulacao':
      return {
        titulo: 'Simulou Financiamento',
        cor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        icone: <Calculator className="w-3.5 h-3.5 text-amber-400" />,
      };
    case 'consultor_ia':
      return {
        titulo: 'Usou Consultor IA',
        cor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        icone: <Bot className="w-3.5 h-3.5 text-cyan-400" />,
      };
    case 'lead_parcial':
      return {
        titulo: 'Deixou Contato Inicial',
        cor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        icone: <Users className="w-3.5 h-3.5 text-orange-400" />,
      };
    case 'lead_completo':
      return {
        titulo: 'Lead Qualificado Enviado',
        cor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icone: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      };
    case 'whatsapp_click':
      return {
        titulo: 'Clicou no WhatsApp',
        cor: 'bg-green-500/20 text-green-300 border-green-500/40',
        icone: <MessageCircle className="w-3.5 h-3.5 text-green-400" />,
      };
    case 'phone_click':
      return {
        titulo: 'Clicou para Ligar',
        cor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        icone: <Phone className="w-3.5 h-3.5 text-teal-400" />,
      };
  }
}

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
  const [buscaJornada, setBuscaJornada] = useState('');

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

  const carregarDados = async () => {
    const adminKey = getSavedAdminKey();
    if (!adminKey) return;
    setCarregando(true);
    try {
      const res = await fetch('/api/trafego/resumo', {
        headers: { 'x-ofertas-admin-key': adminKey },
      });
      if (res.status === 401) {
        setAutenticado(false);
        setCarregando(false);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.eventos)) setEventos(json.eventos);
        if (json.verba) setVerba(json.verba);
      }
    } catch (err) {
      console.error('Erro ao carregar painel de tráfego:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (autenticado) {
      carregarDados();
    }
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

  // Agrupa a jornada passo a passo de cada visitante (para responder "o que estão fazendo dentro do site")
  const jornadasVisitantes = useMemo(() => {
    const filtrados = eventosPeriodo.filter((e) => {
      if (filtroCanal !== 'todos' && e.origem_macro !== filtroCanal) return false;
      if (buscaJornada.trim()) {
        const q = buscaJornada.toLowerCase();
        const texto = `${e.sub_origem} ${e.utm_campaign || ''} ${e.pagina} ${e.veiculo_nome || ''} ${e.detalhe || ''}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });

    const grupos = new Map<
      string,
      {
        visitor_id: string;
        origem_macro: OrigemTrafegoMacro;
        sub_origem: string;
        utm_campaign: string | null;
        utm_content: string | null;
        dispositivo: 'Mobile' | 'Desktop';
        primeiroAcesso: string;
        ultimoAcesso: string;
        converteu: boolean;
        passos: EventoJornadaVisitante[];
      }
    >();

    for (const ev of filtrados) {
      const chave = ev.visitor_id || ev.session_id || ev.id;
      const existente = grupos.get(chave);
      const ehConversao =
        ev.acao === 'whatsapp_click' ||
        ev.acao === 'phone_click' ||
        ev.acao === 'lead_completo' ||
        ev.acao === 'lead_parcial';

      if (!existente) {
        grupos.set(chave, {
          visitor_id: chave,
          origem_macro: ev.origem_macro,
          sub_origem: ev.sub_origem,
          utm_campaign: ev.utm_campaign,
          utm_content: ev.utm_content,
          dispositivo: ev.dispositivo,
          primeiroAcesso: ev.timestamp,
          ultimoAcesso: ev.timestamp,
          converteu: ehConversao,
          passos: [ev],
        });
      } else {
        existente.passos.push(ev);
        if (ehConversao) existente.converteu = true;
        if (new Date(ev.timestamp) < new Date(existente.primeiroAcesso)) {
          existente.primeiroAcesso = ev.timestamp;
        }
        if (new Date(ev.timestamp) > new Date(existente.ultimoAcesso)) {
          existente.ultimoAcesso = ev.timestamp;
        }
        // Prioriza mostrar origem paga caso um dos eventos tenha capturado o clique pago
        if (existente.origem_macro === 'organico' && ev.origem_macro !== 'organico') {
          existente.origem_macro = ev.origem_macro;
          existente.sub_origem = ev.sub_origem;
        }
        if (!existente.utm_campaign && ev.utm_campaign) {
          existente.utm_campaign = ev.utm_campaign;
        }
      }
    }

    return Array.from(grupos.values())
      .map((g) => ({
        ...g,
        // Ordena os passos cronologicamente (do primeiro ao último passo dentro do site)
        passos: [...g.passos].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        ),
      }))
      .sort((a, b) => new Date(b.ultimoAcesso).getTime() - new Date(a.ultimoAcesso).getTime())
      .slice(0, 100);
  }, [eventosPeriodo, filtroCanal, buscaJornada]);

  // Top veículos mais vistos/clicados e de qual canal vieram
  const topVeiculos = useMemo(() => {
    const mapa = new Map<
      string,
      {
        nome: string;
        valor: number | null;
        views: number;
        whatsapp: number;
        google_ads: number;
        facebook_ads: number;
        openai_ads: number;
        organico: number;
      }
    >();

    for (const ev of eventosPeriodo) {
      if (!ev.veiculo_nome && !ev.veiculo_id) continue;
      const chave = (ev.veiculo_nome || ev.veiculo_id || '').trim();
      if (!chave) continue;

      const item = mapa.get(chave) || {
        nome: chave,
        valor: ev.valor_veiculo,
        views: 0,
        whatsapp: 0,
        google_ads: 0,
        facebook_ads: 0,
        openai_ads: 0,
        organico: 0,
      };

      if (ev.acao === 'view_vehicle' || ev.acao === 'select_vehicle' || ev.acao === 'page_view') {
        item.views += 1;
      }
      if (
        ev.acao === 'whatsapp_click' ||
        ev.acao === 'lead_completo' ||
        ev.acao === 'lead_parcial'
      ) {
        item.whatsapp += 1;
      }
      item[ev.origem_macro] += 1;
      if (!item.valor && ev.valor_veiculo) item.valor = ev.valor_veiculo;
      mapa.set(chave, item);
    }

    return Array.from(mapa.values())
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
            onClick={carregarDados}
            disabled={carregando}
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

      {/* 3. VEÍCULOS MAIS PROCURADOS POR ORIGEM DE ANÚNCIO */}
      {topVeiculos.length > 0 && (
        <div className="bg-[#121215] border border-white/10 rounded-2xl p-6 space-y-4">
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
                  <th className="py-3 px-4">WhatsApp / Leads</th>
                  <th className="py-3 px-4 text-sky-400">Google Ads</th>
                  <th className="py-3 px-4 text-indigo-400">Facebook Ads</th>
                  <th className="py-3 px-4 text-emerald-400">OpenAI Ads</th>
                  <th className="py-3 px-4 text-amber-400">Orgânico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topVeiculos.map((v, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-bold text-white">
                      {v.nome}
                      {v.valor ? (
                        <span className="ml-2 text-zinc-400 font-normal">
                          ({formatarMoedaBRL(v.valor)})
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 font-bold text-zinc-200 tabular-nums">{v.views}</td>
                    <td className="py-3 px-4 font-black text-emerald-400 tabular-nums">
                      {v.whatsapp}
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

      {/* 4. JORNADA INDIVIDUAL AO VIVO: O QUE CADA VISITANTE ESTÁ FAZENDO DENTRO DO SITE */}
      <div className="bg-[#121215] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E50914]">
              Rastreamento Passo a Passo
            </span>
            <h3 className="text-lg font-black text-white">
              O Que os Visitantes Estão Fazendo Dentro do Site ({jornadasVisitantes.length})
            </h3>
            <p className="text-xs text-zinc-400">
              Veja exatamente por qual anúncio cada visitante entrou, quais páginas abriu, quais veículos olhou e se clicou no WhatsApp ou enviou proposta.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroCanal}
              onChange={(e) => setFiltroCanal(e.target.value as any)}
              className="px-3.5 py-2 rounded-xl bg-[#0A0A0B] border border-white/15 text-xs font-bold text-white"
            >
              <option value="todos">Todos os Canais</option>
              <option value="google_ads">Somente Google Ads</option>
              <option value="facebook_ads">Somente Facebook / Meta Ads</option>
              <option value="openai_ads">Somente OpenAI Ads (ChatGPT)</option>
              <option value="organico">Somente Visitas Orgânicas</option>
            </select>

            <input
              type="text"
              value={buscaJornada}
              onChange={(e) => setBuscaJornada(e.target.value)}
              placeholder="Buscar carro, campanha, página..."
              className="px-3.5 py-2 rounded-xl bg-[#0A0A0B] border border-white/15 text-xs text-white focus:outline-none focus:border-[#E50914]"
            />
          </div>
        </div>

        {jornadasVisitantes.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-sm font-bold text-zinc-300">
              Nenhum acesso encontrado para este filtro/período.
            </p>
            <p className="text-xs text-zinc-500">
              Assim que visitantes navegarem pelo site, cada passo aparecerá aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jornadasVisitantes.map((j) => {
              const canalInfo = CANAL_META[j.origem_macro];
              const dataFormatada = new Date(j.ultimoAcesso).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={j.visitor_id}
                  className={`p-4 rounded-2xl border transition-all ${
                    j.converteu
                      ? 'bg-emerald-950/15 border-emerald-500/30'
                      : 'bg-[#0A0A0B] border-white/10'
                  }`}
                >
                  {/* Topo do Visitante */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${canalInfo.badgeCls}`}
                      >
                        {canalInfo.nome}
                      </span>
                      <span className="text-xs font-bold text-zinc-300">{j.sub_origem}</span>

                      {j.utm_campaign && (
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-zinc-300">
                          Campanha: <strong>{j.utm_campaign}</strong>
                        </span>
                      )}

                      {j.converteu && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                          Converteu!
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        {j.dispositivo === 'Mobile' ? (
                          <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        {j.dispositivo}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        {dataFormatada}
                      </span>
                    </div>
                  </div>

                  {/* Trilha / Passo a Passo do que o visitante fez no site */}
                  <div className="flex flex-wrap items-center gap-2">
                    {j.passos.map((passo, idx) => {
                      const metaAcao = labelAcao(passo.acao);
                      return (
                        <React.Fragment key={passo.id}>
                          {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />}
                          <div
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs ${metaAcao.cor}`}
                          >
                            {metaAcao.icone}
                            <span className="font-bold">{metaAcao.titulo}:</span>
                            <span className="opacity-90">
                              {passo.veiculo_nome || passo.detalhe || passo.pagina}
                            </span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
