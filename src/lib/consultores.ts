// ===========================================================================
// REGISTRO OFICIAL DE CONSULTORES — PÁGINAS INDIVIDUAIS DE ALTA CONVERSÃO
// ===========================================================================

import { type Vehicle } from '../services/stockService';
import { getAttribution } from './attribution';

export interface ConsultorProfile {
  slug: string;
  nome: string;
  nomeExibicao: string;
  cargo: string;
  whatsapp: string; // Somente dígitos com DDI (ex: 5547999173286)
  telefoneFormatado: string; // Ex: (47) 99917-3286
  foto: string;
  fotoPosicao?: string; // classe object-position opcional para enquadramento perfeito
  cidade: string;
  bioCurta: string;
  destaquesCredibilidade: string[];
}

const DESTAQUES_PADRAO = [
  'Negociação direta comigo pelo WhatsApp',
  'Estoque completo 100% revisado e com garantia',
  'Avaliação justa e rápida do seu veículo na troca',
  'Simulação de financiamento nos principais bancos',
];

export const CONSULTORES: Record<string, ConsultorProfile> = {
  wilsinho: {
    slug: 'wilsinho',
    nome: 'Wilsinho',
    nomeExibicao: 'Consultor Wilsinho',
    cargo: 'Consultor Comercial • Manos Veículos',
    whatsapp: '5547999173286',
    telefoneFormatado: '(47) 99917-3286',
    foto: '/consultores/wilsinho.png',
    fotoPosicao: 'object-top',
    cidade: 'Rio do Sul e Região / SC',
    bioCurta:
      'Atendimento direto, transparente e sem burocracia. Escolha qualquer veículo do nosso estoque completo e fale diretamente comigo no WhatsApp para simular financiamento, avaliar seu usado na troca ou agendar sua visita.',
    destaquesCredibilidade: DESTAQUES_PADRAO,
  },
  sergio: {
    slug: 'sergio',
    nome: 'Sérgio',
    nomeExibicao: 'Consultor Sérgio',
    cargo: 'Consultor Comercial • Manos Veículos',
    whatsapp: '5547989141883',
    telefoneFormatado: '(47) 98914-1883',
    foto: '/consultores/sergio.png',
    fotoPosicao: 'object-center',
    cidade: 'Rio do Sul e Região / SC',
    bioCurta:
      'Atendimento direto, transparente e sem burocracia. Escolha qualquer veículo do nosso estoque completo e fale diretamente comigo no WhatsApp para simular financiamento, avaliar seu usado na troca ou agendar sua visita.',
    destaquesCredibilidade: DESTAQUES_PADRAO,
  },
  ledra: {
    slug: 'ledra',
    nome: 'Ledra',
    nomeExibicao: 'Consultor Ledra',
    cargo: 'Consultor Comercial • Manos Veículos',
    whatsapp: '554792864987',
    telefoneFormatado: '(47) 9286-4987',
    foto: '/consultores/ledra.jpg',
    fotoPosicao: 'object-top',
    cidade: 'Rio do Sul e Região / SC',
    bioCurta:
      'Atendimento direto, transparente e sem burocracia. Escolha qualquer veículo do nosso estoque completo e fale diretamente comigo no WhatsApp para simular financiamento, avaliar seu usado na troca ou agendar sua visita.',
    destaquesCredibilidade: DESTAQUES_PADRAO,
  },
  victor: {
    slug: 'victor',
    nome: 'Victor',
    nomeExibicao: 'Consultor Victor',
    cargo: 'Consultor Comercial • Manos Veículos',
    whatsapp: '554788365499',
    telefoneFormatado: '(47) 8836-5499',
    foto: '/consultores/victor.jpg',
    fotoPosicao: 'object-center',
    cidade: 'Rio do Sul e Região / SC',
    bioCurta:
      'Atendimento direto, transparente e sem burocracia. Escolha qualquer veículo do nosso estoque completo e fale diretamente comigo no WhatsApp para simular financiamento, avaliar seu usado na troca ou agendar sua visita.',
    destaquesCredibilidade: DESTAQUES_PADRAO,
  },
  alexandre: {
    slug: 'alexandre',
    nome: 'Alexandre',
    nomeExibicao: 'Consultor Alexandre',
    cargo: 'Consultor Comercial • Manos Veículos',
    whatsapp: '5547988467855',
    telefoneFormatado: '(47) 98846-7855',
    foto: '/consultores/alexandre.jpg',
    fotoPosicao: 'object-center',
    cidade: 'Itapema e Rio do Sul / SC',
    bioCurta:
      'Atendimento direto, transparente e sem burocracia. Escolha qualquer veículo do nosso estoque completo e fale diretamente comigo no WhatsApp para simular financiamento, avaliar seu usado na troca ou agendar sua visita.',
    destaquesCredibilidade: DESTAQUES_PADRAO,
  },
};

