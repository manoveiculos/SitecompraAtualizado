import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock, Car, Plus, Edit, Trash2, CheckCircle2, AlertCircle, Loader2,
  Search, RefreshCw, MessageCircle, LogOut, ArrowLeft, Eye, ShieldCheck,
  Tag, Percent, ExternalLink, Filter, Check, X, Upload, Image as ImageIcon,
  Sparkles, ChevronLeft, ChevronRight, Star, Move
} from 'lucide-react';

import {
  fetchVeiculosRepasse,
  cadastrarVeiculoRepasse,
  atualizarVeiculoRepasse,
  atualizarStatusVeiculoRepasse,
  excluirVeiculoRepasse,
  fetchLeadsRepasse,
  excluirLeadRepasse,
  uploadFotoRepasse,
  type VeiculoRepasse,
  type LeadRepasseRecord
} from '../../services/repasseService';
import { gerarObservacoesIA, gerarDescricaoIA } from '../../services/aiService';

const ADMIN_PASSWORD = 'manos2026admin';
const LOGO = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';
const AUTH_KEY = 'manos_repasse_admin_auth_v1';

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RepasseAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(AUTH_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Main Admin Tabs
  const [activeTab, setActiveTab] = useState<'estoque' | 'leads'>('estoque');

  // Vehicles state
  const [veiculos, setVeiculos] = useState<VeiculoRepasse[]>([]);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Leads state
  const [leads, setLeads] = useState<LeadRepasseRecord[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Modal / Form state for Add/Edit Vehicle
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [draggedPhotoIdx, setDraggedPhotoIdx] = useState<number | null>(null);
  const [generatingObs, setGeneratingObs] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    titulo: '',
    marca: '',
    modelo: '',
    ano: '',
    km: 80000,
    cor: 'Branca',
    combustivel: 'Flex',
    cambio: 'Manual',
    placa_final: '',
    preco_fipe: 0,
    preco_repasse: 0,
    fotosList: [] as string[],
    descricao: '',
    observacoes_repasse: '',
    destaque: true,
    status: 'disponivel' as 'disponivel' | 'reservado' | 'vendido',
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
      try {
        sessionStorage.setItem(AUTH_KEY, 'true');
      } catch {
        /* noop */
      }
    } else {
      setPasswordError('Senha incorreta.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    loadVeiculos();
    loadLeads();
  };

  const loadVeiculos = async () => {
    setLoadingVeiculos(true);
    const data = await fetchVeiculosRepasse();
    setVeiculos(data);
    setLoadingVeiculos(false);
  };

  const loadLeads = async () => {
    setLoadingLeads(true);
    const data = await fetchLeadsRepasse();
    setLeads(data);
    setLoadingLeads(false);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormError('');
    setFormData({
      titulo: '',
      marca: '',
      modelo: '',
      ano: '',
      km: 80000,
      cor: 'Branca',
      combustivel: 'Flex',
      cambio: 'Manual',
      placa_final: '',
      preco_fipe: 0,
      preco_repasse: 0,
      fotosList: [],
      descricao: '',
      observacoes_repasse: '',
      destaque: true,
      status: 'disponivel',
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = (v: VeiculoRepasse) => {
    setEditingId(v.id);
    setFormError('');
    setFormData({
      titulo: v.titulo,
      marca: v.marca,
      modelo: v.modelo,
      ano: v.ano,
      km: v.km,
      cor: v.cor,
      combustivel: v.combustivel,
      cambio: v.cambio,
      placa_final: v.placa_final || '',
      preco_fipe: v.preco_fipe,
      preco_repasse: v.preco_repasse,
      fotosList: Array.isArray(v.fotos) ? [...v.fotos] : [],
      descricao: v.descricao,
      observacoes_repasse: v.observacoes_repasse,
      destaque: v.destaque ?? true,
      status: v.status,
    });
    setShowFormModal(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    setFormError('');

    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const res = await uploadFotoRepasse(file);
      if (res.ok && res.url) {
        newUrls.push(res.url);
      } else {
        setFormError(res.error || `Erro ao processar imagem ${file.name}`);
      }
    }

    setFormData(prev => ({
      ...prev,
      fotosList: [...prev.fotosList, ...newUrls]
    }));

    setUploadingPhotos(false);
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fotosList: prev.fotosList.filter((_, idx) => idx !== index)
    }));
  };

  const handleDragStart = (idx: number) => {
    setDraggedPhotoIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIdx: number) => {
    if (draggedPhotoIdx === null || draggedPhotoIdx === targetIdx) return;
    setFormData(prev => {
      const newList = [...prev.fotosList];
      const [moved] = newList.splice(draggedPhotoIdx, 1);
      newList.splice(targetIdx, 0, moved);
      return { ...prev, fotosList: newList };
    });
    setDraggedPhotoIdx(null);
  };

  const handleMoveLeft = (idx: number) => {
    if (idx <= 0) return;
    setFormData(prev => {
      const newList = [...prev.fotosList];
      const temp = newList[idx - 1];
      newList[idx - 1] = newList[idx];
      newList[idx] = temp;
      return { ...prev, fotosList: newList };
    });
  };

  const handleMoveRight = (idx: number) => {
    setFormData(prev => {
      if (idx >= prev.fotosList.length - 1) return prev;
      const newList = [...prev.fotosList];
      const temp = newList[idx + 1];
      newList[idx + 1] = newList[idx];
      newList[idx] = temp;
      return { ...prev, fotosList: newList };
    });
  };

  const handleMakeCover = (idx: number) => {
    if (idx === 0) return;
    setFormData(prev => {
      const newList = [...prev.fotosList];
      const [selected] = newList.splice(idx, 1);
      newList.unshift(selected);
      return { ...prev, fotosList: newList };
    });
  };

  const handleGenerateObsIA = async () => {
    if (!formData.titulo || !formData.preco_fipe || !formData.preco_repasse) {
      alert('Por favor, preencha o Título, Preço FIPE e Preço Repasse antes de gerar com IA.');
      return;
    }
    setGeneratingObs(true);
    const obsText = await gerarObservacoesIA({
      titulo: formData.titulo,
      marca: formData.marca || 'Veículo',
      modelo: formData.modelo || 'Repasse',
      ano: formData.ano || '2020',
      km: formData.km,
      cor: formData.cor,
      combustivel: formData.combustivel,
      cambio: formData.cambio,
      preco_fipe: formData.preco_fipe,
      preco_repasse: formData.preco_repasse,
    });
    setFormData(prev => ({ ...prev, observacoes_repasse: obsText }));
    setGeneratingObs(false);
  };

  const handleGenerateDescIA = async () => {
    if (!formData.titulo) {
      alert('Por favor, preencha o Título do Anúncio antes de gerar a descrição com IA.');
      return;
    }
    setGeneratingDesc(true);
    const descText = await gerarDescricaoIA({
      titulo: formData.titulo,
      marca: formData.marca || 'Veículo',
      modelo: formData.modelo || 'Repasse',
      ano: formData.ano || '2020',
      km: formData.km,
      cor: formData.cor,
      combustivel: formData.combustivel,
      cambio: formData.cambio,
      preco_fipe: formData.preco_fipe,
      preco_repasse: formData.preco_repasse,
    });
    setFormData(prev => ({ ...prev, descricao: descText }));
    setGeneratingDesc(false);
  };


  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploadingPhotos) return;
    setSaving(true);
    setFormError('');

    const fotosArr = [...formData.fotosList];

    if (fotosArr.length === 0) {
      fotosArr.push('https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80');
    }

    const payload = {
      titulo: formData.titulo.trim(),
      marca: formData.marca.trim(),
      modelo: formData.modelo.trim(),
      ano: formData.ano.trim(),
      km: Number(formData.km),
      cor: formData.cor.trim(),
      combustivel: formData.combustivel,
      cambio: formData.cambio,
      placa_final: formData.placa_final.trim(),
      preco_fipe: Number(formData.preco_fipe),
      preco_repasse: Number(formData.preco_repasse),
      fotos: fotosArr,
      descricao: formData.descricao.trim(),
      observacoes_repasse: formData.observacoes_repasse.trim(),
      destaque: formData.destaque,
      status: formData.status,
    };


    let res: { ok: boolean; error?: string };

    if (editingId) {
      res = await atualizarVeiculoRepasse(editingId, payload);
    } else {
      res = await cadastrarVeiculoRepasse(payload);
    }

    setSaving(false);

    if (res.ok) {
      setShowFormModal(false);
      loadVeiculos();
    } else {
      setFormError(res.error || 'Erro ao salvar veículo');
    }
  };

  const handleToggleStatus = async (v: VeiculoRepasse, newStatus: 'disponivel' | 'reservado' | 'vendido') => {
    const res = await atualizarStatusVeiculoRepasse(v.id, newStatus);
    if (res.ok) {
      loadVeiculos();
    } else {
      alert(`Erro ao alterar status: ${res.error}`);
    }
  };

  const handleDeleteVeiculo = async (v: VeiculoRepasse) => {
    if (!window.confirm(`Tem certeza que deseja excluir o veículo "${v.titulo}"?`)) return;

    const res = await excluirVeiculoRepasse(v.id);
    if (res.ok) {
      loadVeiculos();
    } else {
      alert(`Erro ao excluir veículo: ${res.error}`);
    }
  };

  const handleDeleteLead = async (leadId: number | string) => {
    if (!window.confirm('Tem certeza que deseja remover esta proposta?')) return;
    const res = await excluirLeadRepasse(leadId);
    if (res.ok) {
      loadLeads();
    } else {
      alert(`Erro ao excluir lead: ${res.error}`);
    }
  };

  const veiculosFiltrados = veiculos.filter(v =>
    v.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.modelo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // PASSWORD GATE
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-manos-red/15 rounded-full blur-[140px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#121216] border border-white/15 rounded-3xl p-8 space-y-6 shadow-2xl relative z-10 text-center"
        >
          <div className="space-y-3">
            <img src={LOGO} alt="Manos Veículos" className="h-10 w-auto mx-auto object-contain" />
            <div className="w-14 h-14 bg-manos-red/10 border border-manos-red/30 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-manos-red" />
            </div>
            <h1 className="text-2xl font-black uppercase italic tracking-tight">
              Área Admin <span className="text-manos-red">Repasses</span>
            </h1>
            <p className="text-xs text-white/50">
              Acesso exclusivo para administradores Manos Veículos
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-white/70">Senha de Acesso</label>
              <input
                type="password"
                autoFocus
                className="w-full py-4 px-5 bg-white/5 border border-white/15 rounded-xl text-white outline-none focus:border-manos-red text-center tracking-widest text-lg"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
              />
            </div>

            {passwordError && (
              <p className="text-xs text-red-400 font-bold text-center">{passwordError}</p>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-manos-red hover:bg-red-600 text-white font-black text-sm uppercase rounded-xl shadow-xl shadow-manos-red/30 active:scale-95 transition-all cursor-pointer"
            >
              Entrar no Painel Admin
            </button>

            <a
              href="/repasse"
              className="block text-center text-xs text-white/40 hover:text-white pt-2 transition-colors"
            >
              &larr; Voltar para a página pública de repasses
            </a>
          </form>
        </motion.div>
      </div>
    );
  }

  // MAIN ADMIN DASHBOARD
  return (
    <div className="min-h-screen bg-[#09090B] text-white font-sans selection:bg-manos-red selection:text-white">
      
      {/* HEADER ADMIN */}
      <header className="sticky top-0 z-40 bg-[#09090B]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/repasse" title="Ver site público">
              <img src={LOGO} alt="Manos Veículos" className="h-8 sm:h-10 w-auto object-contain" />
            </a>
            <div className="flex items-center gap-2 px-3 py-1 bg-manos-red/10 border border-manos-red/30 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-manos-red" />
              <span className="text-xs font-black text-manos-red uppercase tracking-wider">Painel Admin Repasse</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/repasse"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Ver Site Público</span>
            </a>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        
        {/* TAB CONTROLS & ADD BUTTON */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121216] border border-white/10 p-2 sm:p-3 rounded-2xl">
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('estoque')}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'estoque'
                  ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Car className="w-4 h-4" />
              Estoque de Repasse ({veiculos.length})
            </button>

            <button
              onClick={() => setActiveTab('leads')}
              className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-manos-red text-white shadow-lg shadow-manos-red/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              Propostas / Leads ({leads.length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={loadData}
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 hover:text-white transition-all cursor-pointer"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${(loadingVeiculos || loadingLeads) ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Novo Veículo
            </button>
          </div>

        </div>

        {/* TAB 1: ESTOQUE DE REPASSE */}
        {activeTab === 'estoque' && (
          <div className="space-y-4">
            
            {/* Search Filter */}
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Filtrar por nome, marca ou modelo..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-white/40 focus:border-manos-red outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {loadingVeiculos ? (
              <div className="text-center py-20 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-manos-red mx-auto" />
                <p className="text-xs text-white/50">Carregando estoque de repasse...</p>
              </div>
            ) : veiculosFiltrados.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Car className="w-10 h-10 text-white/20 mx-auto" />
                <p className="text-sm font-bold text-white/70">Nenhum veículo encontrado</p>
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl"
                >
                  Cadastrar Primeiro Veículo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {veiculosFiltrados.map(v => {
                  const economia = v.preco_fipe - v.preco_repasse;
                  const pctDesconto = Math.round((economia / v.preco_fipe) * 100);

                  return (
                    <div
                      key={v.id}
                      className="bg-[#121216] border border-white/10 rounded-3xl overflow-hidden flex flex-col justify-between"
                    >
                      {/* Image & Badges */}
                      <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden">
                        <img
                          src={v.fotos[0] || 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80'}
                          alt={v.titulo}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                        <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                          -{pctDesconto}% FIPE
                        </div>

                        {/* Status Badge */}
                        <div className="absolute top-3 right-3">
                          {v.status === 'disponivel' && (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md">
                              Disponível
                            </span>
                          )}
                          {v.status === 'reservado' && (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md">
                              Reservado
                            </span>
                          )}
                          {v.status === 'vendido' && (
                            <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md">
                              Vendido
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 space-y-4 flex-grow flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-white/50 uppercase">
                            {v.marca} • {v.ano} • {v.km.toLocaleString('pt-BR')} km
                          </p>
                          <h3 className="font-black uppercase italic text-base text-white line-clamp-2">
                            {v.titulo}
                          </h3>
                          <p className="text-xs text-white/60 line-clamp-2 italic border-l-2 border-amber-500/40 pl-2">
                            {v.observacoes_repasse}
                          </p>
                        </div>

                        {/* Prices & Actions */}
                        <div className="space-y-3 pt-2">
                          <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-white/40 block text-[10px] uppercase font-bold">FIPE: {formatBRL(v.preco_fipe)}</span>
                              <span className="text-lg font-black text-emerald-400 italic">{formatBRL(v.preco_repasse)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-white/40 block">Economia</span>
                              <span className="text-xs font-bold text-emerald-400">{formatBRL(economia)}</span>
                            </div>
                          </div>

                          {/* Quick Status Buttons */}
                          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl text-[10px] font-bold">
                            <span className="text-white/40 px-2 uppercase text-[9px]">Status:</span>
                            <button
                              onClick={() => handleToggleStatus(v, 'disponivel')}
                              className={`px-2 py-1 rounded-lg ${v.status === 'disponivel' ? 'bg-emerald-600 text-white' : 'text-white/50 hover:text-white'}`}
                            >
                              Disponível
                            </button>
                            <button
                              onClick={() => handleToggleStatus(v, 'reservado')}
                              className={`px-2 py-1 rounded-lg ${v.status === 'reservado' ? 'bg-amber-600 text-white' : 'text-white/50 hover:text-white'}`}
                            >
                              Reservado
                            </button>
                            <button
                              onClick={() => handleToggleStatus(v, 'vendido')}
                              className={`px-2 py-1 rounded-lg ${v.status === 'vendido' ? 'bg-red-600 text-white' : 'text-white/50 hover:text-white'}`}
                            >
                              Vendido
                            </button>
                          </div>

                          {/* Action Buttons: Edit / Delete */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleOpenEditModal(v)}
                              className="py-2.5 px-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5 text-amber-400" />
                              Editar
                            </button>

                            <button
                              onClick={() => handleDeleteVeiculo(v)}
                              className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* TAB 2: PROPOSTAS / LEADS */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            
            {loadingLeads ? (
              <div className="text-center py-20 bg-white/[0.02] border border-white/10 rounded-3xl space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                <p className="text-xs text-white/50">Carregando propostas de clientes...</p>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-3xl space-y-2">
                <MessageCircle className="w-10 h-10 text-white/20 mx-auto" />
                <p className="text-sm font-bold text-white/70">Nenhuma proposta registrada até o momento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map(lead => {
                  const phoneClean = lead.telefone.replace(/\D/g, '');
                  const waUrl = `https://wa.me/55${phoneClean}?text=${encodeURIComponent(`Olá ${lead.nome}! Vi sua proposta pelo veículo de repasse ${lead.veiculo_titulo || ''} no site da Manos Veículos.`)}`;

                  return (
                    <div
                      key={lead.id}
                      className="bg-[#121216] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-500/40 transition-all"
                    >
                      <div className="space-y-2 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-white">{lead.nome}</span>
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            {lead.cidade}
                          </span>
                          <span className="text-[10px] text-white/40">
                            {new Date(lead.created_at).toLocaleDateString('pt-BR')} às {new Date(lead.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {lead.veiculo_titulo && (
                          <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            Interesse em: {lead.veiculo_titulo} {lead.valor_repasse ? `(${formatBRL(lead.valor_repasse)})` : ''}
                          </p>
                        )}

                        {lead.proposta_mensagem && (
                          <p className="text-xs text-white/80 italic bg-white/5 p-3 rounded-xl border border-white/5">
                            "{lead.proposta_mensagem}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 md:pt-0">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                        >
                          <MessageCircle className="w-4 h-4 fill-current" />
                          Chamar no WhatsApp ({lead.telefone})
                        </a>

                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
                          title="Remover Proposta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </main>


      {/* MODAL FORMULÁRIO DE CADASTRAR / EDITAR VEÍCULO */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121216] border border-white/15 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button
                onClick={() => setShowFormModal(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white">
                  {editingId ? 'Editar Veículo de Repasse' : 'Cadastrar Novo Veículo de Repasse'}
                </h3>
                <p className="text-xs text-white/50">
                  {editingId ? 'Atualização direta no Supabase' : 'Inserção direta na tabela veiculos_repasse no Supabase'}
                </p>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-white/80 uppercase">Título do Anúncio *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex.: Volkswagen Gol 1.6 MSI TotalFlex 8V"
                    className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none focus:border-manos-red"
                    value={formData.titulo}
                    onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">Marca *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: Volkswagen"
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none text-sm sm:text-xs"
                      value={formData.marca}
                      onChange={e => setFormData({ ...formData, marca: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">Modelo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: Gol"
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none text-sm sm:text-xs"
                      value={formData.modelo}
                      onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">Ano *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: 2019/2020"
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none text-sm sm:text-xs"
                      value={formData.ano}
                      onChange={e => setFormData({ ...formData, ano: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">KM *</label>
                    <input
                      type="number"
                      required
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none text-sm sm:text-xs"
                      value={formData.km}
                      onChange={e => setFormData({ ...formData, km: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">Cor *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: Branca"
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none text-sm sm:text-xs"
                      value={formData.cor}
                      onChange={e => setFormData({ ...formData, cor: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">Combustível</label>
                    <select
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none cursor-pointer text-sm sm:text-xs"
                      value={formData.combustivel}
                      onChange={e => setFormData({ ...formData, combustivel: e.target.value })}
                    >
                      <option value="Flex" className="bg-zinc-900">Flex</option>
                      <option value="Gasolina" className="bg-zinc-900">Gasolina</option>
                      <option value="Diesel" className="bg-zinc-900">Diesel</option>
                      <option value="Híbrido" className="bg-zinc-900">Híbrido</option>
                      <option value="Elétrico" className="bg-zinc-900">Elétrico</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">Câmbio</label>
                    <select
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none cursor-pointer text-sm sm:text-xs"
                      value={formData.cambio}
                      onChange={e => setFormData({ ...formData, cambio: e.target.value })}
                    >
                      <option value="Manual" className="bg-zinc-900">Manual</option>
                      <option value="Automático" className="bg-zinc-900">Automático</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">Placa Final</label>
                    <input
                      type="text"
                      placeholder="Ex.: 7"
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none text-sm sm:text-xs"
                      value={formData.placa_final}
                      onChange={e => setFormData({ ...formData, placa_final: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-emerald-400 uppercase">Preço Tabela FIPE (R$) *</label>
                    <input
                      type="number"
                      required
                      placeholder="52400"
                      className="w-full p-3 bg-white/5 border border-emerald-500/30 rounded-xl text-white outline-none text-sm sm:text-xs"
                      value={formData.preco_fipe || ''}
                      onChange={e => setFormData({ ...formData, preco_fipe: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-manos-red uppercase">Preço Valor de Repasse (R$) *</label>
                    <input
                      type="number"
                      required
                      placeholder="39900"
                      className="w-full p-3 bg-white/5 border border-manos-red/40 rounded-xl text-white outline-none text-sm sm:text-xs"
                      value={formData.preco_repasse || ''}
                      onChange={e => setFormData({ ...formData, preco_repasse: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* UPLOAD DE FOTOS DO COMPUTADOR LOCAL E REORDENAÇÃO */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-white/80 uppercase block">Fotos do Veículo (Upload do Computador) *</label>
                    {formData.fotosList.length > 1 && (
                      <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                        <Move className="w-3 h-3" /> Arraste para reordenar a sequência
                      </span>
                    )}
                  </div>

                  <label className="border-2 border-dashed border-white/20 hover:border-emerald-500/50 bg-white/5 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-white/[0.07] group">
                    <Upload className="w-8 h-8 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-xs text-white">Clique para selecionar fotos do seu computador</span>
                    <span className="text-[10px] text-white/40 mt-1">Selecione uma ou várias imagens (.jpg, .jpeg, .png, .webp) — Upload automático</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>

                  {uploadingPhotos && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando foto(s) do computador para o banco de dados...
                    </div>
                  )}

                  {/* PREVIEW E REORDENAÇÃO ARRASTÁVEL DAS FOTOS */}
                  {formData.fotosList.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-white/40 uppercase">
                          {formData.fotosList.length} foto(s) • A 1ª foto será a CAPA PRINCIPAL do anúncio
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {formData.fotosList.map((fotoUrl, idx) => (
                          <div
                            key={idx}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(idx)}
                            className={`relative aspect-[16/10] bg-black rounded-xl overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing group ${
                              idx === 0 ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-white/10 hover:border-white/40'
                            }`}
                          >
                            <img src={fotoUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
                            
                            {/* Badge Capa */}
                            {idx === 0 ? (
                              <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-md z-10">
                                ★ FOTO CAPA
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMakeCover(idx)}
                                className="absolute top-2 left-2 bg-black/70 hover:bg-emerald-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-md backdrop-blur-md opacity-80 group-hover:opacity-100 transition-all z-10 cursor-pointer"
                                title="Definir como foto de capa"
                              >
                                Virar Capa
                              </button>
                            )}

                            {/* Botão Remover */}
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(idx)}
                              className="absolute top-2 right-2 w-7 h-7 bg-red-600/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 z-10 cursor-pointer"
                              title="Excluir foto"
                            >
                              <X className="w-4 h-4" />
                            </button>

                            {/* Botões de Mover para Esquerda / Direita */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity z-10">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveLeft(idx)}
                                className="p-1 bg-black/70 hover:bg-white/20 text-white rounded-lg disabled:opacity-20 cursor-pointer"
                                title="Mover para esquerda"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>

                              <span className="text-[9px] font-mono font-bold text-white/90 bg-black/60 px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </span>

                              <button
                                type="button"
                                disabled={idx === formData.fotosList.length - 1}
                                onClick={() => handleMoveRight(idx)}
                                className="p-1 bg-black/70 hover:bg-white/20 text-white rounded-lg disabled:opacity-20 cursor-pointer"
                                title="Mover para direita"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>


                {/* OBSERVAÇÕES DE REPASSE COM GERADOR DE IA */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-amber-400 uppercase">Observações do Repasse (Motivo do desconto / Detalhes) *</label>
                    <button
                      type="button"
                      onClick={handleGenerateObsIA}
                      disabled={generatingObs}
                      className="px-3 py-1 bg-gradient-to-r from-amber-500/20 to-manos-red/20 hover:from-amber-500/30 hover:to-manos-red/30 border border-amber-500/40 rounded-xl text-amber-400 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${generatingObs ? 'animate-spin' : 'animate-pulse'}`} />
                      {generatingObs ? 'Gerando com IA...' : 'Gerar Legenda com IA ✨'}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Ex.: Desconto de R$ 12.500 abaixo da FIPE. Pequenos riscos no para-choque. Vendido no estado."
                    className="w-full p-3 bg-white/5 border border-amber-500/30 rounded-xl text-white outline-none focus:border-amber-400"
                    value={formData.observacoes_repasse}
                    onChange={e => setFormData({ ...formData, observacoes_repasse: e.target.value })}
                  />
                </div>

                {/* DESCRIÇÃO COMPLETA COM GERADOR DE IA */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-white/80 uppercase">Descrição Completa do Anúncio</label>
                    <button
                      type="button"
                      onClick={handleGenerateDescIA}
                      disabled={generatingDesc}
                      className="px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-500/40 rounded-xl text-emerald-400 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${generatingDesc ? 'animate-spin' : 'animate-pulse'}`} />
                      {generatingDesc ? 'Gerando com IA...' : 'Gerar Descrição com IA ✨'}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Descrição geral dos opcionais e acessórios..."
                    className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none focus:border-emerald-400"
                    value={formData.descricao}
                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                  />
                </div>


                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-white/80 uppercase">Status no Estoque</label>
                    <select
                      className="w-full p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none cursor-pointer"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="disponivel" className="bg-zinc-900">Disponível</option>
                      <option value="reservado" className="bg-zinc-900">Reservado</option>
                      <option value="vendido" className="bg-zinc-900">Vendido</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="destaque-check"
                      checked={formData.destaque}
                      onChange={e => setFormData({ ...formData, destaque: e.target.checked })}
                      className="w-4 h-4 accent-manos-red cursor-pointer"
                    />
                    <label htmlFor="destaque-check" className="font-bold text-white/80 cursor-pointer">
                      Destacar no Topo
                    </label>
                  </div>
                </div>

                {formError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-bold text-xs">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingId ? 'Salvar Alterações do Veículo' : 'Cadastrar no Banco de Dados'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
