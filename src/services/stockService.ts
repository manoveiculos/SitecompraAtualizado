
export interface Vehicle {
  id: string;
  description: string;
  year: string;
  price: number;
  image: string;
  priceFormatted: string;
  km: string;
  link: string; // permalink público do veículo (/estoque/<slug>)
}

const STOCK_XML_URL = '/api/stock';
// Site do funil — usado para montar o permalink de cada veículo, batendo com
// a rota SSR /estoque/<slug> definida em server/catalog.ts.
const SITE_URL = 'https://manosveiculoscompra.com';
const CACHE_KEY = 'manos_veiculos_stock_cache_v4'; // bump ao mudar o shape de Vehicle
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

// Espelha o slugify() de server/catalog.ts para os links do client baterem
// com as páginas geradas no servidor.
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
    const cachedString = localStorage.getItem(CACHE_KEY);
    if (cachedString) {
      const cached: CachedData = JSON.parse(cachedString);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.vehicles;
      }
    }

    const response = await fetch(STOCK_XML_URL);
    if (!response.ok) throw new Error('Falha ao buscar estoque');
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Altimus XML commonly uses <veiculo> tags
    const vehicleNodes = xmlDoc.getElementsByTagName('veiculo');
    const vehicles: Vehicle[] = [];

    for (let i = 0; i < vehicleNodes.length; i++) {
        const node = vehicleNodes[i];
        
        const getTag = (tag: string) => node.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
        
        // Photos extraction: <fotos><imagem>URL</imagem></fotos>
        const fotosNode = node.getElementsByTagName('fotos')[0];
        const firstImage = fotosNode ? fotosNode.getElementsByTagName('imagem')[0]?.textContent?.trim() : '';

        const valorRaw = getTag('valor');
        const price = parseFloat(valorRaw.replace(',', '.') || '0');
        const id = getTag('id') || String(i);
        const description = getTag('descricao');

        vehicles.push({
            id,
            description,
            year: getTag('ano'),
            price: price,
            priceFormatted: price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            image: firstImage || 'https://via.placeholder.com/600x400?text=Manos+Veículos',
            km: getTag('km') ? `${getTag('km')} km` : '0 km',
            link: `${SITE_URL}/estoque/${slugify(description)}-${id}`
        });
    }

    const dataToCache: CachedData = {
      timestamp: Date.now(),
      vehicles
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));

    return vehicles;
  } catch (error) {
    console.error('Error fetching Altimus stock:', error);
    return [];
  }
}
