import {
  AntiCatharsisProtocol,
  ChartWithdrawalLogEntry,
  EnergeticRemedyEmission,
  InteragentType,
  PetSpecies,
  QuantumGenerationResult,
  RoomPhase,
} from './quantum';
export type { ChartWithdrawalLogEntry };

export type SessionMilestoneType =
  | 'Avaliação Inicial'
  | 'Pós-Tratamento 1'
  | 'Pós-Tratamento 2'
  | 'Novo Ciclo';

export type RootProblemDomain =
  | 'Físico'
  | 'Emocional'
  | 'Mental'
  | 'Espiritual'
  | 'Aura'
  | 'Órgãos';

export type ChakraPolarityStatus = 'Hipo' | 'Normal' | 'Hiper' | 'Nulo';

export type AuraProtectionLevel = 'Aberta 0%' | 'Média 50%' | 'Fechada 100%';
export type AuraSizeLevel = 'Encolhida' | 'Regular' | 'Expandida';
export type LifeAreaRating = 'Péssimo' | 'Ruim' | 'Bom' | 'Excelente';

export type AnsaeSystemCode =
  | 'SC'
  | 'SD'
  | 'SEnd'
  | 'SExc'
  | 'SI'
  | 'SL'
  | 'SNC'
  | 'SNP'
  | 'SRep'
  | 'SResp'
  | 'SS'
  | 'SU'
  | 'SEsq'
  | 'SM'
  | 'ST';

export interface ElectromagneticFieldReading {
  id: 'mental' | 'emocional' | 'espiritual' | 'fisico';
  label: string;
  imbalancePercent: number; // 0 - 100
  affectedChakras: string[];
}

export interface AnsaeChakraReading {
  id: string;
  name: string;
  sanskrit: string;
  gland: string;
  status: ChakraPolarityStatus;
  imbalancePercent: number; // 0 - 100
  affectsPhysicalBody: boolean;
}

export type ChakraColorKey =
  | 'basico'
  | 'sacro'
  | 'plexo'
  | 'cardiaco'
  | 'laringeo'
  | 'frontal'
  | 'coronario';

export interface ChakraColorSpec {
  id: ChakraColorKey;
  shortName: string;
  colorName: string;
  bg: string;
  text: string;
  border: string;
  softBg: string;
  accentText: string;
}

export const CHAKRA_COLORS: Record<ChakraColorKey, ChakraColorSpec> = {
  basico: {
    id: 'basico',
    shortName: 'Básico',
    colorName: 'Vermelho',
    bg: '#DC2626',
    text: '#FFFFFF',
    border: '#B91C1C',
    softBg: '#FEF2F2',
    accentText: '#B91C1C',
  },
  sacro: {
    id: 'sacro',
    shortName: 'Sacro',
    colorName: 'Laranja',
    bg: '#EA580C',
    text: '#FFFFFF',
    border: '#C2410C',
    softBg: '#FFF7ED',
    accentText: '#C2410C',
  },
  plexo: {
    id: 'plexo',
    shortName: 'Plexo Solar',
    colorName: 'Amarelo',
    bg: '#EAB308',
    text: '#0F172A',
    border: '#CA8A04',
    softBg: '#FEFCE8',
    accentText: '#854D0E',
  },
  cardiaco: {
    id: 'cardiaco',
    shortName: 'Cardíaco',
    colorName: 'Verde',
    bg: '#16A34A',
    text: '#FFFFFF',
    border: '#15803D',
    softBg: '#F0FDF4',
    accentText: '#15803D',
  },
  laringeo: {
    id: 'laringeo',
    shortName: 'Laríngeo',
    colorName: 'Azul Claro',
    bg: '#0284C7',
    text: '#FFFFFF',
    border: '#0369A1',
    softBg: '#F0F9FF',
    accentText: '#0369A1',
  },
  frontal: {
    id: 'frontal',
    shortName: 'Frontal',
    colorName: 'Índigo / Anil',
    bg: '#4338CA',
    text: '#FFFFFF',
    border: '#3730A3',
    softBg: '#EEF2FF',
    accentText: '#3730A3',
  },
  coronario: {
    id: 'coronario',
    shortName: 'Coronário',
    colorName: 'Violeta',
    bg: '#7C3AED',
    text: '#FFFFFF',
    border: '#6D28D9',
    softBg: '#F5F3FF',
    accentText: '#6D28D9',
  },
};

