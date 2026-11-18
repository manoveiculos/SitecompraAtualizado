// Telemetria de jornada do visitante para o painel /admin/trafego.
//
// Dois trabalhos:
//   1. Transporte (`enviarJornada`): sendBeacon, que sobrevive à navegação e ao
//      fechamento da aba.
//   2. Tempo ativo e micro-interações em cada veículo. Uma "visão" de veículo é
//      UM evento (`event_id` estável) que vai sendo atualizado:
//        - envio imediato ao abrir (tempo 0), para a visita existir mesmo se a
//          pessoa sair em 3s;
//        - heartbeat a cada 20s enquanto houver tempo novo;
//        - flush final em `visibilitychange: hidden`, `pagehide` e na troca de
//          veículo/desmontagem.
//      O servidor faz upsert por event_id e guarda o MAIOR tempo recebido, então
//      beacons fora de ordem ou repetidos não corrompem o valor.
//
// "Tempo ativo" = aba visível E alguma interação (toque, scroll, clique, tecla,
// mouse) nos últimos 90s. Uma aba aberta e esquecida não infla o número.

import { getAttribution } from './attribution';
import { idDoVisitante } from './visitante';

const SESSION_ID_KEY = 'manos_session_id_v1';
const HEARTBEAT_MS = 20_000;
const TICK_MS = 2_000;
const OCIOSO_APOS_MS = 90_000;
/** Para de pingar depois de 30 min no mesmo carro (aba esquecida com algum movimento). */
const LIMITE_SESSAO_MS = 30 * 60 * 1000;

export function obterSessionId(): string {
  try {
    const existente = sessionStorage.getItem(SESSION_ID_KEY);
    if (existente) return existente;
    const novo = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, novo);
    return novo;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
}

function rotaIgnorada(pathname: string): boolean {
  // Não polui o relatório de clientes com a navegação do próprio admin
  return pathname.includes('admin') || pathname.includes('leads-manos') || pathname.includes('radar-manos');
}

/** Envia um evento de jornada. `corpo` já traz acao/pagina/etc; o resto é completado aqui. */
export function enviarJornada(corpo: Record<string, unknown>): void {
  try {
    if (typeof window === 'undefined') return;
    const pagina = String(corpo.pagina || window.location.pathname);
    if (rotaIgnorada(pagina)) return;

    const json = JSON.stringify({
      visitor_id: idDoVisitante(),
      session_id: obterSessionId(),
      atribuicao: getAttribution(),
      ...corpo,
      pagina,
    });

    if (navigator.sendBeacon) {
      if (navigator.sendBeacon('/api/trafego/evento', new Blob([json], { type: 'application/json' }))) return;
    }
    void fetch('/api/trafego/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetria nunca pode quebrar a página */
  }
}

// ---------------------------------------------------------------------------
// Visão de veículo (dwell time + engajamento)
// ---------------------------------------------------------------------------

export type InteracaoVeiculo = 'foto' | 'galeria' | 'simulacao' | 'favorito' | 'compartilhar' | 'whatsapp';

interface VisaoVeiculo {
  eventId: string;
  veiculoId: string;
  nome: string;
  preco: number;
  pagina: string;
  inicio: number;
  acumuladoMs: number;
  ultimoTick: number;
  ultimoEnvioSeg: number;
  fotos: Set<string>;
  abriuGaleria: boolean;
  scrollMax: number;
  interacoes: Record<string, number>;
  timer: number;
}

let visao: VisaoVeiculo | null = null;
let ultimaInteracao = Date.now();
let ouvintesGlobais = false;
let contadorVisoes = 0;

function ativoAgora(): boolean {
  return document.visibilityState === 'visible' && Date.now() - ultimaInteracao < OCIOSO_APOS_MS;
}

function acumular(v: VisaoVeiculo): void {
  const agora = Date.now();
  if (ativoAgora()) v.acumuladoMs += Math.min(agora - v.ultimoTick, TICK_MS * 3);
  v.ultimoTick = agora;
}

function segundos(v: VisaoVeiculo): number {
  return Math.round(v.acumuladoMs / 1000);
}

function enviarVisao(v: VisaoVeiculo, rotulo?: string): void {
  v.ultimoEnvioSeg = segundos(v);
  enviarJornada({
    event_id: v.eventId,
    acao: 'view_vehicle',
    pagina: v.pagina,
    veiculo_id: v.veiculoId,
    veiculo_nome: v.nome,
    valor_veiculo: v.preco || null,
    detalhe: rotulo || `Viu veículo: ${v.nome}`,
    tempo_segundos: v.ultimoEnvioSeg,
    fotos_vistas: v.fotos.size,
    abriu_galeria: v.abriuGaleria,
    scroll_max: v.scrollMax,
    interacoes: v.interacoes,
  });
}

function marcarInteracao(): void {
  ultimaInteracao = Date.now();
}

function aoRolar(): void {
  marcarInteracao();
  if (!visao) return;
  const alt = document.documentElement.scrollHeight - window.innerHeight;
  if (alt <= 0) return;
  const pct = Math.min(100, Math.round((window.scrollY / alt) * 100));
  if (pct > visao.scrollMax) visao.scrollMax = pct;
}

function aoMudarVisibilidade(): void {
  if (!visao) return;
  acumular(visao);
  if (document.visibilityState === 'hidden') enviarVisao(visao);
  else visao.ultimoTick = Date.now();
}

function aoSairDaPagina(): void {
  if (!visao) return;
  acumular(visao);
  enviarVisao(visao);
}

function instalarOuvintesGlobais(): void {
  if (ouvintesGlobais || typeof window === 'undefined') return;
  ouvintesGlobais = true;
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'mousemove', 'click'] as const) {
    window.addEventListener(ev, marcarInteracao, { passive: true });
  }
  window.addEventListener('scroll', aoRolar, { passive: true });
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  window.addEventListener('pagehide', aoSairDaPagina);
}

