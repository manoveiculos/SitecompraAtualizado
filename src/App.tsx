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
  ExternalLink,
  Star,
  ShieldCheck,
  Shield,
  MapPin,
  Zap,
  Building2,
  History,
  LayoutGrid
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
  const [showPlanB, setShowPlanB] = useState(false);
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

  const handleWhatsAppClick = (context: string) => {
    // Lead event on WhatsApp click
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('trackCustom', 'WhatsAppClick', { context });
    }
    const message = encodeURIComponent(`Olá, estou no site e gostaria de falar com um consultor sobre ${context}.`);
    window.open(`https://wa.me/554733001352?text=${message}`, '_blank');
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
    // Lead Type 'Compra' now goes straight to identifying the vehicle or budget
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
    if (quiz.step === 7 && quiz.type === 'Venda') {
      setQuiz(prev => ({ ...prev, step: 2 }));
    } else if (quiz.step === 7 && quiz.data.tem_troca === 'Não' && quiz.type === 'Compra') {
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
      
      const leadId = await createLead({
        name,
        phone,
        lead_type: quiz.type,
        details: {
          ...otherData,
          id_veiculo: quiz.selectedVehicle?.id,
          nome_veiculo: quiz.selectedVehicle?.description,
          valor_veiculo: quiz.selectedVehicle?.price,
          link_veiculo: quiz.selectedVehicle?.link,
          resumo: `Lead de ${quiz.type} | Interessado em: ${quiz.selectedVehicle ? quiz.selectedVehicle.description : (quiz.data.marca_modelo || quiz.data.carro_venda || 'não especificado')} | Detalhes: ${quiz.data.has_car || ''} ${quiz.data.down_payment || ''} ${quiz.data.desired_payment || ''}`
        },
      });

      // Track Lead event in Meta Pixel
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Lead', {
          content_name: quiz.type,
          status: 'submitted'
        });
      }

      setIsSuccess(true);
    } catch (err) {
      console.error("Submission error:", err);
      setError("Ocorreu um erro ao salvar seus dados.");
      setShowPlanB(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMaxSteps = () => {
    if (quiz.type === 'Compra') return 8;
    if (quiz.type === 'Venda') return 6;
    if (quiz.type === 'Financiamento') return 6;
    return 1;
  };

  const maxSteps = getMaxSteps();
  const progressValue = (quiz.step / maxSteps) * 100;
  const isPhoneValid = (quiz.data.phone?.replace(/\D/g, '') || '').length >= 10;
  const isFormValid = quiz.data.name && isPhoneValid;

  return (
    <div className="app-viewport lg:max-w-none lg:h-auto lg:min-h-screen lg:bg-black/40 lg:flex lg:items-center lg:justify-center lg:p-12">
      <div className="glow-bg" />

      {/* WhatsApp Floating Button */}
      <button 
        onClick={() => handleWhatsAppClick('Botão Flutuante')}
        className="fixed bottom-6 right-6 z-50 group sm:bottom-10 sm:right-10"
      >
        <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="relative w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/20 hover:scale-110 active:scale-95 transition-all">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-white fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </div>
        <div className="absolute right-full mr-4 bottom-1/2 translate-y-1/2">
          <div className="bg-white text-manos-dark text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-xl shadow-2xl whitespace-nowrap hidden sm:block">
            Precisa de ajuda imediata?
          </div>
        </div>
      </button>

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
                  <CheckCircle2 className="w-10 h-10 text-white" />
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
                      Troque de carro <br />
                      <span className="text-manos-red">com quem você confia</span>
                    </h1>
                    <div className="flex items-center justify-center gap-2">
                       <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Consultores online agora</span>
                    </div>
                  </div>
                  
                  <div className="grid gap-4">
                    <MainOption 
                      icon={<Car className="w-8 h-8" />}
                      title="Ver Carros em Estoque"
                      desc="Encontre seu sonho agora"
                      onClick={() => handleInitialChoice('Compra')}
                    />
                    <MainOption 
                      icon={<Handshake className="w-8 h-8" />}
                      title="Avaliar meu Carro agora"
                      desc="Melhor proposta da região"
                      onClick={() => handleInitialChoice('Venda')}
                    />
                    <MainOption 
                      icon={<CreditCard className="w-8 h-8" />}
                      title="Simular meu Financiamento"
                      desc="Aprovação rápida e fácil"
                      onClick={() => handleInitialChoice('Financiamento')}
                    />
                  </div>

                  <div className="flex justify-center gap-6 py-2">
                    <div className="flex flex-col items-center gap-1 opacity-60">
                      <div className="flex text-yellow-500">
                        {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white">4.9 ★ No Google</p>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex flex-col items-center gap-1 opacity-60">
                      <ShieldCheck className="w-4 h-4 text-green-500" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-white">Compra Segura</p>
                    </div>
                  </div>

                  <div className="text-center px-4">
                    <button 
                      onClick={() => handleWhatsAppClick('Especialista via Botão Hero')}
                      className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] hover:text-white/60 transition-colors"
                    >
                      Prefiro falar com um especialista agora &rarr;
                    </button>
                  </div>
                  
                  <div className="mt-8 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                       <MapPin className="w-3 h-3 text-manos-red" />
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Visite nossas unidades</p>
                    </div>
                    <div className="flex gap-4">
                       <a 
                         href="https://www.google.com/maps/dir//Manos+Veiculos,+R.+Dom+Pedro+II,+374+-+Canoas,+Rio+do+Sul+-+SC,+89164-138/@-27.1189403,-48.6088232,15z/data=!4m8!4m7!1m0!1m5!1m1!1s0x94dfb857181b55b3:0x6b728157d42c68f6!2m2!1d-49.6539853!2d-27.2207243?entry=ttu&g_ep=EgoyMDI2MDQyNy4wIKXMDSoASAFQAw%3D%3D"
                         target="_blank"
                         rel="noopener noreferrer"
                         className="text-center group transition-colors hover:bg-white/5 p-2 rounded-xl"
                       >
                          <p className="text-[11px] font-bold text-white/60 group-hover:text-manos-red transition-colors">Rio do Sul</p>
                          <div className="flex items-center justify-center gap-1">
                             <Building2 className="w-2 h-2 text-white/20" />
                             <p className="text-[9px] text-white/30 uppercase tracking-widest font-black">Matriz</p>
                          </div>
                       </a>
                       <div className="w-px h-8 bg-white/5 self-center" />
                       <div className="text-center p-2">
                          <p className="text-[11px] font-bold text-white/60">Itapema SC</p>
                          <div className="flex items-center justify-center gap-1">
                             <History className="w-2 h-2 text-white/20" />
                             <p className="text-[9px] text-white/30 uppercase tracking-widest font-black">Em Breve</p>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {quiz.step === 2 && (quiz.type === 'Compra' || quiz.type === 'Financiamento') && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">
                    {quiz.type === 'Compra' ? "Qual o seu foco hoje?" : "Já escolheu o carro?"}
                  </h2>
                  <div className="grid gap-4">
                    <QuizButton 
                      icon={<Search className="w-6 h-6" />}
                      label={quiz.type === 'Compra' ? "Ver um carro específico" : "Sim, do estoque"}
                      onClick={() => { 
                        handleDataChange(quiz.type === 'Compra' ? 'has_interest' : 'has_car', quiz.type === 'Compra' ? 'Sim' : 'Sim, do estoque'); 
                        nextStep(); 
                      }}
                    />
                    <QuizButton 
                      icon={<Car className="w-6 h-6" />}
                      label={quiz.type === 'Compra' ? "Quero ver sugestões" : "Não, ainda procurando"}
                      onClick={() => { 
                        handleDataChange(quiz.type === 'Compra' ? 'has_interest' : 'has_car', quiz.type === 'Compra' ? 'Não' : 'Não, ainda procurando'); 
                        nextStep(); 
                      }}
                    />
                  </div>
                  <div className="pt-4 text-center">
                    <p className="text-[10px] text-white/20 uppercase tracking-widest font-black">Ou</p>
                    <button 
                      onClick={() => handleWhatsAppClick('Dúvida rápida Passo 2')}
                      className="mt-2 text-xs font-bold text-manos-red uppercase tracking-wider underline underline-offset-4"
                    >
                      Dúvida rápida? Chamar no Whats
                    </button>
                  </div>
                </div>
              )}

              {quiz.step === 3 && (quiz.type === 'Compra' || quiz.type === 'Financiamento') && (
                <div className="space-y-6">
                  {((quiz.type === 'Compra' && quiz.data.has_interest === 'Sim') || 
                    (quiz.type === 'Financiamento' && quiz.data.has_car === 'Sim, do estoque')) ? (
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
                                onClick={() => { 
                                  setQuiz(prev => ({ 
                                    ...prev, 
                                    selectedVehicle: v, 
                                    step: prev.type === 'Compra' ? 5 : 4 
                                  })); 
                                }} 
                              />
                            ))
                        )}
                        {!isLoadingStock && stock.length === 0 && <p className="text-center text-white/30 py-8 italic uppercase text-xs font-bold">Nenhum veículo encontrado.</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {quiz.type === 'Compra' ? (
                        <>
                          <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Quanto você pretende investir no seu novo carro?</h2>
                          <div className="grid gap-3">
                            <OptionButton label="Até R$ 50 mil" active={priceFilter === '50k'} onClick={() => { setPriceFilter('50k'); nextStep(); }} />
                            <OptionButton label="De R$ 50 mil a 100 mil" active={priceFilter === '100k'} onClick={() => { setPriceFilter('100k'); nextStep(); }} />
                            <OptionButton label="Acima de R$ 100 mil" active={priceFilter === 'plus'} onClick={() => { setPriceFilter('plus'); nextStep(); }} />
                          </div>
                        </>
                      ) : (
                        <>
                          <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center">Qual valor de entrada você tem em mente?</h2>
                          <div className="grid gap-3">
                            {['Vou tentar sem entrada', 'Até R$ 10 mil', 'Mais de R$ 20 mil'].map(v => <StepOption key={v} label={v} active={quiz.data.down_payment === v} onClick={() => { handleDataChange('down_payment', v); nextStep(); }} />)}
                          </div>
                        </>
                      )}
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
                <div className="space-y-6 text-center">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase">Você possui troca?</h2>
                  <p className="text-xs text-white/30 uppercase font-bold tracking-widest -mt-4">Aceitamos seu usado com a melhor avaliação</p>
                  <div className="grid gap-4">
                    <QuizButton 
                      key="sim"
                      icon={<Check className="w-6 h-6" />}
                      label="Sim, quero dar meu carro na troca"
                      onClick={() => { handleDataChange('tem_troca', 'Sim'); nextStep(); }}
                    />
                    <QuizButton 
                      key="nao"
                      icon={<ArrowRight className="w-6 h-6" />}
                      label="Não, apenas comprar (à vista/financiado)"
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
                        placeholder="Ex: Rio do Sul / SC"
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
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center领先">Dados do seu Veículo</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">Qual o seu carro? (Marca, Modelo, Versão)</label>
                       <input 
                         type="text" 
                         className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 outline-none focus:border-manos-red/40 text-lg"
                         placeholder="Ex: Corolla XEi 2022"
                         value={quiz.data.marca_modelo || ''}
                         onChange={(e) => handleDataChange('marca_modelo', e.target.value)}
                         autoFocus
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">KM Atual</label>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 outline-none focus:border-manos-red/40 text-base"
                          placeholder="Ex: 45.000"
                          value={quiz.data.km || ''}
                          onChange={(e) => handleDataChange('km', e.target.value.replace(/\D/g, '').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">Preço Desejado</label>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          className="w-full bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 outline-none focus:border-manos-red/40 text-base"
                          placeholder="Ex: 95.000"
                          value={quiz.data.preco_esperado || ''}
                          onChange={(e) => handleDataChange('preco_esperado', e.target.value.replace(/\D/g, '').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'))}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => setQuiz(prev => ({ ...prev, step: 7 }))} 
                      disabled={!quiz.data.marca_modelo}
                      className="w-full py-5 bg-manos-red text-white font-black uppercase rounded-2xl shadow-xl shadow-manos-red/20 disabled:opacity-30 active:scale-95 transition-all"
                    >
                      Continuar Avaliação
                    </button>
                    <div className="text-center">
                       <button 
                        onClick={() => window.open('https://wa.me/554733001352?text=Quero%20uma%20avalia%C3%A7%C3%A3o%20r%C3%A1pida%20do%20meu%20carro.', '_blank')}
                        className="text-[10px] font-black text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors"
                      >
                        Ou prefiro enviar pelo WhatsApp &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {quiz.type === 'Venda' && quiz.step === 7 && (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center text-balance leading-none">Quando podemos olhar o seu carro?</h2>
                  <div className="grid gap-3">
                    {['Ainda hoje', 'Próximos dias', 'Quero agendar'].map(v => (
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
                  <h2 className="text-3xl font-black tracking-tighter italic uppercase text-center uppercase">Quando pretende fechar negócio?</h2>
                  <div className="grid gap-3">
                    {['O quanto antes', 'Sem pressa', 'Apenas avaliando'].map(v => (
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

              {/* Step 4 for Financiamento */}
              {(quiz.step === 4 && quiz.type === 'Financiamento') && (
                <div className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black tracking-tighter italic uppercase">
                      {quiz.data.has_car === 'Sim, do estoque' ? "Quanto você gostaria de dar de entrada?" : "Quanto você gostaria de pagar por mês?"}
                    </h2>
                  </div>
                  <div className="grid gap-4">
                    {quiz.data.has_car === 'Sim, do estoque' ? (
                       ['Vou tentar sem entrada', 'Até R$ 10 mil', 'Mais de R$ 20 mil'].map(v => <StepOption key={v} label={v} active={quiz.data.down_payment === v} onClick={() => { handleDataChange('down_payment', v); nextStep(); }} />)
                    ) : (
                       ['R$ 800 - R$ 1.200', 'R$ 1.200 - R$ 1.800', 'Acima de R$ 2.000'].map(v => <StepOption key={v} label={v} active={quiz.data.desired_payment === v} onClick={() => { handleDataChange('desired_payment', v); setQuiz(prev => ({ ...prev, step: 6 })); }} />)
                    )}
                  </div>
                </div>
              )}

              {/* Step 5 for Financiamento */}
              {(quiz.step === 5 && quiz.type === 'Financiamento' && quiz.data.has_car === 'Sim, do estoque') && (
                <div className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black tracking-tighter italic uppercase">
                      Quanto você gostaria de pagar por mês?
                    </h2>
                  </div>
                  <div className="grid gap-4">
                    {['R$ 800 - R$ 1.200', 'R$ 1.200 - R$ 1.800', 'Acima de R$ 2.000'].map(v => (
                       <StepOption key={v} label={v} active={quiz.data.desired_payment === v} onClick={() => { handleDataChange('desired_payment', v); nextStep(); }} />
                    ))}
                  </div>
                </div>
              )}

              {((quiz.step === 9 && quiz.type === 'Compra') || (quiz.step === 10 && quiz.type === 'Venda') || (quiz.step === 6 && quiz.type === 'Financiamento')) && (
                <div className="space-y-8 pb-12">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                       <Zap className="w-3 h-3 text-green-500 fill-current" />
                       <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Resposta em até 5 minutos</span>
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter italic uppercase leading-[0.8]">
                      Tudo pronto! <br />
                      <span className="text-manos-red">Receba sua oferta</span>
                    </h2>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Onde enviamos as informações?</p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">Como devemos te chamar?</label>
                      <input type="text" required autoComplete="name" className="w-full py-5 px-6" placeholder="Nome completo" value={quiz.data.name || ''} onChange={(e) => handleDataChange('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4">Seu WhatsApp de contato</label>
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
                    
                    <div className="px-2 space-y-4">
                      <div className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <Shield className="w-5 h-5 text-manos-red flex-shrink-0" />
                        <p className="text-[10px] text-white/40 leading-relaxed font-medium uppercase tracking-wide">
                          Ao clicar em finalizar, você concorda com nossa <span className="text-white/60">Política de Privacidade (LGPD)</span> e autoriza o contato de nossos especialistas.
                        </p>
                      </div>
                    </div>

                    {error && (
                      <div className="space-y-4">
                        <p className="text-manos-red font-black text-center text-xs uppercase tracking-widest">{error}</p>
                        {showPlanB && (
                          <button 
                            type="button"
                            onClick={() => handleWhatsAppClick(`Erro no formulário: ${quiz.data.name} - ${quiz.data.phone}`)}
                            className="w-full py-5 bg-green-500 text-white font-black text-lg uppercase rounded-2xl flex items-center justify-center gap-3 animate-bounce shadow-2xl shadow-green-500/20"
                          >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.626 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            Finalizar pelo WhatsApp
                          </button>
                        )}
                      </div>
                    )}
                    
                    <button 
                      type="submit"
                      disabled={isSubmitting || !isFormValid}
                      className="w-full py-6 bg-manos-red text-white font-black text-xl uppercase rounded-2xl shadow-[0_20px_50px_rgba(237,28,36,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                    >
                      {isSubmitting ? 'Gerando sua oferta...' : 'Receber Proposta Agora'}
                    </button>
                    
                    <p className="text-center text-[9px] text-white/20 uppercase tracking-[0.3em] font-black">
                      Seguro &bull; Rápido &bull; Confidencial
                    </p>
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
                  {isSubmitting ? 'Finalizando...' : 'Finalizar'}
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

