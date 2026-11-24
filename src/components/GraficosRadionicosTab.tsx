import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckSquare,
  Compass,
  Copy,
  Edit3,
  Eye,
  ImagePlus,
  Layers,
  Lightbulb,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  ScanText,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  BUILTIN_PRINTABLE_GRAPHICS,
  PRINTABLE_GRAPHIC_CATEGORIES,
  PrintableGraphic,
  PrintableGraphicCategory,
  THERAPEUTIC_PROTOCOLS_INDEX,
  TherapeuticProtocolIndexItem,
  resolveGraphicImageUrl,
} from '../data/printableGraphicsData';
import {
  BACKUP_RESTORED_EVENT,
  PrintableGraphicOverride,
  loadCustomPrintableGraphics,
  loadHiddenOfficialGraphics,
  loadPrintableGraphicOverrides,
  saveCustomPrintableGraphics,
  saveHiddenOfficialGraphics,
  savePrintableGraphicOverrides,
} from '../utils/storage';
import { NorthCompassModal } from './NorthCompassModal';

type CategoryFilter = 'Todos' | PrintableGraphicCategory;

interface OcrExtractResponse {
  hasText: boolean;
  rawExtractedText: string;
  title: string;
  presentation: string;
  usageAspects: string;
  suggestedCategory: string;
  requiresNorthAlignment: boolean;
}

function normalizeSearch(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const SEARCH_STOP_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'para',
  'com',
  'sem',
  'em',
  'na',
  'no',
  'e',
  'a',
  'o',
]);

export interface RecommendedProtocolSequenceItem {
  step: string;
  graphicTitle: string;
  role: string;
  alignment: string;
  durationHint: string;
}

export interface GraficosRadionicosTabProps {
  onApplyProtocolToTable?: (
    protocolTitle: string,
    items: RecommendedProtocolSequenceItem[],
    witnessTemplate?: string
  ) => void;
}

interface AiProtocolConsultResponse {
  protocolTitle: string;
  clinicalRationale: string;
  recommendedSequence: RecommendedProtocolSequenceItem[];
  witnessTemplate: string;
  kineticCommand: string;
  isLocalFallback?: boolean;
}

const SEARCH_SYNONYMS: Record<string, string[]> = {
  charas: ['chakras', 'chakra'],
  chacra: ['chakras', 'chakra'],
  chacras: ['chakras', 'chakra'],
  xacra: ['chakras', 'chakra'],
  xacras: ['chakras', 'chakra'],
  prosperidade: ['prosperador', 'fortuna', 'material', 'abundancia', 'shrim', 'jupiter'],
  prosperar: ['prosperador', 'fortuna', 'prosperidade', 'abundancia'],
  dinheiro: ['prosperador', 'fortuna', 'material', 'abundancia', 'shrim', 'jupiter'],
  financeiro: ['prosperador', 'fortuna', 'material', 'prosperidade', 'jupiter'],
  divorcio: ['divorcio energetico', 'corte de votos', 'ioshua', 'labirinto', 'desembaracador'],
  votos: ['corte de votos', 'votos antigos', 'divorcio energetico', '72 nomes'],
  pet: ['pets', 'chakras pet', 'animais', 'cachorro', 'gato'],
  pets: ['pet', 'chakras pet', 'animais'],
  cachorro: ['pets', 'chakras pet', 'animais'],
  gato: ['pets', 'chakras pet', 'animais'],
  justica: ['justica divina', 'processos', 'causas travadas', 'jupiter'],
  processo: ['justica divina', 'processos', 'causas travadas'],
  processos: ['justica divina', 'processos', 'causas travadas'],
  imovel: ['imoveis', 'casa', 'desembaracador material', 'espiral cosmica', 'cruz atlante', 'bagua'],
  imoveis: ['imovel', 'casa', 'desembaracador material', 'espiral cosmica', 'cruz atlante'],
  dor: ['anti dor', 'dores', 'inflamacao', 'diafragma 1', 'triturador', 'trigono'],
  dores: ['anti dor', 'dor', 'inflamacao', 'diafragma 1', 'triturador'],
  sono: ['insonia', 'harmonia', 'diafragma 1', 'ioshua', 'labirinto'],
  insonia: ['sono', 'harmonia', 'diafragma 1', 'ioshua', 'labirinto'],
  magia: ['anti magia', 'iave', 'desimpregnador', 'onze circulos', 'nove circulos'],
  aura: ['campo aurico', 'diafragma 2', 'harmonia', 'flor da vida', 'irradiador'],
  telurica: ['geobiologia', 'scap', 'luxor', 'cruz cosmica', 'mesa d amiens'],
  geobiologia: ['telurica', 'scap', 'luxor', 'cruz cosmica', 'escudo protetor'],
};

function hasEditDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else {
      edits += 1;
      if (edits > 1) return false;
      if (a.length > b.length) {
        i += 1;
      } else if (b.length > a.length) {
        j += 1;
      } else {
        i += 1;
        j += 1;
      }
    }
  }
  if (i < a.length || j < b.length) edits += 1;
  return edits <= 1;
}

function tokenMatchesText(token: string, haystack: string, haystackWords: string[]): boolean {
  if (haystack.includes(token)) return true;
  const synonyms = SEARCH_SYNONYMS[token];
  if (synonyms && synonyms.some((syn) => haystack.includes(syn))) {
    return true;
  }
  if (token.length >= 4) {
    for (const word of haystackWords) {
      if (word.length >= 4 && hasEditDistanceAtMostOne(token, word)) {
        return true;
      }
    }
  }
  return false;
}

interface FrequentPurposeShortcut {
  id: string;
  label: string;
  keywords: string[];
  synergyTitle: string;
  synergyAdvice: string;
  recommendedSequence: string;
}

