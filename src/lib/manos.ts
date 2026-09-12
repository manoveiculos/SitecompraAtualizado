/**
 * Centralized Store Helpers & Contact Registry
 * Manos Veículos - Alto Vale do Itajaí
 */

export const CONTATO = {
  telefone: '(47) 3300-1352',
  telefoneLink: 'tel:+554733001352',
  whatsapp: '554733001352',
};

export const LOJA = {
  nome: 'Manos Veículos',
  subtitulo: 'Consultoria & Revenda Automotiva',
  endereco: 'R. Dom Pedro II, 374 — Canoas, Rio do Sul/SC, 89164-138',
  horario: 'Seg a Sex 8h–19h · Sáb 8h–13h',
  horarioExtra: 'Fora do horário, atendemos com hora marcada — qualquer dia da semana',
  maps: 'https://www.google.com/maps/dir//Manos+Veiculos,+R.+Dom+Pedro+II,+374+-+Canoas,+Rio+do+Sul+-+SC,+89164-138/@-27.1189403,-48.6088232,15z',
  logoUrl: 'https://manosveiculos.com.br/wp-content/uploads/2024/02/LogoManos.png',
};

export const SOCIAL = {
  google: 'https://share.google/gVOMunGbpS3ZbjKoa',
  reclameAqui: 'https://www.reclameaqui.com.br/empresa/raccar-comercio-de-veiculos-novos-e-usados-ltda/',
  instagram: 'https://www.instagram.com/manoveiculoss/',
};

export function waLink(mensagem?: string): string {
  const text = mensagem ? encodeURIComponent(mensagem) : encodeURIComponent('Olá! Vim pelo site da Manos Veículos e gostaria de mais informações.');
  return `https://wa.me/${CONTATO.whatsapp}?text=${text}`;
}

export function waAppointmentLink(carroTitle?: string): string {
  const msg = carroTitle 
    ? `Olá! Vi o ${carroTitle} no site. Posso agendar um horário para ver?`
    : 'Olá! Gostaria de agendar um horário especial para visitar a loja.';
  return waLink(msg);
}

export function waVehicleLink(veiculo: { description?: string; priceFormatted?: string; price?: number }): string {
  const nome = veiculo.description || 'este veículo';
  const preco = veiculo.priceFormatted || (veiculo.price ? brl(veiculo.price) : '');
  const msg = `Olá! Vi o ${nome}${preco ? ` por ${preco}` : ''} no site da Manos Veículos e quero saber mais sobre ele.`;
  return waLink(msg);
}

export function brl(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor);
}

export function km(valor: number): string {
  return `${new Intl.NumberFormat('pt-BR').format(valor)} km`;
}

/**
 * Validação rigorosa de CPF com cálculo de dígitos verificadores
 */
export function validateCPF(cpfRaw: string): boolean {
  const cpf = cpfRaw.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) return false;

  return true;
}

/**
 * Validação de Placa (Padrão Antigo ABC-1234 e Mercosul ABC1D23)
 */
export function validatePlaca(placaRaw: string): boolean {
  const placa = placaRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const regexAntigo = /^[A-Z]{3}[0-9]{4}$/;
  const regexMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  return regexAntigo.test(placa) || regexMercosul.test(placa);
}

/**
 * Formatação visual de CPF
 */
export function formatCPF(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Formatação visual de Telefone
 */
export function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

/**
 * Cálculo de parcela estimada com juros compostos
 */
export function calcParcela({ valor, entrada, meses, taxaMensal = 0.0199 }: { valor: number; entrada: number; meses: number; taxaMensal?: number }): number {
  const financiado = Math.max(0, valor - entrada);
  if (financiado <= 0 || meses <= 0) return 0;
  
  const i = taxaMensal;
  const pmt = (financiado * (i * Math.pow(1 + i, meses))) / (Math.pow(1 + i, meses) - 1);
  return Math.round(pmt * 100) / 100;
}
