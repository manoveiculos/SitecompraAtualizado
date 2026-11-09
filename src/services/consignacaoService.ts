// Consignação de Veículos — serviço de integração de API
import { getAttribution } from '../lib/attribution';
import { idDoVisitante } from '../lib/visitante';
import { identificarVisitante, trackLead, trackLeadParcial } from '../lib/tracking';

const SOURCE = 'Consignação - Manos Veículos';

function envelope() {
  return {
    source: SOURCE,
    source_url: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined,
    atribuicao: getAttribution(),
    external_id: idDoVisitante(),
    timestamp: new Date().toISOString(),
  };
}

export interface LeadConsignacao {
  lead_id: string;
  nome: string;
  telefone: string;
  cidade: string;
}

export async function registrarLeadConsignacao(lead: LeadConsignacao): Promise<void> {
  try {
    identificarVisitante({ nome: lead.nome, telefone: lead.telefone, cidade: lead.cidade });
    const eventId = trackLeadParcial({ tipo: 'Consignacao' });
    await fetch('/api/vendas/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, event_id: eventId, lead_type: 'Consignacao', ...envelope() }),
    });
  } catch (err) {
    console.error('registrarLeadConsignacao error:', err);
  }
}

export async function enviarConsignacao(payload: Record<string, unknown>): Promise<void> {
  const nome = String(payload.nome || '');
  const telefone = String(payload.telefone || '');
  const cidade = String(payload.cidade || '');
  const valorDesejado = Number(payload.valor_desejado) || null;
  const nomeVeiculo = [payload.marca, payload.modelo].filter(Boolean).join(' ') || null;

  identificarVisitante({ nome, telefone, cidade });
  const eventId =
    (typeof payload.event_id === 'string' && payload.event_id) ||
    trackLead({
      tipo: 'Consignacao',
      valor: valorDesejado,
      vehicleName: nomeVeiculo,
    });

  // 1. Dispara envio direto para o Webhook de Consignação do n8n
  try {
    await fetch('https://n8n.drivvoo.com/webhook/b1189edc-130f-4ab7-a748-c5901658b746', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'lead_consignacao_completo',
        event_id: eventId,
        enviadoEm: new Date().toISOString(),
        ...payload,
        ...envelope(),
      }),
    });
  } catch (err) {
    console.warn('Erro ao enviar webhook n8n de consignação:', err);
  }

  // 2. Dispara registro no servidor interno para scoring, Meta CAPI e OpenAI Ads CAPI
  try {
    await fetch('/api/vendas/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        event_id: eventId,
        tipo: 'consignacao',
        lead_type: 'Consignacao',
        ...envelope(),
      }),
    });
  } catch (err) {
    console.error('enviarConsignacao internal error:', err);
  }
}
