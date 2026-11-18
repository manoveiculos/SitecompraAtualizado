// Geolocalização e aparelho do visitante, resolvidos no servidor.
//
// Cidade/UF: primeiro pelos headers do CDN (grátis e sem latência), depois por
// uma API de GeoIP. O IP NUNCA é gravado — só cidade/UF/país resultantes — e o
// resultado fica em cache por IP para uma sessão não gerar uma consulta por
// heartbeat. Para desligar a consulta externa: TRAFEGO_GEOIP_FALLBACK=off.

import type { Request } from 'express';

export interface GeoInfo {
  cidade: string | null;
  uf: string | null;
  pais: string | null;
}

const VAZIO: GeoInfo = { cidade: null, uf: null, pais: null };

function header(req: Request, nome: string): string {
  const v = req.headers[nome];
  return String(Array.isArray(v) ? v[0] : v || '').trim();
}

/** Vercel/Cloudflare mandam a cidade URL-encoded ("Rio%20do%20Sul"). */
function decodificar(valor: string): string | null {
  if (!valor) return null;
  try {
    const limpo = decodeURIComponent(valor).trim();
    return limpo && limpo.toLowerCase() !== 'unknown' ? limpo.slice(0, 80) : null;
  } catch {
    return valor.slice(0, 80);
  }
}

/** "SC" / "sc" -> "SC". Nomes por extenso (ex.: "Santa Catarina") viram null para não gravar lixo. */
function normalizarUf(valor: string | null): string | null {
  if (!valor) return null;
  const v = valor.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : null;
}

const UF_POR_NOME: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

function ufDeNome(nome: string | null): string | null {
  if (!nome) return null;
  const chave = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  return UF_POR_NOME[chave] || null;
}

/** Headers de borda: Vercel, Cloudflare e variantes. Devolve null se não há nada útil. */
export function lerGeoHeaders(req: Request): GeoInfo | null {
  const cidade = decodificar(
    header(req, 'x-vercel-ip-city') || header(req, 'cf-ipcity') || header(req, 'x-appengine-city'),
  );
  const regiao =
    header(req, 'x-vercel-ip-country-region') ||
    header(req, 'cf-region-code') ||
    header(req, 'cf-region') ||
    header(req, 'x-appengine-region');
  const pais = (
    header(req, 'x-vercel-ip-country') ||
    header(req, 'cf-ipcountry') ||
    header(req, 'x-appengine-country')
  )
    .toUpperCase()
    .slice(0, 2);

  const uf = normalizarUf(regiao) || ufDeNome(decodificar(regiao));
  if (!cidade && !uf) return null;
  return { cidade, uf, pais: /^[A-Z]{2}$/.test(pais) && pais !== 'XX' ? pais : null };
}

