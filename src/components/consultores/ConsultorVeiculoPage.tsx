import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Calendar,
  Gauge,
  Settings2,
  Fuel,
  Palette,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  X,
  CheckCircle2,
  AlertOctagon,
  Share2,
  Check,
  ArrowLeft,
  ShieldCheck,
  Calculator,
  ArrowRightLeft,
  Phone,
  ArrowRight,
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

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function findVehicleInStock(list: Vehicle[], target: string): Vehicle | undefined {
  if (!target) return undefined;

  const direct = list.find((v) => v.id === target || v.slug === target);
  if (direct) return direct;

  const parts = target.split('-');
  const idFromSlug = parts[parts.length - 1];
  if (idFromSlug && /^\d+$/.test(idFromSlug)) {
    const matchedById = list.find((v) => v.id === idFromSlug);
    if (matchedById) return matchedById;
  }

  const cleanTarget = target.toLowerCase().replace(/-\d+$/, '');
  return list.find((v) => {
    const descSlug = v.description
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    return descSlug.includes(cleanTarget) || cleanTarget.includes(descSlug);
  });
}

function aplicarSeoVeiculoConsultor(v: Vehicle, consultor: ConsultorProfile): () => void {
  const tituloOriginal = document.title;
  const pageTitle = `${v.description} (${v.year}) — ${v.priceFormatted} | ${consultor.nomeExibicao} • Manos Veículos`;
  const pageDesc = `${v.description} (${v.year}) por ${v.priceFormatted} na Manos Veículos. Fale diretamente com o ${consultor.nomeExibicao} no WhatsApp ${consultor.telefoneFormatado} para simular financiamento ou avaliar seu usado na troca.`;
  const canonicalUrl = `${window.location.origin}/${consultor.slug}/${v.slug}`;
  const ogImg = v.image || (v.images && v.images[0]) || `${window.location.origin}${consultor.foto}`;

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
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'product');
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', pageDesc);
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', ogImg);

  return () => {
    document.title = tituloOriginal;
  };
}

interface ConsultorVeiculoPageProps {
  consultorSlug: string;
  vehicleSlug: string;
}

