import React, { useState } from 'react';
import { SiteShell, TrustCards, WhatsAppCta } from '../ManosUI';
import { fetchStock, type Vehicle } from '../../services/stockService';

export default function VenderCarroPage() {
  const [veiculoInteresse, setVeiculoInteresse] = useState<Vehicle | null>(null);

  // Carro de interesse vindo de ?veiculo=<slug> (troca na compra)
  React.useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('veiculo');
    if (!slug) return;
    fetchStock()
      .then((list) => {
        const found = list.find((v) => v.id === slug || v.slug === slug || v.description.toLowerCase().includes(slug.toLowerCase()));
        if (found) setVeiculoInteresse(found);
      })
      .catch(() => {});
  }, []);

  const mensagem = veiculoInteresse
    ? `Olá! Quero avaliar meu carro para dar na troca pelo ${veiculoInteresse.description}.`
    : 'Olá! Quero avaliar meu carro para venda ou troca.';

  return (
    <SiteShell variant="vendas" title="Avaliar / Vender Carro">
      <div className="space-y-6">
        <div className="text-center space-y-2 pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A88A70]">
            Avaliação Grátis & Sem Compromisso
          </span>
          <h1 className="font-serif text-3xl font-extrabold text-[#3B2016] tracking-tight">
            Venda ou Troque seu Carro
          </h1>
          <p className="text-xs text-[#7D6250]">
            Pagamento à vista na conta via PIX e documentação resolvida pela Manos Veículos em Rio do Sul/SC.
          </p>
        </div>

        {veiculoInteresse && (
          <div className="p-4 bg-white border border-manos-sand rounded-2xl flex items-center gap-4 shadow-sm">
            <img
              src={veiculoInteresse.image}
              alt={veiculoInteresse.description}
              className="w-20 h-16 object-cover rounded-xl bg-manos-warm flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-extrabold text-manos-red uppercase tracking-widest block">
                Carro de interesse
              </span>
              <h4 className="font-serif font-bold text-sm text-[#3B2016] truncate">{veiculoInteresse.description}</h4>
            </div>
          </div>
        )}

        <div className="p-6 bg-white border border-manos-sand rounded-3xl space-y-3 text-center shadow-sm">
          <h3 className="font-serif font-bold text-lg text-[#3B2016]">Fale direto com um avaliador</h3>
          <p className="text-xs text-[#7D6250]">
            Mande a placa, fotos e detalhes do seu carro pelo WhatsApp e receba a proposta no mesmo dia.
          </p>
          <WhatsAppCta contexto="vender_carro" label="Avaliar via WhatsApp" mensagem={mensagem} />
        </div>

        <div className="p-6 bg-[#3B2016] text-[#FDF3E7] rounded-3xl space-y-4 shadow-xl">
          <h3 className="font-serif font-bold text-xl text-white">Como Funciona a Avaliação</h3>
          <div className="space-y-3">
            {[
              ['1', 'Você chama no WhatsApp', 'Envie a placa ou o modelo do carro para buscarmos o histórico e a FIPE.'],
              ['2', 'Proposta Rápida', 'Nosso avaliador envia o valor estimado de compra ou margem de troca no mesmo dia.'],
              ['3', 'Pagamento no PIX na Hora', 'Fechou na loja? A gente transfere o dinheiro direto pra sua conta e cuida da transferência.'],
            ].map(([n, titulo, texto]) => (
              <div key={n} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-xl bg-manos-red text-manos-accent flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                  {n}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">{titulo}</h4>
                  <p className="text-xs text-[#E8C6AC]">{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <TrustCards />
      </div>
    </SiteShell>
  );
}
