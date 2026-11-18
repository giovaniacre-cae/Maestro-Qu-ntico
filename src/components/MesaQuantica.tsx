import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  Compass,
  Copy,
  FileText,
  Gem,
  Leaf,
  Lock,
  PauseCircle,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingUp,
  Volume2,
} from 'lucide-react';
import {
  ClinicalAnsaeRhenSheet,
  ClinicalSessionRecord,
  SessionMilestoneType,
} from '../types/clinical';
import {
  AntiCatharsisProtocol,
  PatientAnamnesis,
  QuantumGenerationResult,
  SensitivityReading,
} from '../types/quantum';
import { formatAngstromsBR, formatTestemunho, getHawkinsLevelInfo } from '../utils/antiCatharsis';
import { solfeggioSynth } from '../utils/audioSynth';

export interface SelectedTherapeutics {
  florals: string[];
  crystals: string[];
  herbs: string[];
  habits: string[];
}

interface MesaQuanticaProps {
  anamnesis: PatientAnamnesis;
  sensitivity: SensitivityReading;
  protocol: AntiCatharsisProtocol;
  aiResult: QuantumGenerationResult | null;
  isGenerating: boolean;
  generationError: string | null;
  isAnchored: boolean;
  selectedHz: number;
  ansaeSheet?: ClinicalAnsaeRhenSheet;
  sessionType?: SessionMilestoneType;
  previousSession?: ClinicalSessionRecord | null;
  selectedTherapeutics?: SelectedTherapeutics;
  onUpdateTherapeutics?: (updated: SelectedTherapeutics) => void;
  onRegenerateAI: () => void;
  onSelectHz: (hz: number) => void;
  onAnchorAndCollapse: () => void;
  onGoToDocuments: () => void;
  onBackToSensitivity: () => void;
}

const SOLFEGGIO_OPTIONS = [
  { hz: 432, label: '432 Hz', desc: 'Coerência Natural & Aterramento' },
  { hz: 528, label: '528 Hz', desc: 'Regeneração Celular & Reparação' },
  { hz: 741, label: '741 Hz', desc: 'Assepsia Sutil & Limpeza' },
];

const QUICK_FLORALS = [
  'Walnut (Proteção & Transições)',
  'Rescue Remedy (Estabilização Emergencial)',
  'White Chestnut (Mente Tranquila)',
  'Olive (Restauração de Exaustão)',
  'Mimulus (Coragem & Segurança)',
  'Larch (Autoconfiança)',
];

const QUICK_CRYSTALS = [
  'Ametista (Transmutação & Coroa)',
  'Turmalina Negra (Blindagem & Aterramento)',
  'Quartzo Verde (Regeneração Orgânica)',
  'Citrino (Plexo Solar & Vitalidade)',
  'Quartzo Rosa (Pacificação Cardíaca)',
  'Selenita (Assepsia Áurica)',
];

const QUICK_HABITS = [
  '2L+ de água solarizada / pura por dia',
  'Respiração 4-6 min antes do sono',
  'Higiene digital 45 min antes de dormir',
  'Exposição solar matinal (15 min)',
  'Caminhada consciente e contato com a natureza',
  'Oração ou prática diária de gratidão',
];

