import { collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';

const WEBHOOK_LEAD = '/api/bolao/lead';
const WEBHOOK_FINALIZAR = '/api/bolao/finalizar';
const COLLECTION_NAME = 'bolao_palpites_manos';

/**
 * Normalize a Brazilian phone into a canonical digits-only key so the same
 * person is matched regardless of how the number was typed (with/without the
 * 55 country code, formatting, etc.). This is what prevents duplicate palpites.
 * The leading "55" is only stripped when it is clearly a country-code prefix
 * (12-13 digit number), so legitimate DDD 55 (RS) numbers are preserved.
 */
function normalizePhone(phone: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits;
}

export interface Palpite {
  id?: number;
  protocolo?: string;
  nome: string;
  telefone: string;
  palpite: string;
  placar_brasil: number;
  placar_adversario: number;
  horario_brasil: string;
  source: string;
  created_at?: string;
}

/**
 * Step 1: Register lead via n8n webhook proxy
 */
export async function registerLead(nome: string, whatsapp: string): Promise<void> {
  const response = await fetch(WEBHOOK_LEAD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome,
      whatsapp,
      source: 'Bolão Manos Veículos',
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Falha ao registrar lead. Tente novamente.');
  }
}

const WEBHOOK_PALPITE = '/api/bolao/palpite';

/**
 * Step 3: Save palpite to Supabase (primary) and send to n8n webhook proxy
 */
export async function savePalpite(
  nome: string,
  whatsapp: string,
  placar_brasil: number,
  placar_marrocos: number
): Promise<string> {
  // Format current time in BRT (UTC-3)
  const now = new Date();
  const horarioBrasil = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const palpiteFormatado = `Brasil ${placar_brasil} x ${placar_marrocos} Marrocos`;
  const telefone = normalizePhone(whatsapp);

  // Generate a premium ticket protocol
  const protocolo = 'MANOS-' + Math.floor(100000 + Math.random() * 900000);

  // 1. Save to Supabase (Primary Database).
  // Idempotent by phone: if this number already has a palpite, update it instead
  // of inserting a new row. This prevents duplicate entries on the mural.
  try {
    const { data: existing } = await supabase
      .from('bolaomanos2026')
      .select('id')
      .eq('telefone', telefone)
      .not('protocolo', 'eq', 'RESULTADO')
      .limit(1);

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('bolaomanos2026')
        .update({
          nome,
          palpite: palpiteFormatado,
          placar_brasil,
          placar_adversario: placar_marrocos,
          horario_brasil: now.toISOString(),
        })
        .eq('id', existing[0].id);

      if (error) {
        console.warn('Supabase update returned error (check RLS policies):', error);
      }
    } else {
      const { error } = await supabase
        .from('bolaomanos2026')
        .insert({
          protocolo,
          nome,
          telefone,
          palpite: palpiteFormatado,
          placar_brasil,
          placar_adversario: placar_marrocos,
          horario_brasil: now.toISOString(),
          source: 'Bolão Manos Veículos - Copa 2026',
          created_at: now.toISOString()
        });

      if (error) {
        console.warn('Supabase insert returned error (check RLS policies):', error);
      }
    }
  } catch (err) {
    console.error('Supabase save failed:', err);
  }

  // 2. Send to webhook via proxy (secondary — n8n triggers WhatsApp confirmation, etc.)
  try {
    const response = await fetch(WEBHOOK_PALPITE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        telefone: whatsapp,
        palpite: palpiteFormatado,
        placar_brasil,
        placar_marrocos,
        horario_brasil: horarioBrasil,
        protocolo,
        source: 'Bolão Manos Veículos - Copa 2026',
      }),
    });

    if (!response.ok) {
      console.warn('Webhook responded with status:', response.status);
    }
  } catch (err) {
    console.error('Webhook palpite error:', err);
    // Don't throw for webhook so it doesn't block the frontend success screen
  }

  // 3. Save to Firestore as backup (optional — legacy)
  try {
    await addDoc(collection(db, COLLECTION_NAME), {
      nome,
      whatsapp,
      placar_brasil,
      placar_marrocos,
      palpite: palpiteFormatado,
      horario_brasil: horarioBrasil,
      protocolo,
      status: 'ativo',
      source: 'Bolão Manos Veículos - Copa 2026',
      created_at: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Backup Firestore save failed:', error);
  }

  return protocolo;
}

/**
 * Fetch a user's palpite by phone number from Supabase
 */
export async function getPalpiteByPhone(phone: string): Promise<Palpite | null> {
  try {
    const { data, error } = await supabase
      .from('bolaomanos2026')
      .select('*')
      .eq('telefone', normalizePhone(phone))
      .not('protocolo', 'eq', 'RESULTADO')
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? (data[0] as Palpite) : null;
  } catch (error) {
    console.error('Error fetching palpite by phone from Supabase:', error);
    return null;
  }
}

/**
 * Update a user's palpite in Supabase and notify the webhook proxy
 */
export async function updatePalpite(
  nome: string,
  whatsapp: string,
  placar_brasil: number,
  placar_marrocos: number
): Promise<string> {
  const now = new Date();
  const horarioBrasil = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const palpiteFormatado = `Brasil ${placar_brasil} x ${placar_marrocos} Marrocos`;

  // 1. Update in Supabase (Primary)
  try {
    const { error } = await supabase
      .from('bolaomanos2026')
      .update({
        nome,
        palpite: palpiteFormatado,
        placar_brasil,
        placar_adversario: placar_marrocos,
        horario_brasil: now.toISOString(),
      })
      .eq('telefone', normalizePhone(whatsapp))
      .not('protocolo', 'eq', 'RESULTADO');

    if (error) throw error;
  } catch (err) {
    console.error('Supabase update failed:', err);
    throw new Error('Falha ao atualizar palpite no Supabase. Tente novamente.');
  }

  // 2. Send webhook notification with action: "update"
  try {
    const response = await fetch(WEBHOOK_PALPITE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        nome,
        telefone: whatsapp,
        palpite: palpiteFormatado,
        placar_brasil,
        placar_marrocos,
        horario_brasil: horarioBrasil,
        source: 'Bolão Manos Veículos - Copa 2026',
      }),
    });

    if (!response.ok) {
      console.warn('Webhook responded with status:', response.status);
    }
  } catch (err) {
    console.error('Webhook update notify error:', err);
  }

  return 'updated';
}

