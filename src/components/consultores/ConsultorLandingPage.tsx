import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Search,
  Calendar,
  Gauge,
  Settings2,
  ArrowRight,
  Car,
  ShieldCheck,
  CheckCircle2,
  Share2,
  Check,
  Calculator,
  ArrowRightLeft,
  Phone,
  Sparkles,
  Camera,
} from 'lucide-react';
import { fetchStock, type Vehicle } from '../../services/stockService';
import { fetchConfigOfertas, inicializarPixelsConfiguradosOfertas } from '../../services/ofertasService';
import { calcParcela, brl } from '../../lib/manos';
import {
  obterConsultorPorSlug,
  gerarLinkWhatsAppConsultor,
  registrarConversaoConsultor,
  CONSULTORES,
  type ConsultorProfile,
} from '../../lib/consultores';

const LOGO_MANOS = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';

const FAIXAS_PRECO = [
  { id: 'todos', label: 'Todos os preços', min: 0, max: Infinity },
  { id: 'ate-60k', label: 'Até R$ 60 mil', min: 0, max: 60000 },
  { id: '60k-100k', label: 'R$ 60 a 100 mil', min: 60000, max: 100000 },
  { id: '100k-150k', label: 'R$ 100 a 150 mil', min: 100000, max: 150000 },
  { id: 'acima-150k', label: 'Acima de R$ 150 mil', min: 150000, max: Infinity },
];

const ORDENACOES = [
  { id: 'recentes', label: 'Mais recentes' },
  { id: 'menor-preco', label: 'Menor preço' },
  { id: 'maior-preco', label: 'Maior preço' },
  { id: 'menor-km', label: 'Menor quilometragem' },
];

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function aplicarSeoConsultor(consultor: ConsultorProfile): () => void {
  const tituloOriginal = document.title;
  const pageTitle = `${consultor.nomeExibicao} (${consultor.telefoneFormatado}) — Estoque Completo | Manos Veículos`;
  const pageDesc = `Fale diretamente com o ${consultor.nomeExibicao} pelo WhatsApp ${consultor.telefoneFormatado}. Confira todo o estoque de seminovos revisados da Manos Veículos com avaliação de troca e financiamento na hora.`;
  const canonicalUrl = `${window.location.origin}/${consultor.slug}`;
  const ogImg = `${window.location.origin}${consultor.foto}`;

  document.title = pageTitle;

  const setMeta = (selector: string, attrName: 'name' | 'property', attrVal: string, content: string) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('meta[name="description"]', 'name', 'description', pageDesc);
  setMeta('meta[name="theme-color"]', 'name', 'theme-color', '#0A0A0B');
  setMeta('meta[property="og:title"]', 'property', 'og:title', pageTitle);
  setMeta('meta[property="og:description"]', 'property', 'og:description', pageDesc);
  setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  setMeta('meta[property="og:image"]', 'property', 'og:image', ogImg);
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'profile');
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', pageDesc);
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', ogImg);

  return () => {
    document.title = tituloOriginal;
  };
}

interface ConsultorLandingPageProps {
  consultorSlug: string;
}

