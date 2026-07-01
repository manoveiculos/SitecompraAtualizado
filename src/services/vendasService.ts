// Vendas Rápidas — chamadas ao backend (proxy Express).
// Os webhooks n8n e o token da API de placas ficam no servidor (server.ts),
// nunca expostos no bundle do navegador.

const SOURCE = 'Vendas Rápidas - Manos Veículos';

export interface VeiculoPlaca {
  marca: string;
  modelo: string;
  versao: string;
  ano: string;
  cor: string;
  combustivel: string;
  municipio: string;
  uf: string;
  fipeValor: string;
  logo: string;
}

export interface LeadVenda {
  nome: string;
  telefone: string;
  cidade: string;
}

/**
 * Step 1: captura inicial (nome/telefone/cidade). Enviada cedo para que, mesmo
 * se o cliente desistir adiante, o contato já esteja registrado. Não lança erro
 * para não travar o funil.
 */
export async function registrarLeadVenda(lead: LeadVenda): Promise<void> {
  try {
    await fetch('/api/vendas/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, source: SOURCE, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error('registrarLeadVenda error:', err);
  }
}

/**
 * Consulta a placa via proxy do servidor. Sempre resolve (nunca lança) para que
 * a UI possa oferecer "continuar sem placa" em qualquer falha.
 */
export async function consultarPlaca(
  placa: string,
): Promise<{ ok: boolean; veiculo?: VeiculoPlaca; error?: string }> {
  try {
    const r = await fetch(`/api/placa/${encodeURIComponent(placa)}`);
    return (await r.json()) as { ok: boolean; veiculo?: VeiculoPlaca; error?: string };
  } catch (err) {
    console.error('consultarPlaca error:', err);
    return { ok: false, error: 'Erro ao consultar a placa. Você pode seguir sem ela.' };
  }
}

/**
 * Final: envia todos os dados coletados para a equipe de compras. Não lança erro
 * para não impedir a tela de agradecimento (o contato já foi capturado no step 1).
 */
export async function enviarVenda(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/vendas/finalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, source: SOURCE, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error('enviarVenda error:', err);
  }
}