export function getChakraColor(identifier: string): ChakraColorSpec {
  const normalized = identifier
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (normalized.includes('coron') || normalized.includes('sahasrara')) {
    return CHAKRA_COLORS.coronario;
  }
  if (
    normalized.includes('front') ||
    normalized.includes('ajna') ||
    normalized.includes('terceiro')
  ) {
    return CHAKRA_COLORS.frontal;
  }
  if (normalized.includes('laring') || normalized.includes('vishuddha')) {
    return CHAKRA_COLORS.laringeo;
  }
  if (normalized.includes('card') || normalized.includes('anahata')) {
    return CHAKRA_COLORS.cardiaco;
  }
  if (normalized.includes('plexo') || normalized.includes('manipura')) {
    return CHAKRA_COLORS.plexo;
  }
  if (
    normalized.includes('sacro') ||
    normalized.includes('umbil') ||
    normalized.includes('esplen') ||
    normalized.includes('svadhisthana')
  ) {
    return CHAKRA_COLORS.sacro;
  }
  if (
    normalized.includes('basic') ||
    normalized.includes('raiz') ||
    normalized.includes('muladhara')
  ) {
    return CHAKRA_COLORS.basico;
  }

  return CHAKRA_COLORS.coronario;
}

export interface AuricFieldReading {
  protectionLabel: AuraProtectionLevel;
  protectionPercent: number; // 0 - 100
  sizeLabel: AuraSizeLevel;
  sizePercent: number; // 0 - 100
  missingColors: string[]; // min 3
  excessColors: string[]; // min 3
}

export interface AuraColorSpec {
  name: string;
  group: 'primary' | 'secondary';
  chakraId?: ChakraColorKey;
  chakraLabel: string;
  chakraShort: string;
  chakraTier: 'inferior' | 'medio' | 'superior' | 'complementar';
  activeClasses: string;
  hex: string;
}

export const PRIMARY_AURIC_COLORS: readonly AuraColorSpec[] = [
  {
    name: 'Vermelho',
    group: 'primary',
    chakraId: 'basico',
    chakraLabel: 'Básico / Muladhara',
    chakraShort: 'Básico',
    chakraTier: 'inferior',
    activeClasses: 'bg-[#DC2626] text-[#FFFFFF] border-[#B91C1C] shadow-sm',
    hex: '#DC2626',
  },
  {
    name: 'Laranja',
    group: 'primary',
    chakraId: 'sacro',
    chakraLabel: 'Sacro / Svadhisthana',
    chakraShort: 'Sacro',
    chakraTier: 'inferior',
    activeClasses: 'bg-[#EA580C] text-[#FFFFFF] border-[#C2410C] shadow-sm',
    hex: '#EA580C',
  },
  {
    name: 'Amarelo',
    group: 'primary',
    chakraId: 'plexo',
    chakraLabel: 'Plexo Solar / Manipura',
    chakraShort: 'Plexo Solar',
    chakraTier: 'inferior',
    activeClasses: 'bg-[#EAB308] text-[#0F172A] border-[#CA8A04] shadow-sm',
    hex: '#EAB308',
  },
  {
    name: 'Verde',
    group: 'primary',
    chakraId: 'cardiaco',
    chakraLabel: 'Cardíaco / Anahata',
    chakraShort: 'Cardíaco',
    chakraTier: 'medio',
    activeClasses: 'bg-[#16A34A] text-[#FFFFFF] border-[#15803D] shadow-sm',
    hex: '#16A34A',
  },
  {
    name: 'Azul Claro',
    group: 'primary',
    chakraId: 'laringeo',
    chakraLabel: 'Laríngeo / Vishuddha',
    chakraShort: 'Laríngeo',
    chakraTier: 'superior',
    activeClasses: 'bg-[#0284C7] text-[#FFFFFF] border-[#0369A1] shadow-sm',
    hex: '#0284C7',
  },
  {
    name: 'Índigo',
    group: 'primary',
    chakraId: 'frontal',
    chakraLabel: 'Frontal / Ajna',
    chakraShort: 'Frontal',
    chakraTier: 'superior',
    activeClasses: 'bg-[#4338CA] text-[#FFFFFF] border-[#3730A3] shadow-sm',
    hex: '#4338CA',
  },
  {
    name: 'Violeta',
    group: 'primary',
    chakraId: 'coronario',
    chakraLabel: 'Coronário / Sahasrara',
    chakraShort: 'Coronário',
    chakraTier: 'superior',
    activeClasses: 'bg-[#7C3AED] text-[#FFFFFF] border-[#6D28D9] shadow-sm',
    hex: '#7C3AED',
  },
];

