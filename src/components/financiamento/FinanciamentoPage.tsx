import React, { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { SiteShell, TrustCards, WhatsAppCta } from '../ManosUI';
import { brl, calcParcela } from '../../lib/manos';
import { track } from '../../lib/track';
import { fetchStock, type Vehicle } from '../../services/stockService';

export default function FinanciamentoPage() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleValue, setVehicleValue] = useState<number>(85000);
  const [entrada, setEntrada] = useState<number>(20000);
  const [meses, setMeses] = useState<number>(48);

  // Detecta ?veiculo=<slug> para pré-carregar o carro escolhido
  useEffect(() => {
    track('sim_start', { pagina: '/financiamento' });
    const slug = new URLSearchParams(window.location.search).get('veiculo');
    if (slug) {
      fetchStock().then((list) => {
        const found = list.find((v) => v.id === slug || v.description.toLowerCase().includes(slug.toLowerCase()));
        if (found) {
          setVehicle(found);
          setVehicleValue(found.price);
          setEntrada(Math.round(found.price * 0.25));
        }
      }).catch(() => {});
    }
  }, []);

  const maxEntrada = Math.round(vehicleValue * 0.8);

  const parcelaEstimada = calcParcela({
    valor: vehicleValue,
    entrada,
    meses,
    taxaMensal: 0.0199,
  });

  const mensagem = vehicle
    ? `Olá! Quero simular o financiamento do ${vehicle.description} (${brl(vehicleValue)}) com entrada de ${brl(entrada)} em ${meses}x.`
    : `Olá! Quero simular o financiamento de um veículo de ${brl(vehicleValue)} com entrada de ${brl(entrada)} em ${meses}x.`;

  return (
    <SiteShell variant="financiamento" title="Simulação de Financiamento">
      <div className="space-y-6">
        <div className="text-center space-y-2 pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A88A70]">
            Aprovação Rápida & Sem Complicação
          </span>
          <h1 className="font-serif text-3xl font-extrabold text-[#3B2016] tracking-tight">
            Simule seu Financiamento
          </h1>
          <p className="text-xs text-[#7D6250]">
            Trabalhamos com os principais bancos para garantir as menores taxas do mercado.
          </p>
        </div>

        {vehicle && (
          <div className="p-4 bg-white border border-manos-sand rounded-2xl flex items-center gap-4 shadow-sm">
            <img
              src={vehicle.image}
              alt={vehicle.description}
              className="w-20 h-16 object-cover rounded-xl bg-manos-warm flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-extrabold text-manos-red uppercase tracking-widest block">
                Carro Selecionado
              </span>
              <h4 className="font-serif font-bold text-sm text-[#3B2016] truncate">{vehicle.description}</h4>
              <p className="text-manos-red font-extrabold text-base">{vehicle.priceFormatted}</p>
            </div>
          </div>
        )}

        <div className="p-6 bg-[#3B2016] text-[#FDF3E7] rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#EEDFCF]/15 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#E0B68F]" />
              <span className="text-xs font-extrabold text-[#E8C6AC] uppercase tracking-wider">
                Estimativa da Parcela
              </span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 bg-manos-red text-manos-accent rounded-full">
              Taxa Especial
            </span>
          </div>

          <div className="text-center py-2 space-y-1">
            <div className="text-3xl font-serif font-extrabold text-white">
              {parcelaEstimada > 0 ? brl(parcelaEstimada) : 'R$ --'}
              <span className="text-xs font-sans text-[#E8C6AC] font-semibold"> / mês</span>
            </div>
            <p className="text-[10px] text-[#E8C6AC] leading-tight font-medium">
              *Simulação prévia estimada. A concessão, taxa e aprovação final dependem da análise de crédito pelas instituições financeiras parceiras.
            </p>
          </div>

          {!vehicle && (
            <div className="space-y-1.5 pt-2 border-t border-[#EEDFCF]/15">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#E8C6AC]">
                Valor aproximado do veículo
              </label>
              <input
                type="number"
                value={vehicleValue || ''}
                onChange={(e) => setVehicleValue(Number(e.target.value))}
                className="w-full py-3 px-4 bg-white/10 text-white border border-white/20 rounded-xl focus:border-white text-base outline-none font-bold"
                placeholder="R$ 85.000"
              />
            </div>
          )}
        </div>

        {/* Ajustes da simulação (sem envio de dados) */}
        <div className="space-y-5 bg-white p-6 rounded-3xl border border-manos-sand shadow-sm">
          <h3 className="font-serif font-bold text-lg text-[#3B2016] border-b border-manos-sand pb-3">
            Ajuste sua simulação
          </h3>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#A88A70]">
                Valor de Entrada (R$)
              </label>
              <span className="text-xs font-bold text-manos-red">{brl(entrada)}</span>
            </div>
            <input
              type="number"
              min={0}
              max={maxEntrada}
              value={entrada}
              onChange={(e) => setEntrada(Math.min(Number(e.target.value), maxEntrada))}
              className="input-manos"
            />
            <p className="text-[10px] text-[#A88A70]">Máximo de 80% do valor do carro ({brl(maxEntrada)}).</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#A88A70]">
              Quantidade de Parcelas
            </label>
            <select
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className="input-manos cursor-pointer font-bold"
            >
              {[12, 24, 36, 48, 60].map((m) => (
                <option key={m} value={m}>{m}x parcelas</option>
              ))}
            </select>
          </div>

          <WhatsAppCta
            contexto="financiamento"
            label="Simular no WhatsApp"
            mensagem={mensagem}
          />
        </div>

        <TrustCards />
      </div>
    </SiteShell>
  );
}