export default function ConsultorLandingPage({ consultorSlug }: ConsultorLandingPageProps) {
  const consultor = obterConsultorPorSlug(consultorSlug) || CONSULTORES.wilsinho;

  const [stock, setStock] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [marcaSelecionada, setMarcaSelecionada] = useState('todas');
  const [faixaSelecionada, setFaixaSelecionada] = useState('todos');
  const [ordem, setOrdem] = useState('recentes');
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    const cleanupSeo = aplicarSeoConsultor(consultor);

    Promise.all([fetchStock(), fetchConfigOfertas().catch(() => null)])
      .then(([veiculosEstoque, cfg]) => {
        if (cfg) {
          inicializarPixelsConfiguradosOfertas(cfg);
        }
        setStock(veiculosEstoque);
        setLoading(false);
        registrarConversaoConsultor(consultor, 'PageView', null);
      })
      .catch(() => {
        setLoading(false);
      });

    return cleanupSeo;
  }, [consultor]);

  // Extrai marcas distintas com contagem de veículos
  const marcasComContagem = useMemo(() => {
    const mapa = new Map<string, number>();
    stock.forEach((v) => {
      const rawBrand = (v.brand || v.description.split(' ')[0] || '').trim().toUpperCase();
      if (!rawBrand) return;
      mapa.set(rawBrand, (mapa.get(rawBrand) || 0) + 1);
    });
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [stock]);

  // Filtra e ordena o estoque total
  const veiculosFiltrados = useMemo(() => {
    let lista = [...stock];

    // Filtro por texto
    const termo = busca.trim().toLowerCase();
    if (termo) {
      lista = lista.filter(
        (v) =>
          v.description.toLowerCase().includes(termo) ||
          (v.brand && v.brand.toLowerCase().includes(termo)) ||
          v.year.toLowerCase().includes(termo) ||
          (v.color && v.color.toLowerCase().includes(termo)),
      );
    }

    // Filtro por marca
    if (marcaSelecionada !== 'todas') {
      lista = lista.filter((v) => {
        const b = (v.brand || v.description.split(' ')[0] || '').trim().toUpperCase();
        return b === marcaSelecionada;
      });
    }

    // Filtro por faixa de preço
    const faixaObj = FAIXAS_PRECO.find((f) => f.id === faixaSelecionada);
    if (faixaObj && faixaObj.id !== 'todos') {
      lista = lista.filter((v) => v.price >= faixaObj.min && v.price <= faixaObj.max);
    }

    // Ordenação
    if (ordem === 'menor-preco') {
      lista.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
    } else if (ordem === 'maior-preco') {
      lista.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (ordem === 'menor-km') {
      lista.sort(
        (a, b) =>
          (parseInt(a.km.replace(/\D/g, ''), 10) || 0) -
          (parseInt(b.km.replace(/\D/g, ''), 10) || 0),
      );
    } else {
      lista.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }

    return lista;
  }, [stock, busca, marcaSelecionada, faixaSelecionada, ordem]);

  const buildVeiculoConsultorHref = (veiculoSlug: string): string => {
    const search = window.location.search;
    return `/${consultor.slug}/${veiculoSlug}${search || ''}`;
  };

  const handleWhatsAppClick = (veiculo?: Vehicle | null) => {
    registrarConversaoConsultor(consultor, 'Contact', veiculo || null);
    registrarConversaoConsultor(consultor, 'WhatsAppClick', veiculo || null);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/${consultor.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${consultor.nomeExibicao} — Estoque Manos Veículos`,
          text: `Confira o estoque completo da Manos Veículos e fale direto com o ${consultor.nomeExibicao} (${consultor.telefoneFormatado})`,
          url: shareUrl,
        });
        return;
      } catch {
        /* fallback clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      /* noop */
    }
  };

  const linkWhatsAppGeral = gerarLinkWhatsAppConsultor(consultor, null, 'geral');
  const linkWhatsAppTroca = gerarLinkWhatsAppConsultor(consultor, null, 'troca');
  const linkWhatsAppFinanciamento = gerarLinkWhatsAppConsultor(consultor, null, 'financiamento');

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans antialiased selection:bg-[#E50914] selection:text-white pb-28 lg:pb-16">
      {/* =====================================================================
          HEADER OFICIAL COM IDENTIFICAÇÃO DO CONSULTOR
         ===================================================================== */}
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
          <a href={`/${consultor.slug}`} className="flex items-center gap-3 flex-shrink-0">
            <img src={LOGO_MANOS} alt="Manos Veículos" className="h-9 sm:h-11 w-auto object-contain" />
            <div className="hidden md:flex items-center gap-2.5 pl-3 border-l border-white/15">
              <img
                src={consultor.foto}
                alt={consultor.nomeExibicao}
                className="w-9 h-9 rounded-full object-cover object-top border border-[#E50914]"
              />
              <div className="leading-tight">
                <span className="block text-xs font-extrabold text-white">{consultor.nomeExibicao}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online • {consultor.telefoneFormatado}
                </span>
              </div>
            </div>
          </a>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
              title="Compartilhar página do consultor"
            >
              {copiedShare ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Link copiado</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-zinc-300" />
                  <span className="hidden sm:inline">Compartilhar</span>
                </>
              )}
            </button>

            <a
              href={linkWhatsAppGeral}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleWhatsAppClick(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] font-black text-xs uppercase tracking-wider transition-all shadow-[0_6px_20px_rgba(37,211,102,0.25)]"
            >
              <WhatsAppIcon className="w-4 h-4 text-[#0A0A0B]" />
              <span>Falar com {consultor.nome}</span>
            </a>
          </div>
        </div>
      </header>

      {/* =====================================================================
          HERO SECTION — APRESENTAÇÃO PESSOAL E CREDIBILIDADE DO CONSULTOR
         ===================================================================== */}
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-[#161215] via-[#0E0E12] to-[#0A0A0B] py-8 sm:py-14 px-4 sm:px-6">
        {/* Glow de fundo sutil */}
        <div
          className="pointer-events-none absolute -top-24 right-1/4 w-96 h-96 rounded-full bg-[#E50914]/12 blur-3xl"
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Coluna da Foto do Consultor (Destaque de Credibilidade) */}
          <div className="lg:col-span-5 order-1">
            <div className="relative mx-auto max-w-sm lg:max-w-none">
              <div className="relative aspect-4/5 rounded-3xl overflow-hidden bg-[#141418] border-2 border-[#E50914]/50 shadow-[0_20px_60px_rgba(229,9,20,0.22)]">
                <img
                  src={consultor.foto}
                  alt={`${consultor.nomeExibicao} — Manos Veículos`}
                  // @ts-ignore
                  fetchpriority="high"
                  loading="eager"
                  className="w-full h-full object-cover object-top"
                />

                {/* Gradiente inferior para leitura do crachá */}
                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

                {/* Badge Superior: Consultor Verificado */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-[11px] font-extrabold text-white shadow-lg">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
                    <span>Consultor Oficial</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/40 text-[11px] font-extrabold text-emerald-300 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Online Agora</span>
                  </span>
                </div>

                {/* Crachá Inferior sobre a foto */}
                <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-[#121216]/90 backdrop-blur-md border border-white/15 flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#E50914]">
                      Atendimento Direto
                    </span>
                    <strong className="block text-lg sm:text-xl font-black text-white leading-tight">
                      {consultor.nomeExibicao}
                    </strong>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-300 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                      {consultor.telefoneFormatado}
                    </span>
                  </div>

                  <a
                    href={linkWhatsAppGeral}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleWhatsAppClick(null)}
                    className="w-12 h-12 rounded-2xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] flex items-center justify-center flex-shrink-0 shadow-lg transition-transform active:scale-95"
                    aria-label={`Chamar ${consultor.nomeExibicao} no WhatsApp`}
                  >
                    <WhatsAppIcon className="w-6 h-6 text-[#0A0A0B]" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna de Apresentação Comercial + CTAs Rápidos */}
          <div className="lg:col-span-7 order-2 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-extrabold uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Página Exclusiva • Estoque Completo Integrado</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-xs font-bold">
                <MapPin className="w-3.5 h-3.5 text-[#E50914]" />
                <span>{consultor.cidade}</span>
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.1]">
                Compre seu próximo carro direto com o{' '}
                <span className="text-[#E50914]">{consultor.nomeExibicao}</span>
              </h1>
              <p className="text-zinc-300 text-sm sm:text-lg leading-relaxed max-w-2xl">
                {consultor.bioCurta}
              </p>
            </div>

            {/* Destaques de Credibilidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {consultor.destaquesCredibilidade.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-zinc-200">{item}</span>
                </div>
              ))}
            </div>

            {/* Botões de Conversão Direta com o Consultor */}
            <div className="pt-2 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={linkWhatsAppGeral}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleWhatsAppClick(null)}
                  className="flex-1 py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#1fb858] active:scale-[0.99] text-[#0A0A0B] font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_12px_35px_rgba(37,211,102,0.28)] transition-all"
                >
                  <WhatsAppIcon className="w-6 h-6 text-[#0A0A0B]" />
                  <span>Chamar {consultor.nome} no WhatsApp</span>
                </a>

                <a
                  href="#estoque-completo"
                  className="py-4 px-6 rounded-2xl bg-[#E50914] hover:bg-[#c40710] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#E50914]/25"
                >
                  <Car className="w-5 h-5" />
                  <span>Ver Estoque ({stock.length || '...'})</span>
                </a>
              </div>

              {/* Atalhos Rápidos: Troca e Financiamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <a
                  href={linkWhatsAppTroca}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleWhatsAppClick(null)}
                  className="py-3 px-4 rounded-xl bg-[#121216] hover:bg-white/10 border border-white/15 text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4 text-[#E50914]" />
                  <span>Avaliar Meu Usado na Troca</span>
                </a>

                <a
                  href={linkWhatsAppFinanciamento}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleWhatsAppClick(null)}
                  className="py-3 px-4 rounded-xl bg-[#121216] hover:bg-white/10 border border-white/15 text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center justify-center gap-2 transition-colors"
                >
                  <Calculator className="w-4 h-4 text-[#E50914]" />
                  <span>Simular Financiamento com {consultor.nome}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SEÇÃO DE ESTOQUE TOTAL INTEGRADO + FILTROS INTELIGENTES
         ===================================================================== */}
      <main id="estoque-completo" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Cabeçalho do Estoque + Barra de Busca e Filtros */}
        <div className="rounded-3xl bg-[#121216] border border-white/10 p-5 sm:p-7 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-6 rounded-full bg-[#E50914]" />
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                  Estoque Completo Manos Veículos
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400">
                Escolha qualquer veículo abaixo para ver todas as fotos ou negociar diretamente com{' '}
                <strong className="text-white">{consultor.nomeExibicao}</strong> no WhatsApp{' '}
                <strong className="text-emerald-400">{consultor.telefoneFormatado}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="px-3.5 py-1.5 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-xs font-extrabold text-white">
                {loading ? 'Sincronizando...' : `${veiculosFiltrados.length} veículos disponíveis`}
              </span>
            </div>
          </div>

          {/* Linha 1: Busca por Texto + Ordenação */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por marca, modelo, versão ou ano..."
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-white placeholder:text-zinc-500 text-sm font-medium focus:outline-none focus:border-[#E50914]"
              />
            </div>

            <div className="sm:w-56">
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
                aria-label="Ordenar veículos"
                className="w-full px-4 py-3.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-white text-sm font-bold focus:outline-none focus:border-[#E50914] cursor-pointer"
              >
                {ORDENACOES.map((o) => (
                  <option key={o.id} value={o.id} className="bg-[#121216] text-white">
                    Ordenar: {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Filtro por Faixa de Preço */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mr-1">
              Faixa de valor:
            </span>
            {FAIXAS_PRECO.map((faixa) => {
              const ativo = faixaSelecionada === faixa.id;
              return (
                <button
                  key={faixa.id}
                  type="button"
                  onClick={() => setFaixaSelecionada(faixa.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider border transition-all cursor-pointer ${
                    ativo
                      ? 'bg-[#E50914] border-[#E50914] text-white shadow-md shadow-[#E50914]/25'
                      : 'bg-[#0A0A0B] border-white/10 text-zinc-300 hover:border-white/25'
                  }`}
                >
                  {faixa.label}
                </button>
              );
            })}
          </div>

          {/* Linha 3: Filtro por Marca */}
          {marcasComContagem.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
              <button
                type="button"
                onClick={() => setMarcaSelecionada('todas')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex-shrink-0 border transition-all cursor-pointer ${
                  marcaSelecionada === 'todas'
                    ? 'bg-white text-[#0A0A0B] border-white'
                    : 'bg-[#0A0A0B] border-white/10 text-zinc-300 hover:border-white/25'
                }`}
              >
                Todas as Marcas ({stock.length})
              </button>
              {marcasComContagem.map(([marcaNome, qtd]) => {
                const ativo = marcaSelecionada === marcaNome;
                return (
                  <button
                    key={marcaNome}
                    type="button"
                    onClick={() => setMarcaSelecionada(marcaNome)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex-shrink-0 border transition-all cursor-pointer ${
                      ativo
                        ? 'bg-white text-[#0A0A0B] border-white'
                        : 'bg-[#0A0A0B] border-white/10 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    {marcaNome} ({qtd})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ===================================================================
            GRID DE VEÍCULOS DO ESTOQUE TOTAL
           =================================================================== */}
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Carregando estoque completo da Manos Veículos...
            </p>
          </div>
        ) : veiculosFiltrados.length === 0 ? (
          <div className="rounded-3xl bg-[#121216] border border-white/10 p-10 sm:p-14 text-center max-w-xl mx-auto space-y-5">
            <Car className="w-12 h-12 text-[#E50914] mx-auto opacity-85" />
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white">
                Não encontrou exatamente esse modelo no filtro?
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Nosso estoque recebe novidades toda semana. Chame o{' '}
                <strong className="text-white">{consultor.nomeExibicao}</strong> agora no WhatsApp e diga
                qual carro você procura!
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setBusca('');
                  setMarcaSelecionada('todas');
                  setFaixaSelecionada('todos');
                }}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer"
              >
                Limpar Filtros
              </button>
              <a
                href={linkWhatsAppGeral}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleWhatsAppClick(null)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] font-black text-xs uppercase tracking-wider"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#0A0A0B]" />
                <span>Pedir Busca para {consultor.nome}</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {veiculosFiltrados.map((v, idx) => {
              const foto = v.image || (v.images && v.images[0]) || LOGO_MANOS;
              const qtdFotos = v.images?.length || 1;
              const hrefDetalhes = buildVeiculoConsultorHref(v.slug);
              const waHref = gerarLinkWhatsAppConsultor(consultor, v, 'interesse');
              const parcelaEstimada =
                v.price > 0
                  ? calcParcela({
                      valor: v.price,
                      entrada: Math.round(v.price * 0.25),
                      meses: 48,
                    })
                  : 0;

              return (
                <article
                  key={v.id}
                  className="rounded-2xl sm:rounded-3xl bg-[#121216] border border-white/10 hover:border-[#E50914]/50 overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-xl group"
                >
                  <div>
                    {/* Imagem do Veículo */}
                    <a
                      href={hrefDetalhes}
                      className="block relative aspect-16/10 bg-[#18181D] overflow-hidden"
                    >
                      <img
                        src={foto}
                        alt={v.description}
                        loading={idx < 6 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Badge Superior Esquerdo */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
                        <span>Revisado & Periciado</span>
                      </div>

                      {/* Contador de Fotos */}
                      {qtdFotos > 1 && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-[11px] font-bold text-zinc-200">
                          <Camera className="w-3 h-3 text-[#E50914]" />
                          <span>{qtdFotos} fotos</span>
                        </div>
                      )}
                    </a>

                    {/* Corpo do Card */}
                    <div className="p-5 sm:p-6 space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E50914]">
                            {v.brand || v.description.split(' ')[0]}
                          </span>
                          <span className="text-[11px] font-bold text-zinc-400">
                            Atendimento: <strong className="text-zinc-200">{consultor.nome}</strong>
                          </span>
                        </div>

                        <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug mt-1 line-clamp-2">
                          <a href={hrefDetalhes} className="hover:text-[#E50914] transition-colors">
                            {v.description}
                          </a>
                        </h3>
                      </div>

                      {/* Especificações Rápidas */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 font-semibold">
                        {v.year && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                            <Calendar className="w-3.5 h-3.5 text-[#E50914]" />
                            {v.year}
                          </span>
                        )}
                        {v.km && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                            <Gauge className="w-3.5 h-3.5 text-[#E50914]" />
                            {v.km}
                          </span>
                        )}
                        {v.transmission && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                            <Settings2 className="w-3.5 h-3.5 text-[#E50914]" />
                            {v.transmission}
                          </span>
                        )}
                      </div>

                      {/* Preço + Simulação */}
                      <div className="pt-3 border-t border-white/10 flex items-end justify-between gap-2">
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            Valor à vista
                          </span>
                          <span className="text-2xl font-black text-white tracking-tight">
                            {v.priceFormatted}
                          </span>
                        </div>

                        {parcelaEstimada > 0 && (
                          <div className="text-right">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              ou 48x aprox.
                            </span>
                            <span className="text-xs font-extrabold text-emerald-400">
                              {brl(parcelaEstimada)}/mês*
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 grid grid-cols-2 gap-2.5">
                    <a
                      href={hrefDetalhes}
                      className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Ver Fotos</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleWhatsAppClick(v)}
                      className="py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-md"
                    >
                      <WhatsAppIcon className="w-4 h-4 text-[#0A0A0B]" />
                      <span>Falar c/ {consultor.nome}</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ===================================================================
            BANNER FINAL DE CONVERSÃO DO CONSULTOR
           =================================================================== */}
        <section className="pt-6">
          <div className="rounded-3xl bg-gradient-to-r from-[#161215] via-[#121216] to-[#161215] border border-[#E50914]/40 p-6 sm:p-10 shadow-[0_0_60px_rgba(229,9,20,0.12)]">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <img
                  src={consultor.foto}
                  alt={consultor.nomeExibicao}
                  className="w-24 h-24 rounded-2xl object-cover object-top border-2 border-[#E50914] flex-shrink-0 shadow-xl"
                />
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-[11px] font-extrabold uppercase tracking-widest">
                    Atendimento Personalizado Manos Veículos
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Fale diretamente com o {consultor.nomeExibicao}
                  </h2>
                  <p className="text-zinc-300 text-sm sm:text-base max-w-xl">
                    Tire dúvidas, peça vídeo detalhado de qualquer carro do pátio, simule financiamento ou
                    avalie seu usado na troca agora mesmo pelo WhatsApp{' '}
                    <strong className="text-white">{consultor.telefoneFormatado}</strong>.
                  </p>
                </div>
              </div>

              <a
                href={linkWhatsAppGeral}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleWhatsAppClick(null)}
                className="w-full lg:w-auto flex-shrink-0 py-4 sm:py-5 px-8 rounded-2xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] font-black text-sm sm:text-base uppercase tracking-wider inline-flex items-center justify-center gap-3 shadow-[0_12px_35px_rgba(37,211,102,0.3)] transition-all"
              >
                <WhatsAppIcon className="w-6 h-6 text-[#0A0A0B]" />
                <span>Chamar {consultor.nome} Agora</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 px-4 text-center text-xs text-zinc-500 space-y-2">
        <img
          src={LOGO_MANOS}
          alt="Manos Veículos"
          className="h-8 w-auto object-contain mx-auto opacity-80"
        />
        <p className="text-zinc-400 font-semibold">
          {consultor.nomeExibicao} • WhatsApp {consultor.telefoneFormatado} • Manos Veículos
        </p>
        <p className="text-[11px] text-zinc-500">
          *Valores de parcela são estimativas sujeitas à análise de crédito pelos bancos parceiros.
        </p>
      </footer>

      {/* =====================================================================
          BARRA FIXA DE CONVERSÃO NO MOBILE
         ===================================================================== */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#0A0A0B]/95 backdrop-blur-lg border-t border-white/15 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.75)]">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={consultor.foto}
              alt={consultor.nomeExibicao}
              className="w-11 h-11 rounded-full object-cover object-top border-2 border-[#E50914] flex-shrink-0"
            />
            <div className="min-w-0">
              <span className="block text-xs font-black text-white truncate">
                {consultor.nomeExibicao}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {consultor.telefoneFormatado}
              </span>
            </div>
          </div>

          <a
            href={linkWhatsAppGeral}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleWhatsAppClick(null)}
            className="flex-shrink-0 py-3 px-4 rounded-xl bg-[#25D366] active:scale-95 text-[#0A0A0B] font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
          >
            <WhatsAppIcon className="w-4 h-4 text-[#0A0A0B]" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}
