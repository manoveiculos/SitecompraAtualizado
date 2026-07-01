// ---------------------------------------------------------------------------
// AEO/SEO catalog (server-rendered) for Manos Veículos.
//
// Goal: give AI answer engines (GPTBot, ClaudeBot, PerplexityBot, Google) and
// classic crawlers fully-rendered HTML + JSON-LD they can read WITHOUT running
// JavaScript. The React app is a client-rendered lead funnel and is invisible
// to those bots; these routes are the indexable surface.
//
// Source of truth is the live Altimus XML feed (same one the funnel proxies).
// Everything is generated on the fly with a short in-memory cache.
// ---------------------------------------------------------------------------

const SITE_URL = 'https://manosveiculoscompra.com';
const FEED_URL =
  'https://estoque.altimus.com.br/api/estoquexml?estoque=997c9e91-40d7-4bec-95cb-68e18a2668a3';

// Dealer (NAP + trust signals) — keep identical everywhere so engines treat
// it as one entity. Ratings/hours/socials are real, confirmed by the owner.
const DEALER = {
  name: 'Manos Veículos',
  legalName: 'Manos Veículos',
  url: SITE_URL,
  mainSite: 'https://manosveiculos.com.br',
  logo: 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png',
  telephone: '+55-47-3300-1352',
  whatsapp: '554733001352',
  street: 'R. Dom Pedro II, 374 - Canoas',
  city: 'Rio do Sul',
  region: 'SC',
  postalCode: '89164-138',
  country: 'BR',
  lat: -27.2207243,
  lng: -49.6539853,
  areaServed: 'Alto Vale do Itajaí, Santa Catarina',
  foundingDate: '2017',
  ratingValue: 4.7,
  reviewCount: 119,
  instagram: 'https://www.instagram.com/manoveiculoss',
  facebook: 'https://www.facebook.com/manoveiculoss',
  maps: 'https://maps.app.goo.gl/jvNA6rrWkouMGHfq5',
  services: [
    'Venda de carros seminovos',
    'Avaliação e compra do seu usado',
    'Troca de veículos',
    'Financiamento de veículos',
  ],
};

export interface FeedVehicle {
  id: string;
  slug: string;
  title: string;
  brand: string;
  year: string;
  price: number;
  priceFormatted: string;
  km: string;
  kmNumber: number;
  color: string;
  fuel: string;
  transmission: string;
  options: string[];
  images: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function escHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Safe to embed inside <script type="application/ld+json">
function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatKm(km: number): string {
  return `${km.toLocaleString('pt-BR')} km`;
}

function detectTransmission(description: string, options: string[]): string {
  const hay = (description + ' ' + options.join(' ')).toLowerCase();
  if (/\baut/.test(hay) || /autom[aá]tic/.test(hay) || /cvt|tiptronic|s-tronic|dsg/.test(hay))
    return 'Automático';
  if (/\bmanual\b|\bmec[aâ]nic/.test(hay)) return 'Manual';
  return '';
}

// ---------------------------------------------------------------------------
// Feed fetching + parsing (with cache)
// ---------------------------------------------------------------------------

let cache: { at: number; vehicles: FeedVehicle[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function parseFeed(xml: string): FeedVehicle[] {
  const blocks = xml
    .split(/<veiculo>/i)
    .slice(1)
    .map((b) => b.split(/<\/veiculo>/i)[0]);

  const vehicles: FeedVehicle[] = [];

  for (const block of blocks) {
    const getTag = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? decodeEntities(m[1]) : '';
    };
    const getAll = (tag: string): string[] => {
      const out: string[] = [];
      const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(block)) !== null) out.push(decodeEntities(m[1]));
      return out.filter(Boolean);
    };

    const id = getTag('id');
    const description = getTag('descricao');
    if (!id || !description) continue;

    const price = parseFloat((getTag('valor') || '0').replace(',', '.')) || 0;
    const kmNumber = parseInt((getTag('km') || '0').replace(/\D/g, ''), 10) || 0;
    const options = getAll('opcional');
    const images = getAll('imagem');
    const brand = description.split(/\s|-/)[0] || 'Manos Veículos';

    vehicles.push({
      id,
      slug: `${slugify(description)}-${id}`,
      title: description,
      brand,
      year: getTag('ano'),
      price,
      priceFormatted: price > 0 ? formatBRL(price) : 'Consulte',
      km: formatKm(kmNumber),
      kmNumber,
      color: getTag('cor'),
      fuel: getTag('combustivel'),
      transmission: detectTransmission(description, options),
      options,
      images,
      description,
    });
  }