export function ipDoRequest(req: Request): string {
  const cf = header(req, 'cf-connecting-ip');
  if (cf) return cf;
  const xff = header(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

function ipPrivado(ip: string): boolean {
  return (
    !ip ||
    ip === '::1' ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ||
    /^(fc|fd|fe80)/i.test(ip)
  );
}

const CACHE_GEO = new Map<string, { geo: GeoInfo; ts: number }>();
const TTL_GEO_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 3000;

async function consultarGeoIp(ip: string): Promise<GeoInfo> {
  if (process.env.TRAFEGO_GEOIP_FALLBACK === 'off' || ipPrivado(ip)) return VAZIO;

  const hit = CACHE_GEO.get(ip);
  if (hit && Date.now() - hit.ts < TTL_GEO_MS) return hit.geo;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    // ipwho.is: HTTPS, sem chave, resposta com city/region/region_code/country_code.
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,region_code,country_code`, {
      signal: controller.signal,
    });
    const j = (await r.json()) as Record<string, any>;
    const geo: GeoInfo =
      j && j.success !== false
        ? {
            cidade: j.city ? String(j.city).slice(0, 80) : null,
            uf: normalizarUf(j.region_code ? String(j.region_code) : null) || ufDeNome(j.region ? String(j.region) : null),
            pais: j.country_code ? String(j.country_code).toUpperCase().slice(0, 2) : null,
          }
        : VAZIO;

    if (CACHE_GEO.size >= MAX_CACHE) CACHE_GEO.delete(CACHE_GEO.keys().next().value as string);
    // Falha não é cacheada por 24h: tenta de novo em breve.
    CACHE_GEO.set(ip, { geo, ts: geo.cidade || geo.uf ? Date.now() : Date.now() - TTL_GEO_MS + 10 * 60 * 1000 });
    return geo;
  } catch {
    return VAZIO;
  } finally {
    clearTimeout(timer);
  }
}

/** Headers do CDN primeiro; GeoIP só se eles vierem vazios. */
export async function resolverGeo(req: Request): Promise<GeoInfo> {
  const dosHeaders = lerGeoHeaders(req);
  if (dosHeaders?.cidade) return dosHeaders;
  const doIp = await consultarGeoIp(ipDoRequest(req));
  return {
    cidade: dosHeaders?.cidade || doIp.cidade,
    uf: dosHeaders?.uf || doIp.uf,
    pais: dosHeaders?.pais || doIp.pais,
  };
}

// ---------------------------------------------------------------------------
// User-Agent
// ---------------------------------------------------------------------------

export interface AparelhoInfo {
  dispositivo: 'Mobile' | 'Desktop';
  dispositivo_detalhe: string;
  navegador: string;
}

function detectarNavegador(ua: string): string {
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook (in-app)';
  if (/Instagram/i.test(ua)) return 'Instagram (in-app)';
  if (/EdgA?\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/CriOS|Chrome\//i.test(ua)) return 'Chrome';
  if (/FxiOS|Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Outro';
}

export function parseUserAgent(ua: string): AparelhoInfo {
  const u = ua || '';
  const navegador = detectarNavegador(u);

  if (/iPhone/i.test(u)) return { dispositivo: 'Mobile', dispositivo_detalhe: 'iPhone (iOS)', navegador };
  if (/iPad/i.test(u)) return { dispositivo: 'Mobile', dispositivo_detalhe: 'iPad (iOS)', navegador };

  if (/Android/i.test(u)) {
    let marca = 'Android';
    if (/SM-|Samsung|GT-[A-Z]\d/i.test(u)) marca = 'Samsung';
    else if (/Redmi|POCO|Xiaomi|\bMi\s|MIUI/i.test(u)) marca = 'Xiaomi';
    else if (/moto|Motorola|XT\d{4}/i.test(u)) marca = 'Motorola';
    else if (/LG-|LM-/i.test(u)) marca = 'LG';
    else if (/realme|RMX/i.test(u)) marca = 'Realme';
    else if (/Pixel/i.test(u)) marca = 'Google Pixel';
    else if (/ASUS|ZenFone/i.test(u)) marca = 'Asus';
    else if (/Infinix|TECNO|itel/i.test(u)) marca = 'Infinix/Tecno';
    const detalhe = marca === 'Android' ? 'Android' : `${marca} (Android)`;
    const tablet = !/Mobile/i.test(u);
    return { dispositivo: 'Mobile', dispositivo_detalhe: tablet ? `Tablet ${detalhe}` : detalhe, navegador };
  }

  if (/Windows/i.test(u)) return { dispositivo: 'Desktop', dispositivo_detalhe: 'Desktop Windows', navegador };
  if (/Macintosh|Mac OS X/i.test(u)) return { dispositivo: 'Desktop', dispositivo_detalhe: 'Desktop Mac', navegador };
  if (/CrOS/i.test(u)) return { dispositivo: 'Desktop', dispositivo_detalhe: 'Chromebook', navegador };
  if (/Linux/i.test(u)) return { dispositivo: 'Desktop', dispositivo_detalhe: 'Desktop Linux', navegador };

  return {
    dispositivo: /Mobile/i.test(u) ? 'Mobile' : 'Desktop',
    dispositivo_detalhe: /Mobile/i.test(u) ? 'Mobile' : 'Desktop',
    navegador,
  };
}
