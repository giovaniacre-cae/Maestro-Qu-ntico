import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Compass,
  HeartHandshake,
  Layers,
  Plus,
  ShieldAlert,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  AnsaeChakraReading,
  AnsaeOrganReading,
  AnsaeSystemCode,
  AnsaeSystemReading,
  AuraProtectionLevel,
  AuraSizeLevel,
  BiometerDefinition,
  CHAKRA_COLORS,
  ChakraPolarityStatus,
  ClinicalAnsaeRhenSheet,
  HAWKINS_SCALE_TABLE,
  LifeAreaRating,
  PRIMARY_AURIC_COLORS,
  RootProblemDomain,
  SECONDARY_AURIC_COLORS,
  analyzeAuricColorsChakraCorrelation,
  getAuraSizeLabelFromPercent,
  getChakraColor,
  getHawkinsLabelByHz,
} from '../types/clinical';
import {
  ChakraReading,
  OrganicSystemStatus,
  PatientAnamnesis,
  SensitivityReading,
} from '../types/quantum';
import {
  INTERFERENCE_OPTIONS,
  evaluateAntiCatharsis,
  formatAngstromsBR,
  getHawkinsLevelInfo,
} from '../utils/antiCatharsis';
import {
  ANSAE_SYSTEMS_META,
  createDefaultAnsaeRhenSheet,
  loadClinicalDatabase,
  loadCustomBiometers,
  loadHiddenOfficialBiometers,
  normalizeAnsaeSheet,
  saveClinicalDatabase,
  saveCustomBiometers,
  saveHiddenOfficialBiometers,
} from '../utils/storage';
import { BUILTIN_32_BIOMETERS } from '../data/biometrosData';
import { BiometrosModal } from './BiometrosModal';

interface SintoniaSensitivaProps {
  anamnesis: PatientAnamnesis;
  sensitivity: SensitivityReading;
  onChange: (updated: SensitivityReading) => void;
  onProcessProtocol: () => void;
  onBackToAnamnesis: () => void;
}

const ROOT_DOMAIN_OPTIONS: Array<{
  id: RootProblemDomain;
  title: string;
  hint: string;
}> = [
  { id: 'Físico', title: 'Físico', hint: 'Vitalidade somática e campo físico' },
  { id: 'Emocional', title: 'Emocional', hint: 'Eixo afetivo, traumas e plexo' },
  { id: 'Mental', title: 'Mental', hint: 'Sobrecarga psíquica e crenças' },
  { id: 'Espiritual', title: 'Espiritual', hint: 'Distúrbios, implantes e carmas' },
  { id: 'Aura', title: 'Aura', hint: 'Proteção, tamanho e cromoterapia' },
  { id: 'Órgãos', title: 'Órgãos', hint: '15 sistemas ANSAE e 38 órgãos' },
];

const CHAKRA_SHORT_NAMES = [
  'Coronário',
  'Frontal',
  'Laríngeo',
  'Cardíaco',
  'Plexo Solar',
  'Sacro',
  'Básico',
];

const AURA_PROTECTION_ACTIVE_CLASSES: Record<AuraProtectionLevel, string> = {
  'Aberta 0%': 'bg-[#DC2626] text-[#FFFFFF] border-[#B91C1C] shadow-sm',
  'Média 50%': 'bg-[#EAB308] text-[#0F172A] border-[#CA8A04] shadow-sm',
  'Fechada 100%': 'bg-[#16A34A] text-[#FFFFFF] border-[#15803D] shadow-sm',
};

const AURA_SIZE_ACTIVE_CLASSES: Record<AuraSizeLevel, string> = {
  Encolhida: 'bg-[#DC2626] text-[#FFFFFF] border-[#B91C1C] shadow-sm',
  Regular: 'bg-[#EAB308] text-[#0F172A] border-[#CA8A04] shadow-sm',
  Expandida: 'bg-[#16A34A] text-[#FFFFFF] border-[#15803D] shadow-sm',
};

const SECONDARY_COLOR_NAMES = new Set(SECONDARY_AURIC_COLORS.map((c) => c.name));

const NEUTRAL_AURIC_BUTTON_CLASSES =
  'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';

const LIFE_AREAS_CONFIG: Array<{
  key: keyof ClinicalAnsaeRhenSheet['lifeAreas'];
  label: string;
}> = [
  { key: 'familiar', label: 'Familiar' },
  { key: 'relacionamentoAfetivo', label: 'Relacionamento Afetivo' },
  { key: 'profissional', label: 'Profissional' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'missaoDeVida', label: 'Missão de Vida' },
];

const LIFE_AREA_RATINGS: LifeAreaRating[] = ['Péssimo', 'Ruim', 'Bom', 'Excelente'];

const IMPLANT_OPTIONS = [
  'Chip / Dispositivo Astral',
  'Selo de Limitação Mental',
  'Implante Emocional no Plexo',
  'Bloqueio Vocal / Laríngeo',
];

const KARMIC_OPTIONS = [
  'Voto de Escassez / Pobreza',
  'Contrato de Autossacrifício',
  'Pendência Ancestral Familiar',
  'Pacto de Culpa / Expiação',
];

const VIRTUE_OPTIONS = [
  'Serenidade',
  'Discernimento',
  'Vitalidade',
  'Perdão',
  'Coragem',
  'Prosperidade Ética',
  'Amor Incondicional',
  'Fé & Entrega',
];

const RADIONIC_BOARD_OPTIONS = [
  'Mesa de Assepsia & Blindagem Anti-Catarse',
  'Mesa Radiônica Quântica de Alta Vitalidade',
  'Mesa Radiônica Espiritual & Cármica (RHEN)',
  'Mesa Apométrica & Desobsessão Sutil',
  'Mesa de Prosperidade & Alinhamento de Missão',
];

const SYSTEM_CODES_ORDER: AnsaeSystemCode[] = [
  'SC',
  'SD',
  'SEnd',
  'SExc',
  'SI',
  'SL',
  'SNC',
  'SNP',
  'SRep',
  'SResp',
  'SS',
  'SU',
  'SEsq',
  'SM',
  'ST',
];

const BovisGauge: React.FC<{ bovis: number }> = ({ bovis }) => {
  const maxVal = 18000;
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

  const ticks = Array.from({ length: 19 }, (_, i) => {
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
          x={cx + (radius + 24) * Math.sin(thresholdRad)}
          y={cy - (radius + 24) * Math.cos(thresholdRad)}
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
            : bovis >= 18000
            ? '≥ 18.000 Å — Padrão vibracional supranormal'
            : 'Acima de 6.500 Å — Padrão energético em estabilidade'}
        </p>
      </div>
    </div>
  );
};

function getEnergyBandMeta(energy?: number): {
  label: string;
  badgeClass: string;
  inputClass: string;
  cardBorderClass: string;
} {
  if (energy === undefined || energy === null || Number.isNaN(energy)) {
    return {
      label: 'Não aferido',
      badgeClass: 'bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]',
      inputClass: 'bg-white border-[#CBD5E1] text-[#0F172A]',
      cardBorderClass: '',
    };
  }
  if (energy < 6500) {
    return {
      label: 'Alerta (< 6.500 Å)',
      badgeClass: 'bg-[#BA1A1A]/10 text-[#93000A] border-[#BA1A1A]/40',
      inputClass: 'bg-[#BA1A1A]/5 border-[#BA1A1A] text-[#93000A] font-bold',
      cardBorderClass: 'border-[#BA1A1A]/50 bg-[#BA1A1A]/5',
    };
  }
  if (energy < 7000) {
    return {
      label: 'Limiar (6.500 Å)',
      badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#D97706]/50',
      inputClass: 'bg-[#FEF3C7]/60 border-[#D97706] text-[#92400E] font-bold',
      cardBorderClass: 'border-[#D97706]/50 bg-[#FEF3C7]/25',
    };
  }
  return {
    label: 'Equilíbrio (≥ 7.000 Å)',
    badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#16A34A]/40',
    inputClass: 'bg-[#DCFCE7]/50 border-[#16A34A] text-[#166534] font-semibold',
    cardBorderClass: 'border-[#16A34A]/35 bg-[#DCFCE7]/15',
  };
}

function getSheetStorageKey(patientId: string): string {
  return `maestro_quantico_ansae_draft_${patientId || 'default'}`;
}

