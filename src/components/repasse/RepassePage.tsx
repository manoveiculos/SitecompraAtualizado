import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Search, Tag, AlertCircle, CheckCircle2, ShieldCheck, Info,
  ChevronRight, Phone, MessageCircle, ArrowRight, Loader2, RefreshCw,
  Sparkles, Filter, Percent, Banknote, X, ChevronLeft, Building2, HelpCircle,
  Plus, Check, ExternalLink, ShieldAlert
} from 'lucide-react';
import {
  fetchVeiculosRepasse,
  enviarLeadRepasse,
  cadastrarVeiculoRepasse,
  type VeiculoRepasse
} from '../../services/repasseService';
import { novoLeadId } from '../../lib/leads';
import { trackFunnelStart, trackFunnelStep, trackLead } from '../../lib/tracking';

const LOGO = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';
const WHATSAPP_NUM = '554733001352';

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPhone(val: string): string {
  let r = val.replace(/\D/g, '');
  if (r.length > 11) r = r.substring(0, 11);
  if (r.length > 10) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (r.length > 6) return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  if (r.length > 2) return r.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (r.length > 0) return '(' + r;
  return r;
}

const FAQS_REPASSE = [
  {
    q: 'O que é um Veículo de Repasse?',
    a: 'Veículos de repasse são carros comercializados muito abaixo do valor de mercado (Tabela FIPE), repassados no estado de conservação em que se encontram. É uma excelente oportunidade para quem busca grande economia (para revenda, oficina ou uso próprio) aceitando pequenos detalhes de pintura ou manutenção sem a garantia de varejo tradicional.'
  },
  {
    q: 'Os veículos de repasse possuem garantia mecânica?',
    a: 'Não. Por serem comercializados com descontos expressivos (geralmente de R$ 10.000 a R$ 20.000 abaixo da FIPE), os veículos são vendidos "no estado em que se encontram", sem garantia mecânica de loja. Todos os detalhes conhecidos do veículo são informados com 100% de transparência na descrição.'
  },
  {
    q: 'Posso levar meu mecânico de confiança para avaliar?',
    a: 'Com certeza! Encorajamos que você venha até a nossa loja física em Rio do Sul / SC acompanhado do seu mecânico ou funileiro de confiança para examinar o veículo antes de fechar o negócio.'
  },
  {
    q: 'Como funciona a documentação e dívidas do veículo?',
    a: 'Todos os nossos veículos de repasse possuem documentação rigorosamente em dia, sem restrições ou débitos pendentes, prontos para transferência imediata no Detran.'
  },
  {
    q: 'É possível financiar um veículo de repasse?',
    a: 'Sim! Aceitamos financiamento bancário e cartão de crédito. Como o valor cobrado é muito inferior à Tabela FIPE, o financiamento costuma ter parcelas bastante acessíveis.'
  }
];