  return vehicles;
}

export async function getVehicles(): Promise<FeedVehicle[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.vehicles;
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`Feed responded ${res.status}`);
    const xml = await res.text();
    const vehicles = parseFeed(xml);
    cache = { at: Date.now(), vehicles };
    return vehicles;
  } catch (err) {
    console.error('Altimus feed error:', err);
    return cache?.vehicles ?? [];
  }
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

function autoDealerNode() {
  return {
    '@type': 'AutoDealer',
    '@id': `${SITE_URL}/#dealer`,
    name: DEALER.name,
    description: `Concessionária de carros seminovos em ${DEALER.city}/${DEALER.region}, atuando desde ${DEALER.foundingDate}. Compra, venda, troca e financiamento no ${DEALER.areaServed}.`,
    url: DEALER.url,
    logo: DEALER.logo,
    image: DEALER.logo,
    telephone: DEALER.telephone,
    priceRange: 'R$$',
    foundingDate: DEALER.foundingDate,
    address: {
      '@type': 'PostalAddress',
      streetAddress: DEALER.street,
      addressLocality: DEALER.city,
      addressRegion: DEALER.region,
      postalCode: DEALER.postalCode,
      addressCountry: DEALER.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: DEALER.lat, longitude: DEALER.lng },
    hasMap: DEALER.maps,
    areaServed: DEALER.areaServed,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: DEALER.ratingValue,
      reviewCount: DEALER.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '19:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '08:00',
        closes: '13:00',
      },
    ],
    makesOffer: DEALER.services.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s },
    })),
    knowsAbout: ['Carros seminovos', 'Financiamento de veículos', 'Avaliação de usados', 'Troca de carros'],
    sameAs: [DEALER.mainSite, DEALER.maps, DEALER.instagram, DEALER.facebook],
  };
}

function vehicleSchema(v: FeedVehicle) {
  const url = `${SITE_URL}/estoque/${v.slug}`;
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: v.title,
    description: `${v.title}. Seminovo revisado disponível na Manos Veículos em ${DEALER.city}/${DEALER.region}.`,
    url,
    brand: { '@type': 'Brand', name: v.brand },
    vehicleModelDate: v.year || undefined,
    itemCondition: 'https://schema.org/UsedCondition',
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: v.kmNumber, unitCode: 'KMT' },
    image: v.images.length ? v.images : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: v.price || undefined,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      url,
      seller: autoDealerNode(),
    },
  };
  if (v.color) node.color = v.color;
  if (v.fuel) node.fuelType = v.fuel;
  if (v.transmission) node.vehicleTransmission = v.transmission;
  return node;
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