function loadInitialSheet(
  anamnesis: PatientAnamnesis,
  sensitivity: SensitivityReading
): ClinicalAnsaeRhenSheet {
  try {
    const raw = localStorage.getItem(getSheetStorageKey(anamnesis.id));
    if (raw) {
      const parsed = JSON.parse(raw) as ClinicalAnsaeRhenSheet;
      if (parsed && Array.isArray(parsed.organs) && parsed.organs.length === 38) {
        return normalizeAnsaeSheet({
          ...parsed,
          spiritualPsycho: {
            ...parsed.spiritualPsycho,
            bovis: sensitivity.bovis,
            hawkinsAgathaHz: sensitivity.hawkins,
            hawkinsHz: sensitivity.hawkins,
            hawkinsLevel: getHawkinsLabelByHz(sensitivity.hawkins),
            stressLevel: sensitivity.stressLevel,
            spiritualDisturbances: sensitivity.interferenceTypes,
          },
          auricField: {
            ...parsed.auricField,
            protectionPercent: sensitivity.auricProtection,
          },
        });
      }
    }
  } catch {
    // Fallback to default
  }

  const db = loadClinicalDatabase();
  const matched = db.sessions.find(
    (s) => s.patientId === anamnesis.id && s.phase !== 'completed'
  );
  if (matched) {
    return normalizeAnsaeSheet({
      ...matched.ansaeRhen,
      spiritualPsycho: {
        ...matched.ansaeRhen.spiritualPsycho,
        bovis: sensitivity.bovis,
        hawkinsAgathaHz: sensitivity.hawkins,
        hawkinsHz: sensitivity.hawkins,
        hawkinsLevel: getHawkinsLabelByHz(sensitivity.hawkins),
        stressLevel: sensitivity.stressLevel,
        spiritualDisturbances: sensitivity.interferenceTypes,
      },
      auricField: {
        ...matched.ansaeRhen.auricField,
        protectionPercent: sensitivity.auricProtection,
      },
    });
  }

  const base = createDefaultAnsaeRhenSheet();
  base.spiritualPsycho.bovis = sensitivity.bovis;
  base.spiritualPsycho.hawkinsAgathaHz = sensitivity.hawkins;
  base.spiritualPsycho.hawkinsHz = sensitivity.hawkins;
  base.spiritualPsycho.hawkinsLevel = getHawkinsLabelByHz(sensitivity.hawkins);
  base.spiritualPsycho.stressLevel = sensitivity.stressLevel;
  base.spiritualPsycho.spiritualDisturbances = sensitivity.interferenceTypes;
  base.auricField.protectionPercent = sensitivity.auricProtection;
  return base;
}

