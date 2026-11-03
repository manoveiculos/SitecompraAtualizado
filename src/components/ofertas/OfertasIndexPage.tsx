import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Search,
  Calendar,
  Gauge,
  Settings2,
  ArrowRight,
  Car,
} from 'lucide-react';
import {
  fetchOfertasPublicadas,
  fetchConfigOfertas,
  inicializarPixelsConfiguradosOfertas,
  rastrearEventoOferta,
  registrarCliqueWhatsAppOferta,
  gerarLinkWhatsAppOferta,
  formatarMoedaBRL,
  formatarQuilometragem,
  formatarAnoVeiculo,
  obterTituloVeiculo,
  VENDEDOR_PADRAO_OFERTAS,
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

export default function OfertasIndexPage() {
  const [veiculos, setVeiculos] = useState<VeiculoOferta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [marcaSelecionada, setMarcaSelecionada] = useState('todas');

  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = 'Ofertas Exclusivas em Itapema/SC | Manos Veículos';

    Promise.all([fetchOfertasPublicadas(), fetchConfigOfertas()])
      .then(([lista, cfg]) => {
        inicializarPixelsConfiguradosOfertas(cfg);
        setVeiculos(lista);
        setLoading(false);
        rastrearEventoOferta('PageView', null);
      })
      .catch(() => setLoading(false));

    return () => {
      document.title = tituloAnterior;
    };
  }, []);

  const marcas = Array.from(new Set(veiculos.map((v) => v.marca).filter(Boolean))).sort();

  const filtrados = veiculos.filter((v) => {
    const termo = busca.trim().toLowerCase();
    const bateTexto =
      !termo ||
      v.marca.toLowerCase().includes(termo) ||
      v.modelo.toLowerCase().includes(termo) ||
      v.versao.toLowerCase().includes(termo) ||
      v.titulo_personalizado.toLowerCase().includes(termo);
    const bateMarca = marcaSelecionada === 'todas' || v.marca === marcaSelecionada;
    return bateTexto && bateMarca;
  });

  // Preserva parâmetros UTM da URL atual ao navegar para a página individual do veículo
  const buildOfertaHref = (slug: string): string => {
    const search = window.location.search;
    return `/ofertas/${slug}${search || ''}`;
  };

  const linkWhatsAppGeral = `https://wa.me/${VENDEDOR_PADRAO_OFERTAS.whatsapp}?text=${encodeURIComponent(
    `Olá, ${VENDEDOR_PADRAO_OFERTAS.nome}! Estou vendo as ofertas da Manos Veículos em Itapema/SC e gostaria de atendimento.`,
  )}`;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans antialiased selection:bg-[#E50914] selection:text-white">
      {/* Header Oficial */}
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <a href="/ofertas" className="flex items-center gap-3">
            <img src={LOGO_MANOS} alt="Manos Veículos" className="h-10 w-auto object-contain" />
          </a>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-200">
              <MapPin className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Itapema/SC</span>
            </span>

            <a
              href={linkWhatsAppGeral}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] font-extrabold text-xs uppercase tracking-wider transition-all"
            >
              <WhatsAppIcon className="w-4 h-4 text-[#0A0A0B]" />
              <span>Falar com Alexandre</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-white/10 bg-gradient-to-b from-[#131318] to-[#0A0A0B] py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-extrabold uppercase tracking-widest">
            <MapPin className="w-3.5 h-3.5" />
            <span>Veículos Disponíveis em Itapema/SC</span>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Ofertas Selecionadas <span className="text-[#E50914]">Manos Veículos</span>
            </h1>
            <p className="text-zinc-300 text-sm sm:text-lg leading-relaxed">
              Escolha o veículo ideal e fale diretamente pelo WhatsApp com nosso vendedor{' '}
              <strong className="text-white">Alexandre</strong>.
            </p>
          </div>

          {/* Barra de Busca e Filtro por Marca */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por marca, modelo ou versão..."
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-[#121216] border border-white/15 text-white placeholder:text-zinc-500 text-sm font-medium focus:outline-none focus:border-[#E50914]"
              />
            </div>

            {marcas.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setMarcaSelecionada('todas')}
                  className={`px-4 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider flex-shrink-0 border transition-all cursor-pointer ${
                    marcaSelecionada === 'todas'
                      ? 'bg-[#E50914] border-[#E50914] text-white'
                      : 'bg-[#121216] border-white/10 text-zinc-300 hover:border-white/25'
                  }`}
                >
                  Todas ({veiculos.length})
                </button>
                {marcas.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMarcaSelecionada(m)}
                    className={`px-4 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider flex-shrink-0 border transition-all cursor-pointer ${
                      marcaSelecionada === m
                        ? 'bg-[#E50914] border-[#E50914] text-white'
                        : 'bg-[#121216] border-white/10 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Grid de Veículos Publicados */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Carregando veículos disponíveis...
            </p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-3xl bg-[#121216] border border-white/10 p-12 text-center max-w-lg mx-auto space-y-4">
            <Car className="w-12 h-12 text-[#E50914] mx-auto opacity-80" />
            <h2 className="text-xl font-extrabold text-white">Nenhum veículo encontrado</h2>
            <p className="text-sm text-zinc-400">
              Não encontramos ofertas com esse filtro no momento. Fale diretamente com o Alexandre
              no WhatsApp para consultar disponibilidade.
            </p>
            <a
              href={linkWhatsAppGeral}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#25D366] text-[#0A0A0B] font-black text-xs uppercase tracking-wider"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>Falar com Alexandre</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filtrados.map((v, idx) => {
              const foto = v.foto_principal || v.fotos[0] || '';
              const anoFmt = formatarAnoVeiculo(v.ano_fabricacao, v.ano_modelo);
              const kmFmt = formatarQuilometragem(v.quilometragem);
              const precoFmt = formatarMoedaBRL(v.preco_venda);
              const hrefOferta = buildOfertaHref(v.slug);
              const waHref = gerarLinkWhatsAppOferta(v);

              return (
                <article
                  key={v.id}
                  className="rounded-2xl sm:rounded-3xl bg-[#121216] border border-white/10 hover:border-[#E50914]/50 overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-xl group"
                >
                  <div>
                    {/* Foto do Veículo */}
                    <a href={hrefOferta} className="block relative aspect-16/10 bg-[#18181D] overflow-hidden">
                      {foto ? (
                        <img
                          src={foto}
                          alt={obterTituloVeiculo(v)}
                          loading={idx < 3 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                          Sem imagem
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0A0A0B]/85 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white">
                        <MapPin className="w-3 h-3 text-[#E50914]" />
                        <span>{v.localizacao || 'Itapema/SC'}</span>
                      </div>
                    </a>

                    {/* Corpo do Card */}
                    <div className="p-5 sm:p-6 space-y-4">
                      <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#E50914]">
                          {v.marca}
                        </span>
                        <h2 className="text-xl font-extrabold text-white leading-snug mt-0.5">
                          <a href={hrefOferta} className="hover:text-[#E50914] transition-colors">
                            {v.marca} {v.modelo}
                          </a>
                        </h2>
                        {v.versao && (
                          <p className="text-xs font-medium text-zinc-400 line-clamp-1 mt-0.5">
                            {v.versao}
                          </p>
                        )}
                      </div>

                      {/* Atributos rápidos */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 font-semibold">
                        {anoFmt && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                            <Calendar className="w-3.5 h-3.5 text-[#E50914]" />
                            {anoFmt}
                          </span>
                        )}
                        {kmFmt && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                            <Gauge className="w-3.5 h-3.5 text-[#E50914]" />
                            {kmFmt}
                          </span>
                        )}
                        {v.cambio && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                            <Settings2 className="w-3.5 h-3.5 text-[#E50914]" />
                            {v.cambio}
                          </span>
                        )}
                      </div>

                      {/* Preço */}
                      <div className="pt-3 border-t border-white/10">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                          Valor à vista
                        </span>
                        <span className="text-2xl font-black text-white tracking-tight">
                          {precoFmt}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 grid grid-cols-2 gap-2.5">
                    <a
                      href={hrefOferta}
                      className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Ver Detalhes</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => registrarCliqueWhatsAppOferta(v)}
                      className="py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#1fb858] text-[#0A0A0B] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <WhatsAppIcon className="w-4 h-4 text-[#0A0A0B]" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 px-4 text-center text-xs text-zinc-500 space-y-2">
        <img
          src={LOGO_MANOS}
          alt="Manos Veículos"
          className="h-8 w-auto object-contain mx-auto opacity-80"
        />
        <p className="text-zinc-400">Manos Veículos • Veículos disponíveis em Itapema/SC</p>
      </footer>
    </div>
  );
}
