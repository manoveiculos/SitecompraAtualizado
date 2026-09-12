export interface Vehicle {
  id: string;
  slug: string;
  description: string;
  brand?: string;
  year: string;
  price: number;
  priceFormatted: string;
  km: string;
  image: string;
  images: string[];
  fuel?: string;
  transmission?: string;
  color?: string;
  options?: string[];
  link: string; // permalink público do veículo (/estoque/<slug>)
}

const STOCK_JSON_URL = '/api/stock';
const STOCK_XML_URL = '/api/stock.xml';
const CACHE_KEY = 'manos_veiculos_stock_cache_v7';
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

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

interface CachedData {
  timestamp: number;
  vehicles: Vehicle[];
}

export async function fetchStock(): Promise<Vehicle[]> {
  try {
    // Check localStorage cache (only valid if non-empty)
    const cachedString = localStorage.getItem(CACHE_KEY);
    if (cachedString) {
      const cached: CachedData = JSON.parse(cachedString);
      if (Array.isArray(cached.vehicles) && cached.vehicles.length > 0 && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.vehicles;
      }
    }

    // 1. Try JSON Endpoint first (parsed server-side with full details)
    const response = await fetch(STOCK_JSON_URL);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const vehicles: Vehicle[] = data.map((v: any) => {
          const imgs: string[] = Array.isArray(v.images) && v.images.length > 0
            ? v.images
            : [v.image || 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png'];
          const vSlug = v.slug || `${slugify(v.title || v.description)}-${v.id}`;
          
          return {
            id: String(v.id),
            slug: vSlug,
            description: v.title || v.description,
            brand: v.brand || (v.title || v.description).split(' ')[0],
            year: String(v.year || ''),
            price: Number(v.price || 0),
            priceFormatted: v.priceFormatted || (v.price ? v.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Consulte'),
            image: imgs[0],
            images: imgs,
            km: v.km ? String(v.km) : '0 km',
            fuel: v.fuel || '',
            transmission: v.transmission || '',
            color: v.color || '',
            options: Array.isArray(v.options) ? v.options : [],
            link: `/estoque/${vSlug}`
          };
        });

        // Store non-empty cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), vehicles }));
        return vehicles;
      }
    }

    // 2. Fallback to XML Endpoint parsing
    const xmlResponse = await fetch(STOCK_XML_URL);
    if (!xmlResponse.ok) throw new Error('Falha ao buscar estoque');
    
    const xmlText = await xmlResponse.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const vehicleNodes = xmlDoc.getElementsByTagName('veiculo');
    const vehicles: Vehicle[] = [];

    for (let i = 0; i < vehicleNodes.length; i++) {
      const node = vehicleNodes[i];
      const getTag = (tag: string) => node.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
      
      const fotosNode = node.getElementsByTagName('fotos')[0];
      const imgNodes = fotosNode ? fotosNode.getElementsByTagName('imagem') : null;
      const imgs: string[] = [];
      if (imgNodes) {
        for (let j = 0; j < imgNodes.length; j++) {
          const src = imgNodes[j].textContent?.trim();
          if (src) imgs.push(src);
        }
      }
      if (imgs.length === 0) {
        imgs.push('https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png');
      }

      const optsNode = node.getElementsByTagName('opcionais')[0];
      const optNodes = optsNode ? optsNode.getElementsByTagName('opcional') : null;
      const opts: string[] = [];
      if (optNodes) {
        for (let k = 0; k < optNodes.length; k++) {
          const o = optNodes[k].textContent?.trim();
          if (o) opts.push(o);
        }
      }

      const valorRaw = getTag('valor');
      const price = parseFloat(valorRaw.replace(',', '.') || '0');
      const id = getTag('id') || String(i);
      const description = getTag('descricao');

      if (!id || !description) continue;
      const vSlug = `${slugify(description)}-${id}`;

      vehicles.push({
        id,
        slug: vSlug,
        description,
        brand: getTag('marca') || description.split(' ')[0],
        year: getTag('ano'),
        price,
        priceFormatted: price > 0 ? price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Consulte',
        image: imgs[0],
        images: imgs,
        km: getTag('km') ? `${getTag('km')} km` : '0 km',
        fuel: getTag('combustivel'),
        transmission: getTag('cambio'),
        color: getTag('cor'),
        options: opts,
        link: `/estoque/${vSlug}`
      });
    }

    const ordenados = [...vehicles].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    if (ordenados.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), vehicles: ordenados }));
    }

    return ordenados;
  } catch (error) {
    console.error('Error fetching stock:', error);
    return [];
  }
}