export const MesaQuantica: React.FC<MesaQuanticaProps> = ({
  anamnesis,
  sensitivity,
  protocol,
  aiResult,
  isGenerating,
  generationError,
  isAnchored,
  selectedHz,
  ansaeSheet,
  sessionType = 'Avaliação Inicial',
  previousSession,
  selectedTherapeutics,
  onUpdateTherapeutics,
  onRegenerateAI,
  onSelectHz,
  onAnchorAndCollapse,
  onGoToDocuments,
  onBackToSensitivity,
}) => {
  const [activeStageTab, setActiveStageTab] = useState<'stage1' | 'rest' | 'stage2'>(
    protocol.mode === 'escalonado' ? 'stage1' : 'stage2'
  );
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.25);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [localTherapeutics, setLocalTherapeutics] = useState<SelectedTherapeutics>(
    selectedTherapeutics || { florals: [], crystals: [], herbs: [], habits: [] }
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (selectedTherapeutics) {
      setLocalTherapeutics(selectedTherapeutics);
    }
  }, [selectedTherapeutics]);

  useEffect(() => {
    setActiveStageTab(protocol.mode === 'escalonado' ? 'stage1' : 'stage2');
  }, [protocol.mode]);

  useEffect(() => {
    return () => {
      solfeggioSynth.stop();
    };
  }, []);

  useEffect(() => {
    if (!isAudioPlaying) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, canvas.height / 2);
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        }
      }
      return;
    }

    let rafId = 0;
    const buffer = new Uint8Array(new ArrayBuffer(128));

    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx && solfeggioSynth.getWaveformData(buffer)) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#D97706';
          ctx.beginPath();

          const sliceWidth = canvas.width / buffer.length;
          let x = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = buffer[i] / 128.0;
            const y = (v * canvas.height) / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        }
      }
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [isAudioPlaying]);

  const handleToggleAudio = () => {
    if (isAudioPlaying) {
      solfeggioSynth.stop();
      setIsAudioPlaying(false);
    } else {
      solfeggioSynth.start(selectedHz, volume);
      setIsAudioPlaying(true);
    }
  };

  const handleHzChange = (hz: number) => {
    onSelectHz(hz);
    if (isAudioPlaying) {
      solfeggioSynth.setFrequency(hz);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    solfeggioSynth.setVolume(vol);
  };

  const handleCopyCommand = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    } catch {
      // Clipboard blocked in non-HTTPS contexts
    }
  };

  const toggleTherapeutic = (key: keyof SelectedTherapeutics, value: string) => {
    const current = localTherapeutics[key];
    const nextList = current.includes(value)
      ? current.filter((x) => x !== value)
      : [...current, value];
    const nextState: SelectedTherapeutics = {
      ...localTherapeutics,
      [key]: nextList,
    };
    setLocalTherapeutics(nextState);
    onUpdateTherapeutics?.(nextState);
  };

  const imbalancedOrgans = useMemo(
    () =>
      (ansaeSheet?.organs || []).filter(
        (o) =>
          o.isImbalanced ||
          (typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500)
      ),
    [ansaeSheet]
  );

  const alertSystems = useMemo(
    () =>
      (ansaeSheet?.systems || []).filter(
        (s) =>
          s.isImbalanced ||
          (typeof s.healthEnergyAngstroms === 'number' && s.healthEnergyAngstroms < 6500)
      ),
    [ansaeSheet]
  );

  const imbalancedChakras = useMemo(
    () => (ansaeSheet?.chakras || []).filter((c) => c.status !== 'Normal'),
    [ansaeSheet]
  );

  const hawkinsInfo = getHawkinsLevelInfo(sensitivity.hawkins);
  const fallbackTestemunho = formatTestemunho(anamnesis);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
            Etapa Clínica 03 · Mesa Radiônica & Ressonância Harmônica · {sessionType}
          </p>
          <h1 className="mt-1.5 font-serif text-3xl font-light text-[#0F172A]">
            {anamnesis.fullName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
            <span className="font-mono tabular-nums text-[#0F172A] font-semibold">
              {sensitivity.bovis.toLocaleString('pt-BR')} Å
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Hawkins {sensitivity.hawkins} Hz ({hawkinsInfo.label})
            </span>
            <span aria-hidden="true">·</span>
            <span>Aura {sensitivity.auricProtection}%</span>
            <span aria-hidden="true">·</span>
            <span>Foco: {anamnesis.therapeuticFocus}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onBackToSensitivity}
            className="px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] transition-colors cursor-pointer whitespace-nowrap"
          >
            Recalibrar Ficha ANSAE
          </button>
          <button
            type="button"
            onClick={onRegenerateAI}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#B45309] bg-white border border-[#D97706] rounded-lg hover:bg-[#D97706]/5 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Sintetizando IA...' : 'Regerar Diagnóstico Cruzado IA'}
          </button>
        </div>
      </section>

      {/* Síntese ANSAE / RHEN & Biômetros Consultados + Seleção Terapêutica */}
      {ansaeSheet && (
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#B45309]" />
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                Síntese Clínica ANSAE / RHEN & Apoios Aferidos na Mesa
              </h2>
            </div>
            <span className="text-xs font-mono text-[#64748B]">
              {ansaeSheet.spiritualPsycho.recommendedRadionicBoard}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-1">
              <p className="font-semibold text-[#0F172A]">Chakras & Campo Áurico</p>
              <p className="text-[#45464D]">
                {imbalancedChakras.length > 0
                  ? imbalancedChakras
                      .map((c) => `${c.name} (${c.status} ${c.imbalancePercent}%)`)
                      .join(', ')
                  : '7 chakras em homeostase'}
              </p>
              <p className="text-[#64748B] pt-1">
                <strong className="text-[#B45309]">Falta:</strong>{' '}
                {ansaeSheet.auricField.missingColors.join(', ') || '—'} ·{' '}
                <strong className="text-[#0F172A]">Excesso:</strong>{' '}
                {ansaeSheet.auricField.excessColors.join(', ') || '—'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-1">
              <p className="font-semibold text-[#0F172A]">
                Sistemas & Órgãos ANSAE em Alerta ({alertSystems.length + imbalancedOrgans.length})
              </p>
              <p className="text-[#45464D]">
                {alertSystems.length > 0 || imbalancedOrgans.length > 0
                  ? [
                      ...alertSystems.map(
                        (s) =>
                          `[${s.systemCode}] ${s.systemName} (${s.imbalancePercent}%${
                            typeof s.healthEnergyAngstroms === 'number'
                              ? ` · ${formatAngstromsBR(s.healthEnergyAngstroms)}`
                              : ''
                          })`
                      ),
                      ...imbalancedOrgans.map(
                        (o) =>
                          `[${o.systemCode}] ${o.organName} (${o.imbalancePercent}%${
                            typeof o.healthEnergyAngstroms === 'number'
                              ? ` · ${formatAngstromsBR(o.healthEnergyAngstroms)}`
                              : ''
                          } · ${o.durationValue}${o.durationUnit})`
                      ),
                    ].join('; ')
                  : 'Nenhum sistema ou órgão marcado em desequilíbrio na ficha ANSAE.'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-1">
              <p className="font-semibold text-[#0F172A]">
                Biômetros Virtuais Consultados ({ansaeSheet.biometerReadings.length})
              </p>
              <p className="text-[#45464D]">
                {ansaeSheet.biometerReadings.length > 0
                  ? ansaeSheet.biometerReadings
                      .slice(0, 4)
                      .map((b) => `${b.biometerName}: ${b.selectedItem}`)
                      .join(' · ')
                  : 'Nenhuma leitura extra registrada nos 22 biômetros.'}
              </p>
            </div>
          </div>

          {/* Interactive Therapeutic Selectors fed directly to Gemini */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-[#E2E8F0]">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#B45309] flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5" />
                Florais de Bach Aferidos (Opcional)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FLORALS.map((f) => {
                  const active = localTherapeutics.florals.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleTherapeutic('florals', f)}
                      className={`px-2 py-1 text-[11px] rounded border cursor-pointer ${
                        active
                          ? 'bg-[#0F172A] text-white border-[#0F172A]'
                          : 'bg-[#FAF8F5] text-[#45464D] border-[#E2E8F0]'
                      }`}
                    >
                      {f.split(' (')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#B45309] flex items-center gap-1">
                <Gem className="w-3.5 h-3.5" />
                Cristais Terapêuticos Aferidos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CRYSTALS.map((c) => {
                  const active = localTherapeutics.crystals.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleTherapeutic('crystals', c)}
                      className={`px-2 py-1 text-[11px] rounded border cursor-pointer ${
                        active
                          ? 'bg-[#0F172A] text-white border-[#0F172A]'
                          : 'bg-[#FAF8F5] text-[#45464D] border-[#E2E8F0]'
                      }`}
                    >
                      {c.split(' (')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#B45309] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Bons Hábitos Aferidos
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_HABITS.map((h) => {
                  const active = localTherapeutics.habits.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleTherapeutic('habits', h)}
                      className={`px-2 py-1 text-[11px] rounded border cursor-pointer ${
                        active
                          ? 'bg-[#0F172A] text-white border-[#0F172A]'
                          : 'bg-[#FAF8F5] text-[#45464D] border-[#E2E8F0]'
                      }`}
                    >
                      {h.slice(0, 26)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Previous Session Comparison Banner if Pós-Tratamento */}
      {previousSession && (
        <section className="bg-white border border-[#D97706]/40 rounded-xl p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#B45309]">
                Reavaliação Evolutiva Conectada ({previousSession.sessionType} → {sessionType})
              </p>
              <p className="text-xs text-[#45464D] mt-1 font-mono">
                Bovis: {previousSession.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å →{' '}
                <strong>{sensitivity.bovis.toLocaleString('pt-BR')} Å</strong> · Hawkins:{' '}
                {previousSession.ansaeRhen.spiritualPsycho.hawkinsAgathaHz} Hz →{' '}
                <strong>{sensitivity.hawkins} Hz</strong> · Aura:{' '}
                {previousSession.ansaeRhen.auricField.protectionPercent}% →{' '}
                <strong>{sensitivity.auricProtection}%</strong>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Banner de Alerta Anti-Catarse */}
      {protocol.riskTriggered ? (
        <section
          role="alert"
          className="bg-white border border-[#D97706]/50 rounded-xl p-6 shadow-[0_0_24px_0_rgba(217,119,6,0.08)] space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                Protocolo Anti-Catarse Ativado — Modo Escalonado Obrigatório em 2 Etapas
              </h2>
              <p className="text-sm text-[#45464D] leading-relaxed">
                Para proteger o paciente contra crises de eliminação (catarse fisiológica/emocional),
                gráficos de aceleração intensa foram bloqueados na Etapa 1. A irradiação inicia
                exclusivamente com assepsia e blindagem por 48h a 72h, seguida de pausa obrigatória de
                12 horas antes da regeneração.
              </p>
              <div className="pt-1 flex flex-col gap-1 text-xs text-[#663500]">
                {protocol.riskReasons.map((reason) => (
                  <p key={reason} className="font-medium">
                    • {reason}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex items-start gap-3 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]">
          <ShieldCheck className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-serif text-base font-bold text-[#0F172A]">
              Campo Bioenergético Estável — Protocolo Direto em Etapa Única Liberado
            </h2>
            <p className="mt-1 text-xs text-[#45464D]">
              Biômetro de Bovis ≥ 6.500 Å, proteção áurica satisfatória e ausência de interferências
              densas. A mesa pode irradiar vitalização e harmonização imediatamente.
            </p>
          </div>
        </section>
      )}

      {/* Abas de Etapas e Arquétipos Radiestésicos */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <h2 className="font-serif text-xl font-bold text-[#0F172A]">
            Arquitetura de Geometrias Sagradas
          </h2>

          {protocol.mode === 'escalonado' && (
            <div
              role="tablist"
              aria-label="Etapas do Protocolo Anti-Catarse"
              className="inline-flex items-center gap-1 p-1 bg-[#FAF8F5] border border-[#E2E8F0] rounded-lg"
            >
              <button
                type="button"
                onClick={() => setActiveStageTab('stage1')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeStageTab === 'stage1'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Etapa 1 (48h–72h)
              </button>
              <button
                type="button"
                onClick={() => setActiveStageTab('rest')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeStageTab === 'rest'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Intervalo 12h
              </button>
              <button
                type="button"
                onClick={() => setActiveStageTab('stage2')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeStageTab === 'stage2'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Etapa 2 (7–10 dias)
              </button>
            </div>
          )}
        </div>

        {/* Conteúdo da Aba Selecionada */}
        {protocol.mode === 'escalonado' && activeStageTab === 'stage1' && protocol.stage1 && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-serif text-base font-bold text-[#0F172A]">
                  {protocol.stage1.title}
                </h3>
                <p className="mt-1 text-xs text-[#45464D] leading-relaxed">
                  {protocol.stage1.objective}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#B45309] shrink-0">
                Janela: {protocol.stage1.durationLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {protocol.stage1.geometries.map((geo) => (
                <div
                  key={geo.name}
                  className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm font-bold text-[#0F172A]">{geo.name}</span>
                    <span className="text-[11px] font-mono text-[#B45309]">{geo.durationHint}</span>
                  </div>
                  <p className="text-xs text-[#45464D] leading-relaxed">{geo.role}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-lg bg-[#BA1A1A]/5 border border-[#BA1A1A]/25 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#BA1A1A]">
                <Ban className="w-4 h-4 shrink-0" />
                <span>Arquétipos Bloqueados Nesta Fase (Proteção Anti-Catarse)</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[#45464D]">
                {protocol.stage1.blockedGeometries.map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-[#BA1A1A] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {protocol.mode === 'escalonado' && activeStageTab === 'rest' && (
          <div className="p-6 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] flex items-start gap-4">
            <PauseCircle className="w-6 h-6 text-[#B45309] shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-serif text-base font-bold text-[#0F172A]">
                Intervalo Obrigatório de Repouso — 12 Horas
              </h3>
              <p className="text-sm text-[#45464D] leading-relaxed">
                Após completar 48h a 72h na Etapa 1, todas as emissões radiônicas são suspensas por
                exatamente 12 horas. Esse repouso permite que o sistema nervoso autônomo e o eixo
                endócrino integrem a limpeza sutil antes de receber o estímulo de Alta Vitalidade.
              </p>
            </div>
          </div>
        )}

        {((protocol.mode === 'escalonado' && activeStageTab === 'stage2' && protocol.stage2) ||
          (protocol.mode === 'direto' && protocol.singleStage)) && (
          <div className="space-y-5">
            {(() => {
              const stageObj =
                protocol.mode === 'escalonado' ? protocol.stage2! : protocol.singleStage!;
              return (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-base font-bold text-[#0F172A]">
                        {stageObj.title}
                      </h3>
                      <p className="mt-1 text-xs text-[#45464D] leading-relaxed">
                        {stageObj.objective}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#B45309] shrink-0">
                      Janela: {stageObj.durationLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stageObj.geometries.map((geo) => (
                      <div
                        key={geo.name}
                        className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-sm font-bold text-[#0F172A]">
                            {geo.name}
                          </span>
                          <span className="text-[11px] font-mono text-[#B45309]">
                            {geo.durationHint}
                          </span>
                        </div>
                        <p className="text-xs text-[#45464D] leading-relaxed">{geo.role}</p>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </section>

      {/* Motor de Ressonância Harmônica */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#0F172A]">
              Motor de Ressonância Harmônica & Diagnóstico Cruzado
            </h2>
            <p className="text-xs text-[#64748B]">
              Análise da causa raiz, testemunhos informacionais, comandos quânticos e prescrições integrativas
            </p>
          </div>
        </div>

        {generationError && (
          <div
            role="alert"
            className="p-5 rounded-xl bg-[#BA1A1A]/5 border border-[#BA1A1A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="text-xs text-[#93000A] space-y-1">
              <p className="font-semibold">Não foi possível gerar via Gemini API:</p>
              <p>{generationError}</p>
            </div>
            <button
              type="button"
              onClick={onRegenerateAI}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap shrink-0"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {isGenerating ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 space-y-4">
            <div className="flex items-center gap-3 text-sm font-medium text-[#0F172A]">
              <Sparkles className="w-5 h-5 text-[#D97706] animate-spin" />
              <span>
                Cruzando órgãos ANSAE, chakras, aura e biômetros para sintetizar diagnóstico e comandos...
              </span>
            </div>
            <div className="space-y-2.5 animate-pulse">
              <div className="h-4 bg-[#E2E8F0] rounded w-3/4" />
              <div className="h-4 bg-[#E2E8F0] rounded w-full" />
              <div className="h-4 bg-[#E2E8F0] rounded w-5/6" />
            </div>
          </div>
        ) : aiResult ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Testemunhos + Comandos Quânticos */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
                <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5">
                  Testemunhos Informacionais Calibrados
                </h3>
                <div className="space-y-3">
                  {aiResult.testemunhos.map((item, idx) => (
                    <div
                      key={`${item.geometria}-${idx}`}
                      className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                        <span className="font-semibold text-[#B45309]">{item.geometria}</span>
                        <span>{item.etapa}</span>
                      </div>
                      <p className="font-mono text-xs text-[#0F172A] break-words">
                        {item.testemunhoFormatado || fallbackTestemunho}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
                <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5">
                  Comandos Quânticos de Ativação
                </h3>
                <div className="space-y-4">
                  {aiResult.comandosQuanticos.map((cmd, idx) => (
                    <div
                      key={`${cmd.tituloComando}-${idx}`}
                      className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[#B45309]">
                            {cmd.geometria} · {cmd.etapa}
                          </p>
                          <h4 className="font-serif text-sm font-bold text-[#0F172A] mt-0.5">
                            {cmd.tituloComando}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand(cmd.comandoTexto, idx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#0F172A] bg-white border border-[#CBD5E1] rounded hover:border-[#D97706] cursor-pointer shrink-0"
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Check className="w-3 h-3 text-[#B45309]" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copiar
                            </>
                          )}
                        </button>
                      </div>
                      <p className="font-serif italic text-sm text-[#0F172A] leading-relaxed">
                        &ldquo;{cmd.comandoTexto}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Causa Raiz, Análise Psicossomática, Comparativo Evolutivo & Prescrições */}
            <div className="lg:col-span-5 space-y-6">
              {aiResult.analiseCausaRaiz && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-3">
                  <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5">
                    Análise da Causa Raiz (Órgãos × Chakras × Emoções)
                  </h3>
                  <p className="text-sm text-[#45464D] leading-relaxed whitespace-pre-line">
                    {aiResult.analiseCausaRaiz}
                  </p>
                </div>
              )}

              {aiResult.comparativoEvolutivo && aiResult.comparativoEvolutivo.trim() !== '' && (
                <div className="bg-[#FAF8F5] border border-[#D97706]/40 rounded-xl p-6 space-y-2.5">
                  <h3 className="font-serif text-base font-bold text-[#0F172A] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#B45309]" />
                    Comparativo Evolutivo (Antes × Depois)
                  </h3>
                  <p className="text-sm text-[#45464D] leading-relaxed whitespace-pre-line">
                    {aiResult.comparativoEvolutivo}
                  </p>
                </div>
              )}

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-3">
                <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5">
                  Análise Psicossomática Integrativa
                </h3>
                <p className="text-sm text-[#45464D] leading-relaxed whitespace-pre-line">
                  {aiResult.analisePsicossomatica}
                </p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
                <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2.5">
                  Prescrições Terapêuticas & Bons Hábitos
                </h3>

                <div>
                  <p className="text-xs font-semibold text-[#B45309] mb-1">Florais de Bach</p>
                  <ul className="text-xs text-[#45464D] space-y-1 list-disc list-inside">
                    {aiResult.prescricoes.floraisBach.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>

                {aiResult.prescricoes.cristais && aiResult.prescricoes.cristais.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#B45309] mb-1">
                      Cristais Terapêuticos
                    </p>
                    <ul className="text-xs text-[#45464D] space-y-1 list-disc list-inside">
                      {aiResult.prescricoes.cristais.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-[#B45309] mb-1">
                    Fitoterapia & Infusões
                  </p>
                  <ul className="text-xs text-[#45464D] space-y-1 list-disc list-inside">
                    {aiResult.prescricoes.fitoterapiaChas.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>

                {aiResult.prescricoes.bonsHabitos && aiResult.prescricoes.bonsHabitos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#B45309] mb-1">
                      Bons Hábitos Aferidos
                    </p>
                    <ul className="text-xs text-[#45464D] space-y-1 list-disc list-inside">
                      {aiResult.prescricoes.bonsHabitos.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-[#B45309] mb-1">
                    Frequências Solfeggio Indicadas
                  </p>
                  <ul className="text-xs text-[#45464D] space-y-1.5">
                    {aiResult.prescricoes.frequenciasSolfeggio.map((f) => (
                      <li key={`${f.hz}-${f.nome}`}>
                        <span className="font-semibold text-[#0F172A]">{f.nome}:</span>{' '}
                        {f.indicacao}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center space-y-3">
            <p className="font-serif text-base text-[#0F172A]">
              Motor de Ressonância pronto para síntese com a Ficha ANSAE/RHEN.
            </p>
            <button
              type="button"
              onClick={onRegenerateAI}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
              Gerar Diagnóstico Cruzado e Comandos via Gemini
            </button>
          </div>
        )}
      </section>

      {/* Console de Entrelaçamento & Sintetizador Solfeggio Web Audio API */}
      <section
        className={`rounded-xl p-6 sm:p-8 border transition-all ${
          isAnchored
            ? 'bg-white border-[#D97706] animate-resonance-halo'
            : 'bg-white border-[#E2E8F0] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]'
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Anchoring & Quantum Room State */}
          <div className="lg:col-span-6 space-y-4">
            {isAnchored ? (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-[#B45309]">
                  <Radio className="w-4 h-4 text-[#D97706]" />
                  <span>SALA QUÂNTICA ATIVA — EMANANDO EM RESSONÂNCIA HARMÔNICA</span>
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#0F172A]">
                  Onda Colapsada e Ancorada no Campo de Ponto Zero
                </h3>
                <p className="text-sm text-[#45464D] leading-relaxed">
                  A sessão de <strong className="text-[#0F172A]">{anamnesis.fullName}</strong> está
                  salva e ativa no Dashboard com cronômetro contínuo e prontuário ANSAE/RHEN.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onAnchorAndCollapse}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                    Atualizar Ancoramento na Sala
                  </button>
                  <button
                    type="button"
                    onClick={onGoToDocuments}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-[#B45309] bg-white border border-[#D97706] rounded-lg hover:bg-[#D97706]/5 cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-4 h-4" />
                    Gerar Documentos Oficiais
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
                  Entrelaçamento e Selamento
                </p>
                <h3 className="font-serif text-2xl font-bold text-[#0F172A]">
                  Pronto para Ativar a Sala Quântica
                </h3>
                <p className="text-sm text-[#45464D] leading-relaxed">
                  Leia o comando em voz clara com o testemunho posicionado na geometria da Etapa 1 e
                  realize o colapso de intenção abaixo para registrar a sala ativa no Dashboard.
                </p>
                <button
                  type="button"
                  onClick={onAnchorAndCollapse}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-4 text-sm font-bold tracking-wide text-white bg-[#0F172A] rounded-xl border border-white/10 hover:bg-[#1E293B] hover:shadow-[0_0_24px_rgba(217,119,6,0.35)] transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                  ANCORAR INTENÇÃO E COLAPSAR ONDA
                </button>
              </div>
            )}
          </div>

          {/* Right: Web Audio API Solfeggio Synthesizer */}
          <div className="lg:col-span-6 p-5 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#B45309]" />
                <h4 className="font-serif text-sm font-bold text-[#0F172A]">
                  Sintetizador Solfeggio (Web Audio API)
                </h4>
              </div>
              <span className="font-mono tabular-nums text-xs font-semibold text-[#B45309]">
                {selectedHz} Hz {isAudioPlaying ? '· Emissão Ativa' : '· Em Espera'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {SOLFEGGIO_OPTIONS.map((opt) => {
                const active = selectedHz === opt.hz;
                return (
                  <button
                    key={opt.hz}
                    type="button"
                    onClick={() => handleHzChange(opt.hz)}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0F172A] border-[#0F172A] text-white'
                        : 'bg-white border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706]'
                    }`}
                  >
                    <p className="font-mono tabular-nums text-xs font-bold">{opt.label}</p>
                    <p
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        active ? 'text-[#F59E0B]' : 'text-[#64748B]'
                      }`}
                    >
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-lg p-2">
              <canvas ref={canvasRef} width={440} height={54} className="w-full h-[54px]" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  isAudioPlaying
                    ? 'bg-[#B45309] text-white hover:bg-[#904d00]'
                    : 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                }`}
              >
                {isAudioPlaying ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    Pausar Frequência
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Reproduzir {selectedHz} Hz
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 flex-1 max-w-[200px]">
                <span className="text-[11px] font-medium text-[#64748B]">Volume</span>
                <input
                  aria-label="Volume do sintetizador Solfeggio"
                  type="range"
                  min={0.05}
                  max={0.6}
                  step={0.05}
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full clinical-slider"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