const FREQUENT_PURPOSES: FrequentPurposeShortcut[] = [
  {
    id: 'divorcio-energetico',
    label: 'Divórcio Energético',
    keywords: [
      'divorcio energetico',
      'corte de votos',
      'votos antigos',
      'cortes energeticos',
      'decagono duplo',
      'ioshua',
      'labirinto d\'amiens',
      'desembaracador de relacionamentos',
      'scap',
    ],
    synergyTitle: 'Dica Clínica de Sinergia — Divórcio Energético & Corte de Votos',
    synergyAdvice:
      'Valorize os testemunhos a grafite no Decágono Duplo (15–20 min) e utilize Ioshua (alinhado ao Norte 357°) junto ao Labirinto D’Amiens (Norte 357°) e Desembaraçador de Relacionamentos para dissolver vínculos e votos antigos com serenidade, encerrando com proteção no SCAP.',
    recommendedSequence:
      'Sequência sugerida: Decágono Duplo → Ioshua / Labirinto D’Amiens → Desembaraçador de Relacionamentos + SCAP.',
  },
  {
    id: 'prosperidade',
    label: 'Prosperidade Financeira',
    keywords: [
      'prosperidade financeira',
      'dinheiro inesperado',
      'abundancia',
      'riqueza',
      'fartura',
      'fortuna',
      'fluxo de caixa',
      'vendas',
      'shrim',
    ],
    synergyTitle: 'Dica Clínica de Sinergia — Prosperidade Financeira',
    synergyAdvice:
      'Valorize o testemunho e a meta financeira a lápis grafite no Decágono Duplo por 15 a 20 minutos antes da emissão. Alinhe as placas direcionais (Turbilhão com Prosperador, Júpiter, Sol, Shrim e Cruz Atlante) ao Norte Magnético (357°). Evite associar Turbilhão com o gráfico Harmonia na mesma etapa.',
    recommendedSequence:
      'Sequência sugerida: Decágono Duplo (15–20 min) → Desimpregnador (se houver bloqueio) → Turbilhão com Prosperador / Shrim / Júpiter.',
  },
  {
    id: 'destravamento',
    label: 'Destravamento & Negócios',
    keywords: [
      'destravamento financeiro',
      'negocios',
      'contratos',
      'emprego',
      'vendas',
      'imoveis',
      'desembaracador material',
      'espiral cosmica',
      'trigono',
      'acelerador',
    ],
    synergyTitle: 'Dica Clínica de Sinergia — Destravamento & Negócios',
    synergyAdvice:
      'Para situações estagnadas, contratos emperrados ou recolocação profissional, prepare o testemunho no Decágono Duplo (15–20 min) e inicie com o Desembaraçador Material antes de acelerar com Turbilhão ou Acelerador. Cheque no pêndulo se há necessidade prévia de limpeza de inveja.',
    recommendedSequence:
      'Sequência sugerida: Decágono Duplo → Desembaraçador Material → Espiral Cósmica / Turbilhão com Sol.',
  },
  {
    id: 'limpeza',
    label: 'Limpeza & Desimpregnação',
    keywords: [
      'limpeza',
      'desimpregnacao',
      'inveja',
      'olho gordo',
      'miasmas',
      'divorcio energetico',
      'cortes energeticos',
      'votos antigos',
      'purificacao',
    ],
    synergyTitle: 'Dica Clínica de Sinergia — Limpeza & Desimpregnação (Anti-Catarse)',
    synergyAdvice:
      'Sempre valorize o testemunho a grafite no Decágono Duplo por 15 a 20 minutos e priorize o Desimpregnador ou Triturador nas primeiras 24h a 72h antes de qualquer placa estimulante. Para Mesa D’Amiens, Labirinto D’Amiens e Ioshua, alinhe o eixo superior ao Norte Magnético (357°).',
    recommendedSequence:
      'Sequência sugerida: Decágono Duplo → Desimpregnador / Triturador → Diafragma 2 para recomposição áurica.',
  },
  {
    id: 'protecao',
    label: 'Proteção & Anti-Magia',
    keywords: [
      'protecao',
      'magia',
      'anti magia',
      'ataque psiquico',
      'obsessores',
      'ondas eletromagneticas',
      'telurica',
      'blindagem',
      'justica',
      'processos',
    ],
    synergyTitle: 'Dica Clínica de Sinergia — Proteção & Defesa Espiritual',
    synergyAdvice:
      'Em quadros de ataque psíquico, processos ou sobrecarga eletromagnética/telúrica, valorize o testemunho no Decágono Duplo (15–20 min) e confira o alinhamento ao Norte Magnético (357°) nas placas direcionais (SCAP, Anti Magia, Iavê, Ioshua, Luxor, Cruz Cósmica, Quadrado Mágico e Justiça Divina).',
    recommendedSequence:
      'Sequência sugerida: Decágono Duplo → Onze Círculos / Anti Magia / Iavê → SCAP Cabalístico para blindagem contínua.',
  },
  {
    id: 'saude',
    label: 'Saúde & Alívio de Dores',
    keywords: [
      'saude',
      'dor',
      'anti dor',
      'inflamacao',
      'vitalidade',
      'cansaco',
      'depressao',
      'apatia',
      'regeneracao celular',
      'pets',
    ],
    synergyTitle: 'Dica Clínica de Sinergia — Saúde, Alívio de Dores & Vitalidade',
    synergyAdvice:
      'Em pacientes com Bovis muito baixo (< 5.000 Å), faça assepsia prévia no Desimpregnador antes de aplicar Alta Vitalidade, Geradores ou Programador Físico (prevenção de catarse). Alinhe Anti Dor, Programador Físico, Cruz Ansata e Gerador Pirâmide/Quadrado ao Norte (357°) e utilize água dinamizada por 15–20 min.',
    recommendedSequence:
      'Sequência sugerida: Decágono Duplo → Anti Dor / Programador Físico → Alta Vitalidade / Flor da Vida.',
  },
  {
    id: 'clareza',
    label: 'Clareza Mental & Ansiedade',
    keywords: [
      'ansiedade',
      'clareza mental',
      'foco',
      'estresse',
      'sono',
      'insonia',
      'vesica piscis',
      'diafragma',
      'labirinto',
    ],
    synergyTitle: 'Dica Clínica de Sinergia — Clareza Mental & Controle da Ansiedade',
    synergyAdvice:
      'Para crises de ansiedade, insônia ou excesso de ruminação mental, utilize o Diafragma 1 para descongestionar (30 min a 24h) seguido pelo Diafragma 2 ou Labirinto D’Amiens (alinhado ao Norte 357°). Evite emissões estimulantes de Turbilhão ou Energizador à noite em interagentes agitados.',
    recommendedSequence:
      'Sequência sugerida: Decágono Duplo → Diafragma 1 → Diafragma 2 / Vesica Piscis / Labirinto D’Amiens.',
  },
  {
    id: 'relacionamentos',
    label: 'Harmonia & Relacionamentos',
    keywords: [
      'harmonia',
      'relacionamento',
      'casais',
      'amor',
      'sociedade',
      'familia',
      'bagua',
      'desembaracador de relacionamentos',
      'hrim',
      'klim',
      'venus',
    ],
    synergyTitle: 'Dica Clínica de Sinergia — Harmonia & Relacionamentos',
    synergyAdvice:
      'Valorize os testemunhos a grafite no Decágono Duplo (15–20 min) com intenção ética para o bem maior de todos. Alinhe HRIM, Klim e Turbilhão com Vênus ao Norte Magnético (357°). Atenção clínica: não combine Harmonia e placas de Turbilhão simultaneamente na mesma etapa.',
    recommendedSequence:
      'Sequência sugerida: Decágono Duplo → Desembaraçador de Relacionamentos → Harmonia ou HRIM / Vênus.',
  },
];

function isValidCategory(cat: string): cat is PrintableGraphicCategory {
  return (PRINTABLE_GRAPHIC_CATEGORIES as string[]).includes(cat);
}

async function readAndOptimizeImageFile(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.readAsDataURL(file);
  });

  // Keep small files (< 450 KB) untouched for crisp vector-like PNG lines
  if (file.size <= 450 * 1024) {
    return { dataUrl: rawDataUrl, mimeType: file.type || 'image/png' };
  }

  // Downscale oversized images while preserving high A4 print sharpness (max 1800px)
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1800;
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && rawDataUrl.length < 900_000) {
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || 'image/png' });
        return;
      }
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || 'image/png' });
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const outUrl = canvas.toDataURL('image/png');
      resolve({ dataUrl: outUrl, mimeType: 'image/png' });
    };
    img.onerror = () => resolve({ dataUrl: rawDataUrl, mimeType: file.type || 'image/png' });
    img.src = rawDataUrl;
  });
}

