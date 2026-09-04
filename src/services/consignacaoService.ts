// Consignação de Veículos — serviço de integração de API
import { getAttribution } from '../lib/attribution';

const SOURCE = 'Consignação - Manos Veículos';

function envelope() {
  return { source: SOURCE, atribuicao: getAttribution(), timestamp: new Date().toISOString() };
}

export interface LeadConsignacao {
  lead_id: string;
  nome: string;
  telefone: string;
  cidade: string;
}

export async function registrarLeadConsignacao(lead: LeadConsignacao): Promise<void> {
  try {
    await fetch('/api/vendas/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, lead_type: 'Consignacao', ...envelope() }),
    });
  } catch (err) {
    console.error('registrarLeadConsignacao error:', err);
  }
}

export async function enviarConsignacao(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/vendas/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, lead_type: 'Consignacao', ...envelope() }),
    });
  } catch (err) {
    console.error('enviarConsignacao error:', err);
  }
}
