import React, { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Edit3,
  FlaskConical,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ClinicalAnsaeRhenSheet } from '../types/clinical';
import {
  EnergeticRemedyCategory,
  EnergeticRemedyEmission,
  EnergeticRemedyEmitterGraph,
  PatientAnamnesis,
  QuantumGenerationResult,
} from '../types/quantum';
import {
  EMITTER_GRAPH_OPTIONS,
  ENERGETIC_REMEDY_CATEGORIES,
  REMEDY_CATALOG_BY_CATEGORY,
  REMEDY_DURATION_PRESETS,
  buildEnergeticRemedyCommand,
  buildEnergeticRemedyTestimony,
  formatRemedyDurationLabel,
} from '../utils/energeticRemedies';

interface EnergeticRemedyEmitterPanelProps {
  anamnesis: PatientAnamnesis;
  ansaeSheet?: ClinicalAnsaeRhenSheet;
  aiResult: QuantumGenerationResult | null;
  selectedFlorals?: string[];
  selectedHerbs?: string[];
  remedies: EnergeticRemedyEmission[];
  onAddRemedy: (remedy: EnergeticRemedyEmission) => void;
  onUpdateRemedy: (id: string, patch: Partial<EnergeticRemedyEmission>) => void;
  onRemoveRemedy: (id: string) => void;
}

