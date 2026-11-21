import React, { useEffect, useMemo, useState } from 'react';
import { Check, Compass, Plus, Search, Sparkles, Trash2, X, ZoomIn, ZoomOut, Image as ImageIcon, Sliders, Upload, RotateCcw, Pencil, Loader2 } from 'lucide-react';
import {
  BiometerDefinition,
  HAWKINS_SCALE_TABLE,
  getHawkinsEntryByHz,
} from '../types/clinical';
import { BUILTIN_32_BIOMETERS } from '../data/biometrosData';
import { formatBirthDateBR } from '../utils/antiCatharsis';
import { loadBiometerOverrides, saveBiometerOverrides } from '../utils/storage';

interface BiometrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  birthDate: string;
  customBiometers: BiometerDefinition[];
  hiddenOfficialBiometers: string[];
  onSaveCustomBiometer: (biometer: BiometerDefinition) => void;
  onDeleteCustomBiometer: (id: string) => void;
  onHideOfficialBiometer: (id: string) => void;
  onRestoreAllOfficialBiometers: () => void;
  onRecordReading?: (biometer: BiometerDefinition, selectedItem: string) => void;
  currentHawkinsHz?: number;
  onSelectHawkinsHz?: (hz: number) => void;
  totalBiometersCount: number;
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

