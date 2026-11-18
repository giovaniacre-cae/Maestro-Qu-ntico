import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Gem, Plus, Search, Sparkles, X } from 'lucide-react';
import { CRYSTALS_CATALOG, getCrystalByName } from '../data/crystalsCatalog';
import {
  RADIONIC_GRAPHICS_CATALOG,
  RadionicGraphicEntry,
  findRadionicGraphic,
} from '../data/graphicsCatalog';
import { QuantumGeometry } from '../types/quantum';

export interface AddPendulatedChartPayload {
  geometry: QuantumGeometry;
  stageTag: 'stage1' | 'stage2' | 'single';
  crystalName: string;
}

interface AddPendulatedChartPanelProps {
  protocolMode: 'escalonado' | 'direto';
  onAddChart: (payload: AddPendulatedChartPayload) => void;
}

export const PendulumIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="4" r="1.5" />
    <line x1="12" y1="5.5" x2="12" y2="12" />
    <path d="M9 12h6l-3 9-3-9z" fill="currentColor" fillOpacity="0.25" />
  </svg>
);

export const AddPendulatedChartPanel: React.FC<AddPendulatedChartPanelProps> = ({
  protocolMode,
  onAddChart,
}) => {
  const [selectedGraphicName, setSelectedGraphicName] = useState<string>(
    RADIONIC_GRAPHICS_CATALOG[0].name
  );
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customGraphicName, setCustomGraphicName] = useState<string>('');
  const [graphicOpen, setGraphicOpen] = useState<boolean>(false);
  const [graphicSearch, setGraphicSearch] = useState<string>('');

  const [selectedCrystalName, setSelectedCrystalName] = useState<string>('Nenhum');
  const [crystalOpen, setCrystalOpen] = useState<boolean>(false);
  const [crystalSearch, setCrystalSearch] = useState<string>('');

  const [stageTag, setStageTag] = useState<'stage1' | 'stage2' | 'single'>(
    protocolMode === 'escalonado' ? 'stage1' : 'single'
  );
  const [customFocus, setCustomFocus] = useState<string>('');
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

  const graphicRef = useRef<HTMLDivElement | null>(null);
  const graphicSearchRef = useRef<HTMLInputElement | null>(null);
  const crystalRef = useRef<HTMLDivElement | null>(null);
  const crystalSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setStageTag(protocolMode === 'escalonado' ? 'stage1' : 'single');
  }, [protocolMode]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (graphicRef.current && !graphicRef.current.contains(e.target as Node)) {
        setGraphicOpen(false);
      }
      if (crystalRef.current && !crystalRef.current.contains(e.target as Node)) {
        setCrystalOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGraphicOpen(false);
        setCrystalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  useEffect(() => {
    if (graphicOpen) {
      setTimeout(() => graphicSearchRef.current?.focus(), 20);
    } else {
      setGraphicSearch('');
    }
  }, [graphicOpen]);

  useEffect(() => {
    if (crystalOpen) {
      setTimeout(() => crystalSearchRef.current?.focus(), 20);
    } else {
      setCrystalSearch('');
    }
  }, [crystalOpen]);

  const filteredGraphics = useMemo(() => {
    const q = graphicSearch
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!q) return RADIONIC_GRAPHICS_CATALOG;
    return RADIONIC_GRAPHICS_CATALOG.filter((g) => {
      const hay = `${g.name} ${g.categoryLabel} ${g.purpose}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return hay.includes(q);
    });
  }, [graphicSearch]);

  const filteredCrystals = useMemo(() => {
    const q = crystalSearch
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!q) return CRYSTALS_CATALOG;
    return CRYSTALS_CATALOG.filter((c) => {
      const hay = `${c.name} ${c.purpose} ${c.chakra}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return hay.includes(q);
    });
  }, [crystalSearch]);

  const activeCatalogGraphic: RadionicGraphicEntry | undefined = findRadionicGraphic(
    selectedGraphicName
  );
  const activeCrystalEntry = getCrystalByName(selectedCrystalName) || CRYSTALS_CATALOG[0];

  const handleSelectGraphic = (entry: RadionicGraphicEntry) => {
    setIsCustomMode(false);
    setSelectedGraphicName(entry.name);
    setGraphicOpen(false);
    if (protocolMode === 'escalonado') {
      setStageTag(
        entry.protocolCategory === 'assepsia' || entry.protocolCategory === 'protecao'
          ? 'stage1'
          : 'stage2'
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = isCustomMode ? customGraphicName.trim() : selectedGraphicName.trim();
    if (!finalName) return;

    const matched = findRadionicGraphic(finalName);
    const trimmedFocus = customFocus.trim();
    const cleanCrystal =
      selectedCrystalName && selectedCrystalName !== 'Nenhum' ? selectedCrystalName : '';

    const geometry: QuantumGeometry = {
      id: `therapist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: matched ? matched.name : finalName,
      category: matched
        ? matched.protocolCategory
        : stageTag === 'stage1'
        ? 'assepsia'
        : 'harmonia',
      role: matched
        ? matched.purpose
        : `Gráfico radiônico pendulado diretamente pelo terapeuta${
            trimmedFocus ? ` com direcionamento para ${trimmedFocus}` : ''
          }.`,
      durationHint: matched
        ? matched.defaultDuration
        : stageTag === 'stage1'
        ? '48h a 72h'
        : '7 a 10 dias',
      source: 'therapist',
      ...(trimmedFocus ? { customFocus: trimmedFocus } : {}),
      ...(cleanCrystal ? { anchoredCrystal: cleanCrystal } : {}),
    };

    onAddChart({
      geometry,
      stageTag,
      crystalName: cleanCrystal,
    });

    setAddedFeedback(
      `${geometry.name}${cleanCrystal ? ` + ${cleanCrystal}` : ''} adicionado com testemunho e comando!`
    );
    setCustomFocus('');
    if (isCustomMode) {
      setCustomGraphicName('');
    }
    setTimeout(() => setAddedFeedback(null), 3200);
  };

  const canSubmit = isCustomMode ? customGraphicName.trim().length > 0 : Boolean(selectedGraphicName);

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 rounded-xl bg-[#FAF8F5] border-2 border-[#B45309] shadow-[0_6px_24px_-4px_rgba(180,83,9,0.12)] space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#0F172A] text-[#F59E0B]">
            <PendulumIcon className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-serif text-base font-bold text-[#0F172A]">
              + Incluir Gráfico Pendulado pelo Terapeuta
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Adicione gráficos aferidos no pêndulo durante a sessão com cristal potencializador,
              testemunho e comando automático
            </p>
          </div>
        </div>
        {addedFeedback && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F0FDF4] border border-[#16A34A]/40 text-[11px] font-semibold text-[#15803D]">
            <Check className="w-3.5 h-3.5" />
            {addedFeedback}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Campo 1 — Gráfico Radiônico */}
        <div ref={graphicRef} className="lg:col-span-5 space-y-1.5 relative">
          <label className="block text-[11px] font-semibold text-[#0F172A]">
            1. Gráfico Radiônico (Catálogo ou Personalizado)
          </label>
          <button
            type="button"
            onClick={() => {
              setGraphicOpen((prev) => !prev);
              setCrystalOpen(false);
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs bg-white border border-[#CBD5E1] rounded-lg hover:border-[#B45309] focus:outline-none focus:border-[#B45309] cursor-pointer"
          >
            <span className="truncate font-medium text-[#0F172A]">
              {isCustomMode
                ? customGraphicName.trim()
                  ? `Personalizado: ${customGraphicName}`
                  : 'Outro gráfico (digite o nome abaixo)...'
                : activeCatalogGraphic
                ? `${activeCatalogGraphic.name} — ${activeCatalogGraphic.categoryLabel}`
                : selectedGraphicName}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${
                graphicOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {graphicOpen && (
            <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-[#CBD5E1] rounded-lg shadow-[0_14px_32px_-4px_rgba(15,23,42,0.2)] overflow-hidden">
              <div className="p-2 border-b border-[#E2E8F0] bg-[#FAF8F5] flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                <input
                  ref={graphicSearchRef}
                  type="text"
                  value={graphicSearch}
                  onChange={(e) => setGraphicSearch(e.target.value)}
                  placeholder="Buscar por nome, finalidade ou categoria..."
                  className="w-full text-xs bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
                />
                {graphicSearch && (
                  <button
                    type="button"
                    onClick={() => setGraphicSearch('')}
                    className="p-0.5 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(true);
                    setGraphicOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 hover:bg-[#FEFCE8] cursor-pointer ${
                    isCustomMode ? 'bg-[#FEFCE8]' : 'bg-white'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-[#B45309]">
                      + Outro gráfico (digitar nome personalizado)...
                    </p>
                    <p className="text-[10px] text-[#64748B]">
                      Caso o gráfico pendulado não esteja no catálogo padrão
                    </p>
                  </div>
                  {isCustomMode && <Check className="w-3.5 h-3.5 text-[#B45309] shrink-0" />}
                </button>

                {filteredGraphics.length > 0 ? (
                  filteredGraphics.map((g) => {
                    const isSelected = !isCustomMode && selectedGraphicName === g.name;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleSelectGraphic(g)}
                        className={`w-full px-3 py-2 text-left text-xs flex items-start justify-between gap-2 hover:bg-[#FAF8F5] cursor-pointer ${
                          isSelected ? 'bg-[#FEFCE8]' : 'bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#0F172A]">{g.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                              {g.categoryLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] truncate mt-0.5">{g.purpose}</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#B45309] shrink-0 mt-0.5" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3 text-center space-y-2">
                    <p className="text-xs text-[#64748B]">
                      Nenhum gráfico encontrado para &ldquo;{graphicSearch}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomMode(true);
                        setCustomGraphicName(graphicSearch.trim());
                        setGraphicOpen(false);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#B45309] bg-[#FEFCE8] border border-[#D97706]/40 rounded cursor-pointer"
                    >
                      Usar &ldquo;{graphicSearch.trim()}&rdquo; como personalizado
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {isCustomMode && (
            <input
              type="text"
              value={customGraphicName}
              onChange={(e) => setCustomGraphicName(e.target.value)}
              placeholder="Digite o nome do gráfico pendulado..."
              className="mt-1.5 w-full px-3 py-2 text-xs bg-white border border-[#B45309]/60 rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
            />
          )}
        </div>

        {/* Campo 2 — Cristal Potencializador (Opcional) */}
        <div ref={crystalRef} className="lg:col-span-4 space-y-1.5 relative">
          <label className="block text-[11px] font-semibold text-[#0F172A]">
            2. Cristal Potencializador (Opcional)
          </label>
          <button
            type="button"
            onClick={() => {
              setCrystalOpen((prev) => !prev);
              setGraphicOpen(false);
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs bg-white border border-[#CBD5E1] rounded-lg hover:border-[#B45309] focus:outline-none focus:border-[#B45309] cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5 truncate text-[#0F172A] font-medium">
              <Gem className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
              <span className="truncate">{activeCrystalEntry.displayLabel}</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${
                crystalOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {crystalOpen && (
            <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-[#CBD5E1] rounded-lg shadow-[0_14px_32px_-4px_rgba(15,23,42,0.2)] overflow-hidden">
              <div className="p-2 border-b border-[#E2E8F0] bg-[#FAF8F5] flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                <input
                  ref={crystalSearchRef}
                  type="text"
                  value={crystalSearch}
                  onChange={(e) => setCrystalSearch(e.target.value)}
                  placeholder="Buscar cristal, finalidade ou chakra..."
                  className="w-full text-xs bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
                />
                {crystalSearch && (
                  <button
                    type="button"
                    onClick={() => setCrystalSearch('')}
                    className="p-0.5 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-[#F1F5F9]">
                {filteredCrystals.map((c) => {
                  const isSelected = activeCrystalEntry.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCrystalName(c.name);
                        setCrystalOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs flex items-start justify-between gap-2 hover:bg-[#FAF8F5] cursor-pointer ${
                        isSelected ? 'bg-[#FEFCE8]' : 'bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#0F172A] truncate">{c.name}</p>
                        <p className="text-[11px] text-[#64748B] truncate">
                          {c.purpose}
                          {c.id !== 'nenhum' ? ` · ${c.chakra}` : ''}
                        </p>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#B45309] shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Campo 4 — Foco Específico (Opcional) */}
        <div className="lg:col-span-3 space-y-1.5">
          <label
            htmlFor="pendulated-custom-focus"
            className="block text-[11px] font-semibold text-[#0F172A]"
          >
            4. Foco Específico (Opcional)
          </label>
          <input
            id="pendulated-custom-focus"
            type="text"
            value={customFocus}
            onChange={(e) => setCustomFocus(e.target.value)}
            placeholder="Ex.: Regeneração renal, Corte de implantes..."
            className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#B45309]"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        {/* Campo 3 — Etapa de Ativação */}
        <div className="space-y-1">
          <span className="block text-[11px] font-semibold text-[#0F172A]">
            3. Etapa de Ativação
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'stage1', label: 'Etapa 1 — Limpeza/Proteção' },
                { id: 'stage2', label: 'Etapa 2 — Regeneração/Vitalidade' },
                { id: 'single', label: 'Etapa Única' },
              ] as const
            ).map((opt) => {
              const active = stageTag === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStageTag(opt.id)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-white text-[#45464D] border-[#CBD5E1] hover:border-[#B45309]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 rounded-lg border border-[#B45309]/40 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4 text-[#F59E0B]" />
          <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Adicionar ao Protocolo e Gerar Comando</span>
        </button>
      </div>
    </form>
  );
};
