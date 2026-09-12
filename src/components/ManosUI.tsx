import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  X, 
  ChevronRight, 
  Phone, 
  ShieldCheck, 
  Star, 
  Building2, 
  MapPin, 
  ArrowRight,
  ExternalLink,
  Lock
} from 'lucide-react';
import { LOJA, CONTATO, SOCIAL, waLink } from '../lib/manos';
import { track } from '../lib/track';

import LGPDBanner from './tools/LGPDBanner';
import ConsultorPanel from './consultor/ConsultorPanel';

export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <img 
      src={LOJA.logoUrl} 
      alt={LOJA.nome} 
      className={`object-contain ${className}`} 
    />
  );
}

export function TopBar({ title, onBack }: { title?: string; onBack?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="p-4 flex items-center justify-between z-30 bg-[#3B2016] text-[#FDF3E7] shadow-md sticky top-0">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button 
              onClick={onBack}
              className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all"
              aria-label="Voltar"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          ) : null}
          <a href="/" className="flex items-center">
            <Logo className="h-8 w-auto" />
          </a>
        </div>

        {title ? (
          <span className="font-serif font-bold text-sm text-[#FDF3E7] truncate max-w-[180px]">
            {title}
          </span>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase font-extrabold tracking-widest text-[#E8C6AC]/70">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span>Rio do Sul/SC</span>
          </div>
        )}

        <button
          onClick={() => setMenuOpen(true)}
          className="p-2.5 rounded-xl bg-manos-red text-manos-accent font-extrabold flex items-center justify-center gap-2 hover:bg-[#8F3725] active:scale-95 transition-all min-h-[44px]"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Drawer Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative w-full max-w-xs bg-[#3B2016] text-[#FDF3E7] h-full flex flex-col justify-between p-6 shadow-2xl overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#EEDFCF]/10 pb-4">
                  <Logo className="h-9 w-auto" />
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all min-h-[44px]"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {[
                    { label: 'Início', href: '/' },
                    { label: 'Estoque', href: '/estoque' },
                    { label: 'Comparar Veículos', href: '/comparar' },
                    { label: 'Financiamento', href: '/financiamento' },
                    { label: 'Vender meu carro', href: '/vender-meu-carro' },
                    { label: 'A Manos', href: '/a-manos' },
                    { label: 'Dúvidas', href: '/duvidas' },
                    { label: 'Contato', href: '/contato' },
                    { label: 'Política de Privacidade', href: '/politica-de-privacidade' },
                  ].map((item) => (
                    <a
                      key={item.href + item.label}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3.5 rounded-xl font-extrabold text-base text-[#FDF3E7] hover:bg-manos-red/20 active:bg-manos-red/40 transition-all min-h-[48px]"
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-[#E8C6AC]/50" />
                    </a>
                  ))}
                </nav>
              </div>

              <div className="pt-6 border-t border-[#EEDFCF]/10 space-y-3">
                <div className="text-[11px] text-[#E8C6AC]/70 font-semibold leading-snug">
                  {LOJA.endereco}<br />
                  {LOJA.horario}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={CONTATO.telefoneLink}
                    onClick={() => track('phone_click', { pagina: 'drawer_menu' })}
                    className="py-3 px-3 rounded-xl bg-white/10 text-white font-extrabold text-xs uppercase flex items-center justify-center gap-2 hover:bg-white/20 min-h-[44px]"
                  >
                    <Phone className="w-4 h-4" />
                    Ligar
                  </a>
                  <a
                    href={waLink('Olá! Vim pelo menu do site e gostaria de atendimento.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track('whatsapp_click', { pagina: 'drawer_menu' })}
                    className="py-3 px-3 rounded-xl bg-manos-red text-manos-accent font-extrabold text-xs uppercase flex items-center justify-center gap-2 hover:bg-[#8F3725] min-h-[44px]"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function TrustCards() {
  return (
    <section className="space-y-3 my-6">
      <div className="p-5 rounded-2xl bg-white border border-[#EEDFCF] shadow-sm flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/15 text-yellow-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
          ★ 4.9
        </div>
        <div>
          <h4 className="font-extrabold text-base text-[#3B2016]">Excelente no Google</h4>
          <p className="text-xs text-[#7D6250] mt-0.5">Reconhecida pelos clientes em Rio do Sul e todo o Alto Vale.</p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-[#EEDFCF] shadow-sm flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-700 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-extrabold text-base text-[#3B2016]">100% Procedência e Vistoria</h4>
          <p className="text-xs text-[#7D6250] mt-0.5">Todos os veículos passam por revisão mecânica detalhada e possuem garantia.</p>
        </div>
      </div>
    </section>
  );
}

export function PrivacyNotice() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[#A88A70] leading-snug">
      <Lock className="w-3.5 h-3.5 flex-shrink-0 text-manos-red" />
      <span>
        Seus dados são protegidos e usados exclusivamente para a simulação/análise. Veja nossa{' '}
        <a href="/politica-de-privacidade" className="underline font-bold text-[#3B2016]">
          Política de Privacidade
        </a>.
      </span>
    </div>
  );
}

export function Footer() {
  return (
    <>
      <footer className="bg-gradient-to-br from-[#2E1810] via-[#3B2016] to-[#2E1810] text-[#F6DCC8] p-6 sm:p-10 rounded-3xl space-y-8 mt-12 border border-[#E0B68F]/20 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Coluna 1: Logo e Dados da Loja */}
          <div className="md:col-span-5 space-y-3.5 text-left">
            <Logo className="h-9 w-auto" />
            <div className="space-y-1.5 text-xs text-[#E8C6AC] leading-relaxed">
              <p className="font-bold text-white text-sm">{LOJA.nome} — {LOJA.subtitulo}</p>
              <p className="flex items-center gap-1.5 text-[#F6DCC8]/90">
                <MapPin className="w-3.5 h-3.5 text-[#E0B68F] flex-shrink-0" />
                <span>{LOJA.endereco}</span>
              </p>
              <p className="flex items-center gap-1.5 text-[#F6DCC8]/90">
                <Phone className="w-3.5 h-3.5 text-[#E0B68F] flex-shrink-0" />
                <span>Telefone / WhatsApp: {CONTATO.telefone}</span>
              </p>
              <p className="pt-1 text-[#F6DCC8]/80">{LOJA.horario}</p>
              <p className="text-emerald-400 font-bold flex items-center gap-1 pt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {LOJA.horarioExtra}
              </p>
            </div>
          </div>

          {/* Coluna 2: Nossos Serviços */}
          <div className="md:col-span-4 space-y-3 text-left">
            <h3 className="font-serif font-extrabold text-xs text-white uppercase tracking-wider border-b border-[#E0B68F]/30 pb-2">
              Nossos Serviços
            </h3>
            <div className="space-y-2 text-xs font-semibold text-[#E8C6AC]">
              <a href="/estoque" className="block hover:text-white hover:translate-x-1 transition-all">
                Estoque Completo
              </a>
              <a href="/vender-meu-carro" className="block hover:text-white hover:translate-x-1 transition-all">
                Vender meu Carro
              </a>
              <a href="/consignacao" className="block text-[#E0B68F] font-bold hover:text-white hover:translate-x-1 transition-all flex items-center gap-1">
                Consignar Veículo <span className="text-[9px] bg-[#E0B68F]/20 text-[#E0B68F] px-1.5 py-0.5 rounded-md uppercase">Novo</span>
              </a>
              <a href="/financiamento" className="block hover:text-white hover:translate-x-1 transition-all">
                Simular Financiamento
              </a>
              <a href="/comparar" className="block hover:text-white hover:translate-x-1 transition-all">
                Comparar Veículos
              </a>
            </div>
          </div>

          {/* Coluna 3: Institucional */}
          <div className="md:col-span-3 space-y-3 text-left">
            <h3 className="font-serif font-extrabold text-xs text-white uppercase tracking-wider border-b border-[#E0B68F]/30 pb-2">
              Institucional
            </h3>
            <div className="space-y-2 text-xs font-semibold text-[#E8C6AC]">
              <a href="/a-manos" className="block hover:text-white hover:translate-x-1 transition-all">A Manos Veículos</a>
              <a href="/duvidas" className="block hover:text-white hover:translate-x-1 transition-all">Dúvidas Frequentes</a>
              <a href="/contato" className="block hover:text-white hover:translate-x-1 transition-all">Fale Conosco</a>
              <a href="/politica-de-privacidade" className="block hover:text-white hover:translate-x-1 transition-all text-[#F6DCC8]/70">Política de Privacidade</a>
            </div>
          </div>

        </div>

        {/* Linha de Ações e Redes */}
        <div className="pt-5 border-t border-[#E0B68F]/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={LOJA.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#E0B68F] hover:bg-[#d5a77e] text-[#2E1810] text-xs font-extrabold shadow-md transition-all active:scale-95 min-h-[42px]"
            >
              <MapPin className="w-3.5 h-3.5 text-[#2E1810]" />
              Como Chegar
            </a>
            <a
              href={SOCIAL.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-10 px-3.5 rounded-xl border border-[rgba(246,220,200,0.35)] hover:border-white text-[#F6DCC8] hover:text-white text-xs font-bold transition-all min-h-[42px]"
            >
              Instagram
            </a>
            <a
              href={SOCIAL.google}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-10 px-3.5 rounded-xl border border-[rgba(246,220,200,0.35)] hover:border-white text-[#F6DCC8] hover:text-white text-xs font-bold transition-all min-h-[42px]"
            >
              Google Avaliações ★★★★★
            </a>
          </div>

          <p className="text-[11px] text-[#F6DCC8]/60 font-medium">
            © {new Date().getFullYear()} Manos Veículos. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <LGPDBanner />
    </>
  );
}

export function StickyBar({ 
  variant = 'default',
  vehicleSlug,
  priceFormatted
}: { 
  variant?: 'default' | 'estoque' | 'veiculo' | 'financiamento' | 'vender' | 'consignar' | 'vendas';
  vehicleSlug?: string;
  priceFormatted?: string;
}) {
  if (variant === 'financiamento' || variant === 'vendas' || variant === 'vender' || variant === 'consignar') {
    return (
      <div className="sticky-footer">
        <div className="grid grid-cols-2 gap-3 max-w-[500px] mx-auto">
          <a
            href={CONTATO.telefoneLink}
            onClick={() => track('phone_click', { pagina: window.location.pathname })}
            className="py-4 bg-manos-warm border border-manos-sand text-[#3B2016] font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px]"
          >
            <Phone className="w-4 h-4 text-manos-red" />
            Ligar
          </a>
          <a
            href={waLink('Olá! Tenho dúvidas sobre ' + (variant === 'financiamento' ? 'financiamento' : 'avaliação de veículo'))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { pagina: window.location.pathname })}
            className="py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px] shadow-md"
          >
            WhatsApp
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'veiculo') {
    return (
      <div className="sticky-footer">
        <div className="flex items-center justify-between gap-3 max-w-[500px] mx-auto">
          {priceFormatted && (
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase text-[#7D6250] block">Valor à vista</span>
              <span className="text-manos-red font-extrabold text-lg leading-none">{priceFormatted}</span>
            </div>
          )}
          <a
            href={`/financiamento?veiculo=${vehicleSlug || ''}`}
            className="py-3.5 px-4 bg-manos-warm border border-manos-sand text-[#3B2016] font-extrabold text-xs uppercase rounded-2xl min-h-[48px] flex items-center justify-center"
          >
            Simular
          </a>
          <a
            href={waLink(`Olá! Tenho interesse no veículo (${vehicleSlug || ''})`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { pagina: window.location.pathname, vehicleSlug })}
            className="flex-1 py-3.5 px-4 bg-manos-red text-manos-accent font-extrabold text-xs uppercase rounded-2xl flex items-center justify-center gap-2 shadow-md min-h-[48px]"
          >
            Tenho Interesse
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky-footer">
      <div className="grid grid-cols-2 gap-3 max-w-[500px] mx-auto">
        <a
          href="/"
          className="py-4 bg-manos-warm border border-manos-sand text-[#3B2016] font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px]"
        >
          Ver Estoque
        </a>
        <a
          href={waLink()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('whatsapp_click', { pagina: window.location.pathname })}
          className="py-4 bg-manos-red text-manos-accent font-extrabold text-sm uppercase rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px] shadow-md"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}

export function SiteShell({ 
  children, 
  title, 
  onBack, 
  variant = 'default', 
  vehicleSlug, 
  priceFormatted,
  showTrustCards = false
}: { 
  children: React.ReactNode; 
  title?: string; 
  onBack?: () => void; 
  variant?: 'default' | 'estoque' | 'veiculo' | 'financiamento' | 'vender' | 'consignar' | 'vendas'; 
  vehicleSlug?: string; 
  priceFormatted?: string;
  showTrustCards?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#FDF8F1] text-[#3B2016] font-sans flex flex-col justify-between relative overflow-x-hidden">
      <div className="flex-1">
        <TopBar title={title} onBack={onBack} />
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-12 w-full">
          {children}
        </main>
      </div>
      <div className="relative pb-20 lg:pb-0">
        {showTrustCards && <TrustCards />}
        <Footer />
        <StickyBar variant={variant} vehicleSlug={vehicleSlug} priceFormatted={priceFormatted} />
        <ConsultorPanel />
        <LGPDBanner />
      </div>
    </div>
  );
}
