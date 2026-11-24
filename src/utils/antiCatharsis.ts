import {
  ClinicalAnsaeRhenSheet,
  getHawkinsEntryByHz,
  getHawkinsLabelByHz,
} from '../types/clinical';

export { getHawkinsLabelByHz };
import {
  AntiCatharsisProtocol,
  ChakraReading,
  ChartDurationUnit,
  ChartEmissionStatus,
  OrganicSystemStatus,
  PatientAnamnesis,
  QuantumGenerationResult,
  QuantumGeometry,
  SensitivityReading,
} from '../types/quantum';
import { TherapeuticKit, kitChartSpecToGeometry } from '../data/therapeuticKits';

export function formatAngstromsBR(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—';
  }
  if (value === 0) {
    return '0.000 Å';
  }
  return `${value.toLocaleString('pt-BR')} Å`;
}

export const DEFAULT_CHAKRAS: ChakraReading[] = [
  { id: 'coronario', name: 'Coronário', sanskrit: 'Sahasrara', percentage: 75, status: 'Equilibrado' },
  { id: 'frontal', name: 'Frontal', sanskrit: 'Ajna', percentage: 70, status: 'Equilibrado' },
  { id: 'laringeo', name: 'Laríngeo', sanskrit: 'Vishuddha', percentage: 65, status: 'Equilibrado' },
  { id: 'cardiaco', name: 'Cardíaco', sanskrit: 'Anahata', percentage: 60, status: 'Equilibrado' },
  { id: 'plexo', name: 'Plexo Solar', sanskrit: 'Manipura', percentage: 55, status: 'Hipo-ativo' },
  { id: 'umbilical', name: 'Umbilical / Sacro', sanskrit: 'Svadhisthana', percentage: 65, status: 'Equilibrado' },
  { id: 'basico', name: 'Básico / Raiz', sanskrit: 'Muladhara', percentage: 60, status: 'Equilibrado' },
];

export const DEFAULT_ORGANIC_SYSTEMS: OrganicSystemStatus[] = [
  { id: 'nervoso', name: 'Sistema Nervoso Central', status: 'Equilibrado', note: 'Tônus vagal estável' },
  { id: 'endocrino', name: 'Sistema Endócrino', status: 'Equilibrado', note: 'Eixo HPA regular' },
  { id: 'imunologico', name: 'Sistema Imunológico', status: 'Equilibrado', note: 'Resposta linfocitária íntegra' },
  { id: 'cardiovascular', name: 'Sistema Cardiovascular', status: 'Equilibrado', note: 'Coerência cardíaca regular' },
  { id: 'digestivo', name: 'Sistema Digestivo', status: 'Equilibrado', note: 'Assimilação metabólica normal' },
  { id: 'respiratorio', name: 'Sistema Respiratório', status: 'Equilibrado', note: 'Fluxo prânico livre' },
  { id: 'osteomuscular', name: 'Sistema Osteomuscular', status: 'Equilibrado', note: 'Estrutura sem sobrecarga' },
  { id: 'renal', name: 'Sistema Renal / Urinário', status: 'Equilibrado', note: 'Filtragem e vitalidade hídrica' },
];

export const INTERFERENCE_OPTIONS: string[] = [
  'Miasmas & Impregnações Densas',
  'Formas-Pensamento Autogeradas',
  'Inveja / Carga Eletromagnética Externa',
  'Geobiologia / Rede Hartmann',
  'Cordões Energéticos Parasitas',
];

export function getHawkinsLevelInfo(score: number): {
  hz: number;
  label: string;
  fullLabel: string;
  emotion: string;
  zone: 'Contração' | 'Neutralidade' | 'Expansão';
} {
  const entry = getHawkinsEntryByHz(score);
  return {
    hz: entry.hz,
    label: entry.shortLabel,
    fullLabel: entry.label,
    emotion: entry.emotion,
    zone: entry.zone,
  };
}

export function formatBirthDateBR(birthDate: string): string {
  if (!birthDate) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)) return birthDate;
  const parts = birthDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return birthDate;
}

export function isPetInteragent(anamnesis?: Partial<PatientAnamnesis> | null): boolean {
  return anamnesis?.interagentType === 'pet';
}

export function formatInteragentDisplayLabel(anamnesis: PatientAnamnesis): string {
  if (!isPetInteragent(anamnesis)) {
    return anamnesis.fullName.trim() || 'Paciente';
  }
  const petName = anamnesis.fullName.trim() || 'Pet';
  const speciesBreed = [anamnesis.petSpecies, anamnesis.petBreed?.trim()]
    .filter(Boolean)
    .join('/');
  const tutorPart = anamnesis.tutorName?.trim()
    ? `Tutor: ${anamnesis.tutorName.trim()}`
    : '';
  const meta = [speciesBreed, tutorPart].filter(Boolean).join(' • ');
  return meta ? `${petName} (${meta})` : petName;
}

export function formatInteragentBirthOrAge(anamnesis: PatientAnamnesis): string {
  const birthBR = formatBirthDateBR(anamnesis.birthDate);
  if (isPetInteragent(anamnesis)) {
    const parts = [birthBR, anamnesis.petAge?.trim()].filter(Boolean);
    return parts.join(' • ') || 'Idade não informada';
  }
  return birthBR || 'Data não informada';
}

