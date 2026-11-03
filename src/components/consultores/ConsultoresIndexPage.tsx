import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Phone,
  ArrowRight,
  Copy,
  Check,
  Car,
  Sparkles,
} from 'lucide-react';
import {
  LISTA_CONSULTORES_OFICIAIS,
  gerarLinkWhatsAppConsultor,
  type ConsultorProfile,
} from '../../lib/consultores';

const LOGO_MANOS = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default function ConsultoresIndexPage() {
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    const oldTitle = document.title;
    document.title = 'Consultores Oficiais | Manos Veículos';
    return () => {
      document.title = oldTitle;
    };
  }, []);

  const copiarLinkConsultor = async (c: ConsultorProfile) => {
    const url = `${window.location.origin}/consultor/${c.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(c.slug);
      setTimeout(() => setCopiedSlug(null), 2500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans antialiased selection:bg-[#E50914] selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <a href="/consultores" className="flex items-center gap-3">
            <img src={LOGO_MANOS} alt="Manos Veículos" className="h-10 w-auto object-contain" />
          </a>

          <a
            href="/estoque"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold uppercase tracking-wider text-zinc-200 transition-colors"
          >
            <Car className="w-4 h-4 text-[#E50914]" />
            <span>Estoque Geral</span>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-white/10 bg-gradient-to-b from-[#161215] to-[#0A0A0B] py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-extrabold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Equipe Oficial Manos Veículos</span>
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Escolha seu <span className="text-[#E50914]">Consultor Exclusivo</span>
          </h1>
          <p className="text-zinc-300 text-sm sm:text-lg max-w-2xl leading-relaxed">
            Cada consultor possui sua página exclusiva integrada em tempo real com todo o nosso
            estoque. Acesse a página do seu consultor ou copie o link individual para campanhas e
            atendimento.
          </p>
        </div>
      </section>

      {/* Grid de Consultores */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {LISTA_CONSULTORES_OFICIAIS.map((c) => {
            const hrefConsultor = `/consultor/${c.slug}`;
            const hrefCurto = `/${c.slug}`;
            const waHref = gerarLinkWhatsAppConsultor(c, null, 'geral');
            const isCopied = copiedSlug === c.slug;

            return (
              <article
                key={c.slug}
                className="rounded-3xl bg-[#121216] border border-white/10 hover:border-[#E50914]/50 overflow-hidden flex flex-col justify-between shadow-2xl transition-all group"
              >
                <div>
                  <a
                    href={hrefConsultor}
                    className="block relative aspect-4/4 bg-[#18181F] overflow-hidden"
                  >
                    <img
                      src={c.foto}
                      alt={c.nomeExibicao}
                      className={`w-full h-full object-cover ${
                        c.fotoPosicao || 'object-top'
                      } group-hover:scale-105 transition-transform duration-500`}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#121216] to-transparent" />

                    <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-[11px] font-extrabold text-white">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
                      <span>Consultor Oficial</span>
                    </div>

                    <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/40 text-[10px] font-extrabold text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Online</span>
                    </div>
                  </a>

                  <div className="p-6 space-y-3">
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E50914]">
                        Manos Veículos
                      </span>
                      <h2 className="text-2xl font-black text-white mt-0.5">
                        <a href={hrefConsultor} className="hover:text-[#E50914] transition-colors">
                          {c.nomeExibicao}
                        </a>
                      </h2>
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-300 mt-1">
                        <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                        <span>{c.telefoneFormatado}</span>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0A0A0B] border border-white/10 flex items-center justify-between gap-2 text-xs">
                      <span className="text-zinc-400 truncate font-mono">
                        /consultor/{c.slug} <span className="text-zinc-600">ou</span> {hrefCurto}
                      </span>
                      <button
                        type="button"
                        onClick={() => copiarLinkConsultor(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white flex-shrink-0 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 grid grid-cols-2 gap-2.5">
                  <a
                    href={hrefConsultor}
                    className="py-3.5 px-4 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Abrir Página</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-[#0A0A0B]" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