export const SECONDARY_AURIC_COLORS: readonly AuraColorSpec[] = [
  {
    name: 'Rosa',
    group: 'secondary',
    chakraId: 'cardiaco',
    chakraLabel: 'Cardíaco Superior / Amor Incondicional',
    chakraShort: 'Cardíaco Superior',
    chakraTier: 'complementar',
    activeClasses: 'bg-[#DB2777] text-[#FFFFFF] border-[#BE185D] shadow-sm',
    hex: '#DB2777',
  },
  {
    name: 'Dourado',
    group: 'secondary',
    chakraId: 'coronario',
    chakraLabel: 'Coronário / Proteção Solar Crística',
    chakraShort: 'Coronário / Solar',
    chakraTier: 'complementar',
    activeClasses: 'bg-[#D97706] text-[#FFFFFF] border-[#B45309] shadow-sm',
    hex: '#D97706',
  },
  {
    name: 'Branco',
    group: 'secondary',
    chakraLabel: 'Campo Integral / Luz Cristalina',
    chakraShort: 'Campo Integral',
    chakraTier: 'complementar',
    activeClasses:
      'bg-[#FFFFFF] text-[#0F172A] border-[#B45309] ring-2 ring-amber-400/50 shadow-md',
    hex: '#FFFFFF',
  },
  {
    name: 'Cinza',
    group: 'secondary',
    chakraLabel: 'Fadiga Áurica / Estagnação Mental',
    chakraShort: 'Estagnação Mental',
    chakraTier: 'complementar',
    activeClasses: 'bg-[#4B5563] text-[#FFFFFF] border-[#374151] shadow-sm',
    hex: '#4B5563',
  },
  {
    name: 'Marrom',
    group: 'secondary',
    chakraId: 'basico',
    chakraLabel: 'Básico / Densidade Telúrica',
    chakraShort: 'Básico (Denso)',
    chakraTier: 'complementar',
    activeClasses: 'bg-[#78350F] text-[#FFFFFF] border-[#451A03] shadow-sm',
    hex: '#78350F',
  },
  {
    name: 'Preto',
    group: 'secondary',
    chakraLabel: 'Absorção Densa / Bloqueio Protetivo',
    chakraShort: 'Bloqueio Protetivo',
    chakraTier: 'complementar',
    activeClasses: 'bg-[#111827] text-[#FFFFFF] border-[#000000] shadow-sm',
    hex: '#111827',
  },
];

export const ALL_AURIC_COLORS: readonly AuraColorSpec[] = [
  ...PRIMARY_AURIC_COLORS,
  ...SECONDARY_AURIC_COLORS,
];

const LEGACY_AURIC_COLOR_ALIASES: Record<string, string> = {
  'vermelho denso': 'Vermelho',
  'laranja escuro': 'Laranja',
  'amarelo ouro': 'Amarelo',
  'amarelo acido': 'Amarelo',
  'verde esmeralda': 'Verde',
  'verde turvo': 'Verde',
  'azul celeste': 'Azul Claro',
  'branco cristalino': 'Branco',
  'marrom lodoso': 'Marrom',
  'preto opaco': 'Preto',
  magenta: 'Violeta',
};

export function normalizeAuricColorName(color: string): string {
  const trimmed = color.trim();
  if (!trimmed) return '';
  const exact = ALL_AURIC_COLORS.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact.name;

  const key = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return LEGACY_AURIC_COLOR_ALIASES[key] || trimmed;
}

export function getAuraColorSpec(color: string): AuraColorSpec | undefined {
  const normalized = normalizeAuricColorName(color);
  return ALL_AURIC_COLORS.find(
    (c) => c.name.toLowerCase() === normalized.toLowerCase()
  );
}

export interface AuricChakraCorrelation {
  missingMappings: string[];
  excessMappings: string[];
  summaryText: string;
}

