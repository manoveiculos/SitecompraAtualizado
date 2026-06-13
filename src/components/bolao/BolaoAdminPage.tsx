import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Trophy, Loader2, CheckCircle2, Users, Send } from 'lucide-react';
import Toast, { useToast } from './Toast';
import { fetchPalpites, finalizarJogo, type Palpite } from '../../services/bolaoService';

const ADMIN_PASSWORD = 'manos2026admin';

export default function BolaoAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [palpites, setPalpites] = useState<Palpite[]>([]);
  const [isLoadingPalpites, setIsLoadingPalpites] = useState(false);
  const [placarBrasil, setPlacarBrasil] = useState('');
  const [placarMarrocos, setPlacarMarrocos] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Senha incorreta.');
    }
  };

  // Load palpites when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadPalpites();
    }
  }, [isAuthenticated]);

  const loadPalpites = async () => {
    setIsLoadingPalpites(true);
    try {
      const data = await fetchPalpites();
      setPalpites(data);
    } catch (error) {
      showToast('Erro ao carregar palpites.', 'error');
    } finally {
      setIsLoadingPalpites(false);
    }
  };

  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placarBrasil || !placarMarrocos) {
      showToast('Preencha ambos os placares.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await finalizarJogo(parseInt(placarBrasil, 10), parseInt(placarMarrocos, 10));
      setIsFinalized(true);
      showToast('Jogo finalizado com sucesso! Webhook disparado.', 'success');
    } catch (error) {
      showToast('Erro ao finalizar jogo. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password Gate
  if (!isAuthenticated) {
    return (
      <div className="bolao-viewport">
        <div className="bolao-glow" />
        <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />

        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm space-y-8"
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-manos-red/10 border border-manos-red/20 rounded-full flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-manos-red" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter italic uppercase">
                Admin <span className="text-manos-red">Bolão</span>
              </h1>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
                Acesso restrito
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                autoFocus
                className="w-full py-5 px-6 bg-[#1A1A1A] border border-white/5 rounded-2xl focus:border-manos-red/40 transition-all outline-none text-base text-center tracking-widest"
                placeholder="Senha de acesso"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
              />
              {passwordError && (
                <p className="text-center text-xs text-red-400 font-bold">{passwordError}</p>
              )}
              <button
                type="submit"
                className="w-full py-5 bg-manos-red text-white font-black text-lg uppercase rounded-2xl shadow-[0_20px_50px_rgba(237,28,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
              >
                Entrar
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  // Admin Panel
  return (
    <div className="bolao-viewport">
      <div className="bolao-glow" />
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />

      <header className="p-4 flex items-center justify-between z-20 backdrop-blur-md bg-manos-dark/50 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img
            src="https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png"
            alt="Manos Veículos"
            className="h-6 w-auto object-contain"
          />
          <span className="text-[10px] font-black text-manos-red uppercase tracking-widest">Admin</span>
        </div>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="text-[10px] font-black text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="scroll-container custom-scrollbar space-y-8">
        {/* Finalizar Jogo */}
        <AnimatePresence mode="wait">
          {!isFinalized ? (
            <motion.div
              key="finalizar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black tracking-tighter italic uppercase">
                  Placar <span className="text-manos-red">Final</span>
                </h2>
                <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
                  Insira o resultado oficial do jogo
                </p>
              </div>

              <form onSubmit={handleFinalizar} className="space-y-6">
                <div className="flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">🇧🇷</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={placarBrasil}
                      onChange={(e) => setPlacarBrasil(e.target.value.replace(/\D/g, ''))}
                      className="w-16 h-16 text-center text-3xl font-black bg-[#1A1A1A] border border-white/10 rounded-xl outline-none focus:border-green-500/50 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <span className="text-2xl font-black text-white/20 pt-6">×</span>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">🇲🇦</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={placarMarrocos}
                      onChange={(e) => setPlacarMarrocos(e.target.value.replace(/\D/g, ''))}
                      className="w-16 h-16 text-center text-3xl font-black bg-[#1A1A1A] border border-white/10 rounded-xl outline-none focus:border-red-500/50 transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !placarBrasil || !placarMarrocos}
                  className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl shadow-xl shadow-manos-red/20 disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Finalizar Jogo
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="finalized"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-black tracking-tighter italic uppercase">
                Jogo <span className="text-green-400">Finalizado!</span>
              </h3>
              <p className="text-sm text-white/50">
                Resultado: 🇧🇷 {placarBrasil} × {placarMarrocos} 🇲🇦
              </p>
              <p className="text-xs text-white/30">Webhook de resolução disparado com sucesso.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Separator */}
        <div className="border-t border-white/5" />

        {/* Palpites List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-manos-red" />
              <h3 className="text-sm font-black uppercase tracking-tighter italic">
                Palpites Registrados
              </h3>
            </div>
            <button
              onClick={loadPalpites}
              className="text-[10px] font-black text-manos-red uppercase tracking-widest hover:brightness-125 transition-all"
            >
              Atualizar
            </button>
          </div>

          {isLoadingPalpites ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/30 mx-auto" />
            </div>
          ) : palpites.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-white/30 italic">Nenhum palpite registrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-white/20 uppercase tracking-widest font-black">
                Total: {palpites.length} palpite{palpites.length !== 1 ? 's' : ''}
              </p>
              {palpites.map((p, i) => (
                <motion.div
                  key={p.id || i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-glass p-4 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white/80 truncate max-w-[180px]">{p.nome}</p>
                    <p className="text-[10px] text-white/30 font-mono">{p.whatsapp}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl">
                    <span className="text-sm">🇧🇷</span>
                    <span className="text-lg font-black text-white">{p.placar_brasil}</span>
                    <span className="text-xs text-white/30 font-black">×</span>
                    <span className="text-lg font-black text-white">{p.placar_marrocos}</span>
                    <span className="text-sm">🇲🇦</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
