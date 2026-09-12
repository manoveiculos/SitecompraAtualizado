import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, MessageCircle, Sparkles, Check, ChevronRight, Phone, ArrowRight, ShieldCheck, User, CheckCircle2 } from 'lucide-react';
import { LOJA, waLink, formatPhone } from '../../lib/manos';
import { track } from '../../lib/track';
import { getStoredLead, saveStoredLead } from '../../lib/leadStore';
import { supabase } from '../../lib/supabase';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  vehicles?: Array<{
    id: string;
    slug: string;
    titulo: string;
    marca: string;
    ano: string;
    km: string;
    preco: number;
    precoFormatado: string;
    foto: string;
    url: string;
  }>;
  resumoLead?: string;
  mostrarHandoff?: boolean;
}

export interface SelectedVehicle {
  id: string;
  slug: string;
  titulo: string;
  marca: string;
  ano: string;
  km: string;
  preco: number;
  precoFormatado: string;
  foto: string;
  url: string;
}

export interface UserLead {
  nome: string;
  telefone: string;
}

const STORAGE_KEY = 'manos_consultor_history_v3';
const USER_LEAD_KEY = 'manos_user_lead_v1';

function limparMarkdown(t: string): string {
  if (!t) return '';
  return t
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-•]\s*/gm, '')
    .replace(/`/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

export default function ConsultorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  // Pre-chat Gate State (Lead Inicial)
  const [userLead, setUserLead] = useState<UserLead | null>(() => {
    const stored = getStoredLead();
    if (stored.nome && stored.telefone) {
      return { nome: stored.nome, telefone: stored.telefone };
    }
    return null;
  });
  const [gateNome, setGateNome] = useState(() => getStoredLead().nome || '');
  const [gateTelefone, setGateTelefone] = useState(() => {
    const stored = getStoredLead().telefone;
    return stored ? formatPhone(stored) : '';
  });
  const [gateSubmitting, setGateSubmitting] = useState(false);

  // Auto-sync lead if entered elsewhere on the site
  useEffect(() => {
    const sync = () => {
      const stored = getStoredLead();
      if (stored.nome && stored.telefone && !userLead) {
        setUserLead({ nome: stored.nome, telefone: stored.telefone });
      }
      if (stored.nome && !gateNome) setGateNome(stored.nome);
      if (stored.telefone && !gateTelefone) setGateTelefone(formatPhone(stored.telefone));
    };
    sync();
    window.addEventListener('manos-lead-updated', sync);
    return () => window.removeEventListener('manos-lead-updated', sync);
  }, [userLead, gateNome, gateTelefone]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'msg-welcome',
        sender: 'assistant',
        text: 'Olá! Sou o Consultor Manos. Diz do que você precisa que eu acho no pátio da loja!',
      },
    ];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [leadSummary, setLeadSummary] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<SelectedVehicle | null>(null);

  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const lastAssistantMsgRef = useRef<HTMLDivElement>(null);

  // Listener global para abrir o consultor em qualquer lugar do site
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt?: string }>;
      setIsOpen(true);
      track('consultor_open', { source: 'custom_event' });
      if (customEvent.detail?.prompt) {
        enviarMensagem(customEvent.detail.prompt);
      }
    };
    window.addEventListener('open-consultor', handleOpen);
    return () => window.removeEventListener('open-consultor', handleOpen);
  }, []);

  // Salva histórico no sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  // Rola para a pergunta do cliente ou o topo da resposta do assistente (nunca pro final das cartas)
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const timer = setTimeout(() => {
        if (lastUserMsgRef.current) {
          lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (lastAssistantMsgRef.current) {
          lastAssistantMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, isOpen]);

  // Webhook #1: Disparo do Lead Inicial (Nome + Telefone antes do chat abrir)
  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = gateTelefone.replace(/\D/g, '');
    if (!gateNome.trim() || cleanPhone.length < 10) return;

    setGateSubmitting(true);
    const leadData: UserLead = { nome: gateNome.trim(), telefone: cleanPhone };

    try {
      // 1. Envia para o Webhook #1 (n8n)
      await fetch('https://n8n.drivvoo.com/webhook/9ea7abff-e9b9-4031-83bb-604bf789133d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'lead_inicial_consultor',
          nome: leadData.nome,
          telefone: leadData.telefone,
          enviadoEm: new Date().toISOString(),
          contexto: { pagina: window.location.pathname },
        }),
      });

      // 2. Salva no Supabase (tabela chatsitenovo26)
      await supabase.from('chatsitenovo26').insert([
        {
          session_id: sessionId,
          nome: leadData.nome,
          telefone: leadData.telefone,
          mensagem_usuario: 'Atendimento Iniciado',
          resposta_ia: 'Olá! Sou o Consultor Manos. Diz do que você precisa que eu acho no pátio da loja!',
          status: 'em_andamento',
        },
      ]);
    } catch (err) {
      console.warn('Erro ao registrar lead inicial:', err);
    } finally {
      // Persiste localmente e libera o chat
      saveStoredLead({ nome: leadData.nome, telefone: leadData.telefone });
      setUserLead(leadData);
      setGateSubmitting(false);
      track('consultor_gate_success', { nome: leadData.nome });
    }
  };

  // Envio de mensagem no chat
  const enviarMensagem = async (textoEnviar?: string) => {
    const txt = (textoEnviar || input).trim();
    if (!txt || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: txt,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textoEnviar) setInput('');
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/consultor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: txt,
          historico: messages.map((m) => ({
            papel: m.sender === 'user' ? 'usuario' : 'assistente',
            texto: m.text,
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('API indisponível');
      const data = await res.json();

      const botMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: data.resposta || 'Com certeza! Posso te ajudar a encontrar o modelo perfeito no nosso pátio.',
        vehicles: data.veiculos,
        resumoLead: data.resumoLead,
        mostrarHandoff: data.mostrarHandoff,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (data.mostrarHandoff) {
        setShowHandoff(true);
      }
      if (data.resumoLead) {
        setLeadSummary(data.resumoLead);
      }

      // Persiste atualização no Supabase (tabela chatsitenovo26)
      if (userLead) {
        await supabase.from('chatsitenovo26').upsert(
          {
            session_id: sessionId,
            nome: userLead.nome,
            telefone: userLead.telefone,
            mensagem_usuario: txt,
            resposta_ia: data.resposta || '',
            veiculos_recomendados: data.veiculos || [],
            veiculo_selecionado: selectedVehicle || null,
            resumo_lead: data.resumoLead || leadSummary,
            transcricao_completa: [...messages, userMsg, botMsg],
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' }
        );
      }
    } catch (err) {
      // Resposta de fallback em timeout/erro
      const botErr: ChatMessage = {
        id: `ast-err-${Date.now()}`,
        sender: 'assistant',
        text: 'Conectando você diretamente ao nosso atendimento no WhatsApp para encontrar a melhor opção agora!',
      };
      setMessages((prev) => [...prev, botErr]);
      setShowHandoff(true);
      setLeadSummary(`Interesse em seminovo: ${txt}`);
    } finally {
      setLoading(false);
    }
  };

  // Webhook #2: Disparo do Lead Completo ao Clicar no WhatsApp
  const handleFinalHandoff = async () => {
    track('consultor_final_handoff', {
      nome: userLead?.nome,
      veiculo: selectedVehicle?.titulo,
      resumo: leadSummary,
    });

    try {
      // 1. Envia a conversa completa para o Webhook #2 (n8n)
      await fetch('https://n8n.drivvoo.com/webhook/4e9c951f-f848-4b95-8b10-242d3a07df95', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem: 'site-manos',
          tipo: 'lead_consultor_completo',
          enviadoEm: new Date().toISOString(),
          cliente: {
            nome: userLead?.nome || '',
            telefone: userLead?.telefone || '',
          },
          veiculoSelecionado: selectedVehicle
            ? {
                id: selectedVehicle.id,
                titulo: selectedVehicle.titulo,
                preco: selectedVehicle.preco,
                precoFormatado: selectedVehicle.precoFormatado,
                url: selectedVehicle.url,
              }
            : null,
          intencao: {
            resumo: leadSummary || 'Interesse em seminovos em Rio do Sul/SC',
          },
          transcricaoCompleta: messages.map((m) => ({
            papel: m.sender === 'user' ? 'usuario' : 'assistente',
            texto: m.text,
          })),
        }),
      });

      // 2. Atualiza Supabase com status 'lead_enviado'
      if (userLead) {
        await supabase.from('chatsitenovo26').upsert(
          {
            session_id: sessionId,
            nome: userLead.nome,
            telefone: userLead.telefone,
            status: 'lead_enviado',
            veiculo_selecionado: selectedVehicle || null,
            resumo_lead: leadSummary,
            transcricao_completa: messages,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' }
        );
      }
    } catch (e) {
      console.warn('Erro ao disparar Webhook #2:', e);
    }

    // 3. Monta texto do WhatsApp com veículo escolhido e resumo do lead
    let msgWa = `Olá! Meu nome é ${userLead?.nome || 'Cliente'}.\nEstava conversando com o Consultor IA no site da Manos Veículos em Rio do Sul.`;
    if (selectedVehicle) {
      msgWa += `\n\n🚗 *Veículo Escolhido:* ${selectedVehicle.titulo} (${selectedVehicle.precoFormatado})`;
    }
    if (leadSummary) {
      msgWa += `\n📋 *Resumo da Busca:* ${leadSummary}`;
    }
    msgWa += `\n📞 *WhatsApp de Contato:* ${formatPhone(userLead?.telefone || '')}\n\nGostaria de receber atendimento e simular as condições deste veículo!`;

    window.open(waLink(msgWa), '_blank');
  };

  return (
    <>
      {/* Botão Flutuante do Chat */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            track('consultor_open', { source: 'floating_btn' });
          }}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex items-center gap-3 bg-[#7A2E1E] hover:bg-[#622316] text-[#FDF3E7] p-3 lg:px-5 lg:py-3.5 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 group border border-[#E0B68F]/40"
          aria-label="Abrir Consultor Manos"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#3B2016] border-2 border-[#E0B68F] flex items-center justify-center overflow-hidden">
              <Bot className="w-6 h-6 text-[#E0B68F]" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#7A2E1E] rounded-full animate-pulse" />
          </div>
          <div className="hidden sm:flex flex-col text-left pr-1">
            <span className="font-serif font-bold text-sm leading-tight text-white">Consultor Manos</span>
            <span className="text-[11px] text-[#F6DCC8] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Responde na hora
            </span>
          </div>
        </button>
      )}

      {/* Painel do Chat */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-0 lg:p-6 bg-black/40 lg:bg-transparent lg:pointer-events-none transition-all animate-fade-in">
          <div className="w-full lg:w-[420px] h-[88vh] lg:h-[620px] bg-[#FDF8F1] rounded-t-3xl lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#EEDFCF] lg:pointer-events-auto">
            
            {/* Header do Consultor */}
            <div className="bg-[#3B2016] text-[#FDF8F1] px-5 py-3.5 flex items-center justify-between border-b border-[#2E1810]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-[#2E1810] border border-[#E0B68F]/50 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[#E0B68F]" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-[#3B2016] rounded-full" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white leading-tight">Consultor Manos</h3>
                  <p className="text-xs text-[#F6DCC8] font-medium">Assistente de seminovos · Rio do Sul/SC</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-[#2E1810] hover:bg-[#7A2E1E] text-[#F6DCC8] hover:text-white flex items-center justify-center transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PASSO 1: MODAL GATE (Solicita Nome e Telefone ANTES de abrir o Chat) */}
            {!userLead ? (
              <div className="flex-1 p-6 flex flex-col justify-center items-center text-center space-y-5 bg-[#FDF8F1]">
                <div className="w-16 h-16 rounded-full bg-[#3B2016] border-2 border-[#E0B68F] flex items-center justify-center shadow-lg">
                  <Bot className="w-9 h-9 text-[#E0B68F]" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-serif font-extrabold text-xl text-[#3B2016]">
                    Atendimento Consultor Manos
                  </h3>
                  <p className="text-xs text-[#7D6250] leading-relaxed max-w-xs">
                    Informe seu nome e WhatsApp para consultar o estoque em tempo real e receber atendimento exclusivo.
                  </p>
                </div>

                <form onSubmit={handleGateSubmit} className="w-full space-y-3 pt-2">
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-extrabold text-[#7D6250] uppercase tracking-wider ml-1">Seu Nome</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Silva"
                      value={gateNome}
                      onChange={(e) => setGateNome(e.target.value)}
                      className="w-full px-4 py-3 text-xs bg-white border border-[#EEDFCF] rounded-xl focus:outline-hidden focus:border-[#7A2E1E] text-[#3B2016]"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-extrabold text-[#7D6250] uppercase tracking-wider ml-1">Seu WhatsApp</label>
                    <input
                      type="tel"
                      required
                      placeholder="(47) 99999-9999"
                      value={gateTelefone}
                      onChange={(e) => setGateTelefone(formatPhone(e.target.value))}
                      className="w-full px-4 py-3 text-xs bg-white border border-[#EEDFCF] rounded-xl focus:outline-hidden focus:border-[#7A2E1E] text-[#3B2016]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={gateSubmitting || !gateNome.trim() || gateTelefone.replace(/\D/g, '').length < 10}
                    className="w-full py-3.5 bg-[#7A2E1E] hover:bg-[#622316] text-[#FDF3E7] text-xs font-bold uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-40 min-h-[46px]"
                  >
                    <span>{gateSubmitting ? 'Iniciando...' : 'Iniciar Atendimento'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <p className="text-[10px] text-[#7D6250]/70 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Seus dados estão seguros · Atendimento humano disponível
                </p>
              </div>
            ) : (
              /* PASSO 2: CORPO DO CHAT ATIVO */
              <>
                {/* User Bar Info */}
                <div className="bg-[#F4E6D7] px-4 py-2 border-b border-[#EEDFCF] flex items-center justify-between text-xs text-[#3B2016]">
                  <div className="flex items-center gap-2 font-medium">
                    <User className="w-3.5 h-3.5 text-[#7A2E1E]" />
                    <span>{userLead.nome}</span>
                    <span className="text-[#7D6250]">({formatPhone(userLead.telefone)})</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-full">
                    Conectado
                  </span>
                </div>

                {/* Histórico de Mensagens */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDF8F1]">
                  {(() => {
                    let lastUserIdx = -1;
                    let lastAssistantIdx = -1;
                    for (let i = messages.length - 1; i >= 0; i--) {
                      if (messages[i].sender === 'user' && lastUserIdx === -1) lastUserIdx = i;
                      if (messages[i].sender === 'assistant' && lastAssistantIdx === -1) lastAssistantIdx = i;
                    }
                    return messages.map((m, idx) => (
                      <div
                        key={m.id}
                        ref={idx === lastUserIdx ? lastUserMsgRef : (idx === lastAssistantIdx ? lastAssistantMsgRef : undefined)}
                        className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'} max-w-[88%] ${
                          m.sender === 'user' ? 'ml-auto' : 'mr-auto'
                        }`}
                      >
                        <div
                          className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                            m.sender === 'user'
                              ? 'bg-[#7A2E1E] text-[#FDF3E7] rounded-br-none shadow-xs'
                              : 'bg-white text-[#3B2016] border border-[#EEDFCF] rounded-bl-none shadow-xs'
                          }`}
                        >
                          {limparMarkdown(m.text)}
                        </div>

                      {/* Veículos Recomendados com Seleção Ativa */}
                      {m.vehicles && m.vehicles.length > 0 && (
                        <div className="mt-3 w-full space-y-2.5">
                          <p className="text-[11px] font-bold text-[#7A2E1E] uppercase tracking-wider px-1 flex items-center gap-1">
                            <span>👉 Selecione o veículo preferido para o orçamento:</span>
                          </p>
                          {m.vehicles.map((v) => {
                            const isSelected = selectedVehicle?.id === v.id;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setShowHandoff(true);
                                  track('consultor_select_vehicle', { id: v.id, title: v.titulo });
                                }}
                                className={`w-full text-left flex gap-3 p-2.5 rounded-xl border transition-all shadow-2xs ${
                                  isSelected
                                    ? 'bg-[#F4E6D7] border-[#7A2E1E] ring-2 ring-[#7A2E1E]/30'
                                    : 'bg-white border-[#EEDFCF] hover:border-[#7A2E1E]'
                                }`}
                              >
                                <img
                                  src={v.foto}
                                  alt={v.titulo}
                                  className="w-20 h-16 object-cover rounded-lg bg-[#F4E6D7] flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <div className="flex items-center justify-between gap-1">
                                    <h4 className="font-serif font-bold text-xs text-[#3B2016] truncate">
                                      {v.titulo}
                                    </h4>
                                    {isSelected && (
                                      <span className="text-[9px] font-extrabold bg-emerald-600 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5 flex-shrink-0">
                                        <CheckCircle2 className="w-3 h-3" /> Selecionado
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[#7D6250]">
                                    {v.ano} · {v.km}
                                  </p>
                                  <p className="text-xs font-extrabold text-[#7A2E1E]">
                                    {v.precoFormatado}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ));
                })()}

                  {loading && (
                    <div className="flex items-center gap-2 text-xs text-[#7D6250] bg-white border border-[#EEDFCF] p-3 rounded-2xl w-fit">
                      <div className="w-2 h-2 rounded-full bg-[#7A2E1E] animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-[#7A2E1E] animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 rounded-full bg-[#7A2E1E] animate-bounce [animation-delay:0.4s]" />
                      <span>Buscando opções no pátio...</span>
                    </div>
                  )}

                  {/* Card de Encaminhamento do Lead Quente para WhatsApp */}
                  {showHandoff && (
                    <div className="bg-[#F4E6D7] border border-[#E0B68F] p-4 rounded-2xl space-y-3 animate-fade-in mt-2">
                      <div className="flex items-center gap-2 text-[#7A2E1E] font-serif font-bold text-sm">
                        <Sparkles className="w-4 h-4 text-[#7A2E1E]" />
                        <span>{selectedVehicle ? 'Veículo Selecionado para Proposta' : 'Resumo para o Consultor'}</span>
                      </div>

                      {/* Veículo Escolhido */}
                      {selectedVehicle ? (
                        <div className="bg-white p-3 rounded-xl border border-emerald-500/40 flex items-center gap-3">
                          <img src={selectedVehicle.foto} alt={selectedVehicle.titulo} className="w-14 h-12 object-cover rounded-lg" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-extrabold text-emerald-700 uppercase">Pronto para proposta</span>
                            <h5 className="font-serif font-bold text-xs text-[#3B2016] truncate">{selectedVehicle.titulo}</h5>
                            <p className="text-xs font-extrabold text-[#7A2E1E]">{selectedVehicle.precoFormatado}</p>
                          </div>
                        </div>
                      ) : (
                        leadSummary && (
                          <div className="text-xs text-[#3B2016] bg-white/90 p-3 rounded-xl border border-[#EEDFCF] leading-relaxed">
                            <strong>Busca:</strong> {leadSummary}
                          </div>
                        )
                      )}

                      <button
                        type="button"
                        onClick={handleFinalHandoff}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 min-h-[48px]"
                      >
                        <MessageCircle className="w-4.5 h-4.5 text-white" />
                        <span>
                          {selectedVehicle
                            ? `Receber Proposta do ${selectedVehicle.marca || 'Carro'} no WhatsApp`
                            : 'Falar no WhatsApp com Consultor'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  )}

                </div>

                {/* Atalhos Rápidos com Seleção Fácil — Sempre Visíveis */}
                <div className="px-3 py-2 bg-[#FDF3E7] border-t border-[#EEDFCF] flex items-center gap-1.5 overflow-x-auto text-nowrap scrollbar-none">
                  {(() => {
                    const lastMsg = (messages[messages.length - 1]?.text || '').toLowerCase();
                    let options = [
                      '🚗 SUVs & Familiares',
                      '⚡ Econômicos pra cidade',
                      '🔄 Tenho carro pra troca',
                      '📋 Financiamento em 48x',
                      '⏱️ Agendar horário especial',
                    ];

                    if (lastMsg.includes('troca') || lastMsg.includes('usado') || lastMsg.includes('carro atual')) {
                      options = [
                        '🚗 Busco um SUV espaçoso',
                        '⚡ Busco carro econômico',
                        '🕹️ Prefiro câmbio automático',
                        '💰 Parcela até R$ 1.500',
                        '📅 Ano 2020 ou mais novo',
                      ];
                    } else if (lastMsg.includes('dúvida') || lastMsg.includes('duvida') || lastMsg.includes('compar') || lastMsg.includes('escolher')) {
                      options = [
                        '🚙 Foco em espaço familiar',
                        '💰 Foco em menor parcela',
                        '⭐ Foco em ano mais novo',
                        '🔄 Quero dar meu usado na troca',
                      ];
                    }

                    return options.map((qr) => (
                      <button
                        key={qr}
                        type="button"
                        onClick={() => enviarMensagem(qr)}
                        className="px-3 py-1.5 text-[11px] font-bold bg-white border border-[#EEDFCF] hover:border-[#7A2E1E] hover:bg-[#7A2E1E] text-[#3B2016] hover:text-[#FDF3E7] rounded-full transition-all shadow-2xs cursor-pointer active:scale-95 flex-shrink-0"
                      >
                        {qr}
                      </button>
                    ));
                  })()}
                </div>

                {/* Input de Mensagem */}
                <div className="p-3 bg-white border-t border-[#EEDFCF] flex flex-col gap-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      enviarMensagem();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Digite sua dúvida ou escolha um atalho acima..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="flex-1 px-4 py-2.5 text-xs bg-[#FDF8F1] border border-[#EEDFCF] rounded-xl focus:outline-hidden focus:border-[#7A2E1E] text-[#3B2016] placeholder:text-[#7D6250]"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="w-10 h-10 bg-[#7A2E1E] hover:bg-[#622316] disabled:opacity-50 text-[#FDF3E7] rounded-xl flex items-center justify-center transition-colors shadow-xs"
                      aria-label="Enviar mensagem"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>

                  {/* WhatsApp Direto */}
                  <div className="flex items-center justify-between text-[11px] text-[#7D6250] px-1 pt-0.5">
                    <span>Rio do Sul/SC</span>
                    <button
                      onClick={handleFinalHandoff}
                      className="text-[#7A2E1E] font-bold hover:underline flex items-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-600" /> WhatsApp Direto
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