export function formatTestemunho(
  anamnesis: PatientAnamnesis,
  customFocus?: string
): string {
  const nome = formatInteragentDisplayLabel(anamnesis);
  const nasc = formatInteragentBirthOrAge(anamnesis);
  const foco = (customFocus || anamnesis.therapeuticFocus || 'Equilíbrio Vibracional Integral').trim();
  return `${nome} - ${nasc} | ${foco}`;
}

export function normalizeStageTag(stageOrLabel: string): 'stage1' | 'stage2' | 'single' {
  const lower = (stageOrLabel || '').toLowerCase();
  if (lower.includes('stage1') || lower.includes('etapa 1') || lower.includes('limpeza')) {
    return 'stage1';
  }
  if (lower.includes('stage2') || lower.includes('etapa 2') || lower.includes('regenera')) {
    return 'stage2';
  }
  return 'single';
}

export function getChartCrystalKey(stageOrLabel: string, geometryName: string): string {
  return `${normalizeStageTag(stageOrLabel)}::${geometryName.trim()}`;
}

export function resolveCrystalForChart(
  chartCrystals: Record<string, string> | undefined,
  stageOrLabel: string,
  geometryName: string
): string {
  if (!chartCrystals) return '';
  const key = getChartCrystalKey(stageOrLabel, geometryName);
  const raw = chartCrystals[key] || chartCrystals[geometryName] || '';
  if (!raw || raw.trim().toLowerCase() === 'nenhum') return '';
  return raw.trim();
}

export function applyCrystalToTestemunho(
  baseTestemunho: string,
  crystalName: string | undefined,
  anamnesis: PatientAnamnesis
): string {
  const cleanBase = (baseTestemunho || '')
    .replace(/\s*•\s*Frequência Cristalina:[^|\n]*$/i, '')
    .trim();
  const base = cleanBase || formatTestemunho(anamnesis);
  const cleanCrystal = (crystalName || '').trim();
  if (!cleanCrystal || cleanCrystal.toLowerCase() === 'nenhum') {
    return base;
  }
  return `${base} • Frequência Cristalina: ${cleanCrystal}`;
}

export function buildPendulatedGraphicCommand(
  geometry: QuantumGeometry,
  stageLabel: string,
  crystalName: string | undefined,
  anamnesis: PatientAnamnesis
): string {
  const nome = formatInteragentDisplayLabel(anamnesis);
  const targetFocus =
    geometry.customFocus?.trim() ||
    anamnesis.therapeuticFocus?.trim() ||
    'Equilíbrio Vibracional Integral';
  const cleanCrystal =
    crystalName && crystalName.trim().toLowerCase() !== 'nenhum'
      ? crystalName.trim()
      : '';
  const purposeClause = geometry.role
    ? ` direcionada para ${geometry.role.charAt(0).toLowerCase()}${geometry.role.slice(1).replace(/\.$/, '')}`
    : '';

  if (cleanCrystal) {
    return `Eu ativo a geometria de ${geometry.name} (${stageLabel}) potencializada pela frequência vibracional informacional de ${cleanCrystal} sobre ${nome}${purposeClause}, colapsando no campo de ponto zero a restauração harmônica para ${targetFocus} e elevando sua coerência na Escala de Hawkins. Está ativado, colapsado e manifestado na ordem cósmica.`;
  }

  return `Eu ativo a geometria de ${geometry.name} (${stageLabel}) sobre ${nome}${purposeClause}, colapsando no campo de ponto zero a transferência arquetípica pura em Ressonância Harmônica para ${targetFocus}. Está ativado, colapsado e manifestado na ordem cósmica.`;
}

export function applyCrystalToComando(
  existingCommand: string | undefined,
  geometryName: string,
  stageLabel: string,
  crystalName: string | undefined,
  anamnesis: PatientAnamnesis,
  geometry?: QuantumGeometry
): string {
  const nome = formatInteragentDisplayLabel(anamnesis);
  const foco =
    geometry?.customFocus?.trim() ||
    anamnesis.therapeuticFocus.trim() ||
    'Equilíbrio Vibracional Integral';
  const cleanCrystal = (crystalName || '').trim();

  const strippedExisting = (existingCommand || '')
    .replace(
      /^(?:Eu\s+)?[Aa]tivo a geometria (?:pura )?de\s+[\s\S]*?potencializada pela frequência vibracional informacional de\s+[\s\S]*?(?:sobre\s+[\s\S]*?)(?:\.\s+|,\s+colapsando[\s\S]*?ordem cósmica\.\s*)/i,
      ''
    )
    .trim();

  if (cleanCrystal && cleanCrystal.toLowerCase() !== 'nenhum') {
    const isBaselinePure =
      !strippedExisting ||
      /^Eu ativo a geometria (?:pura )?de /i.test(strippedExisting);
    if (!isBaselinePure) {
      return `Ativo a geometria de ${geometryName} potencializada pela frequência vibracional informacional de ${cleanCrystal} sobre ${nome}. ${strippedExisting}`;
    }
    if (geometry?.source === 'therapist') {
      return buildPendulatedGraphicCommand(geometry, stageLabel, cleanCrystal, anamnesis);
    }
    return `Ativo a geometria de ${geometryName} (${stageLabel}) potencializada pela frequência vibracional informacional de ${cleanCrystal} sobre ${nome}, colapsando no campo de ponto zero a restauração harmônica para ${foco}. Está ativado, colapsado e manifestado na ordem cósmica.`;
  }

  if (strippedExisting) {
    return strippedExisting;
  }

  if (geometry?.source === 'therapist') {
    return buildPendulatedGraphicCommand(geometry, stageLabel, undefined, anamnesis);
  }

  return `Eu ativo a geometria pura de ${geometryName} (${stageLabel}) sobre ${nome}, colapsando no campo de ponto zero o equilíbrio integral para ${foco}. Está ativado, colapsado e manifestado na ordem cósmica.`;
}

