import React, { useEffect, useMemo, useState } from 'react';
import { Check, Compass, Plus, Search, Sparkles, Trash2, X, ZoomIn, ZoomOut, Image as ImageIcon, Sliders } from 'lucide-react';
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
  const [showCustomCreator, setShowCustomCreator] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customItemsText, setCustomItemsText] = useState<string>('');
  const [recordedNotice, setRecordedNotice] = useState<string | null>(null);

  // High-Definition PNG Viewer & Zoom state
  const [viewMode, setViewMode] = useState<'png' | 'dial'>('png');
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = 100%, 1.5 = 150%, 2 = 200%

  useEffect(() => {
    if (isOpen && selectedId === 'bio-23' && typeof currentHawkinsHz === 'number') {
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

  // SVG Semicircular Geometry
  const cx = 260;
  const cy = 240;
  const outerR = 205;
  const innerR = 66;
  const count = Math.max(1, items.length);
  const anglePerSector = 180 / count;

  const polarToCartesian = (r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const buildSectorPath = (index: number) => {
    const startAngle = -90 + index * anglePerSector;
    const endAngle = -90 + (index + 1) * anglePerSector;
    const outerStart = polarToCartesian(outerR, startAngle);
    const outerEnd = polarToCartesian(outerR, endAngle);
    const innerStart = polarToCartesian(innerR, startAngle);
    const innerEnd = polarToCartesian(innerR, endAngle);
    const largeArcFlag = anglePerSector > 180 ? 1 : 0;

    return `M ${innerStart.x} ${innerStart.y} L ${outerStart.x} ${outerStart.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y} Z`;
  };

  const needleAngleDeg = -90 + (safeIdx + 0.5) * anglePerSector;

  const handleSelectBiometer = (bio: BiometerDefinition) => {
    setSelectedId(bio.id);
    setSelectedSectorIndex(0);
    setShowCustomCreator(false);
    setRecordedNotice(null);
  };

  const handlePickSector = (idx: number) => {
    setSelectedSectorIndex(idx);
    if (activeBiometer.id === 'bio-23' && onSelectHawkinsHz) {
      const hawkinsEntry = HAWKINS_SCALE_TABLE[idx];
      if (hawkinsEntry) {
        onSelectHawkinsHz(hawkinsEntry.hz);
      }
    }
  };

  const handleConfirmReading = () => {
    if (onRecordReading) {
      onRecordReading(activeBiometer, selectedItem);
      setRecordedNotice(`✓ Registrado com sucesso: "${selectedItem}"`);
      setTimeout(() => setRecordedNotice(null), 3500);
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customItemsText.trim()) return;
    const parsedItems = customItemsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (parsedItems.length < 2) return;

    const newBio: BiometerDefinition = {
      id: `custom-${Date.now()}`,
      number: allBiometers.length + 1,
      name: customName.trim(),
      category: 'Personalizado',
      description: 'Biômetro personalizado criado pelo terapeuta para emissão quântica.',
      items: parsedItems,
      isCustom: true,
    };

    onSaveCustomBiometer(newBio);
    setSelectedId(newBio.id);
    setSelectedSectorIndex(0);
    setShowCustomCreator(false);
    setCustomName('');
    setCustomItemsText('');
  };

  const witnessShort = patientName.trim() ? patientName : 'Testemunho Padrão';
  const birthShort = birthDate ? `Nasc.: ${formatBirthDateBR(birthDate)}` : '';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Biblioteca de Biômetros e Consulta Radiestésica"
    >
      <div className="bg-[#FAF8F5] w-full max-w-7xl h-[92vh] rounded-2xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D97706]/20 border border-[#D97706]/40 flex items-center justify-center">
              <Compass className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold tracking-wide">
                Mesa Quântica · Biblioteca de 32 Biômetros Oficiais
              </h2>
              <p className="text-xs text-[#CBD5E1]">
                Consulente Ativo: <span className="font-semibold text-white">{witnessShort}</span> {birthShort && `(${birthShort})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCustomCreator(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Biômetro
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#94A3B8] hover:text-white transition-colors rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Left Sidebar: 32 Biometers List */}
          <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-white p-4 flex flex-col gap-3 overflow-y-auto max-h-[300px] lg:max-h-none">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar biômetro (ex.: Chakras, Florais, Causa Raiz...)"
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
                        {bio.category} · {bio.items.length} setores
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

          {/* Right Stage: High-Definition PNG Viewer & Interactive Dial */}
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
                    Defina o título do gráfico e os setores separados por vírgula.
                  </p>
                </div>

                <div>
                  <label htmlFor="customBioName" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
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
                  <label htmlFor="customBioItems" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Itens / Setores (separados por vírgula, mínimo 2) *
                  </label>
                  <textarea
                    id="customBioItems"
                    rows={4}
                    required
                    value={customItemsText}
                    onChange={(e) => setCustomItemsText(e.target.value)}
                    placeholder="Ex.: Lavanda, Alecrim, Hortelã-Pimenta, Olíbano"
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
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                        Biômetro {String(activeBiometer.number).padStart(2, '0')} · {activeBiometer.category}
                      </p>
                      <h3 className="font-serif text-xl font-bold text-[#0F172A]">
                        {activeBiometer.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* View Mode Toggle */}
                      {activeBiometer.imageUrl && (
                        <div className="inline-flex bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => setViewMode('png')}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                              viewMode === 'png'
                                ? 'bg-[#0F172A] text-white'
                                : 'text-[#64748B] hover:text-[#0F172A]'
                            }`}
                          >
                            <ImageIcon className="w-3.5 h-3.5 inline mr-1" />
                            Imagem HD
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode('dial')}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                              viewMode === 'dial'
                                ? 'bg-[#0F172A] text-white'
                                : 'text-[#64748B] hover:text-[#0F172A]'
                            }`}
                          >
                            <Sliders className="w-3.5 h-3.5 inline mr-1" />
                            Dial SVG
                          </button>
                        </div>
                      )}

                      {/* Zoom Controls (when in PNG mode) */}
                      {viewMode === 'png' && activeBiometer.imageUrl && (
                        <div className="inline-flex items-center bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
                            className="p-1.5 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                            title="Reduzir Zoom (100%)"
                          >
                            <ZoomOut className="w-4 h-4" />
                          </button>
                          <span className="px-2 text-xs font-mono font-semibold text-[#0F172A]">
                            {Math.round(zoomLevel * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.5))}
                            className="p-1.5 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                            title="Aumentar Zoom (até 200%)"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#45464D] leading-relaxed">
                    {activeBiometer.description}
                  </p>

                  {/* Active Digital Testimony Banner */}
                  <div className="bg-[#FAF8F5] border border-[#D97706]/30 rounded-lg p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-[#B45309] uppercase tracking-wider mr-2">
                        Testemunho Quântico Ativo:
                      </span>
                      <span className="font-serif font-bold text-[#0F172A]">{witnessShort}</span>
                      {birthShort && <span className="text-[#64748B] ml-2 font-mono">({birthShort})</span>}
                    </div>
                    <span className="px-2 py-0.5 bg-[#0F172A] text-white rounded text-[10px] font-mono">
                      Emissão Sutil
                    </span>
                  </div>

                  {/* Main Display: HD PNG Image or SVG Semicircular Dial */}
                  {viewMode === 'png' && activeBiometer.imageUrl ? (
                    <div className="relative w-full overflow-auto bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-center min-h-[380px] max-h-[520px]">
                      <div
                        style={{
                          transform: `scale(${zoomLevel})`,
                          transformOrigin: 'center center',
                          transition: 'transform 200ms ease-in-out',
                        }}
                        className="flex items-center justify-center"
                      >
                        <img
                          src={activeBiometer.imageUrl}
                          alt={activeBiometer.name}
                          className="max-h-[460px] w-auto object-contain drop-shadow-md rounded-lg"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center pt-2">
                      <svg
                        viewBox="0 0 520 275"
                        className="w-full max-w-[560px] overflow-visible"
                        role="img"
                        aria-label={`Biômetro ${activeBiometer.name}`}
                      >
                        {items.map((item, idx) => {
                          const isActive = idx === safeIdx;
                          const midDeg = -90 + (idx + 0.5) * anglePerSector;
                          const labelPos = polarToCartesian((outerR + innerR) / 2 + 12, midDeg);
                          const shortLabel =
                            items.length > 18
                              ? `${idx + 1}`
                              : item.length > 16
                              ? `${item.slice(0, 14)}…`
                              : item;

                          return (
                            <g
                              key={`${item}-${idx}`}
                              onClick={() => handlePickSector(idx)}
                              className="cursor-pointer"
                            >
                              <path
                                d={buildSectorPath(idx)}
                                fill={
                                  isActive
                                    ? '#0F172A'
                                    : idx % 2 === 0
                                    ? '#FAF8F5'
                                    : '#FFFFFF'
                                }
                                stroke={isActive ? '#D97706' : '#CBD5E1'}
                                strokeWidth={isActive ? 2 : 1}
                                className="transition-colors duration-150 hover:fill-[#D97706]/15"
                              />
                              <text
                                x={labelPos.x}
                                y={labelPos.y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                transform={`rotate(${midDeg}, ${labelPos.x}, ${labelPos.y})`}
                                className={`pointer-events-none font-sans ${
                                  items.length > 20 ? 'text-[8px]' : 'text-[8.5px]'
                                } font-semibold ${isActive ? 'fill-[#F59E0B]' : 'fill-[#0F172A]'}`}
                              >
                                {shortLabel}
                              </text>
                            </g>
                          );
                        })}

                        {/* Pendulum Needle */}
                        <g
                          transform={`rotate(${needleAngleDeg}, ${cx}, ${cy})`}
                          style={{
                            transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <line
                            x1={cx}
                            y1={cy}
                            x2={cx}
                            y2={cy - outerR + 18}
                            stroke="#B45309"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                          <circle cx={cx} cy={cy - outerR + 18} r="5" fill="#F59E0B" />
                        </g>

                        {/* Center Digital Witness Housing */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={innerR - 4}
                          fill="#0F172A"
                          stroke="#D97706"
                          strokeWidth="2.5"
                        />
                        <text
                          x={cx}
                          y={cy - 14}
                          textAnchor="middle"
                          className="fill-[#F59E0B] text-[9px] font-bold uppercase tracking-wider"
                        >
                          Testemunho
                        </text>
                        <text
                          x={cx}
                          y={cy + 2}
                          textAnchor="middle"
                          className="fill-white text-[11px] font-serif font-bold"
                        >
                          {witnessShort}
                        </text>
                        {birthShort && (
                          <text
                            x={cx}
                            y={cy + 18}
                            textAnchor="middle"
                            className="fill-[#CBD5E1] text-[9px] font-mono"
                          >
                            {birthShort}
                          </text>
                        )}
                      </svg>
                    </div>
                  )}

                  {/* Active Sector Readout & Action */}
                  <div className="mt-2 w-full p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                        Leitura Pendular Selecionada ({safeIdx + 1}/{items.length})
                      </p>
                      <p className="font-serif text-base font-bold text-[#0F172A] mt-0.5">
                        {selectedItem}
                      </p>
                    </div>

                    {onRecordReading && (
                      <button
                        type="button"
                        onClick={handleConfirmReading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 text-[#F59E0B]" />
                        Registrar Leitura na Ficha
                      </button>
                    )}
                  </div>

                  {recordedNotice && (
                    <p className="mt-2 text-xs font-semibold text-[#B45309]">
                      {recordedNotice}
                    </p>
                  )}
                </div>

                {/* Clickable Grid of Sectors */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-sm">
                  <p className="text-xs font-semibold text-[#0F172A]">
                    Seleção Rápida de Setores ({items.length} itens)
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                    {items.map((item, idx) => {
                      const active = idx === safeIdx;
                      return (
                        <button
                          key={`${item}-btn-${idx}`}
                          type="button"
                          onClick={() => handlePickSector(idx)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0F172A] text-white border-[#0F172A]'
                              : 'bg-[#FAF8F5] text-[#0F172A] border-[#E2E8F0] hover:border-[#D97706]'
                          }`}
                        >
                          {idx + 1}. {item}
                        </button>
                      );
                    })}
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
