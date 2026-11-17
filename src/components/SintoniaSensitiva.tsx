import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Compass, ShieldAlert, Sparkles } from 'lucide-react';
import {
  ChakraReading,
  PatientAnamnesis,
  SensitivityReading,
} from '../types/quantum';
import {
  INTERFERENCE_OPTIONS,
  evaluateAntiCatharsis,
  getHawkinsLevelInfo,
} from '../utils/antiCatharsis';

interface SintoniaSensitivaProps {
  anamnesis: PatientAnamnesis;
  sensitivity: SensitivityReading;
  onChange: (updated: SensitivityReading) => void;
  onProcessProtocol: () => void;
  onBackToAnamnesis: () => void;
}

const BovisGauge: React.FC<{ bovis: number }> = ({ bovis }) => {
  const maxVal = 15000;
  const clamped = Math.max(0, Math.min(maxVal, bovis));
  const angleDeg = -90 + (clamped / maxVal) * 180;
  const thresholdRad = ((-90 + (6500 / maxVal) * 180) * Math.PI) / 180;

  const cx = 160;
  const cy = 150;
  const radius = 110;

  const tx1 = cx + (radius - 13) * Math.sin(thresholdRad);
  const ty1 = cy - (radius - 13) * Math.cos(thresholdRad);
  const tx2 = cx + (radius + 9) * Math.sin(thresholdRad);
  const ty2 = cy - (radius + 9) * Math.cos(thresholdRad);

  const ticks = Array.from({ length: 16 }, (_, i) => {
    const val = i * 1000;
    const rad = ((-90 + (val / maxVal) * 180) * Math.PI) / 180;
    const isMajor = i % 3 === 0;
    const innerR = isMajor ? radius - 11 : radius - 6;
    return {
      val,
      isMajor,
      x1: cx + innerR * Math.sin(rad),
      y1: cy - innerR * Math.cos(rad),
      x2: cx + radius * Math.sin(rad),
      y2: cy - radius * Math.cos(rad),
      lx: cx + (radius + 16) * Math.sin(rad),
      ly: cy - (radius + 16) * Math.cos(rad),
    };
  });

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 320 180"
        className="w-full max-w-[330px] overflow-visible"
        role="img"
        aria-label={`Biômetro de Bovis em ${bovis} Angstroms`}
      >
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${
            cx + radius * Math.sin(thresholdRad)
          } ${cy - radius * Math.cos(thresholdRad)}`}
          fill="none"
          stroke="#BA1A1A"
          strokeOpacity="0.22"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx + radius * Math.sin(thresholdRad)} ${
            cy - radius * Math.cos(thresholdRad)
          } A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#D97706"
          strokeOpacity="0.32"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {ticks.map((t) => (
          <g key={t.val}>
            <line
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.val >= 6500 ? '#D97706' : '#94A3B8'}
              strokeWidth={t.isMajor ? 2 : 1}
            />
            {t.val % 3000 === 0 && (
              <text
                x={t.lx}
                y={t.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-[#64748B] text-[9px] font-mono"
              >
                {t.val / 1000}k
              </text>
            )}
          </g>
        ))}

        <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#B45309" strokeWidth="2.5" />
        <text
          x={cx + (radius + 22) * Math.sin(thresholdRad)}
          y={cy - (radius + 22) * Math.cos(thresholdRad)}
          textAnchor="middle"
          className="fill-[#B45309] text-[9px] font-mono font-semibold"
        >
          6.500 Å
        </text>

        <g
          transform={`rotate(${angleDeg}, ${cx}, ${cy})`}
          style={{ transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - radius + 14}
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy - radius + 14} r="4.5" fill="#F59E0B" />
        </g>

        <circle cx={cx} cy={cy} r="9" fill="#0F172A" />
        <circle cx={cx} cy={cy} r="3.5" fill="#F59E0B" />
      </svg>

      <div className="mt-1 text-center">
        <div className="font-mono tabular-nums text-3xl font-semibold text-[#0F172A]">
          {bovis.toLocaleString('pt-BR')} <span className="text-sm font-normal text-[#64748B]">Å</span>
        </div>
        <p className={`mt-1 text-xs font-medium ${bovis < 6500 ? 'text-[#BA1A1A]' : 'text-[#B45309]'}`}>
          {bovis < 6500
            ? 'Abaixo de 6.500 Å — Campo vulnerável (Modo Escalonado será ativado)'
            : 'Acima de 6.500 Å — Padrão energético em estabilidade'}
        </p>
      </div>
    </div>
  );
};

export const SintoniaSensitiva: React.FC<SintoniaSensitivaProps> = ({
  anamnesis,
  sensitivity,
  onChange,
  onProcessProtocol,
  onBackToAnamnesis,
}) => {
  // Polaridade Yin/Yang (0 = Yin extremo, 50 = Equilíbrio Tao, 100 = Yang extremo)
  const [yinYangRatio, setYinYangRatio] = useState<number>(50);

  const hawkinsInfo = useMemo(() => getHawkinsLevelInfo(sensitivity.hawkins), [sensitivity.hawkins]);
  const previewProtocol = useMemo(
    () => evaluateAntiCatharsis(anamnesis, sensitivity),
    [anamnesis, sensitivity]
  );

  const yinYangLabel = useMemo(() => {
    if (yinYangRatio < 40) return `Predomínio Yin (${100 - yinYangRatio}% Yin / ${yinYangRatio}% Yang) — Retração / Hipofunção`;
    if (yinYangRatio > 60) return `Predomínio Yang (${100 - yinYangRatio}% Yin / ${yinYangRatio}% Yang) — Hiperatividade / Inflamação`;
    return `Equilíbrio Dinâmico (${100 - yinYangRatio}% Yin / ${yinYangRatio}% Yang) — Homeostase Polar`;
  }, [yinYangRatio]);

  const toggleInterference = (label: string) => {
    const exists = sensitivity.interferenceTypes.includes(label);
    const nextTypes = exists
      ? sensitivity.interferenceTypes.filter((t) => t !== label)
      : [...sensitivity.interferenceTypes, label];
    onChange({
      ...sensitivity,
      interferenceTypes: nextTypes,
      subtleInterferences: nextTypes.length,
    });
  };

  const updateChakra = (id: string, percentage: number) => {
    const nextStatus: ChakraReading['status'] =
      percentage < 45
        ? 'Bloqueado'
        : percentage < 62
        ? 'Hipo-ativo'
        : percentage > 88
        ? 'Hiper-ativo'
        : 'Equilibrado';
    onChange({
      ...sensitivity,
      chakras: sensitivity.chakras.map((c) =>
        c.id === id ? { ...c, percentage, status: nextStatus } : c
      ),
    });
  };

  const toggleOrganicSystem = (id: string) => {
    onChange({
      ...sensitivity,
      organicSystems: sensitivity.organicSystems.map((s) =>
        s.id === id
          ? {
              ...s,
              status: s.status === 'Equilibrado' ? 'Em Alerta' : 'Equilibrado',
              note:
                s.status === 'Equilibrado'
                  ? 'Sensibilidade detectada na varredura pendular'
                  : 'Tônus estável',
            }
          : s
      ),
    });
  };

  const alertSystemsCount = sensitivity.organicSystems.filter((s) => s.status === 'Em Alerta').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
            Etapa Clínica 02 · Sintonia Sensitiva & Varredura Radiestésica
          </p>
          <h1 className="mt-1.5 font-serif text-3xl font-light text-[#0F172A]">
            {anamnesis.fullName || 'Aferição Bioenergética'}
          </h1>
          <p className="mt-1.5 text-sm text-[#45464D]">
            Foco: <span className="font-medium text-[#0F172A]">{anamnesis.therapeuticFocus}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToAnamnesis}
          className="px-4 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] transition-colors cursor-pointer whitespace-nowrap self-start md:self-auto"
        >
          Editar Anamnese
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Biometer, Hawkins, Aura, Stress 1-9, Yin/Yang */}
        <div className="lg:col-span-5 space-y-6">
          {/* Bovis Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">Biômetro de Bovis</h2>
              <span className="text-xs font-mono text-[#64748B]">0 – 15.000 Å</span>
            </div>

            <BovisGauge bovis={sensitivity.bovis} />

            <div>
              <input
                aria-label="Calibrar Biômetro de Bovis"
                type="range"
                min={2000}
                max={14000}
                step={100}
                value={sensitivity.bovis}
                onChange={(e) => onChange({ ...sensitivity, bovis: Number(e.target.value) })}
                className="w-full clinical-slider"
              />
              <div className="mt-1.5 flex justify-between text-[11px] font-mono text-[#64748B]">
                <span>2.000 Å</span>
                <span className="text-[#B45309] font-semibold">6.500 Å (Limiar)</span>
                <span>14.000 Å</span>
              </div>
            </div>
          </div>

          {/* Core Calibrators */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-6">
            <h2 className="font-serif text-lg font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3">
              Calibradores Bioenergéticos
            </h2>

            {/* Hawkins */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="hawkinsSlider" className="font-semibold text-[#0F172A]">
                  Escala de Consciência (Hawkins)
                </label>
                <span className="font-mono tabular-nums font-semibold text-[#B45309]">
                  {sensitivity.hawkins} · {hawkinsInfo.label}
                </span>
              </div>
              <input
                id="hawkinsSlider"
                type="range"
                min={20}
                max={700}
                step={5}
                value={sensitivity.hawkins}
                onChange={(e) => onChange({ ...sensitivity, hawkins: Number(e.target.value) })}
                className="w-full clinical-slider"
              />
              <p className="text-xs text-[#64748B]">
                Zona: <span className="font-medium text-[#0F172A]">{hawkinsInfo.zone}</span> —{' '}
                {hawkinsInfo.emotion}
              </p>
            </div>

            {/* Proteção Áurica */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="auraSlider" className="font-semibold text-[#0F172A]">
                  Integridade / Proteção Áurica
                </label>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    sensitivity.auricProtection < 50 ? 'text-[#BA1A1A]' : 'text-[#0F172A]'
                  }`}
                >
                  {sensitivity.auricProtection}%
                </span>
              </div>
              <input
                id="auraSlider"
                type="range"
                min={10}
                max={100}
                step={1}
                value={sensitivity.auricProtection}
                onChange={(e) =>
                  onChange({ ...sensitivity, auricProtection: Number(e.target.value) })
                }
                className="w-full clinical-slider"
              />
              <p className="text-xs text-[#64748B]">
                Valores abaixo de 50% acionam blindagem áurica prévia.
              </p>
            </div>

            {/* Estresse 1-9 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="stressSlider" className="font-semibold text-[#0F172A]">
                  Nível de Estresse & Sobrecarga Neural (1–9)
                </label>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    sensitivity.stressLevel >= 4 ? 'text-[#BA1A1A]' : 'text-[#0F172A]'
                  }`}
                >
                  {sensitivity.stressLevel} / 9
                </span>
              </div>
              <input
                id="stressSlider"
                type="range"
                min={1}
                max={9}
                step={1}
                value={sensitivity.stressLevel}
                onChange={(e) =>
                  onChange({ ...sensitivity, stressLevel: Number(e.target.value) })
                }
                className="w-full clinical-slider"
              />
              <p className="text-xs text-[#64748B]">
                Nível ≥ 4 indica hiperatividade simpática e requer protocolo anti-catarse.
              </p>
            </div>

            {/* Polaridade Yin / Yang */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="yinYangSlider" className="font-semibold text-[#0F172A]">
                  Polaridade Energética Yin / Yang
                </label>
                <span className="font-mono tabular-nums font-semibold text-[#B45309]">
                  {100 - yinYangRatio}% Yin · {yinYangRatio}% Yang
                </span>
              </div>
              <input
                id="yinYangSlider"
                type="range"
                min={10}
                max={90}
                step={5}
                value={yinYangRatio}
                onChange={(e) => setYinYangRatio(Number(e.target.value))}
                className="w-full clinical-slider"
              />
              <p className="text-xs text-[#64748B]">{yinYangLabel}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Checklists (Interferências, Chakras, Sistemas Orgânicos) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Interferências Sutis */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                Varredura de Interferências Sutis
              </h2>
              <span className="font-mono tabular-nums text-xs font-semibold text-[#B45309]">
                {sensitivity.subtleInterferences} selecionada(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTERFERENCE_OPTIONS.map((option) => {
                const checked = sensitivity.interferenceTypes.includes(option);
                return (
                  <label
                    key={option}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#FAF8F5] border-[#D97706] text-[#0F172A]'
                        : 'bg-white border-[#E2E8F0] text-[#45464D] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleInterference(option)}
                      className="w-4 h-4 accent-[#0F172A] rounded cursor-pointer"
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 7 Chakras */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                Alinhamento dos Sete Chakras
              </h2>
              <span className="text-xs text-[#64748B]">Vitalidade individual (%)</span>
            </div>

            <div className="space-y-3.5">
              {sensitivity.chakras.map((chakra) => (
                <div key={chakra.id} className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3">
                  <div className="sm:col-span-4">
                    <p className="text-xs font-semibold text-[#0F172A]">
                      {chakra.name}{' '}
                      <span className="font-normal text-[#64748B]">({chakra.sanskrit})</span>
                    </p>
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      aria-label={`Vitalidade do chakra ${chakra.name}`}
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={chakra.percentage}
                      onChange={(e) => updateChakra(chakra.id, Number(e.target.value))}
                      className="w-full clinical-slider"
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-2 text-xs">
                    <span className="font-mono tabular-nums font-semibold text-[#0F172A]">
                      {chakra.percentage}%
                    </span>
                    <span
                      className={`font-medium ${
                        chakra.status === 'Equilibrado' ? 'text-[#B45309]' : 'text-[#BA1A1A]'
                      }`}
                    >
                      {chakra.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sistemas Orgânicos */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                Sistemas Orgânicos (Checklist Pêndulo)
              </h2>
              <span
                className={`font-mono tabular-nums text-xs font-semibold ${
                  alertSystemsCount >= 3 ? 'text-[#BA1A1A]' : 'text-[#0F172A]'
                }`}
              >
                {alertSystemsCount} em alerta
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sensitivity.organicSystems.map((sys) => {
                const isAlert = sys.status === 'Em Alerta';
                return (
                  <button
                    key={sys.id}
                    type="button"
                    onClick={() => toggleOrganicSystem(sys.id)}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      isAlert
                        ? 'bg-[#BA1A1A]/5 border-[#BA1A1A]/40 text-[#0F172A]'
                        : 'bg-white border-[#E2E8F0] text-[#45464D] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#0F172A]">{sys.name}</p>
                      <p className="text-[11px] text-[#64748B]">{sys.status}</p>
                    </div>
                    {isAlert ? (
                      <AlertTriangle className="w-4 h-4 text-[#BA1A1A] shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-[#B45309] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Live Anti-Catharsis Preview & Processing Action */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center gap-2">
            {previewProtocol.riskTriggered ? (
              <ShieldAlert className="w-5 h-5 text-[#B45309] shrink-0" />
            ) : (
              <Compass className="w-5 h-5 text-[#B45309] shrink-0" />
            )}
            <h3 className="font-serif text-lg font-bold text-[#0F172A]">
              {previewProtocol.riskTriggered
                ? 'Pré-diagnóstico: Risco de Catarse Detectado → Modo Escalonado em 2 Etapas'
                : 'Pré-diagnóstico: Campo Estável → Protocolo Direto em Etapa Única'}
            </h3>
          </div>

          {previewProtocol.riskTriggered ? (
            <ul className="text-xs text-[#45464D] space-y-1 list-disc list-inside">
              {previewProtocol.riskReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#45464D]">
              Bovis ≥ 6.500 Å, proteção áurica ≥ 50% e ausência de interferências densas permitem
              harmonização e vitalização direta.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onProcessProtocol}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] hover:shadow-[0_0_20px_rgba(217,119,6,0.3)] transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-4 h-4 text-[#F59E0B]" />
          Processar Protocolo Anti-Catarse
        </button>
      </section>
    </div>
  );
};