const BASE_CSS = `
*{box-sizing:border-box}body{margin:0;background:#0A0A0A;color:#fff;font-family:Inter,system-ui,Arial,sans-serif;line-height:1.5}
a{color:#ED1C24;text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1100px;margin:0 auto;padding:24px 20px 80px}
header{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid #1c1c1c}
header img{height:34px}.muted{color:#9a9a9a}.small{font-size:13px}
nav.nav{margin-left:auto;display:flex;gap:18px}nav.nav a{color:#cfcfcf;font-weight:600}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:18px 0}
.fact{background:#141414;border:1px solid #1f1f1f;border-radius:14px;padding:14px 16px}
.fact b{display:block;font-size:13px;color:#9a9a9a;font-weight:600;margin-bottom:4px}
.faq{background:#141414;border:1px solid #1f1f1f;border-radius:14px;padding:16px 18px;margin:12px 0}
.faq h3{margin:0 0 8px;font-size:16px}.faq p{margin:0;color:#cfcfcf}
h1{font-size:28px;font-weight:800;letter-spacing:-.02em;margin:18px 0 6px}
h2{font-size:20px;font-weight:800;margin:28px 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:18px}
.card{background:#141414;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;display:block}
.card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#1f1f1f}
.card .body{padding:12px 14px}.card h3{font-size:15px;margin:0 0 6px;font-weight:700;color:#fff}
.price{color:#ED1C24;font-weight:800;font-size:18px}
.specs{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.chip{background:#141414;border:1px solid #1f1f1f;border-radius:999px;padding:6px 12px;font-size:13px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:14px 0}
.gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;background:#1f1f1f}
.cta{display:inline-block;background:#ED1C24;color:#fff;font-weight:800;padding:14px 22px;border-radius:14px;margin-top:8px}
.cta.alt{background:#1f7a33}
ul.opts{columns:2;gap:24px;padding-left:18px}@media(max-width:600px){ul.opts{columns:1}}
footer{border-top:1px solid #1c1c1c;margin-top:40px;padding:24px 20px;color:#7a7a7a;font-size:13px}
nav.bc{font-size:13px;margin:8px 0 0}
`;

function layout(opts: {
  title: string;
  description: string;
  canonical: string;
  jsonLdBlocks: string[];
  body: string;
  ogImage?: string;
}): string {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escHtml(opts.title)}</title>`,
    `<meta name="description" content="${escHtml(opts.description)}">`,
    `<link rel="canonical" href="${escHtml(opts.canonical)}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escHtml(DEALER.name)}">`,
    `<meta property="og:title" content="${escHtml(opts.title)}">`,
    `<meta property="og:description" content="${escHtml(opts.description)}">`,
    `<meta property="og:url" content="${escHtml(opts.canonical)}">`,
    opts.ogImage ? `<meta property="og:image" content="${escHtml(opts.ogImage)}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    `<style>${BASE_CSS}</style>`,
    ...opts.jsonLdBlocks.map(
      (b) => `<script type="application/ld+json">${b}</script>`
    ),
  ].join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
${head}
</head>
<body>
<header>
  <a href="/estoque"><img src="${DEALER.logo}" alt="${escHtml(DEALER.name)}"></a>
  <nav class="nav small">
    <a href="/estoque">Estoque</a>
    <a href="/sobre">A Manos</a>
    <a href="/perguntas-frequentes">Dúvidas</a>
  </nav>
</header>
<div class="wrap">
${opts.body}
</div>
<footer>
  <strong>${escHtml(DEALER.name)}</strong> — ${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}.<br>
  WhatsApp ${escHtml(DEALER.telephone)} • <a href="${DEALER.mainSite}">${DEALER.mainSite.replace('https://', '')}</a>