export const LISTA_CONSULTORES_OFICIAIS: ConsultorProfile[] = [
  CONSULTORES.wilsinho,
  CONSULTORES.sergio,
  CONSULTORES.ledra,
  CONSULTORES.victor,
  CONSULTORES.alexandre,
];

const ALIAS_CONSULTORES: Record<string, string> = {
  wilsinho: 'wilsinho',
  sergio: 'sergio',
  sérgio: 'sergio',
  ledra: 'ledra',
  victor: 'victor',
  vitor: 'victor',
  alexandre: 'alexandre',
};

export function obterConsultorPorSlug(slug?: string | null): ConsultorProfile | null {
  if (!slug) return null;
  const limpo = decodeURIComponent(slug)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const chave = ALIAS_CONSULTORES[limpo] || limpo;
  return CONSULTORES[chave] || null;
}

export function gerarMensagemWhatsAppConsultor(
  consultor: ConsultorProfile,
  veiculo?: Pick<Vehicle, 'description' | 'year' | 'priceFormatted'> | null,
  acao?: 'interesse' | 'financiamento' | 'troca' | 'geral',
): string {
  if (!veiculo) {
    if (acao === 'troca') {
      return `Olá, ${consultor.nome}! Estou na sua página da Manos Veículos e gostaria de avaliar meu veículo para colocar na troca.`;
    }
    if (acao === 'financiamento') {
      return `Olá, ${consultor.nome}! Estou vendo o estoque na sua página da Manos Veículos e gostaria de fazer uma simulação de financiamento.`;
    }
    return `Olá, ${consultor.nome}! Estou acessando sua página oficial do estoque da Manos Veículos e gostaria de atendimento.`;
  }

  const nomeCarro = `${veiculo.description}${veiculo.year ? ` (${veiculo.year})` : ''}`;
  const precoTexto = veiculo.priceFormatted ? ` anunciado por ${veiculo.priceFormatted}` : '';

  if (acao === 'financiamento') {
    return `Olá, ${consultor.nome}! Vi o ${nomeCarro}${precoTexto} na sua página da Manos Veículos e gostaria de simular o financiamento dele com você.`;
  }
  if (acao === 'troca') {
    return `Olá, ${consultor.nome}! Vi o ${nomeCarro}${precoTexto} na sua página da Manos Veículos e tenho interesse em colocar meu veículo na troca.`;
  }

  return `Olá, ${consultor.nome}! Vi o ${nomeCarro}${precoTexto} na sua página da Manos Veículos e gostaria de mais informações. Ele ainda está disponível?`;
}

