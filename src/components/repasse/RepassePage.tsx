import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Search, Tag, AlertCircle, CheckCircle2, ShieldCheck, Info,
  ChevronRight, Phone, MessageCircle, ArrowRight, Loader2, RefreshCw,
  Sparkles, Filter, Percent, Banknote, X, ChevronLeft, Building2, HelpCircle,
  Plus, Check, ExternalLink, ShieldAlert, Lock, Unlock, UserCheck, UserPlus,
  KeyRound, Users, Send, FileText, BadgeDollarSign, Clock, XCircle, Handshake
} from 'lucide-react';
import {
  fetchVeiculosRepasse,
  enviarLeadRepasse,
  cadastrarVeiculoRepasse,
  cadastrarRepassador,
  verificarAcessoRepassador,
  cadastrarPropostaLojista,
  fetchPropostasPorTelefone,
  type VeiculoRepasse,
  type Repassador,
  type PropostaRepasse
} from '../../services/repasseService';
import { novoLeadId } from '../../lib/leads';
import { trackFunnelStart, trackFunnelStep, trackLead } from '../../lib/tracking';

const LOGO = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';
const WHATSAPP_NUM = '554733001352';

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCpfCnpj(val: string): string {
  let r = val.replace(/\D/g, '');
  if (r.length > 14) r = r.substring(0, 14);
  if (r.length > 11) {
    return r.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
  }
  if (r.length > 9) {
    return r.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/, '$1.$2.$3-$4');
  }
  if (r.length > 6) {
    return r.replace(/^(\d{3})(\d{3})(\d{0,3}).*/, '$1.$2.$3');
  }
  if (r.length > 3) {
    return r.replace(/^(\d{3})(\d{0,3}).*/, '$1.$2');
  }
  return r;
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

  // Sessão de Lojista / Repassador Autenticado
  const LOJISTA_SESSION_KEY = 'manos_repasse_lojista_session_v1';
  const [activeLojista, setActiveLojista] = useState<Repassador | null>(() => {
    try {
      const raw = localStorage.getItem(LOJISTA_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [showLojistaModal, setShowLojistaModal] = useState(false);
  const [lojistaTab, setLojistaTab] = useState<'login' | 'cadastro'>('login');

  // Form Lojista Login State
  const [loginTelefone, setLoginTelefone] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Form Lojista Cadastro State
  const [cadNome, setCadNome] = useState('');
  const [cadCpfCnpj, setCadCpfCnpj] = useState('');
  const [cadLoja, setCadLoja] = useState('');
  const [cadCidade, setCadCidade] = useState('');
  const [cadTelefone, setCadTelefone] = useState('');
  const [cadLoading, setCadLoading] = useState(false);
  const [cadError, setCadError] = useState('');

  // Propostas de Lojistas State
  const [propostasLojista, setPropostasLojista] = useState<PropostaRepasse[]>([]);
  const [showMinhasPropostasModal, setShowMinhasPropostasModal] = useState(false);
  const [showPropostaModal, setShowPropostaModal] = useState(false);
  const [selectedVeiculoProposta, setSelectedVeiculoProposta] = useState<VeiculoRepasse | null>(null);
  const [valorPropostaInput, setValorPropostaInput] = useState('');
  const [mensagemPropostaInput, setMensagemPropostaInput] = useState('');
  const [propostaLoading, setPropostaLoading] = useState(false);
  const [propostaSuccess, setPropostaSuccess] = useState(false);
  const [propostaError, setPropostaError] = useState('');

  const loadPropostasLojista = async (tel?: string) => {
    const phoneToUse = tel || activeLojista?.telefone;
    if (!phoneToUse) return;
    const list = await fetchPropostasPorTelefone(phoneToUse);
    setPropostasLojista(list);
  };

  useEffect(() => {
    trackFunnelStart('Compra');
    loadVeiculos();
    if (activeLojista) {
      setNome(activeLojista.nome_completo);
      setTelefone(formatPhone(activeLojista.telefone));
      if (activeLojista.cidade) setCidade(activeLojista.cidade);
      loadPropostasLojista(activeLojista.telefone);
    }
  }, []);

  const handleLojistaLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const rawTel = loginTelefone.replace(/\D/g, '');
    if (rawTel.length < 10) {
      setLoginError('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }

    setLoginLoading(true);
    const res = await verificarAcessoRepassador(rawTel);
    setLoginLoading(false);

    if (res.ok && res.status === 'ativo' && res.repassador) {
      setActiveLojista(res.repassador);
      try {
        localStorage.setItem(LOJISTA_SESSION_KEY, JSON.stringify(res.repassador));
      } catch {}
      setShowLojistaModal(false);
      setNome(res.repassador.nome_completo);
      setTelefone(formatPhone(res.repassador.telefone));
      if (res.repassador.cidade) setCidade(res.repassador.cidade);
    } else if (res.status === 'bloqueado') {
      setLoginError('Acesso suspenso pelo administrador. Entre em contato conosco pelo WhatsApp.');
    } else {
      setLoginError('Telefone não encontrado no cadastro de repassadores. Faça seu cadastro rápido abaixo!');
      setCadTelefone(loginTelefone);
      setLojistaTab('cadastro');
    }
  };

  const handleLojistaCadastroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCadError('');

    if (cadNome.trim().length < 3) {
      setCadError('Por favor, informe seu nome completo.');
      return;
    }
    const cleanDoc = cadCpfCnpj.replace(/\D/g, '');
    if (cleanDoc.length < 11) {
      setCadError('Por favor, informe um CPF ou CNPJ válido.');
      return;
    }
    if (cadLoja.trim().length < 2) {
      setCadError('Por favor, informe o nome da loja ou grupo de repasse.');
      return;
    }
    if (cadCidade.trim().length < 2) {
      setCadError('Por favor, informe sua cidade e UF.');
      return;
    }
    const cleanTel = cadTelefone.replace(/\D/g, '');
    if (cleanTel.length < 10) {
      setCadError('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }

    setCadLoading(true);

    const res = await cadastrarRepassador({
      nome_completo: cadNome.trim(),
      cpf_cnpj: cadCpfCnpj.trim(),
      nome_loja: cadLoja.trim(),
      cidade: cadCidade.trim(),
      telefone: cleanTel,
    });

    setCadLoading(false);

    if (res.ok && res.data) {
      setActiveLojista(res.data);
      try {
        localStorage.setItem(LOJISTA_SESSION_KEY, JSON.stringify(res.data));
      } catch {}
      setShowLojistaModal(false);
      setNome(res.data.nome_completo);
      setTelefone(formatPhone(res.data.telefone));
      if (res.data.cidade) setCidade(res.data.cidade);
      loadPropostasLojista(res.data.telefone);
    } else {
      setCadError(res.error || 'Erro ao realizar cadastro.');
    }
  };

  const handleLogoutLojista = () => {
    setActiveLojista(null);
    setPropostasLojista([]);
    try {
      localStorage.removeItem(LOJISTA_SESSION_KEY);
    } catch {}
  };

  const handleAbrirModalProposta = (veiculo: VeiculoRepasse) => {
    if (!activeLojista) {
      setShowLojistaModal(true);
      return;
    }
    setSelectedVeiculoProposta(veiculo);
    const defaultPrice = veiculo.preco_lojista || veiculo.preco_repasse;
    setValorPropostaInput(String(defaultPrice));
    setMensagemPropostaInput('');
    setPropostaError('');
    setPropostaSuccess(false);
    setShowPropostaModal(true);
  };

  const handleEnviarPropostaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLojista || !selectedVeiculoProposta) return;

    setPropostaError('');
    const rawVal = parseFloat(valorPropostaInput.replace(/\D/g, '')) || 0;
    if (!rawVal || rawVal <= 0) {
      setPropostaError('Por favor, informe um valor de proposta válido.');
      return;
    }

    setPropostaLoading(true);
    const basePrice = selectedVeiculoProposta.preco_lojista || selectedVeiculoProposta.preco_repasse;

    const res = await cadastrarPropostaLojista({
      repassador_id: activeLojista.id,
      repassador_nome: activeLojista.nome_completo,
      repassador_telefone: activeLojista.telefone,
      repassador_loja: activeLojista.nome_loja,
      repassador_cidade: activeLojista.cidade,
      veiculo_id: selectedVeiculoProposta.id,
      veiculo_titulo: selectedVeiculoProposta.titulo,
      valor_veiculo: basePrice,
      valor_proposta: rawVal,
      mensagem_lojista: mensagemPropostaInput.trim(),
    });

    setPropostaLoading(false);

    if (res.ok) {
      setPropostaSuccess(true);
      loadPropostasLojista();
    } else {
      setPropostaError('Não foi possível registrar sua proposta. Tente novamente.');
    }
  };

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

    const msgLojista = activeLojista
      ? `[PROPOSTA DE LOJISTA CREDENCIADO: ${activeLojista.nome_loja} (CPF/CNPJ: ${activeLojista.cpf_cnpj})] ${proposta.trim()}`
      : proposta.trim();

    const effectivePrice = (activeLojista && selectedVeiculo.preco_lojista)
      ? selectedVeiculo.preco_lojista
      : selectedVeiculo.preco_repasse;

    const res = await enviarLeadRepasse({
      lead_id: leadId,
      nome: nome.trim(),
      telefone: rawPhone,
      cidade: cidade.trim(),
      veiculo_id: selectedVeiculo.id,
      veiculo_titulo: selectedVeiculo.titulo,
      preco_fipe: selectedVeiculo.preco_fipe,
      preco_repasse: effectivePrice,
      proposta_mensagem: msgLojista,
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
    const lojistaPrefix = activeLojista ? `Olá! Sou da loja ${activeLojista.nome_loja} (Repassador Credenciado). ` : `Olá! `;
    const priceText = (v && activeLojista && v.preco_lojista)
      ? `Preço Lojista: ${formatBRL(v.preco_lojista)}`
      : v ? `Preço Repasse: ${formatBRL(v.preco_repasse)}` : '';
    const txt = v
      ? `${lojistaPrefix}Tenho interesse no veículo de repasse ${v.titulo} (FIPE: ${formatBRL(v.preco_fipe)}${priceText ? ` | ${priceText}` : ''}). Gostaria de mais informações.`
      : `${lojistaPrefix}Vim pela página de Veículos de Repasse da Manos e gostaria de ver o estoque disponível.`;
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
            {activeLojista ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loadPropostasLojista();
                    setShowMinhasPropostasModal(true);
                  }}
                  className="px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-600/20 border border-amber-500/50 text-amber-300 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/10 active:scale-95 transition-all cursor-pointer relative"
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                  <span>Minhas Propostas</span>
                  {propostasLojista.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-black rounded-full">
                      {propostasLojista.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setShowLojistaModal(true)}
                  className="hidden md:flex px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/90 font-bold text-xs rounded-xl items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <strong className="text-white">{activeLojista.nome_loja}</strong>
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowLojistaModal(true); setLojistaTab('login'); }}
                className="px-3 sm:px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Área do Lojista</span>
              </button>
            )}

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

          {/* BANNER MODO LOJISTA OU CTA DESBLOQUEAR */}
          {activeLojista ? (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-black border border-amber-500/50 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 sm:p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl sm:rounded-2xl text-amber-400 flex-shrink-0">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-black uppercase text-amber-400 tracking-wider">
                        🔓 Modo Lojista / Repassador Ativo
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-md border border-emerald-500/30">
                        Preços de Atacado Liberados
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-white/80">
                      Sua loja <strong className="text-white">{activeLojista.nome_loja}</strong> ({activeLojista.nome_completo}) está conectada. Exibindo margens exclusivas de repasse.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      loadPropostasLojista();
                      setShowMinhasPropostasModal(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    Minhas Propostas ({propostasLojista.length})
                  </button>
                  <button
                    onClick={handleLogoutLojista}
                    className="w-full sm:w-auto px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                  >
                    Sair da Conta
                  </button>
                </div>
              </div>

              {/* CARD COMUNIDADE VIP WHATSAPP (EXCLUSIVO PARA LOJISTAS LOGADOS) */}
              <div className="p-4 sm:p-6 bg-gradient-to-r from-emerald-950/50 via-black to-emerald-900/40 border border-emerald-500/40 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400 flex-shrink-0">
                    <Users className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        Comunidade Exclusiva no WhatsApp
                      </span>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase rounded-md border border-amber-500/30">
                        Lojistas VIP
                      </span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed">
                      Fique atento a <strong className="text-white">todas as oportunidades em primeira mão!</strong> Receba avisos de novos veículos de repasse antes de entrarem no site.
                    </p>
                  </div>
                </div>

                <a
                  href="https://chat.whatsapp.com/Cy0yyao3XDiBeHcNxiz5WT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xl shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  Entrar na Comunidade WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-black to-zinc-900/80 border border-amber-500/40 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-amber-500/20 rounded-xl sm:rounded-2xl text-amber-400 flex-shrink-0">
                  <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider">
                    É Lojista ou Repassador de Carros?
                  </h3>
                  <p className="text-[11px] sm:text-xs text-white/70">
                    Temos preços diferenciados de atacado exclusivos para revendedores. Cadastre seu WhatsApp para liberar.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowLojistaModal(true); setLojistaTab('login'); }}
                className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer whitespace-nowrap"
              >
                Liberar Preços de Lojista
              </button>
            </div>
          )}

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

                    {/* CAIXA COMPARATIVA DE PREÇOS (FIPE VS REPASSE VS LOJISTA) */}
                    <div className="space-y-3 pt-2">
                      {activeLojista && v.preco_lojista ? (
                        <div className="bg-gradient-to-br from-amber-950/40 via-black to-amber-900/30 border border-amber-500/50 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/40 uppercase font-bold">Tabela FIPE: {formatBRL(v.preco_fipe)}</span>
                            <span className="text-white/40 uppercase font-bold">Público: <span className="line-through">{formatBRL(v.preco_repasse)}</span></span>
                          </div>

                          <div className="flex items-baseline justify-between border-t border-amber-500/30 pt-2">
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-amber-400" />
                                Preço Lojista (Atacado)
                              </span>
                              <span className="text-xl sm:text-2xl font-black text-amber-400 italic tracking-tight">{formatBRL(v.preco_lojista)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 block">
                                Margem Lojista
                              </span>
                              <span className="text-xs font-black text-amber-300">{formatBRL(v.preco_fipe - v.preco_lojista)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
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

                          {v.preco_lojista && (
                            <div
                              onClick={(e) => { e.stopPropagation(); setShowLojistaModal(true); setLojistaTab('login'); }}
                              className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-amber-400 font-bold hover:underline cursor-pointer"
                            >
                              <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Preço p/ Lojista disponível</span>
                              <span>Liberar &rarr;</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Botões de Ação */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleOpenDetail(v)}
                          className="py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-xs uppercase transition-all"
                        >
                          Ver Fotos
                        </button>

                        {activeLojista ? (
                          <button
                            onClick={() => handleAbrirModalProposta(v)}
                            className="py-3 px-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Handshake className="w-4 h-4" />
                            Enviar Oferta
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenDetail(v)}
                            className="py-3 px-3 bg-manos-red hover:bg-red-600 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-manos-red/20 active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            Tenho Interesse
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
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
              {activeLojista && selectedVeiculo.preco_lojista ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-br from-amber-950/40 via-black to-amber-900/30 border border-amber-500/50 rounded-2xl text-center shadow-xl">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-white/40 block">Tabela FIPE</span>
                    <span className="text-sm font-bold text-white/50 line-through">{formatBRL(selectedVeiculo.preco_fipe)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-white/40 block">Preço Público</span>
                    <span className="text-sm font-bold text-white/70 line-through">{formatBRL(selectedVeiculo.preco_repasse)}</span>
                  </div>
                  <div className="border-y sm:border-y-0 sm:border-x border-amber-500/30 py-2 sm:py-0">
                    <span className="text-[10px] font-black uppercase text-amber-400 block flex items-center justify-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> Preço Lojista (Atacado)
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-amber-400 italic">{formatBRL(selectedVeiculo.preco_lojista)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-300 block">Margem Atacado</span>
                    <span className="text-base sm:text-lg font-black text-amber-300">
                      {formatBRL(selectedVeiculo.preco_fipe - selectedVeiculo.preco_lojista)}
                    </span>
                  </div>
                </div>
              ) : (
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
              )}

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

      {/* MODAL DE ACESSO E CADASTRO DA ÁREA DO LOJISTA */}
      <AnimatePresence>
        {showLojistaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121216] border border-amber-500/30 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative shadow-2xl my-8 text-left"
            >
              <button
                onClick={() => setShowLojistaModal(false)}
                className="absolute top-5 right-5 p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase italic text-white tracking-tight">
                    Área do <span className="text-amber-400">Lojista / Repassador</span>
                  </h3>
                  <p className="text-xs text-white/60">Acesso exclusivo para revendedores com preços de atacado</p>
                </div>
              </div>

              {activeLojista ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-amber-400">Sua Loja Conectada</span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Status: Ativo</span>
                    </div>
                    <p className="text-sm font-black text-white">{activeLojista.nome_loja}</p>
                    <p className="text-xs text-white/70">{activeLojista.nome_completo} • {activeLojista.cidade || 'Lojista Credenciado'}</p>
                    <p className="text-xs text-white/50">WhatsApp: {activeLojista.telefone}</p>
                  </div>

                  <a
                    href="https://chat.whatsapp.com/Cy0yyao3XDiBeHcNxiz5WT"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    Entrar na Comunidade VIP do WhatsApp
                  </a>

                  <button
                    onClick={() => {
                      setShowLojistaModal(false);
                      setShowMinhasPropostasModal(true);
                    }}
                    className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                    Ver Minhas Propostas ({propostasLojista.length})
                  </button>

                  <button
                    onClick={() => {
                      handleLogoutLojista();
                      setShowLojistaModal(false);
                    }}
                    className="w-full py-2 text-xs text-red-400 hover:text-red-300 font-bold uppercase cursor-pointer text-center block pt-2"
                  >
                    Sair da Conta Lojista
                  </button>
                </div>
              ) : (
                <>
                  {/* Tabs do Modal */}
                  <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
                    <button
                      onClick={() => setLojistaTab('login')}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        lojistaTab === 'login' ? 'bg-amber-500 text-black shadow-md' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Já Tenho Cadastro
                    </button>
                    <button
                      onClick={() => setLojistaTab('cadastro')}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        lojistaTab === 'cadastro' ? 'bg-amber-500 text-black shadow-md' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Cadastrar Minha Loja
                    </button>
                  </div>

              {lojistaTab === 'login' ? (
                <form onSubmit={handleLojistaLoginSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-white/80 block">
                      Número do WhatsApp Cadastrado *
                    </label>
                    <input
                      type="tel"
                      required
                      autoFocus
                      placeholder="(00) 00000-0000"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-400 outline-none"
                      value={loginTelefone}
                      onChange={e => setLoginTelefone(formatPhone(e.target.value))}
                    />
                    <p className="text-[11px] text-white/50">
                      Digite o mesmo número de WhatsApp utilizado no seu cadastro para liberar os preços de lojista.
                    </p>
                  </div>

                  {loginError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    Validar Telefone e Entrar
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLojistaCadastroSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-white/80 block">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Seu nome"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-400 outline-none"
                      value={cadNome}
                      onChange={e => setCadNome(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase text-white/80 block">CPF ou CNPJ *</label>
                      <input
                        type="text"
                        required
                        placeholder="00.000.000/0001-00"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-400 outline-none"
                        value={cadCpfCnpj}
                        onChange={e => setCadCpfCnpj(formatCpfCnpj(e.target.value))}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase text-white/80 block">WhatsApp / Telefone *</label>
                      <input
                        type="tel"
                        required
                        placeholder="(00) 00000-0000"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-400 outline-none"
                        value={cadTelefone}
                        onChange={e => setCadTelefone(formatPhone(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase text-white/80 block">Nome da Loja / Grupo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex.: Auto Loja Sul"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-400 outline-none"
                        value={cadLoja}
                        onChange={e => setCadLoja(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase text-white/80 block">Sua Cidade / UF *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex.: Criciúma / SC"
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-400 outline-none"
                        value={cadCidade}
                        onChange={e => setCadCidade(e.target.value)}
                      />
                    </div>
                  </div>

                  {cadError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{cadError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={cadLoading}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {cadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    Cadastrar e Liberar Preços de Atacado
                  </button>
                </form>
              )}
            </>
          )}
        </motion.div>
      </div>
        )}
      </AnimatePresence>

      {/* MODAL DE ENVIAR PROPOSTA DE LOJISTA */}
      <AnimatePresence>
        {showPropostaModal && selectedVeiculoProposta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121216] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowPropostaModal(false)}
                className="absolute top-5 right-5 text-white/50 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full w-fit">
                  <Handshake className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black text-amber-400 uppercase">Oferta Exclusiva Lojista</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic">
                  Enviar Proposta / Oferta
                </h2>
                <p className="text-xs text-white/60">
                  {selectedVeiculoProposta.titulo} • Preço Anunciado: <strong className="text-amber-400">{formatBRL(selectedVeiculoProposta.preco_lojista || selectedVeiculoProposta.preco_repasse)}</strong>
                </p>
              </div>

              {propostaSuccess ? (
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Proposta Registrada com Sucesso!</h3>
                    <p className="text-xs text-white/70">
                      Sua oferta foi enviada diretamente para a equipe da Manos Veículos. Você pode acompanhar a resposta na sua aba de <strong>Minhas Propostas</strong>.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowPropostaModal(false);
                        setShowMinhasPropostasModal(true);
                      }}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase rounded-xl cursor-pointer"
                    >
                      Ver Minhas Propostas
                    </button>
                    <button
                      onClick={() => setShowPropostaModal(false)}
                      className="py-3 px-4 bg-white/10 text-white font-bold text-xs uppercase rounded-xl cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEnviarPropostaSubmit} className="space-y-4">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1 text-xs">
                    <div className="text-white/50 uppercase font-bold text-[10px]">Lojista Autenticado:</div>
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>{activeLojista?.nome_completo} ({activeLojista?.nome_loja})</span>
                      <span className="text-amber-400 text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{activeLojista?.cidade || 'Lojista'}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-white/80 block">
                      Sua Oferta em R$ *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm">R$</span>
                      <input
                        type="number"
                        step="100"
                        required
                        placeholder="Ex.: 37500"
                        className="w-full bg-white/5 border border-amber-500/40 rounded-xl py-3.5 pl-12 pr-4 text-base font-black text-amber-400 outline-none focus:border-amber-400"
                        value={valorPropostaInput}
                        onChange={e => setValorPropostaInput(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-white/40">Informe o valor em reais que deseja pagar pelo veículo.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-white/80 block">
                      Observações / Condições (Opcional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex.: Pagamento no PIX / Retiro ainda hoje na loja / Aceita troco na troca?"
                      className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400 resize-none"
                      value={mensagemPropostaInput}
                      onChange={e => setMensagemPropostaInput(e.target.value)}
                    />
                  </div>

                  {propostaError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{propostaError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={propostaLoading}
                    className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {propostaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar Proposta para Equipe Manos
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL MINHAS PROPOSTAS DO LOJISTA */}
      <AnimatePresence>
        {showMinhasPropostasModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-[#121216] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white uppercase italic">
                      Minhas Propostas & Contrapropostas
                    </h2>
                    <p className="text-xs text-white/50">
                      {activeLojista?.nome_loja} • {activeLojista?.nome_completo}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowMinhasPropostasModal(false)}
                  className="text-white/50 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto py-4 space-y-4 flex-grow pr-1">
                {propostasLojista.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Clock className="w-10 h-10 text-white/20 mx-auto" />
                    <p className="text-sm font-bold text-white/70">Nenhuma proposta registrada até o momento.</p>
                    <p className="text-xs text-white/40">Navegue pelos veículos de repasse e envie suas ofertas para nossa equipe!</p>
                  </div>
                ) : (
                  propostasLojista.map(p => {
                    const statusConfig = {
                      pendente: {
                        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                        icon: <Clock className="w-3.5 h-3.5" />,
                        label: 'Aguardando Análise',
                        desc: 'Sua proposta está sendo avaliada pela equipe da Manos Veículos.'
                      },
                      aceita: {
                        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                        label: 'Proposta Aceita!',
                        desc: 'Sua proposta foi ACEITA! Entre em contato via WhatsApp para fechar a negociação.'
                      },
                      recusada: {
                        bg: 'bg-red-500/10 border-red-500/30 text-red-400',
                        icon: <XCircle className="w-3.5 h-3.5" />,
                        label: 'Proposta Recusada',
                        desc: 'A proposta não foi aceita no momento.'
                      },
                      contraproposta: {
                        bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
                        icon: <Handshake className="w-3.5 h-3.5" />,
                        label: 'Contraproposta da Manos!',
                        desc: 'A equipe Manos fez uma contraproposta para fechar negócio!'
                      }
                    }[p.status] || {
                      bg: 'bg-white/5 border-white/10 text-white',
                      icon: <Info className="w-3.5 h-3.5" />,
                      label: p.status,
                      desc: ''
                    };

                    const waMessage = p.status === 'contraproposta' && p.valor_contraproposta
                      ? `Olá! Recebi a contraproposta de R$ ${p.valor_contraproposta.toLocaleString('pt-BR')} no veículo ${p.veiculo_titulo}. Gostaria de fechar!`
                      : `Olá! Sou da ${p.repassador_loja}. Gostaria de tratar da minha proposta de R$ ${p.valor_proposta.toLocaleString('pt-BR')} no ${p.veiculo_titulo}.`;

                    const waUrl = `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(waMessage)}`;

                    return (
                      <div
                        key={p.id}
                        className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3 hover:border-white/20 transition-all"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-black text-white">{p.veiculo_titulo}</h4>
                            <div className="text-[11px] text-white/50">
                              Anunciado por: <strong className="text-white/80">{formatBRL(p.valor_veiculo)}</strong>
                            </div>
                          </div>

                          <div className={`px-2.5 py-1 rounded-full text-xs font-black uppercase border flex items-center gap-1.5 ${statusConfig.bg}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 p-3 rounded-xl border border-white/5 text-xs">
                          <div>
                            <span className="text-[10px] text-white/40 uppercase font-bold block">Sua Oferta Enviada:</span>
                            <span className="text-base font-black text-amber-400">{formatBRL(p.valor_proposta)}</span>
                            {p.mensagem_lojista && (
                              <p className="text-[11px] text-white/70 italic mt-1 font-sans">"{p.mensagem_lojista}"</p>
                            )}
                          </div>

                          {p.status === 'contraproposta' && p.valor_contraproposta ? (
                            <div className="bg-cyan-500/10 border border-cyan-500/30 p-2.5 rounded-lg space-y-1">
                              <span className="text-[10px] font-black uppercase text-cyan-400 block flex items-center gap-1">
                                <Handshake className="w-3.5 h-3.5" /> Contraproposta da Manos
                              </span>
                              <span className="text-lg font-black text-cyan-300 block">{formatBRL(p.valor_contraproposta)}</span>
                              {p.resposta_manos && (
                                <p className="text-[11px] text-white/80 italic">"{p.resposta_manos}"</p>
                              )}
                            </div>
                          ) : p.resposta_manos ? (
                            <div>
                              <span className="text-[10px] text-white/40 uppercase font-bold block">Resposta da Manos:</span>
                              <p className="text-xs text-white/80 italic">"{p.resposta_manos}"</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[10px] text-white/40">
                            Enviada em {new Date(p.created_at || Date.now()).toLocaleDateString('pt-BR')} às {new Date(p.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all"
                          >
                            <MessageCircle className="w-3.5 h-3.5 fill-current" />
                            Falar com Manos no WhatsApp
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

