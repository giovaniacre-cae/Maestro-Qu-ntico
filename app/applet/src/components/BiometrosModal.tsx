import React, { useEffect, useMemo, useState } from 'react';
import { Check, Compass, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import {
  BiometerDefinition,
  HAWKINS_SCALE_TABLE,
  getHawkinsEntryByHz,
} from '../types/clinical';
import { BUILTIN_32_BIOMETERS } from '../data/biometrosData';
import { formatBirthDateBR } from '../utils/antiCatharsis';

interface BiometrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  birthDate: string;
  customBiometers: BiometerDefinition[];
  onSaveCustomBiometer: (biometer: BiometerDefinition) => void;
  onDeleteCustomBiometer: (id: string) => void;
  onRecordReading?: (biometer: BiometerDefinition, selectedItem: string) => void;
  currentHawkinsHz?: number;
  onSelectHawkinsHz?: (hz: number) => void;
}

const CATEGORY_FILTERS: Array<'Todos' | BiometerDefinition['category']> = [
  'Todos',
  'Triagem & Geral',
  'Chakras & Corpos Sutis',
  'Saúde Física & ANSAE',
  'Emocional, Mental & Consciência',
  'Prosperidade & Hábitos',
  'Protocolos & Terapêuticas',
  'Florais & Terapias',
  'Personalizado',
];

