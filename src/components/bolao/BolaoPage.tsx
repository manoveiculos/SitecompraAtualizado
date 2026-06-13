import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import BolaoHeader from './BolaoHeader';
import StepIdentificacao from './StepIdentificacao';
import StepValidacao from './StepValidacao';
import StepPalpite from './StepPalpite';
import StepSucesso from './StepSucesso';
import TransparenciaDashboard from './TransparenciaDashboard';
import Toast, { useToast } from './Toast';
import { registerLead, savePalpite, updatePalpite, getPalpiteByPhone, type Palpite } from '../../services/bolaoService';

interface LeadData {
  nome: string;
  whatsapp: string;
}

export default function BolaoPage() {
  const [step, setStep] = useState(1);
  const [leadData, setLeadData] = useState<LeadData>({ nome: '', whatsapp: '' });
  const [palpite, setPalpite] = useState({ brasil: 0, marrocos: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'aposta' | 'transparencia'>('aposta');
  const [existingGuess, setExistingGuess] = useState<Palpite | null>(null);
  const { toast, showToast, hideToast } = useToast();

  // Step 1: Handle lead registration
  const handleIdentificacao = async (nome: string, whatsapp: string) => {
    setIsLoading(true);
    try {
      await registerLead(nome, whatsapp);
      setLeadData({ nome, whatsapp });
      setStep(2);
      showToast('Dados registrados com sucesso!', 'success');
    } catch (error) {
      console.error('Lead registration error:', error);
      // Even if webhook fails, proceed (lead was captured in attempt)
      setLeadData({ nome, whatsapp });
      setStep(2);
      showToast('Avançando... verifique seu WhatsApp.', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle code verification & check existing guess
  const handleValidacao = async () => {
    setIsLoading(true);
    try {
      const guess = await getPalpiteByPhone(leadData.whatsapp);
      if (guess) {
        setExistingGuess(guess);
        setPalpite({ brasil: guess.placar_brasil, marrocos: guess.placar_adversario });
        showToast('Você já possui um palpite cadastrado!', 'info');
      } else {
        setExistingGuess(null);
        showToast('Código verificado com sucesso!', 'success');
      }
      setStep(3);
    } catch (error) {
      console.error('Check phone error:', error);
      setStep(3);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3 (Cenário A): Handle palpite submission
  const handlePalpite = async (placarBrasil: number, placarMarrocos: number) => {
    setIsLoading(true);
    try {
      await savePalpite(leadData.nome, leadData.whatsapp, placarBrasil, placarMarrocos);
      setPalpite({ brasil: placarBrasil, marrocos: placarMarrocos });
      setStep(4);
      showToast('Palpite registrado! Boa sorte! 🍀', 'success');
    } catch (error) {
      console.error('Palpite save error:', error);
      showToast('Erro ao registrar palpite. Tente novamente.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3 (Cenário B): Handle palpite update
  const handleUpdatePalpite = async (placarBrasil: number, placarMarrocos: number) => {
    setIsLoading(true);
    try {
      await updatePalpite(leadData.nome, leadData.whatsapp, placarBrasil, placarMarrocos);
      setPalpite({ brasil: placarBrasil, marrocos: placarMarrocos });
      setStep(4);
      showToast('Palpite atualizado com sucesso! 🍀', 'success');
    } catch (error) {
      console.error('Palpite update error:', error);
      showToast('Erro ao atualizar palpite. Tente novamente.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate back
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="bolao-viewport">
      <div className="bolao-glow" />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      <BolaoHeader
        currentStep={activeTab === 'transparencia' ? 1 : step}
        totalSteps={4}
        onBack={handleBack}
        showBack={activeTab === 'aposta' && step > 1 && step < 4}
      />

      {/* Tab Switcher - only visible if user has not yet completed the prediction */}
      {step < 4 && (
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
      )}

      <main className="scroll-container custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'transparencia' && step < 4 ? (
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
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
            >
              {step === 1 && (
                <StepIdentificacao
                  onNext={handleIdentificacao}
                  isLoading={isLoading}
                />
              )}

              {step === 2 && (
                <StepValidacao
                  whatsapp={leadData.whatsapp}
                  onNext={handleValidacao}
                  isLoading={isLoading}
                />
              )}

              {step === 3 && (
                <StepPalpite
                  nome={leadData.nome}
                  onSubmit={handlePalpite}
                  isLoading={isLoading}
                  existingGuess={existingGuess}
                  onUpdateSubmit={handleUpdatePalpite}
                />
              )}

              {step === 4 && (
                <StepSucesso
                  nome={leadData.nome}
                  placarBrasil={palpite.brasil}
                  placarMarrocos={palpite.marrocos}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer branding */}
      {step < 4 && (
        <div className="sticky-footer">
          <div className="text-center py-2">
            <p className="text-[9px] text-white/10 uppercase tracking-[0.3em] font-black italic">
              Manos Veículos • Copa 2026
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