</footer>
</body>
</html>`;
}

export function renderCatalog(vehicles: FeedVehicle[]): string {
  const canonical = `${SITE_URL}/estoque`;
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Estoque de seminovos — Manos Veículos',
    numberOfItems: vehicles.length,
    itemListElement: vehicles.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/estoque/${v.slug}`,
      name: v.title,
    })),
  };

  const cards = vehicles
    .map(
      (v) => `
  <a class="card" href="/estoque/${escHtml(v.slug)}">
    ${v.images[0] ? `<img src="${escHtml(v.images[0])}" alt="${escHtml(v.title)}" loading="lazy">` : ''}
    <div class="body">
      <h3>${escHtml(v.title)}</h3>
      <div class="muted small">${escHtml(v.year)} • ${escHtml(v.km)}${v.fuel ? ' • ' + escHtml(v.fuel) : ''}</div>
      <div class="price">${escHtml(v.priceFormatted)}</div>
    </div>
  </a>`
    )
    .join('\n');

  const body = `
  <h1>Carros seminovos em ${escHtml(DEALER.city)}/${DEALER.region}</h1>
  <p class="muted">${vehicles.length} veículos disponíveis no estoque da ${escHtml(DEALER.name)}, revenda no ${escHtml(DEALER.areaServed)}. Atualizado em tempo real.</p>
  <a class="cta" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Vi o estoque no site e quero falar com um consultor.')}">Falar com consultor no WhatsApp</a>
  <div class="grid">
  ${cards}
  </div>`;

  return layout({
    title: `Estoque de Seminovos em ${DEALER.city}/${DEALER.region} | ${DEALER.name}`,
    description: `Confira ${vehicles.length} carros seminovos revisados na ${DEALER.name}, em ${DEALER.city}/${DEALER.region}. Compra, troca e financiamento no Alto Vale do Itajaí.`,
    canonical,
    ogImage: vehicles[0]?.images[0] || DEALER.logo,
    jsonLdBlocks: [jsonLd(autoDealerNode()), jsonLd(itemList)],
    body,
  });
}

