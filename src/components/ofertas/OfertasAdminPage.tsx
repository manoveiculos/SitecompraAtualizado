import React, { useState, useEffect } from 'react';
import {
  Lock,
  Plus,
  Edit,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Eye,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Star,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Settings,
  Car,
  Search,
  LogOut,
  MapPin,
  Sparkles,
  Link2,
  X,
  RefreshCw,
  Tag,
  Download,
  Database,
} from 'lucide-react';
import {
  autenticarAdminOfertas,
  getSavedAdminKey,
  clearAdminKey,
  fetchTodasOfertasAdmin,
  fetchEstoqueCrmAdmin,
  exportarVeiculoDoCrmAdmin,
  criarOfertaVeiculo,
  atualizarOfertaVeiculo,
  excluirOfertaVeiculo,
  uploadFotoOferta,
  fetchMetricasOfertasAdmin,
  fetchConfigOfertas,
  salvarConfigOfertasAdmin,
  gerarSlugOferta,
  formatarMoedaBRL,
  formatarQuilometragem,
  formatarAnoVeiculo,
  obterTituloVeiculo,
  gerarMensagemWhatsAppOferta,
  VENDEDOR_PADRAO_OFERTAS,
  type VeiculoOferta,
  type CrmVeiculoExportavel,
  type OfertaStatus,
  type OfertaMetrica,
  type OfertasTrackingConfig,
} from '../../services/ofertasService';
import OfertaLandingPage from './OfertaLandingPage';

const LOGO_MANOS = 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png';

interface FormState {
  marca: string;
  modelo: string;
  versao: string;
  ano_fabricacao: string;
  ano_modelo: string;
  titulo_personalizado: string;
  slug: string;
  slugEditadoManualmente: boolean;
  preco_venda: string;
  quilometragem: string;
  cambio: string;
  motorizacao: string;
  combustivel: string;
  cor: string;
  portas: string;
  observacoes_comerciais: string;
  diferenciaisTexto: string;
  foto_principal: string;
  fotos: string[];
  localizacao: string;
  vendedor_nome: string;
  vendedor_whatsapp: string;
  status: OfertaStatus;
}

const INITIAL_FORM: FormState = {
  marca: '',
  modelo: '',
  versao: '',
  ano_fabricacao: '2023',
  ano_modelo: '2023',
  titulo_personalizado: '',
  slug: '',
  slugEditadoManualmente: false,
  preco_venda: '',
  quilometragem: '',
  cambio: 'Automático',
  motorizacao: '',
  combustivel: 'Flex',
  cor: '',
  portas: '4',
  observacoes_comerciais: '',
  diferenciaisTexto: '',
  foto_principal: '',
  fotos: [],
  localizacao: VENDEDOR_PADRAO_OFERTAS.localizacao,
  vendedor_nome: VENDEDOR_PADRAO_OFERTAS.nome,
  vendedor_whatsapp: VENDEDOR_PADRAO_OFERTAS.whatsapp,
  status: 'publicado',
};