export function analyzeAuricColorsChakraCorrelation(
  missingColors: string[],
  excessColors: string[]
): AuricChakraCorrelation {
  const mapList = (colors: string[]) =>
    colors.map((c) => {
      const spec = getAuraColorSpec(c);
      return spec ? `${spec.name} (${spec.chakraShort})` : c;
    });

  const missingMappings = mapList(missingColors);
  const excessMappings = mapList(excessColors);

  const countTiers = (colors: string[]) => {
    let inferior = 0;
    let medio = 0;
    let superior = 0;
    let dense = 0;
    colors.forEach((c) => {
      const spec = getAuraColorSpec(c);
      if (!spec) return;
      if (spec.chakraTier === 'inferior') inferior += 1;
      else if (spec.chakraTier === 'medio') medio += 1;
      else if (spec.chakraTier === 'superior') superior += 1;
      else dense += 1;
    });
    return { inferior, medio, superior, dense };
  };

  const exT = countTiers(excessColors);
  const msT = countTiers(missingColors);

  const observations: string[] = [];

  if (exT.inferior + exT.medio > 0 && msT.superior > 0) {
    const excessLowerLabels = excessMappings.join(', ');
    const missingUpperLabels = missingMappings.join(', ');
    observations.push(
      `Sobrecarga nos chakras inferiores/médios (${excessLowerLabels}) associada à carência nos chakras superiores (${missingUpperLabels}).`
    );
  } else if (exT.superior > 0 && msT.inferior + msT.medio > 0) {
    observations.push(
      `Excesso de atividade mental/espiritual superior (${excessMappings.join(', ')}) com carência de aterramento nos chakras inferiores/médios (${missingMappings.join(', ')}).`
    );
  } else {
    if (excessMappings.length > 0) {
      observations.push(`Sobrecarga cromática em: ${excessMappings.join(', ')}.`);
    }
    if (missingMappings.length > 0) {
      observations.push(`Carência cromática em: ${missingMappings.join(', ')}.`);
    }
  }

  if (exT.dense > 0) {
    const denseNames = excessColors
      .filter((c) => getAuraColorSpec(c)?.group === 'secondary')
      .join(', ');
    if (denseNames) {
      observations.push(
        `Presença de tonalidades secundárias de densidade/fadiga em excesso (${denseNames}), pedindo assepsia áurica.`
      );
    }
  }

  return {
    missingMappings,
    excessMappings,
    summaryText:
      observations.join(' ') ||
      'Selecione as cores em falta e em excesso para visualizar o cruzamento automático com os 7 Chakras.',
  };
}

export function getAuraSizeLabelFromPercent(percent: number): AuraSizeLevel {
  const clamped = Math.max(0, Math.min(100, percent));
  if (clamped < 35) return 'Encolhida';
  if (clamped >= 75) return 'Expandida';
  return 'Regular';
}

export interface LifeAreasReading {
  familiar: LifeAreaRating;
  relacionamentoAfetivo: LifeAreaRating;
  profissional: LifeAreaRating;
  financeiro: LifeAreaRating;
  missaoDeVida: LifeAreaRating;
}

export interface HawkinsScaleLevel {
  hz: number;
  shortLabel: string;
  label: string;
  emotion: string;
  zone: 'Contração' | 'Neutralidade' | 'Expansão';
}

