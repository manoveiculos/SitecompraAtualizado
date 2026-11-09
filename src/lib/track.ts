/**
 * Unified Analytics & Event Tracker
 *
 * Conecta os eventos da camada de UI (`track(...)`) aos pixels de mídia paga
 * (OpenAI Ads `oaiq`, Meta `fbq`, GTM `dataLayer`) e ao Conversions API
 * server-side (`/api/ads/conversao`).
 */

import {
  registrarAcaoJornada,
  trackContato,
  trackPlacaConsultada,
  trackSelectVehicle,
  trackViewVehicle,
} from './tracking';

export function track(evento: string, props: Record<string, any> = {}): void {
  const payload = {
    evento,
    timestamp: new Date().toISOString(),
    pagina: typeof window !== 'undefined' ? window.location.pathname : '/',
    ...props,
  };

  if ((import.meta as any).env?.DEV) {
    console.log('[TRACK EVENT]', payload);
  }

  try {
    // Custom DOM Event dispatch
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('manos_track', { detail: payload }));
    }

    const idVeiculo = props.id ?? props.vehicleId ?? null;
    const nomeVeiculo = props.modelo ?? props.name ?? props.description ?? props.vehicleName ?? null;
    const precoVeiculo = Number(props.preco ?? props.price ?? 0) || undefined;

    // Ponte direta com a camada de conversão (OpenAI Ads + Meta + CAPI)
    if (
      evento === 'whatsapp_click' ||
      evento === 'veiculo_whatsapp_click' ||
      evento === 'consignacao_whatsapp_click'
    ) {
      const contexto = String(props.context || props.source || props.pagina || evento);
      trackContato('whatsapp', contexto, {
        vehicleId: idVeiculo,
        vehicleName: nomeVeiculo,
        valor: precoVeiculo,
      });
      return;
    }

    if (evento === 'phone_click') {
      const contexto = String(props.context || props.source || props.pagina || 'site');
      trackContato('telefone', contexto, {
        vehicleId: idVeiculo,
        vehicleName: nomeVeiculo,
        valor: precoVeiculo,
      });
      return;
    }

    if (evento === 'view_vehicle_detail' && idVeiculo) {
      trackViewVehicle({
        id: String(idVeiculo),
        description: String(nomeVeiculo || idVeiculo),
        price: precoVeiculo || 0,
      });
      return;
    }

    if ((evento === 'select_vehicle_card' || evento === 'estoque_card_click') && idVeiculo) {
      trackSelectVehicle({
        id: String(idVeiculo),
        description: String(nomeVeiculo || idVeiculo),
        price: precoVeiculo || 0,
      });
      return;
    }

    if (evento === 'plate_lookup_success' || evento === 'placa_lookup_success') {
      trackPlacaConsultada(true);
    } else if (evento === 'plate_lookup_not_found') {
      trackPlacaConsultada(false);
    } else if (evento === 'sim_start' || evento === 'sim_submit') {
      registrarAcaoJornada('simulacao', {
        valor_veiculo: Number(props.valorVeiculo) || null,
        detalhe:
          evento === 'sim_submit'
            ? `Enviou simulação de financiamento (Entrada R$ ${Number(props.entrada || 0).toLocaleString('pt-BR')})`
            : 'Iniciou simulador de financiamento',
      });
    } else if (
      evento === 'consultor_open' ||
      evento === 'consultor_gate_success' ||
      evento === 'consultor_final_handoff'
    ) {
      registrarAcaoJornada('consultor_ia', {
        detalhe:
          evento === 'consultor_final_handoff'
            ? `Transferiu conversa do Consultor IA para WhatsApp`
            : evento === 'consultor_gate_success'
              ? `Iniciou chat com Consultor IA`
              : `Abriu o Consultor IA`,
      });
    }

    // Google Tag Manager / Analytics dataLayer if present
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push({ event: evento, ...props });
    }
  } catch {
    /* noop fallback */
  }
}

export const trackEvent = track;