export function applyChartCrystalsToResult(
  existingResult: QuantumGenerationResult | null,
  protocol: AntiCatharsisProtocol,
  anamnesis: PatientAnamnesis,
  sensitivity: SensitivityReading,
  chartCrystals: Record<string, string>
): QuantumGenerationResult {
  const activeCharts: Array<{
    stageTag: 'stage1' | 'stage2' | 'single';
    stageLabel: string;
    geo: QuantumGeometry;
  }> = [
    ...(protocol.stage1?.geometries.map((geo) => ({
      stageTag: 'stage1' as const,
      stageLabel: 'Etapa 1 — Limpeza & Blindagem',
      geo,
    })) || []),
    ...(protocol.stage2?.geometries.map((geo) => ({
      stageTag: 'stage2' as const,
      stageLabel: 'Etapa 2 — Regeneração & Vitalidade',
      geo,
    })) || []),
    ...(protocol.singleStage?.geometries.map((geo) => ({
      stageTag: 'single' as const,
      stageLabel: 'Etapa Única — Harmonização Direta',
      geo,
    })) || []),
  ];

  const existingTestemunhos = existingResult?.testemunhos || [];
  const existingComandos = existingResult?.comandosQuanticos || [];

  const nextTestemunhos = activeCharts.map((item) => {
    const crystal = resolveCrystalForChart(chartCrystals, item.stageTag, item.geo.name);
    const matched =
      existingTestemunhos.find(
        (t) => t.geometria === item.geo.name && normalizeStageTag(t.etapa) === item.stageTag
      ) || existingTestemunhos.find((t) => t.geometria === item.geo.name);

    const focusStr = item.geo.customFocus?.trim()
      ? `${item.geo.customFocus.trim()} (${item.geo.name})`
      : `${anamnesis.therapeuticFocus || 'Equilíbrio Integral'} (${item.geo.name})`;

    return {
      geometria: item.geo.name,
      etapa: matched?.etapa || item.stageLabel,
      testemunhoFormatado: applyCrystalToTestemunho(
        matched?.testemunhoFormatado || formatTestemunho(anamnesis, focusStr),
        crystal,
        anamnesis
      ),
      ...(crystal ? { cristalAncorado: crystal } : {}),
      origem: item.geo.source || matched?.origem || 'motor',
      ...(item.geo.customFocus ? { focoEspecifico: item.geo.customFocus } : {}),
    };
  });

  const nextComandos = activeCharts.map((item) => {
    const crystal = resolveCrystalForChart(chartCrystals, item.stageTag, item.geo.name);
    const matched =
      existingComandos.find(
        (c) => c.geometria === item.geo.name && normalizeStageTag(c.etapa) === item.stageTag
      ) || existingComandos.find((c) => c.geometria === item.geo.name);

    return {
      geometria: item.geo.name,
      etapa: matched?.etapa || item.stageLabel,
      tituloComando:
        matched?.tituloComando ||
        `Ativação ${item.geo.name}${crystal ? ` com ${crystal}` : ''}`,
      comandoTexto: applyCrystalToComando(
        matched?.comandoTexto,
        item.geo.name,
        matched?.etapa || item.stageLabel,
        crystal,
        anamnesis,
        item.geo
      ),
      ...(crystal ? { cristalAncorado: crystal } : {}),
      origem: item.geo.source || matched?.origem || 'motor',
      ...(item.geo.customFocus ? { focoEspecifico: item.geo.customFocus } : {}),
    };
  });

  const anchoredCrystalNames = Array.from(
    new Set(
      activeCharts
        .map((c) => resolveCrystalForChart(chartCrystals, c.stageTag, c.geo.name))
        .filter(Boolean)
    )
  );

  if (existingResult) {
    const mergedCrystals = Array.from(
      new Set([
        ...anchoredCrystalNames,
        ...(existingResult.prescricoes?.cristais || []).filter(
          (c) => !c.startsWith('Cristal Ancorado na Mesa:')
        ),
      ])
    );
    return {
      ...existingResult,
      testemunhos: nextTestemunhos,
      comandosQuanticos: nextComandos,
      prescricoes: {
        ...existingResult.prescricoes,
        cristais: mergedCrystals,
      },
    };
  }

  const hawkins = getHawkinsLevelInfo(sensitivity.hawkins);
  const isPet = isPetInteragent(anamnesis);
  const displayLabel = formatInteragentDisplayLabel(anamnesis);
  const tutorFirstName =
    anamnesis.tutorName?.trim().split(/\s+/)[0] ||
    anamnesis.tutorName?.trim() ||
    'Tutor(a)';

  if (isPet) {
    return {
      welcomeMessage: `Prezado(a) ${tutorFirstName}:\nReceba este acompanhamento vibracional com serenidade para o cuidado de ${displayLabel}. A leitura radiestésica registrada na Mesa acolhe as necessidades energéticas, comportamentais e ambientais do animal com suavidade, sempre em apoio complementar ao médico-veterinário.`,
      testemunhos: nextTestemunhos,
      comandosQuanticos: nextComandos,
      analisePsicossomatica: `Leitura veterinária integrativa de ${displayLabel} aferida em ${sensitivity.bovis.toLocaleString('pt-BR')} Å na escala de Bovis e ${hawkins.fullLabel} na escala de Hawkins, com proteção áurica em ${sensitivity.auricProtection}%. Protocolo configurado em ${protocol.mode === 'escalonado' ? '2 etapas anti-catarse' : 'etapa única direta'} com seleção radiestésica de cristais informacionais.`,
      orientacaoPacienteResumo: `O atendimento de ${displayLabel} foi estruturado para promover acolhimento energético gradual, respeitando a vitalidade atual do animal (${sensitivity.bovis.toLocaleString('pt-BR')} Å) e favorecendo calma, recuperação física e equilíbrio no ambiente doméstico.`,
      prescricoes: {
        floraisBach: [
          'Rescue Remedy sem álcool (estabilização emocional e conforto no bebedouro)',
        ],
        cristais:
          anchoredCrystalNames.length > 0
            ? anchoredCrystalNames
            : ['Quartzo Transparente (harmonização suave do espaço de descanso)'],
        fitoterapiaChas: [
          'Apoio vibracional em água fresca e pura (sem ervas ou extratos sem liberação veterinária)',
        ],
        bonsHabitos: [
          'Trocar a água do bebedouro com frequência mantendo-a limpa e fresca',
          'Manter a caminha e o espaço de descanso limpos, arejados e tranquilos',
        ],
        frequenciasSolfeggio: [
          {
            hz: 432,
            nome: '432 Hz — Coerência Natural',
            indicacao: 'Relaxamento suave do pet e do ambiente doméstico',
          },
        ],
        pilaresAutocuidado: {
          hidratacaoFitoterapia:
            'Disponibilizar sempre água fresca e limpa; caso utilize florais de Bach físicos, solicitar manipulação sem álcool (base glicerina ou água pura) conforme orientação.',
          higieneMentalOracao:
            'Manter rotina previsível, tom de voz calmo, carinho e serenidade emocional do tutor, evitando estresse ou conflitos próximos ao animal.',
          ambiente:
            'Higienizar periodicamente a caminha, cobertores e o cantinho de descanso, preservando ventilação natural e silêncio no período noturno.',
          acompanhamentoMedico:
            'Manter integralmente todas as consultas, exames, vacinas e medicações prescritas pelo médico-veterinário responsável.',
        },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    welcomeMessage: `Receba este atendimento integrativo com serenidade, ${anamnesis.fullName || 'paciente'}. A leitura vibracional registrada na Mesa Radiônica acolhe suas necessidades atuais com respeito ao ritmo do seu organismo e confiança no processo de reequilíbrio.`,
    testemunhos: nextTestemunhos,
    comandosQuanticos: nextComandos,
    analisePsicossomatica: `Leitura aferida em ${sensitivity.bovis.toLocaleString('pt-BR')} Å na escala de Bovis e ${hawkins.fullLabel} na escala de Hawkins, com proteção áurica em ${sensitivity.auricProtection}%. Protocolo configurado em ${protocol.mode === 'escalonado' ? '2 etapas anti-catarse' : 'etapa única direta'} com seleção radiestésica de cristais informacionais.`,
    orientacaoPacienteResumo: `Seu atendimento foi estruturado para promover acolhimento energético gradual, respeitando sua vitalidade atual (${sensitivity.bovis.toLocaleString('pt-BR')} Å) e fortalecendo seu equilíbrio emocional e físico ao longo do ciclo.`,
    prescricoes: {
      floraisBach: ['Rescue Remedy (estabilização emocional e conforto)'],
      cristais:
        anchoredCrystalNames.length > 0
          ? anchoredCrystalNames
          : ['Quartzo Transparente (amplificação harmônica geral)'],
      fitoterapiaChas: ['Camomila ou Melissa (infusão suave noturna)'],
      bonsHabitos: [
        'Hidratação consciente de 2L de água pura ao longo do dia',
        'Respiração lenta por 5 minutos antes do sono',
      ],
      frequenciasSolfeggio: [
        {
          hz: 432,
          nome: '432 Hz — Coerência Natural',
          indicacao: 'Estabilização do campo e relaxamento',
        },
      ],
      pilaresAutocuidado: {
        hidratacaoFitoterapia: 'Beber água pura em pequenas porções ao longo do dia e optar por chás suaves à noite.',
        higieneMentalOracao: 'Praticar 10 minutos diários de respiração calma, silêncio ou oração.',
        ambiente: 'Manter o quarto arejado, limpo e com iluminação suave antes de dormir.',
        acompanhamentoMedico: 'Manter normalmente todas as consultas, exames e prescrições médicas convencionais.',
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

export function addGeometryToProtocol(
  protocol: AntiCatharsisProtocol,
  requestedStage: 'stage1' | 'stage2' | 'single',
  geometry: QuantumGeometry
): {
  protocol: AntiCatharsisProtocol;
  resolvedStage: 'stage1' | 'stage2' | 'single';
} {
  if (protocol.mode === 'escalonado' && protocol.stage1 && protocol.stage2) {
    const targetStage: 'stage1' | 'stage2' =
      requestedStage === 'stage1'
        ? 'stage1'
        : requestedStage === 'stage2'
        ? 'stage2'
        : geometry.category === 'assepsia' || geometry.category === 'protecao'
        ? 'stage1'
        : 'stage2';

    if (targetStage === 'stage1') {
      const exists = protocol.stage1.geometries.some(
        (g) => g.name.toLowerCase() === geometry.name.toLowerCase()
      );
      const nextGeos = exists
        ? protocol.stage1.geometries.map((g) =>
            g.name.toLowerCase() === geometry.name.toLowerCase() ? { ...g, ...geometry } : g
          )
        : [...protocol.stage1.geometries, geometry];
      return {
        protocol: {
          ...protocol,
          stage1: {
            ...protocol.stage1,
            geometries: nextGeos,
          },
        },
        resolvedStage: 'stage1',
      };
    }

    const exists = protocol.stage2.geometries.some(
      (g) => g.name.toLowerCase() === geometry.name.toLowerCase()
    );
    const nextGeos = exists
      ? protocol.stage2.geometries.map((g) =>
          g.name.toLowerCase() === geometry.name.toLowerCase() ? { ...g, ...geometry } : g
        )
      : [...protocol.stage2.geometries, geometry];
    return {
      protocol: {
        ...protocol,
        stage2: {
          ...protocol.stage2,
          geometries: nextGeos,
        },
      },
      resolvedStage: 'stage2',
    };
  }

  if (protocol.singleStage) {
    const exists = protocol.singleStage.geometries.some(
      (g) => g.name.toLowerCase() === geometry.name.toLowerCase()
    );
    const nextGeos = exists
      ? protocol.singleStage.geometries.map((g) =>
          g.name.toLowerCase() === geometry.name.toLowerCase() ? { ...g, ...geometry } : g
        )
      : [...protocol.singleStage.geometries, geometry];
    return {
      protocol: {
        ...protocol,
        singleStage: {
          ...protocol.singleStage,
          geometries: nextGeos,
        },
      },
      resolvedStage: 'single',
    };
  }

  return { protocol, resolvedStage: requestedStage };
}

export function removeGeometryFromProtocol(
  protocol: AntiCatharsisProtocol,
  stageTag: 'stage1' | 'stage2' | 'single',
  geometryName: string
): AntiCatharsisProtocol {
  const matches = (g: QuantumGeometry) => g.name !== geometryName;
  if (stageTag === 'stage1' && protocol.stage1) {
    return {
      ...protocol,
      stage1: {
        ...protocol.stage1,
        geometries: protocol.stage1.geometries.filter(matches),
      },
    };
  }
  if (stageTag === 'stage2' && protocol.stage2) {
    return {
      ...protocol,
      stage2: {
        ...protocol.stage2,
        geometries: protocol.stage2.geometries.filter(matches),
      },
    };
  }
  if (stageTag === 'single' && protocol.singleStage) {
    return {
      ...protocol,
      singleStage: {
        ...protocol.singleStage,
        geometries: protocol.singleStage.geometries.filter(matches),
      },
    };
  }
  return protocol;
}

export function durationUnitToMs(value: number, unit: ChartDurationUnit): number {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 1;
  if (unit === 'minutos') return safeValue * 60 * 1000;
  if (unit === 'horas') return safeValue * 3600 * 1000;
  return safeValue * 24 * 3600 * 1000;
}

export function calculateChartExpiresAt(
  activatedAtIso: string,
  durationValue: number,
  durationUnit: ChartDurationUnit
): string {
  const startMs = new Date(activatedAtIso).getTime();
  const baseMs = Number.isNaN(startMs) ? Date.now() : startMs;
  return new Date(baseMs + durationUnitToMs(durationValue, durationUnit)).toISOString();
}

export function formatChartDurationLabel(
  value?: number,
  unit?: ChartDurationUnit
): string {
  if (!value || !unit) return 'Prazo personalizado';
  if (unit === 'minutos') return `${value} ${value === 1 ? 'minuto' : 'minutos'}`;
  if (unit === 'horas') return `${value} ${value === 1 ? 'hora' : 'horas'}`;
  return `${value} ${value === 1 ? 'dia' : 'dias'}`;
}

export function formatCountdownMs(ms: number): string {
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export interface ChartEmissionMetrics {
  hasTimer: boolean;
  status: ChartEmissionStatus | 'idle';
  statusLabel: string;
  remainingMs: number;
  totalMs: number;
  progressPercent: number;
  remainingPercent: number;
  countdownText: string;
}

export function computeChartEmissionMetrics(
  geo: QuantumGeometry,
  nowMs: number = Date.now()
): ChartEmissionMetrics {
  if (geo.status === 'withdrawn') {
    return {
      hasTimer: Boolean(geo.activatedAt && geo.expiresAt),
      status: 'withdrawn',
      statusLabel: 'Retirada registrada',
      remainingMs: 0,
      totalMs: 0,
      progressPercent: 100,
      remainingPercent: 0,
      countdownText: 'Concluída',
    };
  }

  if (!geo.activatedAt || !geo.expiresAt) {
    return {
      hasTimer: false,
      status: 'idle',
      statusLabel: 'Aguardando ativação na mesa',
      remainingMs: 0,
      totalMs: 0,
      progressPercent: 0,
      remainingPercent: 100,
      countdownText: '—',
    };
  }

  const startMs = new Date(geo.activatedAt).getTime();
  const endMs = new Date(geo.expiresAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return {
      hasTimer: false,
      status: 'idle',
      statusLabel: 'Aguardando ativação na mesa',
      remainingMs: 0,
      totalMs: 0,
      progressPercent: 0,
      remainingPercent: 100,
      countdownText: '—',
    };
  }

  const totalMs = Math.max(1000, endMs - startMs);
  const remainingMs = endMs - nowMs;
  const elapsedMs = Math.max(0, nowMs - startMs);
  const progressPercent = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
  const remainingPercent = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  if (remainingMs <= 0) {
    return {
      hasTimer: true,
      status: 'expired',
      statusLabel: 'Prazo vencido — Retirar / Reavaliar no Pêndulo!',
      remainingMs,
      totalMs,
      progressPercent: 100,
      remainingPercent: 0,
      countdownText: `Vencido há ${formatCountdownMs(remainingMs)}`,
    };
  }

  if (remainingPercent < 15) {
    return {
      hasTimer: true,
      status: 'warning',
      statusLabel: 'Aviso prévio — faltando menos de 15% do tempo para retirada',
      remainingMs,
      totalMs,
      progressPercent,
      remainingPercent,
      countdownText: formatCountdownMs(remainingMs),
    };
  }

  return {
    hasTimer: true,
    status: 'active',
    statusLabel: 'Em emissão',
    remainingMs,
    totalMs,
    progressPercent,
    remainingPercent,
    countdownText: formatCountdownMs(remainingMs),
  };
}

export function applyTherapeuticKitToProtocol(
  protocol: AntiCatharsisProtocol,
  kit: TherapeuticKit
): {
  protocol: AntiCatharsisProtocol;
  stage1Added: string[];
  stage2Added: string[];
  singleAdded: string[];
} {
  let nextProtocol = protocol;
  const stage1Added: string[] = [];
  const stage2Added: string[] = [];
  const singleAdded: string[] = [];

  for (const spec of kit.charts) {
    const geo = kitChartSpecToGeometry(spec);
    if (nextProtocol.mode === 'escalonado' && nextProtocol.stage1 && nextProtocol.stage2) {
      const targetStage: 'stage1' | 'stage2' =
        spec.category === 'assepsia' || spec.category === 'protecao' ? 'stage1' : 'stage2';
      nextProtocol = addGeometryToProtocol(nextProtocol, targetStage, geo).protocol;
      if (targetStage === 'stage1') {
        stage1Added.push(spec.name);
      } else {
        stage2Added.push(spec.name);
      }
    } else {
      nextProtocol = addGeometryToProtocol(nextProtocol, 'single', geo).protocol;
      singleAdded.push(spec.name);
    }
  }

  return {
    protocol: nextProtocol,
    stage1Added,
    stage2Added,
    singleAdded,
  };
}

function preserveMotorTimers(
  freshList: QuantumGeometry[],
  previousList?: QuantumGeometry[]
): QuantumGeometry[] {
  if (!previousList || previousList.length === 0) return freshList;
  return freshList.map((g) => {
    const prev = previousList.find(
      (p) => p.name.toLowerCase() === g.name.toLowerCase()
    );
    if (!prev || !prev.activatedAt) return g;
    return {
      ...g,
      activatedAt: prev.activatedAt,
      durationValue: prev.durationValue,
      durationUnit: prev.durationUnit,
      expiresAt: prev.expiresAt,
      status: prev.status,
      withdrawnAt: prev.withdrawnAt,
    };
  });
}

export function preserveTherapistChartsInProtocol(
  freshProtocol: AntiCatharsisProtocol,
  previousProtocol?: AntiCatharsisProtocol | null
): AntiCatharsisProtocol {
  if (!previousProtocol) return freshProtocol;

  let merged: AntiCatharsisProtocol = {
    ...freshProtocol,
    stage1: freshProtocol.stage1
      ? {
          ...freshProtocol.stage1,
          geometries: preserveMotorTimers(
            freshProtocol.stage1.geometries,
            previousProtocol.stage1?.geometries
          ),
        }
      : null,
    stage2: freshProtocol.stage2
      ? {
          ...freshProtocol.stage2,
          geometries: preserveMotorTimers(
            freshProtocol.stage2.geometries,
            previousProtocol.stage2?.geometries
          ),
        }
      : null,
    singleStage: freshProtocol.singleStage
      ? {
          ...freshProtocol.singleStage,
          geometries: preserveMotorTimers(
            freshProtocol.singleStage.geometries,
            previousProtocol.singleStage?.geometries
          ),
        }
      : null,
  };

  const manualStage1 = (previousProtocol.stage1?.geometries || []).filter(
    (g) => g.source === 'therapist'
  );
  const manualStage2 = (previousProtocol.stage2?.geometries || []).filter(
    (g) => g.source === 'therapist'
  );
  const manualSingle = (previousProtocol.singleStage?.geometries || []).filter(
    (g) => g.source === 'therapist'
  );

  manualStage1.forEach((g) => {
    merged = addGeometryToProtocol(merged, 'stage1', g).protocol;
  });
  manualStage2.forEach((g) => {
    merged = addGeometryToProtocol(merged, 'stage2', g).protocol;
  });
  manualSingle.forEach((g) => {
    merged = addGeometryToProtocol(merged, 'single', g).protocol;
  });
  return merged;
}

function includesProsperityFocus(anamnesis: PatientAnamnesis): boolean {
  const text = `${anamnesis.therapeuticFocus} ${anamnesis.emotionalHistory} ${anamnesis.clinicalNotes}`.toLowerCase();
  const keywords = [
    'prosperidade',
    'financeir',
    'abundância',
    'abundancia',
    'dinheiro',
    'carreira',
    'negócio',
    'negocio',
    'trabalho',
    'sucesso',
    'dívida',
    'divida',
    'riqueza',
  ];
  return keywords.some((kw) => text.includes(kw));
}

const VITAL_ANSAE_KEYWORDS = [
  'coração',
  'cérebro',
  'rins',
  'fígado',
  'pâncreas',
  'imunológico',
  'medula',
  'pulmões',
  'timo',
  'nervoso',
  'cardiovascular',
  'endócrino',
];

function isVitalItemName(name: string): boolean {
  const lower = name.toLowerCase();
  return VITAL_ANSAE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function evaluateAntiCatharsis(
  anamnesis: PatientAnamnesis,
  sensitivity: SensitivityReading,
  ansaeSheet?: ClinicalAnsaeRhenSheet
): AntiCatharsisProtocol {
  const alertSystems = sensitivity.organicSystems.filter((s) => s.status === 'Em Alerta');
  const alertSystemsCount = alertSystems.length;

  const riskReasons: string[] = [];

  if (sensitivity.bovis < 6500) {
    riskReasons.push(
      `Biômetro de Bovis em ${sensitivity.bovis.toLocaleString('pt-BR')} Å (abaixo do limiar de estabilidade de 6.500 Å)`
    );
  }
  if (sensitivity.auricProtection < 50) {
    riskReasons.push(
      `Proteção Áurica em ${sensitivity.auricProtection}% (abaixo do mínimo seguro de 50%)`
    );
  }
  if (sensitivity.stressLevel >= 4) {
    riskReasons.push(
      `Sobrecarga / Estresse do Sistema Nervoso em nível ${sensitivity.stressLevel}/9 (≥ 4 exige descompressão gradual)`
    );
  }
  if (sensitivity.subtleInterferences > 0) {
    riskReasons.push(
      `${sensitivity.subtleInterferences} interferência(s) sutil(is) ativa(s) detectada(s) na varredura`
    );
  }
  if (alertSystemsCount >= 3) {
    riskReasons.push(
      `${alertSystemsCount} sistemas orgânicos em estado de alerta simultâneo (≥ 3 exige estabilização prévia)`
    );
  }

  // Regra Anti-Catarse para Energia de Saúde (Å) < 6.500 Å em Sistemas e Órgãos ANSAE
  const criticalEnergyEntries: string[] = [];
  const seenCriticalNames = new Set<string>();

  (ansaeSheet?.systems || []).forEach((sys) => {
    if (typeof sys.healthEnergyAngstroms === 'number' && sys.healthEnergyAngstroms < 6500) {
      const label = `${sys.systemName} [${sys.systemCode}] (${formatAngstromsBR(
        sys.healthEnergyAngstroms
      )})`;
      if (!seenCriticalNames.has(sys.systemName)) {
        seenCriticalNames.add(sys.systemName);
        criticalEnergyEntries.push(label);
      }
    }
  });

  (ansaeSheet?.organs || []).forEach((org) => {
    if (typeof org.healthEnergyAngstroms === 'number' && org.healthEnergyAngstroms < 6500) {
      const tag = isVitalItemName(org.organName) ? ' [Órgão Vital]' : '';
      const label = `${org.organName}${tag} (${formatAngstromsBR(org.healthEnergyAngstroms)})`;
      if (!seenCriticalNames.has(org.organName)) {
        seenCriticalNames.add(org.organName);
        criticalEnergyEntries.push(label);
      }
    }
  });

  if (criticalEnergyEntries.length === 0) {
    (sensitivity.organicSystems || []).forEach((sys) => {
      if (typeof sys.healthEnergyAngstroms === 'number' && sys.healthEnergyAngstroms < 6500) {
        criticalEnergyEntries.push(`${sys.name} (${formatAngstromsBR(sys.healthEnergyAngstroms)})`);
      }
    });
  }

  if (criticalEnergyEntries.length > 0) {
    riskReasons.push(
      `Energia de Saúde abaixo de 6.500 Å detectada em ${criticalEnergyEntries.length} sistema(s)/órgão(s): ${criticalEnergyEntries
        .slice(0, 5)
        .join(', ')}${criticalEnergyEntries.length > 5 ? '…' : ''} — exige Modo Escalonado Anti-Catarse`
    );
  }

  const riskTriggered = riskReasons.length > 0;
  const hasProsperity = includesProsperityFocus(anamnesis);

  const stage1Geometries: QuantumGeometry[] = [
    {
      name: 'Decágono Duplo',
      category: 'assepsia',
      role: 'Potencialização informacional pura do testemunho e limpeza de ruídos de frequência.',
      durationHint: '48h a 72h contínuas',
    },
    {
      name: 'SCAP Cabalístico',
      category: 'protecao',
      role: 'Neutralização imediata de radiações nocivas, miasmas e emissões eletromagnéticas densas.',
      durationHint: '48h a 72h contínuas',
    },
    {
      name: 'Yoshua',
      category: 'assepsia',
      role: 'Desimpregnação de formas-pensamento, cordões densos e harmonização do campo astral.',
      durationHint: '48h a 72h contínuas',
    },
    {
      name: 'Pirâmide de Tao / Escudo Mágico',
      category: 'protecao',
      role: 'Blindagem áurica de contenção suave para evitar crises de catarse e drenagem vital.',
      durationHint: '48h a 72h contínuas',
    },
  ];

  const blockedGeometries = [
    'Alta Vitalidade (bloqueado nesta fase para prevenir crise de cura)',
    'Programador Físico (bloqueado até elevação do campo > 6.500 Å)',
    "Mesa D'Amiens (aguarda conclusão da assepsia sutil)",
    'Turbilhão com Prosperador (adiado para Etapa 2 após blindagem)',
  ];

  const stage2Geometries: QuantumGeometry[] = [
    {
      name: 'Alta Vitalidade',
      category: 'regeneracao',
      role: 'Elevação sustentada do padrão vibratório em Ångströms e revitalização mitocondrial sutil.',
      durationHint: '7 a 10 dias',
    },
    {
      name: 'Programador Físico',
      category: 'regeneracao',
      role: 'Reorganização da matriz biológica e alinhamento dos sistemas orgânicos em alerta.',
      durationHint: '7 a 10 dias',
    },
    {
      name: "Mesa D'Amiens",
      category: 'harmonia',
      role: 'Irradiação em proporção áurea para estabilização endócrina, neural e celular.',
      durationHint: '7 a 10 dias',
    },
    {
      name: 'Harmonia',
      category: 'harmonia',
      role: 'Coerência entre os sete centros energéticos e pacificação do eixo emocional (Escala de Hawkins).',
      durationHint: '7 a 10 dias',
    },
  ];

  if (hasProsperity) {
    stage2Geometries.push({
      name: 'Turbilhão com Prosperador',
      category: 'prosperidade',
      role: 'Desbloqueio de fluxos de abundância, realização material e abertura de caminhos profissionais.',
      durationHint: '7 a 10 dias',
    });
  }

  if (riskTriggered) {
    return {
      mode: 'escalonado',
      riskTriggered: true,
      riskReasons,
      stage1: {
        title: 'Etapa 1 — Limpeza, Desimpregnação e Blindagem',
        durationLabel: '48h a 72h',
        minHours: 48,
        maxHours: 72,
        objective:
          'Drenar cargas densas sem sobrecarregar o sistema nervoso, restaurar a integridade da malha áurica e elevar o campo acima de 6.500 Å antes de qualquer estímulo regenerativo.',
        geometries: stage1Geometries,
        blockedGeometries,
      },
      restIntervalHours: 12,
      stage2: {
        title: 'Etapa 2 — Regeneração Orgânica e Alta Vitalidade',
        durationLabel: '7 a 10 dias',
        totalDays: 10,
        objective:
          'Consolidar a homeostase biológica, reprogramar os sistemas orgânicos sensibilizados e ancorar vitalidade sustentada em ressonância harmônica.',
        geometries: stage2Geometries,
      },
      singleStage: null,
    };
  }

  // Campo estável -> Etapa Única direta
  const singleGeometries: QuantumGeometry[] = [
    {
      name: 'Decágono Duplo',
      category: 'assepsia',
      role: 'Sintonização e amplificação do testemunho informacional do paciente.',
      durationHint: '7 dias',
    },
    ...stage2Geometries,
  ];

  return {
    mode: 'direto',
    riskTriggered: false,
    riskReasons: [],
    stage1: null,
    restIntervalHours: 0,
    stage2: null,
    singleStage: {
      title: 'Etapa Única — Harmonização Direta e Alta Vitalidade',
      durationLabel: '7 a 10 dias',
      totalDays: 10,
      objective:
        'Campo bioenergético estável (≥ 6.500 Å e livre de interferências densas). Autorizado protocolo direto de harmonização, vitalização e expansão.',
      geometries: singleGeometries,
    },
  };
}
