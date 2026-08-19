// ---------------------------------------------------------------------------
// Meta Conversions API (envio server-side).
//
// Todos os eventos saíam só do navegador. Entre iOS/ATT e bloqueadores, uma
// fatia relevante nunca chegava — e a Meta otimizava com um retrato incompleto
// de quem converte.
//
// O `event_id` é o mesmo gerado no pixel (src/lib/tracking.ts) e enviado no
// payload do lead: com ele a Meta reconhece que pixel e servidor descrevem a
// MESMA conversão e conta uma só vez. Sem ele, a conversão dobraria.
//
// Configuração: defina META_CAPI_TOKEN no ambiente do servidor (token de acesso
// do Gerenciador de Eventos). Sem token, o envio é ignorado em silêncio — o
// funil nunca quebra por causa de mensuração.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';
import { paraE164 } from './telefone';

const PIXEL_ID = process.env.META_PIXEL_ID || '3253946971444443';
const CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';
const API_VERSION = 'v21.0';
// Código de teste do Gerenciador de Eventos; deixe vazio em produção.
const TEST_CODE = process.env.META_TEST_EVENT_CODE || '';

/** A Meta exige SHA-256 em minúsculas para todo dado pessoal. */
function hash(valor: string): string {
  return createHash('sha256').update(valor.trim().toLowerCase()).digest('hex');
}

export interface EventoCapi {
  eventName: 'Lead' | 'QualifiedLead' | 'ViewContent' | 'AddToCart';
  /** Mesmo id do pixel — sem isto a Meta conta a conversão duas vezes. */
  eventId: string;
  phone?: string;
  firstName?: string;
  city?: string;
  /** IP e user-agent do visitante melhoram a taxa de correspondência. */
  clientIp?: string;
  userAgent?: string;
  /** Cookies do navegador, quando o cliente os enviar. */
  fbp?: string;
  fbc?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  sourceUrl?: string;
}

export function capiConfigurado(): boolean {
  return Boolean(CAPI_TOKEN);
}

/**
 * Envia o evento. Nunca lança: falha de mensuração não pode derrubar a entrega
 * do lead ao consultor.
 */
export async function enviarEventoCapi(evento: EventoCapi): Promise<boolean> {
  if (!CAPI_TOKEN) return false;

  try {
    const userData: Record<string, unknown> = {};

    const telefone = paraE164(evento.phone || '');
    if (telefone) userData.ph = [hash(telefone)];
    if (evento.firstName) userData.fn = [hash(evento.firstName.split(' ')[0])];
    if (evento.city) userData.ct = [hash(evento.city.replace(/\s/g, ''))];
    if (evento.clientIp) userData.client_ip_address = evento.clientIp;
    if (evento.userAgent) userData.client_user_agent = evento.userAgent;
    if (evento.fbp) userData.fbp = evento.fbp;
    if (evento.fbc) userData.fbc = evento.fbc;
    userData.country = [hash('br')];

    const customData: Record<string, unknown> = {
      currency: evento.currency || 'BRL',
      value: evento.value ?? 0,
    };
    if (evento.contentIds?.length) {
      customData.content_ids = evento.contentIds;
      customData.content_type = 'product';
    }
    if (evento.contentName) customData.content_name = evento.contentName;

    const body: Record<string, unknown> = {
      data: [
        {
          event_name: evento.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: evento.eventId,
          action_source: 'website',
          event_source_url: evento.sourceUrl || 'https://manosveiculoscompra.com/',
          user_data: userData,
          custom_data: customData,
        },
      ],
    };
    if (TEST_CODE) body.test_event_code = TEST_CODE;

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(CAPI_TOKEN)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      console.warn(`Meta CAPI respondeu ${res.status}: ${detalhe.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Meta CAPI falhou:', err);
    return false;
  }
}
