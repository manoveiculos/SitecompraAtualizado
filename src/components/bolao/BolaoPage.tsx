import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import BolaoHeader from './BolaoHeader';
import TransparenciaDashboard from './TransparenciaDashboard';
import { WhatsAppCta } from '../ManosUI';

export default function BolaoPage() {
  const [activeTab, setActiveTab] = useState<'aposta' | 'transparencia'>('aposta');

  return (
    <div className="bolao-viewport">
      <div className="bolao-glow" />

      <BolaoHeader currentStep={1} totalSteps={2} showBack={false} />

      <div className="px-6 pb-2 pt-1 z-20 flex justify-center">
        <div className="flex bg-[#161616] border border-white/5 p-1 rounded-2xl w-full max-w-sm">
          <button
            onClick={() => setActiveTab('aposta')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'aposta'
                ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            ⚽ Palpitar
          </button>
          <button
            onClick={() => setActiveTab('transparencia')}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'transparencia'
                ? 'bg-white/10 text-white border border-white/5'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            📊 Mural Geral
          </button>
        </div>
      </div>

      <main className="scroll-container custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'transparencia' ? (
            <motion.div
              key="transparencia-dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.35 }}
            >
              <TransparenciaDashboard />
            </motion.div>
          ) : (
            <motion.div
              key="palpite"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
              className="px-6 py-8 space-y-6 text-center"
            >
              <h2 className="text-3xl font-black uppercase italic tracking-tight text-white">
                Dê seu <span className="text-manos-red">palpite</span>
              </h2>
              <p className="text-sm text-white/60 max-w-sm mx-auto">
                Participe pelo WhatsApp da Manos Veículos: mande seu nome e o placar que você acha que vai sair.
              </p>
              <div className="max-w-sm mx-auto">
                <WhatsAppCta
                  contexto="bolao_palpite"
                  label="Palpitar no WhatsApp"
                  mensagem="Olá! Quero participar do bolão da Copa 2026 da Manos Veículos. Meu palpite é: Brasil __ x __ Haiti."
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <div className="sticky-footer">
        <div className="text-center py-2">
          <p className="text-[9px] text-white/10 uppercase tracking-[0.3em] font-black italic">
            Manos Veículos • Copa 2026
          </p>
        </div>
      </div>
    </div>
  );
}