export const GraficosRadionicosTab: React.FC<GraficosRadionicosTabProps> = ({
  onApplyProtocolToTable,
}) => {
  const [customGraphics, setCustomGraphics] = useState<PrintableGraphic[]>(() =>
    loadCustomPrintableGraphics()
  );
  const [hiddenOfficialIds, setHiddenOfficialIds] = useState<string[]>(() =>
    loadHiddenOfficialGraphics()
  );
  const [overrides, setOverrides] = useState<Record<string, PrintableGraphicOverride>>(() =>
    loadPrintableGraphicOverrides()
  );

  useEffect(() => {
    const syncFromStorage = () => {
      setCustomGraphics(loadCustomPrintableGraphics());
      setHiddenOfficialIds(loadHiddenOfficialGraphics());
      setOverrides(loadPrintableGraphicOverrides());
    };
    window.addEventListener(BACKUP_RESTORED_EVENT, syncFromStorage);
    return () => window.removeEventListener(BACKUP_RESTORED_EVENT, syncFromStorage);
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string>(
    BUILTIN_PRINTABLE_GRAPHICS[0]?.id || ''
  );
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [bwPreview, setBwPreview] = useState<boolean>(false);

  // Batch print state
  const [batchMode, setBatchMode] = useState<boolean>(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [includeNorthOnPrint, setIncludeNorthOnPrint] = useState<boolean>(false);
  const [printQueue, setPrintQueue] = useState<PrintableGraphic[]>([]);
  const [previewA4Graphics, setPreviewA4Graphics] = useState<PrintableGraphic[] | null>(null);

  // Inline delete confirm & status feedback
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // North Magnetic Compass Modal
  const [compassOpen, setCompassOpen] = useState<boolean>(false);
  const [compassTargetTitle, setCompassTargetTitle] = useState<string | undefined>(undefined);

  const openNorthCompass = (graphicTitle?: string) => {
    setCompassTargetTitle(graphicTitle);
    setCompassOpen(true);
  };

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingGraphic, setEditingGraphic] = useState<PrintableGraphic | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<PrintableGraphicCategory>('Personalizados');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formImageMime, setFormImageMime] = useState<string>('image/png');
  const [formPresentation, setFormPresentation] = useState<string>('');
  const [formUsageAspects, setFormUsageAspects] = useState<string>('');
  const [formRequiresNorth, setFormRequiresNorth] = useState<boolean>(false);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrFeedback, setOcrFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
    rawText?: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // AI Search Assistant state (when query has no exact plate name or 0 items)
  const [manualPlateOverride, setManualPlateOverride] = useState<boolean>(false);
  const [isConsultingAI, setIsConsultingAI] = useState<boolean>(false);
  const [aiConsultError, setAiConsultError] = useState<string | null>(null);
  const [aiConsultResult, setAiConsultResult] = useState<AiProtocolConsultResponse | null>(null);

  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);
  const quickAttachFileInputRef = useRef<HTMLInputElement | null>(null);
  const quickAttachTargetIdRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const studioDetailRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      aiAbortControllerRef.current?.abort();
    };
  }, []);

  // Merge official + overrides + custom, excluding hidden official graphics
  const allGraphics = useMemo<PrintableGraphic[]>(() => {
    const activeOfficials = BUILTIN_PRINTABLE_GRAPHICS.filter(
      (g) => !hiddenOfficialIds.includes(g.id)
    ).map((g) => {
      const ov = overrides[g.id];
      if (!ov) return g;
      return {
        ...g,
        ...ov,
      };
    });

    return [...activeOfficials, ...customGraphics];
  }, [customGraphics, hiddenOfficialIds, overrides]);

  const activePurpose = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    if (!q) return null;
    return FREQUENT_PURPOSES.find((p) => normalizeSearch(p.label) === q) || null;
  }, [searchQuery]);

  const matchedProtocol = useMemo<TherapeuticProtocolIndexItem | null>(() => {
    const q = normalizeSearch(searchQuery.trim());
    if (q.length < 2) return null;
    const rawTokens = q
      .split(/[\s,&/+;]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(t));
    const tokens = rawTokens.length > 0 ? rawTokens : [q];

    let best: { item: TherapeuticProtocolIndexItem; score: number } | null = null;
    for (const proto of THERAPEUTIC_PROTOCOLS_INDEX) {
      const protoText = normalizeSearch(
        `${proto.title} ${proto.categorySummary} ${proto.keywords.join(' ')}`
      );
      const protoWords = protoText.split(/[\s,&/+;.'"-]+/).filter(Boolean);
      let score = 0;
      if (proto.keywords.some((kw) => q.includes(normalizeSearch(kw)) || normalizeSearch(kw).includes(q))) {
        score += 10;
      }
      if (normalizeSearch(proto.title).includes(q)) {
        score += 12;
      }
      for (const tok of tokens) {
        if (tokenMatchesText(tok, protoText, protoWords)) {
          score += 4;
        }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { item: proto, score };
      }
    }
    return best?.item || null;
  }, [searchQuery]);

  const filteredGraphics = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    const categoryPool =
      selectedCategory === 'Todos'
        ? allGraphics
        : allGraphics.filter((g) => g.category === selectedCategory);

    if (!q) return categoryPool;

    if (activePurpose) {
      const normalizedKeywords = activePurpose.keywords.map((kw) => normalizeSearch(kw));
      const scored = categoryPool
        .map((g, index) => {
          const tagsStr = normalizeSearch((g.purposeTags || []).join(' '));
          const titleStr = normalizeSearch(g.title);
          const haystack = normalizeSearch(
            `${g.number} ${g.title} ${g.category} ${g.presentation} ${g.usageAspects} ${(g.purposeTags || []).join(' ')}`
          );
          let score = 0;
          for (const kw of normalizedKeywords) {
            if (haystack.includes(kw)) {
              score += 1;
              if (tagsStr.includes(kw)) score += 2;
              if (titleStr.includes(kw)) score += 3;
            }
          }
          return { g, score, index };
        })
        .filter((entry) => entry.score > 0);

      scored.sort((a, b) => b.score - a.score || a.index - b.index);
      return scored.map((entry) => entry.g);
    }

    const rawTokens = q
      .split(/[\s,&/+;]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !SEARCH_STOP_WORDS.has(t));
    const tokens = rawTokens.length > 0 ? rawTokens : [q];

    const scored = categoryPool
      .map((g, index) => {
        const tagsStr = normalizeSearch((g.purposeTags || []).join(' '));
        const titleStr = normalizeSearch(g.title);
        const haystack = normalizeSearch(
          `${g.number} ${g.title} ${g.category} ${g.presentation} ${g.usageAspects} ${(g.purposeTags || []).join(' ')}`
        );
        const haystackWords = haystack.split(/[\s,&/+;.'"-]+/).filter(Boolean);

        const exactMatch = haystack.includes(q);
        const tokenMatch = tokens.every((tok) => tokenMatchesText(tok, haystack, haystackWords));
        const protocolBoost = matchedProtocol?.graphicIds.includes(g.id) ? 5 : 0;

        if (!exactMatch && !tokenMatch && protocolBoost === 0) {
          return { g, score: 0, index };
        }

        let score = 1 + protocolBoost;
        if (exactMatch) score += 10;
        if (titleStr.includes(q)) score += 12;
        if (tagsStr.includes(q)) score += 8;
        for (const tok of tokens) {
          if (titleStr.includes(tok)) score += 4;
          if (tagsStr.includes(tok)) score += 3;
        }
        return { g, score, index };
      })
      .filter((entry) => entry.score > 0);

    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored.map((entry) => entry.g);
  }, [activePurpose, allGraphics, matchedProtocol, searchQuery, selectedCategory]);

  const hasExactTitleMatch = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    if (!q) return true;
    return allGraphics.some((g) => normalizeSearch(g.title).includes(q));
  }, [allGraphics, searchQuery]);

  const showSmartRecommendationCard = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return false;
    return !hasExactTitleMatch || filteredGraphics.length === 0;
  }, [filteredGraphics.length, hasExactTitleMatch, searchQuery]);

  const recommendedCombinationPlates = useMemo<PrintableGraphic[]>(() => {
    if (matchedProtocol) {
      const fromProtocol = matchedProtocol.graphicIds
        .map((id) => allGraphics.find((g) => g.id === id))
        .filter((g): g is PrintableGraphic => Boolean(g));
      if (fromProtocol.length > 0) return fromProtocol;
    }
    if (filteredGraphics.length > 0) {
      return filteredGraphics.slice(0, 6);
    }
    const starterIds = ['graf-02-decagono-duplo', 'graf-01-desimpregnador', 'graf-11-harmonia'];
    return starterIds
      .map((id) => allGraphics.find((g) => g.id === id))
      .filter((g): g is PrintableGraphic => Boolean(g));
  }, [allGraphics, filteredGraphics, matchedProtocol]);

  const selectedGraphic = useMemo(() => {
    if (manualPlateOverride) {
      return (
        allGraphics.find((g) => g.id === selectedId) ||
        filteredGraphics[0] ||
        allGraphics[0] ||
        null
      );
    }
    if (filteredGraphics.length > 0) {
      return (
        filteredGraphics.find((g) => g.id === selectedId) ||
        filteredGraphics[0]
      );
    }
    return allGraphics.find((g) => g.id === selectedId) || allGraphics[0] || null;
  }, [allGraphics, filteredGraphics, manualPlateOverride, selectedId]);

  const handleSearchChange = (nextValue: string) => {
    setSearchQuery(nextValue);
    setManualPlateOverride(false);
    setAiConsultResult(null);
    setAiConsultError(null);
    if (nextValue.trim().length > 0) {
      setSelectedCategory('Todos');
    }
  };

  const handleMagnifierSearch = () => {
    searchInputRef.current?.focus();
    setManualPlateOverride(false);
    if (searchQuery.trim().length > 0) {
      setSelectedCategory('Todos');
    }
    resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectPurposeChip = (purpose: FrequentPurposeShortcut) => {
    setManualPlateOverride(false);
    setAiConsultResult(null);
    setAiConsultError(null);
    if (activePurpose?.id === purpose.id) {
      setSearchQuery('');
      return;
    }
    setSelectedCategory('Todos');
    setSearchQuery(purpose.label);
  };

  const handleSelectCategoryTab = (cat: CategoryFilter) => {
    setSelectedCategory(cat);
    setSearchQuery('');
    setManualPlateOverride(false);
    setAiConsultResult(null);
    setAiConsultError(null);
  };

  const handleOpenPlateFromListOrCard = (plateId: string, scrollToDetail = false) => {
    setSelectedId(plateId);
    setManualPlateOverride(true);
    setConfirmDeleteId(null);
    if (scrollToDetail) {
      requestAnimationFrame(() => {
        studioDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  const findCatalogPlateByTitle = useCallback(
    (graphicTitle: string): PrintableGraphic | undefined => {
      const targetNorm = normalizeSearch(graphicTitle.trim());
      if (!targetNorm) return undefined;
      return (
        allGraphics.find((g) => normalizeSearch(g.title) === targetNorm) ||
        allGraphics.find(
          (g) =>
            normalizeSearch(g.title).includes(targetNorm) ||
            targetNorm.includes(normalizeSearch(g.title))
        )
      );
    },
    [allGraphics]
  );

  const buildLocalFallbackProtocol = useCallback(
    (cleanQuery: string): AiProtocolConsultResponse => {
      const decagono = allGraphics.find((g) => g.id === 'graf-02-decagono-duplo');
      const pool = recommendedCombinationPlates.slice(0, 5);
      const sequence: RecommendedProtocolSequenceItem[] = [];

      const hasDecagono = pool.some((p) => p.id === 'graf-02-decagono-duplo');
      if (decagono && !hasDecagono) {
        sequence.push({
          step: 'Etapa 0 — Preparo & Valorização',
          graphicTitle: decagono.title,
          role: 'Potencialização e materialização vibracional do testemunho escrito a lápis grafite antes das emissões principais.',
          alignment: decagono.requiresNorthAlignment
            ? 'Norte Magnético 357°'
            : 'Simetria omnidirecional',
          durationHint: '15–20 min iniciais',
        });
      }

      const stage1Plates = pool.filter(
        (p) =>
          p.category === 'Limpeza & Purificação' ||
          p.category === 'Proteção & Defesa Espiritual'
      );
      const stage2Plates = pool.filter(
        (p) =>
          p.category !== 'Limpeza & Purificação' &&
          p.category !== 'Proteção & Defesa Espiritual'
      );

      let hasTurbilhao = false;
      const ordered = [...stage1Plates, ...stage2Plates];
      ordered.forEach((plate) => {
        const normTitle = normalizeSearch(plate.title);
        if (normTitle.includes('turbilhao')) hasTurbilhao = true;
        if (hasTurbilhao && normTitle.includes('harmonia')) {
          return;
        }
        const isPrep = plate.id === 'graf-02-decagono-duplo';
        const isCleanup =
          plate.category === 'Limpeza & Purificação' ||
          plate.category === 'Proteção & Defesa Espiritual';
        sequence.push({
          step: isPrep
            ? 'Etapa 0 — Valorização do Testemunho'
            : isCleanup
              ? 'Etapa 1 — Limpeza & Proteção'
              : 'Etapa 2 — Harmonização & Potencialização',
          graphicTitle: plate.title,
          role: plate.presentation.split('.')[0]?.trim() || plate.presentation.slice(0, 140),
          alignment: plate.requiresNorthAlignment
            ? 'Norte Magnético 357°'
            : 'Simetria omnidirecional',
          durationHint: isPrep ? '15–20 min' : isCleanup ? '24h–48h no pêndulo' : '48h–72h no pêndulo',
        });
      });

      return {
        protocolTitle: matchedProtocol
          ? matchedProtocol.title
          : `Protocolo Combinado do Acervo: ${cleanQuery}`,
        clinicalRationale: matchedProtocol
          ? matchedProtocol.antiCatarseNote
          : `Sequência montada diretamente a partir do catálogo Maestro para "${cleanQuery}", respeitando o Protocolo Anti-Catarse (limpeza e proteção antes de acelerar ou harmonizar).`,
        recommendedSequence: sequence,
        witnessTemplate:
          matchedProtocol?.testimonyGuidance ||
          `[Nome Completo + Data de Nascimento] — Limpeza, equilíbrio e manifestação harmônica para ${cleanQuery}.`,
        kineticCommand: `Eu ativo e colapso neste campo radiônico a sequência terapêutica para ${cleanQuery}, promovendo assepsia áurica, proteção sutil e reequilíbrio integral na mais alta vibração. Está ativado, colapsado e manifestado na ordem cósmica.`,
        isLocalFallback: true,
      };
    },
    [allGraphics, matchedProtocol, recommendedCombinationPlates]
  );

  const handleConsultAiProtocol = async () => {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return;

    aiAbortControllerRef.current?.abort();
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;

    setIsConsultingAI(true);
    setAiConsultError(null);

    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      controller.abort();
    }, 18000);

    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/graficos/recommend-protocol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query: cleanQuery,
          availableGraphics: allGraphics.map((g) => ({
            number: String(g.number),
            title: g.title,
            category: g.category,
          })),
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await res.json()
        : { error: `Servidor retornou HTTP ${res.status}` };

      if (!res.ok) {
        throw new Error(payload?.error || `Erro HTTP ${res.status}`);
      }

      const normalizedResult: AiProtocolConsultResponse = {
        protocolTitle: String(payload?.protocolTitle || `Protocolo para ${cleanQuery}`),
        clinicalRationale: String(payload?.clinicalRationale || ''),
        recommendedSequence: Array.isArray(payload?.recommendedSequence)
          ? payload.recommendedSequence
          : [],
        witnessTemplate: String(payload?.witnessTemplate || ''),
        kineticCommand: String(payload?.kineticCommand || ''),
        isLocalFallback: false,
      };

      setAiConsultResult(normalizedResult);
    } catch (err) {
      const isTimeoutOrAbort =
        err instanceof DOMException
          ? err.name === 'AbortError'
          : err instanceof Error && err.name === 'AbortError';

      const baseMsg = isTimeoutOrAbort
        ? 'A consulta ao Gemini excedeu o tempo limite de 18 segundos.'
        : err instanceof Error
          ? err.message
          : 'Não foi possível consultar o protocolo na IA no momento.';

      setAiConsultError(
        `${baseMsg} Exibindo abaixo uma sugestão automática baseada no catálogo local para não interromper seu atendimento.`
      );
      setAiConsultResult(buildLocalFallbackProtocol(cleanQuery));
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (aiAbortControllerRef.current === controller) {
        aiAbortControllerRef.current = null;
      }
      setIsConsultingAI(false);
    }
  };

  // Sync default North alignment print checkbox when changing selected graphic
  useEffect(() => {
    if (selectedGraphic && !batchMode) {
      setIncludeNorthOnPrint(selectedGraphic.requiresNorthAlignment);
    }
  }, [selectedGraphic?.id, selectedGraphic?.requiresNorthAlignment, batchMode]);

  // Clean up print class after print dialog closes
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-radionic-charts');
      setPrintQueue([]);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-radionic-charts');
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const triggerA4Print = useCallback((items: PrintableGraphic[]) => {
    const printable = items.filter((g) => Boolean(resolveGraphicImageUrl(g.imageUrl)));
    if (printable.length === 0) {
      showToast('Anexe uma imagem da placa antes de imprimir em A4.');
      return;
    }
    setPrintQueue(printable);
    document.body.classList.add('printing-radionic-charts');
    // Allow React Portal to mount and paint images cleanly before calling window.print()
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 220);
    });
  }, [showToast]);

  const toggleBatchItem = (id: string) => {
    setBatchSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openAddModal = () => {
    setEditingGraphic(null);
    setFormTitle('');
    setFormCategory('Personalizados');
    setFormImageUrl('');
    setFormImageMime('image/png');
    setFormPresentation('');
    setFormUsageAspects('');
    setFormRequiresNorth(false);
    setOcrFeedback(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (graphic: PrintableGraphic) => {
    setEditingGraphic(graphic);
    setFormTitle(graphic.title);
    setFormCategory(graphic.category);
    setFormImageUrl(graphic.imageUrl);
    setFormImageMime('image/png');
    setFormPresentation(graphic.presentation);
    setFormUsageAspects(graphic.usageAspects);
    setFormRequiresNorth(graphic.requiresNorthAlignment);
    setOcrFeedback(null);
    setFormError(null);
    setModalOpen(true);
  };

  const handleModalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    setOcrFeedback(null);
    try {
      const { dataUrl, mimeType } = await readAndOptimizeImageFile(file);
      setFormImageUrl(dataUrl);
      setFormImageMime(mimeType);
      if (!formTitle.trim()) {
        const cleanFileName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (cleanFileName) setFormTitle(cleanFileName);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível carregar a imagem.');
    } finally {
      e.target.value = '';
    }
  };

  const handleQuickAttachImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = quickAttachTargetIdRef.current;
    e.target.value = '';
    if (!file || !targetId) return;

    try {
      const { dataUrl } = await readAndOptimizeImageFile(file);
      const target = allGraphics.find((g) => g.id === targetId);
      if (!target) return;

      if (target.isCustom) {
        const nextCustom = customGraphics.map((g) =>
          g.id === targetId ? { ...g, imageUrl: dataUrl } : g
        );
        saveCustomPrintableGraphics(nextCustom);
        setCustomGraphics(nextCustom);
      } else {
        const nextOverrides: Record<string, PrintableGraphicOverride> = {
          ...overrides,
          [targetId]: {
            ...(overrides[targetId] || {}),
            imageUrl: dataUrl,
          },
        };
        savePrintableGraphicOverrides(nextOverrides);
        setOverrides(nextOverrides);
      }

      setBrokenImages((prev) => {
        const copy = { ...prev };
        delete copy[targetId];
        return copy;
      });
      showToast(`Imagem anexada ao gráfico "${target.title}".`);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Erro ao salvar imagem (verifique o espaço de armazenamento).'
      );
    } finally {
      quickAttachTargetIdRef.current = null;
    }
  };

  const handleRunOcr = async () => {
    if (!formImageUrl) {
      setFormError('Envie ou selecione uma imagem do gráfico antes de executar o Leitor OCR.');
      return;
    }

    setOcrLoading(true);
    setOcrFeedback(null);
    setFormError(null);

    try {
      let base64ToSend = formImageUrl;
      let mimeToSend = formImageMime;

      // If current image is a static URL (e.g. /graficos/...), fetch and convert to base64
      if (!formImageUrl.startsWith('data:')) {
        const resolved = resolveGraphicImageUrl(formImageUrl) || formImageUrl;
        const imgRes = await fetch(resolved);
        if (!imgRes.ok) {
          throw new Error('Não foi possível carregar a imagem atual para leitura OCR.');
        }
        const blob = await imgRes.blob();
        mimeToSend = blob.type || 'image/png';
        base64ToSend = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Falha ao converter imagem para base64.'));
          reader.readAsDataURL(blob);
        });
      }

      const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/graficos/extract-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64ToSend,
          mimeType: mimeToSend,
          titleHint: formTitle.trim() || undefined,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await res.json()
        : { error: `Servidor retornou HTTP ${res.status}` };

      if (!res.ok) {
        throw new Error(payload?.error || `Erro HTTP ${res.status}`);
      }

      const ocr = payload as OcrExtractResponse;

      if (ocr.title && ocr.title.trim()) {
        setFormTitle(ocr.title.trim());
      }
      if (ocr.presentation && ocr.presentation.trim()) {
        setFormPresentation(ocr.presentation.trim());
      }
      if (ocr.usageAspects && ocr.usageAspects.trim()) {
        setFormUsageAspects(ocr.usageAspects.trim());
      }
      if (ocr.suggestedCategory && isValidCategory(ocr.suggestedCategory)) {
        setFormCategory(ocr.suggestedCategory);
      }
      if (typeof ocr.requiresNorthAlignment === 'boolean') {
        setFormRequiresNorth(ocr.requiresNorthAlignment);
      }

      if (ocr.hasText) {
        setOcrFeedback({
          type: 'success',
          message:
            'Texto identificado na imagem e extraído automaticamente para os campos abaixo. Revise antes de salvar.',
          rawText: ocr.rawExtractedText,
        });
      } else {
        setOcrFeedback({
          type: 'info',
          message:
            'A imagem contém apenas geometria/título simples sem texto explicativo longo. Preencha ou ajuste a Apresentação e os Aspectos de Uso manualmente.',
          rawText: ocr.rawExtractedText,
        });
      }
    } catch (err) {
      setOcrFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha ao executar leitura OCR com IA.',
      });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanTitle = formTitle.trim();
    if (!cleanTitle) {
      setFormError('Informe o título do gráfico radiônico.');
      return;
    }

    const cleanPresentation =
      formPresentation.trim() ||
      'Gráfico radiônico cadastrado pelo terapeuta para consulta e montagem física.';
    const cleanUsage =
      formUsageAspects.trim() ||
      '• Posicionar sobre superfície plana.\n• Utilizar testemunho a grafite valorizado no Decágono Duplo.';

    try {
      if (editingGraphic) {
        if (editingGraphic.isCustom) {
          const nextCustom = customGraphics.map((g) =>
            g.id === editingGraphic.id
              ? {
                  ...g,
                  title: cleanTitle,
                  category: formCategory,
                  imageUrl: formImageUrl,
                  presentation: cleanPresentation,
                  usageAspects: cleanUsage,
                  requiresNorthAlignment: formRequiresNorth,
                }
              : g
          );
          saveCustomPrintableGraphics(nextCustom);
          setCustomGraphics(nextCustom);
        } else {
          const nextOverrides: Record<string, PrintableGraphicOverride> = {
            ...overrides,
            [editingGraphic.id]: {
              title: cleanTitle,
              category: formCategory,
              imageUrl: formImageUrl,
              presentation: cleanPresentation,
              usageAspects: cleanUsage,
              requiresNorthAlignment: formRequiresNorth,
            },
          };
          savePrintableGraphicOverrides(nextOverrides);
          setOverrides(nextOverrides);
        }

        setBrokenImages((prev) => {
          const copy = { ...prev };
          delete copy[editingGraphic.id];
          return copy;
        });
        setSelectedId(editingGraphic.id);
        showToast(`Gráfico "${cleanTitle}" atualizado com sucesso.`);
      } else {
        const nextNumber =
          allGraphics.reduce((max, g) => Math.max(max, Number(g.number) || 0), 47) + 1;
        const newGraphic: PrintableGraphic = {
          id: `graf-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          number: nextNumber,
          title: cleanTitle,
          category: formCategory,
          imageUrl: formImageUrl,
          presentation: cleanPresentation,
          usageAspects: cleanUsage,
          requiresNorthAlignment: formRequiresNorth,
          isCustom: true,
        };
        const nextCustom = [newGraphic, ...customGraphics];
        saveCustomPrintableGraphics(nextCustom);
        setCustomGraphics(nextCustom);
        setSelectedCategory('Todos');
        setSearchQuery('');
        setSelectedId(newGraphic.id);
        showToast(`Novo gráfico "${cleanTitle}" salvo na biblioteca.`);
      }

      setModalOpen(false);
    } catch {
      setFormError(
        'Não foi possível salvar no navegador (limite de armazenamento atingido). Tente uma imagem menor.'
      );
    }
  };

  const handleDeleteGraphic = (graphic: PrintableGraphic) => {
    if (graphic.isCustom) {
      const nextCustom = customGraphics.filter((g) => g.id !== graphic.id);
      saveCustomPrintableGraphics(nextCustom);
      setCustomGraphics(nextCustom);
      showToast(`Gráfico personalizado "${graphic.title}" excluído.`);
    } else {
      const nextHidden = Array.from(new Set([...hiddenOfficialIds, graphic.id]));
      saveHiddenOfficialGraphics(nextHidden);
      setHiddenOfficialIds(nextHidden);
      showToast(`Gráfico "${graphic.title}" ocultado da biblioteca.`);
    }
    setBatchSelectedIds((prev) => prev.filter((id) => id !== graphic.id));
    setConfirmDeleteId(null);
    if (selectedId === graphic.id) {
      const remaining = allGraphics.filter((g) => g.id !== graphic.id);
      setSelectedId(remaining[0]?.id || '');
    }
  };

  const handleRestoreOfficial = () => {
    saveHiddenOfficialGraphics([]);
    setHiddenOfficialIds([]);
    showToast('Todos os gráficos nativos foram restaurados.');
  };

  const batchSelectedGraphics = useMemo(
    () => allGraphics.filter((g) => batchSelectedIds.includes(g.id)),
    [allGraphics, batchSelectedIds]
  );

  const selectedImageResolved = selectedGraphic
    ? resolveGraphicImageUrl(selectedGraphic.imageUrl)
    : undefined;
  const isSelectedImageMissingOrBroken = Boolean(
    selectedGraphic && (!selectedImageResolved || brokenImages[selectedGraphic.id])
  );

  return (
    <div className="space-y-6">
      {/* Hidden input for quick image attachment directly from placeholder */}
      <input
        ref={quickAttachFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jfif"
        onChange={handleQuickAttachImage}
        className="hidden"
      />

      {/* Editorial Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
            Estúdio Radiestésico & Montagem Física A4
          </p>
          <h1 className="mt-1 font-serif text-3xl font-light text-[#0F172A]">
            Gráficos Radiônicos
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
            <span className="font-mono tabular-nums font-semibold text-[#0F172A]">
              {allGraphics.length} gráficos ativos
            </span>
            <span aria-hidden="true">·</span>
            <span>Consulta terapêutica completa</span>
            <span aria-hidden="true">·</span>
            <span>Impressão A4 em preto e branco puro</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {hiddenOfficialIds.length > 0 && (
            <button
              type="button"
              onClick={handleRestoreOfficial}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#45464D] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#B45309] hover:text-[#0F172A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#B45309]" />
              Restaurar Ocultos ({hiddenOfficialIds.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => openNorthCompass(undefined)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-[#FEFCE8] border border-[#D97706]/50 rounded-lg hover:bg-[#FEF3C7] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5 text-[#B45309]" />
            Bússola de Alinhamento (Norte 357°)
          </button>

          <button
            type="button"
            onClick={() => {
              setBatchMode((prev) => {
                const next = !prev;
                if (!next) setBatchSelectedIds([]);
                return next;
              });
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              batchMode
                ? 'bg-[#FEFCE8] text-[#92400E] border-[#D97706]'
                : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#D97706]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#B45309]" />
            {batchMode ? 'Sair do Modo Lote' : 'Selecionar Vários para Impressão em Lote'}
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] border border-[#B45309]/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-[#F59E0B]" />
            + Adicionar Novo Gráfico
          </button>
        </div>
      </section>

      {statusNotice && (
        <div
          role="status"
          className="px-4 py-3 rounded-lg bg-white border border-[#B45309]/50 text-xs font-medium text-[#0F172A] flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#B45309] shrink-0" />
            {statusNotice}
          </span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-[#64748B] hover:text-[#0F172A] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={handleMagnifierSearch}
              aria-label="Buscar gráficos radiônicos"
              title="Executar busca"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[#64748B] hover:text-[#B45309] hover:bg-[#E2E8F0]/60 transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleMagnifierSearch();
                }
              }}
              placeholder="Buscar gráfico por nome, propósito (ex: dinheiro inesperado, ansiedade, dor)..."
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#B45309]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <span className="text-xs font-mono tabular-nums text-[#64748B] whitespace-nowrap shrink-0">
            Exibindo {filteredGraphics.length} de {allGraphics.length} placas
          </span>
        </div>

        {/* Quick Therapeutic Purpose Shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mr-1 whitespace-nowrap">
            Propósitos Frequentes:
          </span>
          {FREQUENT_PURPOSES.map((purpose) => {
            const isActive = activePurpose?.id === purpose.id;
            return (
              <button
                key={purpose.id}
                type="button"
                onClick={() => handleSelectPurposeChip(purpose)}
                aria-pressed={isActive}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#FEFCE8] text-[#92400E] border-[#D97706] font-semibold'
                    : 'bg-white text-[#45464D] border-[#E2E8F0] hover:border-[#B45309] hover:text-[#0F172A]'
                }`}
              >
                {purpose.label}
              </button>
            );
          })}
        </div>

        {/* Clinical Synergy Tip Card when a Purpose Shortcut is active */}
        {activePurpose && (
          <div className="rounded-xl border border-[#D97706]/40 bg-[#FEFCE8]/75 px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Lightbulb className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-[#92400E]">
                  {activePurpose.synergyTitle}
                </p>
                <p className="text-[#45464D] leading-relaxed">
                  {activePurpose.synergyAdvice}
                </p>
                <p className="font-medium text-[#0F172A]">
                  {activePurpose.recommendedSequence}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              aria-label="Limpar filtro de propósito"
              title="Limpar filtro de propósito"
              className="p-1 text-[#92400E]/70 hover:text-[#0F172A] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Categorias de Gráficos Radiônicos"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(['Todos', ...PRINTABLE_GRAPHIC_CATEGORIES] as CategoryFilter[]).map((cat) => {
            const active = selectedCategory === cat;
            const count =
              cat === 'Todos'
                ? allGraphics.length
                : allGraphics.filter((g) => g.category === cat).length;
            if (cat === 'Personalizados' && count === 0 && !active) return null;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectCategoryTab(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#0F172A] text-white border-[#0F172A]'
                    : 'bg-[#FAF8F5] text-[#45464D] border-[#E2E8F0] hover:border-[#B45309] hover:text-[#0F172A]'
                }`}
              >
                {cat}{' '}
                <span className={`font-mono tabular-nums ${active ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Smart Search Assistant: Clinical Recommendation Card */}
        {showSmartRecommendationCard && (
          <div className="rounded-xl border border-[#D97706]/45 bg-[#FAF8F5] p-4 space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                  Assistente de Busca Inteligente — Recomendação Clínica
                </p>
                <h3 className="font-serif text-base font-bold text-[#0F172A]">
                  {filteredGraphics.length === 0
                    ? `Nenhuma placa possui exatamente o título "${searchQuery.trim()}"`
                    : matchedProtocol
                      ? `Protocolo recomendado: ${matchedProtocol.title}`
                      : `Combinação sugerida no acervo para "${searchQuery.trim()}"`}
                </h3>
                <p className="text-xs text-[#45464D] leading-relaxed">
                  {matchedProtocol
                    ? matchedProtocol.antiCatarseNote
                    : 'Estas placas do seu catálogo se combinam para atuar sobre a demanda buscada. Clique em qualquer placa abaixo para abri-la imediatamente ou consulte a IA para montar o protocolo completo.'}
                </p>
              </div>

              <button
                type="button"
                disabled={isConsultingAI}
                onClick={handleConsultAiProtocol}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] border border-[#B45309]/50 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isConsultingAI ? (
                  <Loader2 className="w-4 h-4 text-[#F59E0B] animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                )}
                {isConsultingAI
                  ? 'Consultando Protocolo (Gemini)...'
                  : 'Consultar Protocolo com IA (Gemini)'}
              </button>
            </div>

            {/* Clickable Plate Buttons from Catalog */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-[#64748B]">
                Placas compatíveis no acervo atual (clique para abrir e imprimir):
              </span>
              <div className="flex flex-wrap gap-2">
                {recommendedCombinationPlates.map((plate) => {
                  const isCurrent = selectedGraphic?.id === plate.id;
                  return (
                    <button
                      key={`rec-${plate.id}`}
                      type="button"
                      onClick={() => {
                        handleOpenPlateFromListOrCard(plate.id, true);
                        showToast(`Placa "${plate.title}" selecionada no estúdio.`);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        isCurrent
                          ? 'bg-[#FEFCE8] text-[#92400E] border-[#D97706]'
                          : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#B45309]'
                      }`}
                    >
                      <span className="font-mono tabular-nums text-[#B45309]">
                        Nº {String(plate.number).padStart(2, '0')}
                      </span>
                      <span>{plate.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {matchedProtocol && !aiConsultResult && (
              <div className="p-3 rounded-lg bg-white border border-[#E2E8F0] text-xs space-y-1">
                <span className="font-semibold text-[#0F172A]">
                  Modelo rápido de testemunho (grafite no Decágono Duplo):
                </span>
                <p className="font-mono text-[11px] text-[#334155]">
                  {matchedProtocol.testimonyGuidance}
                </p>
              </div>
            )}

            {aiConsultError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-[#BA1A1A]/5 border border-[#BA1A1A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="flex items-start gap-2 text-xs font-medium text-[#93000A]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{aiConsultError}</span>
                </div>
                <button
                  type="button"
                  disabled={isConsultingAI}
                  onClick={handleConsultAiProtocol}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#93000A] bg-white border border-[#BA1A1A]/35 rounded-lg hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Tentar Novamente
                </button>
              </div>
            )}

            {aiConsultResult && (
              <div className="p-4 rounded-xl bg-white border border-[#D97706]/45 space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                      {aiConsultResult.isLocalFallback
                        ? 'Protocolo Clínico Sugerido (Fallback Local do Catálogo)'
                        : 'Protocolo Clínico Sugerido pela IA'}
                    </p>
                    <h4 className="font-serif text-base font-bold text-[#0F172A]">
                      {aiConsultResult.protocolTitle}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAiConsultResult(null);
                      setAiConsultError(null);
                    }}
                    aria-label="Fechar protocolo sugerido"
                    className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-[#334155] leading-relaxed">
                  {aiConsultResult.clinicalRationale}
                </p>

                {/* Recommended Staged Sequence */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#0F172A]">
                    Sequência Escalonada Anti-Catarse (clique na placa para abrir e imprimir em A4):
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {aiConsultResult.recommendedSequence.map((item, idx) => {
                      const catalogPlate = findCatalogPlateByTitle(item.graphicTitle);
                      return (
                        <div
                          key={`${item.graphicTitle}-${idx}`}
                          className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] flex flex-col justify-between gap-2"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                                {item.step}
                              </span>
                              <span className="text-[11px] font-mono text-[#64748B] whitespace-nowrap">
                                {item.alignment}
                              </span>
                            </div>

                            {catalogPlate ? (
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenPlateFromListOrCard(catalogPlate.id, true);
                                  showToast(`Placa "${catalogPlate.title}" aberta no estúdio.`);
                                }}
                                className="text-left text-xs font-bold text-[#0F172A] hover:text-[#B45309] hover:underline cursor-pointer flex items-center gap-1.5"
                              >
                                <span className="font-mono tabular-nums text-[#B45309]">
                                  Nº {String(catalogPlate.number).padStart(2, '0')}
                                </span>
                                <span>· {catalogPlate.title}</span>
                              </button>
                            ) : (
                              <span className="block text-xs font-bold text-[#0F172A]">
                                {item.graphicTitle}
                              </span>
                            )}

                            <p className="text-[11px] text-[#45464D] leading-snug">{item.role}</p>
                          </div>

                          <div className="pt-1.5 border-t border-[#E2E8F0]/80 flex items-center justify-between text-[11px] text-[#0F172A]">
                            <span className="font-medium">Tempo: {item.durationHint}</span>
                            {catalogPlate && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenPlateFromListOrCard(catalogPlate.id, true);
                                  showToast(`Placa "${catalogPlate.title}" aberta no estúdio.`);
                                }}
                                className="font-semibold text-[#B45309] hover:underline cursor-pointer whitespace-nowrap"
                              >
                                Abrir Placa
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Witness & Kinetic Command */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#FEFCE8]/75 border border-[#D97706]/35 space-y-1.5">
                    <span className="block text-xs font-semibold text-[#92400E]">
                      Testemunho (lápis grafite em papel branco):
                    </span>
                    <p className="font-mono text-xs text-[#0F172A] select-all leading-relaxed">
                      {aiConsultResult.witnessTemplate}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-1.5">
                    <span className="block text-xs font-semibold text-[#0F172A]">
                      Comando Cinético (Rotação Horária do Pêndulo):
                    </span>
                    <p className="text-xs italic text-[#334155] select-all leading-relaxed">
                      “{aiConsultResult.kineticCommand}”
                    </p>
                  </div>
                </div>

                {/* Action Footer: Copy Protocol & Apply Plates to Mesa Radiônica */}
                <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const sequenceText = aiConsultResult.recommendedSequence
                        .map(
                          (s, i) =>
                            `${i + 1}. [${s.step}] ${s.graphicTitle} (${s.alignment} · ${s.durationHint})\n   Atuação: ${s.role}`
                        )
                        .join('\n');
                      const fullText = [
                        `PROTOCOLO RADIÔNICO — ${aiConsultResult.protocolTitle}`,
                        '',
                        aiConsultResult.clinicalRationale,
                        '',
                        'SEQUÊNCIA DE PLACAS:',
                        sequenceText,
                        '',
                        `TESTEMUNHO (GRAFITE): ${aiConsultResult.witnessTemplate}`,
                        '',
                        `COMANDO CINÉTICO: "${aiConsultResult.kineticCommand}"`,
                      ].join('\n');
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(fullText);
                        showToast('Protocolo completo copiado para a área de transferência.');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg hover:border-[#B45309] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#B45309]" />
                    Copiar Protocolo
                  </button>

                  {onApplyProtocolToTable && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyProtocolToTable(
                          aiConsultResult.protocolTitle,
                          aiConsultResult.recommendedSequence,
                          aiConsultResult.witnessTemplate
                        );
                        showToast('Placas do protocolo aplicadas na Mesa Radiônica.');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0F172A] border border-[#B45309]/50 rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#F59E0B]" />
                      Aplicar Placas na Mesa Radiônica
                      <ArrowRight className="w-3.5 h-3.5 text-[#F59E0B]" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Batch Selection Action Strip */}
        {batchMode && (
          <div className="pt-3 border-t border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-[#0F172A] font-mono tabular-nums">
                {batchSelectedIds.length} placa(s) selecionada(s) para lote A4
              </span>
              <button
                type="button"
                onClick={() =>
                  setBatchSelectedIds(
                    Array.from(
                      new Set([...batchSelectedIds, ...filteredGraphics.map((g) => g.id)])
                    )
                  )
                }
                className="text-xs font-semibold text-[#B45309] hover:underline cursor-pointer whitespace-nowrap"
              >
                Selecionar Visíveis ({filteredGraphics.length})
              </button>
              {batchSelectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBatchSelectedIds([])}
                  className="text-xs font-medium text-[#64748B] hover:text-[#0F172A] cursor-pointer whitespace-nowrap"
                >
                  Limpar Seleção
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-[#0F172A] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeNorthOnPrint}
                  onChange={(e) => setIncludeNorthOnPrint(e.target.checked)}
                  className="w-4 h-4 accent-[#0F172A] rounded cursor-pointer"
                />
                <span>Imprimir indicador discreto N ↑ (Norte Magnético)</span>
              </label>

              <button
                type="button"
                disabled={batchSelectedGraphics.length === 0}
                onClick={() => setPreviewA4Graphics(batchSelectedGraphics)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#B45309] disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5 text-[#B45309]" />
                Pré-visualizar A4
              </button>

              <button
                type="button"
                disabled={batchSelectedGraphics.length === 0}
                onClick={() => triggerA4Print(batchSelectedGraphics)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-[#F59E0B]" />
                Imprimir Lote em A4 ({batchSelectedGraphics.length})
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main Split Workspace: Left List + Right Detail & A4 Studio */}
      <div
        ref={resultsSectionRef}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start scroll-mt-4"
      >
        {/* Left List */}
        <aside className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#FAF8F5] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#0F172A]">
              Acervo Catalogado
            </span>
            <span className="text-[11px] font-mono tabular-nums text-[#64748B]">
              {filteredGraphics.length} itens
            </span>
          </div>

          {filteredGraphics.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="font-serif text-sm font-semibold text-[#0F172A]">
                Nenhum gráfico literal encontrado para &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="text-xs text-[#64748B]">
                Utilize o Card de Recomendação Clínica acima ou consulte o protocolo com a IA (Gemini).
              </p>
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg hover:border-[#B45309] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#B45309]" />
                Exibir todos os {allGraphics.length} gráficos
              </button>
            </div>
          ) : (
            <div className="max-h-[540px] lg:max-h-[720px] overflow-y-auto divide-y divide-[#F1F5F9]">
              {filteredGraphics.map((graphic) => {
                const isSelected = selectedGraphic?.id === graphic.id;
                const isBatchChecked = batchSelectedIds.includes(graphic.id);
                const thumbUrl = resolveGraphicImageUrl(graphic.imageUrl);
                const isBroken = !thumbUrl || brokenImages[graphic.id];

                return (
                  <div
                    key={graphic.id}
                    className={`flex items-stretch gap-3 p-3.5 transition-colors ${
                      isSelected ? 'bg-[#FEFCE8]/70' : 'bg-white hover:bg-[#FAF8F5]'
                    }`}
                  >
                    {batchMode && (
                      <button
                        type="button"
                        onClick={() => toggleBatchItem(graphic.id)}
                        aria-label={`Selecionar ${graphic.title} para impressão em lote`}
                        className="flex items-center justify-center px-1 text-[#0F172A] cursor-pointer shrink-0"
                      >
                        {isBatchChecked ? (
                          <CheckSquare className="w-5 h-5 text-[#B45309]" />
                        ) : (
                          <Square className="w-5 h-5 text-[#94A3B8]" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenPlateFromListOrCard(graphic.id)}
                      className="flex-1 min-w-0 flex items-start gap-3 text-left cursor-pointer"
                    >
                      <div className="w-14 h-16 rounded-lg border border-[#E2E8F0] bg-white flex items-center justify-center overflow-hidden shrink-0">
                        {!isBroken ? (
                          <img
                            src={thumbUrl}
                            alt={graphic.title}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenImages((prev) => ({ ...prev, [graphic.id]: true }))
                            }
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <ImagePlus className="w-5 h-5 text-[#94A3B8]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
                          <span className="font-mono tabular-nums font-semibold text-[#B45309]">
                            Nº {String(graphic.number).padStart(2, '0')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{graphic.category}</span>
                          {graphic.requiresNorthAlignment && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#0F172A] font-medium">Norte ↑</span>
                            </>
                          )}
                          {graphic.isCustom && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#B45309] font-medium">Terapeuta</span>
                            </>
                          )}
                        </div>

                        <h2 className="font-serif text-sm font-bold text-[#0F172A] truncate">
                          {graphic.title}
                        </h2>

                        <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed">
                          {graphic.presentation}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Right Detail Studio */}
        <section
          ref={studioDetailRef}
          className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 space-y-6 scroll-mt-4"
        >
          {selectedGraphic ? (
            <>
              {/* Title + Metadata + Edit/Delete */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <span className="font-mono tabular-nums font-semibold text-[#B45309]">
                      Placa Nº {String(selectedGraphic.number).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedGraphic.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[#0F172A]">
                      <Compass className="w-3.5 h-3.5 text-[#B45309]" />
                      {selectedGraphic.requiresNorthAlignment
                        ? 'Requer alinhamento ao Norte Magnético'
                        : 'Simetria omnidirecional (Norte opcional)'}
                    </span>
                    {selectedGraphic.requiresNorthAlignment && (
                      <button
                        type="button"
                        onClick={() => openNorthCompass(selectedGraphic.title)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-[#92400E] bg-[#FEFCE8] border border-[#D97706]/50 rounded hover:bg-[#FEF3C7] cursor-pointer whitespace-nowrap"
                      >
                        <Compass className="w-3 h-3 text-[#B45309]" />
                        Abrir Bússola (357°)
                      </button>
                    )}
                  </div>
                  <h2 className="font-serif text-2xl font-bold text-[#0F172A]">
                    {selectedGraphic.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedGraphic)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg hover:border-[#B45309] cursor-pointer whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#B45309]" />
                    Editar Texto / Imagem
                  </button>

                  {confirmDeleteId === selectedGraphic.id ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteGraphic(selectedGraphic)}
                        className="px-3 py-2 text-xs font-semibold text-white bg-[#BA1A1A] rounded-lg hover:bg-[#93000A] cursor-pointer whitespace-nowrap"
                      >
                        Confirmar Exclusão
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-2 text-xs font-medium text-[#64748B] bg-white border border-[#CBD5E1] rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(selectedGraphic.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#BA1A1A] bg-white border border-[#E2E8F0] rounded-lg hover:border-[#BA1A1A]/50 cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </button>
                  )}
                </div>
              </div>

              {/* A4 Print Control Bar */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0F172A] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeNorthOnPrint}
                      onChange={(e) => setIncludeNorthOnPrint(e.target.checked)}
                      className="w-4 h-4 accent-[#0F172A] rounded cursor-pointer"
                    />
                    <span>Imprimir indicador discreto N ↑ (Norte Magnético) no topo da folha</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bwPreview}
                      onChange={(e) => setBwPreview(e.target.checked)}
                      className="w-4 h-4 accent-[#0F172A] rounded cursor-pointer"
                    />
                    <span>Pré-visualizar contraste em preto e branco puro (padrão impressão)</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isSelectedImageMissingOrBroken}
                    onClick={() => setPreviewA4Graphics([selectedGraphic])}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#B45309] disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#B45309]" />
                    Visualizar A4
                  </button>
                  <button
                    type="button"
                    disabled={isSelectedImageMissingOrBroken}
                    onClick={() => triggerA4Print([selectedGraphic])}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] border border-[#B45309]/40 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4 text-[#F59E0B]" />
                    Imprimir Placa em A4
                  </button>
                </div>
              </div>

              {/* Plate Artwork Viewport */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-6 flex flex-col items-center justify-center min-h-[340px]">
                {isSelectedImageMissingOrBroken ? (
                  <div className="py-10 px-4 text-center space-y-3 max-w-md">
                    <div className="w-14 h-14 mx-auto rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] flex items-center justify-center">
                      <ImagePlus className="w-7 h-7 text-[#B45309]" />
                    </div>
                    <h3 className="font-serif text-base font-bold text-[#0F172A]">
                      Imagem da placa ainda não anexada
                    </h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Envie a imagem PNG, JPG ou WEBP deste gráfico para habilitar a visualização
                      em alta definição e a impressão em folha A4.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        quickAttachTargetIdRef.current = selectedGraphic.id;
                        quickAttachFileInputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-[#F59E0B]" />
                      Anexar Imagem da Placa
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    {includeNorthOnPrint && (
                      <p className="text-[11px] font-mono font-bold tracking-widest text-[#0F172A] pb-2">
                        N ↑ (NORTE MAGNÉTICO)
                      </p>
                    )}
                    <img
                      src={selectedImageResolved}
                      alt={`Placa radiônica ${selectedGraphic.title}`}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImages((prev) => ({
                          ...prev,
                          [selectedGraphic.id]: true,
                        }))
                      }
                      className={`w-full max-w-[540px] max-h-[520px] object-contain mx-auto select-none transition-all ${
                        bwPreview ? 'grayscale contrast-125 brightness-105' : ''
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* Clinical Presentation & Practical Usage */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-2">
                    Apresentação Completa
                  </h3>
                  <p className="text-sm text-[#334155] leading-relaxed whitespace-pre-line">
                    {selectedGraphic.presentation}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="font-serif text-base font-bold text-[#0F172A]">
                      Aspectos Práticos de Uso & Montagem Física
                    </h3>
                    {selectedGraphic.requiresNorthAlignment && (
                      <button
                        type="button"
                        onClick={() => openNorthCompass(selectedGraphic.title)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#D97706]/50 rounded-lg hover:bg-[#FEFCE8] cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Compass className="w-3.5 h-3.5 text-[#B45309]" />
                        Alinhar ao Norte Magnético (357°)
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-[#334155] leading-relaxed whitespace-pre-line">
                    {selectedGraphic.usageAspects}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-16 text-center space-y-2">
              <p className="font-serif text-base font-semibold text-[#0F172A]">
                Nenhum gráfico selecionado
              </p>
              <p className="text-xs text-[#64748B]">
                Selecione uma placa na lista à esquerda ou adicione um novo gráfico personalizado.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* A4 On-Screen Print Preview Modal */}
      {previewA4Graphics && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pré-visualização de Impressão A4"
          className="fixed inset-0 z-50 bg-[#0F172A]/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E2E8F0] rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-base font-bold text-[#0F172A]">
                  Pré-visualização A4 — Preto e Branco Puro ({previewA4Graphics.length}{' '}
                  {previewA4Graphics.length === 1 ? 'página' : 'páginas'})
                </h3>
                <p className="text-xs text-[#64748B]">
                  Cada placa ocupa o máximo da folha A4 em escala de cinza de alto contraste.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const items = previewA4Graphics;
                    setPreviewA4Graphics(null);
                    triggerA4Print(items);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Imprimir Agora
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewA4Graphics(null)}
                  aria-label="Fechar pré-visualização"
                  className="p-2 text-[#64748B] hover:text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-[#E2E8F0]/60 space-y-6">
              {previewA4Graphics.map((g) => {
                const imgUrl = resolveGraphicImageUrl(g.imageUrl);
                return (
                  <div
                    key={`preview-${g.id}`}
                    className="mx-auto w-full max-w-[460px] aspect-[210/297] bg-white border border-[#CBD5E1] shadow-sm p-5 flex flex-col items-center justify-center"
                  >
                    {includeNorthOnPrint && (
                      <div className="font-mono text-xs font-bold tracking-widest text-black pb-3 shrink-0">
                        N ↑ (NORTE MAGNÉTICO)
                      </div>
                    )}
                    <div className="flex-1 w-full min-h-0 flex items-center justify-center">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={g.title}
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-full object-contain grayscale contrast-125 brightness-105"
                        />
                      ) : (
                        <span className="text-xs text-[#64748B]">Sem imagem anexada</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Graphic Modal with Gemini 3.8 Flash OCR */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingGraphic ? 'Editar Gráfico Radiônico' : 'Adicionar Novo Gráfico'}
          className="fixed inset-0 z-50 bg-[#0F172A]/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E2E8F0] rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#FAF8F5] flex items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                  {editingGraphic
                    ? `Editar Gráfico — ${editingGraphic.title}`
                    : '+ Adicionar Novo Gráfico Radiônico'}
                </h2>
                <p className="text-xs text-[#64748B]">
                  Suba a imagem da placa e utilize o Leitor OCR com IA ou preencha manualmente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar modal"
                className="p-2 text-[#64748B] hover:text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 overflow-y-auto space-y-5">
              {/* Image Upload + OCR Trigger */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">
                      1. Imagem da Placa Radiônica (PNG / JPG / WEBP)
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      Caso a imagem possua textos descritivos, use o Leitor OCR para preencher tudo.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jfif"
                      onChange={handleModalImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => modalFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#B45309] cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#B45309]" />
                      {formImageUrl ? 'Trocar Imagem' : 'Selecionar Imagem'}
                    </button>

                    <button
                      type="button"
                      disabled={!formImageUrl || ocrLoading}
                      onClick={handleRunOcr}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] border border-[#B45309]/40 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      {ocrLoading ? (
                        <Loader2 className="w-3.5 h-3.5 text-[#F59E0B] animate-spin" />
                      ) : (
                        <ScanText className="w-3.5 h-3.5 text-[#F59E0B]" />
                      )}
                      {ocrLoading ? 'Lendo imagem (OCR)...' : 'Leitor OCR com IA'}
                    </button>
                  </div>
                </div>

                {formImageUrl && (
                  <div className="flex items-center gap-4 pt-2 border-t border-[#E2E8F0]">
                    <div className="w-20 h-24 bg-white border border-[#CBD5E1] rounded-lg p-1 flex items-center justify-center shrink-0">
                      <img
                        src={resolveGraphicImageUrl(formImageUrl)}
                        alt="Pré-visualização do gráfico"
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="text-xs text-[#45464D] space-y-1">
                      <p className="font-semibold text-[#0F172A]">Imagem carregada e pronta.</p>
                      <button
                        type="button"
                        onClick={() => setFormImageUrl('')}
                        className="text-xs font-semibold text-[#BA1A1A] hover:underline cursor-pointer"
                      >
                        Remover imagem
                      </button>
                    </div>
                  </div>
                )}

                {ocrFeedback && (
                  <div
                    role="status"
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      ocrFeedback.type === 'error'
                        ? 'bg-[#BA1A1A]/5 border-[#BA1A1A]/30 text-[#93000A]'
                        : ocrFeedback.type === 'success'
                        ? 'bg-[#F0FDF4] border-[#16A34A]/30 text-[#166534]'
                        : 'bg-white border-[#D97706]/40 text-[#92400E]'
                    }`}
                  >
                    <p className="font-medium">{ocrFeedback.message}</p>
                    {ocrFeedback.rawText && ocrFeedback.rawText.trim() !== '' && (
                      <details className="text-[11px] opacity-90">
                        <summary className="cursor-pointer font-semibold">
                          Ver texto bruto lido na imagem
                        </summary>
                        <p className="mt-1 whitespace-pre-line font-mono bg-white/70 p-2 rounded border border-current/15">
                          {ocrFeedback.rawText}
                        </p>
                      </details>
                    )}
                  </div>
                )}
              </div>

              {/* Title + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="graphic-form-title"
                    className="block text-xs font-semibold text-[#0F172A]"
                  >
                    Título do Gráfico *
                  </label>
                  <input
                    id="graphic-form-title"
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex.: Turbilhão com Prosperador"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="graphic-form-category"
                    className="block text-xs font-semibold text-[#0F172A]"
                  >
                    Categoria Terapêutica
                  </label>
                  <select
                    id="graphic-form-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as PrintableGraphicCategory)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                  >
                    {PRINTABLE_GRAPHIC_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* North Alignment Toggle */}
              <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#0F172A] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formRequiresNorth}
                  onChange={(e) => setFormRequiresNorth(e.target.checked)}
                  className="w-4 h-4 accent-[#0F172A] rounded cursor-pointer"
                />
                <span>Requer alinhamento ao Norte Magnético na montagem física</span>
              </label>

              {/* Presentation */}
              <div className="space-y-1.5">
                <label
                  htmlFor="graphic-form-presentation"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  Apresentação Completa & Finalidade Energética
                </label>
                <textarea
                  id="graphic-form-presentation"
                  rows={4}
                  value={formPresentation}
                  onChange={(e) => setFormPresentation(e.target.value)}
                  placeholder="Descreva a atuação energética, os benefícios clínicos e a geometria do gráfico..."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                />
              </div>

              {/* Practical Usage */}
              <div className="space-y-1.5">
                <label
                  htmlFor="graphic-form-usage"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  Aspectos Práticos de Uso (Norte, Testemunho, Decágono, Água, Ambiente)
                </label>
                <textarea
                  id="graphic-form-usage"
                  rows={4}
                  value={formUsageAspects}
                  onChange={(e) => setFormUsageAspects(e.target.value)}
                  placeholder="• Alinhamento ao Norte Magnético...&#10;• Preparo do testemunho a grafite...&#10;• Tempo recomendado e uso em água ou ambiente..."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#B45309]"
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-[#BA1A1A]/5 border border-[#BA1A1A]/30 text-xs font-medium text-[#93000A]"
                >
                  {formError}
                </div>
              )}

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] bg-white border border-[#CBD5E1] rounded-lg hover:text-[#0F172A] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] border border-[#B45309]/40 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-[#F59E0B]" />
                  {editingGraphic ? 'Salvar Alterações' : 'Cadastrar Gráfico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* A4 Print Portal injected directly into document.body for pure @media print */}
      {printQueue.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="radionic-print-portal" aria-hidden="true">
            {printQueue.map((graphic) => {
              const url = resolveGraphicImageUrl(graphic.imageUrl);
              if (!url) return null;
              return (
                <div key={`print-${graphic.id}`} className="radionic-print-page">
                  {includeNorthOnPrint && (
                    <div className="radionic-print-north">N ↑ (NORTE MAGNÉTICO)</div>
                  )}
                  <div className="radionic-print-image-wrap">
                    <img
                      src={url}
                      alt={graphic.title}
                      className="radionic-print-image"
                    />
                  </div>
                </div>
              );
            })}
          </div>,
          document.body
        )}
      {/* North Magnetic Compass Modal */}
      <NorthCompassModal
        isOpen={compassOpen}
        onClose={() => setCompassOpen(false)}
        graphicTitle={compassTargetTitle}
      />
    </div>
  );
};
