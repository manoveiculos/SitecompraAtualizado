import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Star, 
  Building2, 
  MapPin, 
  Car, 
  DollarSign, 
  Handshake, 
  CreditCard,
  ChevronRight,
  Clock,
  Sparkles,
  MessageCircle,
  ExternalLink,
  Award
} from 'lucide-react';
import { SiteShell, Logo } from '../ManosUI';
import { LOJA, SOCIAL, waLink, brl } from '../../lib/manos';
import { fetchStock, type Vehicle } from '../../services/stockService';
import { track } from '../../lib/track';
import { navigate } from '../../lib/router';

export default function HomePage() {
  const [stock, setStock] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultorPrompt, setConsultorPrompt] = useState('');
  const [buscaEstoque, setBuscaEstoque] = useState('');

  useEffect(() => {
    fetchStock().then((data) => {
      setStock(data);
      setLoading(false);
    });
  }, []);

  const handleOpenConsultor = (prompt?: string) => {
    const p = prompt || consultorPrompt;
    track('consultor_hero_open', { prompt: p });
    window.dispatchEvent(new CustomEvent('open-consultor', { detail: { prompt: p } }));
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (buscaEstoque.trim()) {
      navigate(`/estoque?busca=${encodeURIComponent(buscaEstoque.trim())}`);
    }
  };

  // Top 3 featured vehicles for "Escolhidos da semana"
  const escolhidos = stock.slice(0, 3);

  return (
    <SiteShell variant="default" showTrustCards={false}>
      <div className="space-y-10 lg:space-y-14">
        
        {/* 1. HERO CONSULTOR MANOS (bg-marrom) */}
        <section className="bg-[#3B2016] text-[#FDF3E7] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden border border-[#E0B68F]/20">
          {/* Imagem de Fundo da Loja (Fachada Manos Veículos) com Gradiente Marrom */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
              src="/capa-manos.jpg" 
              alt="Fachada Manos Veículos" 
              className="w-full h-full object-cover opacity-55 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#3B2016]/95 via-[#3B2016]/75 to-[#3B2016]/45" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#3B2016]/90 via-transparent to-[#3B2016]/30" />
          </div>

          <div className="relative z-10 max-w-3xl space-y-6">
            
            {/* Consultor Header */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-[#2E1810] border-2 border-[#E0B68F] flex items-center justify-center">
                  <Bot className="w-7 h-7 text-[#E0B68F]" />
                </div>
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#3B2016] rounded-full animate-pulse" />
              </div>
              <div>
                <span className="font-serif font-bold text-sm text-white">Consultor Manos</span>
                <p className="text-xs text-[#F6DCC8] font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Responde na hora · Atendimento em Rio do Sul
                </p>
              </div>
            </div>

            {/* Title in Bitter */}
            <div className="space-y-2">
              <h1 className="font-serif font-extrabold text-2xl sm:text-4xl lg:text-5xl text-white leading-tight">
                Diz do que você precisa. <span className="text-[#E0B68F]">Eu acho no pátio.</span>
              </h1>
              <p className="text-sm sm:text-base text-[#F6DCC8]/90 max-w-xl">
                Descreva em linguagem comum: valor de parcela, carro pra família, econômico ou veículo para troca.
              </p>
            </div>

            {/* Conversational Input */}
            <form onSubmit={(e) => { e.preventDefault(); handleOpenConsultor(); }} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ex: SUV automático até 90 mil, ou parcela de 800..."
                  value={consultorPrompt}
                  onChange={(e) => setConsultorPrompt(e.target.value)}
                  className="w-full px-5 py-4 text-sm rounded-2xl bg-[#2E1810] border border-[#E0B68F]/40 text-white placeholder:text-[#F6DCC8]/50 focus:outline-hidden focus:border-[#E0B68F] transition-all"
                />
              </div>
              <button
                type="submit"
                className="py-4 px-6 bg-[#7A2E1E] hover:bg-[#622316] text-[#FDF3E7] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg min-h-[52px]"
              >
                <span>Achar Carro</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-[#F6DCC8]/70 font-semibold mr-1">Sugestões rápidas:</span>
              {[
                'Econômico pra família',
                'Cabe na parcela de 900',
                'Quero trocar o meu',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleOpenConsultor(chip)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#2E1810] border border-[#E0B68F]/30 hover:border-[#E0B68F] text-[#FDF3E7] hover:text-white rounded-full transition-all active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>

          </div>
        </section>

        {/* 2. BUSCA POR TEXTO + 4 ATALHOS DE FAIXA */}
        <section className="space-y-4">
          <form onSubmit={handleBuscar} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-[#7D6250] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por modelo, marca ou versão (ex: T-Cross, Onix, Hilux)..."
                value={buscaEstoque}
                onChange={(e) => setBuscaEstoque(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 text-sm rounded-2xl bg-white border border-[#EEDFCF] text-[#3B2016] placeholder:text-[#7D6250] focus:outline-hidden focus:border-[#7A2E1E]"
              />
            </div>
            <button
              type="submit"
              className="py-3.5 px-6 bg-[#7A2E1E] hover:bg-[#622316] text-[#FDF3E7] font-bold text-sm rounded-2xl transition-all"
            >
              Buscar
            </button>
          </form>

          {/* 4 Atalhos de Faixa */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { rotulo: 'Até R$ 50 mil', url: '/estoque?faixa=ate-50k' },
              { rotulo: 'R$ 50–100 mil', url: '/estoque?faixa=50k-100k' },
              { rotulo: 'SUVs', url: '/estoque?carroceria=suv' },
              { rotulo: 'Motos', url: '/estoque?carroceria=moto' },
            ].map((at) => (
              <a
                key={at.rotulo}
                href={at.url}
                className="p-3.5 bg-[#F4E6D7] hover:bg-[#EEDFCF] text-[#3B2016] font-bold text-xs sm:text-sm rounded-xl text-center border border-[#EEDFCF] transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
              >
                <span>{at.rotulo}</span>
                <ChevronRight className="w-4 h-4 text-[#7A2E1E]" />
              </a>
            ))}
          </div>
        </section>

        {/* 3. TRÊS PORTAS DE SERVIÇO (bg-areia) */}
        <section className="space-y-4">
          <h2 className="font-serif font-extrabold text-xl sm:text-2xl text-[#3B2016]">
            O que você precisa fazer hoje?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Vender à vista */}
            <a
              href="/vender-meu-carro"
              className="p-6 bg-[#F4E6D7] hover:bg-[#EEDFCF] border border-[#EEDFCF] rounded-2xl space-y-3 transition-all group shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#7A2E1E]/10 text-[#7A2E1E] flex items-center justify-center font-bold">
                  <DollarSign className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-[#3B2016] group-hover:text-[#7A2E1E] transition-colors">
                  Vender à vista
                </h3>
                <p className="text-xs text-[#7D6250]">
                  Receba o dinheiro direto na conta no Pix no mesmo dia da avaliação.
                </p>
              </div>
              <div className="text-xs font-bold text-[#7A2E1E] flex items-center gap-1 pt-2">
                <span>Quero vender meu carro</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Consignar */}
            <a
              href="/consignacao"
              className="p-6 bg-[#F4E6D7] hover:bg-[#EEDFCF] border border-[#EEDFCF] rounded-2xl space-y-3 transition-all group shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#7A2E1E]/10 text-[#7A2E1E] flex items-center justify-center font-bold">
                  <Handshake className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-[#3B2016] group-hover:text-[#7A2E1E] transition-colors">
                  Consignar
                </h3>
                <p className="text-xs text-[#7D6250]">
                  A gente vende pra você pelo valor máximo sem você se preocupar com visitas.
                </p>
              </div>
              <div className="text-xs font-bold text-[#7A2E1E] flex items-center gap-1 pt-2">
                <span>Conhecer a consignação</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Financiar */}
            <a
              href="/financiamento"
              className="p-6 bg-[#F4E6D7] hover:bg-[#EEDFCF] border border-[#EEDFCF] rounded-2xl space-y-3 transition-all group shadow-2xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#7A2E1E]/10 text-[#7A2E1E] flex items-center justify-center font-bold">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-bold text-lg text-[#3B2016] group-hover:text-[#7A2E1E] transition-colors">
                  Financiar
                </h3>
                <p className="text-xs text-[#7D6250]">
                  Simule entrada, prazo e parcela nas melhores taxas bancárias do mercado.
                </p>
              </div>
              <div className="text-xs font-bold text-[#7A2E1E] flex items-center gap-1 pt-2">
                <span>Simular parcelas</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

          </div>
        </section>

        {/* 4. ESCOLHIDOS DA SEMANA (3 veículos horizontais) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-extrabold text-xl sm:text-2xl text-[#3B2016]">
              Escolhidos da semana
            </h2>
            <a
              href="/estoque"
              className="text-xs font-bold text-[#7A2E1E] hover:underline flex items-center gap-1"
            >
              <span>Ver todo o estoque</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-[#7D6250]">Carregando destaques do estoque...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {escolhidos.map((v) => (
                <a
                  key={v.id}
                  href={v.link}
                  className="flex bg-white rounded-2xl border border-[#EEDFCF] overflow-hidden hover:border-[#7A2E1E] transition-all group shadow-2xs"
                >
                  <img
                    src={v.image}
                    alt={v.description}
                    className="w-[104px] h-[104px] object-cover bg-[#F4E6D7] flex-shrink-0"
                  />
                  <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
                    <div>
                      <h3 className="font-serif font-bold text-sm text-[#3B2016] truncate group-hover:text-[#7A2E1E]">
                        {v.description}
                      </h3>
                      <p className="text-[11px] text-[#7D6250]">
                        {v.year} · {v.km}
                      </p>
                    </div>
                    <div className="text-base font-extrabold text-[#7A2E1E]">
                      {v.priceFormatted}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          <div className="text-center pt-2">
            <a
              href="/estoque"
              className="inline-flex items-center gap-2 py-3 px-6 bg-[#7A2E1E] hover:bg-[#622316] text-[#FDF3E7] font-bold text-sm rounded-2xl transition-all"
            >
              <span>Ver estoque completo</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>

        {/* 4B. ESTOQUE COMPLETO NA HOME */}
        <section className="space-y-6 pt-4 border-t border-[#EEDFCF]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#3B2016]">
                Nosso Estoque no Pátio
              </h2>
              <p className="text-xs sm:text-sm text-[#7D6250]">
                Seminovos revisados com garantia e procedência em Rio do Sul
              </p>
            </div>
            <a
              href="/estoque"
              className="text-xs font-bold text-[#7A2E1E] hover:underline flex items-center gap-1"
            >
              <span>Ir para a página de estoque</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {!loading && stock.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stock.slice(0, 9).map((v) => (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-[#EEDFCF] overflow-hidden hover:border-[#7A2E1E] transition-all group flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <a href={v.link} className="block relative aspect-4/3 overflow-hidden bg-[#F4E6D7]">
                      <img
                        src={v.image}
                        alt={v.description}
                        className="w-full h-[200px] object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-3 right-3 px-2.5 py-1 bg-[#3B2016]/80 backdrop-blur-xs text-[#FDF3E7] text-[10px] font-extrabold uppercase rounded-lg">
                        Revisado
                      </span>
                    </a>

                    <div className="p-4 space-y-2">
                      <h3 className="font-serif font-bold text-base text-[#3B2016] group-hover:text-[#7A2E1E] transition-colors leading-snug">
                        <a href={v.link}>{v.description}</a>
                      </h3>
                      
                      <p className="text-xs text-[#7D6250] font-medium">
                        {v.year} · {v.km}
                      </p>

                      <div className="pt-2 border-t border-[#EEDFCF]">
                        <span className="text-[10px] uppercase font-bold text-[#7D6250] block">Preço à vista</span>
                        <span className="text-2xl font-extrabold text-[#7A2E1E] leading-none block">
                          {v.priceFormatted}
                        </span>
                        <span className="text-[11px] text-[#7D6250] block pt-1">
                          Aceita troca e financia
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <a
                      href={waLink(`Olá! Vi o ${v.description} (${v.priceFormatted}) na home e gostaria de atendimento.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track('whatsapp_click', { pagina: '/', vehicleId: v.id })}
                      className="w-full py-3 bg-[#7A2E1E] hover:bg-[#622316] text-[#FDF3E7] font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs min-h-[44px]"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span>Falar com Consultor</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {stock.length > 9 && (
            <div className="text-center pt-4">
              <a
                href="/estoque"
                className="inline-flex items-center gap-2 py-4 px-8 bg-[#3B2016] hover:bg-[#2E1810] text-[#FDF3E7] font-extrabold text-sm rounded-2xl transition-all shadow-lg"
              >
                <span>Ver todo o estoque</span>
                <ArrowRight className="w-5 h-5 text-[#E0B68F]" />
              </a>
            </div>
          )}
        </section>

        {/* 5. COMPRAMOS O SEU CARRO (bg-areia) */}
        <section className="bg-[#F4E6D7] border border-[#EEDFCF] rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="font-serif font-extrabold text-xl sm:text-2xl text-[#3B2016]">
              Compramos o seu carro à vista
            </h2>
            <p className="text-xs sm:text-sm text-[#7D6250]">
              Avaliação justa sem você sair de casa. Dinheiro na conta no Pix e documento por nossa conta.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { num: '1', titulo: 'Digite a placa', desc: 'Preencha a placa do seu veículo no site' },
              { num: '2', titulo: 'Avaliação online', desc: 'Receba a estimativa de compra no mesmo dia' },
              { num: '3', titulo: 'Pix na conta', desc: 'Receba antes de entregar o carro na loja' },
            ].map((st) => (
              <div key={st.num} className="bg-white/80 p-4 rounded-2xl border border-[#EEDFCF] space-y-1.5">
                <span className="w-7 h-7 rounded-full bg-[#7A2E1E] text-[#FDF3E7] font-bold text-xs flex items-center justify-center">
                  {st.num}
                </span>
                <h3 className="font-serif font-bold text-sm text-[#3B2016]">{st.titulo}</h3>
                <p className="text-xs text-[#7D6250]">{st.desc}</p>
              </div>
            ))}
          </div>

          <a
            href="/vender-meu-carro"
            className="inline-flex items-center gap-2 py-3.5 px-6 bg-[#7A2E1E] hover:bg-[#622316] text-[#FDF3E7] font-bold text-sm rounded-2xl transition-all"
          >
            <span>Quero uma avaliação</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </section>

        {/* 6. QUATRO DIFERENCIAIS */}
        <section className="space-y-4">
          <h2 className="font-serif font-extrabold text-xl sm:text-2xl text-[#3B2016]">
            Por que escolher a Manos Veículos?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Loja Física em Rio do Sul',
                desc: 'Localizada na R. Dom Pedro II, 374 - Canoas.',
              },
              {
                title: 'Estoque 100% Revisado',
                desc: 'Todos os carros passam por vistoria técnica rigorosa.',
              },
              {
                title: 'Financiamento Facilitado',
                desc: 'Parceria com os principais bancos para a melhor parcela.',
              },
              {
                title: 'Atendimento com Hora Marcada',
                desc: 'Com hora marcada, abrimos qualquer dia da semana, inclusive fora do expediente.',
              },
            ].map((dif, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-[#EEDFCF] space-y-2">
                <CheckCircle2 className="w-6 h-6 text-[#7A2E1E]" />
                <h3 className="font-serif font-bold text-sm text-[#3B2016]">{dif.title}</h3>
                <p className="text-xs text-[#7D6250] leading-relaxed">{dif.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 7. PROVA SOCIAL (bg-marrom luxo com alto contraste) */}
        <section className="bg-gradient-to-br from-[#2E1810] via-[#3B2016] to-[#2E1810] text-[#FDF3E7] rounded-3xl p-6 sm:p-10 space-y-6 relative overflow-hidden border border-[#E0B68F]/30 shadow-2xl">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img 
              src="/capa-manos.jpg" 
              alt="Fachada Manos Veículos" 
              className="w-full h-full object-cover opacity-35 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2E1810]/95 via-[#3B2016]/85 to-[#2E1810]/75" />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-extrabold bg-[#E0B68F]/20 text-[#E0B68F] border border-[#E0B68F]/30 tracking-wider uppercase">
              <Award className="w-3.5 h-3.5 text-[#E0B68F]" />
              <span>Transparência & Reputação</span>
            </div>
            <h2 className="font-serif font-extrabold text-2xl sm:text-3xl text-white tracking-tight drop-shadow-md">
              Quem já comprou aqui conta
            </h2>
            <p className="text-xs sm:text-sm text-[#F6DCC8] max-w-2xl leading-relaxed">
              Transparência total e reputação confirmada por nossos clientes em Rio do Sul e todo o Alto Vale.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
            
            {/* Card 1: Google Avaliações */}
            <a
              href={SOCIAL.google}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#3B2016] p-6 rounded-2xl border border-[#EEDFCF] hover:border-[#7A2E1E] transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true" className="flex-shrink-0">
                      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4z"></path>
                      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.3 15.4 46 24 46z"></path>
                      <path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.2-2.9.7-4.3v-5.7H4.5C2.9 17.2 2 20.5 2 24s.9 6.8 2.5 10l7.3-5.7z"></path>
                      <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.7 4.5 13.7l7.3 5.7c1.7-5.2 6.5-8.7 12.2-8.7z"></path>
                    </svg>
                    <span className="text-amber-400 text-base font-extrabold tracking-wider">
                      ★★★★★
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#7D6250] group-hover:text-[#7A2E1E] transition-colors" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#3B2016] group-hover:text-[#7A2E1E] transition-colors">
                    Google Avaliações
                  </h3>
                  <p className="text-xs text-[#7D6250] leading-relaxed mt-1">
                    Reputação máxima confirmada por avaliações reais de clientes satisfeitos.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-[#F4E6D7] flex items-center justify-between text-[11px] font-bold text-[#7A2E1E]">
                <span>Ver avaliações no Google</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Card 2: Reclame AQUI */}
            <a
              href={SOCIAL.reclameAqui}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#3B2016] p-6 rounded-2xl border border-[#EEDFCF] hover:border-[#7A2E1E] transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#007535] text-white font-extrabold text-[11px] flex items-center justify-center shadow-xs">
                      RA
                    </span>
                    <span className="font-extrabold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verificada 100%
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#7D6250] group-hover:text-[#7A2E1E] transition-colors" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#3B2016] group-hover:text-[#7A2E1E] transition-colors">
                    Reclame AQUI
                  </h3>
                  <p className="text-xs text-[#7D6250] leading-relaxed mt-1">
                    Empresa totalmente auditada e sem pendências. Compra segura garantida.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-[#F4E6D7] flex items-center justify-between text-[11px] font-bold text-[#7A2E1E]">
                <span>Conferir no Reclame AQUI</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Card 3: Instagram Oficial */}
            <a
              href={SOCIAL.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#3B2016] p-6 rounded-2xl border border-[#EEDFCF] hover:border-[#7A2E1E] transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center shadow-xs" style={{ background: 'linear-gradient(45deg, #F9CE34 0%, #EE2A7B 50%, #6228D7 100%)' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.2" cy="6.8" r="1.1" fill="#FFFFFF" stroke="none"></circle></svg>
                    </span>
                    <span className="font-extrabold text-xs text-[#7A2E1E]">@manoveiculoss</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#7D6250] group-hover:text-[#7A2E1E] transition-colors" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#3B2016] group-hover:text-[#7A2E1E] transition-colors">
                    Instagram Oficial
                  </h3>
                  <p className="text-xs text-[#7D6250] leading-relaxed mt-1">
                    Fotos diárias de clientes felizes retirando seus carros e novidades do pátio.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-[#F4E6D7] flex items-center justify-between text-[11px] font-bold text-[#7A2E1E]">
                <span>Siga @manoveiculoss</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

          </div>

          {/* Destaques de Confiança Inferior */}
          <div className="relative z-10 pt-4 border-t border-[#E0B68F]/20 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-[#2E1810]/70 backdrop-blur-xs p-3 rounded-xl border border-[#E0B68F]/20 shadow-xs">
              <span className="block text-xs font-bold text-[#E0B68F]">📍 Rio do Sul/SC</span>
              <span className="text-[10px] text-[#F6DCC8]/80 font-medium">Loja física própria</span>
            </div>
            <div className="bg-[#2E1810]/70 backdrop-blur-xs p-3 rounded-xl border border-[#E0B68F]/20 shadow-xs">
              <span className="block text-xs font-bold text-[#E0B68F]">⭐ Nota 4.9/5</span>
              <span className="text-[10px] text-[#F6DCC8]/80 font-medium">Avaliação pública</span>
            </div>
            <div className="bg-[#2E1810]/70 backdrop-blur-xs p-3 rounded-xl border border-[#E0B68F]/20 shadow-xs">
              <span className="block text-xs font-bold text-[#E0B68F]">🚗 Vistoria Cautelar</span>
              <span className="text-[10px] text-[#F6DCC8]/80 font-medium">Estoque 100% periciado</span>
            </div>
            <div className="bg-[#2E1810]/70 backdrop-blur-xs p-3 rounded-xl border border-[#E0B68F]/20 shadow-xs">
              <span className="block text-xs font-bold text-[#E0B68F]">🤝 Atendimento Válido</span>
              <span className="text-[10px] text-[#F6DCC8]/80 font-medium">Hora marcada disponível</span>
            </div>
          </div>
        </section>

      </div>
    </SiteShell>
  );
}