export const EnergeticRemedyEmitterPanel: React.FC<EnergeticRemedyEmitterPanelProps> = ({
  anamnesis,
  ansaeSheet,
  aiResult,
  selectedFlorals = [],
  selectedHerbs = [],
  remedies,
  onAddRemedy,
  onUpdateRemedy,
  onRemoveRemedy,
}) => {
  const [category, setCategory] = useState<EnergeticRemedyCategory>('Florais de Bach');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [customItemText, setCustomItemText] = useState<string>('');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [emitterGraph, setEmitterGraph] =
    useState<EnergeticRemedyEmitterGraph>('Decágono Duplo + SCAP');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('72h');
  const [customDurationValue, setCustomDurationValue] = useState<number>(48);
  const [customDurationUnit, setCustomDurationUnit] = useState<'hours' | 'days'>('hours');
  const [dosageInstruction, setDosageInstruction] = useState<string>(
    'Emissão contínua 24h durante 3 dias (72 horas) via campo quântico'
  );
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [editingCommandText, setEditingCommandText] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Pull items already indicated in Sensitivity/Biometers/AI prescriptions
  const evaluatedSuggestions = useMemo(() => {
    const items = new Set<string>();

    if (category === 'Florais de Bach') {
      selectedFlorals.forEach((f) => items.add(f.split(' (')[0].trim()));
      (aiResult?.prescricoes?.floraisBach || []).forEach((f) =>
        items.add(f.split(' (')[0].trim())
      );
      (ansaeSheet?.biometerReadings || []).forEach((b) => {
        if (
          b.biometerName.toLowerCase().includes('florais') ||
          b.biometerId === 'bio-12' ||
          b.biometerId === 'bio-09'
        ) {
          items.add(b.selectedItem);
        }
      });
    } else if (category === 'Fitoterapia & Chás') {
      selectedHerbs.forEach((h) => items.add(h.split(' (')[0].trim()));
      (aiResult?.prescricoes?.fitoterapiaChas || []).forEach((h) =>
        items.add(h.split(' (')[0].trim())
      );
    } else if (category === 'Frequências & Cromoterapia') {
      (ansaeSheet?.auricField?.missingColors || []).forEach((c) =>
        items.add(`Luz ${c} (Reposição Cromática Áurica)`)
      );
      (aiResult?.prescricoes?.frequenciasSolfeggio || []).forEach((f) =>
        items.add(f.nome)
      );
    } else if (category === 'Suplementos / Oligoelementos') {
      (ansaeSheet?.biometerReadings || []).forEach((b) => {
        if (
          b.biometerName.toLowerCase().includes('hormôn') ||
          b.biometerName.toLowerCase().includes('saúde')
        ) {
          items.add(b.selectedItem);
        }
      });
    }

    return Array.from(items).filter(Boolean);
  }, [aiResult, ansaeSheet, category, selectedFlorals, selectedHerbs]);

  const catalogOptions = useMemo(() => {
    const base = REMEDY_CATALOG_BY_CATEGORY[category] || [];
    const merged = Array.from(new Set([...evaluatedSuggestions, ...base]));
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((item) => item.toLowerCase().includes(q));
  }, [catalogSearch, category, evaluatedSuggestions]);

  const resolvedDurationHours = useMemo(() => {
    if (selectedPresetId === 'custom') {
      const safeVal = Math.max(0.25, Number(customDurationValue) || 1);
      return customDurationUnit === 'days' ? safeVal * 24 : safeVal;
    }
    const found = REMEDY_DURATION_PRESETS.find((p) => p.id === selectedPresetId);
    return found ? found.durationHours : 72;
  }, [customDurationUnit, customDurationValue, selectedPresetId]);

  const toggleSuggestedItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleAddCustomItem = () => {
    const clean = customItemText.trim();
    if (!clean) return;
    const parts = clean
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setSelectedItems((prev) => Array.from(new Set([...prev, ...parts])));
    setCustomItemText('');
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'custom') {
      setDosageInstruction(
        `Emissão contínua por ${customDurationValue} ${
          customDurationUnit === 'days' ? 'dia(s)' : 'hora(s)'
        } via campo quântico`
      );
      return;
    }
    const found = REMEDY_DURATION_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setDosageInstruction(found.dosageInstruction);
    }
  };

  const handleActivateRemedy = () => {
    const draftItems = [...selectedItems];
    if (customItemText.trim()) {
      customItemText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((p) => {
          if (!draftItems.includes(p)) draftItems.push(p);
        });
    }

    if (draftItems.length === 0) {
      setFormNotice(
        'Selecione pelo menos 1 item sugerido ou digite o nome do remédio/fórmula antes de ativar o envio.'
      );
      return;
    }

    const cleanDosage =
      dosageInstruction.trim() ||
      `Emissão contínua por ${formatRemedyDurationLabel(resolvedDurationHours)} via campo quântico`;

    const testimonyText = buildEnergeticRemedyTestimony({
      items: draftItems,
      emitterGraph,
      anamnesis,
    });

    const activationCommand = buildEnergeticRemedyCommand({
      category,
      items: draftItems,
      emitterGraph,
      durationHours: resolvedDurationHours,
      dosageInstruction: cleanDosage,
      anamnesis,
      ansaeSheet,
    });

    const newEmission: EnergeticRemedyEmission = {
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      items: draftItems,
      emitterGraph,
      durationHours: resolvedDurationHours,
      dosageInstruction: cleanDosage,
      testimonyText,
      activationCommand,
      isActive: true,
      activatedAt: new Date().toISOString(),
    };

    onAddRemedy(newEmission);
    setSelectedItems([]);
    setCustomItemText('');
    setFormNotice(
      `Fórmula "${draftItems.join(' + ')}" materializada e em transmissão ativa via ${emitterGraph}.`
    );
    setTimeout(() => setFormNotice(null), 4000);
  };

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const activeCount = remedies.filter((r) => r.isActive).length;

  return (
    <section className="rounded-xl border-2 border-[#B45309]/50 bg-white shadow-[0_6px_28px_-4px_rgba(15,23,42,0.08)] overflow-hidden">
      {/* Lab Header in Deep Navy & Gold */}
      <div className="bg-[#0F172A] text-white px-6 py-5 border-b border-[#B45309]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#B45309]/20 border border-[#D97706]/50 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-[#F59E0B]">
              Estação Radiônica Complementar · Decágono Duplo & SCAP Cabalístico
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-bold text-white">
              Emissor de Medicamentos Energéticos & Remédios Sutis (Radionics)
            </h2>
            <p className="mt-1 text-xs text-slate-300 max-w-2xl">
              Gere o testemunho informacional e transmita florais, fitoterápicos, sais de Schüssler,
              oligoelementos ou frequências cromáticas diretamente pelo campo quântico sem efeitos
              colaterais materiais.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3 bg-[#1E293B] border border-[#B45309]/40 rounded-lg px-4 py-2.5">
          <Radio
            className={`w-4 h-4 ${
              activeCount > 0 ? 'text-[#F59E0B] animate-pulse' : 'text-slate-400'
            }`}
          />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              Emissões Paralelas
            </p>
            <p className="font-mono tabular-nums text-sm font-bold text-white">
              {activeCount} ativa{activeCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {/* Builder Controls */}
      <div className="p-6 space-y-6 bg-[#FAF8F5]">
        {/* 1. Category Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            1. Categoria do Remédio Sutil / Informacional
          </label>
          <div className="flex flex-wrap gap-2">
            {ENERGETIC_REMEDY_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    setCatalogSearch('');
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-white text-[#45464D] border-[#CBD5E1] hover:border-[#B45309] hover:text-[#0F172A]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Clickable Suggestions + Custom Free Text */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#0F172A]">
                2. Composição da Fórmula ({category})
              </p>
              <p className="text-[11px] text-[#64748B]">
                Clique nos itens aferidos/sugeridos ou digite fórmulas compostas personalizadas
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder={`Filtrar ${category}...`}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
              />
            </div>
          </div>

          {evaluatedSuggestions.length > 0 && (
            <div className="p-3 rounded-lg bg-[#FEFCE8] border border-[#D97706]/30 space-y-1.5">
              <p className="text-[11px] font-bold text-[#B45309]">
                Sugeridos / Aferidos na Avaliação Atual:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {evaluatedSuggestions.map((item) => {
                  const isSelected = selectedItems.includes(item);
                  return (
                    <button
                      key={`eval-${item}`}
                      type="button"
                      onClick={() => toggleSuggestedItem(item)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#0F172A] text-white border-[#0F172A]'
                          : 'bg-white text-[#92400E] border-[#D97706]/50 hover:border-[#B45309]'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catalog Grid */}
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
            {catalogOptions.map((item) => {
              const isSelected = selectedItems.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleSuggestedItem(item)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F172A] text-white border-[#0F172A] font-semibold'
                      : 'bg-[#FAF8F5] text-[#334155] border-[#E2E8F0] hover:border-[#B45309]'
                  }`}
                >
                  {isSelected ? '✓ ' : ''}
                  {item}
                </button>
              );
            })}
          </div>

          {/* Free Text Custom Remedy */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#E2E8F0]">
            <input
              type="text"
              value={customItemText}
              onChange={(e) => setCustomItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomItem();
                }
              }}
              placeholder="Digite qualquer remédio, fórmula floral composta, sal de Schüssler ou princípio ativo pendulado..."
              className="flex-1 px-3.5 py-2 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
            />
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#B45309] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#B45309]" />
              Adicionar Item
            </button>
          </div>

          {/* Currently Composed Items */}
          {selectedItems.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#0F172A]">Itens na fórmula:</span>
              {selectedItems.map((item) => (
                <span
                  key={`sel-${item}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-[#0F172A] text-white rounded-md"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => toggleSuggestedItem(item)}
                    aria-label={`Remover ${item}`}
                    className="text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 3. Emitter Graph & 4. Duration / Posology */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Emitter Graph */}
          <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
            <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              3. Gráfico Emissor Radionics
            </label>
            <div className="space-y-2">
              {EMITTER_GRAPH_OPTIONS.map((opt) => {
                const active = emitterGraph === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setEmitterGraph(opt.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-[#FAF8F5] text-[#0F172A] border-[#E2E8F0] hover:border-[#B45309]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-serif text-sm font-bold">{opt.label}</span>
                      {active && (
                        <span className="text-[10px] font-semibold text-[#F59E0B] uppercase tracking-wider">
                          Selecionado
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        active ? 'text-slate-300' : 'text-[#64748B]'
                      }`}
                    >
                      {opt.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration & Posology */}
          <div className="lg:col-span-6 bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3.5">
            <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              4. Tempo de Emissão & Posologia Sutil
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REMEDY_DURATION_PRESETS.map((preset) => {
                const active = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#B45309] text-white border-[#B45309]'
                        : 'bg-[#FAF8F5] text-[#334155] border-[#E2E8F0] hover:border-[#B45309]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-colors cursor-pointer ${
                  selectedPresetId === 'custom'
                    ? 'bg-[#B45309] text-white border-[#B45309]'
                    : 'bg-[#FAF8F5] text-[#334155] border-[#E2E8F0] hover:border-[#B45309]'
                }`}
              >
                Personalizado...
              </button>
            </div>

            {selectedPresetId === 'custom' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={customDurationValue}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 1);
                    setCustomDurationValue(val);
                    setDosageInstruction(
                      `Emissão contínua por ${val} ${
                        customDurationUnit === 'days' ? 'dia(s)' : 'hora(s)'
                      } via campo quântico`
                    );
                  }}
                  aria-label="Valor personalizado de duração"
                  className="w-24 px-3 py-1.5 text-xs font-mono tabular-nums bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
                />
                <select
                  aria-label="Unidade de tempo da emissão"
                  value={customDurationUnit}
                  onChange={(e) => {
                    const nextUnit = e.target.value as 'hours' | 'days';
                    setCustomDurationUnit(nextUnit);
                    setDosageInstruction(
                      `Emissão contínua por ${customDurationValue} ${
                        nextUnit === 'days' ? 'dia(s)' : 'hora(s)'
                      } via campo quântico`
                    );
                  }}
                  className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
                >
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#45464D]">
                Posologia Sutil / Regime de Envio
              </label>
              <input
                type="text"
                value={dosageInstruction}
                onChange={(e) => setDosageInstruction(e.target.value)}
                placeholder="Ex.: Emissão contínua 24h via campo quântico"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
              />
            </div>

            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[11px] font-mono tabular-nums text-[#64748B]">
                Duração programada:{' '}
                <strong className="text-[#0F172A]">
                  {formatRemedyDurationLabel(resolvedDurationHours)}
                </strong>
              </span>
              <button
                type="button"
                onClick={handleActivateRemedy}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] border border-[#B45309]/50 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                Gerar Fórmula Quântica e Ativar Envio
              </button>
            </div>
          </div>
        </div>

        {formNotice && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-white border border-[#B45309]/50 text-xs font-medium text-[#0F172A]"
          >
            {formNotice}
          </div>
        )}

        {/* Active / Paused Energetic Remedies List */}
        <div className="space-y-4 pt-2 border-t border-[#E2E8F0]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-serif text-base font-bold text-[#0F172A]">
              Remédios Sutis Programados para {anamnesis.fullName || 'o Interagente'} (
              {remedies.length})
            </h3>
            <span className="text-xs text-[#64748B]">
              Salvos automaticamente no prontuário e incluídos nos relatórios DOCX / PDF
            </span>
          </div>

          {remedies.length === 0 ? (
            <div className="bg-white border border-dashed border-[#CBD5E1] rounded-xl p-6 text-center space-y-1.5">
              <p className="font-serif text-sm font-semibold text-[#0F172A]">
                Nenhum medicamento energético em emissão para este atendimento.
              </p>
              <p className="text-xs text-[#64748B]">
                Selecione os florais, fitoterápicos, oligoelementos ou frequências acima e clique
                em &ldquo;Gerar Fórmula Quântica e Ativar Envio&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {remedies.map((rem) => {
                const isEditing = editingCommandId === rem.id;
                return (
                  <article
                    key={rem.id}
                    className={`rounded-xl bg-white border p-5 space-y-4 transition-all ${
                      rem.isActive
                        ? 'border-[#B45309]/60 shadow-[0_4px_20px_-2px_rgba(180,83,9,0.12)]'
                        : 'border-[#E2E8F0] opacity-80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {rem.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0F172A] text-white text-[11px] font-semibold">
                              <Radio className="w-3.5 h-3.5 text-[#F59E0B] animate-pulse" />
                              Transmitindo via {rem.emitterGraph}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E2E8F0] text-[#45464D] text-[11px] font-semibold">
                              Emissão Pausada ({rem.emitterGraph})
                            </span>
                          )}
                          <span className="text-xs font-semibold text-[#B45309]">
                            {rem.category}
                          </span>
                          <span aria-hidden="true" className="text-[#CBD5E1]">
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-[#45464D]">
                            <Clock className="w-3.5 h-3.5 text-[#B45309]" />
                            {formatRemedyDurationLabel(rem.durationHours)}
                          </span>
                        </div>

                        <h4 className="font-serif text-lg font-bold text-[#0F172A]">
                          {rem.items.join(' + ')}
                        </h4>
                        <p className="text-xs text-[#64748B]">{rem.dosageInstruction}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateRemedy(rem.id, { isActive: !rem.isActive })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg hover:border-[#B45309] cursor-pointer whitespace-nowrap"
                        >
                          {rem.isActive ? (
                            <>
                              <Pause className="w-3.5 h-3.5 text-[#B45309]" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-[#16A34A]" />
                              Reativar
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveRemedy(rem.id)}
                          aria-label={`Remover medicamento ${rem.items.join(' + ')}`}
                          title="Remover fórmula energética"
                          className="p-2 text-[#64748B] hover:text-[#BA1A1A] hover:bg-[#FAF8F5] border border-[#E2E8F0] rounded-lg cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Testemunho Informacional */}
                    <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#B45309]">
                          Testemunho Informacional do Remédio
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(rem.testimonyText, `test-${rem.id}`)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#45464D] hover:text-[#0F172A] cursor-pointer"
                        >
                          {copiedKey === `test-${rem.id}` ? (
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
                      <p className="font-mono text-xs text-[#0F172A] break-words">
                        {rem.testimonyText}
                      </p>
                    </div>

                    {/* Comando Quântico de Materialização e Envio */}
                    <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F172A]">
                          Comando Quântico de Materialização e Envio
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingCommandId(null);
                              } else {
                                setEditingCommandId(rem.id);
                                setEditingCommandText(rem.activationCommand);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309] hover:text-[#0F172A] cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            {isEditing ? 'Cancelar' : 'Editar Comando'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyText(rem.activationCommand, `cmd-${rem.id}`)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#45464D] hover:text-[#0F172A] cursor-pointer"
                          >
                            {copiedKey === `cmd-${rem.id}` ? (
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
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            rows={4}
                            value={editingCommandText}
                            onChange={(e) => setEditingCommandText(e.target.value)}
                            className="w-full p-2.5 text-xs bg-white border border-[#B45309] rounded-lg text-[#0F172A] focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingCommandId(null)}
                              className="px-3 py-1.5 text-xs font-medium text-[#64748B] bg-white border border-[#CBD5E1] rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateRemedy(rem.id, {
                                  activationCommand: editingCommandText.trim() || rem.activationCommand,
                                });
                                setEditingCommandId(null);
                              }}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer"
                            >
                              Salvar Comando
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="font-serif italic text-sm text-[#0F172A] leading-relaxed">
                          &ldquo;{rem.activationCommand}&rdquo;
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