export const BiometrosModal: React.FC<BiometrosModalProps> = ({
  isOpen,
  onClose,
  patientName,
  birthDate,
  customBiometers,
  onSaveCustomBiometer,
  onDeleteCustomBiometer,
  onRecordReading,
  currentHawkinsHz,
  onSelectHawkinsHz,
}) => {
  const allBiometers = useMemo(
    () => [...BUILTIN_32_BIOMETERS, ...customBiometers],
    [customBiometers]
  );

  const [selectedId, setSelectedId] = useState<string>(BUILTIN_32_BIOMETERS[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | BiometerDefinition['category']>(
    'Todos'
  );
  const [selectedSectorIndex, setSelectedSectorIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showCustomCreator, setShowCustomCreator] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customItemsText, setCustomItemsText] = useState<string>('');
  const [recordedNotice, setRecordedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedId === 'bio-10' && typeof currentHawkinsHz === 'number') {
      const entry = getHawkinsEntryByHz(currentHawkinsHz);
      const idx = HAWKINS_SCALE_TABLE.findIndex((item) => item.hz === entry.hz);
      if (idx >= 0) {
        setSelectedSectorIndex(idx);
      }
    }
  }, [isOpen, selectedId, currentHawkinsHz]);

  if (!isOpen) return null;

  const filteredBiometers = allBiometers.filter((b) => {
    const matchesCat = categoryFilter === 'Todos' || b.category === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      String(b.number).includes(q);
    return matchesCat && matchesSearch;
  });

  const activeBiometer =
    allBiometers.find((b) => b.id === selectedId) || allBiometers[0];

  const items = activeBiometer.items;
  const safeIdx = Math.min(selectedSectorIndex, Math.max(0, items.length - 1));
  const selectedItem = items[safeIdx] || '';

  const handleSelectBiometer = (bio: BiometerDefinition) => {
    setSelectedId(bio.id);
    setZoomLevel(1);
    if (bio.id === 'bio-10' && typeof currentHawkinsHz === 'number') {
      const entry = getHawkinsEntryByHz(currentHawkinsHz);
      const idx = HAWKINS_SCALE_TABLE.findIndex((item) => item.hz === entry.hz);
      setSelectedSectorIndex(idx >= 0 ? idx : 0);
    } else {
      setSelectedSectorIndex(0);
    }
    setShowCustomCreator(false);
    setRecordedNotice(null);
  };

  const handlePickSector = (idx: number) => {
    setSelectedSectorIndex(idx);
    if (activeBiometer.id === 'bio-10' && onSelectHawkinsHz) {
      const entry = HAWKINS_SCALE_TABLE[idx];
      if (entry) {
        onSelectHawkinsHz(entry.hz);
      }
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedItems = customItemsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!customName.trim() || parsedItems.length < 2) return;

    const newBio: BiometerDefinition = {
      id: `custom-${Date.now()}`,
      number: allBiometers.length + 1,
      name: customName.trim(),
      category: 'Personalizado',
      description: 'Biômetro personalizado criado pelo terapeuta para aferição direta.',
      items: parsedItems,
      isCustom: true,
    };

    onSaveCustomBiometer(newBio);
    setSelectedId(newBio.id);
    setSelectedSectorIndex(0);
    setCustomName('');
    setCustomItemsText('');
    setShowCustomCreator(false);
  };

  const handleConfirmReading = () => {
    if (activeBiometer.id === 'bio-10' && onSelectHawkinsHz) {
      const entry = HAWKINS_SCALE_TABLE[safeIdx];
      if (entry) {
        onSelectHawkinsHz(entry.hz);
      }
    }
    if (onRecordReading && selectedItem) {
      onRecordReading(activeBiometer, selectedItem);
      setRecordedNotice(`Registrado: ${activeBiometer.name} → ${selectedItem}`);
      setTimeout(() => setRecordedNotice(null), 2600);
    }
  };

  const birthShort = formatBirthDateBR(birthDate);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Biblioteca de 32 Biômetros Radiestésicos Oficiais"
    >
      <div className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl max-w-[1320px] w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-[#B45309] shrink-0" />
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#0F172A]">
                Biblioteca de 32 Biômetros Radiestésicos Oficiais (Padrão Maestro)
              </h2>
              <p className="text-xs text-[#64748B]">
                Testemunho ativo: <strong className="text-[#0F172A]">{patientName || 'Paciente'}</strong>{' '}
                {birthShort ? `· ${birthShort}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCustomCreator((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#F59E0B]" />
              + Criar Biômetro Personalizado
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar biblioteca de biômetros"
              className="p-2 text-[#64748B] hover:text-[#0F172A] rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Sidebar: Biometers List */}
          <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-white p-4 flex flex-col gap-3 overflow-y-auto max-h-[300px] lg:max-h-none">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar biômetro (ex.: Chakras, Bach, Ágatha, Dímeros...)"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-[#FAF8F5] text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 overflow-y-auto pr-1">
              {filteredBiometers.map((bio) => {
                const isSelected = bio.id === activeBiometer.id && !showCustomCreator;
                return (
                  <div
                    key={bio.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-[#FAF8F5] border-[#D97706]'
                        : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectBiometer(bio)}
                      className="flex-1 text-left p-2.5 cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-[#0F172A]">
                        <span className="font-mono text-[#B45309] mr-1.5">
                          {String(bio.number).padStart(2, '0')}.
                        </span>
                        {bio.name}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {bio.category} · {bio.items.length} itens
                      </p>
                    </button>
                    {bio.isCustom && (
                      <button
                        type="button"
                        onClick={() => onDeleteCustomBiometer(bio.id)}
                        aria-label={`Remover biômetro ${bio.name}`}
                        className="p-2 text-[#94A3B8] hover:text-[#BA1A1A] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Right Stage: High-Definition PNG Biometer Viewer + Sector Picker */}
          <div className="lg:col-span-8 p-6 overflow-y-auto space-y-6">
            {showCustomCreator ? (
              <form
                onSubmit={handleCreateCustom}
                className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-5"
              >
                <div className="border-b border-[#E2E8F0] pb-3">
                  <h3 className="font-serif text-lg font-bold text-[#0F172A]">
                    Criar Biômetro Semicircular Personalizado
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1">
                    Defina o título do gráfico e os setores separados por vírgula. O biômetro será
                    gerado instantaneamente e salvo no armazenamento local.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="customBioName"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Nome do Biômetro *
                  </label>
                  <input
                    id="customBioName"
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ex.: Sais de Schüssler ou Óleos Essenciais"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="customBioItems"
                    className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                  >
                    Itens / Setores (separados por vírgula, mínimo 2) *
                  </label>
                  <textarea
                    id="customBioItems"
                    rows={4}
                    required
                    value={customItemsText}
                    onChange={(e) => setCustomItemsText(e.target.value)}
                    placeholder="Ex.: Lavanda, Alecrim, Hortelã-Pimenta, Olíbano, Copaíba"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCustomCreator(false)}
                    className="px-4 py-2 text-xs font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Gerar e Salvar Biômetro
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                        Biômetro {String(activeBiometer.number).padStart(2, '0')} ·{' '}
                        {activeBiometer.category}
                      </p>
                      <h3 className="font-serif text-xl font-bold text-[#0F172A]">
                        {activeBiometer.name}
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-[#64748B]">
                      {items.length} itens cadastrados
                    </span>
                  </div>

                  <p className="text-xs text-[#45464D] leading-relaxed">
                    {activeBiometer.description}
                  </p>

                  {/* High-Definition PNG Biometer Viewer with Zoom & Active Testimony */}
                  {activeBiometer.imageUrl ? (
                    <div className="space-y-4">
                      {/* Zoom Controls & Local PNG Upload */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F5] p-3 rounded-xl border border-[#E2E8F0]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#0F172A]">Zoom HD:</span>
                          <button
                            type="button"
                            onClick={() => setZoomLevel(1)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer ${
                              zoomLevel === 1
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-white text-[#64748B] border-[#CBD5E1]'
                            }`}
                          >
                            100%
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomLevel(1.5)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer ${
                              zoomLevel === 1.5
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-white text-[#64748B] border-[#CBD5E1]'
                            }`}
                          >
                            150%
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomLevel(2)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer ${
                              zoomLevel === 2
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-white text-[#64748B] border-[#CBD5E1]'
                            }`}
                          >
                            200%
                          </button>
                        </div>

                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#B45309] bg-[#FEFCE8] border border-[#D97706]/40 rounded-lg hover:bg-[#FEF3C7] cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          Anexar/Substituir PNG Local
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = URL.createObjectURL(file);
                                activeBiometer.imageUrl = url;
                                setZoomLevel(1);
                              }
                            }}
                          />
                        </label>
                      </div>

                      {/* Image Viewer */}
                      <div className="relative overflow-auto border border-[#E2E8F0] rounded-xl bg-white p-4 flex items-center justify-center max-h-[520px] shadow-inner">
                        <div
                          style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'center center',
                            transition: 'transform 200ms ease',
                          }}
                        >
                          <img
                            src={activeBiometer.imageUrl}
                            alt={activeBiometer.name}
                            className="max-w-full h-auto rounded-lg shadow select-none mx-auto"
                          />
                        </div>
                      </div>

                      {/* Active Digital Testimony Banner at base */}
                      <div className="p-3.5 rounded-xl bg-[#0F172A] text-white flex items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] animate-pulse shrink-0" />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#F59E0B] font-bold">
                              Testemunho Digital Ativo na Prancha
                            </p>
                            <p className="text-xs font-serif font-bold text-white">
                              {patientName || 'Paciente'} {birthShort ? `(${birthShort})` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-[#CBD5E1]">
                          Prancha Radiestésica Verificada
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Active Sector Readout & Action */}
                  <div className="mt-4 w-full p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                        Leitura Selecionada ({safeIdx + 1}/{items.length})
                      </p>
                      <p className="font-serif text-base font-bold text-[#0F172A] mt-0.5">
                        {selectedItem}
                      </p>
                    </div>

                    {onRecordReading && (
                      <button
                        type="button"
                        onClick={handleConfirmReading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap shrink-0 shadow"
                      >
                        <Check className="w-4 h-4 text-[#F59E0B]" />
                        Registrar Leitura na Ficha
                      </button>
                    )}
                  </div>

                  {recordedNotice && (
                    <p className="mt-2 text-xs font-semibold text-[#B45309]">
                      {recordedNotice}
                    </p>
                  )}

                  {/* Large, Readable Sector Selection Grid */}
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3">
                    <p className="text-xs font-semibold text-[#0F172A]">
                      Painel de Setores ({items.length} itens disponíveis para aferição)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {items.map((item, idx) => {
                        const active = idx === safeIdx;
                        return (
                          <button
                            key={`${item}-btn-${idx}`}
                            type="button"
                            onClick={() => handlePickSector(idx)}
                            className={`p-2.5 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-1.5 ${
                              active
                                ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
                                : 'bg-[#FAF8F5] text-[#0F172A] border-[#E2E8F0] hover:border-[#D97706]'
                            }`}
                          >
                            <span className="truncate">
                              <strong className="font-mono opacity-80 mr-1">{idx + 1}.</strong>
                              {item}
                            </span>
                            {active && <Check className="w-3 h-3 text-[#F59E0B] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