export default function ConsultorVeiculoPage({
  consultorSlug,
  vehicleSlug,
}: ConsultorVeiculoPageProps) {
  const consultor = obterConsultorPorSlug(consultorSlug) || CONSULTORES.wilsinho;

  const [veiculo, setVeiculo] = useState<Vehicle | null>(null);
  const [similares, setSimilares] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomAtivo, setZoomAtivo] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);

    Promise.all([fetchStock(), fetchConfigOfertas().catch(() => null)])
      .then(([lista, cfg]) => {
        if (cancelado) return;
        if (cfg) {
          inicializarPixelsConfiguradosOfertas(cfg);
        }

        const encontrado = findVehicleInStock(lista, vehicleSlug);
        setVeiculo(encontrado || null);
        setActivePhotoIndex(0);
        setLoading(false);

        if (encontrado) {
          registrarConversaoConsultor(consultor, 'PageView', encontrado);
          registrarConversaoConsultor(consultor, 'ViewContent', encontrado);

          const outros = lista.filter((item) => item.id !== encontrado.id);
          const ordenados = outros.sort(
            (a, b) => Math.abs(a.price - encontrado.price) - Math.abs(b.price - encontrado.price),
          );
          setSimilares(ordenados.slice(0, 3));
        }
      })
      .catch(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [consultor, vehicleSlug]);

  useEffect(() => {
    if (!veiculo) return;
    return aplicarSeoVeiculoConsultor(veiculo, consultor);
  }, [veiculo, consultor]);

  useEffect(() => {
    if (!lightboxOpen || !veiculo) return;
    const total = veiculo.images?.length || 1;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setZoomAtivo(false);
      } else if (e.key === 'ArrowRight' && total > 1) {
        setActivePhotoIndex((i) => (i + 1) % total);
      } else if (e.key === 'ArrowLeft' && total > 1) {
        setActivePhotoIndex((i) => (i - 1 + total) % total);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, veiculo]);

  const buildConsultorRootHref = (): string => {
    const search = window.location.search;
    return `/${consultor.slug}${search || ''}`;
  };

  const buildSimilarHref = (slug: string): string => {
    const search = window.location.search;
    return `/${consultor.slug}/${slug}${search || ''}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-zinc-400 tracking-wide uppercase">
          Carregando fotos e detalhes do veículo...
        </p>
      </div>
    );
  }

  if (!veiculo) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col justify-between">
        <header className="border-b border-white/10 bg-[#0A0A0B]/95 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
            <a href={buildConsultorRootHref()} className="flex items-center gap-3">
              <img src={LOGO_MANOS} alt="Manos Veículos" className="h-10 w-auto object-contain" />
            </a>
            <a
              href={buildConsultorRootHref()}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#E50914]" />
              Voltar para o Estoque do {consultor.nome}
            </a>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center mx-auto text-[#E50914]">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Este veículo não está mais disponível no pátio
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Ele pode ter sido vendido recentemente. Veja todo o estoque atualizado ou fale diretamente
            com o <strong className="text-white">{consultor.nomeExibicao}</strong> no WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href={buildConsultorRootHref()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-extrabold text-sm uppercase tracking-wider transition-all"
            >
              Ver Estoque do {consultor.nome}
            </a>
            <a
              href={gerarLinkWhatsAppConsultor(consultor, null, 'geral')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] font-black text-sm uppercase tracking-wider transition-all"
            >
              <WhatsAppIcon className="w-5 h-5 text-[#0A0A0B]" />
              <span>Chamar {consultor.nome}</span>
            </a>
          </div>
        </main>

        <footer className="border-t border-white/10 py-8 text-center text-xs text-zinc-500">
          {consultor.nomeExibicao} ({consultor.telefoneFormatado}) • Manos Veículos
        </footer>
      </div>
    );
  }

  const fotos =
    veiculo.images && veiculo.images.length > 0
      ? veiculo.images
      : veiculo.image
        ? [veiculo.image]
        : [LOGO_MANOS];

  const fotoAtual = fotos[activePhotoIndex] || fotos[0] || LOGO_MANOS;
  const marca = veiculo.brand || veiculo.description.split(' ')[0] || 'Seminovo';
  const parcelaEstimada =
    veiculo.price > 0
      ? calcParcela({
          valor: veiculo.price,
          entrada: Math.round(veiculo.price * 0.25),
          meses: 48,
        })
      : 0;

  const linkWhatsAppInteresse = gerarLinkWhatsAppConsultor(consultor, veiculo, 'interesse');
  const linkWhatsAppFinanc = gerarLinkWhatsAppConsultor(consultor, veiculo, 'financiamento');
  const linkWhatsAppTroca = gerarLinkWhatsAppConsultor(consultor, veiculo, 'troca');

  const cardsAtributos = [
    veiculo.year ? { label: 'Ano / Modelo', value: veiculo.year, icon: Calendar } : null,
    veiculo.km ? { label: 'Quilometragem', value: veiculo.km, icon: Gauge } : null,
    veiculo.transmission ? { label: 'Câmbio', value: veiculo.transmission, icon: Settings2 } : null,
    veiculo.fuel ? { label: 'Combustível', value: veiculo.fuel, icon: Fuel } : null,
    veiculo.color ? { label: 'Cor', value: veiculo.color, icon: Palette } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const handleWhatsAppAction = () => {
    registrarConversaoConsultor(consultor, 'Contact', veiculo);
    registrarConversaoConsultor(consultor, 'WhatsAppClick', veiculo);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/${consultor.slug}/${veiculo.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${veiculo.description} — ${veiculo.priceFormatted} | ${consultor.nomeExibicao}`,
          text: `Confira ${veiculo.description} (${veiculo.year}) na Manos Veículos com o ${consultor.nomeExibicao}`,
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

  const irFotoAnterior = () => {
    if (fotos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
  };

  const irProximaFoto = () => {
    if (fotos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev === fotos.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || fotos.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const deltaX = endX - touchStartX.current;
    if (Math.abs(deltaX) > 45) {
      if (deltaX < 0) irProximaFoto();
      else irFotoAnterior();
    }
    touchStartX.current = null;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans antialiased selection:bg-[#E50914] selection:text-white pb-28 lg:pb-16">
      {/* Header Oficial */}
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href={buildConsultorRootHref()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold uppercase tracking-wider text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#E50914]" />
              <span>Estoque do {consultor.nome}</span>
            </a>

            <a href={buildConsultorRootHref()} className="hidden sm:flex items-center gap-2 pl-2">
              <img src={LOGO_MANOS} alt="Manos Veículos" className="h-9 w-auto object-contain" />
            </a>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <img
                src={consultor.foto}
                alt={consultor.nomeExibicao}
                className="w-6 h-6 rounded-full object-cover object-top border border-[#E50914]"
              />
              <span className="text-xs font-bold text-zinc-200">
                {consultor.nomeExibicao} • {consultor.telefoneFormatado}
              </span>
            </div>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
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
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-12 sm:space-y-16">
        {/* ===================================================================
            BLOCO 1 & 2 — GALERIA DE FOTOS + CARD DE NEGOCIAÇÃO COM WILSINHO
           =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Coluna Esquerda (7 cols): Carrossel + Miniaturas */}
          <div className="lg:col-span-7 space-y-4">
            <div
              className="relative aspect-16/10 w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#121215] border border-white/10 shadow-2xl group select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={fotoAtual}
                alt={`${veiculo.description} - Foto ${activePhotoIndex + 1}`}
                // @ts-ignore
                fetchpriority="high"
                loading="eager"
                decoding="async"
                onClick={() => setLightboxOpen(true)}
                className="w-full h-full object-cover cursor-zoom-in group-hover:scale-[1.01] transition-transform duration-500"
              />

              {/* Badges Superiores */}
              <div className="absolute top-3.5 left-3.5 sm:top-5 sm:left-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-xs font-extrabold text-white shadow-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>Seminovo Revisado Manos</span>
                </span>
              </div>

              {/* Botão Zoom */}
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 p-2.5 rounded-full bg-[#0A0A0B]/80 hover:bg-[#E50914] text-white border border-white/15 transition-colors shadow-lg cursor-pointer"
                aria-label="Ampliar imagem"
              >
                <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Contador de Fotos */}
              {fotos.length > 1 && (
                <div className="absolute bottom-3.5 left-3.5 sm:bottom-5 sm:left-5 px-3 py-1 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-xs font-bold text-zinc-200">
                  Foto {activePhotoIndex + 1} de {fotos.length}
                </div>
              )}

              {/* Setas de Navegação */}
              {fotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={irFotoAnterior}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#0A0A0B]/80 hover:bg-[#E50914] text-white border border-white/15 flex items-center justify-center transition-all shadow-lg cursor-pointer"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={irProximaFoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#0A0A0B]/80 hover:bg-[#E50914] text-white border border-white/15 flex items-center justify-center transition-all shadow-lg cursor-pointer"
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </>
              )}
            </div>

            {/* Galeria de Miniaturas */}
            {fotos.length > 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Galeria Completa ({fotos.length} fotos)
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="text-[11px] font-bold text-[#E50914] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    Abrir em tela cheia
                  </button>
                </div>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                  {fotos.map((imgUrl, index) => {
                    const selecionada = index === activePhotoIndex;
                    return (
                      <button
                        key={`${imgUrl}-${index}`}
                        type="button"
                        onClick={() => setActivePhotoIndex(index)}
                        className={`relative w-20 h-15 sm:w-24 sm:h-18 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                          selecionada
                            ? 'border-[#E50914] ring-2 ring-[#E50914]/40 opacity-100 scale-[1.02]'
                            : 'border-white/10 opacity-60 hover:opacity-100'
                        }`}
                        aria-label={`Ver foto ${index + 1}`}
                      >
                        <img
                          src={imgUrl}
                          alt={`${veiculo.description} miniatura ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Coluna Direita (5 cols): Preço + Card Oficial do Consultor Wilsinho */}
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <div className="rounded-2xl sm:rounded-3xl bg-[#121216] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Marca + Ano */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-md bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-extrabold uppercase tracking-widest">
                  {marca}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                  <MapPin className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>Manos Veículos</span>
                </span>
              </div>

              {/* Título e Resumo */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  {veiculo.description}
                </h1>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold text-zinc-400">
                  {veiculo.year && (
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-200">
                      Ano {veiculo.year}
                    </span>
                  )}
                  {veiculo.km && (
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-200">
                      {veiculo.km}
                    </span>
                  )}
                  {veiculo.transmission && (
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-200">
                      {veiculo.transmission}
                    </span>
                  )}
                </div>
              </div>

              {/* Preço à vista + Estimativa de Parcela */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="block text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 mb-1">
                    Valor à vista
                  </span>
                  <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                    {veiculo.priceFormatted}
                  </span>
                </div>

                {parcelaEstimada > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                      Sugestão 48x*
                    </span>
                    <span className="text-sm font-black text-emerald-400">
                      {brl(parcelaEstimada)}/mês
                    </span>
                  </div>
                )}
              </div>

              {/* Card de Credibilidade do Consultor Wilsinho */}
              <div className="p-4 rounded-2xl bg-[#18181F] border border-[#E50914]/40 flex items-center gap-3.5">
                <img
                  src={consultor.foto}
                  alt={consultor.nomeExibicao}
                  className="w-16 h-16 rounded-2xl object-cover object-top border-2 border-[#E50914] flex-shrink-0"
                />
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Seu Consultor Exclusivo
                  </span>
                  <strong className="block text-base font-black text-white truncate">
                    {consultor.nomeExibicao}
                  </strong>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-300">
                    <Phone className="w-3 h-3 text-[#25D366]" />
                    {consultor.telefoneFormatado}
                  </span>
                </div>
              </div>

              {/* Botões de Ação Direta */}
              <div className="space-y-2.5">
                <a
                  href={linkWhatsAppInteresse}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleWhatsAppAction}
                  className="w-full py-4 sm:py-5 px-6 rounded-xl bg-[#25D366] hover:bg-[#1fb858] active:scale-[0.99] text-[#0A0A0B] font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,211,102,0.28)] transition-all"
                >
                  <WhatsAppIcon className="w-6 h-6 text-[#0A0A0B]" />
                  <span>FALAR COM {consultor.nome.toUpperCase()} AGORA</span>
                </a>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <a
                    href={linkWhatsAppFinanc}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleWhatsAppAction}
                    className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                    <Calculator className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                    <span>Simular Parcela</span>
                  </a>

                  <a
                    href={linkWhatsAppTroca}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleWhatsAppAction}
                    className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                    <span>Avaliar Troca</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            BLOCO 3 — FICHA TÉCNICA VISUAL
           =================================================================== */}
        {cardsAtributos.length > 0 && (
          <section aria-labelledby="heading-ficha" className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-6 rounded-full bg-[#E50914]" />
              <h2
                id="heading-ficha"
                className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase"
              >
                Informações do Veículo
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {cardsAtributos.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-[#121216] border border-white/10 p-4 sm:p-5 flex flex-col justify-between gap-3 hover:border-[#E50914]/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#E50914]/15 text-[#E50914] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        {item.label}
                      </span>
                      <span className="block text-sm sm:text-base font-extrabold text-white mt-0.5">
                        {item.value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===================================================================
            BLOCO 4 — OPCIONAIS E EQUIPAMENTOS DO VEÍCULO
           =================================================================== */}
        {veiculo.options && veiculo.options.length > 0 && (
          <section aria-labelledby="heading-opcionais" className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-6 rounded-full bg-[#E50914]" />
              <h2
                id="heading-opcionais"
                className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase"
              >
                Opcionais e Equipamentos
              </h2>
            </div>

            <div className="rounded-2xl sm:rounded-3xl bg-[#121216] border border-white/10 p-6 sm:p-8">
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {veiculo.options.map((op, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold text-zinc-100 leading-snug">
                      {op}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ===================================================================
            BLOCO 5 — VEÍCULOS SEMELHANTES NO ESTOQUE DO CONSULTOR
           =================================================================== */}
        {similares.length > 0 && (
          <section aria-labelledby="heading-similares" className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-6 rounded-full bg-[#E50914]" />
                <h2
                  id="heading-similares"
                  className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase"
                >
                  Outras Opções com {consultor.nomeExibicao}
                </h2>
              </div>

              <a
                href={buildConsultorRootHref()}
                className="text-xs font-extrabold uppercase tracking-wider text-[#E50914] hover:underline flex items-center gap-1"
              >
                <span>Ver estoque completo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {similares.map((sim) => {
                const simHref = buildSimilarHref(sim.slug);
                return (
                  <a
                    key={sim.id}
                    href={simHref}
                    className="rounded-2xl bg-[#121216] border border-white/10 hover:border-[#E50914]/50 overflow-hidden flex flex-col justify-between transition-all group shadow-lg"
                  >
                    <div>
                      <div className="aspect-16/10 bg-[#18181D] overflow-hidden">
                        <img
                          src={sim.image}
                          alt={sim.description}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="text-sm font-extrabold text-white group-hover:text-[#E50914] transition-colors line-clamp-1">
                          {sim.description}
                        </h3>
                        <p className="text-xs text-zinc-400 font-semibold">
                          {sim.year} • {sim.km}
                        </p>
                        <p className="text-lg font-black text-white">{sim.priceFormatted}</p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* ===================================================================
            BLOCO 6 — CTA FINAL DE ALTA CONVERSÃO COM FOTO DO WILSINHO
           =================================================================== */}
        <section aria-labelledby="heading-cta-final">
          <div className="relative rounded-3xl overflow-hidden bg-[#121216] border border-[#E50914]/40 p-8 sm:p-12 text-center shadow-[0_0_60px_rgba(229,9,20,0.12)]">
            <div className="max-w-2xl mx-auto space-y-6">
              <img
                src={consultor.foto}
                alt={consultor.nomeExibicao}
                className="w-24 h-24 rounded-full object-cover object-top border-2 border-[#E50914] mx-auto shadow-xl"
              />

              <div className="space-y-2">
                <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-extrabold uppercase tracking-widest">
                  Negociação Direta • {consultor.telefoneFormatado}
                </span>

                <h2
                  id="heading-cta-final"
                  className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase pt-1"
                >
                  GOSTOU DESTE VEÍCULO?
                </h2>

                <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
                  Fale diretamente comigo no WhatsApp para receber um vídeo detalhado deste carro,
                  simular financiamento ou avaliar seu usado na troca.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href={linkWhatsAppInteresse}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleWhatsAppAction}
                  className="inline-flex items-center justify-center gap-3 w-full sm:w-auto min-w-[300px] py-5 px-8 rounded-2xl bg-[#25D366] hover:bg-[#1fb858] active:scale-[0.99] text-[#0A0A0B] font-black text-base sm:text-lg uppercase tracking-wider shadow-[0_14px_40px_rgba(37,211,102,0.35)] transition-all"
                >
                  <WhatsAppIcon className="w-6 h-6 text-[#0A0A0B]" />
                  <span>CHAMAR {consultor.nome.toUpperCase()} NO WHATSAPP</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé */}
      <footer className="mt-16 border-t border-white/10 py-10 px-4 text-center text-xs text-zinc-500 space-y-3">
        <img
          src={LOGO_MANOS}
          alt="Manos Veículos"
          className="h-8 w-auto object-contain mx-auto opacity-80"
        />
        <p className="text-zinc-400 font-medium">
          {consultor.nomeExibicao} ({consultor.telefoneFormatado}) — Manos Veículos
        </p>
      </footer>

      {/* =====================================================================
          CTA FIXO NO MOBILE
         ===================================================================== */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#0A0A0B]/95 backdrop-blur-lg border-t border-white/15 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.75)]">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={consultor.foto}
              alt={consultor.nomeExibicao}
              className="w-10 h-10 rounded-full object-cover object-top border border-[#E50914] flex-shrink-0"
            />
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">
                {veiculo.description}
              </span>
              <span className="block text-base font-black tracking-tight text-white">
                {veiculo.priceFormatted}
              </span>
            </div>
          </div>

          <a
            href={linkWhatsAppInteresse}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppAction}
            className="flex-shrink-0 py-3.5 px-5 rounded-xl bg-[#25D366] active:scale-95 text-[#0A0A0B] font-black text-xs sm:text-sm uppercase tracking-wider inline-flex items-center gap-2 shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
          >
            <WhatsAppIcon className="w-5 h-5 text-[#0A0A0B]" />
            <span>Falar c/ {consultor.nome}</span>
          </a>
        </div>
      </div>

      {/* =====================================================================
          LIGHTBOX MODAL
         ===================================================================== */}
      {lightboxOpen && fotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Galeria em tela cheia"
        >
          <div className="flex items-center justify-between text-white">
            <span className="text-xs sm:text-sm font-bold text-zinc-300 truncate max-w-md">
              {veiculo.description} — Foto {activePhotoIndex + 1} de {fotos.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomAtivo((z) => !z)}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
              >
                {zoomAtivo ? 'Reduzir Zoom' : 'Ampliar Zoom'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLightboxOpen(false);
                  setZoomAtivo(false);
                }}
                className="p-2 rounded-full bg-white/10 hover:bg-[#E50914] text-white transition-colors cursor-pointer"
                aria-label="Fechar galeria"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 flex items-center justify-center overflow-auto my-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={fotoAtual}
              alt={`${veiculo.description} ampliada`}
              onClick={() => setZoomAtivo((z) => !z)}
              className={`max-h-[78vh] w-auto object-contain rounded-lg transition-transform duration-300 ${
                zoomAtivo ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
            />

            {fotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={irFotoAnterior}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-[#E50914] text-white border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={irProximaFoto}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-[#E50914] text-white border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {fotos.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
              {fotos.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActivePhotoIndex(idx);
                    setZoomAtivo(false);
                  }}
                  className={`w-16 h-12 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all cursor-pointer ${
                    idx === activePhotoIndex ? 'border-[#E50914] scale-105' : 'border-white/15 opacity-50'
                  }`}
                >
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