export function resolveBiometerImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${cleanBase}${cleanPath}`;
}

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const resolved = resolveBiometerImageUrl(url) || url;
  const res = await fetch(resolved);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const parts = dataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      resolve({ base64: parts[1], mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type NumericScaleUnit = 'percent' | 'hours' | 'minutes' | 'days';

function formatNumberWithScaleUnit(n: number, unit: NumericScaleUnit): string {
  switch (unit) {
    case 'percent':
      return `${n}%`;
    case 'hours':
      return n === 1 ? '1 hr.' : `${n} hrs.`;
    case 'minutes':
      return `${n} min.`;
    case 'days':
      return n === 1 ? '1 dia' : `${n} dias`;
  }
}

export function sanitizeExtractedSectors(rawSectors: unknown[], title?: string): string[] {
  const tNorm = (title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const titleIsPercent = /percent|porcent|%/.test(tNorm);
  const titleIsHours = /\b(hora|horas|hr|hrs)\b/.test(tNorm);
  const titleIsMinutes = /\b(minuto|minutos|min)\b/.test(tNorm);
  const titleIsDays = /\b(dia|dias)\b/.test(tNorm);

  type Token =
    | { kind: 'text'; value: string }
    | { kind: 'pureNum'; num: number; wasEscala: boolean };

  const tokens: Token[] = [];

  for (const raw of rawSectors) {
    let s = String(raw ?? '').trim();
    if (!s) continue;

    let wasEscala = false;
    const escalaMatch = s.match(/^\s*\[(escala[^\]]*)\]\s*/i);
    if (escalaMatch) {
      wasEscala = true;
      const bracketInner = escalaMatch[1]
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      s = s.slice(escalaMatch[0].length).trim();

      const pureAfterEscala = s.match(/^(\d+)$/);
      if (pureAfterEscala) {
        const n = Number(pureAfterEscala[1]);
        if (/hora|hrs?/.test(bracketInner)) {
          tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(n, 'hours') });
          continue;
        }
        if (/min/.test(bracketInner)) {
          tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(n, 'minutes') });
          continue;
        }
        if (/dia/.test(bracketInner)) {
          tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(n, 'days') });
          continue;
        }
        if (/percent|porcent|%/.test(bracketInner)) {
          tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(n, 'percent') });
          continue;
        }
      }
    }

    if (!s) continue;

    // Normalize explicit unit brackets like "[Horas] 12" or "[Minutos] 30"
    const unitBracketMatch = s.match(/^\s*\[(percentual|porcentagem|%|horas?|hrs?|minutos?|min|dias?)\]\s*(\d+)\s*$/i);
    if (unitBracketMatch) {
      const hint = unitBracketMatch[1].toLowerCase();
      const n = Number(unitBracketMatch[2]);
      if (/percent|porcent|%/.test(hint)) {
        tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(n, 'percent') });
      } else if (/h/.test(hint)) {
        tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(n, 'hours') });
      } else if (/min/.test(hint)) {
        tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(n, 'minutes') });
      } else if (/dia/.test(hint)) {
        tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(n, 'days') });
      }
      continue;
    }

    // Normalize already-suffixed scale units
    const pctMatch = s.match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
    if (pctMatch) {
      tokens.push({ kind: 'text', value: `${pctMatch[1]}%` });
      continue;
    }
    const hrMatch = s.match(/^(\d+)\s*(?:h|hr|hrs|hora|horas)\.?$/i);
    if (hrMatch) {
      tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(Number(hrMatch[1]), 'hours') });
      continue;
    }
    const minMatch = s.match(/^(\d+)\s*(?:m|min|mins|minuto|minutos)\.?$/i);
    if (minMatch) {
      tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(Number(minMatch[1]), 'minutes') });
      continue;
    }
    const dayMatch = s.match(/^(\d+)\s*(?:d|dia|dias)\.?$/i);
    if (dayMatch) {
      tokens.push({ kind: 'text', value: formatNumberWithScaleUnit(Number(dayMatch[1]), 'days') });
      continue;
    }

    // Check if pure non-negative integer
    if (/^\d+$/.test(s)) {
      tokens.push({ kind: 'pureNum', num: Number(s), wasEscala });
    } else {
      tokens.push({ kind: 'text', value: s });
    }
  }

  // Group contiguous runs of pure numbers (splitting whenever direction reverses between arcs)
  const output: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.kind === 'text') {
      output.push(tok.value);
      i++;
      continue;
    }

    const run: Array<{ num: number; wasEscala: boolean }> = [{ num: tok.num, wasEscala: tok.wasEscala }];
    let direction: 'asc' | 'desc' | null = null;
    let j = i + 1;

    while (j < tokens.length && tokens[j].kind === 'pureNum') {
      const nextTok = tokens[j] as { kind: 'pureNum'; num: number; wasEscala: boolean };
      const prevNum = run[run.length - 1].num;
      if (direction === null) {
        if (nextTok.num > prevNum) direction = 'asc';
        else if (nextTok.num < prevNum) direction = 'desc';
      } else if (direction === 'asc' && nextTok.num < prevNum) {
        break;
      } else if (direction === 'desc' && nextTok.num > prevNum) {
        break;
      }
      run.push({ num: nextTok.num, wasEscala: nextTok.wasEscala });
      j++;
    }

    const runNums = run.map((r) => r.num);
    const maxVal = Math.max(...runNums);
    const minVal = Math.min(...runNums);
    const anyEscala = run.some((r) => r.wasEscala);

    let unit: NumericScaleUnit | null = null;
    if (maxVal > 60 && maxVal <= 100) {
      unit = 'percent';
    } else if (maxVal > 30 && maxVal <= 60) {
      unit = titleIsPercent && maxVal !== 60 ? 'percent' : 'minutes';
    } else if (maxVal > 24 && maxVal <= 30) {
      unit = titleIsMinutes ? 'minutes' : titleIsPercent && maxVal !== 30 ? 'percent' : 'days';
    } else if (maxVal >= 0 && maxVal <= 24) {
      if (maxVal === 24) {
        unit = titleIsDays ? 'days' : titleIsMinutes ? 'minutes' : 'hours';
      } else if (titleIsDays) {
        unit = 'days';
      } else if (titleIsMinutes) {
        unit = 'minutes';
      } else if (titleIsHours) {
        unit = 'hours';
      } else if (titleIsPercent) {
        unit = 'percent';
      } else if (anyEscala && minVal === 0) {
        unit = maxVal <= 10 ? 'percent' : 'hours';
      }
    }

    for (const item of run) {
      output.push(unit ? formatNumberWithScaleUnit(item.num, unit) : String(item.num));
    }

    i = j;
  }

  return output;
}

export const BiometrosModal: React.FC<BiometrosModalProps> = ({
  isOpen,
  onClose,
  patientName,
  birthDate,
  customBiometers,
  hiddenOfficialBiometers,
  onSaveCustomBiometer,
  onDeleteCustomBiometer,
  onHideOfficialBiometer,
  onRestoreAllOfficialBiometers,
  onRecordReading,
  currentHawkinsHz,
  onSelectHawkinsHz,
  totalBiometersCount,
}) => {
  // Filter out hidden official biometers
  const visibleOfficialBiometers = useMemo(
    () => BUILTIN_32_BIOMETERS.filter((b) => !hiddenOfficialBiometers.includes(b.id)),
    [hiddenOfficialBiometers]
  );

  const [biometerOverrides, setBiometerOverrides] = useState<Record<string, { name?: string; items: string[] }>>(() =>
    loadBiometerOverrides()
  );

  const effectiveBiometers = useMemo(() => {
    return [...visibleOfficialBiometers, ...customBiometers].map((bio) => {
      const ov = biometerOverrides[bio.id];
      if (!ov) return bio;
      const resolvedName = ov.name || bio.name;
      return {
        ...bio,
        name: resolvedName,
        items:
          ov.items && ov.items.length > 0
            ? sanitizeExtractedSectors(ov.items, resolvedName)
            : bio.items,
      };
    });
  }, [visibleOfficialBiometers, customBiometers, biometerOverrides]);

  const [selectedId, setSelectedId] = useState<string>(() => effectiveBiometers[0]?.id || 'bio-01');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | BiometerDefinition['category']>(
    'Todos'
  );

  // Multi-selection state starting strictly EMPTY ([])
  const [selectedSectorIndices, setSelectedSectorIndices] = useState<number[]>([]);
  const [sectorSearchQuery, setSectorSearchQuery] = useState<string>('');
  const [customComplement, setCustomComplement] = useState<string>('');

  const [showCustomCreator, setShowCustomCreator] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<BiometerDefinition['category']>('Personalizado');
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [customItemsText, setCustomItemsText] = useState<string>('');
  const [recordedNotice, setRecordedNotice] = useState<string | null>(null);

  // AI Extraction state
  const [isExtractingAI, setIsExtractingAI] = useState<boolean>(false);
  const [extractionNotice, setExtractionNotice] = useState<string | null>(null);

  // Editor state for any biometer
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editItemsText, setEditItemsText] = useState<string>('');

  // High-Definition PNG Viewer & Zoom state
  const [viewMode, setViewMode] = useState<'png' | 'dial'>('png');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeImageSrc, setActiveImageSrc] = useState<string | undefined>(undefined);
  const [imageLoadStatus, setImageLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    if (selectedId === 'bio-23' && typeof currentHawkinsHz === 'number') {
      const entry = getHawkinsEntryByHz(currentHawkinsHz);
      const idx = HAWKINS_SCALE_TABLE.findIndex((item) => item.hz === entry.hz);
      if (idx >= 0 && selectedSectorIndices.length === 0) {
        setSelectedSectorIndices([idx]);
      }
    }
  }, [selectedId, currentHawkinsHz]);

  const activeBiometer = useMemo(() => {
    return effectiveBiometers.find((b) => b.id === selectedId) || effectiveBiometers[0] || BUILTIN_32_BIOMETERS[0];
  }, [effectiveBiometers, selectedId]);

  const resolvedActiveImageUrl = useMemo(
    () => resolveBiometerImageUrl(activeBiometer.imageUrl),
    [activeBiometer.imageUrl]
  );

  useEffect(() => {
    setActiveImageSrc(resolvedActiveImageUrl);
    setImageLoadStatus(resolvedActiveImageUrl ? 'loading' : 'error');
  }, [resolvedActiveImageUrl, activeBiometer.id]);

  const items = activeBiometer.items;

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

  const primarySelectedIndex = selectedSectorIndices[0] ?? 0;
  const needleAngleDeg = -90 + (primarySelectedIndex + 0.5) * anglePerSector;

  const handleSelectBiometer = (bio: BiometerDefinition) => {
    setSelectedId(bio.id);
    setSelectedSectorIndices([]);
    setSectorSearchQuery('');
    setCustomComplement('');
    setShowCustomCreator(false);
    setShowEditor(false);
    setZoomLevel(1);
    if (bio.imageUrl) {
      setViewMode('png');
    }
    setRecordedNotice(null);
    setExtractionNotice(null);
  };

  const handleToggleSector = (idx: number) => {
    setSelectedSectorIndices((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((i) => i !== idx);
      } else {
        return [...prev, idx];
      }
    });

    if (activeBiometer.id === 'bio-23' && onSelectHawkinsHz) {
      const hawkinsEntry = HAWKINS_SCALE_TABLE[idx];
      if (hawkinsEntry) {
        onSelectHawkinsHz(hawkinsEntry.hz);
      }
    }
  };

  const handleDeselectAll = () => {
    setSelectedSectorIndices([]);
  };

  const formattedSelectedItems = useMemo(() => {
    const names = selectedSectorIndices.map((i) => items[i]).filter(Boolean);
    let combined = names.join(', ');
    if (customComplement.trim()) {
      combined = combined ? `${combined} | Obs: ${customComplement.trim()}` : customComplement.trim();
    }
    return combined;
  }, [selectedSectorIndices, items, customComplement]);

  const handleConfirmReading = () => {
    if (onRecordReading && formattedSelectedItems) {
      onRecordReading(activeBiometer, formattedSelectedItems);
      setRecordedNotice(`✓ Registrado com sucesso: "${formattedSelectedItems}"`);
      setTimeout(() => setRecordedNotice(null), 3500);
    }
  };

  const handleExtractSectorsWithAI = async (imgBase64: string, mime: string, currentTitle?: string) => {
    setIsExtractingAI(true);
    setExtractionNotice('Lendo intervalos e transcrevendo setores da imagem com IA...');
    try {
      const res = await fetch('/api/biometros/extract-sectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imgBase64, mimeType: mime, title: currentTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha na extração por IA.');
      }

      if (data && Array.isArray(data.sectors) && data.sectors.length > 0) {
        const sanitizedSectors = sanitizeExtractedSectors(
          data.sectors,
          data.suggestedTitle || currentTitle
        );
        const joined = sanitizedSectors.join(', ');
        const count = sanitizedSectors.length;
        setExtractionNotice(`✓ ${count} setores identificados na imagem!`);
        return {
          sectors: sanitizedSectors,
          joinedText: joined,
          suggestedTitle: data.suggestedTitle as string | undefined,
          totalCount: count,
        };
      } else {
        throw new Error('Nenhum setor retornado pela IA.');
      }
    } catch (err) {
      console.error('Erro na extração IA:', err);
      setExtractionNotice(`Erro na IA: ${err instanceof Error ? err.message : 'Falha na extração'}`);
      return null;
    } finally {
      setIsExtractingAI(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCustomImageUrl(result);
        const parts = result.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

        const extracted = await handleExtractSectorsWithAI(parts[1], mimeType, customName);
        if (extracted) {
          setCustomItemsText(extracted.joinedText);
          if (!customName.trim() && extracted.suggestedTitle) {
            setCustomName(extracted.suggestedTitle);
          }
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExtractActiveBiometerAI = async () => {
    if (!activeBiometer.imageUrl) {
      alert('Este biômetro não possui imagem associada para leitura óptica.');
      return;
    }
    try {
      const { base64, mimeType } = await imageUrlToBase64(activeBiometer.imageUrl);
      const extracted = await handleExtractSectorsWithAI(base64, mimeType, activeBiometer.name);
      if (extracted) {
        const nextOverrides = {
          ...biometerOverrides,
          [activeBiometer.id]: {
            name: biometerOverrides[activeBiometer.id]?.name || activeBiometer.name,
            items: extracted.sectors,
          },
        };
        setBiometerOverrides(nextOverrides);
        saveBiometerOverrides(nextOverrides);
        setSelectedSectorIndices([]);
        if (showEditor) {
          setEditItemsText(extracted.sectors.join(', '));
        }
      }
    } catch (err) {
      console.error('Erro ao ler biômetro existente com IA:', err);
      setExtractionNotice('Erro ao carregar ou processar imagem do biômetro.');
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customItemsText.trim()) return;
    const parsedItems = customItemsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parsedItems.length < 2) return;

    const newBio: BiometerDefinition = {
      id: `custom-${Date.now()}`,
      number: effectiveBiometers.length + 1,
      name: customName.trim(),
      category: customCategory,
      description: 'Biômetro personalizado enviado pelo terapeuta para emissão e consulta quântica.',
      imageUrl: customImageUrl || undefined,
      items: parsedItems,
      isCustom: true,
    };

    onSaveCustomBiometer(newBio);
    setSelectedId(newBio.id);
    setSelectedSectorIndices([]);
    setShowCustomCreator(false);
    setCustomName('');
    setCustomImageUrl('');
    setCustomItemsText('');
  };

  const handleOpenEditor = () => {
    setEditName(activeBiometer.name);
    setEditItemsText(activeBiometer.items.join(', '));
    setShowEditor(true);
    setShowCustomCreator(false);
    setExtractionNotice(null);
  };

  const handleSaveEditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editItemsText.trim()) return;
    const parsedItems = editItemsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsedItems.length === 0) return;

    const nextOverrides = {
      ...biometerOverrides,
      [activeBiometer.id]: {
        name: editName.trim(),
        items: parsedItems,
      },
    };
    setBiometerOverrides(nextOverrides);
    saveBiometerOverrides(nextOverrides);
    setShowEditor(false);
    setSelectedSectorIndices([]);
  };

  const handleRestoreOriginal = () => {
    const nextOverrides = { ...biometerOverrides };
    delete nextOverrides[activeBiometer.id];
    setBiometerOverrides(nextOverrides);
    saveBiometerOverrides(nextOverrides);
    setShowEditor(false);
    setSelectedSectorIndices([]);
  };

  const handleDeleteOrHide = (bio: BiometerDefinition) => {
    if (bio.isCustom) {
      onDeleteCustomBiometer(bio.id);
    } else {
      onHideOfficialBiometer(bio.id);
    }
    const remaining = effectiveBiometers.filter((b) => b.id !== bio.id);
    if (remaining.length > 0) {
      setSelectedId(remaining[0].id);
    }
  };

  const filteredBiometers = effectiveBiometers.filter((b) => {
    const matchesCat = categoryFilter === 'Todos' || b.category === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      String(b.number).includes(q);
    return matchesCat && matchesSearch;
  });

  const witnessShort = patientName.trim() ? patientName : 'Testemunho Padrão';
  const birthShort = birthDate ? `Nasc.: ${formatBirthDateBR(birthDate)}` : '';

  const filteredSectorItems = useMemo(() => {
    const q = sectorSearchQuery.trim().toLowerCase();
    if (!q) return items.map((item, idx) => ({ item, idx }));
    return items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.toLowerCase().includes(q));
  }, [items, sectorSearchQuery]);

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
                Mesa Quântica · Biblioteca de {totalBiometersCount} Biômetros
              </h2>
              <p className="text-xs text-[#CBD5E1]">
                Consulente Ativo: <span className="font-semibold text-white">{witnessShort}</span> {birthShort && `(${birthShort})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowCustomCreator(true);
                setShowEditor(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#D97706] text-white rounded-lg hover:bg-[#B45309] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + Novo Biômetro PNG
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
        <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Left Sidebar: Biometers List */}
          <aside className="lg:col-span-4 min-h-0 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-white p-4 flex flex-col gap-3 overflow-y-auto max-h-[260px] lg:max-h-none">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar biômetro (ex.: Florais, Cristais, Chakras...)"
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

            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {filteredBiometers.map((bio) => {
                const isSelected = bio.id === activeBiometer.id && !showCustomCreator && !showEditor;
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
                      className="flex-1 min-w-0 text-left p-2 flex items-center gap-2.5 cursor-pointer"
                    >
                      {bio.imageUrl ? (
                        <img
                          src={resolveBiometerImageUrl(bio.imageUrl)}
                          alt={bio.name}
                          loading="lazy"
                          className="w-10 h-10 rounded-md border border-[#E2E8F0] bg-[#FAF8F5] object-contain shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md border border-[#E2E8F0] bg-[#FAF8F5] flex items-center justify-center shrink-0">
                          <Compass className="w-4 h-4 text-[#B45309]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">
                          <span className="font-mono text-[#B45309] mr-1.5">
                            {String(bio.number).padStart(2, '0')}.
                          </span>
                          {bio.name}
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
                          {bio.category} · {bio.items.length} setores {bio.imageUrl ? '· [PNG]' : ''} {biometerOverrides[bio.id] ? '· [Editado]' : ''}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrHide(bio)}
                      title={bio.isCustom ? 'Excluir biômetro personalizado' : 'Ocultar biômetro oficial'}
                      aria-label={`Remover biômetro ${bio.name}`}
                      className="p-2 text-[#94A3B8] hover:text-[#BA1A1A] cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {hiddenOfficialBiometers.length > 0 && (
              <div className="pt-2 border-t border-[#E2E8F0] text-center">
                <button
                  type="button"
                  onClick={onRestoreAllOfficialBiometers}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B45309] hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar {hiddenOfficialBiometers.length} biômetro(s) oficial(is) oculto(s)
                </button>
              </div>
            )}
          </aside>

          {/* Right Stage */}
          <div className="lg:col-span-8 min-h-0 p-6 overflow-y-auto space-y-6">
            {showCustomCreator ? (
              <form
                onSubmit={handleCreateCustom}
                className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-5 shadow-sm"
              >
                <div className="border-b border-[#E2E8F0] pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#0F172A]">
                      Cadastrar Novo Biômetro com Imagem PNG / JPG
                    </h3>
                    <p className="text-xs text-[#64748B] mt-1">
                      Faça upload do biômetro digital para transcrição automática por IA Vision.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomCreator(false)}
                    className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="customBioName" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Título do Biômetro *
                    </label>
                    <input
                      id="customBioName"
                      type="text"
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex.: Sais de Schüssler ou Óleos Essenciais"
                      className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                    />
                  </div>

                  <div>
                    <label htmlFor="customCategory" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Categoria Clínica *
                    </label>
                    <select
                      id="customCategory"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as BiometerDefinition['category'])}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                    >
                      <option value="Triagem & Geral">Triagem & Geral</option>
                      <option value="Chakras & Corpos Sutis">Chakras & Corpos Sutis</option>
                      <option value="Saúde Física & ANSAE">Saúde Física & ANSAE</option>
                      <option value="Emocional, Mental & Consciência">Emocional, Mental & Consciência</option>
                      <option value="Prosperidade & Hábitos">Prosperidade & Hábitos</option>
                      <option value="Protocolos & Terapêuticas">Protocolos & Terapêuticas</option>
                      <option value="Personalizado">Personalizado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Imagem do Biômetro (PNG / JPG / WEBP)
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer">
                      <Upload className="w-4 h-4 text-[#B45309]" />
                      Selecionar Arquivo de Imagem
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {isExtractingAI && (
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-[#B45309] animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Lendo intervalos e transcrevendo setores da imagem com IA...
                      </span>
                    )}
                  </div>
                  {extractionNotice && !isExtractingAI && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                      {extractionNotice}
                    </p>
                  )}
                  {customImageUrl && (
                    <div className="mt-3 max-h-40 overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#FAF8F5] p-2 flex items-center justify-center">
                      <img src={customImageUrl} alt="Pré-visualização" className="max-h-36 object-contain rounded" />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="customBioItems" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Setores / Opções Clicáveis (separados por vírgula ou quebra de linha) *
                  </label>
                  <textarea
                    id="customBioItems"
                    rows={4}
                    required
                    value={customItemsText}
                    onChange={(e) => setCustomItemsText(e.target.value)}
                    placeholder="Ex.: Lavanda, Alecrim, Hortelã-Pimenta, Olíbano"
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomCreator(false)}
                    className="px-4 py-2 text-xs font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isExtractingAI}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Salvar Novo Biômetro
                  </button>
                </div>
              </form>
            ) : showEditor ? (
              <form
                onSubmit={handleSaveEditor}
                className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-5 shadow-sm"
              >
                <div className="border-b border-[#E2E8F0] pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#0F172A]">
                      Editar Setores e Título do Biômetro
                    </h3>
                    <p className="text-xs text-[#64748B] mt-1">
                      Personalize os rótulos ou use a IA Vision para ler todos os setores da prancha.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEditor(false)}
                    className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {activeBiometer.imageUrl && (
                  <div className="bg-[#FAF8F5] border border-[#D97706]/30 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-semibold text-[#B45309]">Leitura Óptica Automática:</span> Transcreva 100% dos setores da imagem usando IA.
                    </div>
                    <button
                      type="button"
                      onClick={handleExtractActiveBiometerAI}
                      disabled={isExtractingAI}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#B45309] rounded-lg hover:bg-[#92400E] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      {isExtractingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />}
                      {isExtractingAI ? 'Lendo imagem com IA...' : 'Ler Todos os Setores da Imagem com IA'}
                    </button>
                  </div>
                )}

                {extractionNotice && (
                  <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                    {extractionNotice}
                  </p>
                )}

                <div>
                  <label htmlFor="editBioName" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Título do Biômetro *
                  </label>
                  <input
                    id="editBioName"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                  />
                </div>

                <div>
                  <label htmlFor="editBioItems" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Setores / Opções Clicáveis (separados por vírgula ou quebra de linha) *
                  </label>
                  <textarea
                    id="editBioItems"
                    rows={6}
                    required
                    value={editItemsText}
                    onChange={(e) => setEditItemsText(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {biometerOverrides[activeBiometer.id] && (
                    <button
                      type="button"
                      onClick={handleRestoreOriginal}
                      className="px-4 py-2 text-xs font-semibold text-[#BA1A1A] bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
                    >
                      Restaurar Padrão Original
                    </button>
                  )}
                  <div className="flex items-center gap-3 ml-auto">
                    <button
                      type="button"
                      onClick={() => setShowEditor(false)}
                      className="px-4 py-2 text-xs font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isExtractingAI}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5 text-[#F59E0B]" />
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <>
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                          Biômetro {String(activeBiometer.number).padStart(2, '0')} · {activeBiometer.category}
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenEditor}
                          title="Editar Setores deste Biômetro"
                          className="text-[#B45309] hover:underline text-xs inline-flex items-center gap-1 font-semibold cursor-pointer ml-2 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Editar Setores deste Biômetro</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrHide(activeBiometer)}
                          title={activeBiometer.isCustom ? 'Excluir biômetro personalizado' : 'Ocultar biômetro oficial'}
                          className="text-[#94A3B8] hover:text-[#BA1A1A] text-xs inline-flex items-center gap-1 cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{activeBiometer.isCustom ? 'Excluir' : 'Ocultar'}</span>
                        </button>
                      </div>
                      <h3 className="font-serif text-xl font-bold text-[#0F172A] mt-1">
                        {activeBiometer.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
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

                  {/* AI Vision extraction button for existing biometer */}
                  {activeBiometer.imageUrl && (
                    <div className="bg-[#FAF8F5] border border-[#D97706]/30 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-[#0F172A]">
                        <span className="font-semibold text-[#B45309]">Inteligência Artificial Vision:</span> Extraia 100% dos setores diretamente da imagem deste biômetro.
                      </div>
                      <button
                        type="button"
                        onClick={handleExtractActiveBiometerAI}
                        disabled={isExtractingAI}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#B45309] rounded-lg hover:bg-[#92400E] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                      >
                        {isExtractingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />}
                        {isExtractingAI ? 'Lendo imagem com IA...' : 'Ler Todos os Setores da Imagem com IA'}
                      </button>
                    </div>
                  )}

                  {extractionNotice && (
                    <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                      {extractionNotice}
                    </p>
                  )}

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
                    <div className="relative w-full overflow-auto bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl p-4 flex flex-col items-center justify-center min-h-[320px] max-h-[520px]">
                      {imageLoadStatus === 'loading' && (
                        <div className="flex items-center gap-2 text-xs text-[#64748B] py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-[#B45309]" />
                          Carregando imagem do biômetro...
                        </div>
                      )}
                      {imageLoadStatus === 'error' ? (
                        <div className="text-center space-y-3 py-8">
                          <p className="text-xs font-medium text-[#64748B]">
                            Não foi possível carregar a imagem HD deste biômetro ({activeBiometer.imageUrl}).
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const retrySrc = resolveBiometerImageUrl(activeBiometer.imageUrl);
                                if (retrySrc) {
                                  setImageLoadStatus('loading');
                                  setActiveImageSrc(`${retrySrc}${retrySrc.includes('?') ? '&' : '?'}t=${Date.now()}`);
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-[#0F172A] text-white rounded-lg cursor-pointer"
                            >
                              Tentar Novamente
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewMode('dial')}
                              className="px-3 py-1.5 text-xs font-semibold border border-[#CBD5E1] bg-white text-[#0F172A] rounded-lg cursor-pointer"
                            >
                              Abrir Dial SVG
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'center center',
                            transition: 'transform 200ms ease-in-out',
                          }}
                          className="w-full flex items-center justify-center"
                        >
                          <img
                            key={activeBiometer.id}
                            src={activeImageSrc || resolvedActiveImageUrl}
                            alt={activeBiometer.name}
                            onLoad={() => setImageLoadStatus('loaded')}
                            onError={() => {
                              const rawUrl = activeBiometer.imageUrl || '';
                              const rootFallback = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
                              if (activeImageSrc && activeImageSrc !== rootFallback && !activeImageSrc.includes('t=')) {
                                setActiveImageSrc(rootFallback);
                              } else {
                                setImageLoadStatus('error');
                              }
                            }}
                            className="block max-h-[460px] max-w-full w-auto h-auto object-contain drop-shadow-md rounded-lg"
                          />
                        </div>
                      )}
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
                          const isActive = selectedSectorIndices.includes(idx);
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
                              onClick={() => handleToggleSector(idx)}
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
                        Itens Selecionados ({selectedSectorIndices.length} marcados)
                      </p>
                      <p className="font-serif text-base font-bold text-[#0F172A] mt-0.5">
                        {formattedSelectedItems || 'Nenhum item selecionado'}
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

                {/* Multi-selection Grid of Sectors with Quick Filter, Deselect All & Custom Input */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-xs font-semibold text-[#0F172A]">
                          Seleção Rápida de Setores (Múltipla Escolha)
                        </h4>
                        {selectedSectorIndices.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDeselectAll}
                            className="text-[11px] font-semibold text-[#BA1A1A] hover:underline cursor-pointer bg-red-50 px-2 py-0.5 rounded border border-red-200"
                          >
                            Desmarcar Todos
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Clique para marcar/desmarcar múltiplos itens desta prancha.
                      </p>
                    </div>

                    {items.length > 10 && (
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={sectorSearchQuery}
                          onChange={(e) => setSectorSearchQuery(e.target.value)}
                          placeholder="Filtrar itens..."
                          className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Sector Buttons Grid */}
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1 p-1">
                    {filteredSectorItems.map(({ item, idx }) => {
                      const active = selectedSectorIndices.includes(idx);
                      return (
                        <button
                          key={`${item}-btn-${idx}`}
                          type="button"
                          onClick={() => handleToggleSector(idx)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                            active
                              ? 'bg-[#0F172A] text-white border-[#0F172A]'
                              : 'bg-[#FAF8F5] text-[#0F172A] border-[#E2E8F0] hover:border-[#D97706]'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 text-[#F59E0B]" />}
                          {item}
                        </button>
                      );
                    })}
                  </div>

                  {/* Free text input for custom findings / complementary notes */}
                  <div className="pt-2 border-t border-[#E2E8F0] space-y-1.5">
                    <label htmlFor="customComplementInput" className="block text-xs font-semibold text-[#0F172A]">
                      Outro achado / Complemento da leitura pendular (digitação livre):
                    </label>
                    <input
                      id="customComplementInput"
                      type="text"
                      value={customComplement}
                      onChange={(e) => setCustomComplement(e.target.value)}
                      placeholder="Ex.: Tomar 4 gotas 3x ao dia, foco no plexo solar..."
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                    />
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