/**
 * Fetch all palpites from Supabase
 */
export async function fetchPalpites(): Promise<Palpite[]> {
  try {
    const { data, error } = await supabase
      .from('bolaomanos2026')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Palpite[];
  } catch (error) {
    console.error('Error fetching palpites from Supabase:', error);
    return [];
  }
}

/**
 * Admin: Finalize game with final score
 */
export async function finalizarJogo(
  placar_brasil: number,
  placar_marrocos: number
): Promise<void> {
  // 1. Send webhook notification
  try {
    const response = await fetch(WEBHOOK_FINALIZAR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placar_brasil,
        placar_marrocos,
        status: 'finalizado',
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn('Webhook responded with status:', response.status);
    }
  } catch (err) {
    console.error('Webhook finalizar error:', err);
  }

  // 2. Insert or update the result in Supabase so the Transparency mural knows it
  try {
    // Delete any old RESULTADO row if exists to prevent duplicates
    await supabase.from('bolaomanos2026').delete().eq('protocolo', 'RESULTADO');
    
    // Insert new RESULTADO row
    const { error } = await supabase
      .from('bolaomanos2026')
      .insert({
        protocolo: 'RESULTADO',
        nome: 'Resultado Oficial',
        telefone: '00000000000',
        palpite: `Brasil ${placar_brasil} x ${placar_marrocos} Marrocos`,
        placar_brasil,
        placar_adversario: placar_marrocos,
        horario_brasil: new Date().toISOString(),
        source: 'RESULTADO',
      });

    if (error) throw error;
  } catch (err) {
    console.error('Failed to save official result to Supabase:', err);
    throw new Error('Falha ao salvar resultado no Supabase.');
  }
}
