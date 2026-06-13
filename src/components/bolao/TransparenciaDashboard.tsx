import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Users, Search, RefreshCw, ChevronLeft, ChevronRight, 
  Activity, Calendar, Award, CheckCircle2, TrendingUp 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Palpite } from '../../services/bolaoService';

// Function to format telephone with mask: (47) *****-7855
function formatPhoneMask(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return phone;
  const ddd = clean.slice(0, 2);
  const lastFour = clean.slice(-4);
  return `(${ddd}) *****-${lastFour}`;
}

// Mask the surname for LGPD compliance: keep the first name, abbreviate the rest
// e.g. "Renato Gorges" -> "Renato G." | "Maria da Silva" -> "Maria D. S."
function maskName(fullName: string): string {
  if (!fullName) return fullName;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const initials = parts
    .slice(1)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + '.')
    .join(' ');
  return `${parts[0]} ${initials}`;
}

function formatHorarioBrasilia(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateStr;
  }
}

function formatDataBrasilia(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

export default function TransparenciaDashboard() {
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Fetch all data from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bolaomanos2026')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPalpites(data || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to Postgres Changes Realtime
    const channel = supabase
      .channel('bolaomanos2026')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bolaomanos2026',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Separate official result from actual user palpites
  const officialResult = useMemo(() => {
    return palpites.find(p => p.protocolo === 'RESULTADO');
  }, [palpites]);

  const userPalpites = useMemo(() => {
    return palpites.filter(p => p.protocolo !== 'RESULTADO');
  }, [palpites]);

  // Search filter
  const filteredPalpites = useMemo(() => {
    if (!searchQuery.trim()) return userPalpites;
    const q = searchQuery.toLowerCase();
    return userPalpites.filter(p => 
      p.nome.toLowerCase().includes(q) || 
      p.protocolo?.toLowerCase().includes(q)
    );
  }, [userPalpites, searchQuery]);

  // Pagination
  const paginatedPalpites = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPalpites.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPalpites, currentPage]);

  const totalPages = Math.ceil(filteredPalpites.length / itemsPerPage) || 1;

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalBets = userPalpites.length;
    const lastBet = userPalpites[0] || null;

    // Placar mais apostado (Ranking)
    const placarCounts: Record<string, number> = {};
    let brasilWins = 0;
    let draws = 0;
    let marrocosWins = 0;

    userPalpites.forEach(p => {
      // Group for ranking
      const key = `${p.placar_brasil} x ${p.placar_adversario}`;
      placarCounts[key] = (placarCounts[key] || 0) + 1;

      // Group for win/draw/loss chart
      if (p.placar_brasil > p.placar_adversario) brasilWins++;
      else if (p.placar_brasil === p.placar_adversario) draws++;
      else marrocosWins++;
    });

    const ranking = Object.entries(placarCounts)
      .map(([placar, count]) => ({ placar, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Distribution
    const distribution = {
      brasilWins: totalBets ? Math.round((brasilWins / totalBets) * 100) : 0,
      draws: totalBets ? Math.round((draws / totalBets) * 100) : 0,
      marrocosWins: totalBets ? Math.round((marrocosWins / totalBets) * 100) : 0,
    };

    return {
      totalBets,
      lastBet,
      ranking,
      distribution
    };
  }, [userPalpites]);

  // Winners (Palpites that match official score)
  const winners = useMemo(() => {
    if (!officialResult) return [];
    return userPalpites.filter(p => 
      p.placar_brasil === officialResult.placar_brasil && 
      p.placar_adversario === officialResult.placar_adversario
    );
  }, [userPalpites, officialResult]);

  return (
    <div className="space-y-6">
      {/* Realtime Status Bar */}
      <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-[10px] sm:text-xs font-bold text-white/70 uppercase tracking-wider">
            Painel de Transparência Ao Vivo
          </span>
        </div>
        <button 
          onClick={fetchData} 
          disabled={loading}
          className="text-white/40 hover:text-white/95 transition-colors p-1"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Official Winner Alert if Game Finalized */}
      <AnimatePresence>
        {officialResult && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent p-5 rounded-3xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                <Trophy className="w-5 h-5 text-yellow-500 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight italic">
                  Jogo Finalizado! Resultado Oficial:
                </h3>
                <p className="text-xl font-black text-yellow-400 flex items-center gap-2">
                  🇧🇷 {officialResult.placar_brasil} <span className="text-xs text-white/30">×</span> {officialResult.placar_adversario} 🇲🇦
                </p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3">
              <h4 className="text-[10px] font-black uppercase text-white/50 tracking-wider mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-yellow-500" />
                Vencedores ({winners.length})
              </h4>
              {winners.length === 0 ? (
                <p className="text-xs text-white/30 italic">Nenhum participante acertou o placar oficial.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {winners.map((winner, idx) => (
                    <div key={winner.id || idx} className="bg-white/5 border border-white/5 p-2 rounded-xl flex items-center justify-between">
                      <div className="truncate pr-2">
                        <p className="text-xs font-bold text-white truncate">{maskName(winner.nome)}</p>
                        <p className="text-[9px] text-white/30 font-mono">{formatPhoneMask(winner.telefone)}</p>
                      </div>
                      <span className="text-[9px] bg-yellow-500/20 text-yellow-300 font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-yellow-500/10">
                        Acertou!
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-glass p-4 relative overflow-hidden bg-gradient-to-br from-manos-red/5 to-transparent border-white/5">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-manos-red/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-manos-red" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Total Palpites</span>
          <p className="text-3xl font-black italic tracking-tighter text-white mt-1">
            {loading ? '...' : stats.totalBets}
          </p>
        </div>

        <div className="card-glass p-4 relative overflow-hidden bg-gradient-to-br from-green-500/5 to-transparent border-white/5">
          <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-green-500" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Última Aposta</span>
          <p className="text-xs font-bold text-white truncate mt-2">
            {stats.lastBet ? stats.lastBet.nome.split(' ')[0] : 'Nenhum'}
          </p>
          {stats.lastBet && (
            <span className="text-[10px] text-green-400 font-black font-mono">
              🇧🇷 {stats.lastBet.placar_brasil}×{stats.lastBet.placar_adversario} 🇲🇦
            </span>
          )}
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="space-y-6">
        {/* Distribuição de Apostas (Resultado) */}
        <div className="card-glass p-4 space-y-4 border-white/5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-manos-red" />
            <h3 className="text-xs font-black uppercase tracking-wider italic">Resultado do Jogo</h3>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-[10px] uppercase font-black text-white/70 mb-1">
                <span>Vitória do Brasil 🇧🇷</span>
                <span className="text-green-400">{stats.distribution.brasilWins}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.distribution.brasilWins}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] uppercase font-black text-white/70 mb-1">
                <span>Empate 🤝</span>
                <span className="text-white/50">{stats.distribution.draws}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white/30 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.distribution.draws}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] uppercase font-black text-white/70 mb-1">
                <span>Vitória do Marrocos 🇲🇦</span>
                <span className="text-manos-red">{stats.distribution.marrocosWins}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-manos-red rounded-full transition-all duration-500" 
                  style={{ width: `${stats.distribution.marrocosWins}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ranking de Placares */}
        <div className="card-glass p-4 space-y-4 border-white/5">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-500" />
            <h3 className="text-xs font-black uppercase tracking-wider italic">Placares Mais Apostados</h3>
          </div>
          {stats.ranking.length === 0 ? (
            <p className="text-xs text-white/30 italic text-center py-4">Nenhum palpite enviado ainda.</p>
          ) : (
            <div className="space-y-3">
              {stats.ranking.map((item, idx) => {
                const maxCount = stats.ranking[0]?.count || 1;
                const percentage = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs font-black text-white/40 w-4">#{idx+1}</span>
                    <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 w-16 justify-center">
                      <span className="text-xs font-black text-white font-mono">{item.placar}</span>
                    </div>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500/80 rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-white/60 font-mono w-12 text-right">
                      {item.count} {item.count === 1 ? 'voto' : 'votos'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Live Feed & Search */}
      <div className="card-glass p-4 space-y-4 border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-wider italic flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-manos-red" />
            Mural de Palpites
          </h3>
          {/* Search bar */}
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="py-2.5 pl-9 pr-4 bg-[#151515] border border-white/5 rounded-xl text-xs w-full sm:w-44 focus:w-56 focus:border-manos-red/40 transition-all outline-none"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          </div>
        </div>

        {/* Palpites List */}
        <div className="space-y-2.5 pt-2">
          {loading ? (
            <div className="text-center py-12">
              <span className="flex h-5 w-5 relative mx-auto">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-manos-red opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-manos-red"></span>
              </span>
            </div>
          ) : filteredPalpites.length === 0 ? (
            <p className="text-center text-xs text-white/30 italic py-8">Nenhum palpite encontrado.</p>
          ) : (
            <>
              {paginatedPalpites.map((p, index) => (
                <div key={p.id || index} className="p-3 bg-[#131313] border border-white/5 rounded-xl flex items-center justify-between hover:border-white/10 transition-colors">
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[180px]">
                        {maskName(p.nome)}
                      </p>
                      {officialResult && p.placar_brasil === officialResult.placar_brasil && p.placar_adversario === officialResult.placar_adversario && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-white/30 font-mono">
                      <span>{formatPhoneMask(p.telefone)}</span>
                      <span>•</span>
                      <span>{formatHorarioBrasilia(p.horario_brasil)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 px-2.5 py-1.5 rounded-lg font-mono">
                    <span className="text-[10px]">🇧🇷</span>
                    <span className="text-xs font-black text-white">{p.placar_brasil}</span>
                    <span className="text-[9px] text-white/20">×</span>
                    <span className="text-xs font-black text-white">{p.placar_adversario}</span>
                    <span className="text-[10px]">🇲🇦</span>
                  </div>
                </div>
              ))}

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-[10px] text-white/30 font-mono">
                    Página {currentPage} de {totalPages} ({filteredPalpites.length} palpites)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(c => Math.max(c - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all flex items-center justify-center min-h-[36px]"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(c => Math.min(c + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all flex items-center justify-center min-h-[36px]"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