export function renderVehicle(v: FeedVehicle): string {
  const canonical = `${SITE_URL}/estoque/${v.slug}`;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Estoque', item: `${SITE_URL}/estoque` },
      { '@type': 'ListItem', position: 2, name: v.title, item: canonical },
    ],
  };

  const specs = [
    v.year && `<span class="chip">Ano ${escHtml(v.year)}</span>`,
    v.km && `<span class="chip">${escHtml(v.km)}</span>`,
    v.fuel && `<span class="chip">${escHtml(v.fuel)}</span>`,
    v.transmission && `<span class="chip">${escHtml(v.transmission)}</span>`,
    v.color && `<span class="chip">Cor ${escHtml(v.color)}</span>`,
  ]
    .filter(Boolean)
    .join('\n');

  const gallery = v.images
    .slice(0, 12)
    .map((src) => `<img src="${escHtml(src)}" alt="${escHtml(v.title)}" loading="lazy">`)
    .join('\n');

  const opts = v.options.length
    ? `<h2>Opcionais</h2><ul class="opts">${v.options
        .map((o) => `<li>${escHtml(o)}</li>`)
        .join('')}</ul>`
    : '';

  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> › <span class="muted">${escHtml(v.title)}</span></nav>
  <h1>${escHtml(v.title)}</h1>
  <div class="price" style="font-size:26px">${escHtml(v.priceFormatted)}</div>
  <div class="specs">${specs}</div>
  <a class="cta" href="${SITE_URL}/?id=${encodeURIComponent(v.id)}">Tenho interesse — receber proposta</a>
  &nbsp;
  <a class="cta alt" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Tenho interesse no ' + v.title + ' (' + canonical + ')')}">WhatsApp</a>
  ${gallery ? `<h2>Fotos</h2><div class="gallery">${gallery}</div>` : ''}
  <h2>Sobre este veículo</h2>
  <p>${escHtml(v.title)} à venda na <strong>${escHtml(DEALER.name)}</strong>, em ${escHtml(DEALER.city)}/${DEALER.region}. Veículo seminovo${v.km ? ` com ${escHtml(v.km)}` : ''}${v.fuel ? `, motor ${escHtml(v.fuel)}` : ''}${v.transmission ? `, câmbio ${escHtml(v.transmission)}` : ''}. Aceitamos seu usado na troca e oferecemos financiamento.</p>
  ${opts}`;

  return layout({
    title: `${v.title} — ${v.priceFormatted} | ${DEALER.name}`,
    description: `${v.title} por ${v.priceFormatted} na ${DEALER.name}, ${DEALER.city}/${DEALER.region}.${v.km ? ' ' + v.km + '.' : ''} Compra, troca e financiamento.`,
    canonical,
    ogImage: v.images[0] || DEALER.logo,
    jsonLdBlocks: [jsonLd(vehicleSchema(v)), jsonLd(breadcrumb)],
    body,
  });
}

// Conversational Q&A — the long-tail queries people ask AI assistants.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'A Manos Veículos é confiável?',
    a: `Sim. A ${DEALER.name} é uma concessionária de seminovos com loja física em ${DEALER.city}/${DEALER.region}, atuando desde ${DEALER.foundingDate}, com nota ${String(DEALER.ratingValue).replace('.', ',')} no Google em ${DEALER.reviewCount} avaliações. Todos os veículos passam por revisão antes da venda.`,
  },
  {
    q: 'Onde fica a Manos Veículos?',
    a: `A loja fica na ${DEALER.street}, ${DEALER.city}/${DEALER.region}, CEP ${DEALER.postalCode}. Atendemos clientes de todo o ${DEALER.areaServed}.`,
  },
  {
    q: 'Qual o horário de funcionamento da Manos Veículos?',
    a: 'Segunda a sexta das 8h às 19h (sem fechar ao meio-dia) e aos sábados das 8h às 13h.',
  },
  {
    q: 'A Manos Veículos aceita meu carro usado na troca?',
    a: 'Sim. Avaliamos o seu usado e aceitamos como parte do pagamento na compra de outro veículo, com avaliação justa e na hora.',
  },
  {
    q: 'A Manos Veículos faz financiamento de seminovos?',
    a: 'Sim. Trabalhamos com financiamento de veículos, simulação de parcelas e aprovação de crédito, inclusive com opções de entrada facilitada.',
  },
  {
    q: 'Como ver o estoque de carros da Manos Veículos?',
    a: `O estoque completo e atualizado em tempo real está em ${SITE_URL}/estoque, com fotos, preço, ano e quilometragem de cada veículo.`,
  },
  {
    q: 'Como falar com um consultor da Manos Veículos?',
    a: `Pelo WhatsApp ${DEALER.telephone} ou diretamente em ${SITE_URL}, onde você recebe uma proposta personalizada.`,
  },
];

export function renderAbout(): string {
  const canonical = `${SITE_URL}/sobre`;
  const schema = { '@context': 'https://schema.org', ...autoDealerNode() };

  const facts = [
    ['Avaliação no Google', `${String(DEALER.ratingValue).replace('.', ',')} ★ (${DEALER.reviewCount} avaliações)`],
    ['Desde', DEALER.foundingDate],
    ['Endereço', `${DEALER.street}, ${DEALER.city}/${DEALER.region}`],
    ['Horário', 'Seg a Sex 8h–19h • Sáb 8h–13h'],
    ['Atendemos', DEALER.areaServed],
    ['WhatsApp', DEALER.telephone],
  ]
    .map(([k, v]) => `<div class="fact"><b>${escHtml(k)}</b>${escHtml(v)}</div>`)
    .join('\n');

  const services = DEALER.services.map((s) => `<li>${escHtml(s)}</li>`).join('');

  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> › <span class="muted">A Manos</span></nav>
  <h1>Manos Veículos — concessionária de seminovos em ${escHtml(DEALER.city)}/${DEALER.region}</h1>
  <p class="muted">Desde ${escHtml(DEALER.foundingDate)}, a ${escHtml(DEALER.name)} é referência em carros seminovos no ${escHtml(DEALER.areaServed)}, com nota ${String(DEALER.ratingValue).replace('.', ',')} no Google em ${DEALER.reviewCount} avaliações.</p>
  <div class="facts">${facts}</div>
  <a class="cta" href="/estoque">Ver estoque de seminovos</a>
  &nbsp;
  <a class="cta alt" href="https://wa.me/${DEALER.whatsapp}?text=${encodeURIComponent('Olá! Quero falar com um consultor da Manos Veículos.')}">WhatsApp</a>
  <h2>O que a Manos oferece</h2>
  <ul class="opts">${services}</ul>
  <h2>Sobre a Manos Veículos</h2>
  <p>A ${escHtml(DEALER.name)} é uma concessionária de veículos seminovos localizada em ${escHtml(DEALER.city)}, Santa Catarina, na ${escHtml(DEALER.street)}. Atuando desde ${escHtml(DEALER.foundingDate)}, atende compradores de todo o ${escHtml(DEALER.areaServed)} com compra, venda, troca e financiamento de carros. O estoque é atualizado em tempo real em <a href="/estoque">${SITE_URL}/estoque</a>.</p>`;

  return layout({
    title: `Sobre a Manos Veículos — Seminovos em ${DEALER.city}/${DEALER.region}`,
    description: `Manos Veículos: concessionária de seminovos em ${DEALER.city}/${DEALER.region} desde ${DEALER.foundingDate}, nota ${String(DEALER.ratingValue).replace('.', ',')} no Google (${DEALER.reviewCount} avaliações). Compra, troca e financiamento.`,
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [jsonLd(schema)],
    body,
  });
}

