import { AntiCatharsisProtocol, ChartDurationUnit, QuantumGeometry } from '../types/quantum';
import { RADIONIC_GRAPHICS_CATALOG } from './graphicsCatalog';

export interface TherapeuticKitChartSpec {
  name: string;
  category: QuantumGeometry['category'];
  role: string;
  durationHint: string;
  defaultDurationValue: number;
  defaultDurationUnit: ChartDurationUnit;
  customFocus?: string;
}

export interface TherapeuticKit {
  id: string;
  number?: number;
  name: string;
  focus: string;
  description: string;
  charts: TherapeuticKitChartSpec[];
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function resolveFromCatalog(
  displayName: string,
  catalogLookupName: string,
  fallbackCategory: QuantumGeometry['category'],
  fallbackRole: string,
  durationHint: string,
  defaultDurationValue: number,
  defaultDurationUnit: ChartDurationUnit
): TherapeuticKitChartSpec {
  const normalized = catalogLookupName.trim().toLowerCase();
  const match = RADIONIC_GRAPHICS_CATALOG.find(
    (item) =>
      item.id === normalized ||
      item.name.toLowerCase() === normalized ||
      item.name.toLowerCase().includes(normalized)
  );

  return {
    name: displayName,
    category: fallbackCategory,
    role: match?.purpose || fallbackRole,
    durationHint,
    defaultDurationValue,
    defaultDurationUnit,
  };
}

export const BUILTIN_THERAPEUTIC_KITS: TherapeuticKit[] = [
  {
    id: 'kit-limpeza-profunda',
    number: 1,
    name: 'Kit 1 — Limpeza Profunda & Desimpregnação',
    focus: 'Assepsia áurica, corte de miasmas e proteção eletromagnética.',
    description:
      'Protocolo de higiene energética imediata para desimpregnar resíduos astrais, neutralizar cargas telúricas/eletromagnéticas e estabilizar o testemunho.',
    charts: [
      resolveFromCatalog(
        'Decágono Duplo',
        'Decágono Duplo',
        'assepsia',
        'Potencialização informacional pura do testemunho e eliminação de ruídos de frequência.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Desimpregnador',
        'Desimpregnador',
        'assepsia',
        'Remoção de miasmas, impregnações astrais, cargas emocionais densas e resíduos sutis.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'SCAP Cabalístico',
        'SCAP Cabalístico',
        'protecao',
        'Neutralização integral de radiações nocivas, miasmas e interferências eletromagnéticas densas.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Yoshua',
        'Iavé (Ioshua / Yoshua)',
        'assepsia',
        'Desimpregnação espiritual profunda, neutralização de formas-pensamento e limpeza astral.',
        '48h a 72h',
        72,
        'horas'
      ),
    ],
  },
  {
    id: 'kit-defesa-espiritual',
    number: 2,
    name: 'Kit 2 — Defesa Espiritual & Corte de Parasitismos',
    focus: 'Desativação de chips, implantes, formas-pensamento e blindagem.',
    description:
      'Conjunto de alta contenção espiritual para neutralizar ataques psíquicos, vínculos obsessivos, dispositivos sutis e blindar a malha áurica.',
    charts: [
      resolveFromCatalog(
        'Decágono Duplo',
        'Decágono Duplo',
        'assepsia',
        'Potencialização informacional pura do testemunho e eliminação de ruídos de frequência.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Anti-Magia',
        'Anti-Magia (Selo de Salomão)',
        'protecao',
        'Anulação de ataques psíquicos, projeções densas, demandas espirituais e energias intrusas.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Iavê',
        'Iavé (Ioshua / Yoshua)',
        'assepsia',
        'Desativação de formas-pensamento, chips, implantes sutis e limpeza do corpo astral.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Nove Círculos',
        'Nove Círculos',
        'protecao',
        'Barreira concêntrica contra assédios sutis, vampirismo energético e instabilidades externas.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Quadrado Mágico',
        'Quadrado Mágico',
        'protecao',
        'Ancoramento de proteção estrutural, dissipação de negatividade e estabilidade no plano físico.',
        '7 dias',
        7,
        'dias'
      ),
    ],
  },
  {
    id: 'kit-vitalidade-fisica',
    number: 3,
    name: 'Kit 3 — Vitalidade Física & Regeneração Orgânica',
    focus: 'Elevação de Bovis, recuperação celular e equilíbrio dos sistemas ANSAE.',
    description:
      'Emissão estruturada para recomposição bioenergética em Ångströms, reorganização celular e fortalecimento dos órgãos e glândulas em alerta.',
    charts: [
      resolveFromCatalog(
        'Decágono Duplo',
        'Decágono Duplo',
        'assepsia',
        'Sintonização e amplificação informacional do testemunho para sustentação regenerativa.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Alta Vitalidade',
        'Alta Vitalidade',
        'regeneracao',
        'Elevação sustentada do padrão vibratório em Ångströms e revitalização mitocondrial sutil.',
        '7 a 10 dias',
        7,
        'dias'
      ),
      resolveFromCatalog(
        'Programador Físico',
        'Programador Físico',
        'regeneracao',
        'Reorganização da matriz biológica e regeneração de tecidos, órgãos e glândulas ANSAE.',
        '7 a 10 dias',
        10,
        'dias'
      ),
      resolveFromCatalog(
        'Diafragma 1',
        'Diafragma 1',
        'regeneracao',
        'Corte de processos negativos instalados no corpo físico e restauração da circulação sutil.',
        '48h a 72h',
        72,
        'horas'
      ),
    ],
  },
  {
    id: 'kit-equilibrio-emocional',
    number: 4,
    name: 'Kit 4 — Equilíbrio Emocional, Sono & Ansiedade',
    focus: 'Descompressão neural, paz interior e restauração do sono.',
    description:
      'Harmonização suave do sistema nervoso autônomo e eixo emocional, dissolvendo ruminação mental e favorecendo repouso reparador.',
    charts: [
      resolveFromCatalog(
        'Decágono Duplo',
        'Decágono Duplo',
        'assepsia',
        'Sintonização pura e limpeza de interferências no testemunho emocional do consulente.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Harmonia',
        'Harmonia',
        'harmonia',
        'Coerência entre os sete chakras, pacificação emocional e serenidade na Escala de Hawkins.',
        '7 a 10 dias',
        7,
        'dias'
      ),
      resolveFromCatalog(
        'Yoshua',
        'Iavé (Ioshua / Yoshua)',
        'assepsia',
        'Desimpregnação de formas-pensamento ansiosas e pacificação do campo psíquico.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Energizador',
        'Energizador',
        'regeneracao',
        'Recarga prânica suave, vitalização neuroemocional e restauração da qualidade do sono.',
        '7 dias',
        7,
        'dias'
      ),
    ],
  },
  {
    id: 'kit-prosperidade-material',
    number: 5,
    name: 'Kit 5 — Prosperidade & Desembaraço Material',
    focus: 'Destravamento financeiro, negócios e abertura de caminhos.',
    description:
      'Sequência de desbloqueio e aceleração de fluxos materiais, removendo entraves em contratos, carreira, finanças e realização profissional.',
    charts: [
      resolveFromCatalog(
        'Decágono Duplo',
        'Decágono Duplo',
        'assepsia',
        'Potencialização pura do testemunho e intenção de prosperidade no campo de ponto zero.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Desembaraçador Material',
        'Desembaraçador Material',
        'prosperidade',
        'Desbloqueio de entraves financeiros, processos estagnados e fluidez nos negócios.',
        '7 a 10 dias',
        10,
        'dias'
      ),
      resolveFromCatalog(
        'Turbilhão com Prosperador',
        'Turbilhão com Prosperador',
        'prosperidade',
        'Movimentação acelerada de oportunidades, abundância material e êxito profissional.',
        '7 a 10 dias',
        10,
        'dias'
      ),
      resolveFromCatalog(
        'Espiral Cósmica',
        'Espiral Cósmica',
        'prosperidade',
        'Movimento evolutivo contínuo para destravar situações estagnadas e impulsionar metas.',
        '7 dias',
        7,
        'dias'
      ),
    ],
  },
  {
    id: 'kit-harmonizacao-afetiva',
    number: 6,
    name: 'Kit 6 — Harmonização Afetiva & Relacionamentos',
    focus: 'Limpeza de mágoas e equilíbrio de vínculos.',
    description:
      'Atuação direcionada ao chakra cardíaco e vínculos familiares ou afetivos, dissipando ressentimentos e restaurando o diálogo harmônico.',
    charts: [
      resolveFromCatalog(
        'Decágono Duplo',
        'Decágono Duplo',
        'assepsia',
        'Sintonização limpa do testemunho e pacificação da intenção afetiva.',
        '48h a 72h',
        72,
        'horas'
      ),
      resolveFromCatalog(
        'Desembaraçador de Relacionamentos',
        'Desembaraçador de Relacionamentos',
        'harmonia',
        'Desobstrução de conflitos familiares ou afetivos e abertura para o diálogo pacífico.',
        '7 a 10 dias',
        7,
        'dias'
      ),
      resolveFromCatalog(
        'HRIM',
        'HRIM',
        'harmonia',
        'Unidade entre polos afetivos, pacificação do coração e integração harmônica nos vínculos.',
        '7 a 10 dias',
        7,
        'dias'
      ),
      resolveFromCatalog(
        'Harmonia',
        'Harmonia',
        'harmonia',
        'Coerência emocional, concórdia nos laços e elevação vibracional no convívio.',
        '7 a 10 dias',
        7,
        'dias'
      ),
    ],
  },
];

export function kitChartSpecToGeometry(spec: TherapeuticKitChartSpec): QuantumGeometry {
  return {
    id: `kit-geo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: spec.name,
    category: spec.category,
    role: spec.role,
    durationHint: spec.durationHint,
    source: 'therapist',
    ...(spec.customFocus ? { customFocus: spec.customFocus } : {}),
  };
}

function parseDurationFromGeometry(geo: QuantumGeometry): {
  value: number;
  unit: ChartDurationUnit;
} {
  if (geo.durationValue && geo.durationUnit) {
    return { value: geo.durationValue, unit: geo.durationUnit };
  }
  const hint = (geo.durationHint || '').toLowerCase();
  const dayMatch = hint.match(/(\d+)\s*dias?/);
  if (dayMatch) {
    return { value: Number(dayMatch[1]) || 7, unit: 'dias' };
  }
  const hourMatch = hint.match(/(\d+)\s*h/);
  if (hourMatch) {
    return { value: Number(hourMatch[1]) || 72, unit: 'horas' };
  }
  const minMatch = hint.match(/(\d+)\s*min/);
  if (minMatch) {
    return { value: Number(minMatch[1]) || 30, unit: 'minutos' };
  }
  return geo.category === 'assepsia' || geo.category === 'protecao'
    ? { value: 72, unit: 'horas' }
    : { value: 7, unit: 'dias' };
}

export function buildKitFromCurrentProtocol(
  name: string,
  focus: string,
  protocol: AntiCatharsisProtocol
): TherapeuticKit {
  const allGeometries: QuantumGeometry[] = [
    ...(protocol.stage1?.geometries || []),
    ...(protocol.stage2?.geometries || []),
    ...(protocol.singleStage?.geometries || []),
  ];

  const uniqueMap = new Map<string, QuantumGeometry>();
  for (const g of allGeometries) {
    const key = g.name.trim().toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, g);
    }
  }

  const charts: TherapeuticKitChartSpec[] = Array.from(uniqueMap.values()).map((g) => {
    const parsed = parseDurationFromGeometry(g);
    return {
      name: g.name,
      category: g.category,
      role: g.role,
      durationHint: g.durationHint || `${parsed.value} ${parsed.unit}`,
      defaultDurationValue: parsed.value,
      defaultDurationUnit: parsed.unit,
      ...(g.customFocus ? { customFocus: g.customFocus } : {}),
    };
  });

  const nowIso = new Date().toISOString();
  return {
    id: `custom-kit-${Date.now()}`,
    name: name.trim(),
    focus: focus.trim() || 'Protocolo personalizado salvo pelo terapeuta.',
    description: `${charts.length} placa(s) radiônica(s) configurada(s) a partir da Mesa Quântica.`,
    charts,
    isCustom: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
