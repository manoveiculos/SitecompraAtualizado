import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, Clock, Trophy, Edit, AlertCircle } from 'lucide-react';
import brazilFlag from './brazil-flag.png';
import moroccoFlag from './morocco-flag.png';
import type { Palpite } from '../../services/bolaoService';

interface StepPalpiteProps {
  nome: string;
  onSubmit: (placarBrasil: number, placarMarrocos: number) => void;
  isLoading: boolean;
  existingGuess?: Palpite | null;
  onUpdateSubmit?: (placarBrasil: number, placarMarrocos: number) => void;
}

// Deadline: 13/06/2026 at 19:00 BRT (UTC-3)
const DEADLINE = new Date('2026-06-13T22:00:00.000Z'); // 19:00 BRT = 22:00 UTC

function formatDataBrasilia(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' às ' + date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

export default function StepPalpite({ 
  nome, 
  onSubmit, 
  isLoading, 
  existingGuess = null, 
  onUpdateSubmit 
}: StepPalpiteProps) {
  const [placarBrasil, setPlacarBrasil] = useState<string>('');
  const [placarMarrocos, setPlacarMarrocos] = useState<string>('');
  const [activeInput, setActiveInput] = useState<'brasil' | 'marrocos' | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const now = new Date();
  const isClosed = now >= DEADLINE;

  // Initialize scores if user has an existing guess
  useEffect(() => {
    if (existingGuess) {
      setPlacarBrasil(String(existingGuess.placar_brasil));
      setPlacarMarrocos(String(existingGuess.placar_adversario));
    }
  }, [existingGuess]);

  const isValid = placarBrasil !== '' && placarMarrocos !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isLoading) {
      const brVal = parseInt(placarBrasil, 10);
      const opVal = parseInt(placarMarrocos, 10);
      
      if (existingGuess && onUpdateSubmit) {
        onUpdateSubmit(brVal, opVal);
      } else {
        onSubmit(brVal, opVal);
      }
    }
  };

  const handleScoreChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 2) {
      setter(clean);
    }
  };

  // Scenario B: Recurring user, not currently editing
  if (existingGuess && !isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="space-y-8 py-4 text-center"
      >
        {/* Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
            <Trophy className="w-3.5 h-3.5 text-yellow-400 fill-current animate-pulse" />
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
              Participação Confirmada
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter italic uppercase leading-none">
            Você já está participando! ⚽
          </h2>
        </div>

        {/* Existing Guess Display Card */}
        <div className="card-glass p-6 max-w-sm mx-auto bg-gradient-to-b from-white/[0.04] to-transparent border-white/5 space-y-4">
          <p className="text-sm text-white/60">Seu palpite cadastrado atual é:</p>
          
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="flex flex-col items-center gap-1">
              <img src={brazilFlag} alt="Brasil" className="w-12 h-12 object-contain" />
              <span className="text-[10px] font-bold text-white/50 uppercase">Brasil</span>
            </div>
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-2xl border border-white/5 font-mono">
              <span className="text-2xl font-black text-white">{existingGuess.placar_brasil}</span>
              <span className="text-xs text-white/20">×</span>
              <span className="text-2xl font-black text-white">{existingGuess.placar_adversario}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <img src={moroccoFlag} alt="Marrocos" className="w-12 h-12 object-contain" />
              <span className="text-[10px] font-bold text-white/50 uppercase">Marrocos</span>
            </div>
          </div>
          
          <p className="text-[10px] text-white/30 uppercase font-mono">
            Registrado em: {formatDataBrasilia(existingGuess.horario_brasil)}
          </p>
        </div>

        {/* Action Button depending on deadline */}
        <div className="max-w-sm mx-auto pt-2">
          {isClosed ? (
            <div className="flex items-center justify-center gap-2 text-xs text-manos-red font-black uppercase tracking-widest bg-manos-red/10 border border-manos-red/20 py-4 px-6 rounded-2xl">
              <AlertCircle className="w-4 h-4" />
              Tempo esgotado para alterações
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-4 bg-white/5 border border-white/10 text-white font-black text-sm uppercase rounded-2xl hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Edit className="w-4 h-4 text-manos-red" />
              Alterar meu palpite
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // General deadline closed page (for non-guessers)
  if (isClosed && !existingGuess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6 py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 bg-manos-red/10 border border-manos-red/20 rounded-full flex items-center justify-center mx-auto"
        >
          <Clock className="w-10 h-10 text-manos-red" />
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-3xl font-black tracking-tighter italic uppercase leading-none">
            Inscrições <span className="text-manos-red">Encerradas!</span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-xs mx-auto">
            O jogo já vai começar. As inscrições foram encerradas às 19h.
          </p>
        </div>

        <div className="card-glass p-4 max-w-xs mx-auto">
          <p className="text-xs text-white/40">
            Fique ligado no resultado e na nossa próxima promoção!
          </p>
        </div>
      </motion.div>
    );
  }

  // Input editing page (for new palpite or updating current palpite)
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      {/* Title */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full animate-bounce">
          <Trophy className="w-3.5 h-3.5 text-yellow-400 fill-current" />
          <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
            {existingGuess ? 'Editar palpite da Copa' : 'Faça seu palpite da Copa'}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tighter italic uppercase leading-none">
          {existingGuess ? 'Altere o seu palpite,' : 'Qual o seu palpite,'}{' '}
          <span className="text-manos-red">{nome.split(' ')[0]}</span>? ⚽
        </h2>

        <p className="text-xs text-white/40 uppercase tracking-widest font-black">
          Brasil x Marrocos
        </p>
      </div>

      {/* Score inputs */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {/* Brazil Glowing Card */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className={`flex-1 card-glass p-4 sm:p-5 flex flex-col items-center gap-3 transition-all duration-300 border ${
              activeInput === 'brasil' 
                ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.25)] bg-green-500/5' 
                : 'border-white/5 hover:border-green-500/40'
            }`}
          >
            <img 
              src={brazilFlag} 
              alt="Brasil" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_4px_12px_rgba(34,197,94,0.35)]" 
            />
            <span className="text-xs font-black uppercase tracking-widest text-green-400">
              Brasil
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={placarBrasil}
              onFocus={() => setActiveInput('brasil')}
              onBlur={() => setActiveInput(null)}
              onChange={(e) => handleScoreChange(setPlacarBrasil, e.target.value)}
              autoFocus
              className="w-16 h-16 sm:w-20 sm:h-20 text-center text-3xl sm:text-4xl font-black bg-[#1A1A1A] border border-white/10 rounded-2xl outline-none focus:border-green-500/80 transition-all text-white"
              placeholder="0"
            />
          </motion.div>

          {/* X Divider */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-white/20 italic">VS</span>
          </div>

          {/* Morocco Glowing Card */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className={`flex-1 card-glass p-4 sm:p-5 flex flex-col items-center gap-3 transition-all duration-300 border ${
              activeInput === 'marrocos' 
                ? 'border-manos-red shadow-[0_0_30px_rgba(237,28,36,0.25)] bg-manos-red/5' 
                : 'border-white/5 hover:border-manos-red/40'
            }`}
          >
            <img 
              src={moroccoFlag} 
              alt="Marrocos" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_4px_12px_rgba(237,28,36,0.35)]" 
            />
            <span className="text-xs font-black uppercase tracking-widest text-manos-red">
              Marrocos
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={placarMarrocos}
              onFocus={() => setActiveInput('marrocos')}
              onBlur={() => setActiveInput(null)}
              onChange={(e) => handleScoreChange(setPlacarMarrocos, e.target.value)}
              className="w-16 h-16 sm:w-20 sm:h-20 text-center text-3xl sm:text-4xl font-black bg-[#1A1A1A] border border-white/10 rounded-2xl outline-none focus:border-manos-red/80 transition-all text-white"
              placeholder="0"
            />
          </motion.div>
        </div>

        {/* Info card */}
        <div className="card-glass p-4 space-y-2 max-w-sm mx-auto">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 animate-pulse" />
            <p className="text-xs text-white/60">
              Apostas abertas até <span className="text-white font-bold">13/06 às 19:00</span> (horário de Brasília)
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          {existingGuess && (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-6 py-5 bg-white/5 border border-white/10 text-white/60 font-bold uppercase rounded-2xl hover:bg-white/10 transition-all min-h-[48px]"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="flex-1 py-5 bg-gradient-to-r from-manos-red to-red-600 text-white font-black text-lg uppercase rounded-2xl shadow-[0_20px_50px_rgba(237,28,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {existingGuess ? 'Atualizando...' : 'Registrando...'}
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5" />
                {existingGuess ? 'Atualizar Palpite' : 'Enviar Palpite'}
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