export const HAWKINS_SCALE_TABLE: readonly HawkinsScaleLevel[] = [
  {
    hz: 20,
    shortLabel: 'Vergonha',
    label: 'Vergonha (20 Hz)',
    emotion: 'Humilhação, autodepreciação e retração profunda',
    zone: 'Contração',
  },
  {
    hz: 30,
    shortLabel: 'Culpa',
    label: 'Culpa (30 Hz)',
    emotion: 'Autopunição, remorso e sensação de condenação',
    zone: 'Contração',
  },
  {
    hz: 50,
    shortLabel: 'Apatia',
    label: 'Apatia (50 Hz)',
    emotion: 'Desesperança, desânimo e paralisia vital',
    zone: 'Contração',
  },
  {
    hz: 75,
    shortLabel: 'Tristeza',
    label: 'Tristeza (75 Hz)',
    emotion: 'Luto, pesar e perda de tônus energético',
    zone: 'Contração',
  },
  {
    hz: 100,
    shortLabel: 'Medo',
    label: 'Medo (100 Hz)',
    emotion: 'Ansiedade, insegurança e hipervigilância',
    zone: 'Contração',
  },
  {
    hz: 125,
    shortLabel: 'Desejo',
    label: 'Desejo (125 Hz)',
    emotion: 'Carência, apego e compulsão por controle',
    zone: 'Contração',
  },
  {
    hz: 150,
    shortLabel: 'Raiva',
    label: 'Raiva (150 Hz)',
    emotion: 'Irritação, frustração e conflito inflamatório',
    zone: 'Contração',
  },
  {
    hz: 175,
    shortLabel: 'Orgulho',
    label: 'Orgulho (175 Hz)',
    emotion: 'Rigidez defensiva e resistência à vulnerabilidade',
    zone: 'Contração',
  },
  {
    hz: 200,
    shortLabel: 'Coragem',
    label: 'Coragem (200 Hz)',
    emotion: 'Limiar da integridade, verdade e empoderamento',
    zone: 'Neutralidade',
  },
  {
    hz: 250,
    shortLabel: 'Neutralidade',
    label: 'Neutralidade (250 Hz)',
    emotion: 'Desapego sereno, confiança e flexibilidade clínica',
    zone: 'Neutralidade',
  },
  {
    hz: 310,
    shortLabel: 'Boa Vontade',
    label: 'Boa Vontade (310 Hz)',
    emotion: 'Abertura construtiva, cooperação e otimismo regenerativo',
    zone: 'Neutralidade',
  },
  {
    hz: 350,
    shortLabel: 'Aceitação',
    label: 'Aceitação (350 Hz)',
    emotion: 'Transcendência, perdão e responsabilidade serena',
    zone: 'Expansão',
  },
  {
    hz: 400,
    shortLabel: 'Razão',
    label: 'Razão (400 Hz)',
    emotion: 'Clareza mental, discernimento e coerência científica',
    zone: 'Expansão',
  },
  {
    hz: 500,
    shortLabel: 'Amor',
    label: 'Amor (500 Hz)',
    emotion: 'Compaixão incondicional, acolhimento e cura profunda',
    zone: 'Expansão',
  },
  {
    hz: 520,
    shortLabel: 'Entrega',
    label: 'Entrega (520 Hz)',
    emotion: 'Confiança espiritual plena e rendição harmônica',
    zone: 'Expansão',
  },
  {
    hz: 540,
    shortLabel: 'Alegria',
    label: 'Alegria (540 Hz)',
    emotion: 'Serenidade luminosa, leveza e sincronicidade',
    zone: 'Expansão',
  },
  {
    hz: 580,
    shortLabel: 'Completude',
    label: 'Completude (580 Hz)',
    emotion: 'Inteireza interior e integração de corpo, mente e espírito',
    zone: 'Expansão',
  },
  {
    hz: 600,
    shortLabel: 'Paz',
    label: 'Paz (600 Hz)',
    emotion: 'Silêncio pleno, bem-aventurança e não-dualidade',
    zone: 'Expansão',
  },
  {
    hz: 700,
    shortLabel: 'Iluminação',
    label: 'Iluminação (700 Hz)',
    emotion: 'Consciência expandida, lucidez superior e unidade',
    zone: 'Expansão',
  },
  {
    hz: 800,
    shortLabel: 'Gratidão / Iluminação Plena',
    label: 'Gratidão / Iluminação Plena (800 Hz)',
    emotion: 'Reverência cósmica, gratidão pura e irradiação plena',
    zone: 'Expansão',
  },
  {
    hz: 1000,
    shortLabel: 'Consciência Crística / Iluminação Suprema',
    label: 'Consciência Crística / Iluminação Suprema (1000 Hz)',
    emotion: 'Plenitude crística, amor universal e coerência suprema',
    zone: 'Expansão',
  },
];

export function getHawkinsEntryByHz(hz: number): HawkinsScaleLevel {
  const safeHz = Number.isFinite(hz) ? Math.max(20, Math.min(1000, hz)) : 200;
  const exact = HAWKINS_SCALE_TABLE.find((entry) => entry.hz === safeHz);
  if (exact) return exact;

  let closest = HAWKINS_SCALE_TABLE[0];
  let bestDiff = Math.abs(safeHz - closest.hz);

  for (let i = 1; i < HAWKINS_SCALE_TABLE.length; i++) {
    const candidate = HAWKINS_SCALE_TABLE[i];
    const diff = Math.abs(safeHz - candidate.hz);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = candidate;
    }
  }

  return closest;
}