/**
 * Começa a contar o tempo no veículo. Se o MESMO veículo já está sendo
 * acompanhado, não faz nada (React StrictMode, re-renders, App + página).
 */
export function iniciarVisaoVeiculo(v: { id: string; description: string; price: number }, pagina?: string): void {
  if (typeof window === 'undefined') return;
  const id = String(v.id || '');
  if (!id) return;
  if (visao && visao.veiculoId === id) return;

  finalizarVisaoVeiculo();
  instalarOuvintesGlobais();
  marcarInteracao();

  const agora = Date.now();
  contadorVisoes += 1;
  const nova: VisaoVeiculo = {
    eventId: `vw_${obterSessionId()}_${id}_${contadorVisoes}`,
    veiculoId: id,
    nome: v.description,
    preco: Number(v.price) || 0,
    pagina: pagina || window.location.pathname,
    inicio: agora,
    acumuladoMs: 0,
    ultimoTick: agora,
    ultimoEnvioSeg: -1,
    fotos: new Set(),
    abriuGaleria: false,
    scrollMax: 0,
    interacoes: {},
    timer: 0,
  };
  visao = nova;
  enviarVisao(nova);

  let ultimoHeartbeat = agora;
  nova.timer = window.setInterval(() => {
    acumular(nova);
    const t = Date.now();
    if (t - nova.inicio > LIMITE_SESSAO_MS) {
      finalizarVisaoVeiculo();
      return;
    }
    if (t - ultimoHeartbeat >= HEARTBEAT_MS) {
      ultimoHeartbeat = t;
      if (segundos(nova) !== nova.ultimoEnvioSeg) enviarVisao(nova);
    }
  }, TICK_MS);
}

/** Flush final e para de contar. Seguro chamar várias vezes. */
export function finalizarVisaoVeiculo(): void {
  const v = visao;
  if (!v) return;
  visao = null;
  window.clearInterval(v.timer);
  acumular(v);
  enviarVisao(v);
}

/** Micro-interação no veículo atual (foto, galeria, simulação...). Sem visão ativa, ignora. */
export function registrarInteracaoVeiculo(tipo: InteracaoVeiculo, detalhe?: string | number): void {
  const v = visao;
  if (!v) return;
  marcarInteracao();
  v.interacoes[tipo] = (v.interacoes[tipo] || 0) + 1;
  if (tipo === 'foto' && detalhe !== undefined) v.fotos.add(String(detalhe));
  if (tipo === 'galeria') v.abriuGaleria = true;
  // Interação relevante vai na hora: se a pessoa sair em seguida, o beacon final
  // já a leva, mas isto protege contra pagehide que o navegador descarta.
  if (tipo === 'galeria' || tipo === 'simulacao' || tipo === 'whatsapp') {
    acumular(v);
    enviarVisao(v);
  }
}