export default function RepassePage() {
  const [veiculos, setVeiculos] = useState<VeiculoRepasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [marcaFilter, setMarcaFilter] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<'maior_desconto' | 'menor_preco' | 'mais_recentes'>('maior_desconto');

  // Modal de Detalhes / Interesse
  const [selectedVeiculo, setSelectedVeiculo] = useState<VeiculoRepasse | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Form State
  const [leadId] = useState(novoLeadId);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [proposta, setProposta] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Guia Educativo Repasse Modal
  const [showGuiaModal, setShowGuiaModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    trackFunnelStart('Compra');
    loadVeiculos();
  }, []);

  const loadVeiculos = async () => {
    setLoading(true);
    const data = await fetchVeiculosRepasse();
    setVeiculos(data);
    setLoading(false);
  };

  const marcasDisponiveis = Array.from(new Set(veiculos.map(v => v.marca))).sort();

  // Filtragem e Ordenação
  const veiculosFiltrados = veiculos
    .filter(v => {
      const matchSearch =
        v.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.modelo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchMarca = marcaFilter === 'todos' || v.marca === marcaFilter;
      return matchSearch && matchMarca;
    })
    .sort((a, b) => {
      if (ordenacao === 'maior_desconto') {
        const descA = a.preco_fipe - a.preco_repasse;
        const descB = b.preco_fipe - b.preco_repasse;
        return descB - descA;
      }
      if (ordenacao === 'menor_preco') {
        return a.preco_repasse - b.preco_repasse;
      }
      return 0;
    });

  const handleOpenDetail = (v: VeiculoRepasse) => {
    setSelectedVeiculo(v);
    setActivePhotoIdx(0);
    setSuccess(false);
    setErrorMsg('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVeiculo || submitting) return;

    const rawPhone = telefone.replace(/\D/g, '');
    if (nome.trim().length < 3 || rawPhone.length < 10 || cidade.trim().length < 2) {
      setErrorMsg('Por favor, preencha nome, WhatsApp válido e cidade.');
      return;
    }

    if (!aceitouTermos) {
      setErrorMsg('É necessário declarar ciência dos termos do veículo de repasse.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const eventId = trackLead({
      tipo: 'Compra',
      valor: selectedVeiculo.preco_repasse,
      vehicleId: String(selectedVeiculo.id),
      vehicleName: selectedVeiculo.titulo,
    });

    const res = await enviarLeadRepasse({
      lead_id: leadId,
      nome: nome.trim(),
      telefone: rawPhone,
      cidade: cidade.trim(),
      veiculo_id: selectedVeiculo.id,
      veiculo_titulo: selectedVeiculo.titulo,
      preco_fipe: selectedVeiculo.preco_fipe,
      preco_repasse: selectedVeiculo.preco_repasse,
      proposta_mensagem: proposta.trim(),
      aceitou_termos: aceitouTermos,
      event_id: eventId,
    });

    setSubmitting(false);

    if (res.ok) {
      setSuccess(true);
    } else {
      setErrorMsg(res.error || 'Ocorreu um erro ao enviar. Tente novamente.');
    }
  };

  const openWhatsAppDirect = (v?: VeiculoRepasse) => {
    const txt = v
      ? `Olá! Tenho interesse no veículo de repasse ${v.titulo} (FIPE: ${formatBRL(v.preco_fipe)} por ${formatBRL(v.preco_repasse)}). Gostaria de mais informações.`
      : `Olá! Vim pela página de Veículos de Repasse da Manos e gostaria de ver os carros disponíveis.`;
    window.open(`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(txt)}`, '_blank');
  };



  return (
    <div className="min-h-screen bg-[#09090B] text-white selection:bg-manos-red selection:text-white font-sans relative overflow-x-hidden">
      {/* Glow ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-manos-red/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[160px]" />
      </div>

      {/* HEADER FIXO TRANSPARENTE */}
      <header className="sticky top-0 z-40 bg-[#09090B]/90 backdrop-blur-xl border-b border-white/10 px-3 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/">
              <img src={LOGO} alt="Manos Veículos" className="h-7 sm:h-10 w-auto object-contain hover:opacity-90 transition-opacity" />
            </a>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Oportunidades de Repasse</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={() => setShowGuiaModal(true)}
              className="px-2.5 sm:px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/90 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-manos-red" />
              <span className="hidden md:inline">O que é Repasse?</span>
              <span className="md:hidden">Como Funciona</span>
            </button>

            <button
              onClick={() => openWhatsAppDirect()}
              className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              <span className="hidden sm:inline">Atendimento</span> WhatsApp
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION DE REPASSE */}
      <section className="relative pt-6 sm:pt-14 pb-8 sm:pb-12 px-4 sm:px-8 max-w-7xl mx-auto z-10">
        <div className="space-y-4 sm:space-y-6 text-center max-w-4xl mx-auto">
          
          {/* Badge Topo */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-manos-red/20 via-amber-500/10 to-emerald-500/20 border border-white/10 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] sm:text-sm font-black uppercase tracking-wider text-white">
              Veículos no Estado com Até <span className="text-emerald-400">R$ 20.000 de Desconto FIPE</span>
            </span>
          </div>

          {/* Título Principal */}
          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-black uppercase italic tracking-tight leading-[1.1]">
            Veículos de <span className="text-manos-red">Repasse</span> com Preço <span className="text-emerald-400">Abaixo da FIPE</span>
          </h1>

          <p className="text-xs sm:text-lg text-white/70 leading-relaxed font-normal max-w-3xl mx-auto">
            Adquira veículos direto do estoque de repasse da Manos Veículos.
            <strong className="text-white font-bold"> Transparência total para clientes leigos e revendedores:</strong> carros vendidos no estado em que se encontram, com preços imbativeis comparados à Tabela FIPE.
          </p>

          {/* Card de Esclarecimento para Clientes Leigos */}
          <div className="p-4 sm:p-6 bg-gradient-to-br from-amber-950/20 via-black to-zinc-900/60 border border-amber-500/30 rounded-2xl sm:rounded-3xl text-left shadow-2xl relative overflow-hidden space-y-3 sm:space-y-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl sm:rounded-2xl flex-shrink-0">
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-lg font-black text-amber-400 uppercase italic tracking-wider">
                  Atenção Cliente: Entenda o que é um Veículo de Repasse
                </h3>
                <p className="text-[11px] sm:text-sm text-white/80 leading-relaxed">
                  Para garantir total clareza: os carros desta lista são repassados <strong className="text-white font-bold">no estado de conservação em que se encontram</strong> (com eventuais detalhes de funilaria, pneus ou manutenção especificados em cada anúncio) e <strong className="text-white font-bold">sem garantia mecânica de loja de varejo</strong>. Em troca, você paga uma fração do valor de mercado (Tabela FIPE)!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-2 border-t border-white/10 text-[11px] sm:text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Documentação 100% OK e Quitada</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Laudo e Observações Transparentes</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Aceita Mecânico no Local</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FILTROS E PESQUISA */}
      <section className="px-4 sm:px-8 max-w-7xl mx-auto z-10 relative mb-8">
        <div className="p-4 sm:p-6 bg-white/[0.03] border border-white/10 rounded-2xl space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
            
            {/* Campo de Busca */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar modelo, marca ou palavra-chave..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs sm:text-sm text-white placeholder-white/40 focus:border-manos-red outline-none transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Controles de Marca e Ordenação */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto justify-end">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-white/40 flex-shrink-0" />
                <select
                  className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:border-manos-red outline-none cursor-pointer"
                  value={marcaFilter}
                  onChange={e => setMarcaFilter(e.target.value)}
                >
                  <option value="todos" className="bg-zinc-900">Todas as Marcas ({veiculos.length})</option>
                  {marcasDisponiveis.map(m => (
                    <option key={m} value={m} className="bg-zinc-900">{m}</option>
                  ))}
                </select>
              </div>

              <select
                className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white focus:border-manos-red outline-none cursor-pointer"
                value={ordenacao}
                onChange={e => setOrdenacao(e.target.value as any)}
              >
                <option value="maior_desconto" className="bg-zinc-900">Maior Desconto R$ (FIPE)</option>
                <option value="menor_preco" className="bg-zinc-900">Menor Preço Pedido</option>
              </select>
            </div>

          </div>

          <div className="flex items-center justify-between text-xs text-white/50 pt-2 border-t border-white/5">
            <span>Mostrando <strong className="text-white">{veiculosFiltrados.length}</strong> veículos de repasse</span>
            {loading && <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-manos-red" /> Atualizando...</span>}
          </div>
        </div>
      </section>

      {/* SHOWCASE / GRID DE VEÍCULOS DE REPASSE */}
      <section className="px-4 sm:px-8 max-w-7xl mx-auto z-10 relative pb-20">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-96 bg-white/5 rounded-3xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : veiculosFiltrados.length === 0 ? (
          <div className="text-center py-16 p-8 bg-white/[0.02] border border-white/10 rounded-3xl space-y-4 max-w-xl mx-auto">
            <Car className="w-12 h-12 text-white/20 mx-auto" />
            <h3 className="text-xl font-bold text-white">Nenhum veículo encontrado</h3>
            <p className="text-xs text-white/50">Tente ajustar a busca ou limpar os filtros de marca.</p>
            <button
              onClick={() => { setSearchQuery(''); setMarcaFilter('todos'); }}
              className="px-4 py-2 bg-manos-red text-white text-xs font-bold uppercase rounded-xl"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {veiculosFiltrados.map(v => {
              const economia = v.preco_fipe - v.preco_repasse;
              const pctDesconto = Math.round((economia / v.preco_fipe) * 100);

              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-[#121215] border border-white/10 hover:border-manos-red/40 rounded-3xl overflow-hidden flex flex-col justify-between group hover:shadow-2xl hover:shadow-manos-red/10 transition-all duration-300"
                >
                  {/* Foto de Capa & Badges */}
                  <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden cursor-pointer" onClick={() => handleOpenDetail(v)}>
                    <img
                      src={v.fotos[0] || 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80'}
                      alt={v.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                    {/* Badge Desconto FIPE Topo */}
                    <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5" />
                      -{pctDesconto}% ABAIXO DA FIPE
                    </div>

                    {v.destaque && (
                      <div className="absolute top-3 right-3 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
                        Destaque
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/80 font-bold">
                      <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                        Placa final {v.placa_final || '*'}
                      </span>
                      <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                        📷 {v.fotos.length} fotos
                      </span>
                    </div>
                  </div>

                  {/* Informações Principais */}
                  <div className="p-5 sm:p-6 space-y-4 flex-grow flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-white/50 uppercase tracking-wider">
                        <span>{v.marca}</span>
                        <span>•</span>
                        <span>{v.ano}</span>
                        <span>•</span>
                        <span>{v.km.toLocaleString('pt-BR')} km</span>
                      </div>

                      <h3
                        onClick={() => handleOpenDetail(v)}
                        className="text-base sm:text-lg font-black uppercase italic tracking-tight text-white group-hover:text-manos-red transition-colors line-clamp-2 cursor-pointer"
                      >
                        {v.titulo}
                      </h3>

                      <p className="text-xs text-white/60 line-clamp-2 italic border-l-2 border-amber-500/40 pl-2 py-0.5">
                        {v.observacoes_repasse}
                      </p>
                    </div>

                    {/* CAIXA COMPARATIVA DE PREÇOS (FIPE VS REPASSE) */}
                    <div className="space-y-3 pt-2">
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/40 uppercase font-bold">Tabela FIPE:</span>
                          <span className="text-white/50 font-bold line-through">{formatBRL(v.preco_fipe)}</span>
                        </div>

                        <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">Preço de Repasse</span>
                            <span className="text-xl sm:text-2xl font-black text-white italic tracking-tight">{formatBRL(v.preco_repasse)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 block">
                              Economia de
                            </span>
                            <span className="text-xs font-black text-emerald-400">{formatBRL(economia)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleOpenDetail(v)}
                          className="py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-xs uppercase transition-all"
                        >
                          Ver Fotos
                        </button>
                        <button
                          onClick={() => handleOpenDetail(v)}
                          className="py-3 px-3 bg-manos-red hover:bg-red-600 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-manos-red/20 active:scale-95 transition-all flex items-center justify-center gap-1"
                        >
                          Tenho Interesse
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* SEÇÃO 4: PERGUNTAS FREQUENTES (FAQ DIDÁTICO DE REPASSE) */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 bg-white/[0.02] border-t border-white/10 z-10 relative">
        <div className="max-w-4xl mx-auto space-y-12 text-center">
          
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold uppercase">
              <HelpCircle className="w-3.5 h-3.5" />
              Tire Suas Dúvidas
            </div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Perguntas Frequentes sobre <span className="text-manos-red">Veículos de Repasse</span>
            </h2>
            <p className="text-sm sm:text-base text-white/60">
              Esclarecemos tudo em detalhes para você comprar com total segurança e transparência.
            </p>
          </div>

          <div className="space-y-4 text-left">
            {FAQS_REPASSE.map((faq, idx) => (
              <div
                key={idx}
                className="bg-[#121215] border border-white/10 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-white hover:text-manos-red transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronRight className={`w-5 h-5 text-manos-red transition-transform duration-300 flex-shrink-0 ${openFaq === idx ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-6 sm:px-6 text-xs sm:text-sm text-white/70 leading-relaxed border-t border-white/5 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => openWhatsAppDirect()}
              className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase rounded-2xl flex items-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <MessageCircle className="w-5 h-5 fill-current" />
              Falar com Consultor de Repasse no WhatsApp
            </button>
          </div>

        </div>
      </section>

      {/* FOOTER DA PÁGINA */}
      <footer className="py-8 px-4 text-center text-xs text-white/40 border-t border-white/10 space-y-3">
        <p>© 2026 Manos Veículos — Todos os direitos reservados. Rio do Sul / SC</p>
        <p className="max-w-2xl mx-auto text-[11px] text-white/30">
          Nota legal: Veículos de repasse comercializados com preço significativamente abaixo da Tabela FIPE são vendidos no estado de conservação em que se encontram, sem garantia mecânica de loja de varejo.
        </p>
        <div className="pt-2">
          <a
            href="/repasse-admin"
            className="text-[10px] text-white/20 hover:text-white/60 font-bold uppercase tracking-widest transition-colors"
          >
            Área Restrita / Painel Admin
          </a>
        </div>
      </footer>

      {/* MODAL "O QUE É REPASSE?" */}
      <AnimatePresence>
        {showGuiaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121215] border border-white/15 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl my-8"
            >
              <button
                onClick={() => setShowGuiaModal(false)}
                className="absolute top-5 right-5 p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black uppercase italic text-white tracking-tight">
                    O que é um Veículo de <span className="text-manos-red">Repasse</span>?
                  </h3>
                  <p className="text-xs text-white/60">Entenda as regras e vantagens das oportunidades de repasse</p>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-white/80 leading-relaxed bg-white/[0.03] border border-white/10 p-5 rounded-2xl">
                <p>
                  <strong className="text-white font-bold">Veículos de Repasse</strong> são oportunidades de compra de carros comercializados diretamente do nosso estoque com descontos significativos (frequentemente de <span className="text-emerald-400 font-bold">R$ 10.000 a R$ 20.000 abaixo da Tabela FIPE</span>).
                </p>
                
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <h4 className="font-bold text-amber-400 uppercase tracking-wider text-xs">⚠️ Como funciona o contrato de repasse:</h4>
                  <ul className="space-y-2 text-white/70">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Sem Garantia de Loja:</strong> O veículo é repassado no estado de conservação em que se encontra. Em troca, você economiza milhares de reais.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Documentação 100% OK:</strong> Todos os carros possuem documentação regularizada, sem dívidas ou restrições, prontos para transferência.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span><strong>Inspeção Liberada:</strong> Você pode trazer seu mecânico ou funileiro de confiança na loja física para inspecionar o carro antes de fechar o negócio.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* FAQ Rápido no Modal */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-white/60">Perguntas Frequentes:</h4>
                <div className="space-y-2">
                  {FAQS_REPASSE.slice(0, 3).map((faq, idx) => (
                    <div key={idx} className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1">
                      <p className="text-xs font-bold text-amber-400">{faq.q}</p>
                      <p className="text-[11px] text-white/70">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => { setShowGuiaModal(false); openWhatsAppDirect(); }}
                  className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  Tirar Dúvidas no WhatsApp
                </button>
                <button
                  onClick={() => setShowGuiaModal(false)}
                  className="py-3.5 px-6 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase rounded-xl transition-all cursor-pointer"
                >
                  Entendi, Ver Estoque
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DETALHES DO VEÍCULO E PROPOSTA */}
      <AnimatePresence>
        {selectedVeiculo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121215] border border-white/15 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedVeiculo(null)}
                className="absolute top-5 right-5 z-10 p-2 text-white/50 hover:text-white bg-black/60 hover:bg-black/80 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Título & Badges */}
              <div className="space-y-2 pr-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-full tracking-wider">
                    -{Math.round(((selectedVeiculo.preco_fipe - selectedVeiculo.preco_repasse) / selectedVeiculo.preco_fipe) * 100)}% ABAIXO DA FIPE
                  </span>
                  <span className="px-3 py-1 bg-white/10 text-white/80 font-bold text-[10px] uppercase rounded-full">
                    {selectedVeiculo.marca} • {selectedVeiculo.ano} • {selectedVeiculo.km.toLocaleString('pt-BR')} KM
                  </span>
                </div>
                <h2 className="text-xl sm:text-3xl font-black uppercase italic text-white tracking-tight">
                  {selectedVeiculo.titulo}
                </h2>
              </div>

              {/* Galeria de Fotos */}
              <div className="space-y-3">
                <div className="relative aspect-[16/9] bg-black rounded-2xl overflow-hidden border border-white/10 group">
                  <img
                    src={selectedVeiculo.fotos[activePhotoIdx] || selectedVeiculo.fotos[0]}
                    alt={selectedVeiculo.titulo}
                    className="w-full h-full object-cover"
                  />
                  {selectedVeiculo.fotos.length > 1 && (
                    <>
                      <button
                        onClick={() => setActivePhotoIdx(prev => (prev > 0 ? prev - 1 : selectedVeiculo.fotos.length - 1))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setActivePhotoIdx(prev => (prev < selectedVeiculo.fotos.length - 1 ? prev + 1 : 0))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white/90 font-bold">
                    Foto {activePhotoIdx + 1} de {selectedVeiculo.fotos.length}
                  </div>
                </div>

                {/* Miniaturas */}
                {selectedVeiculo.fotos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {selectedVeiculo.fotos.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIdx(idx)}
                        className={`relative flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          activePhotoIdx === idx ? 'border-manos-red scale-95' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Comparativo de Preços */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 rounded-2xl text-center">
                <div>
                  <span className="text-[10px] font-bold uppercase text-white/40 block">Tabela FIPE</span>
                  <span className="text-base sm:text-lg font-bold text-white/50 line-through">{formatBRL(selectedVeiculo.preco_fipe)}</span>
                </div>
                <div className="border-y sm:border-y-0 sm:border-x border-white/10 py-2 sm:py-0">
                  <span className="text-[10px] font-black uppercase text-emerald-400 block">Preço de Repasse</span>
                  <span className="text-xl sm:text-2xl font-black text-white italic">{formatBRL(selectedVeiculo.preco_repasse)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400 block">Economia Real</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400">
                    {formatBRL(selectedVeiculo.preco_fipe - selectedVeiculo.preco_repasse)}
                  </span>
                </div>
              </div>

              {/* Ficha Técnica & Observações do Repasse */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 bg-white/[0.03] border border-white/10 p-4 rounded-2xl">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Observações do Repasse (Transparência)
                  </h4>
                  <p className="text-xs text-white/80 leading-relaxed font-mono bg-black/40 p-3 rounded-xl border border-white/5">
                    {selectedVeiculo.observacoes_repasse}
                  </p>
                </div>

                <div className="space-y-3 bg-white/[0.03] border border-white/10 p-4 rounded-2xl">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-manos-red" />
                    Descrição do Veículo
                  </h4>
                  <p className="text-xs text-white/70 leading-relaxed">
                    {selectedVeiculo.descricao || 'Veículo em ótimo estado de conservação geral, disponível para visitação prévia em nossa loja física.'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-white/60 font-bold border-t border-white/5">
                    <div>Cor: <span className="text-white">{selectedVeiculo.cor}</span></div>
                    <div>Câmbio: <span className="text-white">{selectedVeiculo.cambio}</span></div>
                    <div>Combustível: <span className="text-white">{selectedVeiculo.combustivel}</span></div>
                    <div>Placa Final: <span className="text-white">{selectedVeiculo.placa_final || '*'}</span></div>
                  </div>
                </div>
              </div>

              {/* FORMULÁRIO DE INTERESSE */}
              <div className="p-6 bg-gradient-to-br from-manos-red/10 via-zinc-900 to-black border border-manos-red/30 rounded-3xl space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase italic text-white flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-manos-red" />
                    Tenho Interesse Neste Veículo
                  </h3>
                  <p className="text-xs text-white/70">
                    Preencha seus dados para receber o atendimento prioritário do consultor de repasse no WhatsApp.
                  </p>
                </div>

                {success ? (
                  <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                    <h4 className="text-lg font-bold text-white">Proposta Enviada com Sucesso!</h4>
                    <p className="text-xs text-white/70 max-w-md mx-auto">
                      Recebemos seu interesse em <strong className="text-white">{selectedVeiculo.titulo}</strong>. Nosso consultor entrará em contato em breve.
                    </p>
                    <button
                      onClick={() => openWhatsAppDirect(selectedVeiculo)}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl inline-flex items-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                      Falar Agora no WhatsApp
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    {errorMsg && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {errorMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold uppercase text-white/70 block mb-1">Seu Nome *</label>
                        <input
                          type="text"
                          required
                          placeholder="Nome completo"
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-manos-red outline-none"
                          value={nome}
                          onChange={e => setNome(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase text-white/70 block mb-1">WhatsApp *</label>
                        <input
                          type="tel"
                          required
                          placeholder="(00) 00000-0000"
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-manos-red outline-none"
                          value={telefone}
                          onChange={e => setTelefone(formatPhone(e.target.value))}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase text-white/70 block mb-1">Sua Cidade / UF *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex.: Rio do Sul / SC"
                          className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-manos-red outline-none"
                          value={cidade}
                          onChange={e => setCidade(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-white/70 block mb-1">Proposta / Dúvida (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex.: Gostaria de saber se aceita trocas ou proposta à vista"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-manos-red outline-none"
                        value={proposta}
                        onChange={e => setProposta(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="termos_repasse"
                        checked={aceitouTermos}
                        onChange={e => setAceitouTermos(e.target.checked)}
                        className="w-4 h-4 accent-manos-red rounded cursor-pointer"
                      />
                      <label htmlFor="termos_repasse" className="text-[11px] text-white/70 cursor-pointer">
                        Estou ciente que veículos de repasse são vendidos <strong className="text-white font-bold">no estado</strong> e sem garantia mecânica de varejo.
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-3.5 px-4 bg-manos-red hover:bg-red-600 text-white font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-manos-red/20 transition-all cursor-pointer"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                        Enviar Proposta de Interesse
                      </button>
                      <button
                        type="button"
                        onClick={() => openWhatsAppDirect(selectedVeiculo)}
                        className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 fill-current" />
                        Abrir WhatsApp Direto
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