export function gerarLinkWhatsAppConsultor(
  consultor: ConsultorProfile,
  veiculo?: Pick<Vehicle, 'description' | 'year' | 'priceFormatted'> | null,
  acao: 'interesse' | 'financiamento' | 'troca' | 'geral' = 'interesse',
): string {
  const numero = consultor.whatsapp.replace(/\D/g, '');
  const msg = gerarMensagemWhatsAppConsultor(consultor, veiculo, acao);
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

/**
 * Registra clique de conversão para o consultor mantendo deduplicação e atribuição UTM.
 * Nunca dispara evento de Purchase em cliques de WhatsApp.
 */
export function registrarConversaoConsultor(
  consultor: ConsultorProfile,
  evento: 'PageView' | 'ViewContent' | 'Contact' | 'WhatsAppClick',
  veiculo?: Vehicle | null,
): void {
  if (typeof window === 'undefined') return;

  const eventId = `cons_${consultor.slug}_${evento.toLowerCase()}_${veiculo?.id || 'index'}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const w = window as any;

  // Meta Pixel (se carregado na página)
  if (typeof w.fbq === 'function') {
    if (evento === 'ViewContent' && veiculo) {
      w.fbq(
        'track',
        'ViewContent',
        {
          content_ids: [String(veiculo.id)],
          content_name: veiculo.description,
          content_type: 'vehicle',
          value: Number(veiculo.price) || 0,
          currency: 'BRL',
          consultant: consultor.slug,
        },
        { eventID: eventId },
      );
    } else if (evento === 'Contact') {
      w.fbq(
        'track',
        'Contact',
        {
          content_ids: veiculo ? [String(veiculo.id)] : [],
          content_name: veiculo ? veiculo.description : `Atendimento ${consultor.nomeExibicao}`,
          content_category: `Consultor ${consultor.nome}`,
          value: veiculo ? Number(veiculo.price) || 0 : 0,
          currency: 'BRL',
        },
        { eventID: eventId },
      );
    }
  }

  // OpenAI Ads Pixel (`oaiq`) — valores em centavos (ISO 4217 minor unit)
  if (typeof w.oaiq === 'function') {
    try {
      const precoReais = veiculo ? Number(veiculo.price) || 0 : 0;
      const centavos = precoReais > 0 ? Math.round(precoReais * 100) : undefined;
      const contentsOpenAi = veiculo
        ? [
            {
              id: String(veiculo.id),
              name: veiculo.description,
              content_type: 'product',
              quantity: 1,
              ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
            },
          ]
        : undefined;

      if (evento === 'ViewContent' && veiculo) {
        w.oaiq(
          'measure',
          'contents_viewed',
          {
            type: 'contents',
            ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
            contents: contentsOpenAi,
          },
          { event_id: eventId },
        );
      } else if (evento === 'Contact') {
        w.oaiq(
          'measure',
          'custom',
          {
            type: 'custom',
            ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
            ...(contentsOpenAi ? { contents: contentsOpenAi } : {}),
          },
          { event_id: eventId, custom_event_name: 'whatsapp' },
        );
      }
    } catch {
      /* noop */
    }
  }

  // Google Analytics 4 (se carregado na página)
  if (typeof w.gtag === 'function') {
    if (evento === 'WhatsAppClick') {
      w.gtag('event', 'generate_lead', {
        event_category: 'whatsapp_consultor',
        event_label: `${consultor.nome} - ${veiculo?.description || 'Geral'}`,
        consultant: consultor.slug,
        value: veiculo ? Number(veiculo.price) || 0 : 0,
        currency: 'BRL',
      });
    } else if (evento === 'ViewContent' && veiculo) {
      w.gtag('event', 'view_item', {
        currency: 'BRL',
        value: Number(veiculo.price) || 0,
        consultant: consultor.slug,
        items: [
          {
            item_id: String(veiculo.id),
            item_name: veiculo.description,
            item_brand: veiculo.brand || '',
            price: Number(veiculo.price) || 0,
          },
        ],
      });
    }
  }

  // Envia para o endpoint de métricas do servidor
  const attr = getAttribution();
  const payload = {
    event_id: eventId,
    evento,
    consultor_slug: consultor.slug,
    consultor_nome: consultor.nome,
    veiculo_id: veiculo ? String(veiculo.id) : null,
    veiculo_slug: veiculo ? veiculo.slug : null,
    veiculo_nome: veiculo ? veiculo.description : `[Consultor ${consultor.nome}] Página Principal`,
    valor_veiculo: veiculo ? Number(veiculo.price) || 0 : null,
    page_url: window.location.href,
    atribuicao: attr,
  };

  try {
    const bodyStr = JSON.stringify(payload);
    if ((evento === 'Contact' || evento === 'WhatsAppClick') && navigator.sendBeacon) {
      const blob = new Blob([bodyStr], { type: 'application/json' });
      navigator.sendBeacon('/api/ofertas/evento', blob);
      return;
    }
    void fetch('/api/ofertas/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}