export default function OfertasAdminPage() {
  const [autenticado, setAutenticado] = useState<boolean>(() => Boolean(getSavedAdminKey()));
  const [senhaInput, setSenhaInput] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [autenticando, setAutenticando] = useState(false);

  // Navegação principal do Admin
  const [abaAtiva, setAbaAtiva] = useState<'anuncios' | 'crm' | 'metricas' | 'config'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('aba') === 'crm' || params.get('placa') || params.get('import_crm')) {
        return 'crm';
      }
    } catch {
      /* noop */
    }
    return 'anuncios';
  });

  // Lista de anúncios
  const [veiculos, setVeiculos] = useState<VeiculoOferta[]>([]);
  const [carregandoVeiculos, setCarregandoVeiculos] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | OfertaStatus>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estoque do CRM / Altimus para Exportação Direta
  const [crmVeiculos, setCrmVeiculos] = useState<CrmVeiculoExportavel[]>([]);
  const [carregandoCrm, setCarregandoCrm] = useState(false);
  const [buscaCrm, setBuscaCrm] = useState<string>(() => {
    try {
      return new URLSearchParams(window.location.search).get('placa') || '';
    } catch {
      return '';
    }
  });
  const [filtroCrm, setFiltroCrm] = useState<'todos' | 'nao_exportados' | 'exportados'>('todos');
  const [exportandoCrmId, setExportandoCrmId] = useState<string | null>(null);
  const [erroCrm, setErroCrm] = useState('');

  // Modal de Cadastro / Edição / Prévia
  const [modalAberto, setModalAberto] = useState(false);
  const [modoPreviaNoModal, setModoPreviaNoModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [novaFotoUrl, setNovaFotoUrl] = useState('');
  const [dragPhotoIndex, setDragPhotoIndex] = useState<number | null>(null);

  // Modal de Sucesso Pós-Publicação (com botão Copiar Link do Anúncio e gerador UTM)
  const [anuncioRecemPublicado, setAnuncioRecemPublicado] = useState<VeiculoOferta | null>(null);
  const [utmSourceGen, setUtmSourceGen] = useState('facebook');
  const [utmMediumGen, setUtmMediumGen] = useState('paid_social');
  const [utmCampaignGen, setUtmCampaignGen] = useState('');
  const [utmContentGen, setUtmContentGen] = useState('');

  // Métricas
  const [metricas, setMetricas] = useState<OfertaMetrica[]>([]);
  const [carregandoMetricas, setCarregandoMetricas] = useState(false);
  const [filtroVeiculoMetrica, setFiltroVeiculoMetrica] = useState<string>('todos');

  // Configurações de Pixel / GA4 / Vendedor
  const [config, setConfig] = useState<OfertasTrackingConfig>({
    meta_pixel_id: '',
    ga4_measurement_id: '',
    vendedor_padrao_nome: VENDEDOR_PADRAO_OFERTAS.nome,
    vendedor_padrao_whatsapp: VENDEDOR_PADRAO_OFERTAS.whatsapp,
    consentimento_lgpd_obrigatorio: false,
  });
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [msgConfig, setMsgConfig] = useState('');

  useEffect(() => {
    if (autenticado) {
      carregarTudo();
    }
  }, [autenticado]);

  const carregarTudo = async () => {
    setCarregandoVeiculos(true);
    const [lista, cfg, estoqueCrm] = await Promise.all([
      fetchTodasOfertasAdmin(),
      fetchConfigOfertas(),
      fetchEstoqueCrmAdmin(),
    ]);
    setVeiculos(lista);
    setConfig(cfg);
    setCrmVeiculos(estoqueCrm);
    setCarregandoVeiculos(false);
  };

  const carregarEstoqueCrm = async () => {
    setCarregandoCrm(true);
    setErroCrm('');
    const dados = await fetchEstoqueCrmAdmin();
    setCrmVeiculos(dados);
    setCarregandoCrm(false);
  };

  const carregarMetricas = async () => {
    setCarregandoMetricas(true);
    const dados = await fetchMetricasOfertasAdmin();
    setMetricas(dados);
    setCarregandoMetricas(false);
  };

  useEffect(() => {
    if (autenticado && abaAtiva === 'metricas') {
      carregarMetricas();
    }
    if (autenticado && abaAtiva === 'crm' && crmVeiculos.length === 0) {
      carregarEstoqueCrm();
    }
  }, [autenticado, abaAtiva]);

  // Exporta e publica em 1 clique direto do CRM para /ofertas/:slug
  const handleExportarDiretoDoCrm = async (item: CrmVeiculoExportavel) => {
    setExportandoCrmId(item.crm_id);
    setErroCrm('');
    const res = await exportarVeiculoDoCrmAdmin({
      crm_id: item.crm_id,
      placa: item.placa,
      status: 'publicado',
      dados: item,
    });
    setExportandoCrmId(null);

    if (!res.ok || !res.veiculo) {
      setErroCrm(res.error || 'Não foi possível exportar o veículo do CRM.');
      return;
    }

    await carregarTudo();
    setUtmCampaignGen(res.veiculo.slug.replace(/-/g, '_'));
    setUtmContentGen('criativo_01');
    setAnuncioRecemPublicado(res.veiculo);
  };

  // Abre o editor pré-preenchido com todos os dados e fotos do CRM para revisão antes de publicar
  const handlePersonalizarDoCrmAntesDePublicar = (item: CrmVeiculoExportavel) => {
    setEditandoId(item.oferta_existente_id ?? null);
    setErroForm('');
    setModoPreviaNoModal(false);
    setForm({
      marca: item.marca,
      modelo: item.modelo,
      versao: item.versao || '',
      ano_fabricacao: item.ano_fabricacao ? String(item.ano_fabricacao) : '',
      ano_modelo: item.ano_modelo ? String(item.ano_modelo) : '',
      titulo_personalizado: item.titulo_personalizado || '',
      slug: item.oferta_existente_slug || item.slug_sugerido,
      slugEditadoManualmente: false,
      preco_venda: item.preco_venda ? String(item.preco_venda) : '',
      quilometragem: item.quilometragem !== null ? String(item.quilometragem) : '',
      cambio: item.cambio || 'Automático',
      motorizacao: item.motorizacao || '',
      combustivel: item.combustivel || 'Flex',
      cor: item.cor || '',
      portas: item.portas !== null ? String(item.portas) : '4',
      observacoes_comerciais: item.observacoes_comerciais || '',
      diferenciaisTexto: Array.isArray(item.diferenciais) ? item.diferenciais.join('\n') : '',
      foto_principal: item.foto_principal || item.fotos[0] || '',
      fotos: Array.isArray(item.fotos) ? [...item.fotos] : [],
      localizacao: VENDEDOR_PADRAO_OFERTAS.localizacao,
      vendedor_nome: config.vendedor_padrao_nome || VENDEDOR_PADRAO_OFERTAS.nome,
      vendedor_whatsapp: config.vendedor_padrao_whatsapp || VENDEDOR_PADRAO_OFERTAS.whatsapp,
      status: 'publicado',
    });
    setModalAberto(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutenticando(true);
    setErroLogin('');
    const res = await autenticarAdminOfertas(senhaInput);
    setAutenticando(false);
    if (res.ok) {
      setAutenticado(true);
    } else {
      setErroLogin(res.error || 'Senha incorreta.');
    }
  };

  const handleLogout = () => {
    clearAdminKey();
    setAutenticado(false);
    setSenhaInput('');
  };

  // Atualiza automaticamente o slug e o título personalizado se ainda não foram editados à mão
  const atualizarCampoIdentificacao = (
    campo: 'marca' | 'modelo' | 'versao' | 'ano_fabricacao' | 'ano_modelo',
    valor: string,
  ) => {
    setForm((prev) => {
      const prox = { ...prev, [campo]: valor };
      if (!prev.slugEditadoManualmente) {
        const ano = prox.ano_modelo || prox.ano_fabricacao || '';
        prox.slug = gerarSlugOferta(`${prox.marca}-${prox.modelo}-${ano}`);
      }
      return prox;
    });
  };

  const abrirModalNovo = () => {
    setEditandoId(null);
    setErroForm('');
    setModoPreviaNoModal(false);
    setForm({
      ...INITIAL_FORM,
      vendedor_nome: config.vendedor_padrao_nome || VENDEDOR_PADRAO_OFERTAS.nome,
      vendedor_whatsapp: config.vendedor_padrao_whatsapp || VENDEDOR_PADRAO_OFERTAS.whatsapp,
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (v: VeiculoOferta) => {
    setEditandoId(v.id);
    setErroForm('');
    setModoPreviaNoModal(false);
    setForm({
      marca: v.marca,
      modelo: v.modelo,
      versao: v.versao || '',
      ano_fabricacao: v.ano_fabricacao ? String(v.ano_fabricacao) : '',
      ano_modelo: v.ano_modelo ? String(v.ano_modelo) : '',
      titulo_personalizado: v.titulo_personalizado || '',
      slug: v.slug,
      slugEditadoManualmente: true,
      preco_venda: v.preco_venda ? String(v.preco_venda) : '',
      quilometragem: v.quilometragem !== null ? String(v.quilometragem) : '',
      cambio: v.cambio || '',
      motorizacao: v.motorizacao || '',
      combustivel: v.combustivel || '',
      cor: v.cor || '',
      portas: v.portas !== null ? String(v.portas) : '',
      observacoes_comerciais: v.observacoes_comerciais || '',
      diferenciaisTexto: Array.isArray(v.diferenciais) ? v.diferenciais.join('\n') : '',
      foto_principal: v.foto_principal || v.fotos[0] || '',
      fotos: Array.isArray(v.fotos) ? [...v.fotos] : [],
      localizacao: v.localizacao || VENDEDOR_PADRAO_OFERTAS.localizacao,
      vendedor_nome: v.vendedor_nome || VENDEDOR_PADRAO_OFERTAS.nome,
      vendedor_whatsapp: v.vendedor_whatsapp || VENDEDOR_PADRAO_OFERTAS.whatsapp,
      status: v.status,
    });
    setModalAberto(true);
  };

  const construirObjetoVeiculoDoForm = (statusForcado?: OfertaStatus): Omit<VeiculoOferta, 'id' | 'created_at' | 'updated_at'> => {
    const anoFab = form.ano_fabricacao.trim() ? Number(form.ano_fabricacao) : null;
    const anoMod = form.ano_modelo.trim() ? Number(form.ano_modelo) : anoFab;
    const km = form.quilometragem.trim() !== '' ? Number(form.quilometragem) : null;
    const portas = form.portas.trim() !== '' ? Number(form.portas) : null;
    const preco = Number(String(form.preco_venda).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

    const diferenciais = form.diferenciaisTexto
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const fotosLimpa = form.fotos.filter(Boolean);
    const fotoCapa = form.foto_principal && fotosLimpa.includes(form.foto_principal)
      ? form.foto_principal
      : fotosLimpa[0] || '';

    const fotosOrdenadas = fotoCapa
      ? [fotoCapa, ...fotosLimpa.filter((f) => f !== fotoCapa)]
      : fotosLimpa;

    const slugCalculado = gerarSlugOferta(
      form.slug || `${form.marca}-${form.modelo}-${anoMod || anoFab || ''}`,
    );

    return {
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      versao: form.versao.trim(),
      ano_fabricacao: Number.isFinite(anoFab) ? anoFab : null,
      ano_modelo: Number.isFinite(anoMod) ? anoMod : null,
      titulo_personalizado: form.titulo_personalizado.trim(),
      slug: slugCalculado,
      preco_venda: preco,
      quilometragem: Number.isFinite(km) ? km : null,
      cambio: form.cambio.trim(),
      motorizacao: form.motorizacao.trim(),
      combustivel: form.combustivel.trim(),
      cor: form.cor.trim(),
      portas: Number.isFinite(portas) ? portas : null,
      observacoes_comerciais: form.observacoes_comerciais.trim(),
      diferenciais,
      foto_principal: fotoCapa,
      fotos: fotosOrdenadas,
      localizacao: form.localizacao.trim() || VENDEDOR_PADRAO_OFERTAS.localizacao,
      vendedor_nome: form.vendedor_nome.trim() || VENDEDOR_PADRAO_OFERTAS.nome,
      vendedor_whatsapp:
        form.vendedor_whatsapp.replace(/\D/g, '') || VENDEDOR_PADRAO_OFERTAS.whatsapp,
      status: statusForcado || form.status,
    };
  };

  const handleSalvarAnuncio = async (statusOverride?: OfertaStatus) => {
    setErroForm('');
    const dados = construirObjetoVeiculoDoForm(statusOverride);

    if (!dados.marca || !dados.modelo) {
      setErroForm('Preencha pelo menos a Marca e o Modelo do veículo.');
      return;
    }
    if (dados.preco_venda <= 0) {
      setErroForm('Informe um Preço de Venda válido maior que zero.');
      return;
    }
    if (dados.fotos.length === 0) {
      setErroForm('Envie ou adicione pelo menos 1 foto do veículo.');
      return;
    }

    setSalvando(true);
    let resultado: { ok: boolean; veiculo?: VeiculoOferta; error?: string };

    if (editandoId !== null) {
      resultado = await atualizarOfertaVeiculo(editandoId, dados);
    } else {
      resultado = await criarOfertaVeiculo(dados);
    }
    setSalvando(false);

    if (!resultado.ok || !resultado.veiculo) {
      setErroForm(resultado.error || 'Não foi possível salvar o anúncio.');
      return;
    }

    await carregarTudo();
    setModalAberto(false);

    // Se foi publicado, abre o modal com o link pronto para copiar e usar no Meta Ads
    if (resultado.veiculo.status === 'publicado') {
      setUtmCampaignGen(resultado.veiculo.slug.replace(/-/g, '_'));
      setUtmContentGen('criativo_01');
      setAnuncioRecemPublicado(resultado.veiculo);
    }
  };

  // Upload de múltiplas fotos com compressão WebP
  const handleUploadArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setEnviandoFotos(true);
    setErroForm('');
    const novasUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const res = await uploadFotoOferta(files[i]);
      if (res.ok && res.url) {
        novasUrls.push(res.url);
      } else if (res.error) {
        setErroForm(res.error);
      }
    }

    if (novasUrls.length > 0) {
      setForm((prev) => {
        const combinadas = [...prev.fotos, ...novasUrls];
        return {
          ...prev,
          fotos: combinadas,
          foto_principal: prev.foto_principal || combinadas[0] || '',
        };
      });
    }

    setEnviandoFotos(false);
    e.target.value = '';
  };

  const adicionarFotoPorUrl = () => {
    const url = novaFotoUrl.trim();
    if (!url) return;
    if (!/^https?:\/\/.+/i.test(url)) {
      setErroForm('Informe uma URL de imagem válida iniciando com http:// ou https://');
      return;
    }
    setForm((prev) => {
      const combinadas = [...prev.fotos, url];
      return {
        ...prev,
        fotos: combinadas,
        foto_principal: prev.foto_principal || combinadas[0],
      };
    });
    setNovaFotoUrl('');
  };

  const definirComoPrincipal = (url: string) => {
    setForm((prev) => {
      const restantes = prev.fotos.filter((f) => f !== url);
      return {
        ...prev,
        foto_principal: url,
        fotos: [url, ...restantes],
      };
    });
  };

  const moverFoto = (index: number, direcao: -1 | 1) => {
    setForm((prev) => {
      const nova = [...prev.fotos];
      const destino = index + direcao;
      if (destino < 0 || destino >= nova.length) return prev;
      const temp = nova[index];
      nova[index] = nova[destino];
      nova[destino] = temp;
      return {
        ...prev,
        fotos: nova,
        foto_principal: nova[0] || '',
      };
    });
  };

  const removerFoto = (url: string) => {
    setForm((prev) => {
      const filtradas = prev.fotos.filter((f) => f !== url);
      return {
        ...prev,
        fotos: filtradas,
        foto_principal:
          prev.foto_principal === url ? filtradas[0] || '' : prev.foto_principal,
      };
    });
  };

  const handleDropFoto = (targetIdx: number) => {
    if (dragPhotoIndex === null || dragPhotoIndex === targetIdx) return;
    setForm((prev) => {
      const lista = [...prev.fotos];
      const [movida] = lista.splice(dragPhotoIndex, 1);
      lista.splice(targetIdx, 0, movida);
      return {
        ...prev,
        fotos: lista,
        foto_principal: lista[0] || '',
      };
    });
    setDragPhotoIndex(null);
  };

  // Ações rápidas nos cards
  const copiarLinkAnuncio = async (slug: string, id: string = slug) => {
    const url = `${window.location.origin}/ofertas/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      /* noop */
    }
  };

  const handleAlterarStatusRapido = async (v: VeiculoOferta, novoStatus: OfertaStatus) => {
    const res = await atualizarOfertaVeiculo(v.id, { status: novoStatus });
    if (res.ok) {
      await carregarTudo();
    }
  };

  const handleDuplicarAnuncio = async (v: VeiculoOferta) => {
    const baseSlug = `${v.slug}-copia`;
    const res = await criarOfertaVeiculo({
      marca: v.marca,
      modelo: v.modelo,
      versao: v.versao,
      ano_fabricacao: v.ano_fabricacao,
      ano_modelo: v.ano_modelo,
      titulo_personalizado: v.titulo_personalizado ? `${v.titulo_personalizado} (Cópia)` : '',
      slug: baseSlug,
      preco_venda: v.preco_venda,
      quilometragem: v.quilometragem,
      cambio: v.cambio,
      motorizacao: v.motorizacao,
      combustivel: v.combustivel,
      cor: v.cor,
      portas: v.portas,
      observacoes_comerciais: v.observacoes_comerciais,
      diferenciais: [...(v.diferenciais || [])],
      foto_principal: v.foto_principal,
      fotos: [...(v.fotos || [])],
      localizacao: v.localizacao,
      vendedor_nome: v.vendedor_nome,
      vendedor_whatsapp: v.vendedor_whatsapp,
      status: 'rascunho',
    });
    if (res.ok) {
      await carregarTudo();
    }
  };

  const handleExcluirAnuncio = async (v: VeiculoOferta) => {
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o anúncio "${obterTituloVeiculo(v)}"? O histórico de métricas será preservado.`,
    );
    if (!confirmar) return;
    const res = await excluirOfertaVeiculo(v.id);
    if (res.ok) {
      await carregarTudo();
    }
  };

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoConfig(true);
    setMsgConfig('');
    const res = await salvarConfigOfertasAdmin(config);
    setSalvandoConfig(false);
    if (res.ok) {
      setMsgConfig('Configurações salvas com sucesso!');
      setTimeout(() => setMsgConfig(''), 3000);
    } else {
      setMsgConfig(res.error || 'Erro ao salvar configurações.');
    }
  };

  // Tela de Login Administrativo
  if (!autenticado) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-[#121216] border border-white/10 p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <img src={LOGO_MANOS} alt="Manos Veículos" className="h-10 w-auto mx-auto object-contain" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] text-xs font-extrabold uppercase tracking-widest">
              <Lock className="w-3.5 h-3.5" />
              <span>Painel Administrativo • Ofertas</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Gestão de Landing Pages
            </h1>
            <p className="text-xs text-zinc-400">
              Acesso exclusivo para cadastro e gestão de ofertas individuais da Manos Veículos (Itapema/SC).
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Senha do Administrador
              </label>
              <input
                type="password"
                required
                autoFocus
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                placeholder="Digite a senha de acesso..."
                className="w-full px-4 py-3.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-white text-sm focus:outline-none focus:border-[#E50914]"
              />
            </div>

            {erroLogin && (
              <div className="p-3 rounded-xl bg-[#E50914]/15 border border-[#E50914]/30 text-xs font-bold text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#E50914] flex-shrink-0" />
                <span>{erroLogin}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={autenticando}
              className="w-full py-4 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-black text-sm uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
            >
              {autenticando ? 'Verificando...' : 'Acessar Painel de Ofertas'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtros da listagem
  const veiculosFiltrados = veiculos.filter((v) => {
    const termo = busca.trim().toLowerCase();
    const bateBusca =
      !termo ||
      v.marca.toLowerCase().includes(termo) ||
      v.modelo.toLowerCase().includes(termo) ||
      v.versao.toLowerCase().includes(termo) ||
      v.slug.toLowerCase().includes(termo);
    const bateStatus = filtroStatus === 'todos' || v.status === filtroStatus;
    return bateBusca && bateStatus;
  });

  // Cálculos de métricas
  const metricasFiltradas = metricas.filter(
    (m) => filtroVeiculoMetrica === 'todos' || m.veiculo_slug === filtroVeiculoMetrica,
  );
  const totalViews = metricasFiltradas.filter((m) => m.evento === 'ViewContent' || m.evento === 'PageView').length;
  const totalViewContent = metricasFiltradas.filter((m) => m.evento === 'ViewContent').length;
  const totalWhatsAppClicks = metricasFiltradas.filter((m) => m.evento === 'WhatsAppClick').length;
  const taxaConversao =
    totalViewContent > 0 ? ((totalWhatsAppClicks / totalViewContent) * 100).toFixed(1) : '0.0';

  const statusBadge = (status: OfertaStatus) => {
    switch (status) {
      case 'publicado':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider">
            Publicado
          </span>
        );
      case 'rascunho':
        return (
          <span className="px-2.5 py-1 rounded-full bg-zinc-500/15 border border-zinc-500/30 text-zinc-300 text-[11px] font-extrabold uppercase tracking-wider">
            Rascunho
          </span>
        );
      case 'pausado':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-extrabold uppercase tracking-wider">
            Pausado
          </span>
        );
      case 'vendido':
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#E50914]/20 border border-[#E50914]/40 text-red-400 text-[11px] font-extrabold uppercase tracking-wider">
            Vendido
          </span>
        );
    }
  };

  const previewVeiculoObj: VeiculoOferta = {
    ...construirObjetoVeiculoDoForm(),
    id: editandoId ?? 'preview',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans">
      {/* Top Bar Administrativa */}
      <header className="sticky top-0 z-30 bg-[#0A0A0B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={LOGO_MANOS} alt="Manos Veículos" className="h-9 w-auto object-contain" />
            <div className="hidden sm:block h-6 w-px bg-white/10" />
            <div className="hidden sm:block">
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#E50914] block">
                Módulo Independente
              </span>
              <span className="text-sm font-bold text-white">
                Gerenciador de Landing Pages (/ofertas)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/ofertas"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#E50914]" />
              <span className="hidden sm:inline">Ver Vitrine /ofertas</span>
            </a>

            <button
              type="button"
              onClick={() => setAbaAtiva('crm')}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>EXPORTAR DO CRM</span>
            </button>

            <button
              type="button"
              onClick={abrirModalNovo}
              className="px-4 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-lg shadow-[#E50914]/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>NOVO ANÚNCIO</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-navegação de Abas */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 border-t border-white/5 pt-2 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setAbaAtiva('anuncios')}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer ${
              abaAtiva === 'anuncios'
                ? 'bg-[#E50914] text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Anúncios ({veiculos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('crm')}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer ${
              abaAtiva === 'crm'
                ? 'bg-[#E50914] text-white'
                : 'text-emerald-400 hover:text-white hover:bg-white/5 border border-emerald-500/20'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Exportar Direto do CRM ({crmVeiculos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('metricas')}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer ${
              abaAtiva === 'metricas'
                ? 'bg-[#E50914] text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Métricas & Campanhas UTM</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('config')}
            className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer ${
              abaAtiva === 'config'
                ? 'bg-[#E50914] text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Pixel, Analytics & Vendedor</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ===================================================================
            ABA 1: GESTÃO DE ANÚNCIOS INDIVIDUAIS
           =================================================================== */}
        {abaAtiva === 'anuncios' && (
          <div className="space-y-6">
            {/* Resumo Rápido */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[#121216] border border-white/10 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Publicados (Ativos)
                </span>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {veiculos.filter((v) => v.status === 'publicado').length}
                </p>
              </div>
              <div className="rounded-2xl bg-[#121216] border border-white/10 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Rascunhos / Pausados
                </span>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {veiculos.filter((v) => v.status === 'rascunho' || v.status === 'pausado').length}
                </p>
              </div>
              <div className="rounded-2xl bg-[#121216] border border-white/10 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Marcados como Vendidos
                </span>
                <p className="text-2xl font-black text-[#E50914] mt-1">
                  {veiculos.filter((v) => v.status === 'vendido').length}
                </p>
              </div>
              <div className="rounded-2xl bg-[#121216] border border-white/10 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Vendedor Padrão
                </span>
                <p className="text-sm font-extrabold text-white mt-1.5 truncate">
                  {config.vendedor_padrao_nome} ({config.vendedor_padrao_whatsapp})
                </p>
              </div>
            </div>

            {/* Busca e Filtros de Status */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar por marca, modelo ou URL (/ofertas/slug)..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#121216] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto">
                {(['todos', 'publicado', 'rascunho', 'pausado', 'vendido'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFiltroStatus(st)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border transition-colors cursor-pointer ${
                      filtroStatus === st
                        ? 'bg-[#E50914] border-[#E50914] text-white'
                        : 'bg-[#121216] border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {st === 'todos' ? 'Todos' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Cards Administrativos */}
            {carregandoVeiculos ? (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 text-[#E50914] animate-spin mx-auto" />
              </div>
            ) : veiculosFiltrados.length === 0 ? (
              <div className="rounded-3xl bg-[#121216] border border-white/10 p-12 text-center space-y-4">
                <Car className="w-12 h-12 text-zinc-600 mx-auto" />
                <h3 className="text-lg font-extrabold text-white">Nenhum anúncio encontrado</h3>
                <p className="text-xs text-zinc-400">
                  Clique em NOVO ANÚNCIO para cadastrar manualmente um veículo para suas campanhas de Meta Ads.
                </p>
                <button
                  type="button"
                  onClick={abrirModalNovo}
                  className="px-6 py-3 rounded-xl bg-[#E50914] text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                >
                  + NOVO ANÚNCIO
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {veiculosFiltrados.map((v) => {
                  const foto = v.foto_principal || v.fotos[0] || '';
                  const anoFmt = formatarAnoVeiculo(v.ano_fabricacao, v.ano_modelo);
                  const kmFmt = formatarQuilometragem(v.quilometragem);
                  const urlCompleta = `${window.location.origin}/ofertas/${v.slug}`;
                  const foiCopiado = copiedId === String(v.id);

                  return (
                    <div
                      key={v.id}
                      className="rounded-2xl bg-[#121216] border border-white/10 p-4 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 hover:border-white/20 transition-all"
                    >
                      {/* Foto + Dados Principais */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0 flex-1 w-full">
                        <div className="w-full sm:w-40 aspect-16/10 rounded-xl overflow-hidden bg-[#18181D] border border-white/10 flex-shrink-0">
                          {foto ? (
                            <img src={foto} alt={obterTituloVeiculo(v)} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">
                              Sem foto
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {statusBadge(v.status)}
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400">
                              <MapPin className="w-3.5 h-3.5 text-[#E50914]" />
                              {v.localizacao}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              Atualizado em {new Date(v.updated_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <h3 className="text-lg font-extrabold text-white truncate">
                            {obterTituloVeiculo(v)}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                            <strong className="text-base font-black text-white">
                              {formatarMoedaBRL(v.preco_venda)}
                            </strong>
                            {anoFmt && <span>• Ano {anoFmt}</span>}
                            {kmFmt && <span>• {kmFmt}</span>}
                            {v.cambio && <span>• {v.cambio}</span>}
                            <span>• {v.fotos.length} foto(s)</span>
                          </div>

                          {/* URL individual amigável */}
                          <div className="flex items-center gap-2 pt-1">
                            <code className="px-2.5 py-1 rounded-lg bg-[#0A0A0B] border border-white/10 text-xs text-zinc-300 truncate max-w-md">
                              /ofertas/{v.slug}
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* Ações Administrativas */}
                      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 border-white/10 pt-3 lg:pt-0">
                        {/* Botão Obrigatório: COPIAR LINK DO ANÚNCIO */}
                        <button
                          type="button"
                          onClick={() => copiarLinkAnuncio(v.slug, String(v.id))}
                          className={`px-3.5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                            foiCopiado
                              ? 'bg-emerald-500 text-[#0A0A0B]'
                              : 'bg-[#E50914] hover:bg-[#c40710] text-white'
                          }`}
                        >
                          {foiCopiado ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span>LINK COPIADO!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>COPIAR LINK DO ANÚNCIO</span>
                            </>
                          )}
                        </button>

                        {/* Visualizar Página Publicada */}
                        <a
                          href={`/ofertas/${v.slug}${v.status !== 'publicado' ? '?preview=1' : ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
                          title="Abrir página do veículo"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Ver Página</span>
                        </a>

                        {/* Editar */}
                        <button
                          type="button"
                          onClick={() => abrirModalEditar(v)}
                          className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Editar</span>
                        </button>

                        {/* Duplicar */}
                        <button
                          type="button"
                          onClick={() => handleDuplicarAnuncio(v)}
                          className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Duplicar anúncio"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Duplicar</span>
                        </button>

                        {/* Pausar / Publicar */}
                        {v.status === 'publicado' ? (
                          <button
                            type="button"
                            onClick={() => handleAlterarStatusRapido(v, 'pausado')}
                            className="px-3 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold text-amber-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <PauseCircle className="w-4 h-4" />
                            <span>Pausar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAlterarStatusRapido(v, 'publicado')}
                            className="px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <PlayCircle className="w-4 h-4" />
                            <span>Publicar</span>
                          </button>
                        )}

                        {/* Marcar como Vendido */}
                        {v.status !== 'vendido' && (
                          <button
                            type="button"
                            onClick={() => handleAlterarStatusRapido(v, 'vendido')}
                            className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-[#E50914]/20 border border-white/10 hover:border-[#E50914]/40 text-xs font-bold text-zinc-300 hover:text-red-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Tag className="w-4 h-4" />
                            <span>Marcar Vendido</span>
                          </button>
                        )}

                        {/* Excluir */}
                        <button
                          type="button"
                          onClick={() => handleExcluirAnuncio(v)}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Excluir anúncio"
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

        {/* ===================================================================
            ABA CRM: EXPORTAR ANÚNCIO DIRETO DO ESTOQUE DO CRM / ALTIMUS (1 CLIQUE)
           =================================================================== */}
        {abaAtiva === 'crm' && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-gradient-to-r from-[#121216] via-[#15151b] to-[#121216] border border-white/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider">
                  <Database className="w-3.5 h-3.5" />
                  <span>Sincronizado com o CRM & Estoque Manos Veículos</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Exportar Anúncio Direto do CRM para Landing Page (/ofertas)
                </h2>
                <p className="text-xs text-zinc-400 max-w-2xl">
                  Selecione qualquer veículo do estoque do CRM abaixo. Com <strong>1 clique</strong>, o sistema puxa todas as fotos em alta qualidade, preço, KM, ano, opcionais e gera a Landing Page individual pronta para o Facebook Ads / Instagram Ads com o WhatsApp do <strong>Alexandre</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={carregarEstoqueCrm}
                disabled={carregandoCrm}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-extrabold uppercase tracking-wider text-white inline-flex items-center gap-2 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${carregandoCrm ? 'animate-spin text-[#E50914]' : ''}`} />
                <span>Atualizar Estoque CRM</span>
              </button>
            </div>

            {erroCrm && (
              <div className="p-4 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 text-xs font-bold text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#E50914] shrink-0" />
                <span>{erroCrm}</span>
              </div>
            )}

            {/* Barra de Busca e Filtro do Estoque CRM */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121216] border border-white/10 rounded-2xl p-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaCrm}
                  onChange={(e) => setBuscaCrm(e.target.value)}
                  placeholder="Buscar no CRM por modelo, marca, versão ou placa (ex: Polo, Onix, Creta, RXL...)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#E50914]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(
                  [
                    { id: 'todos', label: `Todos no CRM (${crmVeiculos.length})` },
                    {
                      id: 'nao_exportados',
                      label: `Disponíveis p/ Exportar (${crmVeiculos.filter((c) => !c.ja_exportado).length})`,
                    },
                    {
                      id: 'exportados',
                      label: `Já em /ofertas (${crmVeiculos.filter((c) => c.ja_exportado).length})`,
                    },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setFiltroCrm(st.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      filtroCrm === st.id
                        ? 'bg-[#E50914] text-white'
                        : 'bg-[#0A0A0B] text-zinc-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Veículos do CRM */}
            {carregandoCrm ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#E50914] animate-spin mx-auto" />
                <p className="text-sm text-zinc-400">Buscando estoque atualizado no CRM...</p>
              </div>
            ) : (
              (() => {
                const termo = buscaCrm.trim().toLowerCase();
                const filtradosCrm = crmVeiculos.filter((c) => {
                  if (filtroCrm === 'nao_exportados' && c.ja_exportado) return false;
                  if (filtroCrm === 'exportados' && !c.ja_exportado) return false;
                  if (!termo) return true;
                  return (
                    c.titulo_personalizado.toLowerCase().includes(termo) ||
                    c.marca.toLowerCase().includes(termo) ||
                    c.modelo.toLowerCase().includes(termo) ||
                    c.versao.toLowerCase().includes(termo) ||
                    (c.placa && c.placa.toLowerCase().includes(termo)) ||
                    String(c.ano_modelo || '').includes(termo)
                  );
                });

                if (filtradosCrm.length === 0) {
                  return (
                    <div className="rounded-3xl bg-[#121216] border border-white/10 p-12 text-center space-y-3">
                      <Car className="w-10 h-10 text-zinc-600 mx-auto" />
                      <h3 className="text-lg font-extrabold text-white">
                        Nenhum veículo encontrado no filtro atual
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Limpe a busca ou clique em "Atualizar Estoque CRM".
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtradosCrm.map((item) => {
                      const estaExportando = exportandoCrmId === item.crm_id;
                      const slugLink = item.oferta_existente_slug || item.slug_sugerido;
                      return (
                        <div
                          key={item.crm_id}
                          className="rounded-2xl bg-[#121216] border border-white/10 hover:border-white/20 p-4 flex flex-col justify-between gap-4 transition-all"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-32 h-24 rounded-xl bg-black overflow-hidden border border-white/10 shrink-0 relative">
                              {item.foto_principal ? (
                                <img
                                  src={item.foto_principal}
                                  alt={item.titulo_personalizado}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                  <Car className="w-6 h-6" />
                                </div>
                              )}
                              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-zinc-200">
                                {item.fotos.length} foto{item.fotos.length === 1 ? '' : 's'}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.ja_exportado ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                                    ✓ Já em /ofertas
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
                                    Estoque CRM
                                  </span>
                                )}
                                {item.placa && (
                                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-300">
                                    Placa: {item.placa}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-black text-white leading-snug line-clamp-2">
                                {item.titulo_personalizado}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                                <span className="font-black text-[#E50914] text-sm">
                                  {formatarMoedaBRL(item.preco_venda)}
                                </span>
                                {item.ano_modelo && <span>• Ano {item.ano_modelo}</span>}
                                {item.quilometragem !== null && (
                                  <span>• {formatarQuilometragem(item.quilometragem)}</span>
                                )}
                                {item.cambio && <span>• {item.cambio}</span>}
                              </div>

                              <p className="text-[11px] text-zinc-500 font-mono truncate">
                                URL destino: /ofertas/{slugLink}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
                            {/* Botão Principal: Exportar e Publicar em 1 Clique */}
                            <button
                              type="button"
                              disabled={estaExportando}
                              onClick={() => handleExportarDiretoDoCrm(item)}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 shadow-lg shadow-[#E50914]/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {estaExportando ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Exportando...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>
                                    {item.ja_exportado
                                      ? 'Sincronizar & Gerar Link'
                                      : 'Exportar & Publicar (1 Clique)'}
                                  </span>
                                </>
                              )}
                            </button>

                            {/* Botão Secundário: Personalizar no Editor antes de Publicar */}
                            <button
                              type="button"
                              onClick={() => handlePersonalizarDoCrmAntesDePublicar(item)}
                              className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Revisar e editar informações antes de publicar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Revisar / Editar</span>
                            </button>

                            {/* Se já exportado, botão rápido de Copiar Link */}
                            {item.ja_exportado && item.oferta_existente_slug && (
                              <button
                                type="button"
                                onClick={() =>
                                  copiarLinkAnuncio(
                                    item.oferta_existente_slug!,
                                    `crm_${item.crm_id}`,
                                  )
                                }
                                className="py-2.5 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                {copiedId === `crm_${item.crm_id}` ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copiar Link</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ===================================================================
            ABA 2: MÉTRICAS E ORIGEM DOS ANÚNCIOS (UTM / CAMPANHAS)
           =================================================================== */}
        {abaAtiva === 'metricas' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">
                  Relatório de Performance & Origem dos Anúncios (UTM)
                </h2>
                <p className="text-xs text-zinc-400">
                  Acompanhe visualizações (ViewContent), cliques para o WhatsApp (WhatsAppClick) e campanhas do Meta Ads.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={filtroVeiculoMetrica}
                  onChange={(e) => setFiltroVeiculoMetrica(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#121216] border border-white/15 text-xs font-bold text-white"
                >
                  <option value="todos">Todos os veículos</option>
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.slug}>
                      {obterTituloVeiculo(v)} (/ofertas/{v.slug})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={carregarMetricas}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 cursor-pointer"
                  title="Atualizar métricas"
                >
                  <RefreshCw className={`w-4 h-4 ${carregandoMetricas ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Cards de Resumo de Conversão */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[#121216] border border-white/10 p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Visualizações Totais
                </span>
                <p className="text-3xl font-black text-white mt-1">{totalViews}</p>
              </div>
              <div className="rounded-2xl bg-[#121216] border border-white/10 p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  ViewContent (Veículos)
                </span>
                <p className="text-3xl font-black text-sky-400 mt-1">{totalViewContent}</p>
              </div>
              <div className="rounded-2xl bg-[#121216] border border-white/10 p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Cliques no WhatsApp
                </span>
                <p className="text-3xl font-black text-[#25D366] mt-1">{totalWhatsAppClicks}</p>
              </div>
              <div className="rounded-2xl bg-[#121216] border border-white/10 p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Taxa de Conversão
                </span>
                <p className="text-3xl font-black text-[#E50914] mt-1">{taxaConversao}%</p>
              </div>
            </div>

            {/* Tabela de Eventos Recentes com UTMs */}
            <div className="rounded-2xl bg-[#121216] border border-white/10 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                  Histórico de Eventos e Parâmetros UTM ({metricasFiltradas.length})
                </h3>
              </div>

              {metricasFiltradas.length === 0 ? (
                <div className="p-10 text-center text-xs text-zinc-500">
                  Nenhum evento registrado ainda para este filtro.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-400 uppercase tracking-wider bg-white/[0.02]">
                        <th className="py-3 px-4">Data / Hora</th>
                        <th className="py-3 px-4">Evento</th>
                        <th className="py-3 px-4">Veículo</th>
                        <th className="py-3 px-4">Origem (utm_source)</th>
                        <th className="py-3 px-4">Campanha (utm_campaign)</th>
                        <th className="py-3 px-4">Criativo (utm_content)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {metricasFiltradas.slice(0, 100).map((m) => (
                        <tr key={m.event_id + m.created_at} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                m.evento === 'WhatsAppClick' || m.evento === 'Contact'
                                  ? 'bg-[#25D366]/20 text-[#25D366]'
                                  : 'bg-white/10 text-zinc-200'
                              }`}
                            >
                              {m.evento}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {m.veiculo_nome || m.veiculo_slug || 'Vitrine /ofertas'}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {m.utm_source || m.canal || 'direto'}
                            {m.utm_medium ? ` (${m.utm_medium})` : ''}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">{m.utm_campaign || '—'}</td>
                          <td className="py-3 px-4 text-zinc-300">{m.utm_content || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            ABA 3: CONFIGURAÇÕES DE RASTREAMENTO (PIXEL / GA4) E VENDEDOR PADRÃO
           =================================================================== */}
        {abaAtiva === 'config' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-xl font-black text-white">
                Configurações de Rastreamento & Atendimento
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Configure os identificadores reais de Meta Pixel e Google Analytics 4 quando desejar, além do vendedor responsável padrão.
              </p>
            </div>

            <form
              onSubmit={handleSalvarConfig}
              className="rounded-3xl bg-[#121216] border border-white/10 p-6 sm:p-8 space-y-6"
            >
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#E50914]">
                  1. Vendedor Padrão (WhatsApp)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Nome do Vendedor Responsável
                    </label>
                    <input
                      type="text"
                      value={config.vendedor_padrao_nome}
                      onChange={(e) =>
                        setConfig({ ...config, vendedor_padrao_nome: e.target.value })
                      }
                      placeholder="Alexandre"
                      className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      WhatsApp Oficial (com DDI 55 + DDD)
                    </label>
                    <input
                      type="text"
                      value={config.vendedor_padrao_whatsapp}
                      onChange={(e) =>
                        setConfig({ ...config, vendedor_padrao_whatsapp: e.target.value })
                      }
                      placeholder="5547988467855"
                      className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#E50914]">
                  2. Identificadores de Marketing Digital (Opcional)
                </h3>
                <p className="text-xs text-zinc-400">
                  O módulo já respeita o Pixel e o GTM globais do site quando presentes. Caso queira adicionar um ID específico para este módulo, preencha abaixo (deixe em branco se não quiser sobrescrever).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Meta Pixel ID (Facebook / Instagram Ads)
                    </label>
                    <input
                      type="text"
                      value={config.meta_pixel_id}
                      onChange={(e) => setConfig({ ...config, meta_pixel_id: e.target.value })}
                      placeholder="Ex: 123456789012345"
                      className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      Google Analytics 4 (Measurement ID)
                    </label>
                    <input
                      type="text"
                      value={config.ga4_measurement_id}
                      onChange={(e) =>
                        setConfig({ ...config, ga4_measurement_id: e.target.value })
                      }
                      placeholder="Ex: G-XXXXXXXXXX"
                      className="w-full px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              {msgConfig && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300">
                  {msgConfig}
                </div>
              )}

              <button
                type="submit"
                disabled={salvandoConfig}
                className="px-6 py-3.5 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer"
              >
                {salvandoConfig ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* =====================================================================
          MODAL DE CADASTRO / EDIÇÃO COM PRÉVIA INTEGRADA DA PÁGINA
         ===================================================================== */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto">
          <div className="min-h-screen px-2 sm:px-6 py-4 sm:py-8 flex flex-col">
            {/* Cabeçalho do Modal */}
            <div className="max-w-6xl w-full mx-auto rounded-t-3xl bg-[#16161C] border border-white/15 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40">
              <div className="flex items-center gap-3">
                <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                  {editandoId !== null ? 'Editar Anúncio' : 'Novo Anúncio Individual'}
                </h2>
                <span className="hidden sm:inline-block text-xs text-zinc-400">
                  • /ofertas/{form.slug || 'novo-veiculo'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Alternar entre Formulário e Prévia da Landing Page */}
                <button
                  type="button"
                  onClick={() => setModoPreviaNoModal((p) => !p)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                    modoPreviaNoModal
                      ? 'bg-white text-[#0A0A0B] border-white'
                      : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>{modoPreviaNoModal ? 'Voltar para Edição' : 'Visualizar Prévia'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSalvarAnuncio('rascunho')}
                  disabled={salvando}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-zinc-200 cursor-pointer"
                >
                  Salvar Rascunho
                </button>

                <button
                  type="button"
                  onClick={() => handleSalvarAnuncio('publicado')}
                  disabled={salvando}
                  className="px-5 py-2 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-[#E50914]/30 cursor-pointer"
                >
                  {salvando ? 'Publicando...' : 'PUBLICAR'}
                </button>

                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo: Prévia em tempo real OU Formulário de Cadastro */}
            <div className="max-w-6xl w-full mx-auto rounded-b-3xl bg-[#121216] border-x border-b border-white/15 overflow-hidden">
              {modoPreviaNoModal ? (
                <div className="border-t border-white/10">
                  <OfertaLandingPage
                    slug={previewVeiculoObj.slug || 'previa'}
                    previewData={previewVeiculoObj}
                  />
                </div>
              ) : (
                <div className="p-5 sm:p-8 space-y-8">
                  {erroForm && (
                    <div className="p-4 rounded-xl bg-[#E50914]/15 border border-[#E50914]/40 text-sm font-bold text-red-200 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-[#E50914] flex-shrink-0" />
                      <span>{erroForm}</span>
                    </div>
                  )}

                  {/* BARRA RÁPIDA: PUXAR VEÍCULO DIRETO DO CRM */}
                  {crmVeiculos.length > 0 && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5" />
                          <span>Preencher Automaticamente do CRM ({crmVeiculos.length} veículos em estoque)</span>
                        </span>
                        <p className="text-[11px] text-zinc-300">
                          Selecione um veículo do CRM para puxar todas as fotos, preço, KM, opcionais e ficha técnica automaticamente:
                        </p>
                      </div>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const selecionado = crmVeiculos.find((c) => c.crm_id === e.target.value);
                          if (selecionado) {
                            handlePersonalizarDoCrmAntesDePublicar(selecionado);
                          }
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-emerald-500/40 text-xs font-bold text-white max-w-full sm:max-w-xs cursor-pointer"
                      >
                        <option value="" disabled>
                          Selecionar veículo do CRM...
                        </option>
                        {crmVeiculos.map((c) => (
                          <option key={c.crm_id} value={c.crm_id}>
                            {c.titulo_personalizado} — {formatarMoedaBRL(c.preco_venda)}
                            {c.placa ? ` (${c.placa})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* SEÇÃO 1: IDENTIFICAÇÃO */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#E50914] flex items-center gap-2">
                      <span>1. Identificação do Veículo</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Marca *
                        </label>
                        <input
                          type="text"
                          required
                          value={form.marca}
                          onChange={(e) => atualizarCampoIdentificacao('marca', e.target.value)}
                          placeholder="Ex: Volkswagen"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Modelo *
                        </label>
                        <input
                          type="text"
                          required
                          value={form.modelo}
                          onChange={(e) => atualizarCampoIdentificacao('modelo', e.target.value)}
                          placeholder="Ex: Polo"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Versão
                        </label>
                        <input
                          type="text"
                          value={form.versao}
                          onChange={(e) => atualizarCampoIdentificacao('versao', e.target.value)}
                          placeholder="Ex: 1.0 200 TSI Comfortline Automático"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Ano Fabricação
                        </label>
                        <input
                          type="number"
                          value={form.ano_fabricacao}
                          onChange={(e) =>
                            atualizarCampoIdentificacao('ano_fabricacao', e.target.value)
                          }
                          placeholder="2022"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Ano Modelo
                        </label>
                        <input
                          type="number"
                          value={form.ano_modelo}
                          onChange={(e) =>
                            atualizarCampoIdentificacao('ano_modelo', e.target.value)
                          }
                          placeholder="2022"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Título Personalizado (Opcional)
                        </label>
                        <input
                          type="text"
                          value={form.titulo_personalizado}
                          onChange={(e) =>
                            setForm({ ...form, titulo_personalizado: e.target.value })
                          }
                          placeholder="Ex: Volkswagen Polo Comfortline 200 TSI 2022"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1">
                        Slug da Página (URL Amigável) *
                      </label>
                      <div className="flex items-center rounded-xl bg-[#0A0A0B] border border-white/15 overflow-hidden">
                        <span className="px-3.5 py-2.5 bg-white/5 text-zinc-400 text-xs font-mono border-r border-white/10">
                          /ofertas/
                        </span>
                        <input
                          type="text"
                          value={form.slug}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              slug: gerarSlugOferta(e.target.value),
                              slugEditadoManualmente: true,
                            })
                          }
                          placeholder="volkswagen-polo-2022"
                          className="flex-1 px-3.5 py-2.5 bg-transparent text-sm text-white font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 2: INFORMAÇÕES COMERCIAIS */}
                  <div className="space-y-4 pt-6 border-t border-white/10">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#E50914]">
                      2. Informações Comerciais & Ficha Técnica
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Preço de Venda (R$) *
                        </label>
                        <input
                          type="number"
                          required
                          value={form.preco_venda}
                          onChange={(e) => setForm({ ...form, preco_venda: e.target.value })}
                          placeholder="89900"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Quilometragem (km)
                        </label>
                        <input
                          type="number"
                          value={form.quilometragem}
                          onChange={(e) => setForm({ ...form, quilometragem: e.target.value })}
                          placeholder="42000"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Tipo de Câmbio
                        </label>
                        <input
                          type="text"
                          value={form.cambio}
                          onChange={(e) => setForm({ ...form, cambio: e.target.value })}
                          placeholder="Automático / Manual"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Motorização
                        </label>
                        <input
                          type="text"
                          value={form.motorizacao}
                          onChange={(e) => setForm({ ...form, motorizacao: e.target.value })}
                          placeholder="Ex: 1.0 200 TSI Turbo"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Combustível
                        </label>
                        <input
                          type="text"
                          value={form.combustivel}
                          onChange={(e) => setForm({ ...form, combustivel: e.target.value })}
                          placeholder="Flex / Gasolina / Diesel / Híbrido"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Cor
                        </label>
                        <input
                          type="text"
                          value={form.cor}
                          onChange={(e) => setForm({ ...form, cor: e.target.value })}
                          placeholder="Ex: Branca"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Quantidade de Portas
                        </label>
                        <input
                          type="number"
                          value={form.portas}
                          onChange={(e) => setForm({ ...form, portas: e.target.value })}
                          placeholder="4"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Status de Publicação
                        </label>
                        <select
                          value={form.status}
                          onChange={(e) =>
                            setForm({ ...form, status: e.target.value as OfertaStatus })
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white font-bold"
                        >
                          <option value="publicado">Publicado</option>
                          <option value="rascunho">Rascunho</option>
                          <option value="pausado">Pausado</option>
                          <option value="vendido">Vendido</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Observações Comerciais (Bloco 4)
                        </label>
                        <textarea
                          rows={4}
                          value={form.observacoes_comerciais}
                          onChange={(e) =>
                            setForm({ ...form, observacoes_comerciais: e.target.value })
                          }
                          placeholder="Descreva o estado real do veículo e observações importantes..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Diferenciais Cadastrados (1 por linha)
                        </label>
                        <textarea
                          rows={4}
                          value={form.diferenciaisTexto}
                          onChange={(e) =>
                            setForm({ ...form, diferenciaisTexto: e.target.value })
                          }
                          placeholder={
                            'Chave presencial com partida por botão\nCentral multimídia com Apple CarPlay\nCâmera de ré e sensor de estacionamento'
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 3: FOTOS (UPLOAD, FOTO PRINCIPAL E ORDENAÇÃO MANUAL) */}
                  <div className="space-y-4 pt-6 border-t border-white/10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#E50914]">
                          3. Galeria de Fotos ({form.fotos.length})
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Compressão e conversão automática para WebP. Arraste ou use as setas para ordenar. A primeira foto é a Capa Principal.
                        </p>
                      </div>

                      <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer self-start">
                        {enviandoFotos ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Otimizando fotos...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Enviar Fotos do Computador/Celular</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          multiple
                          onChange={handleUploadArquivos}
                          disabled={enviandoFotos}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Adicionar por URL externa opcional */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={novaFotoUrl}
                        onChange={(e) => setNovaFotoUrl(e.target.value)}
                        placeholder="Ou cole a URL de uma imagem (https://...)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={adicionarFotoPorUrl}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
                      >
                        Adicionar URL
                      </button>
                    </div>

                    {/* Grade de Fotos Ordenável */}
                    {form.fotos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5">
                        {form.fotos.map((url, idx) => {
                          const ehPrincipal = idx === 0 || form.foto_principal === url;
                          return (
                            <div
                              key={`${url}-${idx}`}
                              draggable
                              onDragStart={() => setDragPhotoIndex(idx)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDropFoto(idx)}
                              className={`relative rounded-xl overflow-hidden bg-[#0A0A0B] border-2 transition-all group ${
                                idx === 0 ? 'border-[#E50914]' : 'border-white/10'
                              }`}
                            >
                              <div className="aspect-16/10 w-full">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </div>

                              {idx === 0 && (
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#E50914] text-white text-[10px] font-extrabold uppercase">
                                  Foto Principal
                                </span>
                              )}

                              <div className="p-2 bg-[#121216] flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moverFoto(idx, -1)}
                                    disabled={idx === 0}
                                    className="p-1 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 text-zinc-300 cursor-pointer"
                                    title="Mover para esquerda"
                                  >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moverFoto(idx, 1)}
                                    disabled={idx === form.fotos.length - 1}
                                    className="p-1 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 text-zinc-300 cursor-pointer"
                                    title="Mover para direita"
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {idx !== 0 && (
                                  <button
                                    type="button"
                                    onClick={() => definirComoPrincipal(url)}
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-[#E50914] text-[10px] font-bold text-zinc-200 hover:text-white cursor-pointer"
                                    title="Definir como Foto Principal"
                                  >
                                    Capa
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => removerFoto(url)}
                                  className="p-1 rounded bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 cursor-pointer"
                                  title="Remover foto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SEÇÃO 4: LOCALIZAÇÃO E VENDEDOR RESPONSÁVEL */}
                  <div className="space-y-4 pt-6 border-t border-white/10">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#E50914]">
                      4. Localização & Integração com WhatsApp
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Localização do Veículo
                        </label>
                        <input
                          type="text"
                          value={form.localizacao}
                          onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
                          placeholder="Itapema/SC"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Vendedor Responsável
                        </label>
                        <input
                          type="text"
                          value={form.vendedor_nome}
                          onChange={(e) => setForm({ ...form, vendedor_nome: e.target.value })}
                          placeholder="Alexandre"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          WhatsApp do Vendedor
                        </label>
                        <input
                          type="text"
                          value={form.vendedor_whatsapp}
                          onChange={(e) => setForm({ ...form, vendedor_whatsapp: e.target.value })}
                          placeholder="5547988467855"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0B] border border-white/15 text-sm text-white"
                        />
                      </div>
                    </div>

                    {/* Prévia da mensagem automática de WhatsApp */}
                    <div className="p-4 rounded-xl bg-[#0A0A0B] border border-white/10 space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#25D366]">
                        Prévia da Mensagem Automática do WhatsApp:
                      </span>
                      <p className="text-xs text-zinc-300 italic">
                        "{gerarMensagemWhatsAppOferta(previewVeiculoObj)}"
                      </p>
                    </div>
                  </div>

                  {/* Botões Finais do Modal */}
                  <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setModoPreviaNoModal(true)}
                      className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Visualizar Prévia da Página</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSalvarAnuncio('rascunho')}
                      disabled={salvando}
                      className="px-5 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Salvar como Rascunho
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSalvarAnuncio('publicado')}
                      disabled={salvando}
                      className="px-8 py-3.5 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-[#E50914]/30 cursor-pointer"
                    >
                      {salvando ? 'Publicando...' : 'PUBLICAR ANÚNCIO AGORA'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL PÓS-PUBLICAÇÃO: LINK GERADO + CONSTRUTOR UTM PARA META ADS
         ===================================================================== */}
      {anuncioRecemPublicado && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-[#121216] border border-white/15 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">
                    Anúncio Publicado com Sucesso!
                  </span>
                  <h3 className="text-xl font-black text-white">
                    {obterTituloVeiculo(anuncioRecemPublicado)}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnuncioRecemPublicado(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Link Individual Direto */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-zinc-300">
                Link Individual da Landing Page:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/ofertas/${anuncioRecemPublicado.slug}`}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#0A0A0B] border border-white/15 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    copiarLinkAnuncio(anuncioRecemPublicado.slug, 'modal_direct')
                  }
                  className="px-5 py-3 rounded-xl bg-[#E50914] hover:bg-[#c40710] text-white font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedId === 'modal_direct' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>COPIADO!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>COPIAR LINK DO ANÚNCIO</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Gerador de Link com UTM pronto para Facebook / Instagram Ads */}
            <div className="p-4 rounded-2xl bg-[#0A0A0B] border border-white/10 space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#E50914] block">
                Link com Parâmetros UTM para Facebook / Instagram Ads:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={utmSourceGen}
                  onChange={(e) => setUtmSourceGen(e.target.value)}
                  placeholder="utm_source (facebook)"
                  className="px-3 py-2 rounded-lg bg-[#121216] border border-white/10 text-xs text-white"
                />
                <input
                  type="text"
                  value={utmMediumGen}
                  onChange={(e) => setUtmMediumGen(e.target.value)}
                  placeholder="utm_medium (paid_social)"
                  className="px-3 py-2 rounded-lg bg-[#121216] border border-white/10 text-xs text-white"
                />
                <input
                  type="text"
                  value={utmCampaignGen}
                  onChange={(e) => setUtmCampaignGen(e.target.value)}
                  placeholder="utm_campaign"
                  className="px-3 py-2 rounded-lg bg-[#121216] border border-white/10 text-xs text-white"
                />
                <input
                  type="text"
                  value={utmContentGen}
                  onChange={(e) => setUtmContentGen(e.target.value)}
                  placeholder="utm_content (criativo_01)"
                  className="px-3 py-2 rounded-lg bg-[#121216] border border-white/10 text-xs text-white"
                />
              </div>

              {(() => {
                const params = new URLSearchParams();
                if (utmSourceGen) params.set('utm_source', utmSourceGen);
                if (utmMediumGen) params.set('utm_medium', utmMediumGen);
                if (utmCampaignGen) params.set('utm_campaign', utmCampaignGen);
                if (utmContentGen) params.set('utm_content', utmContentGen);
                const urlComUtm = `${window.location.origin}/ofertas/${anuncioRecemPublicado.slug}?${params.toString()}`;

                return (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={urlComUtm}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-[#121216] border border-white/10 text-[11px] font-mono text-zinc-300"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(urlComUtm);
                        setCopiedId('modal_utm');
                        setTimeout(() => setCopiedId(null), 2500);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === 'modal_utm' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>UTM Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar com UTM</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={`/ofertas/${anuncioRecemPublicado.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-extrabold uppercase tracking-wider text-zinc-300 hover:text-white inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4 text-[#E50914]" />
                <span>Abrir Página Publicada</span>
              </a>

              <button
                type="button"
                onClick={() => setAnuncioRecemPublicado(null)}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-extrabold uppercase tracking-wider text-white cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