export function renderFAQ(): string {
  const canonical = `${SITE_URL}/perguntas-frequentes`;
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const items = FAQS.map(
    (f) => `<div class="faq"><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`
  ).join('\n');

  const body = `
  <nav class="bc"><a href="/estoque">Estoque</a> › <span class="muted">Dúvidas frequentes</span></nav>
  <h1>Perguntas frequentes — Manos Veículos</h1>
  <p class="muted">Tudo sobre comprar, vender, trocar e financiar seu carro na ${escHtml(DEALER.name)}, em ${escHtml(DEALER.city)}/${DEALER.region}.</p>
  ${items}
  <a class="cta" href="/estoque">Ver estoque de seminovos</a>`;

  return layout({
    title: `Perguntas Frequentes — Manos Veículos (${DEALER.city}/${DEALER.region})`,
    description: `Respostas sobre a Manos Veículos: confiança, localização, horário, troca, financiamento e estoque de seminovos em ${DEALER.city}/${DEALER.region}.`,
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [jsonLd(faqSchema)],
    body,
  });
}

export function renderPrivacy(): string {
  const canonical = `${SITE_URL}/politica-de-privacidade`;
  const body = `
  <nav class="bc"><a href="/estoque">Início</a> › <span class="muted">Política de Privacidade</span></nav>
  <h1>Política de Privacidade</h1>
  <p class="muted">Última atualização: julho de 2026. Esta política explica como a ${escHtml(DEALER.legalName)} coleta, usa e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>

  <h2>1. Quem somos</h2>
  <p>A ${escHtml(DEALER.name)} é uma concessionária de veículos seminovos localizada em ${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}. Somos a controladora dos dados coletados neste site.</p>

  <h2>2. Dados que coletamos</h2>
  <p>Ao preencher nosso formulário de avaliação para venda do seu veículo, coletamos:</p>
  <ul>
    <li><strong>Dados de contato:</strong> nome, telefone e cidade.</li>
    <li><strong>Dados do veículo:</strong> placa, marca, modelo, ano, quilometragem, cor e o valor desejado.</li>
  </ul>
  <p>Também podemos coletar automaticamente dados de navegação (endereço IP, tipo de dispositivo e páginas visitadas) por meio de cookies e tecnologias similares.</p>

  <h2>3. Como usamos seus dados</h2>
  <ul>
    <li>Avaliar seu veículo e elaborar uma proposta comercial de compra.</li>
    <li>Permitir que nossa equipe comercial entre em contato por telefone.</li>
    <li>Melhorar nossos serviços e a sua experiência no site.</li>
    <li>Mensurar e otimizar nossas campanhas de anúncios.</li>
  </ul>

  <h2>4. Cookies e anúncios (Google e Meta/Facebook)</h2>
  <p>Utilizamos cookies e pixels de rastreamento, que podem incluir Google Ads, Google Analytics e Meta (Facebook/Instagram) Pixel, para medir a eficácia dos nossos anúncios e exibir ofertas relevantes. Esses parceiros tratam dados conforme suas próprias políticas de privacidade. Você pode gerenciar ou bloquear cookies nas configurações do seu navegador.</p>

  <h2>5. Compartilhamento de dados</h2>
  <p>Nós não vendemos seus dados pessoais. Podemos compartilhá-los com prestadores de serviço que nos apoiam (por exemplo, ferramentas de CRM e automação) e com plataformas de anúncios (Google e Meta), exclusivamente para as finalidades descritas acima e com as devidas medidas de segurança.</p>

  <h2>6. Por quanto tempo guardamos</h2>
  <p>Mantemos seus dados apenas pelo tempo necessário às finalidades descritas ou conforme exigido por lei. Depois disso, eles são excluídos ou anonimizados.</p>

  <h2>7. Seus direitos (LGPD)</h2>
  <p>Você pode, a qualquer momento, solicitar: confirmação e acesso aos seus dados, correção, anonimização, portabilidade, exclusão e revogação do consentimento. Para exercer esses direitos, entre em contato conosco pelos canais abaixo.</p>

  <h2>8. Segurança</h2>
  <p>Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou alteração.</p>

  <h2>9. Contato</h2>
  <p>${escHtml(DEALER.name)}<br>${escHtml(DEALER.street)}, ${escHtml(DEALER.city)}/${DEALER.region}, ${escHtml(DEALER.postalCode)}<br>Telefone: ${escHtml(DEALER.telephone)}</p>

  <a class="cta" href="/vendasrapidas">Voltar e avaliar meu carro</a>`;

  return layout({
    title: 'Política de Privacidade — Manos Veículos',
    description: 'Como a Manos Veículos coleta, usa e protege seus dados pessoais (LGPD), incluindo cookies e anúncios do Google e da Meta/Facebook.',
    canonical,
    ogImage: DEALER.logo,
    jsonLdBlocks: [],
    body,
  });
}

