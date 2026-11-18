import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Car,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Phone,
  MessageCircle,
  Search,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building2,
  Camera,
  TrendingUp,
  Clock,
  Handshake,
  DollarSign,
  Award,
  ChevronDown,
  Check,
  Zap,
  Star,
  ExternalLink,
  Shield,
  HelpCircle
} from 'lucide-react';
import { SiteShell } from '../ManosUI';
import { getStoredLead, saveStoredLead } from '../../lib/leadStore';
import { LOJA, waLink, formatPhone, validatePlaca } from '../../lib/manos';
import { track } from '../../lib/track';

function novoLeadId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {}
  return `csg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function onlyNumber(str: string): number {
  return parseInt((str || '').replace(/\D/g, ''), 10) || 0;
}

function formatPlacaDisplay(val: string): string {
  const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (raw.length > 3 && !/^[A-Z]{3}[0-9][A-Z]/.test(raw)) {
    return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  }
  return raw;
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

// Depoimentos Reais de Clientes
const REVIEWS_CONSIGNACAO = [
  {
    nome: 'Carlos Eduardo M.',
    cidade: 'Rio do Sul - SC',
    carro: 'Compass Longitude 2021',
    texto: 'Tentei vender meu Compass sozinho por 2 meses sem sucesso. Deixei na Manos em consignação e em menos de 10 dias eles venderam aceitando a troca do comprador e me pagaram o valor líquido certinho!',
    tempo: 'Vendido em 9 dias'
  },
  {
    nome: 'Juliana S. V.',
    cidade: 'Ituporanga - SC',
    carro: 'Civic EXL 2019',
    texto: 'Fiz a consignação virtual porque precisava do carro no dia a dia. Eles tiraram fotos profissionais, anunciaram e em 2 semanas me chamaram com o comprador aprovado no financiamento.',
    tempo: 'Consignação Virtual'
  },
  {
    nome: 'Rodrigo A. F.',
    cidade: 'Laurentino - SC',
    carro: 'Corolla XEi 2020',
    texto: 'Total transparência no contrato. Não tive dor de cabeça com estranhos me chamando toda hora. Venderam pelo valor de mercado que combinamos. Recomendo de olhos fechados!',
    tempo: 'Vendido em 6 dias'
  }
];

// FAQs de Consignação
const FAQS_CONSIGNACAO = [
  {
    q: 'Como funciona a Consignação na Manos Veículos?',
    a: 'Nós combinamos com você o valor líquido que deseja receber pelo seu carro. Cuidamos de todo o processo de divulgação, higienização, fotos profissionais, atendimento a interessados, oferta de financiamento bancário e troca. Quando o carro é vendido, você recebe o valor líquido diretamente na sua conta.'
  },
  {
    q: 'Qual a diferença entre Consignação Física e Virtual?',
    a: 'Na Consignação Física, seu veículo fica exposto em nosso showroom coberto e seguro na loja de Rio do Sul, com alto fluxo diário de compradores. Na Consignação Virtual, você continua rodando com seu carro normalmente enquanto fazemos os anúncios profissionais e trazemos os compradores qualificados.'
  },
  {
    q: 'Por que o carro vende muito mais rápido na Manos?',
    a: 'Porque a Manos Veículos oferece financiamento bancário com as melhores taxas do mercado para o comprador, além de aceitar o carro usado dele na troca. Mais de 80% das compras de seminovos envolvem troca ou financiamento — facilidades que a venda particular não possui.'
  },
  {
    q: 'Existe alguma taxa antecipada para consignar?',
    a: 'Não! Você não paga nada antecipado. Nossa remuneração é negociada de forma transparente e embutida na venda acima do valor líquido que combinamos com você. Se o carro não for vendido, você não paga absolutamente nada.'
  },
  {
    q: 'Meu carro fica seguro no pátio da loja?',
    a: 'Com certeza! Nosso showroom possui pátio coberto, monitoramento 24h e seguro total. Além disso, firmamos um contrato oficial de consignação discriminando todos os dados do veículo e as responsabilidades da loja.'
  }
];

export default function ConsignacaoPage() {
  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleOpenWa = (msgExtra = '') => {
    track('consignacao_whatsapp_click', {});
    const text = msgExtra || `Olá! Gostaria de saber mais sobre a Consignação de Veículos na Manos em Rio do Sul.`;
    window.open(waLink(text), '_blank');
  };

  return (
    <SiteShell title="Consignação de Veículos | Manos Veículos Rio do Sul">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-10">
        
        {/* HERO HERO CONTAINER (ESTILO MANOS VEÍCULOS LUXO) */}
        <section className="bg-gradient-to-br from-[#2E1810] via-[#3B2016] to-[#2E1810] text-[#FDF3E7] rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden border border-[#E0B68F]/30 shadow-2xl">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src="/capa-manos.jpg"
              alt="Fachada Manos Veículos"
              className="w-full h-full object-cover opacity-30 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2E1810]/95 via-[#3B2016]/85 to-[#2E1810]/75" />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Texto de Apresentação Hero */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-[#E0B68F]/20 text-[#E0B68F] border border-[#E0B68F]/30 tracking-wider uppercase">
                <Award className="w-4 h-4 text-[#E0B68F]" />
                <span>Consignação Transparente · Rio do Sul/SC</span>
              </div>

              <div className="space-y-3">
                <h1 className="font-serif font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight drop-shadow-md">
                  Venda seu carro pelo <span className="text-[#E0B68F]">valor máximo</span> sem se preocupar com visitas.
                </h1>
                <p className="text-sm sm:text-base text-[#F6DCC8] leading-relaxed max-w-2xl">
                  Você define o valor líquido no bolso. Nós anunciamos nos maiores portais de SC, higienizamos seu veículo, oferecemos <strong className="text-white">financiamento bancário</strong> para o comprador e aceitamos a troca dele.
                </p>
              </div>

              {/* Pilares de Vantagens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  { title: 'Financiamento em até 60x', desc: 'Aceleramos a venda porque 80% compram financiado', icon: <TrendingUp className="w-4 h-4 text-[#E0B68F]" /> },
                  { title: 'Aceitamos Troca do Comprador', desc: 'Pegamos o usado dele e você recebe dinheiro limpo', icon: <Handshake className="w-4 h-4 text-[#E0B68F]" /> },
                  { title: 'Física ou Virtual', desc: 'Exponha na loja de Rio do Sul ou continue usando seu carro', icon: <ShieldCheck className="w-4 h-4 text-emerald-400" /> },
                  { title: 'Tráfego Pago & Fotos HD', desc: 'Anúncios patrocinados de alta conversão nas redes', icon: <Camera className="w-4 h-4 text-[#E0B68F]" /> },
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#2E1810]/70 backdrop-blur-xs p-3.5 rounded-2xl border border-[#E0B68F]/20 flex items-start gap-3">
                    <div className="p-2 bg-[#3B2016] rounded-xl border border-[#E0B68F]/30 flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-xs text-white">{item.title}</h3>
                      <p className="text-[11px] text-[#F6DCC8]/75 leading-tight">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão de Dúvidas Direct WhatsApp */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleOpenWa('Olá! Gostaria de conversar com o especialista em consignação da Manos Veículos.')}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl transition-all flex items-center gap-2 shadow-lg active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>Falar com Especialista no WhatsApp</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-[#F6DCC8]/80 font-medium">
                  <Building2 className="w-4 h-4 text-[#E0B68F]" />
                  <span>Atendimento presencial em Rio do Sul/SC</span>
                </div>
              </div>
            </div>

            {/* FORMULÁRIO MULTI-STEP CARD (DESIGN SISTEMA MANOS VEÍCULOS) */}
            <div id="consignacao-form-card" className="lg:col-span-5 w-full">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EEDFCF] shadow-2xl text-[#3B2016] space-y-6">
                
                <div className="space-y-4 text-left">
                  <span className="text-[#7A2E1E] flex items-center gap-1.5 font-serif text-xs font-extrabold uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-[#7A2E1E]" />
                    Sem Taxa Inicial
                  </span>
                  <h2 className="font-serif font-extrabold text-xl text-[#3B2016]">
                    Simular Proposta de Consignação
                  </h2>
                  <p className="text-xs text-[#7D6250] leading-relaxed">
                    Chame nosso especialista no WhatsApp, envie a placa e as fotos do seu carro e receba a proposta de consignação.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenWa('Olá! Quero simular a consignação do meu carro na Manos Veículos.')}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <MessageCircle className="w-5 h-5 text-white" />
                    <span>Consignar no WhatsApp</span>
                  </button>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* SEÇÃO TRANSPARÊNCIA: VENDER PARTICULAR VS CONSIGNAR NA MANOS */}
        <section className="space-y-6">
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#F4E6D7] text-[#7A2E1E] uppercase tracking-wider">
              Comparativo Transparente
            </span>
            <h2 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#3B2016]">
              Por que consignar é a escolha mais inteligente?
            </h2>
            <p className="text-xs sm:text-sm text-[#7D6250]">
              Entenda a diferença entre tentar vender sozinho e contar com a estrutura da Manos Veículos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card Vender Particular */}
            <div className="bg-white p-6 rounded-3xl border border-red-200 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-red-100">
                <h3 className="font-serif font-extrabold text-lg text-red-800">Vender Particular</h3>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">Demorado & Arriscado</span>
              </div>
              <ul className="space-y-3 text-xs text-[#7D6250]">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mt-0.5">✕</span>
                  <span>Sem opção de financiamento bancário (perde 80% dos compradores).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mt-0.5">✕</span>
                  <span>Não aceita veículo usado na troca do comprador.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mt-0.5">✕</span>
                  <span>Desgaste com curiosos e riscos de golpes ou encontros com estranhos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mt-0.5">✕</span>
                  <span>Perda de tempo agendando horários e mostrando o carro repetidamente.</span>
                </li>
              </ul>
            </div>

            {/* Card Consignar na Manos */}
            <div className="bg-white p-6 rounded-3xl border-2 border-[#7A2E1E] shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#7A2E1E] text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl">
                Recomendado
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F4E6D7]">
                <h3 className="font-serif font-extrabold text-lg text-[#3B2016]">Consignar na Manos</h3>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">Rápido & Seguro</span>
              </div>
              <ul className="space-y-3 text-xs text-[#3B2016]">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 font-extrabold" />
                  <span><strong>Financiamento Bancário Facilitado:</strong> aprovamos crédito em até 60x para o comprador.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 font-extrabold" />
                  <span><strong>Aceitamos Troca:</strong> recebemos o usado do comprador e pagamos seu valor líquido limpo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 font-extrabold" />
                  <span><strong>Segurança Total:</strong> contrato formal, pátio coberto monitorado em Rio do Sul ou consignação virtual.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 font-extrabold" />
                  <span><strong>Zero Incomodação:</strong> equipe profissional cuida de fotos, anúncios e toda a negociação.</span>
                </li>
              </ul>
            </div>

          </div>
        </section>

        {/* DEPOIMENTOS DE CLIENTES */}
        <section className="bg-[#F4E6D7] rounded-3xl p-6 sm:p-10 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-serif font-extrabold text-2xl text-[#3B2016]">
              Quem consignou na Manos recomenda
            </h2>
            <p className="text-xs text-[#7D6250]">Histórias reais de proprietários em Rio do Sul e região.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REVIEWS_CONSIGNACAO.map((rev, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-[#EEDFCF] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-500 text-xs">★★★★★</div>
                  <span className="text-[10px] font-extrabold bg-[#F4E6D7] text-[#7A2E1E] px-2 py-0.5 rounded-md">
                    {rev.tempo}
                  </span>
                </div>
                <p className="text-xs text-[#3B2016] italic leading-relaxed">
                  "{rev.texto}"
                </p>
                <div className="pt-2 border-t border-[#F4E6D7] flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#3B2016]">{rev.nome}</span>
                  <span className="text-[#7D6250]">{rev.carro}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ PERGUNTAS FREQUENTES */}
        <section className="space-y-6">
          <div className="text-center space-y-1">
            <h2 className="font-serif font-extrabold text-2xl text-[#3B2016]">
              Perguntas Frequentes sobre Consignação
            </h2>
            <p className="text-xs text-[#7D6250]">Tire todas as suas dúvidas com transparência total.</p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS_CONSIGNACAO.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-[#EEDFCF] overflow-hidden transition-all shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between gap-3 font-serif font-bold text-sm text-[#3B2016] hover:text-[#7A2E1E]"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#7A2E1E] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-[#7D6250] leading-relaxed border-t border-[#F4E6D7] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </SiteShell>
  );
}
