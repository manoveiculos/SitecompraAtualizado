import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Calculator,
  Camera,
  Car,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Flame,
  Images,
  MapPin,
  MessageCircle,
  Monitor,
  MousePointerClick,
  Phone,
  Search,
  Smartphone,
  Timer,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  agruparCarrosVistos,
  alvoDemografiaMeta,
  calcularTemperatura,
  formatarDuracao,
  TEMPERATURA_LABEL,
  tempoTotalSessaoSeg,
  type CarroVisto,
  type ContextoCampanhaMeta,
  type EventoJornadaVisitante,
  type NivelTemperatura,
  type OrigemTrafegoMacro,
  type Temperatura,
  type VisitanteIdentificado,
} from '../../lib/trafegoInteligencia';
import { formatarMoedaBRL } from '../../services/ofertasService';

const CANAL: Record<OrigemTrafegoMacro, { nome: string; badge: string }> = {
  google_ads: { nome: 'Google Ads', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  facebook_ads: { nome: 'Instagram / Facebook Ads', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  openai_ads: { nome: 'OpenAI Ads', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  organico: { nome: 'Orgânico / Direto', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
};

const TEMP_ESTILO: Record<NivelTemperatura, { badge: string; glow: string }> = {
  frio: { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30', glow: '' },
  morno: { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', glow: '' },
  quente: {
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    glow: 'shadow-[0_0_24px_-6px_rgba(249,115,22,0.35)]',
  },
  muito_quente: {
    badge: 'bg-[#E50914]/25 text-red-200 border-[#E50914]/50',
    glow: 'shadow-[0_0_28px_-4px_rgba(229,9,20,0.45)]',
  },
};

const STATUS_CRM: Record<string, string> = {
  received: 'Novo',
  new: 'Novo',
  vendido: 'Vendido',
  lost: 'Perdido',
  perdido: 'Perdido',
  lost_by_inactivity: 'Perdido (inatividade)',
  frio: 'Frio',
};

function rotuloStatusCrm(status: string | null): string {
  if (!status) return 'No CRM';
  return STATUS_CRM[status] || status.replace(/_/g, ' ');
}

function formatarTelefone(tel: string | null): string {
  const d = (tel || '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel || '';
}

/** Nome legível a partir da URL quando um evento antigo não trouxe o veículo. */
function nomeDoVeiculoNoPasso(p: EventoJornadaVisitante): string {
  if (p.veiculo_nome) return p.veiculo_nome;
  const m = p.pagina.match(/^\/(?:estoque|veiculo)\/([^/?#]+)/);
  if (m) {
    const nome = m[1]
      .replace(/-\d{5,}$/, '')
      .split('-')
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    if (nome) return nome;
  }
  return 'Veículo não identificado';
}

interface Jornada {
  chave: string;
  origem_macro: OrigemTrafegoMacro;
  sub_origem: string;
  utm_campaign: string | null;
  campanhaId: string | null;
  campanhaNome: string | null;
  demografia: ContextoCampanhaMeta['demografia'];
  cidade: string | null;
  uf: string | null;
  aparelho: string;
  dispositivo: 'Mobile' | 'Desktop';
  primeiroAcesso: string;
  ultimoAcesso: string;
  converteu: boolean;
  clicouWhatsApp: boolean;
  passos: EventoJornadaVisitante[];
  carros: CarroVisto[];
  temperatura: Temperatura;
  tempoTotalSeg: number;
  visitante: VisitanteIdentificado | null;
}

const ehConversao = (p: EventoJornadaVisitante) =>
  p.acao === 'whatsapp_click' || p.acao === 'phone_click' || p.acao === 'lead_completo' || p.acao === 'lead_parcial';

interface Props {
  eventos: EventoJornadaVisitante[];
  visitantes: Record<string, VisitanteIdentificado>;
  campanhas: Record<string, ContextoCampanhaMeta>;
  integracoes: { crm: boolean; meta_ads: boolean } | null;
  /** Controlado pelo painel: clicar num card de canal lá em cima filtra a lista aqui. */
  filtroCanal: 'todos' | OrigemTrafegoMacro;
  onFiltroCanal: (canal: 'todos' | OrigemTrafegoMacro) => void;
}

type FiltroTemp = 'todas' | 'quentes' | 'whatsapp' | NivelTemperatura;

export default function JornadaVisitantesSecao({
  eventos,
  visitantes,
  campanhas,
  integracoes,
  filtroCanal,
  onFiltroCanal: setFiltroCanal,
}: Props) {
  const [filtroCarro, setFiltroCarro] = useState('todos');
  const [filtroCidade, setFiltroCidade] = useState('todas');
  const [filtroTemp, setFiltroTemp] = useState<FiltroTemp>('todas');
  const [busca, setBusca] = useState('');

  const jornadas = useMemo<Jornada[]>(() => {
    const grupos = new Map<string, EventoJornadaVisitante[]>();
    for (const ev of eventos) {
      const chave = ev.visitor_id || ev.session_id || ev.id;
      const lista = grupos.get(chave);
      if (lista) lista.push(ev);
      else grupos.set(chave, [ev]);
    }

    return Array.from(grupos.entries()).map(([chave, brutos]) => {
      const passos = [...brutos].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      // Mostra a origem paga se QUALQUER passo a capturou (o first touch não some).
      const comOrigemPaga = passos.find((p) => p.origem_macro !== 'organico') || passos[0];
      const comCampanha = passos.find((p) => p.campanha_id || p.conjunto_id || p.anuncio_id) || comOrigemPaga;
      const comGeo = [...passos].reverse().find((p) => p.cidade) || null;
      const comUa = [...passos].reverse().find((p) => p.dispositivo_detalhe) || passos[passos.length - 1];
      const ultimo = passos.reduce((max, p) => {
        const t = new Date(p.atualizado_em || p.timestamp).getTime();
        return t > max ? t : max;
      }, 0);

      const alvo = alvoDemografiaMeta(comCampanha);
      const campanhaId = comCampanha.campanha_id || comCampanha.utm_campaign;

      return {
        chave,
        origem_macro: comOrigemPaga.origem_macro,
        sub_origem: comOrigemPaga.sub_origem,
        utm_campaign: comOrigemPaga.utm_campaign,
        campanhaId: campanhaId || null,
        campanhaNome: comCampanha.campanha_id ? campanhas[comCampanha.campanha_id]?.nome ?? null : null,
        demografia: alvo ? campanhas[alvo]?.demografia ?? null : null,
        cidade: comGeo?.cidade ?? null,
        uf: comGeo?.uf ?? null,
        aparelho: comUa.dispositivo_detalhe || comUa.dispositivo,
        dispositivo: comUa.dispositivo,
        primeiroAcesso: passos[0].timestamp,
        ultimoAcesso: new Date(ultimo || passos[passos.length - 1].timestamp).toISOString(),
        converteu: passos.some(ehConversao),
        clicouWhatsApp: passos.some((p) => p.acao === 'whatsapp_click'),
        passos,
        carros: agruparCarrosVistos(passos),
        temperatura: calcularTemperatura(passos),
        tempoTotalSeg: tempoTotalSessaoSeg(passos),
        visitante: visitantes[chave] ?? null,
      };
    });
  }, [eventos, visitantes, campanhas]);

  const carrosDisponiveis = useMemo(
    () => Array.from(new Set(jornadas.flatMap((j) => j.carros.map((c) => c.nome)))).sort(),
    [jornadas],
  );
  const cidadesDisponiveis = useMemo(
    () => Array.from(new Set(jornadas.map((j) => j.cidade).filter((c): c is string => Boolean(c)))).sort(),
    [jornadas],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return jornadas
      .filter((j) => {
        if (filtroCanal !== 'todos' && j.origem_macro !== filtroCanal) return false;
        if (filtroCarro !== 'todos' && !j.carros.some((c) => c.nome === filtroCarro)) return false;
        if (filtroCidade !== 'todas' && j.cidade !== filtroCidade) return false;
        if (filtroTemp === 'quentes' && !['quente', 'muito_quente'].includes(j.temperatura.nivel)) return false;
        if (filtroTemp === 'whatsapp' && !j.clicouWhatsApp) return false;
        if (['frio', 'morno', 'quente', 'muito_quente'].includes(filtroTemp) && j.temperatura.nivel !== filtroTemp) {
          return false;
        }
        if (q) {
          const texto = [
            j.sub_origem,
            j.utm_campaign,
            j.campanhaNome,
            j.cidade,
            j.visitante?.nome,
            j.visitante?.telefone,
            ...j.carros.map((c) => c.nome),
            ...j.passos.map((p) => p.detalhe),
          ]
            .join(' ')
            .toLowerCase();
          if (!texto.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.ultimoAcesso).getTime() - new Date(a.ultimoAcesso).getTime())
      .slice(0, 100);
  }, [jornadas, filtroCanal, filtroCarro, filtroCidade, filtroTemp, busca]);

  const selectCls = 'px-3 py-2 rounded-xl bg-[#0A0A0B] border border-white/15 text-xs font-bold text-white max-w-[210px]';

  return (
    <div className="bg-white/[0.025] backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="space-y-4 border-b border-white/10 pb-4">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E50914]">
            Rastreamento Passo a Passo
          </span>
          <h3 className="text-lg font-black text-white">
            O Que os Visitantes Estão Fazendo Dentro do Site ({filtradas.length})
          </h3>
          <p className="text-xs text-zinc-400">
            Anúncio de origem, cidade, aparelho, tempo em cada carro e — quando a pessoa se identifica — quem ela é no Manos CRM.
          </p>
          {integracoes && (!integracoes.crm || !integracoes.meta_ads) && (
            <p className="mt-2 text-[11px] text-amber-300/90">
              {!integracoes.crm && 'CRM desconectado (falta SUPABASE_SERVICE_ROLE_KEY no servidor): visitantes seguem anônimos. '}
              {!integracoes.meta_ads &&
                'Meta Ads desconectado (falta META_ADS_ACCESS_TOKEN): campanha aparece só como ID, sem faixa etária do anúncio.'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select value={filtroCanal} onChange={(e) => setFiltroCanal(e.target.value as typeof filtroCanal)} className={selectCls}>
            <option value="todos">Todos os canais</option>
            <option value="google_ads">Google Ads</option>
            <option value="facebook_ads">Facebook / Instagram Ads</option>
            <option value="openai_ads">OpenAI Ads (ChatGPT)</option>
            <option value="organico">Orgânico / Direto</option>
          </select>

          <select value={filtroCarro} onChange={(e) => setFiltroCarro(e.target.value)} className={selectCls}>
            <option value="todos">Todos os carros</option>
            {carrosDisponiveis.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)} className={selectCls}>
            <option value="todas">Todas as cidades</option>
            {cidadesDisponiveis.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select value={filtroTemp} onChange={(e) => setFiltroTemp(e.target.value as FiltroTemp)} className={selectCls}>
            <option value="todas">Qualquer temperatura</option>
            <option value="quentes">Quentes (Quente + Muito Quente)</option>
            <option value="whatsapp">Clicaram no WhatsApp</option>
            <option value="muito_quente">Somente Muito Quente</option>
            <option value="quente">Somente Quente</option>
            <option value="morno">Somente Morno</option>
            <option value="frio">Somente Frio</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome, carro, campanha..."
              className="pl-8 pr-3 py-2 rounded-xl bg-[#0A0A0B] border border-white/15 text-xs text-white focus:outline-none focus:border-[#E50914]"
            />
          </div>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="py-12 text-center text-zinc-400 space-y-2">
          <Users className="w-10 h-10 mx-auto text-zinc-600" />
          <p className="text-sm font-bold text-zinc-300">Nenhum acesso encontrado para este filtro/período.</p>
          <p className="text-xs text-zinc-500">Assim que visitantes navegarem pelo site, cada passo aparecerá aqui automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((j) => (
            <JornadaCard key={j.chave} j={j} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border ${className}`}>
      {children}
    </span>
  );
}

const MAX_PASSOS_INICIAIS = 12;

function JornadaCard({ j }: { j: Jornada }) {
  const [expandido, setExpandido] = useState(false);
  const canal = CANAL[j.origem_macro];
  const temp = TEMP_ESTILO[j.temperatura.nivel];
  const v = j.visitante;
  const noCrm = Boolean(v?.crm_lead_id);

  const dataFormatada = new Date(j.ultimoAcesso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // No funil da home o carro aparece como select_vehicle E view_vehicle: mostra só o que tem tempo.
  const veiculosComVisao = new Set(
    j.passos.filter((p) => p.acao === 'view_vehicle').map((p) => p.veiculo_id || p.veiculo_nome),
  );
  const passosVisiveis = j.passos.filter(
    (p) => !(p.acao === 'select_vehicle' && veiculosComVisao.has(p.veiculo_id || p.veiculo_nome)),
  );
  const passosMostrados = expandido ? passosVisiveis : passosVisiveis.slice(0, MAX_PASSOS_INICIAIS);

  const faixaAnuncio = j.demografia?.predominante;
  const pctFaixa = faixaAnuncio && j.demografia ? Math.round((j.demografia.distribuicao[faixaAnuncio] || 0) * 100) : 0;

  return (
    <div
      className={`p-4 rounded-2xl border bg-[#0A0A0B]/80 backdrop-blur transition-all ${temp.glow} ${
        j.converteu ? 'border-emerald-500/30' : 'border-white/10'
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${canal.badge}`}>
              {canal.nome}
            </span>
            <span className="text-xs font-bold text-zinc-300">{j.sub_origem}</span>
            {j.campanhaId && (
              <Chip className="bg-white/5 border-white/10 text-zinc-300">
                Campanha:{' '}
                <strong className="text-white">{j.campanhaNome || j.campanhaId}</strong>
                {j.campanhaNome && <span className="text-zinc-500 font-mono">#{j.campanhaId}</span>}
              </Chip>
            )}
            {j.converteu && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                Converteu!
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip className="bg-white/5 border-white/10 text-zinc-200">
              <MapPin className="w-3 h-3 text-[#E50914]" />
              {j.cidade ? `${j.cidade}${j.uf ? ` - ${j.uf}` : ''}` : 'Local não identificado'}
            </Chip>
            <Chip className="bg-white/5 border-white/10 text-zinc-200">
              {j.dispositivo === 'Mobile' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
              {j.aparelho}
            </Chip>

            {v?.nome || v?.telefone ? (
              <Chip className="bg-emerald-500/10 border-emerald-500/30 text-emerald-200">
                <UserCheck className="w-3 h-3" />
                <strong>{v.nome || 'Lead identificado'}</strong>
                {v.telefone && <span>• {formatarTelefone(v.telefone)}</span>}
                {v.idade ? <span>• {v.idade} anos</span> : v.faixa_etaria ? <span>• {v.faixa_etaria} anos</span> : null}
                {noCrm && <span>• CRM: {rotuloStatusCrm(v.crm_status)}</span>}
              </Chip>
            ) : faixaAnuncio ? (
              <Chip className="bg-white/5 border-white/10 text-zinc-300" >
                <User className="w-3 h-3" />
                {faixaAnuncio} anos
                <span className="text-zinc-500">
                  (público do anúncio, {pctFaixa}%
                  {j.demografia?.genero_predominante ? `, mais ${j.demografia.genero_predominante === 'feminino' ? 'mulheres' : 'homens'}` : ''})
                </span>
              </Chip>
            ) : (
              <Chip className="bg-white/5 border-white/10 text-zinc-500">
                <User className="w-3 h-3" />
                Visitante anônimo
              </Chip>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Chip className="bg-white/5 border-white/10 text-zinc-200">
              <Timer className="w-3 h-3 text-zinc-400" />
              {formatarDuracao(j.tempoTotalSeg)} no site
            </Chip>
            <span
              title={j.temperatura.motivos.join(' • ') || 'Sem sinais de interesse ainda'}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${temp.badge}`}
            >
              <Flame className="w-3 h-3" />
              {TEMPERATURA_LABEL[j.temperatura.nivel]} · {j.temperatura.score}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <Clock className="w-3 h-3" />
            {dataFormatada}
          </span>
        </div>
      </div>

      {/* Linha do tempo */}
      <div className="flex flex-wrap items-center gap-2">
        {passosMostrados.map((p, idx) => (
          <React.Fragment key={p.id}>
            {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />}
            <Passo p={p} noCrm={noCrm} />
          </React.Fragment>
        ))}
        {passosVisiveis.length > MAX_PASSOS_INICIAIS && (
          <button
            type="button"
            onClick={() => setExpandido((x) => !x)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-zinc-300 cursor-pointer"
          >
            {expandido ? 'Recolher' : `+${passosVisiveis.length - MAX_PASSOS_INICIAIS} passos`}
          </button>
        )}
      </div>

      {j.temperatura.motivos.length > 0 && (
        <p className="mt-3 text-[11px] text-zinc-500">
          Por que {TEMPERATURA_LABEL[j.temperatura.nivel].toLowerCase()}: {j.temperatura.motivos.join(' • ')}
        </p>
      )}
    </div>
  );
}

function Passo({ p, noCrm }: { p: EventoJornadaVisitante; noCrm: boolean }) {
  const base = 'inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs';

  switch (p.acao) {
    case 'page_view':
      return (
        <div className={`${base} bg-zinc-800/70 text-zinc-300 border-zinc-700`}>
          <Eye className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-bold">{p.pagina === '/' ? 'Entrou na Home (/)' : `Acessou ${p.pagina}`}</span>
        </div>
      );

    case 'filter_stock': {
      const detalhe = (p.detalhe || '').split(': ').slice(1).join(': ');
      return (
        <div className={`${base} bg-violet-500/15 text-violet-200 border-violet-500/30`}>
          <Filter className="w-3.5 h-3.5 text-violet-400" />
          <span className="font-bold">Filtrou Estoque</span>
          {detalhe && <span className="opacity-80">({detalhe})</span>}
        </div>
      );
    }

    case 'view_vehicle':
    case 'select_vehicle': {
      const nome = nomeDoVeiculoNoPasso(p);
      const tempo = Number(p.tempo_segundos) || 0;
      const fotos = Number(p.fotos_vistas) || 0;
      const longo = tempo > 60;
      return (
        <div
          className={`${base} ${
            longo ? 'bg-sky-500/20 text-sky-100 border-sky-400/50' : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
          }`}
        >
          <Car className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-bold">{p.acao === 'select_vehicle' ? 'Selecionou' : 'Viu Veículo'}: {nome}</span>
          {tempo > 0 && (
            <span className="px-1.5 rounded bg-sky-400/20 text-sky-100 font-black tabular-nums">({formatarDuracao(tempo)})</span>
          )}
          {p.valor_veiculo ? <span className="opacity-70">{formatarMoedaBRL(p.valor_veiculo)}</span> : null}
          {fotos > 0 && (
            <span className="inline-flex items-center gap-1 opacity-90">
              <Camera className="w-3 h-3" />
              {fotos} {fotos === 1 ? 'foto' : 'fotos'}
            </span>
          )}
          {p.abriu_galeria && (
            <span className="inline-flex items-center gap-1 opacity-90">
              <Images className="w-3 h-3" />
              galeria
            </span>
          )}
        </div>
      );
    }

    case 'simulacao':
      return (
        <div className={`${base} bg-amber-500/15 text-amber-300 border-amber-500/30`}>
          <Calculator className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold">Simulou Financiamento</span>
          {p.veiculo_nome && <span className="opacity-80">{p.veiculo_nome}</span>}
        </div>
      );

    case 'plate_lookup':
      return (
        <div className={`${base} bg-purple-500/15 text-purple-300 border-purple-500/30`}>
          <Search className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-bold">Consultou Placa (Troca/Venda)</span>
        </div>
      );

    case 'consultor_ia':
      return (
        <div className={`${base} bg-cyan-500/15 text-cyan-300 border-cyan-500/30`}>
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold">Usou Consultor IA</span>
        </div>
      );

    case 'lead_parcial':
      return (
        <div className={`${base} bg-orange-500/20 text-orange-300 border-orange-500/40`}>
          <Users className="w-3.5 h-3.5 text-orange-400" />
          <span className="font-bold">Deixou Contato Inicial</span>
        </div>
      );

    case 'lead_completo':
      return (
        <div className={`${base} bg-emerald-500/20 text-emerald-300 border-emerald-500/40`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold">Lead Qualificado Enviado</span>
          {noCrm && <span className="opacity-80">(no CRM)</span>}
        </div>
      );

    case 'whatsapp_click':
      return (
        <div className={`${base} bg-green-500/20 text-green-200 border-green-500/50`}>
          <MessageCircle className="w-3.5 h-3.5 text-green-400" />
          <span className="font-bold">Clicou no WhatsApp</span>
          {p.veiculo_nome && <span className="opacity-80">{p.veiculo_nome}</span>}
          {noCrm && <span className="font-black text-green-300">(Lead enviado ao CRM)</span>}
        </div>
      );

    case 'phone_click':
      return (
        <div className={`${base} bg-teal-500/20 text-teal-300 border-teal-500/40`}>
          <Phone className="w-3.5 h-3.5 text-teal-400" />
          <span className="font-bold">Clicou para Ligar</span>
        </div>
      );

    default:
      return (
        <div className={`${base} bg-zinc-800/70 text-zinc-300 border-zinc-700`}>
          <MousePointerClick className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-bold">{p.detalhe || p.acao}</span>
        </div>
      );
  }
}
