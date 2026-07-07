import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2, ArrowRight, CheckCircle2, AlertCircle, Car, Search,
  ShieldCheck, Banknote, Home, Clock, Lock, Gauge, Palette, Tag, Star,
} from 'lucide-react';
import { registrarLeadVenda, consultarPlaca, enviarVenda, type VeiculoPlaca } from '../../services/vendasService';

const LOGO = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';

// ---- formatters -----------------------------------------------------------
function formatPhone(val: string): string {
  let r = val.replace(/\D/g, '');
  if (r.length > 11) r = r.substring(0, 11);
  if (r.length > 10) return r.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
  if (r.length > 6) return r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
  if (r.length > 2) return r.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
  if (r.length > 0) return '(' + r;
  return r;
}
function formatPlaca(val: string): string {
  return val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}
function formatThousands(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 7);
  return d ? parseInt(d, 10).toLocaleString('pt-BR') : '';
}
function formatBRL(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  return (parseInt(d, 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function onlyNumber(masked: string): number {
  const d = masked.replace(/\D/g, '');
  return d ? parseInt(d, 10) : 0;
}

export default function VendasRapidasPage() {
  const [step, setStep] = useState(1);

  // step 1
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);

  // step 2
  const [placa, setPlaca] = useState('');
  const [placaLoading, setPlacaLoading] = useState(false);
  const [placaError, setPlacaError] = useState('');

  // step 3
  const [veiculo, setVeiculo] = useState<VeiculoPlaca | null>(null);
  const [marcaManual, setMarcaManual] = useState('');
  const [modeloManual, setModeloManual] = useState('');
  const [km, setKm] = useState('');
  const [cor, setCor] = useState('');
  const [valor, setValor] = useState('');
  const [sending, setSending] = useState(false);

  const rawPhone = telefone.replace(/\D/g, '');
  const contatoValido = nome.trim().length >= 3 && rawPhone.length >= 10 && cidade.trim().length >= 2;
  // Sem placa (ou placa sem retorno): pedimos marca e modelo manualmente.
  const precisaMarcaModelo = !veiculo || (!veiculo.marca && !veiculo.modelo);
  const veiculoValido =
    km.trim() !== '' && cor.trim() !== '' && valor.trim() !== '' &&
    (!precisaMarcaModelo || (marcaManual.trim() !== '' && modeloManual.trim() !== ''));

  // ---- handlers -----------------------------------------------------------
  const handleContato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contatoValido || leadLoading) return;
    setLeadLoading(true);
    await registrarLeadVenda({ nome: nome.trim(), telefone: rawPhone, cidade: cidade.trim() });
    setLeadLoading(false);
    setStep(2);
  };

  const handleBuscarPlaca = async () => {
    if (placa.length < 7 || placaLoading) return;
    setPlacaLoading(true);
    setPlacaError('');
    const res = await consultarPlaca(placa);
    setPlacaLoading(false);
    if (res.ok && res.veiculo) {
      setVeiculo(res.veiculo);
      if (res.veiculo.cor) setCor(res.veiculo.cor);
      setStep(3);
    } else {
      setPlacaError(res.error || 'Não encontramos os dados. Você pode seguir sem a placa.');
    }
  };

  const handleSemPlaca = () => {
    setVeiculo(null);
    setStep(3);
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!veiculoValido || sending) return;
    setSending(true);
    await enviarVenda({
      nome: nome.trim(),
      telefone: rawPhone,
      cidade: cidade.trim(),
      placa: placa || null,
      marca: veiculo?.marca || marcaManual.trim() || null,
      modelo: veiculo?.modelo || modeloManual.trim() || null,
      versao: veiculo?.versao || null,
      ano: veiculo?.ano || null,
      combustivel: veiculo?.combustivel || null,
      fipe: veiculo?.fipeValor || null,
      km: onlyNumber(km),
      cor: cor.trim(),
      valor_desejado: onlyNumber(valor) / 100,
      valor_desejado_formatado: valor,
    });
    setSending(false);
    setStep(4);
  };

  return (
    <div className="bolao-viewport">
      <div className="bolao-glow" />

      {/* Header */}
      <header className="p-4 flex items-center justify-center z-20 backdrop-blur-md bg-manos-dark/50 lg:rounded-t-[32px]">
        <img src={LOGO} alt="Manos Veículos" className="h-9 w-auto object-contain" />
      </header>

      <main className="scroll-container custom-scrollbar">
        <AnimatePresence mode="wait">
          {/* ---------------- STEP 1 — CONTATO ---------------- */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
              className="space-y-7"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-500/10 border border-green-500/40 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                  <Banknote className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">
                    Pagamento à vista no PIX • Avaliação no seu local
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter leading-[0.95] italic uppercase">
                  Venda seu carro rápido
                  <br />
                  <span className="text-manos-red">e receba à vista no PIX</span>
                </h1>

                <p className="text-sm text-white/60 leading-relaxed max-w-sm mx-auto">
                  <span className="text-white font-bold">Avaliação gratuita em 1 minuto.</span> Preencha abaixo e
                  receba nossa proposta direto no seu telefone. Sem anúncio, sem estranho vendo seu carro
                  e sem burocracia. A Manos cuida de tudo.
                </p>

                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-[11px] font-bold text-white/50">
                    <span className="text-white">4,7</span> no Google • 119 avaliações de quem já vendeu
                  </span>
                </div>
              </div>

              {/* value props */}
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                {[
                  { icon: <ShieldCheck className="w-4 h-4 text-green-400" />, t: 'Avaliação gratuita' },
                  { icon: <Home className="w-4 h-4 text-green-400" />, t: 'Venda sem sair de casa' },
                  { icon: <Clock className="w-4 h-4 text-green-400" />, t: 'Retorno em minutos' },
                  { icon: <Lock className="w-4 h-4 text-green-400" />, t: 'Processo 100% seguro' },
                ].map((v) => (
                  <div key={v.t} className="card-glass p-3 flex items-center gap-2">
                    {v.icon}
                    <span className="text-xs font-bold text-white/70">{v.t}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleContato} className="space-y-4 max-w-sm mx-auto">
                <Field label="Nome completo">
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    className="input-manos"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </Field>
                <Field label="Telefone (com DDD)">
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    autoComplete="tel"
                    className="input-manos"
                    placeholder="(47) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  />
                </Field>
                <Field label="Cidade">
                  <input
                    type="text"
                    required
                    autoComplete="address-level2"
                    className="input-manos"
                    placeholder="Sua cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={!contatoValido || leadLoading}
                  className="btn-manos"
                >
                  {leadLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                  ) : (
                    <>Quero minha avaliação grátis <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
                <p className="text-center text-[9px] text-white/20 uppercase tracking-[0.3em] font-black">
                  Dados protegidos • Sem spam • LGPD
                </p>
              </form>
            </motion.div>
          )}

          {/* ---------------- STEP 2 — PLACA ---------------- */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
              className="space-y-7"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-manos-red/10 border border-manos-red/20 rounded-2xl flex items-center justify-center mx-auto">
                  <Car className="w-8 h-8 text-manos-red" />
                </div>
                <h2 className="text-2xl font-black tracking-tighter italic uppercase">
                  Qual a <span className="text-manos-red">placa</span> do carro?
                </h2>
                <p className="text-sm text-white/50 leading-relaxed max-w-xs mx-auto">
                  Com a placa a gente já traz <span className="text-white/80 font-bold">marca, modelo, ano e a tabela FIPE</span> do seu carro. Sua avaliação sai mais rápida e mais justa.
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-4">
                {/* placa "plate" input */}
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    inputMode="text"
                    autoCapitalize="characters"
                    className="w-full py-5 px-6 bg-white text-slate-900 text-center text-2xl font-black tracking-[0.3em] rounded-2xl outline-none border-4 border-slate-800 uppercase placeholder:text-slate-300 placeholder:tracking-widest"
                    placeholder="ABC1D23"
                    value={placa}
                    onChange={(e) => { setPlaca(formatPlaca(e.target.value)); setPlacaError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarPlaca(); }}
                  />
                </div>

                {/* Reforço de segurança — muitos travam aqui com medo de golpe */}
                <div className="flex items-start gap-2 text-left bg-green-500/5 border border-green-500/20 rounded-xl px-3 py-2.5">
                  <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-snug text-white/60">
                    <span className="text-white/90 font-bold">Loja física em Rio do Sul/SC.</span> Usamos a placa só para identificar o modelo e a FIPE do seu carro. Seus dados ficam protegidos (LGPD).
                  </p>
                </div>

                {placaError && (
                  <div className="flex items-start gap-2 text-manos-red text-xs font-bold px-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{placaError}</span>
                  </div>
                )}

                <button onClick={handleBuscarPlaca} disabled={placa.length < 7 || placaLoading} className="btn-manos">
                  {placaLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Buscando dados...</>
                  ) : (
                    <><Search className="w-5 h-5" /> Buscar dados da placa</>
                  )}
                </button>

                {/* Opção sem placa — clara para leigos e para quem tem receio */}
                <div className="pt-1 text-center space-y-2">
                  <p className="text-xs text-white/50">
                    Não tem a placa em mãos ou prefere não informar?
                  </p>
                  <button
                    onClick={handleSemPlaca}
                    className="w-full py-4 bg-white/10 border border-white/20 text-white font-bold text-sm uppercase rounded-2xl hover:bg-white/15 active:scale-[0.98] transition-all"
                  >
                    Continuar sem a placa
                  </button>
                  <p className="text-[10px] text-white/30 leading-snug">
                    Sem problema: você digita a marca e o modelo na próxima tela. Leva menos de 1 minuto.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ---------------- STEP 3 — VEÍCULO ---------------- */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black tracking-tighter italic uppercase">
                  Últimos <span className="text-manos-red">detalhes</span>
                </h2>
                <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
                  Falta pouco para sua avaliação
                </p>
              </div>

              {/* Vehicle recognized card */}
              {veiculo && (veiculo.marca || veiculo.modelo) && (
                <div className="card-glass p-4 max-w-sm mx-auto space-y-3 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-green-400">
                      Carro identificado
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {veiculo.logo ? (
                      <img src={veiculo.logo} alt={veiculo.marca} className="w-10 h-10 object-contain bg-white rounded-lg p-1" />
                    ) : (
                      <Car className="w-8 h-8 text-white/40" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">
                        {veiculo.marca} {veiculo.modelo}
                      </p>
                      <p className="text-[11px] text-white/50 truncate">
                        {[veiculo.versao, veiculo.ano].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  </div>
                  {veiculo.fipeValor && (
                    <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Referência FIPE</span>
                      <span className="text-sm font-black text-green-400">{veiculo.fipeValor}</span>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleEnviar} className="space-y-4 max-w-sm mx-auto">
                {precisaMarcaModelo && (
                  <>
                    <Field label="Marca" icon={<Car className="w-4 h-4 text-white/30" />}>
                      <input
                        type="text"
                        required
                        className="input-manos"
                        placeholder="Ex.: Volkswagen"
                        value={marcaManual}
                        onChange={(e) => setMarcaManual(e.target.value)}
                      />
                    </Field>
                    <Field label="Modelo" icon={<Car className="w-4 h-4 text-white/30" />}>
                      <input
                        type="text"
                        required
                        className="input-manos"
                        placeholder="Ex.: Gol 1.6 Highline"
                        value={modeloManual}
                        onChange={(e) => setModeloManual(e.target.value)}
                      />
                    </Field>
                  </>
                )}
                <Field label="Quilometragem (km)" icon={<Gauge className="w-4 h-4 text-white/30" />}>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    className="input-manos"
                    placeholder="Ex.: 85.000"
                    value={km}
                    onChange={(e) => setKm(formatThousands(e.target.value))}
                  />
                </Field>
                <Field label="Cor" icon={<Palette className="w-4 h-4 text-white/30" />}>
                  <input
                    type="text"
                    required
                    className="input-manos"
                    placeholder="Ex.: Prata"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                  />
                </Field>
                <Field label="Quanto você espera receber?" icon={<Tag className="w-4 h-4 text-white/30" />}>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    className="input-manos"
                    placeholder="R$ 0,00"
                    value={valor}
                    onChange={(e) => setValor(formatBRL(e.target.value))}
                  />
                </Field>

                <button type="submit" disabled={!veiculoValido || sending} className="btn-manos">
                  {sending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                  ) : (
                    <>Enviar para avaliação <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {/* ---------------- STEP 4 — SUCESSO ---------------- */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="text-center space-y-6 py-6"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.15, stiffness: 200, damping: 15 }}
                className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(34,197,94,0.35)]"
              >
                <CheckCircle2 className="w-12 h-12 text-white" />
              </motion.div>

              <div className="space-y-3">
                <h2 className="text-3xl font-black tracking-tighter leading-none italic uppercase">
                  Recebemos seu carro,
                  <br />
                  <span className="text-green-400">{nome.split(' ')[0] || 'tudo certo'}!</span>
                </h2>
                <p className="text-sm text-white/60 leading-relaxed max-w-xs mx-auto">
                  Nossa <span className="text-white font-bold">equipe de compras</span> já vai analisar os dados e
                  entra em contato pelo <span className="text-white font-bold">telefone</span> com a sua proposta.
                  Fique de olho! 🚗💨
                </p>
              </div>

              <div className="space-y-3 max-w-xs mx-auto pt-2">
                <a href="/estoque" className="btn-manos">
                  <Car className="w-5 h-5" /> Ver carros à venda
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <div className="sticky-footer">
        <div className="text-center py-2 space-y-1.5">
          <a
            href="/politica-de-privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-0 inline-block text-[10px] text-white/40 underline underline-offset-2 hover:text-white/70 transition-colors"
          >
            Política de Privacidade
          </a>
          <p className="text-[9px] text-white/10 uppercase tracking-[0.3em] font-black italic">
            Manos Veículos • Compra e Venda
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- small helpers --------------------------------------------------------
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-4 flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
