import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car,
  ShieldCheck,
  Banknote,
  Sparkles,
  ArrowRight,
  Phone,
  MessageCircle,
  ChevronDown,
  HelpCircle,
  MapPin,
  Check,
  Search,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Zap,
  Star,
  Building2,
  Lock,
  Camera,
  TrendingUp,
  Clock,
  Handshake,
  DollarSign,
  Award,
  CheckCircle,
  XCircle,
  Share2
} from 'lucide-react';
import { consultarPlaca, VeiculoPlaca } from '../../services/vendasService';
import { registrarLeadConsignacao, enviarConsignacao } from '../../services/consignacaoService';
import {
  trackFunnelStart,
  trackFunnelStep,
  trackLeadParcial,
  trackLead,
  trackPlacaConsultada,
  trackContato
} from '../../lib/tracking';

const LOGO = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';
const WHATSAPP_NUM = '554733001352';

function novoLeadId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fallback */
  }
  return `csg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function onlyNumber(str: string): number {
  return parseInt((str || '').replace(/\D/g, ''), 10) || 0;
}

function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatPlaca(val: string): string {
  return val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function formatThousands(val: string): string {
  const n = val.replace(/\D/g, '');
  if (!n) return '';
  return parseInt(n, 10).toLocaleString('pt-BR');
}

function formatBRL(val: string): string {
  const n = onlyNumber(val);
  if (!n) return '';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Depoimentos de Clientes que Consignaram
const REVIEWS_CONSIGNACAO = [
  {
    nome: 'Carlos Eduardo M.',
    cidade: 'Rio do Sul - SC',
    carro: 'Compass Longitude 2021',
    texto: 'Tentei vender meu Compass sozinho por 2 meses sem sucesso. Deixei na Manos em consignação e em menos de 10 dias eles venderam aceitando a troca do comprador e me pagaram o valor certinho que combinamos!',
    estrelas: 5,
    tempo: 'Vendido em 9 dias'
  },
  {
    nome: 'Juliana S. V.',
    cidade: 'Ituporanga - SC',
    carro: 'Civic EXL 2019',
    texto: 'Fiz a consignação virtual porque precisava do carro no dia a dia. Eles tiraram fotos profissionais, anunciaram e em 2 semanas me chamaram com o comprador aprovado no financiamento. Serviço excelente!',
    estrelas: 5,
    tempo: 'Consignação Virtual'
  },
  {
    nome: 'Rodrigo A. F.',
    cidade: 'Laurentino - SC',
    carro: 'Corolla XEi 2020',
    texto: 'Total transparência no contrato. Não tive dor de cabeça com estranhos me chamando toda hora. Venderam pelo valor de mercado que eu queria. Recomendo de olhos fechados.',
    estrelas: 5,
    tempo: 'Vendido em 6 dias'
  }
];

// FAQs específicas sobre Consignação
const FAQS_CONSIGNACAO = [
  {
    q: 'Como funciona a Consignação de Veículos na Manos?',
    a: 'Nós acordamos com você o valor líquido que deseja receber pelo seu carro. Cuidamos de todo o processo de divulgação, higienização, fotos profissionais, atendimento a interessados, oferta de financiamento bancário e troca. Quando o carro é vendido, você recebe o valor combinado diretamente na sua conta.'
  },
  {
    q: 'Qual a diferença entre Consignação Física e Virtual?',
    a: 'Na Consignação Física, seu veículo fica exposto em nosso showroom coberto e seguro na loja de Rio do Sul, com fluxo diário de compradores. Na Consignação Virtual, você continua rodando com seu carro normalmente enquanto fazemos os anúncios profissionais e trazemos os compradores qualificados.'
  },
  {
    q: 'Por que o carro vende muito mais rápido na Manos do que na venda particular?',
    a: 'Porque a Manos Veículos consegue oferecer financiamento bancário com as melhores taxas do mercado para o comprador, além de aceitar o carro usado dele na troca. Mais de 80% das compras de seminovos envolvem troca ou financiamento — coisas que um vendedor particular não consegue oferecer.'
  },
  {
    q: 'Preciso pagar alguma taxa adiantada para consignar?',
    a: 'Não! Você não paga nada antecipado para consignar seu carro. Nossa remuneração já está embutida na margem de venda acima do valor líquido que combinamos com você. Se o carro não for vendido, você não paga nada.'
  },
  {
    q: 'Meu carro fica seguro na loja?',
    a: 'Com certeza! Nosso espaço possui monitoramento 24 horas, pátio coberto e seguro completo. Além disso, firmamos um contrato oficial de consignação discriminando todos os dados do veículo e a responsabilidade da loja.'
  },
  {
    q: 'Como é feita a transferência do dinheiro e do documento?',
    a: 'Após a aprovação do comprador e liquidação do pagamento, transferimos o valor líquido diretamente via PIX ou TED para você. A transferência do documento é feita de forma segura e acompanhada pela nossa equipe de despachante.'
  }
];

export default function ConsignacaoPage() {
  const [step, setStep] = useState(1);
  const [leadId] = useState(novoLeadId);

  // FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Analytics tracking
  useEffect(() => {
    trackFunnelStart('Venda');
  }, []);

  useEffect(() => {
    if (step > 1) trackFunnelStep('Venda', step);
  }, [step]);

  // Step 1: Contato Inicial
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);

  // Step 2: Placa / Modelo
  const [placa, setPlaca] = useState('');
  const [placaLoading, setPlacaLoading] = useState(false);
  const [placaError, setPlacaError] = useState('');

  // Step 3: Detalhes do Carro & Consignação
  const [veiculo, setVeiculo] = useState<VeiculoPlaca | null>(null);
  const [marcaManual, setMarcaManual] = useState('');
  const [modeloManual, setModeloManual] = useState('');
  const [km, setKm] = useState('');
  const [cor, setCor] = useState('');
  const [valorLiquido, setValorLiquido] = useState('');
  const [modalidade, setModalidade] = useState<'Fisica' | 'Virtual'>('Fisica');
  const [obs, setObs] = useState('');
  const [sending, setSending] = useState(false);

  const rawPhone = telefone.replace(/\D/g, '');
  const contatoValido = nome.trim().length >= 3 && rawPhone.length >= 10 && cidade.trim().length >= 2;

  const precisaMarcaModelo = !veiculo || (!veiculo.marca && !veiculo.modelo);
  const veiculoValido =
    km.trim() !== '' && cor.trim() !== '' && valorLiquido.trim() !== '' &&
    (!precisaMarcaModelo || (marcaManual.trim() !== '' && modeloManual.trim() !== ''));

  const openDirectWhatsApp = (msgExtra = '') => {
    trackContato('whatsapp', 'Consignacao Direct WhatsApp');
    const texto = encodeURIComponent(
      msgExtra || `Olá! Vim pelo site e gostaria de consignar meu veículo com a Manos Veículos.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUM}?text=${texto}`, '_blank');
  };

  // Step 1 Submit
  const handleContato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contatoValido || leadLoading) return;
    setLeadLoading(true);
    trackLeadParcial({ tipo: 'Venda' });
    await registrarLeadConsignacao({ lead_id: leadId, nome: nome.trim(), telefone: rawPhone, cidade: cidade.trim() });
    setLeadLoading(false);
    setStep(2);

    const formEl = document.getElementById('hero-consignacao-card');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Step 2 Plate Search
  const handleBuscarPlaca = async () => {
    if (placa.length < 7 || placaLoading) return;
    setPlacaLoading(true);
    setPlacaError('');
    const res = await consultarPlaca(placa);
    setPlacaLoading(false);
    trackPlacaConsultada(Boolean(res.ok && res.veiculo));
    if (res.ok && res.veiculo) {
      setVeiculo(res.veiculo);
      if (res.veiculo.cor) setCor(res.veiculo.cor);
      setStep(3);
    } else {
      setPlacaError(res.error || 'Não encontramos os dados da placa. Você pode preencher manualmente abaixo.');
      setVeiculo(null);
      setStep(3);
    }
  };

  const handleSemPlaca = () => {
    setVeiculo(null);
    setStep(3);
  };

  // Step 3 Submit Final
  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!veiculoValido || sending) return;
    setSending(true);
    const eventId = trackLead({
      tipo: 'Venda',
      valor: onlyNumber(valorLiquido) / 100,
      vehicleName: [veiculo?.marca || marcaManual, veiculo?.modelo || modeloManual].filter(Boolean).join(' ') || null,
    });

    await enviarConsignacao({
      lead_id: leadId,
      event_id: eventId,
      tipo_funil: 'Consignacao',
      nome: nome.trim(),
      telefone: rawPhone,
      cidade: cidade.trim(),
      placa: placa || null,
      marca: veiculo?.marca || marcaManual.trim() || null,
      modelo: veiculo?.modelo || modeloManual.trim() || null,
      versao: veiculo?.versao || null,
      ano: veiculo?.ano || null,
      combustivel: veiculo?.combustivel || null,
      fipe: veiculo?.fipeValor || null,
      km: onlyNumber(km),
      cor: cor.trim(),
      valor_desejado: onlyNumber(valorLiquido) / 100,
      valor_desejado_formatado: valorLiquido,
      modalidade_consignacao: modalidade,
      observacoes: obs.trim() || null,
    });
    setSending(false);
    setStep(4);
  };

  return (
    <div className="vendas-landing-viewport">
      <div className="vendas-glow-bg" />

      {/* HEADER TOP */}
      <header className="sticky top-0 z-40 bg-[#070707]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/">
              <img src={LOGO} alt="Manos Veículos" className="h-8 sm:h-10 w-auto object-contain" />
            </a>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-semibold text-amber-400">Especialistas em Consignação em Rio do Sul - SC</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:04733001352"
              className="hidden sm:inline-flex items-center gap-2 text-xs font-bold text-white/70 hover:text-white transition-colors"
            >
              <Phone className="w-4 h-4 text-manos-red" />
              (47) 3300-1352
            </a>

            <button
              onClick={() => openDirectWhatsApp()}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-green-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline">Consignar no</span> WhatsApp
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-6 sm:pt-12 pb-12 sm:pb-20 px-4 sm:px-8 max-w-7xl mx-auto w-full flex-grow z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* COLUNA DA ESQUERDA - APRESENTAÇÃO */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-green-500/20 border border-white/10 rounded-full">
              <Sparkles className="w-4 h-4 text-amber-400 animate-bounce" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Consignação Inteligente • Venda Rápida pelo Melhor Valor
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight uppercase leading-[1.05] italic">
                Consigne seu carro na <span className="text-manos-red">Manos Veículos</span> e venda pelo <span className="text-amber-400">valor máximo</span>
              </h1>
              <p className="text-base sm:text-lg text-white/70 leading-relaxed font-normal max-w-2xl">
                Você define quanto quer receber líquido no bolso. Nós anunciamos nos maiores portais, oferecemos <strong className="text-white">financiamento bancário</strong> para o comprador e aceitamos o usado dele na troca.
              </p>
            </div>

            {/* DIFERENCIAIS DE CONSIGNAÇÃO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                {
                  icon: <TrendingUp className="w-5 h-5 text-amber-400" />,
                  title: 'Financiamento para o Comprador',
                  desc: 'Mais de 80% dos carros vendem porque financiamos na hora'
                },
                {
                  icon: <Handshake className="w-5 h-5 text-green-400" />,
                  title: 'Aceitamos Troca',
                  desc: 'Pegamos o usado do comprador e pagamos seu valor integral'
                },
                {
                  icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
                  title: 'Showroom Seguro ou Consignação Virtual',
                  desc: 'Deixe na loja ou continue rodando com o veículo'
                },
                {
                  icon: <Camera className="w-5 h-5 text-purple-400" />,
                  title: 'Fotos Profissionais & Tráfego Pago',
                  desc: 'Anúncios de destaque em portais e redes sociais'
                }
              ].map((item, idx) => (
                <div key={idx} className="vendas-card-glass p-4 flex items-start gap-3 border-l-4 border-l-amber-500">
                  <div className="p-2 bg-white/5 rounded-xl flex-shrink-0">{item.icon}</div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">{item.title}</h3>
                    <p className="text-xs text-white/50">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* PROVA SOCIAL */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm font-bold text-white/80">
                <span className="text-white font-black">4.8 no Google</span> (Mais de 154 avaliações reais de clientes em Rio do Sul)
              </p>
              <div className="hidden sm:flex items-center gap-2 text-xs text-white/50">
                <Building2 className="w-4 h-4 text-manos-red" />
                Rua Dom Pedro II, 374 - Canoas, Rio do Sul - SC
              </div>
            </div>

            {/* WHATSAPP RÁPIDO */}
            <div className="vendas-card-glass p-5 sm:p-6 bg-gradient-to-br from-amber-950/30 to-black border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Dúvidas sobre Consignação?</span>
              </div>
              <p className="text-xs sm:text-sm text-white/70">
                Converse com nosso especialista em consignação diretamente no WhatsApp e tire todas as suas dúvidas sem compromisso:
              </p>
              <button
                onClick={() => openDirectWhatsApp('Olá! Tenho interesse em consignar meu veículo e gostaria de saber as condições.')}
                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-sm uppercase rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-green-600/30 active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 fill-current" />
                Falar com Especialista em Consignação
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* COLUNA DA DIREITA - FORMULÁRIO DE CONVERSÃO */}
          <div id="hero-consignacao-card" className="lg:col-span-5 w-full">
            <div className="vendas-card-active p-6 sm:p-8 space-y-6 relative overflow-hidden border-amber-500/30">
              
              {/* Progresso */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-amber-400 font-black">
                    {step === 1 && 'Etapa 1 de 3 • Seus Dados'}
                    {step === 2 && 'Etapa 2 de 3 • Dados do Carro'}
                    {step === 3 && 'Etapa 3 de 3 • Valor & Modalidade'}
                    {step === 4 && 'Consignação Solicitada'}
                  </span>
                  <span className="text-white/40">
                    {step === 1 && '30 segundos'}
                    {step === 2 && 'FIPE Automática'}
                    {step === 3 && 'Proposta Sem Custo'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-amber-400"
                    initial={{ width: '25%' }}
                    animate={{ width: `${step * 25}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {/* STEP 1 - CONTATO */}
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    <div className="space-y-1 text-left">
                      <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white">
                        Simule a <span className="text-amber-400">Consignação</span>
                      </h2>
                      <p className="text-xs sm:text-sm text-white/60">
                        Preencha para receber a estimativa de venda rápida e condições para o seu seminovo.
                      </p>
                    </div>

                    <form onSubmit={handleContato} className="space-y-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
                          Seu Nome Completo *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="name"
                          className="w-full py-4 px-5 bg-white/5 border border-white/15 rounded-2xl text-white placeholder-white/30 text-sm focus:border-amber-400 outline-none transition-all"
                          placeholder="Ex.: Marcos Andrade"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
                          WhatsApp de Contato (com DDD) *
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            required
                            inputMode="numeric"
                            autoComplete="tel"
                            className="w-full py-4 px-5 bg-white/5 border border-white/15 rounded-2xl text-white placeholder-white/30 text-sm focus:border-amber-400 outline-none transition-all"
                            placeholder="(47) 99999-9999"
                            value={telefone}
                            onChange={(e) => setTelefone(formatPhone(e.target.value))}
                          />
                          {rawPhone.length >= 10 && (
                            <CheckCircle2 className="w-5 h-5 text-green-400 absolute right-4 top-1/2 -translate-y-1/2" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-white/80 uppercase tracking-wider">
                          Sua Cidade *
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="address-level2"
                          className="w-full py-4 px-5 bg-white/5 border border-white/15 rounded-2xl text-white placeholder-white/30 text-sm focus:border-amber-400 outline-none transition-all"
                          placeholder="Ex.: Rio do Sul"
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!contatoValido || leadLoading}
                        className="w-full py-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black text-base uppercase rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer"
                      >
                        {leadLoading ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
                        ) : (
                          <>Avançar para Dados do Carro <ArrowRight className="w-5 h-5" /></>
                        )}
                      </button>

                      <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-white/40 font-semibold">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        <span>Sem taxas iniciais. Seus dados estão seguros (LGPD).</span>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* STEP 2 - PLACA */}
                {step === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    <div className="space-y-1 text-left">
                      <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white">
                        Informe a <span className="text-amber-400">Placa</span> do Carro
                      </h2>
                      <p className="text-xs sm:text-sm text-white/60">
                        Buscamos a FIPE, ano e versão para estimar o potencial de venda rápida.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl p-3 border-4 border-slate-800 shadow-2xl text-center space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-black tracking-widest text-slate-400 px-2 uppercase">
                          <span>Brasil</span>
                          <span>Mercosul</span>
                        </div>
                        <input
                          type="text"
                          autoFocus
                          autoCapitalize="characters"
                          className="w-full py-2 text-center text-3xl font-black tracking-[0.25em] text-slate-900 bg-transparent outline-none uppercase placeholder:text-slate-300"
                          placeholder="ABC1D23"
                          value={placa}
                          onChange={(e) => { setPlaca(formatPlaca(e.target.value)); setPlacaError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarPlaca(); }}
                        />
                      </div>

                      {placaError && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold text-left">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{placaError}</span>
                        </div>
                      )}

                      <button
                        onClick={handleBuscarPlaca}
                        disabled={placa.length < 7 || placaLoading}
                        className="w-full py-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black text-base uppercase rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer"
                      >
                        {placaLoading ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Buscando Dados FIPE...</>
                        ) : (
                          <><Search className="w-5 h-5" /> Buscar Dados da Placa</>
                        )}
                      </button>

                      <div className="pt-2 text-center space-y-2 border-t border-white/10">
                        <p className="text-xs text-white/50">Prefere informar o modelo manualmente?</p>
                        <button
                          onClick={handleSemPlaca}
                          className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase rounded-xl transition-all cursor-pointer"
                        >
                          Continuar sem a Placa
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3 - VALOR LÍQUIDO & MODALIDADE */}
                {step === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    <div className="space-y-1 text-left">
                      <h2 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white">
                        Valor & <span className="text-amber-400">Modalidade</span>
                      </h2>
                      <p className="text-xs sm:text-sm text-white/60">
                        Defina o valor líquido que deseja receber livre no seu bolso.
                      </p>
                    </div>

                    {veiculo && (veiculo.marca || veiculo.modelo) && (
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Carro Identificado
                          </span>
                          {veiculo.fipeValor && (
                            <span className="text-xs font-black text-green-400">FIPE: {veiculo.fipeValor}</span>
                          )}
                        </div>
                        <p className="text-sm font-black text-white italic uppercase">
                          {veiculo.marca} {veiculo.modelo} {[veiculo.versao, veiculo.ano].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleEnviar} className="space-y-3.5 text-left">
                      {precisaMarcaModelo && (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-white/70 uppercase">Marca do Carro</label>
                            <input
                              type="text"
                              required
                              className="w-full py-3.5 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 outline-none"
                              placeholder="Ex.: Toyota"
                              value={marcaManual}
                              onChange={(e) => setMarcaManual(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-white/70 uppercase">Modelo e Versão</label>
                            <input
                              type="text"
                              required
                              className="w-full py-3.5 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 outline-none"
                              placeholder="Ex.: Corolla XEi 2.0"
                              value={modeloManual}
                              onChange={(e) => setModeloManual(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-white/70 uppercase">Quilometragem (km)</label>
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            className="w-full py-3.5 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 outline-none"
                            placeholder="Ex.: 60.000"
                            value={km}
                            onChange={(e) => setKm(formatThousands(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-white/70 uppercase">Cor do Carro</label>
                          <input
                            type="text"
                            required
                            className="w-full py-3.5 px-4 bg-white/5 border border-white/15 rounded-xl text-white text-sm focus:border-amber-400 outline-none"
                            placeholder="Ex.: Pretox"
                            value={cor}
                            onChange={(e) => setCor(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-white/70 uppercase">Valor Líquido Desejado no Bolso</label>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          className="w-full py-4 px-4 bg-white/5 border border-amber-500/40 rounded-xl text-amber-400 font-bold text-base focus:border-amber-400 outline-none"
                          placeholder="R$ 0,00"
                          value={valorLiquido}
                          onChange={(e) => setValorLiquido(formatBRL(e.target.value))}
                        />
                        <p className="text-[11px] text-white/40">Esse é o valor limpo que você receberá na venda.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-white/70 uppercase">Modalidade Preferida</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setModalidade('Fisica')}
                            className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 ${
                              modalidade === 'Fisica'
                                ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            <span className="font-black">Física (Showroom)</span>
                            <span className="text-[10px] font-normal opacity-80">Carro exposto na loja</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setModalidade('Virtual')}
                            className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 ${
                              modalidade === 'Virtual'
                                ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            <span className="font-black">Virtual</span>
                            <span className="text-[10px] font-normal opacity-80">Continua usando o carro</span>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={!veiculoValido || sending}
                        className="w-full py-5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-black text-base uppercase rounded-2xl shadow-xl shadow-green-600/30 flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer mt-2"
                      >
                        {sending ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Processando Consignação...</>
                        ) : (
                          <>Solicitar Proposta de Consignação <ArrowRight className="w-5 h-5" /></>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* STEP 4 - SUCESSO */}
                {step === 4 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-6 py-4"
                  >
                    <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/40">
                      <CheckCircle2 className="w-10 h-10 text-black" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">
                        Solicitação de Consignação Recebida!
                      </h2>
                      <p className="text-sm text-white/80 leading-relaxed">
                        Obrigado, <strong className="text-amber-400">{nome}</strong>! Nossa equipe de consignação da Manos Veículos em Rio do Sul já está analisando o seu veículo.
                      </p>
                      <p className="text-xs text-white/50 border-l-2 border-amber-500/40 pl-3 py-1 text-left italic">
                        Entraremos em contato no WhatsApp <strong className="text-white">{telefone}</strong> para alinhar os detalhes da higienização, fotos e avaliação.
                      </p>
                    </div>

                    <button
                      onClick={() => openDirectWhatsApp(`Olá! Acabei de enviar os dados do meu carro (${veiculo?.marca || marcaManual} ${veiculo?.modelo || modeloManual}) para consignação no site.`)}
                      className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-sm uppercase rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-5 h-5 fill-current" />
                      Falar com Consultor no WhatsApp Agora
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

        </div>
      </section>

      {/* SEÇÃO COMPARATIVA: VENDER SOZINHO VS CONSIGNAR NA MANOS */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 bg-white/[0.02] border-y border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto space-y-12 text-center">
          
          <div className="space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-bold uppercase">
              <Award className="w-3.5 h-3.5" />
              Por que consignar é a escolha mais inteligente?
            </div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Vender Sozinho vs <span className="text-amber-400">Consignar na Manos</span>
            </h2>
            <p className="text-sm sm:text-base text-white/60">
              Veja porque a maioria dos proprietários prefere a segurança e rapidez da Manos Veículos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto text-left">
            {/* VENDER SOZINHO */}
            <div className="vendas-card-glass p-6 sm:p-8 space-y-5 border-l-4 border-l-red-500 bg-red-950/10">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-xl font-black text-red-400 uppercase italic">Vender Particular</h3>
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Sem Financiamento:</strong> Perde 80% dos compradores que precisam financiar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Não Aceita Troca:</strong> Difícil encontrar quem tenha todo o valor em dinheiro.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Insegurança:</strong> Marcar encontros com estranhos na sua casa ou rua.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Perda de Tempo:</strong> Dezenas de mensagens curiosas e propostas absurdas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Demora:</strong> Carro parado por meses desvalorizando.</span>
                </li>
              </ul>
            </div>

            {/* CONSIGNAR NA MANOS */}
            <div className="vendas-card-glass p-6 sm:p-8 space-y-5 border-l-4 border-l-green-500 bg-green-950/10">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-xl font-black text-green-400 uppercase italic">Consignar na Manos</h3>
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-white/90">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Financiamento Aprovado:</strong> Fazemos a simulação e aprovação bancária na hora.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Aceitamos o Carro na Troca:</strong> Compramos a troca e pagamos você à vista.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Segurança 100%:</strong> Showroom com seguro completo e contrato transparente.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Anúncios de Alta Performance:</strong> Tráfego pago no Google, Meta e portais.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span><strong>Valor Líquido Garantido:</strong> Você recebe o valor combinado sem surpresas.</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* MODALIDADES DE CONSIGNAÇÃO */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-7xl mx-auto w-full relative z-10">
        <div className="space-y-12 text-center">
          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Escolha a <span className="text-amber-400">Modalidade Ideal</span> para Você
            </h2>
            <p className="text-sm sm:text-base text-white/60">
              Oferecemos flexibilidade total de acordo com a sua necessidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
            <div className="vendas-card-glass p-8 space-y-4 border-amber-500/30 hover:border-amber-400 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black uppercase italic text-white">Consignação Física</h3>
              <p className="text-sm text-white/70 leading-relaxed">
                Seu veículo fica em exposição em nosso showroom coberto e monitorado na loja física em Rio do Sul. Aproveita o grande fluxo de clientes presenciais diariamente.
              </p>
              <div className="pt-2 text-xs font-bold text-amber-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Maior índice de velocidade de venda
              </div>
            </div>

            <div className="vendas-card-glass p-8 space-y-4 border-blue-500/30 hover:border-blue-400 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Car className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black uppercase italic text-white">Consignação Virtual</h3>
              <p className="text-sm text-white/70 leading-relaxed">
                Você continua utilizando seu carro no dia a dia normalmente. Nós fazemos o ensaio fotográfico profissional, anunciamos e só agendamos a visita quando houver comprador qualificado.
              </p>
              <div className="pt-2 text-xs font-bold text-blue-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Não fica sem carro durante o anúncio
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA (4 PASSOS) */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 bg-white/[0.02] border-t border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto space-y-12 text-center">
          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Como Funciona em <span className="text-amber-400">4 Passos</span>
            </h2>
            <p className="text-sm sm:text-base text-white/60">
              Processo simples, transparente e sem complicação.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01',
                title: 'Avaliação & Acordo',
                desc: 'Analisamos o carro e definimos o valor líquido exato que você receberá.',
                icon: <Search className="w-6 h-6 text-amber-400" />
              },
              {
                num: '02',
                title: 'Preparo & Fotos',
                desc: 'Higienização e ensaio de fotos e vídeos profissionais do veículo.',
                icon: <Camera className="w-6 h-6 text-amber-400" />
              },
              {
                num: '03',
                title: 'Divulgação Total',
                desc: 'Anúncios nos maiores portais do Brasil e campanhas patrocinadas.',
                icon: <Share2 className="w-6 h-6 text-amber-400" />
              },
              {
                num: '04',
                title: 'Venda & PIX',
                desc: 'Vendemos, cuidamos da burocracia e você recebe o valor via PIX.',
                icon: <DollarSign className="w-6 h-6 text-green-400" />
              }
            ].map((st, i) => (
              <div key={i} className="vendas-card-glass p-6 text-left space-y-3 relative overflow-hidden">
                <span className="absolute top-3 right-4 text-3xl font-black text-white/10">{st.num}</span>
                <div className="p-2.5 bg-white/5 rounded-xl w-fit">{st.icon}</div>
                <h3 className="text-lg font-bold text-white">{st.title}</h3>
                <p className="text-xs text-white/60 leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-7xl mx-auto w-full relative z-10">
        <div className="space-y-12 text-center">
          <div className="space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-400 text-xs font-bold uppercase">
              <Star className="w-3.5 h-3.5 fill-current" />
              Depoimentos Reais de Consignação
            </div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Quem Consignou na Manos <span className="text-green-400">Aprova</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {REVIEWS_CONSIGNACAO.map((rev, idx) => (
              <div key={idx} className="vendas-card-glass p-6 text-left space-y-4 border-l-4 border-l-amber-400">
                <div className="flex items-center justify-between">
                  <div className="flex text-yellow-400">
                    {[...Array(rev.estrelas)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {rev.tempo}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-white/80 italic leading-relaxed">
                  "{rev.texto}"
                </p>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-sm font-bold text-white">{rev.nome}</p>
                  <p className="text-xs text-white/40">{rev.cidade} • {rev.carro}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQS */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 bg-white/[0.02] border-t border-white/10 relative z-10">
        <div className="max-w-4xl mx-auto space-y-10 text-center">
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black uppercase italic tracking-tight text-white">
              Dúvidas Frequentes sobre <span className="text-amber-400">Consignação</span>
            </h2>
          </div>

          <div className="space-y-3 text-left">
            {FAQS_CONSIGNACAO.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="vendas-card-glass overflow-hidden transition-all border border-white/10">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-white hover:text-amber-400 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <HelpCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      {faq.q}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-white/70 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-4 sm:px-8 bg-black border-t border-white/10 text-center space-y-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Manos Veículos" className="h-8 w-auto object-contain" />
            <span className="text-xs text-white/40 border-l border-white/20 pl-3">Manos Veículos • Consignação & Seminovos</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-manos-red" />
              Rua Dom Pedro II, 374 - Canoas, Rio do Sul - SC
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-green-400" />
              (47) 3300-1352
            </span>
          </div>

          <div className="text-[11px] text-white/30">
            © {new Date().getFullYear()} Manos Veículos. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* BARRA FIXA MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-black/90 backdrop-blur-xl border-t border-white/10 z-50 md:hidden flex items-center gap-2">
        <button
          onClick={() => {
            const formEl = document.getElementById('hero-consignacao-card');
            if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="flex-1 py-3 bg-amber-500 text-black font-black text-xs uppercase rounded-xl shadow-lg flex items-center justify-center gap-2"
        >
          <Car className="w-4 h-4" />
          Simular Consignação
        </button>

        <button
          onClick={() => openDirectWhatsApp()}
          className="flex-1 py-3 bg-green-600 text-white font-black text-xs uppercase rounded-xl shadow-lg flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          WhatsApp Direto
        </button>
      </div>

    </div>
  );
}