export function getHawkinsLabelByHz(hz: number): string {
  return getHawkinsEntryByHz(hz).label;
}

export interface SpiritualPsychoReading {
  bovis: number; // 0 - 18000+
  hawkinsAgathaHz: number; // 20 - 1000 Hz
  hawkinsHz?: number; // 20 - 1000 Hz
  hawkinsLevel?: string;
  stressLevel: number; // 0 - 9
  yinPercent: number; // 0 - 100
  yangPercent: number; // 0 - 100
  spiritualDisturbances: string[];
  implantsDetected: string[];
  karmicCommitments: string[];
  virtuesToAnchor: string[];
  recommendedRadionicBoard: string;
  clientPerceptionScore?: number; // 0 - 10
  clientPerceptionMoment?: 'antes' | 'pos';
  clientPerceptionNote?: string;
}

export interface AnsaeSystemReading {
  systemCode: AnsaeSystemCode;
  systemName: string;
  isImbalanced: boolean;
  imbalancePercent: number; // 0 - 100
  durationValue: number;
  durationUnit: 'h' | 'd' | 'm';
  healthEnergyAngstroms?: number; // 0 - 18000 (step 500)
}

export interface AnsaeOrganReading {
  id: string;
  systemCode: AnsaeSystemCode;
  systemName: string;
  organName: string;
  isImbalanced: boolean;
  imbalancePercent: number; // 0 - 100
  durationValue: number;
  durationUnit: 'h' | 'd' | 'm';
  healthEnergyAngstroms?: number; // 0 - 18000 (step 500)
}

export interface ClinicalAnsaeRhenSheet {
  rootProblems: RootProblemDomain[];
  electromagneticFields: ElectromagneticFieldReading[];
  chakras: AnsaeChakraReading[];
  auricField: AuricFieldReading;
  lifeAreas: LifeAreasReading;
  spiritualPsycho: SpiritualPsychoReading;
  systems?: AnsaeSystemReading[];
  organs: AnsaeOrganReading[];
  biometerReadings: Array<{
    biometerId: string;
    biometerName: string;
    selectedItem: string;
    recordedAt: string;
  }>;
}

export interface MasterPatient {
  id: string;
  interagentType?: InteragentType;
  fullName: string;
  birthDate: string;
  phone: string;
  petSpecies?: PetSpecies;
  petBreed?: string;
  petAge?: string;
  petEnvironment?: string;
  tutorName?: string;
  createdAt: string;
  notes?: string;
}

export interface ClinicalSessionRecord {
  id: string;
  patientId: string;
  sessionType: SessionMilestoneType;
  therapeuticFocus: string;
  emotionalHistory: string;
  physicalSymptoms: string;
  medicalTreatments: string;
  clinicalNotes: string;
  ansaeRhen: ClinicalAnsaeRhenSheet;
  protocol: AntiCatharsisProtocol;
  aiResult: QuantumGenerationResult | null;
  phase: RoomPhase;
  isAnchored: boolean;
  activatedAt: string;
  completedAt?: string;
  selectedSolfeggioHz: number;
  chartCrystals?: Record<string, string>;
  energeticRemedies?: EnergeticRemedyEmission[];
  withdrawnEmissions?: ChartWithdrawalLogEntry[];
  clientPerceptionScore?: number; // 0 - 10
  clientPerceptionMoment?: 'antes' | 'pos';
  clientPerceptionNote?: string;
  updatedAt: string;
}

export interface MasterClinicalDatabase {
  version: number;
  patients: MasterPatient[];
  sessions: ClinicalSessionRecord[];
  customBiometers: BiometerDefinition[];
}

export interface BiometerDefinition {
  id: string;
  number: number;
  name: string;
  category:
    | 'Triagem & Geral'
    | 'Chakras & Corpos Sutis'
    | 'Saúde Física & ANSAE'
    | 'Emocional, Mental & Consciência'
    | 'Prosperidade & Hábitos'
    | 'Protocolos & Terapêuticas'
    | 'Saúde Animal / PETS'
    | 'Personalizado';
  description: string;
  items: string[];
  imageUrl?: string;
  isCustom?: boolean;
}