export const SintoniaSensitiva: React.FC<SintoniaSensitivaProps> = ({
  anamnesis,
  sensitivity,
  onChange,
  onProcessProtocol,
  onBackToAnamnesis,
}) => {
  const [sheet, setSheet] = useState<ClinicalAnsaeRhenSheet>(() =>
    loadInitialSheet(anamnesis, sensitivity)
  );
  const [showAllBlocks, setShowAllBlocks] = useState<boolean>(false);
  const [isBiometersOpen, setIsBiometersOpen] = useState<boolean>(false);
  const [customBiometers, setCustomBiometers] = useState<BiometerDefinition[]>(() =>
    loadCustomBiometers()
  );
  const [hiddenOfficialBiometers, setHiddenOfficialBiometers] = useState<string[]>(() =>
    loadHiddenOfficialBiometers()
  );

  const handleHideOfficialBiometer = (id: string) => {
    const next = [...hiddenOfficialBiometers, id];
    setHiddenOfficialBiometers(next);
    saveHiddenOfficialBiometers(next);
  };

  const handleRestoreAllOfficialBiometers = () => {
    setHiddenOfficialBiometers([]);
    saveHiddenOfficialBiometers([]);
  };

  const activeOfficialCount = BUILTIN_32_BIOMETERS.filter(
    (b) => !hiddenOfficialBiometers.includes(b.id)
  ).length;
  const totalBiometers = activeOfficialCount + customBiometers.length;
  const [activeSystemTab, setActiveSystemTab] = useState<AnsaeSystemCode | 'ALL'>('ALL');
  const [customDisturbance, setCustomDisturbance] = useState<string>('');
  const [customImplant, setCustomImplant] = useState<string>('');
  const [customKarmic, setCustomKarmic] = useState<string>('');
  const [hawkinsInputText, setHawkinsInputText] = useState<string>(() =>
    String(sheet.spiritualPsycho.hawkinsAgathaHz)
  );
  const [showExtraMissingColors, setShowExtraMissingColors] = useState<boolean>(() =>
    sheet.auricField.missingColors.some((c) => SECONDARY_COLOR_NAMES.has(c))
  );
  const [showExtraExcessColors, setShowExtraExcessColors] = useState<boolean>(() =>
    sheet.auricField.excessColors.some((c) => SECONDARY_COLOR_NAMES.has(c))
  );

  const highlightedList = useMemo(() => {
    return (anamnesis.copilotAnalysis?.highlightedOrgansAndChakras || []).map((s) => s.toLowerCase().trim());
  }, [anamnesis]);

  const isHighlightedByAnamnesis = (names: string[]) => {
    if (highlightedList.length === 0) return false;
    return names.some((name) => {
      const n = name.toLowerCase().trim();
      return highlightedList.some((item) => item.includes(n) || n.includes(item));
    });
  };

  // Re-sync when switching patients
  useEffect(() => {
    const nextLoaded = loadInitialSheet(anamnesis, sensitivity);
    setSheet(nextLoaded);
    setHawkinsInputText(String(nextLoaded.spiritualPsycho.hawkinsAgathaHz));
    setShowExtraMissingColors(
      nextLoaded.auricField.missingColors.some((c) => SECONDARY_COLOR_NAMES.has(c))
    );
    setShowExtraExcessColors(
      nextLoaded.auricField.excessColors.some((c) => SECONDARY_COLOR_NAMES.has(c))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anamnesis.id]);

  useEffect(() => {
    setHawkinsInputText(String(sheet.spiritualPsycho.hawkinsAgathaHz));
  }, [sheet.spiritualPsycho.hawkinsAgathaHz]);

  // Persist ANSAE/RHEN working sheet locally & into matching clinical DB record
  useEffect(() => {
    try {
      localStorage.setItem(getSheetStorageKey(anamnesis.id), JSON.stringify(sheet));
      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex(
        (s) => s.patientId === anamnesis.id && s.phase !== 'completed'
      );
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          ansaeRhen: sheet,
          updatedAt: new Date().toISOString(),
        };
        saveClinicalDatabase(db);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [anamnesis.id, sheet]);

  const mapAnsaeSystemsToLegacy = (
    organs: AnsaeOrganReading[],
    systems?: AnsaeSystemReading[]
  ): OrganicSystemStatus[] => {
    const codeGroups: Array<{
      legacyId: string;
      codes: AnsaeSystemCode[];
    }> = [
      { legacyId: 'nervoso', codes: ['SNC', 'SNP'] },
      { legacyId: 'endocrino', codes: ['SEnd'] },
      { legacyId: 'imunologico', codes: ['SI', 'SL'] },
      { legacyId: 'cardiovascular', codes: ['SC'] },
      { legacyId: 'digestivo', codes: ['SD', 'SExc'] },
      { legacyId: 'respiratorio', codes: ['SResp'] },
      { legacyId: 'osteomuscular', codes: ['SEsq', 'SM'] },
      { legacyId: 'renal', codes: ['SU'] },
    ];

    return sensitivity.organicSystems.map((sys) => {
      const group = codeGroups.find((g) => g.legacyId === sys.id);
      if (!group) return sys;
      const groupSystems = (systems || []).filter((s) => group.codes.includes(s.systemCode));
      const groupOrgans = organs.filter((o) => group.codes.includes(o.systemCode));

      const alertItems = [
        ...groupSystems.filter(
          (s) =>
            s.isImbalanced ||
            (typeof s.healthEnergyAngstroms === 'number' && s.healthEnergyAngstroms < 6500)
        ),
        ...groupOrgans.filter(
          (o) =>
            o.isImbalanced ||
            (typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500)
        ),
      ];

      const recordedEnergies = [
        ...groupSystems
          .map((s) => s.healthEnergyAngstroms)
          .filter((v): v is number => typeof v === 'number'),
        ...groupOrgans
          .map((o) => o.healthEnergyAngstroms)
          .filter((v): v is number => typeof v === 'number'),
      ];
      const minEnergy =
        recordedEnergies.length > 0 ? Math.min(...recordedEnergies) : undefined;

      if (alertItems.length > 0) {
        const notes = [
          ...groupSystems
            .filter(
              (s) =>
                s.isImbalanced ||
                (typeof s.healthEnergyAngstroms === 'number' && s.healthEnergyAngstroms < 6500)
            )
            .map(
              (s) =>
                `${s.systemName} (${s.imbalancePercent}% · ${formatAngstromsBR(
                  s.healthEnergyAngstroms
                )})`
            ),
          ...groupOrgans
            .filter(
              (o) =>
                o.isImbalanced ||
                (typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500)
            )
            .map(
              (o) =>
                `${o.organName} (${o.imbalancePercent}% · ${formatAngstromsBR(
                  o.healthEnergyAngstroms
                )} · ${o.durationValue}${o.durationUnit})`
            ),
        ];

        return {
          ...sys,
          status: 'Em Alerta',
          healthEnergyAngstroms: minEnergy,
          note: notes.join(', '),
        };
      }
      return {
        ...sys,
        status: 'Equilibrado',
        healthEnergyAngstroms: minEnergy,
        note:
          minEnergy !== undefined
            ? `Tônus estável (${formatAngstromsBR(minEnergy)})`
            : 'Tônus estável na varredura ANSAE',
      };
    });
  };

  const mapAnsaeChakrasToLegacy = (chakras: AnsaeChakraReading[]): ChakraReading[] => {
    return sensitivity.chakras.map((legacy) => {
      const found = chakras.find(
        (c) => c.id === legacy.id || (legacy.id === 'umbilical' && c.id === 'sacro')
      );
      if (!found) return legacy;
      const pct = Math.max(0, Math.min(100, 100 - found.imbalancePercent));
      const status: ChakraReading['status'] =
        found.status === 'Nulo'
          ? 'Bloqueado'
          : found.status === 'Hipo'
          ? 'Hipo-ativo'
          : found.status === 'Hiper'
          ? 'Hiper-ativo'
          : 'Equilibrado';
      return {
        ...legacy,
        percentage: pct,
        status,
      };
    });
  };

  const updateSheetAndSync = (
    updater: (prev: ClinicalAnsaeRhenSheet) => ClinicalAnsaeRhenSheet,
    syncOrgans = false,
    syncChakras = false
  ) => {
    const next = normalizeAnsaeSheet(updater(sheet));
    const syncedHz = Math.max(20, Math.min(1000, next.spiritualPsycho.hawkinsAgathaHz || 200));
    const syncedLevel = getHawkinsLabelByHz(syncedHz);
    const syncedSheet: ClinicalAnsaeRhenSheet = {
      ...next,
      spiritualPsycho: {
        ...next.spiritualPsycho,
        hawkinsAgathaHz: syncedHz,
        hawkinsHz: syncedHz,
        hawkinsLevel: syncedLevel,
      },
    };
    try {
      localStorage.setItem(getSheetStorageKey(anamnesis.id), JSON.stringify(syncedSheet));
    } catch {
      // Ignore storage quota errors
    }
    setSheet(syncedSheet);
    const nextSensitivity: SensitivityReading = {
      ...sensitivity,
      bovis: syncedSheet.spiritualPsycho.bovis,
      hawkins: syncedHz,
      hawkinsLevel: syncedLevel,
      auricProtection: syncedSheet.auricField.protectionPercent,
      stressLevel: syncedSheet.spiritualPsycho.stressLevel,
      interferenceTypes: syncedSheet.spiritualPsycho.spiritualDisturbances,
      subtleInterferences:
        syncedSheet.spiritualPsycho.spiritualDisturbances.length +
        syncedSheet.spiritualPsycho.implantsDetected.length,
      ...(syncChakras ? { chakras: mapAnsaeChakrasToLegacy(syncedSheet.chakras) } : {}),
      ...(syncOrgans
        ? { organicSystems: mapAnsaeSystemsToLegacy(syncedSheet.organs, syncedSheet.systems) }
        : {}),
    };
    onChange(nextSensitivity);
  };

  const updateHawkinsFrequency = (hz: number) => {
    const clamped = Math.max(20, Math.min(1000, Math.round(hz)));
    const levelLabel = getHawkinsLabelByHz(clamped);
    setHawkinsInputText(String(clamped));
    updateSheetAndSync((prev) => ({
      ...prev,
      spiritualPsycho: {
        ...prev.spiritualPsycho,
        hawkinsAgathaHz: clamped,
        hawkinsHz: clamped,
        hawkinsLevel: levelLabel,
      },
    }));
  };

  const hawkinsInfo = useMemo(
    () => getHawkinsLevelInfo(sheet.spiritualPsycho.hawkinsAgathaHz),
    [sheet.spiritualPsycho.hawkinsAgathaHz]
  );

  const previewProtocol = useMemo(
    () => evaluateAntiCatharsis(anamnesis, sensitivity, sheet),
    [anamnesis, sensitivity, sheet]
  );

  const toggleRootDomain = (domain: RootProblemDomain) => {
    updateSheetAndSync((prev) => {
      const exists = prev.rootProblems.includes(domain);
      return {
        ...prev,
        rootProblems: exists
          ? prev.rootProblems.filter((d) => d !== domain)
          : [...prev.rootProblems, domain],
      };
    });
  };

  const isDomainVisible = (domain: RootProblemDomain) =>
    showAllBlocks || sheet.rootProblems.length === 0 || sheet.rootProblems.includes(domain);

  const allSystems = sheet.systems || [];
  const imbalancedOrgansCount = sheet.organs.filter(
    (o) =>
      o.isImbalanced ||
      (typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500)
  ).length;
  const affectedSystemsCount = new Set([
    ...sheet.organs
      .filter(
        (o) =>
          o.isImbalanced ||
          (typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500)
      )
      .map((o) => o.systemCode),
    ...allSystems
      .filter(
        (s) =>
          s.isImbalanced ||
          (typeof s.healthEnergyAngstroms === 'number' && s.healthEnergyAngstroms < 6500)
      )
      .map((s) => s.systemCode),
  ]).size;

  const filteredSystems = useMemo(() => {
    const list = sheet.systems || [];
    if (activeSystemTab === 'ALL') return list;
    return list.filter((s) => s.systemCode === activeSystemTab);
  }, [activeSystemTab, sheet.systems]);

  const filteredOrgans = useMemo(() => {
    if (activeSystemTab === 'ALL') return sheet.organs;
    return sheet.organs.filter((o) => o.systemCode === activeSystemTab);
  }, [activeSystemTab, sheet.organs]);

  const handleFillHealthyDefaults = () => {
    updateSheetAndSync(
      (prev) => ({
        ...prev,
        systems: (prev.systems || []).map((s) =>
          !s.isImbalanced && s.healthEnergyAngstroms === undefined
            ? { ...s, healthEnergyAngstroms: 9500 }
            : s
        ),
        organs: prev.organs.map((o) =>
          !o.isImbalanced && o.healthEnergyAngstroms === undefined
            ? { ...o, healthEnergyAngstroms: 9500 }
            : o
        ),
      }),
      true,
      false
    );
  };

  const handleSaveCustomBiometer = (bio: BiometerDefinition) => {
    const next = [...customBiometers, bio];
    setCustomBiometers(next);
    saveCustomBiometers(next);
  };

  const handleDeleteCustomBiometer = (id: string) => {
    const next = customBiometers.filter((b) => b.id !== id);
    setCustomBiometers(next);
    saveCustomBiometers(next);
  };

  const handleRecordBiometerReading = (bio: BiometerDefinition, selectedItem: string) => {
    const hawkinsMatch = bio.id === 'bio-10' ? selectedItem.match(/(\d+)\s*Hz/i) : null;
    const parsedHawkinsHz = hawkinsMatch ? Number(hawkinsMatch[1]) : null;
    const resolvedHz =
      parsedHawkinsHz !== null && Number.isFinite(parsedHawkinsHz)
        ? Math.max(20, Math.min(1000, parsedHawkinsHz))
        : null;

    if (resolvedHz !== null) {
      setHawkinsInputText(String(resolvedHz));
    }

    updateSheetAndSync((prev) => ({
      ...prev,
      spiritualPsycho:
        resolvedHz !== null
          ? {
              ...prev.spiritualPsycho,
              hawkinsAgathaHz: resolvedHz,
              hawkinsHz: resolvedHz,
              hawkinsLevel: getHawkinsLabelByHz(resolvedHz),
            }
          : prev.spiritualPsycho,
      biometerReadings: [
        {
          biometerId: bio.id,
          biometerName: `${String(bio.number).padStart(2, '0')}. ${bio.name}`,
          selectedItem,
          recordedAt: new Date().toISOString(),
        },
        ...prev.biometerReadings.slice(0, 19),
      ],
    }));
  };

  const toggleListValue = (
    field: 'spiritualDisturbances' | 'implantsDetected' | 'karmicCommitments' | 'virtuesToAnchor',
    value: string
  ) => {
    updateSheetAndSync((prev) => {
      const current = prev.spiritualPsycho[field];
      const nextList = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return {
        ...prev,
        spiritualPsycho: {
          ...prev.spiritualPsycho,
          [field]: nextList,
        },
      };
    });
  };

  const toggleColorTag = (field: 'missingColors' | 'excessColors', color: string) => {
    updateSheetAndSync((prev) => {
      const current = prev.auricField[field];
      const next = current.includes(color)
        ? current.filter((c) => c !== color)
        : [...current, color];
      return {
        ...prev,
        auricField: {
          ...prev.auricField,
          [field]: next,
        },
      };
    });
  };

  const setAuraProtectionPreset = (label: AuraProtectionLevel) => {
    const pct = label === 'Aberta 0%' ? 0 : label === 'Média 50%' ? 50 : 100;
    updateSheetAndSync((prev) => ({
      ...prev,
      auricField: {
        ...prev.auricField,
        protectionLabel: label,
        protectionPercent: pct,
      },
    }));
  };

  const setAuraSizePreset = (label: AuraSizeLevel) => {
    const pct = label === 'Encolhida' ? 25 : label === 'Regular' ? 50 : 100;
    updateSheetAndSync((prev) => ({
      ...prev,
      auricField: {
        ...prev.auricField,
        sizeLabel: label,
        sizePercent: pct,
      },
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
            Etapa Clínica 02 · Ficha Completa ANSAE & RHEN
          </p>
          <h1 className="mt-1.5 font-serif text-3xl font-light text-[#0F172A]">
            {anamnesis.fullName || 'Aferição Bioenergética Completa'}
          </h1>
          <p className="mt-1.5 text-sm text-[#45464D]">
            Foco: <span className="font-medium text-[#0F172A]">{anamnesis.therapeuticFocus || 'Não definido'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsBiometersOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-4 h-4 text-[#F59E0B]" />
            Abrir {totalBiometers} Biômetros Virtuais
          </button>
          <button
            type="button"
            onClick={() => setShowAllBlocks((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-[#B45309]" />
            {showAllBlocks ? 'Filtrar pela Pergunta Raiz' : 'Exibir Todos os Blocos'}
          </button>
          <button
            type="button"
            onClick={onBackToAnamnesis}
            className="px-4 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] transition-colors cursor-pointer whitespace-nowrap"
          >
            Editar Anamnese
          </button>
        </div>
      </section>

      {/* Pergunta Raiz: ONDE EXISTEM PROBLEMAS? */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
              Varredura Inicial de Abertura (Pergunta Raiz)
            </p>
            <h2 className="font-serif text-lg font-bold text-[#0F172A]">
              ONDE EXISTEM PROBLEMAS?
            </h2>
          </div>
          <span className="text-xs text-[#64748B]">
            Marque os domínios positivos para destacar e expandir os blocos clínicos correspondentes
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ROOT_DOMAIN_OPTIONS.map((opt) => {
            const active = sheet.rootProblems.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={`flex flex-col justify-between gap-2 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#FAF8F5] border-[#D97706] text-[#0F172A]'
                    : 'bg-white border-[#E2E8F0] text-[#45464D] hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0F172A]">{opt.title}</span>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleRootDomain(opt.id)}
                    className="w-4 h-4 accent-[#0F172A] rounded cursor-pointer"
                  />
                </div>
                <span className="text-[11px] text-[#64748B] leading-snug">{opt.hint}</span>
              </label>
            );
          })}
        </div>

        {/* Recorded readings from 22 Virtual Biometers */}
        {sheet.biometerReadings.length > 0 && (
          <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
            <p className="text-xs font-semibold text-[#0F172A]">
              Leituras Registradas nos Biômetros Virtuais ({sheet.biometerReadings.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {sheet.biometerReadings.map((r, i) => (
                <span
                  key={`${r.biometerId}-${i}`}
                  className="text-xs bg-[#FAF8F5] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[#0F172A]"
                >
                  <strong className="text-[#B45309]">{r.biometerName}:</strong> {r.selectedItem}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Main Split: Core Spiritual/Psycho + Electromagnetic/Chakras + Aura + Life Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bovis 0-18.000+, Hawkins/Agatha 20-800 Hz, Stress 0-9, Polaridade Yin/Yang */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">Biômetro de Bovis</h2>
              <span className="text-xs font-mono text-[#64748B]">0 – 18.000+ Å</span>
            </div>

            <BovisGauge bovis={sheet.spiritualPsycho.bovis} />

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  aria-label="Calibrar Biômetro de Bovis por barra"
                  type="range"
                  min={0}
                  max={18000}
                  step={100}
                  value={Math.min(18000, sheet.spiritualPsycho.bovis)}
                  onChange={(e) =>
                    updateSheetAndSync((prev) => ({
                      ...prev,
                      spiritualPsycho: {
                        ...prev.spiritualPsycho,
                        bovis: Number(e.target.value),
                      },
                    }))
                  }
                  className="flex-1 clinical-slider"
                />
                <input
                  aria-label="Valor numérico exato em Ångströms"
                  type="number"
                  min={0}
                  max={30000}
                  step={100}
                  value={sheet.spiritualPsycho.bovis}
                  onChange={(e) =>
                    updateSheetAndSync((prev) => ({
                      ...prev,
                      spiritualPsycho: {
                        ...prev.spiritualPsycho,
                        bovis: Math.max(0, Number(e.target.value) || 0),
                      },
                    }))
                  }
                  className="w-24 px-2.5 py-1.5 text-xs font-mono tabular-nums text-right bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-[#64748B]">
                <span>0 Å</span>
                <span className="text-[#B45309] font-semibold">6.500 Å (Limiar)</span>
                <span>18.000+ Å</span>
              </div>
            </div>
          </div>

          {/* Hawkins/Ágatha, Stress 0-9, Yin/Yang */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-6">
            <h2 className="font-serif text-lg font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-3">
              Dimensão Espiritual & Psicoemocional
            </h2>

            {/* Hawkins / Ágatha */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs gap-2">
                <label htmlFor="hawkinsSlider" className="font-semibold text-[#0F172A]">
                  Escala de Hawkins / Ágatha (20–1000 Hz)
                </label>
                <span className="font-mono tabular-nums font-semibold text-[#B45309] text-right">
                  {sheet.spiritualPsycho.hawkinsAgathaHz !== hawkinsInfo.hz
                    ? `${sheet.spiritualPsycho.hawkinsAgathaHz} Hz → `
                    : ''}
                  {hawkinsInfo.fullLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="hawkinsSlider"
                  type="range"
                  min={20}
                  max={1000}
                  step={5}
                  value={sheet.spiritualPsycho.hawkinsAgathaHz}
                  onChange={(e) => updateHawkinsFrequency(Number(e.target.value))}
                  className="flex-1 clinical-slider"
                />
                <input
                  aria-label="Valor numérico exato Hawkins/Ágatha em Hz"
                  type="number"
                  min={20}
                  max={1000}
                  value={hawkinsInputText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setHawkinsInputText(raw);
                    if (raw.trim() === '') return;
                    const parsed = Number(raw);
                    if (Number.isFinite(parsed) && parsed >= 20 && parsed <= 1000) {
                      updateSheetAndSync((prev) => ({
                        ...prev,
                        spiritualPsycho: {
                          ...prev.spiritualPsycho,
                          hawkinsAgathaHz: Math.round(parsed),
                          hawkinsHz: Math.round(parsed),
                          hawkinsLevel: getHawkinsLabelByHz(parsed),
                        },
                      }));
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(hawkinsInputText);
                    const safeVal = Number.isFinite(parsed) ? parsed : 20;
                    updateHawkinsFrequency(safeVal);
                  }}
                  className="w-24 px-2.5 py-1.5 text-xs font-mono tabular-nums text-right bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label
                  htmlFor="hawkinsLevelSelect"
                  className="text-[11px] font-semibold text-[#64748B] shrink-0"
                >
                  Nível Canônico:
                </label>
                <select
                  id="hawkinsLevelSelect"
                  aria-label="Selecionar nível na Escala de Hawkins"
                  value={hawkinsInfo.hz}
                  onChange={(e) => updateHawkinsFrequency(Number(e.target.value))}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] font-medium focus:outline-none focus:border-[#D97706]"
                >
                  {HAWKINS_SCALE_TABLE.map((lvl) => (
                    <option key={lvl.hz} value={lvl.hz}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-[#64748B]">
                Zona: <strong className="text-[#0F172A]">{hawkinsInfo.zone}</strong> · Patamar:{' '}
                <strong className="text-[#B45309]">{hawkinsInfo.fullLabel}</strong> —{' '}
                {hawkinsInfo.emotion}
              </p>
            </div>

            {/* Estresse 0-9 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="stressSlider" className="font-semibold text-[#0F172A]">
                  Nível de Estresse & Sobrecarga Neural (0–9)
                </label>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    sheet.spiritualPsycho.stressLevel >= 4 ? 'text-[#BA1A1A]' : 'text-[#0F172A]'
                  }`}
                >
                  {sheet.spiritualPsycho.stressLevel} / 9
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="stressSlider"
                  type="range"
                  min={0}
                  max={9}
                  step={1}
                  value={sheet.spiritualPsycho.stressLevel}
                  onChange={(e) =>
                    updateSheetAndSync((prev) => ({
                      ...prev,
                      spiritualPsycho: {
                        ...prev.spiritualPsycho,
                        stressLevel: Number(e.target.value),
                      },
                    }))
                  }
                  className="flex-1 clinical-slider"
                />
                <input
                  aria-label="Valor numérico de estresse de 0 a 9"
                  type="number"
                  min={0}
                  max={9}
                  value={sheet.spiritualPsycho.stressLevel}
                  onChange={(e) =>
                    updateSheetAndSync((prev) => ({
                      ...prev,
                      spiritualPsycho: {
                        ...prev.spiritualPsycho,
                        stressLevel: Math.max(0, Math.min(9, Number(e.target.value) || 0)),
                      },
                    }))
                  }
                  className="w-20 px-2.5 py-1.5 text-xs font-mono tabular-nums text-right bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
                />
              </div>
              <p className="text-xs text-[#64748B]">
                Nível ≥ 4 indica hiperatividade simpática e aciona contenção Anti-Catarse.
              </p>
            </div>

            {/* Polaridade Yin / Yang (%) */}
            <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="yinYangSlider" className="font-semibold text-[#0F172A]">
                  Polaridade Yin / Yang (%)
                </label>
                <span className="font-mono tabular-nums font-semibold text-[#B45309]">
                  {sheet.spiritualPsycho.yinPercent}% Yin · {sheet.spiritualPsycho.yangPercent}% Yang
                </span>
              </div>
              <input
                id="yinYangSlider"
                type="range"
                min={0}
                max={100}
                step={5}
                value={sheet.spiritualPsycho.yangPercent}
                onChange={(e) => {
                  const yang = Number(e.target.value);
                  updateSheetAndSync((prev) => ({
                    ...prev,
                    spiritualPsycho: {
                      ...prev.spiritualPsycho,
                      yangPercent: yang,
                      yinPercent: 100 - yang,
                    },
                  }));
                }}
                className="w-full clinical-slider"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#64748B] mb-1">% Yin (Retração)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={sheet.spiritualPsycho.yinPercent}
                    onChange={(e) => {
                      const yin = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      updateSheetAndSync((prev) => ({
                        ...prev,
                        spiritualPsycho: {
                          ...prev.spiritualPsycho,
                          yinPercent: yin,
                          yangPercent: 100 - yin,
                        },
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#64748B] mb-1">% Yang (Expansão)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={sheet.spiritualPsycho.yangPercent}
                    onChange={(e) => {
                      const yang = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      updateSheetAndSync((prev) => ({
                        ...prev,
                        spiritualPsycho: {
                          ...prev.spiritualPsycho,
                          yangPercent: yang,
                          yinPercent: 100 - yang,
                        },
                      }));
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Mesa Radiônica Indicada */}
            <div className="space-y-1.5 pt-3 border-t border-[#E2E8F0]">
              <label htmlFor="radionicBoard" className="block text-xs font-semibold text-[#0F172A]">
                Mesa Radiônica Indicada (Pêndulo)
              </label>
              <select
                id="radionicBoard"
                value={sheet.spiritualPsycho.recommendedRadionicBoard}
                onChange={(e) =>
                  updateSheetAndSync((prev) => ({
                    ...prev,
                    spiritualPsycho: {
                      ...prev.spiritualPsycho,
                      recommendedRadionicBoard: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
              >
                {RADIONIC_BOARD_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Áreas da Vida */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#B45309]" />
                <h2 className="font-serif text-lg font-bold text-[#0F172A]">Áreas da Vida</h2>
              </div>
              <span className="text-xs text-[#64748B]">RHEN · 5 Pilares</span>
            </div>

            <div className="space-y-3">
              {LIFE_AREAS_CONFIG.map((area) => {
                const current = sheet.lifeAreas[area.key];
                return (
                  <div key={area.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0F172A]">{area.label}</span>
                      <span
                        className={`font-medium ${
                          current === 'Péssimo' || current === 'Ruim'
                            ? 'text-[#BA1A1A]'
                            : 'text-[#B45309]'
                        }`}
                      >
                        {current}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {LIFE_AREA_RATINGS.map((rating) => {
                        const active = current === rating;
                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() =>
                              updateSheetAndSync((prev) => ({
                                ...prev,
                                lifeAreas: {
                                  ...prev.lifeAreas,
                                  [area.key]: rating,
                                },
                              }))
                            }
                            className={`py-1.5 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                              active
                                ? rating === 'Péssimo' || rating === 'Ruim'
                                  ? 'bg-[#BA1A1A] text-white border-[#BA1A1A]'
                                  : 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-[#FAF8F5] text-[#45464D] border-[#E2E8F0] hover:border-[#CBD5E1]'
                            }`}
                          >
                            {rating}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Electromagnetic Fields, 7 Chakras + Glands, Auric Field, Spiritual Disturbances */}
        <div className="lg:col-span-7 space-y-6">
          {/* Campos Eletromagnéticos */}
          {(isDomainVisible('Mental') ||
            isDomainVisible('Emocional') ||
            isDomainVisible('Espiritual') ||
            isDomainVisible('Físico')) && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                  Campos Eletromagnéticos (Corpos Sutis)
                </h2>
                <span className="text-xs text-[#64748B]">% de desequilíbrio + chakras afetados</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sheet.electromagneticFields.map((field) => (
                  <div
                    key={field.id}
                    className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#0F172A]">{field.label}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          aria-label={`Desequilíbrio % ${field.label}`}
                          type="number"
                          min={0}
                          max={100}
                          value={field.imbalancePercent}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            updateSheetAndSync((prev) => ({
                              ...prev,
                              electromagneticFields: prev.electromagneticFields.map((f) =>
                                f.id === field.id ? { ...f, imbalancePercent: val } : f
                              ),
                            }));
                          }}
                          className="w-16 px-2 py-1 text-xs font-mono text-right bg-white border border-[#CBD5E1] rounded-md"
                        />
                        <span className="text-xs font-mono text-[#64748B]">%</span>
                      </div>
                    </div>

                    <input
                      aria-label={`Barra de desequilíbrio ${field.label}`}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={field.imbalancePercent}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSheetAndSync((prev) => ({
                          ...prev,
                          electromagneticFields: prev.electromagneticFields.map((f) =>
                            f.id === field.id ? { ...f, imbalancePercent: val } : f
                          ),
                        }));
                      }}
                      className="w-full clinical-slider"
                    />

                    <div>
                      <p className="text-[11px] font-medium text-[#64748B] mb-1.5">
                        Chakras afetados:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {CHAKRA_SHORT_NAMES.map((ch) => {
                          const checked = field.affectedChakras.includes(ch);
                          const chakraColor = getChakraColor(ch);
                          return (
                            <button
                              key={ch}
                              type="button"
                              aria-pressed={checked}
                              onClick={() =>
                                updateSheetAndSync((prev) => ({
                                  ...prev,
                                  electromagneticFields: prev.electromagneticFields.map((f) => {
                                    if (f.id !== field.id) return f;
                                    const next = f.affectedChakras.includes(ch)
                                      ? f.affectedChakras.filter((x) => x !== ch)
                                      : [...f.affectedChakras, ch];
                                    return { ...f, affectedChakras: next };
                                  }),
                                }))
                              }
                              style={
                                checked
                                  ? {
                                      backgroundColor: chakraColor.bg,
                                      color: chakraColor.text,
                                      borderColor: chakraColor.border,
                                    }
                                  : {
                                      backgroundColor: '#FFFFFF',
                                      color: '#334155',
                                      borderColor: '#CBD5E1',
                                    }
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all duration-150 cursor-pointer ${
                                checked
                                  ? 'shadow-sm ring-1 ring-black/5'
                                  : 'hover:bg-[#F8FAFC]'
                              }`}
                            >
                              {checked ? (
                                <Check className="w-3 h-3 shrink-0" strokeWidth={2.75} />
                              ) : (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: chakraColor.bg }}
                                />
                              )}
                              <span>{ch}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7 Chakras + Glândulas */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                7 Chakras & Glândulas Endócrinas Correspondentes
              </h2>
              <span className="text-xs text-[#64748B]">Polaridade · % Desequilíbrio · Corpo Físico</span>
            </div>

            <div className="space-y-3">
              {sheet.chakras.map((ch) => {
                const chakraColor = CHAKRA_COLORS[ch.id as keyof typeof CHAKRA_COLORS] ?? getChakraColor(ch.id || ch.name);
                return (
                <div
                  key={ch.id}
                  style={{ borderLeftWidth: '5px', borderLeftColor: chakraColor.bg }}
                  className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 transition-colors"
                >
                  {/* 1. Identificação do Chakra e Glândula */}
                  <div className="min-w-[200px] flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: chakraColor.bg }}
                        title={`${ch.name} — ${chakraColor.colorName}`}
                      />
                      <p className="text-xs font-bold text-[#0F172A]">
                        {ch.name}
                      </p>
                      <span
                        style={{
                          backgroundColor: chakraColor.softBg,
                          color: chakraColor.accentText,
                          borderColor: chakraColor.border,
                        }}
                        className="px-1.5 py-0.5 text-[10px] font-semibold rounded border leading-none"
                      >
                        {ch.sanskrit}
                      </span>
                      {isHighlightedByAnamnesis([ch.name, ch.sanskrit]) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B]/40 rounded inline-flex items-center gap-1">
                          Sinalizado na Anamnese
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-medium text-[#B45309] pl-4">
                      Glândula: {ch.gland}
                    </p>
                  </div>

                  {/* 2. Botões de Polaridade */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(['Hipo', 'Normal', 'Hiper', 'Nulo'] as ChakraPolarityStatus[]).map((st) => {
                      const active = ch.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                chakras: prev.chakras.map((item) =>
                                  item.id === ch.id ? { ...item, status: st } : item
                                ),
                              }),
                              false,
                              true
                            )
                          }
                          className={`px-2.5 py-1 text-[10px] font-semibold rounded border cursor-pointer whitespace-nowrap ${
                            active
                              ? st === 'Normal'
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-[#B45309] text-white border-[#B45309]'
                              : 'bg-white text-[#45464D] border-[#CBD5E1] hover:border-[#94A3B8]'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>

                  {/* 3. Controle de % de Desequilíbrio (Slider + Input Numérico Isolado) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      aria-label={`Desequilíbrio % ${ch.name}`}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={ch.imbalancePercent}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSheetAndSync(
                          (prev) => ({
                            ...prev,
                            chakras: prev.chakras.map((item) =>
                              item.id === ch.id ? { ...item, imbalancePercent: val } : item
                            ),
                          }),
                          false,
                          true
                        );
                      }}
                      className="w-28 sm:w-36 min-w-0 clinical-slider"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        aria-label={`Número % desequilíbrio ${ch.name}`}
                        type="number"
                        min={0}
                        max={100}
                        value={ch.imbalancePercent}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          updateSheetAndSync(
                            (prev) => ({
                              ...prev,
                              chakras: prev.chakras.map((item) =>
                                item.id === ch.id ? { ...item, imbalancePercent: val } : item
                              ),
                            }),
                            false,
                            true
                          );
                        }}
                        className="w-16 px-2 py-1 pr-1 text-xs font-mono tabular-nums text-right bg-white border border-[#CBD5E1] rounded"
                      />
                      <span className="text-[11px] font-mono text-[#64748B] select-none">%</span>
                    </div>
                  </div>

                  {/* 4. Checkbox Afeta o corpo físico */}
                  <label className="flex items-center gap-2 pl-2 border-l border-slate-200 text-[11px] font-medium text-[#0F172A] shrink-0 cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={ch.affectsPhysicalBody}
                      onChange={(e) =>
                        updateSheetAndSync((prev) => ({
                          ...prev,
                          chakras: prev.chakras.map((item) =>
                            item.id === ch.id
                              ? { ...item, affectsPhysicalBody: e.target.checked }
                              : item
                          ),
                        }))
                      }
                      className="w-4 h-4 accent-[#0F172A] cursor-pointer shrink-0"
                    />
                    <span>Afeta físico</span>
                  </label>
                </div>
                );
              })}
            </div>
          </div>

          {/* Campo Áurico */}
          {isDomainVisible('Aura') && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-5">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-[#B45309]" />
                  <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                    Campo Áurico & Cromoterapia
                  </h2>
                </div>
                <span
                  className={`font-mono text-xs font-semibold ${
                    sheet.auricField.protectionPercent < 50 ? 'text-[#BA1A1A]' : 'text-[#B45309]'
                  }`}
                >
                  Proteção: {sheet.auricField.protectionPercent}% · Tamanho: {sheet.auricField.sizePercent}%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Proteção */}
                <div className="space-y-2.5 p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">Proteção da Aura</span>
                    <div className="flex items-center gap-1">
                      <input
                        aria-label="Porcentagem de proteção áurica"
                        type="number"
                        min={0}
                        max={100}
                        value={sheet.auricField.protectionPercent}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          const label: AuraProtectionLevel =
                            val < 35 ? 'Aberta 0%' : val < 75 ? 'Média 50%' : 'Fechada 100%';
                          updateSheetAndSync((prev) => ({
                            ...prev,
                            auricField: {
                              ...prev.auricField,
                              protectionPercent: val,
                              protectionLabel: label,
                            },
                          }));
                        }}
                        className="w-16 px-2 py-1 text-xs font-mono text-right bg-white border border-[#CBD5E1] rounded"
                      />
                      <span className="text-xs font-mono text-[#64748B]">%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Aberta 0%', 'Média 50%', 'Fechada 100%'] as AuraProtectionLevel[]).map(
                      (lvl) => {
                        const selected = sheet.auricField.protectionLabel === lvl;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setAuraProtectionPreset(lvl)}
                            className={`py-1.5 text-[11px] font-semibold rounded border transition-all duration-150 cursor-pointer ${
                              selected
                                ? AURA_PROTECTION_ACTIVE_CLASSES[lvl]
                                : NEUTRAL_AURIC_BUTTON_CLASSES
                            }`}
                          >
                            {lvl}
                          </button>
                        );
                      }
                    )}
                  </div>
                  <input
                    aria-label="Slider proteção áurica"
                    type="range"
                    min={0}
                    max={100}
                    value={sheet.auricField.protectionPercent}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const label: AuraProtectionLevel =
                        val < 35 ? 'Aberta 0%' : val < 75 ? 'Média 50%' : 'Fechada 100%';
                      updateSheetAndSync((prev) => ({
                        ...prev,
                        auricField: {
                          ...prev.auricField,
                          protectionPercent: val,
                          protectionLabel: label,
                        },
                      }));
                    }}
                    className="w-full clinical-slider"
                  />
                </div>

                {/* Tamanho */}
                <div className="space-y-2.5 p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">Tamanho do Campo Áurico</span>
                    <div className="flex items-center gap-1">
                      <input
                        aria-label="Porcentagem do tamanho da aura"
                        type="number"
                        min={0}
                        max={100}
                        value={Math.min(100, Math.max(0, sheet.auricField.sizePercent))}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          const label = getAuraSizeLabelFromPercent(val);
                          updateSheetAndSync((prev) => ({
                            ...prev,
                            auricField: {
                              ...prev.auricField,
                              sizePercent: val,
                              sizeLabel: label,
                            },
                          }));
                        }}
                        className="w-16 px-2 py-1 text-xs font-mono text-right bg-white border border-[#CBD5E1] rounded"
                      />
                      <span className="text-xs font-mono text-[#64748B]">%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Encolhida', 'Regular', 'Expandida'] as AuraSizeLevel[]).map((sz) => {
                      const selected = sheet.auricField.sizeLabel === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setAuraSizePreset(sz)}
                          className={`py-1.5 text-[11px] font-semibold rounded border transition-all duration-150 cursor-pointer ${
                            selected
                              ? AURA_SIZE_ACTIVE_CLASSES[sz]
                              : NEUTRAL_AURIC_BUTTON_CLASSES
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    aria-label="Slider tamanho da aura"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.min(100, Math.max(0, sheet.auricField.sizePercent))}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      const label = getAuraSizeLabelFromPercent(val);
                      updateSheetAndSync((prev) => ({
                        ...prev,
                        auricField: {
                          ...prev.auricField,
                          sizePercent: val,
                          sizeLabel: label,
                        },
                      }));
                    }}
                    className="w-full clinical-slider"
                  />
                </div>
              </div>

              {/* Cores em Falta (mín. 3) & Cores em Excesso (mín. 3) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">Cores em Falta (mín. 3)</span>
                    <span
                      className={`font-mono font-semibold ${
                        sheet.auricField.missingColors.length < 3
                          ? 'text-[#BA1A1A]'
                          : 'text-[#B45309]'
                      }`}
                    >
                      {sheet.auricField.missingColors.length}/3 mín.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIMARY_AURIC_COLORS.map((c) => {
                      const selected = sheet.auricField.missingColors.includes(c.name);
                      return (
                        <button
                          key={`missing-${c.name}`}
                          type="button"
                          aria-pressed={selected}
                          title={`${c.name} — ${c.chakraLabel}`}
                          onClick={() => toggleColorTag('missingColors', c.name)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all duration-150 cursor-pointer ${
                            selected ? c.activeClasses : NEUTRAL_AURIC_BUTTON_CLASSES
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>

                  {showExtraMissingColors && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#E2E8F0]/70">
                      {SECONDARY_AURIC_COLORS.map((c) => {
                        const selected = sheet.auricField.missingColors.includes(c.name);
                        return (
                          <button
                            key={`missing-extra-${c.name}`}
                            type="button"
                            aria-pressed={selected}
                            title={`${c.name} — ${c.chakraLabel}`}
                            onClick={() => toggleColorTag('missingColors', c.name)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all duration-150 cursor-pointer ${
                              selected ? c.activeClasses : NEUTRAL_AURIC_BUTTON_CLASSES
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowExtraMissingColors((v) => !v)}
                    className="text-[11px] font-medium text-[#64748B] hover:text-[#0F172A] underline-offset-2 hover:underline cursor-pointer"
                  >
                    {showExtraMissingColors
                      ? '− Ocultar Tonalidades Extras'
                      : '+ Tonalidades Extras (Rosa, Dourado, Branco, Cinza, Marrom, Preto)'}
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">Cores em Excesso (mín. 3)</span>
                    <span
                      className={`font-mono font-semibold ${
                        sheet.auricField.excessColors.length < 3
                          ? 'text-[#BA1A1A]'
                          : 'text-[#B45309]'
                      }`}
                    >
                      {sheet.auricField.excessColors.length}/3 mín.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIMARY_AURIC_COLORS.map((c) => {
                      const selected = sheet.auricField.excessColors.includes(c.name);
                      return (
                        <button
                          key={`excess-${c.name}`}
                          type="button"
                          aria-pressed={selected}
                          title={`${c.name} — ${c.chakraLabel}`}
                          onClick={() => toggleColorTag('excessColors', c.name)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all duration-150 cursor-pointer ${
                            selected ? c.activeClasses : NEUTRAL_AURIC_BUTTON_CLASSES
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>

                  {showExtraExcessColors && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#E2E8F0]/70">
                      {SECONDARY_AURIC_COLORS.map((c) => {
                        const selected = sheet.auricField.excessColors.includes(c.name);
                        return (
                          <button
                            key={`excess-extra-${c.name}`}
                            type="button"
                            aria-pressed={selected}
                            title={`${c.name} — ${c.chakraLabel}`}
                            onClick={() => toggleColorTag('excessColors', c.name)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all duration-150 cursor-pointer ${
                              selected ? c.activeClasses : NEUTRAL_AURIC_BUTTON_CLASSES
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowExtraExcessColors((v) => !v)}
                    className="text-[11px] font-medium text-[#64748B] hover:text-[#0F172A] underline-offset-2 hover:underline cursor-pointer"
                  >
                    {showExtraExcessColors
                      ? '− Ocultar Tonalidades Extras'
                      : '+ Tonalidades Extras (Rosa, Dourado, Branco, Cinza, Marrom, Preto)'}
                  </button>
                </div>
              </div>

              {/* Cruzamento Automático Cores da Aura × 7 Chakras */}
              {(() => {
                const correlation = analyzeAuricColorsChakraCorrelation(
                  sheet.auricField.missingColors,
                  sheet.auricField.excessColors
                );
                return (
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#B45309]">
                      Leitura Cruzada: Cores da Aura × Chakras Correspondentes
                    </p>
                    <p className="text-xs text-[#0F172A] leading-relaxed">
                      {correlation.summaryText}
                    </p>
                    {(correlation.missingMappings.length > 0 ||
                      correlation.excessMappings.length > 0) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-[#45464D]">
                        {correlation.missingMappings.length > 0 && (
                          <span>
                            <strong className="text-[#0F172A]">Em Falta:</strong>{' '}
                            {correlation.missingMappings.join(' · ')}
                          </span>
                        )}
                        {correlation.excessMappings.length > 0 && (
                          <span>
                            <strong className="text-[#0F172A]">Em Excesso:</strong>{' '}
                            {correlation.excessMappings.join(' · ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Distúrbios Espirituais, Implantes, Carma e Virtudes */}
          {isDomainVisible('Espiritual') && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-5">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                  Varredura Espiritual, Implantes, Carma & Virtudes
                </h2>
                <span className="font-mono text-xs font-semibold text-[#B45309]">
                  {sheet.spiritualPsycho.spiritualDisturbances.length +
                    sheet.spiritualPsycho.implantsDetected.length}{' '}
                  interferências
                </span>
              </div>

              {/* Distúrbios Espirituais */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#0F172A]">
                  Distúrbios Espirituais & Interferências Sutis
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Array.from(
                    new Set([...INTERFERENCE_OPTIONS, ...sheet.spiritualPsycho.spiritualDisturbances])
                  ).map((opt) => {
                    const checked = sheet.spiritualPsycho.spiritualDisturbances.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer ${
                          checked
                            ? 'bg-[#FAF8F5] border-[#D97706] text-[#0F172A] font-medium'
                            : 'bg-white border-[#E2E8F0] text-[#45464D]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleListValue('spiritualDisturbances', opt)}
                          className="w-4 h-4 accent-[#0F172A]"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customDisturbance}
                    onChange={(e) => setCustomDisturbance(e.target.value)}
                    placeholder="Adicionar outro distúrbio espiritual..."
                    className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customDisturbance.trim()) return;
                      toggleListValue('spiritualDisturbances', customDisturbance.trim());
                      setCustomDisturbance('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#0F172A] text-white rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Incluir
                  </button>
                </div>
              </div>

              {/* Implantes & Comprometimentos Cármicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-[#E2E8F0]">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#0F172A]">Implantes Detectados</p>
                  <div className="space-y-1.5">
                    {Array.from(
                      new Set([...IMPLANT_OPTIONS, ...sheet.spiritualPsycho.implantsDetected])
                    ).map((imp) => {
                      const checked = sheet.spiritualPsycho.implantsDetected.includes(imp);
                      return (
                        <label
                          key={imp}
                          className="flex items-center gap-2 text-xs text-[#0F172A] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleListValue('implantsDetected', imp)}
                            className="w-3.5 h-3.5 accent-[#0F172A]"
                          />
                          <span>{imp}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={customImplant}
                      onChange={(e) => setCustomImplant(e.target.value)}
                      placeholder="Outro implante..."
                      className="flex-1 px-2.5 py-1 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!customImplant.trim()) return;
                        toggleListValue('implantsDetected', customImplant.trim());
                        setCustomImplant('');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-[#0F172A] text-white rounded cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#0F172A]">Comprometimentos Cármicos</p>
                  <div className="space-y-1.5">
                    {Array.from(
                      new Set([...KARMIC_OPTIONS, ...sheet.spiritualPsycho.karmicCommitments])
                    ).map((k) => {
                      const checked = sheet.spiritualPsycho.karmicCommitments.includes(k);
                      return (
                        <label
                          key={k}
                          className="flex items-center gap-2 text-xs text-[#0F172A] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleListValue('karmicCommitments', k)}
                            className="w-3.5 h-3.5 accent-[#0F172A]"
                          />
                          <span>{k}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={customKarmic}
                      onChange={(e) => setCustomKarmic(e.target.value)}
                      placeholder="Outro registro cármico..."
                      className="flex-1 px-2.5 py-1 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!customKarmic.trim()) return;
                        toggleListValue('karmicCommitments', customKarmic.trim());
                        setCustomKarmic('');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-[#0F172A] text-white rounded cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Virtudes */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <p className="text-xs font-semibold text-[#0F172A]">Virtudes a Ancorar na Sessão</p>
                <div className="flex flex-wrap gap-1.5">
                  {VIRTUE_OPTIONS.map((v) => {
                    const selected = sheet.spiritualPsycho.virtuesToAnchor.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleListValue('virtuesToAnchor', v)}
                        className={`px-3 py-1 text-xs font-medium rounded-md border cursor-pointer ${
                          selected
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'bg-[#FAF8F5] text-[#45464D] border-[#E2E8F0]'
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-Width Section: 15 Sistemas Orgânicos & 38 Órgãos/Glândulas (ANSAE) */}
      {isDomainVisible('Órgãos') && (
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-[#B45309]" />
              <div>
                <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                  15 Sistemas Orgânicos e 38 Órgãos / Glândulas (ANSAE)
                </h2>
                <p className="text-xs text-[#64748B]">
                  Informe o % de Desequilíbrio e a Energia de Saúde em Ångströms (0 a 18.000 Å, passo 500). Valores &lt; 6.500 Å acionam o Protocolo Anti-Catarse automaticamente.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleFillHealthyDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#166534] bg-[#DCFCE7] border border-[#16A34A]/40 rounded-lg hover:bg-[#BBF7D0] transition-colors cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Preencher Padrão Saudável (9.500 Å)
              </button>
              <span
                className={`font-mono tabular-nums text-xs font-semibold ${
                  affectedSystemsCount >= 3 || previewProtocol.riskTriggered
                    ? 'text-[#BA1A1A]'
                    : 'text-[#0F172A]'
                }`}
              >
                {imbalancedOrgansCount} órgão(s) · {affectedSystemsCount} sistema(s) em atenção
              </span>
            </div>
          </div>

          {/* Legenda Faixas de Bovis */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-semibold text-[#64748B]">Indicador Bovis (Å):</span>
            <span className="px-2 py-0.5 rounded border bg-[#BA1A1A]/10 text-[#93000A] border-[#BA1A1A]/40 font-medium">
              &lt; 6.500 Å · Alerta Crítico
            </span>
            <span className="px-2 py-0.5 rounded border bg-[#FEF3C7] text-[#92400E] border-[#D97706]/50 font-medium">
              6.500 Å · Limiar Mínimo
            </span>
            <span className="px-2 py-0.5 rounded border bg-[#DCFCE7] text-[#166534] border-[#16A34A]/40 font-medium">
              ≥ 7.000 Å · Equilíbrio
            </span>
          </div>

          {/* Filter by System Sigla */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSystemTab('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                activeSystemTab === 'ALL'
                  ? 'bg-[#0F172A] text-white border-[#0F172A]'
                  : 'bg-[#FAF8F5] text-[#45464D] border-[#E2E8F0]'
              }`}
            >
              Todos os 15 Sistemas (38)
            </button>
            {SYSTEM_CODES_ORDER.map((code) => {
              const countInSys = sheet.organs.filter(
                (o) =>
                  o.systemCode === code &&
                  (o.isImbalanced ||
                    (typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500))
              ).length;
              const sysEntry = allSystems.find((s) => s.systemCode === code);
              const sysAlert =
                Boolean(sysEntry?.isImbalanced) ||
                (typeof sysEntry?.healthEnergyAngstroms === 'number' &&
                  sysEntry.healthEnergyAngstroms < 6500);
              const active = activeSystemTab === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActiveSystemTab(code)}
                  title={ANSAE_SYSTEMS_META[code]}
                  className={`px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border cursor-pointer ${
                    active
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : countInSys > 0 || sysAlert
                      ? 'bg-[#BA1A1A]/8 text-[#BA1A1A] border-[#BA1A1A]/40'
                      : 'bg-white text-[#45464D] border-[#E2E8F0] hover:border-[#D97706]'
                  }`}
                >
                  {code}
                  {countInSys > 0 ? ` (${countInSys})` : ''}
                </button>
              );
            })}
          </div>

          {/* 15 Sistemas Orgânicos (Aferição Sistêmica) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#B45309]">
                Bloco A · 15 Sistemas Orgânicos (Aferição Sistêmica ANSAE)
              </h3>
              <span className="text-[11px] text-[#64748B]">
                Registro direto de % Desequilíbrio e Energia de Saúde (Å)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredSystems.map((sys) => {
                const band = getEnergyBandMeta(sys.healthEnergyAngstroms);
                const isAlert =
                  sys.isImbalanced ||
                  (typeof sys.healthEnergyAngstroms === 'number' &&
                    sys.healthEnergyAngstroms < 6500);

                return (
                  <div
                    key={sys.systemCode}
                    className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                      band.cardBorderClass
                        ? band.cardBorderClass
                        : sys.isImbalanced
                        ? 'bg-[#BA1A1A]/5 border-[#BA1A1A]/40'
                        : 'bg-[#FAF8F5] border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sys.isImbalanced}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                systems: (prev.systems || []).map((s) =>
                                  s.systemCode === sys.systemCode
                                    ? {
                                        ...s,
                                        isImbalanced: checked,
                                        imbalancePercent:
                                          checked && s.imbalancePercent === 0
                                            ? 35
                                            : checked
                                            ? s.imbalancePercent
                                            : 0,
                                        durationValue:
                                          checked && s.durationValue === 0
                                            ? 7
                                            : checked
                                            ? s.durationValue
                                            : 0,
                                      }
                                    : s
                                ),
                              }),
                              true,
                              false
                            );
                          }}
                          className="w-4 h-4 mt-0.5 accent-[#0F172A] cursor-pointer"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-bold text-[#0F172A]">
                              [{sys.systemCode}] {sys.systemName}
                            </p>
                            {isHighlightedByAnamnesis([sys.systemName, sys.systemCode]) && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B]/40 rounded inline-flex items-center gap-1">
                                Sinalizado na Anamnese
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded border ${band.badgeClass}`}
                            >
                              {band.label}
                            </span>
                            {typeof sys.healthEnergyAngstroms === 'number' && (
                              <span className="text-[10px] font-mono text-[#45464D]">
                                {formatAngstromsBR(sys.healthEnergyAngstroms)}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                      {isAlert ? (
                        <AlertTriangle className="w-4 h-4 text-[#BA1A1A] shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#94A3B8] shrink-0" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#E2E8F0]/80">
                      <div>
                        <label className="block text-[10px] text-[#64748B] mb-0.5">
                          % Desequilíbrio
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={sys.imbalancePercent}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                systems: (prev.systems || []).map((s) =>
                                  s.systemCode === sys.systemCode
                                    ? {
                                        ...s,
                                        imbalancePercent: val,
                                        isImbalanced: val > 0 ? true : s.isImbalanced,
                                      }
                                    : s
                                ),
                              }),
                              true,
                              false
                            );
                          }}
                          className="w-full px-2 py-1 text-xs font-mono bg-white border border-[#CBD5E1] rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-[#0F172A] mb-0.5">
                          Energia (Å)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={18000}
                          step={500}
                          placeholder={sys.isImbalanced ? '6500' : '9500'}
                          value={sys.healthEnergyAngstroms ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed =
                              raw === ''
                                ? undefined
                                : Math.max(0, Math.min(18000, Number(raw)));
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                systems: (prev.systems || []).map((s) =>
                                  s.systemCode === sys.systemCode
                                    ? {
                                        ...s,
                                        healthEnergyAngstroms: Number.isNaN(parsed)
                                          ? undefined
                                          : parsed,
                                      }
                                    : s
                                ),
                              }),
                              true,
                              false
                            );
                          }}
                          className={`w-full px-2 py-1 text-xs font-mono border rounded ${band.inputClass}`}
                        />
                      </div>
                    </div>

                    {sys.isImbalanced ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#64748B] mb-0.5">Tempo</label>
                          <input
                            type="number"
                            min={0}
                            max={365}
                            value={sys.durationValue}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              updateSheetAndSync(
                                (prev) => ({
                                  ...prev,
                                  systems: (prev.systems || []).map((s) =>
                                    s.systemCode === sys.systemCode
                                      ? { ...s, durationValue: val }
                                      : s
                                  ),
                                }),
                                true,
                                false
                              );
                            }}
                            className="w-full px-2 py-1 text-xs font-mono bg-white border border-[#CBD5E1] rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#64748B] mb-0.5">Unidade</label>
                          <select
                            value={sys.durationUnit}
                            onChange={(e) => {
                              const unit = e.target.value as 'h' | 'd' | 'm';
                              updateSheetAndSync(
                                (prev) => ({
                                  ...prev,
                                  systems: (prev.systems || []).map((s) =>
                                    s.systemCode === sys.systemCode
                                      ? { ...s, durationUnit: unit }
                                      : s
                                  ),
                                }),
                                true,
                                false
                              );
                            }}
                            className="w-full px-2 py-1 text-xs font-mono bg-white border border-[#CBD5E1] rounded"
                          >
                            <option value="h">horas</option>
                            <option value="d">dias</option>
                            <option value="m">meses</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                systems: (prev.systems || []).map((s) =>
                                  s.systemCode === sys.systemCode
                                    ? { ...s, healthEnergyAngstroms: 9500 }
                                    : s
                                ),
                              }),
                              true,
                              false
                            )
                          }
                          className="text-[10px] font-semibold text-[#166534] hover:underline cursor-pointer"
                        >
                          Preencher Padrão Saudável (9.500 Å)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 38 Órgãos e Glândulas Grid */}
          <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#B45309]">
                Bloco B · 38 Órgãos e Glândulas (Detalhamento Anatômico ANSAE)
              </h3>
              <span className="text-[11px] text-[#64748B]">
                Energia (Å) ao lado de % Desequilíbrio
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredOrgans.map((organ) => {
                const band = getEnergyBandMeta(organ.healthEnergyAngstroms);
                const isAlert =
                  organ.isImbalanced ||
                  (typeof organ.healthEnergyAngstroms === 'number' &&
                    organ.healthEnergyAngstroms < 6500);

                return (
                  <div
                    key={organ.id}
                    className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                      band.cardBorderClass
                        ? band.cardBorderClass
                        : organ.isImbalanced
                        ? 'bg-[#BA1A1A]/5 border-[#BA1A1A]/40'
                        : 'bg-[#FAF8F5] border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={organ.isImbalanced}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                organs: prev.organs.map((o) =>
                                  o.id === organ.id
                                    ? {
                                        ...o,
                                        isImbalanced: checked,
                                        imbalancePercent:
                                          checked && o.imbalancePercent === 0
                                            ? 35
                                            : checked
                                            ? o.imbalancePercent
                                            : 0,
                                        durationValue:
                                          checked && o.durationValue === 0
                                            ? 7
                                            : checked
                                            ? o.durationValue
                                            : 0,
                                      }
                                    : o
                                ),
                              }),
                              true,
                              false
                            );
                          }}
                          className="w-4 h-4 mt-0.5 accent-[#0F172A] cursor-pointer"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-bold text-[#0F172A]">{organ.organName}</p>
                            {isHighlightedByAnamnesis([organ.organName, organ.systemName, organ.systemCode]) && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B]/40 rounded inline-flex items-center gap-1">
                                Sinalizado na Anamnese
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-[#64748B]">
                            {organ.systemCode} · {organ.systemName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded border ${band.badgeClass}`}
                            >
                              {band.label}
                            </span>
                            {typeof organ.healthEnergyAngstroms === 'number' && (
                              <span className="text-[10px] font-mono text-[#45464D]">
                                {formatAngstromsBR(organ.healthEnergyAngstroms)}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                      {isAlert ? (
                        <AlertTriangle className="w-4 h-4 text-[#BA1A1A] shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#94A3B8] shrink-0" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#E2E8F0]/80">
                      <div>
                        <label className="block text-[10px] text-[#64748B] mb-0.5">
                          % Desequilíbrio
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={organ.imbalancePercent}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                organs: prev.organs.map((o) =>
                                  o.id === organ.id
                                    ? {
                                        ...o,
                                        imbalancePercent: val,
                                        isImbalanced: val > 0 ? true : o.isImbalanced,
                                      }
                                    : o
                                ),
                              }),
                              true,
                              false
                            );
                          }}
                          className="w-full px-2 py-1 text-xs font-mono bg-white border border-[#CBD5E1] rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-[#0F172A] mb-0.5">
                          Energia (Å)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={18000}
                          step={500}
                          placeholder={organ.isImbalanced ? '6500' : '9500'}
                          value={organ.healthEnergyAngstroms ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed =
                              raw === ''
                                ? undefined
                                : Math.max(0, Math.min(18000, Number(raw)));
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                organs: prev.organs.map((o) =>
                                  o.id === organ.id
                                    ? {
                                        ...o,
                                        healthEnergyAngstroms: Number.isNaN(parsed)
                                          ? undefined
                                          : parsed,
                                      }
                                    : o
                                ),
                              }),
                              true,
                              false
                            );
                          }}
                          className={`w-full px-2 py-1 text-xs font-mono border rounded ${band.inputClass}`}
                        />
                      </div>
                    </div>

                    {organ.isImbalanced ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#64748B] mb-0.5">Tempo</label>
                          <input
                            type="number"
                            min={0}
                            max={365}
                            value={organ.durationValue}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              updateSheetAndSync(
                                (prev) => ({
                                  ...prev,
                                  organs: prev.organs.map((o) =>
                                    o.id === organ.id ? { ...o, durationValue: val } : o
                                  ),
                                }),
                                true,
                                false
                              );
                            }}
                            className="w-full px-2 py-1 text-xs font-mono bg-white border border-[#CBD5E1] rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#64748B] mb-0.5">Unidade</label>
                          <select
                            value={organ.durationUnit}
                            onChange={(e) => {
                              const unit = e.target.value as 'h' | 'd' | 'm';
                              updateSheetAndSync(
                                (prev) => ({
                                  ...prev,
                                  organs: prev.organs.map((o) =>
                                    o.id === organ.id ? { ...o, durationUnit: unit } : o
                                  ),
                                }),
                                true,
                                false
                              );
                            }}
                            className="w-full px-2 py-1 text-xs font-mono bg-white border border-[#CBD5E1] rounded"
                          >
                            <option value="h">horas</option>
                            <option value="d">dias</option>
                            <option value="m">meses</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            updateSheetAndSync(
                              (prev) => ({
                                ...prev,
                                organs: prev.organs.map((o) =>
                                  o.id === organ.id ? { ...o, healthEnergyAngstroms: 9500 } : o
                                ),
                              }),
                              true,
                              false
                            )
                          }
                          className="text-[10px] font-semibold text-[#166534] hover:underline cursor-pointer"
                        >
                          Preencher Padrão Saudável (9.500 Å)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

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

      {isBiometersOpen && (
        <BiometrosModal
          isOpen={isBiometersOpen}
          onClose={() => setIsBiometersOpen(false)}
          patientName={anamnesis.fullName}
          birthDate={anamnesis.birthDate}
          customBiometers={customBiometers}
          hiddenOfficialBiometers={hiddenOfficialBiometers}
          onSaveCustomBiometer={handleSaveCustomBiometer}
          onDeleteCustomBiometer={handleDeleteCustomBiometer}
          onHideOfficialBiometer={handleHideOfficialBiometer}
          onRestoreAllOfficialBiometers={handleRestoreAllOfficialBiometers}
          onRecordReading={handleRecordBiometerReading}
          currentHawkinsHz={sheet.spiritualPsycho.hawkinsAgathaHz}
          onSelectHawkinsHz={updateHawkinsFrequency}
          totalBiometersCount={totalBiometers}
        />
      )}
    </div>
  );
};