export function renderLlms(vehicles: FeedVehicle[]): string {
  return `# Manos Veículos

> Concessionária de carros seminovos em ${DEALER.city}/${DEALER.region}, Brasil, desde ${DEALER.foundingDate}. Nota ${String(DEALER.ratingValue).replace('.', ',')}/5 no Google (${DEALER.reviewCount} avaliações). Compra, venda, troca e financiamento de veículos no ${DEALER.areaServed}.

## Contato
- Endereço: ${DEALER.street}, ${DEALER.city}/${DEALER.region}, ${DEALER.postalCode}, Brasil
- WhatsApp/Telefone: ${DEALER.telephone}
- Horário: Segunda a sexta 8h-19h; Sábado 8h-13h
- Site: ${SITE_URL}
- Google Maps: ${DEALER.maps}
- Instagram: ${DEALER.instagram}
- Facebook: ${DEALER.facebook}

## Páginas principais
- Estoque de seminovos (atualizado em tempo real): ${SITE_URL}/estoque
- Sobre a empresa: ${SITE_URL}/sobre
- Perguntas frequentes: ${SITE_URL}/perguntas-frequentes
- Sitemap: ${SITE_URL}/sitemap.xml

## Serviços
${DEALER.services.map((s) => `- ${s}`).join('\n')}

## Estoque atual
${vehicles.length} veículos disponíveis no momento.
`;
}

export function renderSitemap(vehicles: FeedVehicle[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, priority: '0.8' },
    { loc: `${SITE_URL}/estoque`, priority: '0.9' },
    { loc: `${SITE_URL}/sobre`, priority: '0.7' },
    { loc: `${SITE_URL}/perguntas-frequentes`, priority: '0.7' },
    ...vehicles.map((v) => ({ loc: `${SITE_URL}/estoque/${v.slug}`, priority: '0.7' })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export function renderRobots(): string {
  // Allow AI answer engines + classic crawlers; expose the sitemap.
  return `User-agent: *
Allow: /

# AI answer engines
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export function findBySlug(vehicles: FeedVehicle[], slug: string): FeedVehicle | undefined {
  const direct = vehicles.find((v) => v.slug === slug);
  if (direct) return direct;
  const id = slug.split('-').pop();
  return vehicles.find((v) => v.id === id);
}
