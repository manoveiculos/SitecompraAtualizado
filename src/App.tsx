import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  Handshake, 
  CreditCard, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Clock,
  ExternalLink
} from 'lucide-react';
import { cn } from './lib/utils';
import { createLead, testConnection } from './lib/leads';
import { fetchStock, type Vehicle } from './services/stockService';

type LeadType = 'Compra' | 'Venda' | 'Financiamento';

interface QuizState {
  step: number;
  type: LeadType | null;
  data: Record<string, any>;
  selectedVehicle: Vehicle | null;
}

export default function App() {
  const [quiz, setQuiz] = useState<QuizState>({
    step: 1,
    type: null,
    data: {},
    selectedVehicle: null,
  });
  const [stock, setStock] = useState<Vehicle[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPhone = (val: string) => {
    let r = val.replace(/\D/g, "");
    if (r.length > 11) r = r.substring(0, 11);
    if (r.length > 10) {
      return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (r.length > 6) {
      return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (r.length > 2) {
      return r.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
    } else if (r.length > 0) {
      return "(" + r;
    }
    return r;
  };

  const isBusinessHours = () => {
    const now = new Date();
    const hours = now.getHours();
    const day = now.getDay(); // 0 is Sunday, 6 is Saturday
    return day >= 1 && day <= 5 && hours >= 8 && hours < 18;
  };

  useEffect(() => {
    testConnection();
    const loadStock = async () => {
      setIsLoadingStock(true);
      const data = await fetchStock();
      setStock(data);
      setIsLoadingStock(false);
    };
    loadStock();
  }, []);

  const handleInitialChoice = (type: LeadType) => {
    setQuiz({ step: 2, type, data: {}, selectedVehicle: null });
  };

  const handleDataChange = (field: string, value: any) => {
    setQuiz(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value },
    }));
  };

  const nextStep = () => {
    setQuiz(prev => ({ ...prev, step: prev.step + 1 }));
  };

  const navigateBack = () => {
    if (quiz.step === 7 && quiz.data.tem_troca === 'Não' && quiz.type === 'Compra') {
      setQuiz(prev => ({ ...prev, step: 5 }));
    } else if (quiz.step === 2) {
      setQuiz({ step: 1, type: null, data: {}, selectedVehicle: null });
    } else if (quiz.step > 1) {
      setQuiz(prev => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const phone = quiz.data.phone?.replace(/\D/g, '') || '';
    if (!quiz.data.name || phone.length < 10) {
      setError("Por favor, preencha seu nome e um WhatsApp válido.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const { name, phone: rawPhone, ...otherData } = quiz.data;
      
      await createLead({
        name,
        phone,
        lead_type: quiz.type,
        details: {
          ...otherData,
          id_veiculo: quiz.selectedVehicle?.id,
          nome_veiculo: quiz.selectedVehicle?.description,
          valor_veiculo: quiz.selectedVehicle?.price,
        },
      });

      // Show success screen
      // 2. Track Lead event in Meta Pixel
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Lead', {
          content_name: quiz.type,
          status: 'submitted'
        });
      }

      setIsSuccess(true);
    } catch (err) {
      console.error("Submission error:", err);
      setError("Ocorreu um erro ao enviar. Por favor, tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxSteps = quiz.type === 'Compra' ? 9 : (quiz.type === 'Venda' ? 10 : 5);
  const progressValue = (quiz.step / maxSteps) * 100;
  const isPhoneValid = (quiz.data.phone?.replace(/\D/g, '') || '').length >= 10;
  const isFormValid = quiz.data.name && isPhoneValid;

  return (
    <div className="app-viewport lg:max-w-none lg:h-auto lg:min-h-screen lg:bg-black/40 lg:flex lg:items-center lg:justify-center lg:p-12">
      <div className="glow-bg" />

      <div className="app-viewport lg:h-[800px] lg:rounded-[32px] lg:shadow-2xl lg:border lg:border-white/5 lg:relative">
        {/* Header - Fixed & Minimalist */}
        <header className="p-4 flex flex-col items-center gap-3 z-20 backdrop-blur-md bg-manos-dark/50 lg:rounded-t-[32px]">
          <img 
            src="https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png" 
            alt="Manos Veículos" 
            className="h-8 w-auto object-contain"
          />
          
          {!isSuccess && quiz.step > 1 && (
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    {quiz.step <= 2 ? 'Início' : 
                     quiz.step < maxSteps ? 'Preferências' : 'Finalizando'}
                 </span>
                 <button 
                   onClick={navigateBack}
                   className="flex items-center gap-1 text-[10px] font-black text-manos-red uppercase tracking-widest hover:brightness-125 active:scale-95 transition-all"
                 >
                   <ChevronLeft className="w-3 h-3" />
                   Voltar
                 </button>
                 <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Passo {quiz.step} de {maxSteps}
                 </span>
              </div>
              <div className="w-full flex items-center gap-3">
               <div className="flex-grow h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressValue}%` }}
                    className="h-full bg-manos-red"
                  />
               </div>
               <span className="text-[10px] font-black text-manos-red tracking-widest">{Math.round(progressValue)}%</span>
              </div>
            </div>
          )}
        </header>

      {/* Main Content - Scrollable Region */}
      <main className="scroll-container custom-scrollbar">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center pt-6 space-y-8"
            >
              <div className="relative inline-block">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(34,197,94,0.3)]"
                >
                  <Check className="w-10 h-10 text-white" />
                </motion.div>
                <div className="absolute inset-0 bg-green-500 blur-3xl opacity-10 -z-10" />
              </div>

              <div className="space-y-4 px-4">
                <h2 className="text-3xl font-black tracking-tighter leading-none italic uppercase text-white">Solicitação Recebida!</h2>
                <div className="space-y-4">
                  <p className="text-white/80 text-base leading-relaxed">
                    Obrigado pela confiança, <span className="text-manos-red font-bold">{quiz.data.name}</span>! Seus dados foram encaminhados com sucesso para nossa consultoria especializada.
                  </p>
                  <p className="text-white/60 text-sm leading-relaxed border-l-2 border-manos-red/30 pl-4 py-1 italic">
                    Fique atento ao seu WhatsApp. Em instantes, um de nossos consultores entrará em contato para dar continuidade ao seu atendimento de forma personalizada.
                  </p>
                </div>
              </div>

              <div className="px-4 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 text-center">Enquanto isso, explore:</p>
                <a 
                  href="https://manosveiculos.com.br/estoque/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center gap-4 group hover:bg-white/10 transition-all text-left shadow-xl shadow-black/20"
                >
                  <div className="w-12 h-12 bg-manos-red rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-manos-red/20 flex-shrink-0">
                    <ExternalLink className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tighter italic text-white">Navegar pelo Estoque</p>
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">manosveiculos.com.br</p>
                  </div>
                </a>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="text-[10px] font-black uppercase tracking-widest text-white/10 hover:text-white/30 transition-colors"
                >
                  Finalizar Sessão
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={quiz.step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="space-y-8"
            >
              {quiz.step === 1 && (
                <div className="space-y-8">
                  <div className="space-y-4 text-center">
                    <h1 className="text-4xl font-black tracking-tighter leading-[0.9] italic uppercase">
                      Escolha seu <br />
                      <span className="text-manos-red">Próximo Nível</span>
                    </h1>
                  </div>
                  
                  <div className="grid gap-4">
                    <MainOption 
                      icon={<Car className="w-8 h-8" />}
                      title="Quero Comprar"
                      desc="Estoque selecionado Manos"
                      onClick={() => handleInitialChoice('Compra')}
                    />
                    <MainOption 
                      icon={<Handshake className="w-8 h-8" />}
                      title="Quero Vender"
                      desc="Avaliação justa agora"
                      onClick={() => handleInitialChoice('Venda')}
                    />
                    <MainOption 
                      icon={<CreditCard className="w-8 h-8" />}
                      title="Financiamento"
                      desc="As melhores taxas do mercado"
                      onClick={() => handleInitialChoice('Financiamento')}
                    />
                  </div>
                </div>
              )}

              {quiz.step === 2 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Já viu um carro?</h2>
                  <div className="grid gap-4">
                    <QuizButton 
                      icon={<Check className="w-6 h-6" />}
                      label="Sim, já escolhi!"
                      onClick={() => { handleDataChange('has_interest', 'Sim'); nextStep(); }}
                    />
                    <QuizButton 
                      icon={<ArrowRight className="w-6 h-6" />}
                      label="Quero ver o estoque"
                      onClick={() => { handleDataChange('has_interest', 'Não'); nextStep(); }}
                    />
                  </div>
                </div>
              )}

              {quiz.step === 3 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                  {quiz.data.has_interest === 'Sim' ? (
                    <div className="space-y-6">
                      <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Qual modelo?</h2>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
                        <input 
                          type="text"
                          className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 pl-12 focus:ring-2 focus:ring-manos-red/30 outline-none text-lg transition-all"
                          placeholder="Ex: BMW, Hilux..."
                          value={searchQuery}
                          autoFocus
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-4 pb-12">
                        {isLoadingStock ? (
                          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                        ) : (
                          stock
                            .filter(v => v.description.toLowerCase().includes(searchQuery.toLowerCase()))
                            .slice(0, 10)
                            .map(v => (
                              <VehicleCard 
                                key={v.id} 
                                vehicle={v} 
                                onClick={() => { setQuiz(prev => ({ ...prev, selectedVehicle: v, step: 5 })); }} 
                              />
                            ))
                        )}
                        {!isLoadingStock && stock.length === 0 && <p className="text-center text-white/30 py-8 italic uppercase text-xs font-bold">Nenhum veículo encontrado.</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Qual orçamento?</h2>
                      <div className="grid gap-3">
                        <OptionButton label="Até R$ 50k" active={priceFilter === '50k'} onClick={() => { setPriceFilter('50k'); nextStep(); }} />
                        <OptionButton label="De R$ 50k a 100k" active={priceFilter === '100k'} onClick={() => { setPriceFilter('100k'); nextStep(); }} />
                        <OptionButton label="Acima de 100k" active={priceFilter === 'plus'} onClick={() => { setPriceFilter('plus'); nextStep(); }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {quiz.step === 4 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase">Sugestões:</h2>
                  <div className="grid gap-4 pb-12">
                    {isLoadingStock ? (
                      Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                    ) : (
                      stock
                        .filter(v => {
                          if (priceFilter === '50k') return v.price <= 50000;
                          if (priceFilter === '100k') return v.price > 50000 && v.price <= 100000;
                          if (priceFilter === 'plus') return v.price > 100000;
                          return true;
                        })
                        .slice(0, 10)
                        .map(v => (
                          <VehicleCard key={v.id} vehicle={v} onClick={() => { setQuiz(prev => ({ ...prev, selectedVehicle: v, step: 5 })); }} />
                        ))
                    )}
                  </div>
                </div>
              )}

              {quiz.step === 5 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Possui troca?</h2>
                  <div className="grid gap-4">
                    <QuizButton 
                      key="sim"
                      icon={<Check className="w-6 h-6" />}
                      label="Sim, tenho um veículo"
                      onClick={() => { handleDataChange('tem_troca', 'Sim'); nextStep(); }}
                    />
                    <QuizButton 
                      key="nao"
                      icon={<ArrowRight className="w-6 h-6" />}
                      label="Não, apenas compra"
                      onClick={() => { handleDataChange('tem_troca', 'Não'); setQuiz(prev => ({ ...prev, step: 7 })); }}
                    />
                  </div>
                </div>
              )}

              {quiz.step === 6 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                   <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Seu veículo na troca:</h2>
                   <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">Modelo e Ano</label>
                        <textarea 
                          className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 h-32 outline-none focus:border-manos-red/40" 
                          placeholder="Ex: Onix 2020..." 
                          value={quiz.data.troca_detalhes || ''} 
                          onChange={(e) => handleDataChange('troca_detalhes', e.target.value)} 
                        />
                      </div>
                      <button 
                        onClick={nextStep} 
                        disabled={!quiz.data.troca_detalhes}
                        className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                      >
                        Continuar
                      </button>
                   </div>
                </div>
              )}

              {quiz.step === 7 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                   <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Precisa financiar?</h2>
                    <div className="grid gap-4">
                      <QuizButton 
                        icon={<CreditCard className="w-6 h-6" />}
                        label="Sim, quero simular"
                        onClick={() => { handleDataChange('quer_financiamento', 'Sim'); nextStep(); }}
                      />
                      <QuizButton 
                        icon={<Check className="w-6 h-6" />}
                        label="Não, compra à vista"
                        onClick={() => { handleDataChange('quer_financiamento', 'Não'); nextStep(); }}
                      />
                    </div>
                </div>
              )}

              {quiz.step === 8 && quiz.type === 'Compra' && (
                <div className="space-y-6">
                   <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Qual sua cidade?</h2>
                   <div className="space-y-4">
                      <input 
                        type="text" 
                        className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 outline-none focus:border-manos-red/40 text-lg"
                        placeholder="Ex: Blumenau / SC"
                        value={quiz.data.cidade || ''}
                        onChange={(e) => handleDataChange('cidade', e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={nextStep} 
                        disabled={!quiz.data.cidade}
                        className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                      >
                        Continuar
                      </button>
                   </div>
                </div>
              )}

              {/* Steps 2-X for Venda */}
              {quiz.type === 'Venda' && quiz.step === 2 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Marca e Modelo</h2>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 outline-none focus:border-manos-red/40 text-lg"
                      placeholder="Ex: Toyota Corolla"
                      value={quiz.data.marca_modelo || ''}
                      onChange={(e) => handleDataChange('marca_modelo', e.target.value)}
                      autoFocus
                    />
                    <button 
                      onClick={nextStep} 
                      disabled={!quiz.data.marca_modelo}
                      className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              {quiz.type === 'Venda' && quiz.step === 3 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Ano e Versão</h2>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 outline-none focus:border-manos-red/40 text-lg"
                      placeholder="Ex: 2022 XEi"
                      value={quiz.data.ano_versao || ''}
                      onChange={(e) => handleDataChange('ano_versao', e.target.value)}
                      autoFocus
                    />
                    <button 
                      onClick={nextStep} 
                      disabled={!quiz.data.ano_versao}
                      className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              {quiz.type === 'Venda' && quiz.step === 4 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">KM Atual</h2>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 outline-none focus:border-manos-red/40 text-lg"
                      placeholder="Ex: 45.000"
                      value={quiz.data.km || ''}
                      onChange={(e) => handleDataChange('km', e.target.value.replace(/\D/g, '').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'))}
                      autoFocus
                    />
                    <button 
                      onClick={nextStep} 
                      disabled={!quiz.data.km}
                      className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              {quiz.type === 'Venda' && quiz.step === 5 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Preço que espera</h2>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 outline-none focus:border-manos-red/40 text-lg"
                      placeholder="Ex: 95.000"
                      value={quiz.data.preco_esperado || ''}
                      onChange={(e) => handleDataChange('preco_esperado', e.target.value.replace(/\D/g, '').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'))}
                      autoFocus
                    />
                    <button 
                      onClick={nextStep} 
                      disabled={!quiz.data.preco_esperado}
                      className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              {quiz.type === 'Venda' && quiz.step === 6 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Cidade do carro</h2>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 outline-none focus:border-manos-red/40 text-lg"
                      placeholder="Ex: Blumenau / SC"
                      value={quiz.data.cidade_carro || ''}
                      onChange={(e) => handleDataChange('cidade_carro', e.target.value)}
                      autoFocus
                    />
                    <button 
                      onClick={nextStep} 
                      disabled={!quiz.data.cidade_carro}
                      className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl disabled:opacity-30 active:scale-95 transition-all"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              {quiz.type === 'Venda' && quiz.step === 7 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center text-balance leading-none">Disponibilidade p/ avaliação presencial?</h2>
                  <div className="grid gap-3">
                    {['Imediata', 'Próximos dias', 'Apenas agendado'].map(v => (
                      <StepOption 
                        key={v} 
                        label={v} 
                        active={quiz.data.disponibilidade === v} 
                        onClick={() => { handleDataChange('disponibilidade', v); nextStep(); }} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {quiz.type === 'Venda' && quiz.step === 8 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center text-balance leading-none">Como prefere a avaliação?</h2>
                  <div className="grid gap-4">
                    <QuizButton 
                      icon={<Car className="w-6 h-6" />}
                      label="Vou até a Manos"
                      onClick={() => { handleDataChange('preferencia_avaliacao', 'Vou até a loja'); nextStep(); }}
                    />
                    <QuizButton 
                      icon={<Search className="w-6 h-6" />}
                      label="Especialista vir até mim"
                      onClick={() => { handleDataChange('preferencia_avaliacao', 'Especialista vem até mim'); nextStep(); }}
                    />
                  </div>
                </div>
              )}

              {quiz.type === 'Venda' && quiz.step === 9 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center uppercase">Urgência na venda</h2>
                  <div className="grid gap-3">
                    {['Urgente', 'Sem pressa', 'Apenas avaliando'].map(v => (
                      <StepOption 
                        key={v} 
                        label={v} 
                        active={quiz.data.urgency === v} 
                        onClick={() => { handleDataChange('urgency', v); nextStep(); }} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2-4 for Financiamento (only) */}
              {(quiz.step > 1 && quiz.step < 5 && quiz.type === 'Financiamento') && (
                <div className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black tracking-tighter italic uppercase">
                      {quiz.step === 2 ? "Já escolheu o carro?" : quiz.step === 3 ? "Deseja dar entrada?" : "Qual parcela procura?"}
                    </h2>
                  </div>
                  <div className="grid gap-4">
                    {quiz.step === 2 && ['Sim, do estoque', 'Não, ainda procurando'].map(v => <StepOption key={v} label={v} active={quiz.data.has_car === v} onClick={() => { handleDataChange('has_car', v); nextStep(); }} />)}
                    {quiz.step === 3 && ['Sem entrada', 'Até 10k', 'Mais de 20k'].map(v => <StepOption key={v} label={v} active={quiz.data.down_payment === v} onClick={() => { handleDataChange('down_payment', v); nextStep(); }} />)}
                    {quiz.step === 4 && ['R$ 800 - R$ 1.200', 'R$ 1.200 - R$ 1.800', 'Acima de R$ 2.000'].map(v => <StepOption key={v} label={v} active={quiz.data.desired_payment === v} onClick={() => { handleDataChange('desired_payment', v); nextStep(); }} />)}
                  </div>
                </div>
              )}

              {((quiz.step === 9 && quiz.type === 'Compra') || (quiz.step === 10 && quiz.type === 'Venda') || (quiz.step === 5 && quiz.type === 'Financiamento')) && (
                <div className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black tracking-tighter italic uppercase leading-none">Último Passo</h2>
                    <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">Consultoria Prioritária</p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">Nome completo</label>
                      <input type="text" required autoComplete="name" className="w-full py-5 px-6" placeholder="Ex: Seu nome aqui" value={quiz.data.name || ''} onChange={(e) => handleDataChange('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">WhatsApp (DDD + Número)</label>
                      <div className="relative">
                        <input type="tel" required inputMode="numeric" autoComplete="tel" 
                          className={cn(
                            "w-full py-5 px-6 pr-12 transition-all",
                            quiz.data.phone && (isPhoneValid ? "border-green-500/50" : "border-manos-red/50")
                          )}
                          placeholder="(47) 99999-9999" 
                          value={quiz.data.phone || ''} 
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value);
                            handleDataChange('phone', formatted);
                          }} 
                        />
                        {quiz.data.phone && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {isPhoneValid ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500 animate-in zoom-in" />
                            ) : (
                              <AlertCircle className="w-6 h-6 text-manos-red animate-in fade-in" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {error && <p className="text-manos-red font-black text-center text-xs uppercase tracking-widest">{error}</p>}
                    
                    <button 
                      type="submit"
                      disabled={isSubmitting || !isFormValid}
                      className="w-full py-5 bg-manos-red text-white font-black text-lg uppercase rounded-2xl shadow-2xl shadow-manos-red/20 active:scale-95 transition-all disabled:opacity-30"
                    >
                      {isSubmitting ? 'Finalizando...' : 'Finalizar Consultoria'}
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Sticky Action Footer */}
      {!isSuccess && (
        <div className="sticky-footer">
          {quiz.step > 1 ? (
            <div className="flex gap-4">
              <button 
                onClick={navigateBack} 
                className="w-16 h-16 flex items-center justify-center bg-white/5 border border-white/5 rounded-2xl text-white/20 active:scale-95 transition-all"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              {((quiz.step === 9 && quiz.type === 'Compra') || (quiz.step === 10 && quiz.type === 'Venda') || (quiz.step === 5 && quiz.type === 'Financiamento')) ? (
                <button 
                  onClick={() => handleSubmit()} 
                  disabled={isSubmitting || !isFormValid}
                  className="flex-grow bg-manos-red text-white font-black text-lg uppercase rounded-2xl shadow-2xl shadow-manos-red/20 active:scale-95 transition-all disabled:opacity-30"
                >
                  {isSubmitting ? 'Finalizando...' : 'Finalizar Consultoria'}
                </button>
              ) : (
                <div className="flex-grow flex items-center justify-center">
                  <span className="text-white/10 font-black italic uppercase text-lg tracking-tighter">Manos Veículos</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-2 space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="flex -space-x-2">
                  {Array.from({ length: isBusinessHours() ? 5 : 1 }).map((_, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-manos-dark bg-white/10 flex items-center justify-center text-[8px] font-black text-white/40">M</div>
                  ))}
                </div>
                <span className="text-[10px] font-black tracking-widest uppercase text-white/20 italic">
                  {isBusinessHours() ? '5 consultores online no momento' : '1 consultor disponível no momento'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function QuizButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void, key?: any }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card-glass p-5 text-left flex items-center gap-4 group hover:border-manos-red/30 transition-all"
    >
      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-manos-red/10 transition-all">
        {icon}
      </div>
      <span className="font-black text-sm uppercase italic tracking-tighter">{label}</span>
    </motion.button>
  );
}

function VehicleCard({ vehicle, onClick }: { vehicle: Vehicle, onClick: () => void, key?: any }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card-glass p-4 text-left group relative overflow-hidden transition-all hover:border-manos-red/30"
    >
      <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-white/5 mb-4 relative">
        <img 
          src={vehicle.image} 
          alt={vehicle.description} 
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" 
          referrerPolicy="no-referrer" 
        />
      </div>
      <div className="space-y-2">
        <h4 className="font-black text-sm tracking-tighter leading-tight uppercase italic line-clamp-1">
          {vehicle.description}
        </h4>
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-white/30 text-[9px] font-black uppercase tracking-widest">
            <span>{vehicle.year}</span>
            <span>•</span>
            <span>{vehicle.km}</span>
          </div>
          <p className="text-manos-red font-black text-lg tracking-tighter italic">
            {vehicle.priceFormatted}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

function SkeletonCard() {
  return (
    <div className="card-glass p-3 flex flex-col w-full animate-pulse border border-white/5">
      <div className="aspect-video w-full rounded-xl bg-white/5 mb-3" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 bg-white/5 rounded" />
        <div className="flex justify-between">
          <div className="h-2 w-1/4 bg-white/5 rounded" />
          <div className="h-2 w-1/4 bg-white/5 rounded" />
        </div>
        <div className="h-6 w-1/2 bg-white/5 rounded mt-2" />
      </div>
    </div>
  );
}

function MainOption({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void, key?: any }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="card-glass p-6 text-left hover:border-manos-red/30 transition-all group relative overflow-hidden"
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-manos-red group-hover:bg-manos-red group-hover:text-white transition-all shadow-lg">
          {icon}
        </div>
        <div>
          <h3 className="font-black text-lg tracking-tight uppercase italic">{title}</h3>
          <p className="text-white/30 text-xs font-bold leading-tight uppercase tracking-wider">{desc}</p>
        </div>
        <ChevronRight className="ml-auto w-5 h-5 text-white/10 group-hover:text-manos-red group-hover:translate-x-1 transition-all" />
      </div>
    </motion.button>
  );
}

function OptionButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void, key?: any }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full py-5 rounded-2xl font-black uppercase text-sm italic tracking-tighter transition-all border",
        active 
          ? "bg-manos-red text-white border-manos-red shadow-lg shadow-manos-red/20" 
          : "bg-white/5 text-white/50 border-white/5 hover:border-white/20"
      )}
    >
      {label}
    </button>
  );
}

function StepOption({ label, active, onClick }: { label: string, active: boolean, onClick: () => void, key?: any }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full py-5 rounded-2xl font-black uppercase text-sm italic tracking-tighter transition-all border",
        active 
          ? "bg-manos-red text-white border-manos-red shadow-lg shadow-manos-red/20" 
          : "bg-white/5 text-white/50 border-white/5 hover:border-white/20"
      )}
    >
      {label}
    </button>
  );
}

function BackButton({ onClick, className }: { onClick: () => void, className?: string }) {
  return (
    <button 
      onClick={onClick}
      type="button"
      className={cn("flex items-center gap-2 text-white/40 hover:text-white transition-all text-sm font-bold uppercase tracking-widest", className)}
    >
      <ChevronLeft className="w-4 h-4" />
      Voltar
    </button>
  );
}

