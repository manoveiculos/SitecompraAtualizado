import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Calendar,
  Gauge,
  Settings2,
  Fuel,
  Palette,
  Cpu,
  DoorOpen,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  X,
  CheckCircle2,
  AlertOctagon,
  Share2,
  Check,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import {
  fetchOfertaPorSlug,
  fetchConfigOfertas,
  inicializarPixelsConfiguradosOfertas,
  rastrearEventoOferta,
  registrarCliqueWhatsAppOferta,
  gerarLinkWhatsAppOferta,
  formatarMoedaBRL,
  formatarQuilometragem,
  formatarAnoVeiculo,
  obterTituloVeiculo,
  type VeiculoOferta,
} from '../../services/ofertasService';

const LOGO_MANOS = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

/**
 * Atualiza Title, Meta Description, Canonical, Open Graph e JSON-LD no DOM.
 * Não inventa dados ausentes.
 */
function aplicarSeoNoDocumento(v: VeiculoOferta): () => void {
  const tituloOriginal = document.title;
  const nome = obterTituloVeiculo(v);
  const precoFmt = formatarMoedaBRL(v.preco_venda);
  const anoFmt = formatarAnoVeiculo(v.ano_fabricacao, v.ano_modelo);
  const kmFmt = formatarQuilometragem(v.quilometragem);
  const canonicalUrl = `${window.location.origin}/ofertas/${v.slug}`;
  const isPublicado = v.status === 'publicado';

  const prefixo = v.status === 'vendido' ? '[VENDIDO] ' : '';
  const pageTitle = `${prefixo}${nome} — ${precoFmt} em ${v.localizacao} | Manos Veículos`;
  const attrsDesc = [anoFmt ? `Ano ${anoFmt}` : '', kmFmt, v.cambio, v.motorizacao]
    .filter(Boolean)
    .join(' • ');
  const pageDesc = isPublicado
    ? `${nome} por ${precoFmt} disponível em ${v.localizacao}. ${attrsDesc}. Fale diretamente com ${v.vendedor_nome} pelo WhatsApp na Manos Veículos.`
    : `Este veículo (${nome}) não está mais disponível para venda. Confira outras ofertas da Manos Veículos.`;

  const ogImg = v.foto_principal || v.fotos[0] || LOGO_MANOS;

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
  setMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    isPublicado ? 'index,follow,max-image-preview:large' : 'noindex,follow',
  );
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

  let linkCanonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!linkCanonical) {
    linkCanonical = document.createElement('link');
    linkCanonical.setAttribute('rel', 'canonical');
    document.head.appendChild(linkCanonical);
  }
  linkCanonical.setAttribute('href', canonicalUrl);

  // Dados estruturados JSON-LD (sem inventar atributos ausentes)
  const jsonLdObj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: nome,
    brand: { '@type': 'Brand', name: v.marca },
    model: v.modelo,
    itemCondition: 'https://schema.org/UsedCondition',
    url: canonicalUrl,
  };
  if (v.versao) jsonLdObj.vehicleConfiguration = v.versao;
  if (v.ano_modelo || v.ano_fabricacao) {
    jsonLdObj.vehicleModelDate = String(v.ano_modelo || v.ano_fabricacao);
  }
  if (v.ano_fabricacao) jsonLdObj.productionDate = String(v.ano_fabricacao);
  if (v.quilometragem !== null && v.quilometragem >= 0) {
    jsonLdObj.mileageFromOdometer = {
      '@type': 'QuantitativeValue',
      value: v.quilometragem,
      unitCode: 'KMT',
    };
  }
  if (v.cambio) jsonLdObj.vehicleTransmission = v.cambio;
  if (v.combustivel) jsonLdObj.fuelType = v.combustivel;
  if (v.cor) jsonLdObj.color = v.cor;
  if (v.portas) jsonLdObj.numberOfDoors = v.portas;
  if (v.motorizacao) {
    jsonLdObj.vehicleEngine = { '@type': 'EngineSpecification', name: v.motorizacao };
  }
  if (v.fotos.length > 0) jsonLdObj.image = v.fotos;
  if (v.observacoes_comerciais) jsonLdObj.description = v.observacoes_comerciais;

  jsonLdObj.offers = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'BRL',
    price: v.preco_venda,
    availability: isPublicado ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
    itemCondition: 'https://schema.org/UsedCondition',
    availableAtOrFrom: {
      '@type': 'Place',
      name: `Manos Veículos — ${v.localizacao}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Itapema',
        addressRegion: 'SC',
        addressCountry: 'BR',
      },
    },
    seller: {
      '@type': 'AutoDealer',
      name: 'Manos Veículos',
      logo: LOGO_MANOS,
    },
  };

  const scriptEl = document.createElement('script');
  scriptEl.type = 'application/ld+json';
  scriptEl.id = 'oferta-jsonld-schema';
  scriptEl.text = JSON.stringify(jsonLdObj);
  const oldScript = document.getElementById('oferta-jsonld-schema');
  if (oldScript) oldScript.remove();
  document.head.appendChild(scriptEl);

  return () => {
    document.title = tituloOriginal;
    const s = document.getElementById('oferta-jsonld-schema');
    if (s) s.remove();
  };
}

interface OfertaLandingPageProps {
  slug: string;
  /** Permite renderizar prévia dentro do painel administrativo sem exigir salvar antes */
  previewData?: VeiculoOferta | null;
}

export default function OfertaLandingPage({ slug, previewData }: OfertaLandingPageProps) {
  const [veiculo, setVeiculo] = useState<VeiculoOferta | null>(previewData || null);
  const [loading, setLoading] = useState(!previewData);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomAtivo, setZoomAtivo] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  // Controle de swipe touch no carrossel mobile
  const touchStartX = useRef<number | null>(null);

  const isPreviewMode =
    Boolean(previewData) || new URLSearchParams(window.location.search).get('preview') === '1';

  useEffect(() => {
    if (previewData) {
      setVeiculo(previewData);
      setLoading(false);
      setActivePhotoIndex(0);
      return;
    }

    let cancelado = false;
    setLoading(true);

    Promise.all([fetchOfertaPorSlug(slug, isPreviewMode), fetchConfigOfertas()])
      .then(([encontrado, cfg]) => {
        if (cancelado) return;
        inicializarPixelsConfiguradosOfertas(cfg);
        setVeiculo(encontrado);
        setActivePhotoIndex(0);
        setLoading(false);

        if (encontrado && !isPreviewMode) {
          rastrearEventoOferta('PageView', encontrado);
          // Só dispara ViewContent comercial quando o veículo está publicado e disponível
          if (encontrado.status === 'publicado' && !encontrado.indisponivel_publico) {
            rastrearEventoOferta('ViewContent', encontrado);
          }
        }
      })
      .catch(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [slug, previewData, isPreviewMode]);

  useEffect(() => {
    if (!veiculo || previewData) return;
    return aplicarSeoNoDocumento(veiculo);
  }, [veiculo, previewData]);

  // Navegação por teclado quando o Lightbox está aberto
  useEffect(() => {
    if (!lightboxOpen || !veiculo) return;
    const total = veiculo.fotos.length;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-zinc-400 tracking-wide uppercase">
          Carregando oferta...
        </p>
      </div>
    );
  }

  // Caso o veículo não exista ou esteja em rascunho/pausado (fora do modo prévia)
  if (!veiculo || (veiculo.indisponivel_publico && !isPreviewMode)) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col justify-between">
        <header className="border-b border-white/10 bg-[#0A0A0B]/95 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
            <a href="/ofertas" className="flex items-center gap-3">
              <img src={LOGO_MANOS} alt="Manos Veículos" className="h-10 w-auto object-contain" />
            </a>
            <a
              href="/ofertas"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#E50914]" />
              Ver Ofertas Disponíveis
            </a>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center mx-auto text-[#E50914]">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Este anúncio não está disponível no momento
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            O veículo que você procurou pode ter sido pausado ou não está mais ativo. Confira as
            demais ofertas disponíveis em Itapema/SC.
          </p>
          <div className="pt-2">
            <a
              href="/ofertas"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-extrabold text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#E50914]/25"
            >
              Ver Veículos Disponíveis
            </a>
          </div>
        </main>

        <footer className="border-t border-white/10 py-8 text-center text-xs text-zinc-500">
          Manos Veículos • {veiculo?.localizacao || 'Itapema/SC'}
        </footer>
      </div>
    );
  }

  const fotos =
    veiculo.fotos && veiculo.fotos.length > 0
      ? veiculo.fotos
      : veiculo.foto_principal
        ? [veiculo.foto_principal]
        : [];

  const fotoAtual = fotos[activePhotoIndex] || fotos[0] || '';
  const isVendido = veiculo.status === 'vendido';
  const anoExibicao = formatarAnoVeiculo(veiculo.ano_fabricacao, veiculo.ano_modelo);
  const kmExibicao = formatarQuilometragem(veiculo.quilometragem);
  const precoFormatado = formatarMoedaBRL(veiculo.preco_venda);
  const vendedorNome = (veiculo.vendedor_nome || 'Alexandre').trim();
  const linkWhatsApp = gerarLinkWhatsAppOferta(veiculo);
  const localizacaoTexto = veiculo.localizacao || 'Itapema/SC';

  // Atributos do BLOCO 3 — Apenas campos preenchidos (Sem inventar informações ausentes!)
  const cardsAtributos = [
    anoExibicao
      ? { label: 'Ano', value: anoExibicao, icon: Calendar }
      : null,
    kmExibicao
      ? { label: 'Quilometragem', value: kmExibicao, icon: Gauge }
      : null,
    veiculo.cambio
      ? { label: 'Câmbio', value: veiculo.cambio, icon: Settings2 }
      : null,
    veiculo.motorizacao
      ? { label: 'Motor', value: veiculo.motorizacao, icon: Cpu }
      : null,
    veiculo.combustivel
      ? { label: 'Combustível', value: veiculo.combustivel, icon: Fuel }
      : null,
    veiculo.cor
      ? { label: 'Cor', value: veiculo.cor, icon: Palette }
      : null,
    veiculo.portas
      ? { label: 'Portas', value: `${veiculo.portas} portas`, icon: DoorOpen }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const temDiferenciaisOuObservacoes =
    Boolean(veiculo.observacoes_comerciais && veiculo.observacoes_comerciais.trim()) ||
    (Array.isArray(veiculo.diferenciais) && veiculo.diferenciais.length > 0);

  const handleWhatsAppAction = () => {
    if (isVendido) return;
    if (!previewData) {
      registrarCliqueWhatsAppOferta(veiculo);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const titulo = obterTituloVeiculo(veiculo);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${titulo} — ${precoFormatado}`,
          text: `Confira ${titulo} disponível em ${localizacaoTexto} na Manos Veículos`,
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
      {/* Banner de Modo Prévia (quando visualizado pelo Administrador) */}
      {isPreviewMode && (
        <div className="bg-[#E50914] text-white text-xs font-extrabold uppercase tracking-widest py-2.5 px-4 text-center flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" />
          <span>Modo Prévia do Administrador — Status atual: {veiculo.status.toUpperCase()}</span>
        </div>
      )}

      {/* Top Header Oficial Manos Veículos */}
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 sm:h-20 flex items-center justify-between gap-4">
          <a href="/ofertas" className="flex items-center gap-3 flex-shrink-0" aria-label="Manos Veículos">
            <img
              src={LOGO_MANOS}
              alt="Manos Veículos"
              className="h-9 sm:h-11 w-auto object-contain"
            />
          </a>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-200">
              <MapPin className="w-3.5 h-3.5 text-[#E50914]" />
              <span>{localizacaoTexto}</span>
            </div>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
              title="Compartilhar anúncio"
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

      {/* Aviso de Veículo Vendido (Seção 11) */}
      {isVendido && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 py-4 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-md bg-[#E50914] text-white text-xs font-extrabold uppercase tracking-wider">
                VEÍCULO VENDIDO
              </span>
              <p className="text-sm font-semibold text-zinc-200">
                Este veículo já foi vendido e não está mais disponível para negociação.
              </p>
            </div>
            <a
              href="/ofertas"
              className="text-xs font-extrabold uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex-shrink-0"
            >
              Ver outras ofertas em {localizacaoTexto}
            </a>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-12 sm:space-y-16">
        {/* ===================================================================
            BLOCO 1 — APRESENTAÇÃO + BLOCO 2 — GALERIA (Layout Responsivo)
           =================================================================== */}
        <section aria-label="Apresentação e Galeria do Veículo" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Coluna Esquerda (7 cols no Desktop): Foto Principal + Galeria */}
          <div className="lg:col-span-7 space-y-4">
            {/* Container da Foto Principal em Destaque (aspect-ratio fixo 16/10 evita CLS) */}
            <div
              className="relative aspect-16/10 w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#121215] border border-white/10 shadow-2xl group select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {fotoAtual ? (
                <img
                  src={fotoAtual}
                  alt={`${veiculo.marca} ${veiculo.modelo} ${veiculo.versao || ''} - Foto ${activePhotoIndex + 1}`}
                  // @ts-ignore
                  fetchpriority="high"
                  loading="eager"
                  decoding="async"
                  onClick={() => setLightboxOpen(true)}
                  className={`w-full h-full object-cover cursor-zoom-in transition-transform duration-500 ${
                    isVendido ? 'grayscale opacity-75' : 'group-hover:scale-[1.01]'
                  }`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
                  Sem foto cadastrada
                </div>
              )}

              {/* Badge de Localização sobre a foto principal */}
              <div className="absolute top-3.5 left-3.5 sm:top-5 sm:left-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-xs font-extrabold text-white shadow-lg">
                  <MapPin className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>{localizacaoTexto}</span>
                </span>
                {isVendido && (
                  <span className="px-3.5 py-1.5 rounded-full bg-[#E50914] text-white text-xs font-extrabold uppercase tracking-wider shadow-lg">
                    Vendido
                  </span>
                )}
              </div>

              {/* Botão de Zoom / Tela Cheia */}
              {fotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 p-2.5 rounded-full bg-[#0A0A0B]/80 hover:bg-[#E50914] text-white border border-white/15 transition-colors shadow-lg cursor-pointer"
                  aria-label="Ampliar imagem"
                >
                  <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {/* Contador de Fotos */}
              {fotos.length > 1 && (
                <div className="absolute bottom-3.5 left-3.5 sm:bottom-5 sm:left-5 px-3 py-1 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-xs font-bold text-zinc-200">
                  Foto {activePhotoIndex + 1} de {fotos.length}
                </div>
              )}

              {/* Setas de Navegação do Carrossel */}
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

            {/* BLOCO 2 — GALERIA DE MINIATURAS */}
            {fotos.length > 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Galeria de Fotos ({fotos.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="text-[11px] font-bold text-[#E50914] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    Abrir galeria em tela cheia
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
                          alt={`${veiculo.marca} ${veiculo.modelo} miniatura ${index + 1}`}
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

          {/* Coluna Direita (5 cols no Desktop): BLOCO 1 — Identificação, Preço e CTA Estratégico */}
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <div className="rounded-2xl sm:rounded-3xl bg-[#121216] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Marca + Localização */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-md bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-extrabold uppercase tracking-widest">
                  {veiculo.marca}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                  <MapPin className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>{localizacaoTexto}</span>
                </span>
              </div>

              {/* Marca, Modelo, Versão e Ano */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  {veiculo.marca} {veiculo.modelo}
                </h1>
                {veiculo.versao && (
                  <p className="text-sm sm:text-base font-medium text-zinc-300 leading-snug">
                    {veiculo.versao}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold text-zinc-400">
                  {anoExibicao && (
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-200">
                      Ano {anoExibicao}
                    </span>
                  )}
                  {kmExibicao && (
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-200">
                      {kmExibicao}
                    </span>
                  )}
                  {veiculo.cambio && (
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-200">
                      {veiculo.cambio}
                    </span>
                  )}
                </div>
              </div>

              {/* Preço com Excelente Hierarquia Visual */}
              <div className="pt-4 border-t border-white/10">
                <span className="block text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 mb-1">
                  Valor à vista
                </span>
                <div className="flex items-baseline gap-3">
                  <span
                    className={`text-3xl sm:text-4xl font-black tracking-tight ${
                      isVendido ? 'text-zinc-500 line-through' : 'text-white'
                    }`}
                  >
                    {precoFormatado}
                  </span>
                  {isVendido && (
                    <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded bg-[#E50914] text-white">
                      Vendido
                    </span>
                  )}
                </div>
              </div>

              {/* CTA Principal (Desktop e Topo Mobile) */}
              {isVendido ? (
                <div className="space-y-3 pt-2">
                  <div className="w-full py-4 px-6 rounded-xl bg-zinc-800/80 border border-white/10 text-zinc-400 font-extrabold text-sm uppercase tracking-wider text-center cursor-not-allowed">
                    Veículo Vendido — Contato Encerrado
                  </div>
                  <a
                    href="/ofertas"
                    className="w-full py-3.5 px-6 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider text-center block transition-colors"
                  >
                    Ver outros veículos disponíveis em {localizacaoTexto}
                  </a>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <a
                    href={linkWhatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleWhatsAppAction}
                    className="w-full py-4 sm:py-5 px-6 rounded-xl bg-[#25D366] hover:bg-[#1fb858] active:scale-[0.99] text-[#0A0A0B] font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,211,102,0.28)] transition-all"
                  >
                    <WhatsAppIcon className="w-6 h-6 text-[#0A0A0B]" />
                    <span>FALAR COM {vendedorNome.toUpperCase()} AGORA</span>
                  </a>
                  <p className="text-center text-xs text-zinc-400 font-medium">
                    Atendimento direto no WhatsApp com{' '}
                    <strong className="text-white">{vendedorNome}</strong> • Sem intermediários
                  </p>
                </div>
              )}

              {/* Resumo de Localização no Card */}
              <div className="pt-4 border-t border-white/10 flex items-center gap-3 text-xs text-zinc-300">
                <div className="w-9 h-9 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center flex-shrink-0 text-[#E50914]">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="block font-extrabold text-white uppercase tracking-wider">
                    Disponível em {localizacaoTexto}
                  </span>
                  <span className="text-zinc-400">Manos Veículos</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            BLOCO 3 — INFORMAÇÕES DO VEÍCULO (Cards Visuais)
           =================================================================== */}
        {cardsAtributos.length > 0 && (
          <section aria-labelledby="heading-ficha-tecnica" className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-6 rounded-full bg-[#E50914]" />
              <h2
                id="heading-ficha-tecnica"
                className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase"
              >
                Informações do Veículo
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
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
            BLOCO 4 — DIFERENCIAIS E OBSERVAÇÕES COMERCIAIS
            (Exibe estritamente o que foi cadastrado manualmente no anúncio)
           =================================================================== */}
        {temDiferenciaisOuObservacoes && (
          <section aria-labelledby="heading-diferenciais" className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-6 rounded-full bg-[#E50914]" />
              <h2
                id="heading-diferenciais"
                className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase"
              >
                Diferenciais e Observações
              </h2>
            </div>

            <div className="rounded-2xl sm:rounded-3xl bg-[#121216] border border-white/10 p-6 sm:p-8 space-y-6">
              {veiculo.observacoes_comerciais && (
                <p className="text-zinc-200 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                  {veiculo.observacoes_comerciais}
                </p>
              )}

              {veiculo.diferenciais && veiculo.diferenciais.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  {veiculo.diferenciais.map((dif, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/5"
                    >
                      <CheckCircle2 className="w-5 h-5 text-[#E50914] flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-semibold text-zinc-100 leading-snug">{dif}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* ===================================================================
            BLOCO 5 — LOCALIZAÇÃO
           =================================================================== */}
        <section aria-label="Localização do Veículo">
          <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#141418] via-[#181215] to-[#141418] border border-white/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center text-[#E50914] flex-shrink-0">
                <MapPin className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#E50914]">
                  Localização do Veículo
                </span>
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white uppercase">
                  VEÍCULO DISPONÍVEL EM {localizacaoTexto.toUpperCase()}.
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Entre em contato pelo WhatsApp para agendar sua visita ou solicitar mais detalhes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            BLOCO 6 — CTA FINAL DE ALTA CONVERSÃO
           =================================================================== */}
        <section aria-labelledby="heading-cta-final">
          <div className="relative rounded-3xl overflow-hidden bg-[#121216] border border-[#E50914]/40 p-8 sm:p-12 text-center shadow-[0_0_60px_rgba(229,9,20,0.12)]">
            <div className="max-w-2xl mx-auto space-y-6">
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-extrabold uppercase tracking-widest">
                Atendimento Direto Manos Veículos
              </span>

              <h2
                id="heading-cta-final"
                className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase"
              >
                GOSTOU DESSE VEÍCULO?
              </h2>

              <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
                Fale diretamente com nosso vendedor e tire suas dúvidas pelo WhatsApp.
              </p>

              {isVendido ? (
                <div className="pt-2 space-y-3 max-w-md mx-auto">
                  <div className="py-4 px-6 rounded-xl bg-zinc-800 text-zinc-400 font-extrabold text-sm uppercase tracking-wider">
                    ESTE VEÍCULO JÁ FOI VENDIDO
                  </div>
                  <a
                    href="/ofertas"
                    className="inline-block text-xs font-bold uppercase tracking-wider text-[#E50914] hover:underline"
                  >
                    Ver outras ofertas disponíveis
                  </a>
                </div>
              ) : (
                <div className="pt-2">
                  <a
                    href={linkWhatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleWhatsAppAction}
                    className="inline-flex items-center justify-center gap-3 w-full sm:w-auto min-w-[300px] py-5 px-8 rounded-2xl bg-[#E50914] hover:bg-[#c40710] active:scale-[0.99] text-white font-black text-base sm:text-lg uppercase tracking-wider shadow-[0_14px_40px_rgba(229,9,20,0.38)] transition-all"
                  >
                    <WhatsAppIcon className="w-6 h-6 text-white" />
                    <span>FALAR COM {vendedorNome.toUpperCase()} AGORA</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé Institucional Discreto */}
      <footer className="mt-16 border-t border-white/10 py-10 px-4 text-center text-xs text-zinc-500 space-y-3">
        <img
          src={LOGO_MANOS}
          alt="Manos Veículos"
          className="h-8 w-auto object-contain mx-auto opacity-80"
        />
        <p className="text-zinc-400 font-medium">
          Manos Veículos — Veículos disponíveis em {localizacaoTexto}
        </p>
        <div className="flex items-center justify-center gap-4 text-zinc-500">
          <a href="/ofertas" className="hover:text-zinc-300 transition-colors">
            Ofertas
          </a>
          <span>•</span>
          <a href="/politica-de-privacidade" className="hover:text-zinc-300 transition-colors">
            Política de Privacidade
          </a>
        </div>
      </footer>

      {/* =====================================================================
          CTA FIXO NO MOBILE (Seção 7)
          Permanece visível durante a navegação com Preço + Botão de WhatsApp
         ===================================================================== */}
      <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#0A0A0B]/95 backdrop-blur-lg border-t border-white/15 px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.7)]">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">
              {veiculo.marca} {veiculo.modelo} {anoExibicao}
            </span>
            <span
              className={`block text-lg font-black tracking-tight ${
                isVendido ? 'text-zinc-500 line-through' : 'text-white'
              }`}
            >
              {precoFormatado}
            </span>
          </div>

          {isVendido ? (
            <span className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-400 font-extrabold text-xs uppercase tracking-wider flex-shrink-0">
              Vendido
            </span>
          ) : (
            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppAction}
              className="flex-shrink-0 py-3.5 px-5 rounded-xl bg-[#25D366] active:scale-95 text-[#0A0A0B] font-black text-xs sm:text-sm uppercase tracking-wider inline-flex items-center gap-2 shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              <WhatsAppIcon className="w-5 h-5 text-[#0A0A0B]" />
              <span>Falar com {vendedorNome}</span>
            </a>
          )}
        </div>
      </div>

      {/* =====================================================================
          MODAL LIGHTBOX DE ZOOM NAS IMAGENS (BLOCO 2)
         ===================================================================== */}
      {lightboxOpen && fotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Galeria em tela cheia"
        >
          <div className="flex items-center justify-between text-white">
            <span className="text-xs sm:text-sm font-bold text-zinc-300">
              {obterTituloVeiculo(veiculo)} — Foto {activePhotoIndex + 1} de {fotos.length}
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
              alt={`${obterTituloVeiculo(veiculo)} ampliada`}
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
