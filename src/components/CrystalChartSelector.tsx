import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Gem, Search, X } from 'lucide-react';
import { CRYSTALS_CATALOG, CrystalCatalogEntry, getCrystalByName } from '../data/crystalsCatalog';

interface CrystalChartSelectorProps {
  geometryName: string;
  anchoredCrystal?: string;
  onConfirmCrystal: (crystalName: string) => void;
}

export const CrystalChartSelector: React.FC<CrystalChartSelectorProps> = ({
  geometryName,
  anchoredCrystal = '',
  onConfirmCrystal,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pendingName, setPendingName] = useState<string>(anchoredCrystal || 'Nenhum');
  const [justConfirmed, setJustConfirmed] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPendingName(anchoredCrystal || 'Nenhum');
  }, [anchoredCrystal]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredCrystals = useMemo(() => {
    const q = searchTerm
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!q) return CRYSTALS_CATALOG;
    return CRYSTALS_CATALOG.filter((c) => {
      const haystack = `${c.name} ${c.purpose} ${c.chakra}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return haystack.includes(q);
    });
  }, [searchTerm]);

  const selectedEntry: CrystalCatalogEntry =
    getCrystalByName(pendingName) || CRYSTALS_CATALOG[0];

  const hasUnconfirmedChange =
    (pendingName === 'Nenhum' ? '' : pendingName) !== (anchoredCrystal || '');

  const handleConfirm = () => {
    const confirmedValue = pendingName === 'Nenhum' ? '' : pendingName;
    onConfirmCrystal(confirmedValue);
    setJustConfirmed(true);
    setTimeout(() => setJustConfirmed(false), 1800);
  };

  return (
    <div ref={containerRef} className="pt-2.5 mt-2.5 border-t border-[#E2E8F0]/80 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#0F172A] flex items-center gap-1.5">
          <Gem className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
          <span>Frequência Cristalina Informacional (Radiestesia Sensitiva)</span>
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 relative">
        {/* Searchable Dropdown Trigger */}
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            aria-label={`Selecionar cristal para ${geometryName}`}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs bg-white border border-[#CBD5E1] rounded-md hover:border-[#D97706] focus:outline-none focus:border-[#D97706] transition-colors cursor-pointer"
          >
            <span className="truncate text-[#0F172A] font-medium">
              {selectedEntry.displayLabel}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#64748B] shrink-0 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isOpen && (
            <div className="absolute left-0 right-0 z-40 mt-1 bg-white border border-[#CBD5E1] rounded-lg shadow-[0_12px_28px_-4px_rgba(15,23,42,0.18)] overflow-hidden">
              <div className="p-2 border-b border-[#E2E8F0] bg-[#FAF8F5] flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar cristal, finalidade ou chakra..."
                  className="w-full text-xs bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="p-0.5 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                    aria-label="Limpar busca"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-[#F1F5F9]">
                {filteredCrystals.length > 0 ? (
                  filteredCrystals.map((crystal) => {
                    const isSelected = selectedEntry.id === crystal.id;
                    return (
                      <button
                        key={crystal.id}
                        type="button"
                        onClick={() => {
                          setPendingName(crystal.name);
                          setIsOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-start justify-between gap-2 hover:bg-[#FAF8F5] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#FEFCE8]' : 'bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0F172A] truncate">
                            {crystal.name}
                          </p>
                          <p className="text-[11px] text-[#64748B] truncate">
                            {crystal.purpose}
                            {crystal.id !== 'nenhum' ? ` · Chakra: ${crystal.chakra}` : ''}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#B45309] shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-3 text-xs text-[#64748B] text-center">
                    Nenhum cristal encontrado para &ldquo;{searchTerm}&rdquo;.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Confirmar Cristal Button */}
        <button
          type="button"
          onClick={handleConfirm}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            hasUnconfirmedChange
              ? 'bg-[#B45309] text-white border-[#B45309] hover:bg-[#92400E] shadow-sm'
              : 'bg-[#0F172A] text-white border-[#0F172A] hover:bg-[#1E293B]'
          }`}
        >
          <Check className="w-3 h-3 shrink-0" />
          <span>{justConfirmed ? 'Cristal Gravado!' : 'Confirmar Cristal'}</span>
        </button>
      </div>

      {/* Golden Anchor Feedback Badge */}
      {anchoredCrystal ? (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FEFCE8] border border-[#D97706]/45 text-[11px] font-semibold text-[#92400E]">
          <Gem className="w-3 h-3 text-[#B45309] shrink-0" />
          <span>Ancorado: {anchoredCrystal}</span>
        </div>
      ) : (
        <p className="text-[10px] text-[#64748B]">
          Modo atual: Geometria Pura (selecione um cristal acima e clique em Confirmar Cristal para gravar no testemunho e comando).
        </p>
      )}
    </div>
  );
};
