
export interface Vehicle {
  id: string;
  description: string;
  year: string;
  price: number;
  image: string;
  priceFormatted: string;
  km: string;
}

const STOCK_XML_URL = '/api/stock';
const CACHE_KEY = 'manos_veiculos_stock_cache_v3';
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

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

        vehicles.push({
            id: getTag('id') || String(i),
            description: getTag('descricao'),
            year: getTag('ano'),
            price: price,
            priceFormatted: price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            image: firstImage || 'https://via.placeholder.com/600x400?text=Manos+Veículos',
            km: getTag('km') ? `${getTag('km')} km` : '0 km'
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
