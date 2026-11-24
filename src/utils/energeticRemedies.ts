import { BACH_38_ESSENCES } from '../data/biometrosData';
import { ClinicalAnsaeRhenSheet } from '../types/clinical';
import {
  EnergeticRemedyCategory,
  EnergeticRemedyEmission,
  EnergeticRemedyEmitterGraph,
  PatientAnamnesis,
} from '../types/quantum';
import {
  formatInteragentBirthOrAge,
  formatInteragentDisplayLabel,
} from './antiCatharsis';

export const ENERGETIC_REMEDY_CATEGORIES: EnergeticRemedyCategory[] = [
  'Florais de Bach',
  'Fitoterapia & Chás',
  'Suplementos / Oligoelementos',
  'Frequências & Cromoterapia',
  'Medicação Informacional / Homeopatia',
  'Personalizado',
];

export const EMITTER_GRAPH_OPTIONS: Array<{
  id: EnergeticRemedyEmitterGraph;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'Decágono Duplo',
    label: 'Decágono Duplo',
    subtitle: 'Materialização e criação do testemunho vibracional do remédio',
  },
  {
    id: 'SCAP Cabalístico',
    label: 'SCAP Cabalístico',
    subtitle: 'Transmissão compensada e blindada à distância sem catarse',
  },
  {
    id: 'Decágono Duplo + SCAP',
    label: 'Decágono Duplo + SCAP',
    subtitle: 'Potencialização máxima: criação pura + emissão protegida',
  },
];

export const REMEDY_DURATION_PRESETS: Array<{
  id: string;
  label: string;
  durationHours: number;
  dosageInstruction: string;
}> = [
  {
    id: '20min',
    label: '20 min (Potencialização)',
    durationHours: 0.33,
    dosageInstruction: 'Potencialização informacional rápida de 20 minutos em campo focal',
  },
  {
    id: '72h',
    label: '72 horas (3 dias)',
    durationHours: 72,
    dosageInstruction: 'Emissão contínua 24h durante 3 dias (72 horas) via campo quântico',
  },
  {
    id: '7d',
    label: '7 dias contínuos',
    durationHours: 168,
    dosageInstruction: 'Emissão contínua 24h por 7 dias consecutivos (168 horas)',
  },
  {
    id: '10d',
    label: '10 dias contínuos',
    durationHours: 240,
    dosageInstruction: 'Emissão contínua 24h por 10 dias consecutivos (240 horas)',
  },
];

export const REMEDY_CATALOG_BY_CATEGORY: Record<EnergeticRemedyCategory, string[]> = {
  'Florais de Bach': [
    'Rescue Remedy',
    'Rock Water',
    'Crab Apple',
    'Olive',
    'Walnut',
    'White Chestnut',
    'Mimulus',
    'Star of Bethlehem',
    ...BACH_38_ESSENCES.filter(
      (b) =>
        ![
          'Rock Water',
          'Crab Apple',
          'Olive',
          'Walnut',
          'White Chestnut',
          'Mimulus',
          'Star of Bethlehem',
        ].includes(b)
    ),
  ],
  'Fitoterapia & Chás': [
    'Espinheira-Santa',
    'Melissa (Erva-Cidreira)',
    'Camomila',
    'Alecrim',
    'Passiflora (Maracujá)',
    'Mulungu',
    'Cúrcuma com Gengibre',
    'Hortelã-Pimenta',
    'Valeriana',
    'Cardo-Mariano',
    'Dente-de-Leão',
    'Equinácea',
  ],
  'Suplementos / Oligoelementos': [
    'Magnésio Dimalato',
    'Zinco Quelato',
    'Selênio',
    'Vitamina D3 + K2',
    'Complexo B Metilado',
    'Ômega-3 (EPA / DHA)',
    'Coenzima Q10',
    'Lítio Oligoelemento',
    'Cobre-Ouro-Prata (Oligosol)',
    'Manganês-Cobalto (Oligosol)',
    'L-Teanina',
    'N-Acetilcisteína (NAC)',
  ],
  'Frequências & Cromoterapia': [
    'Luz Verde Esmeralda (Regeneração Celular)',
    'Luz Violeta (Transmutação & Coroa)',
    'Luz Dourada (Vitalidade & Plexo Solar)',
    'Luz Azul Índigo (Calma Neural & Frontal)',
    'Luz Rosa (Pacificação Cardíaca)',
    'Solfeggio 432 Hz (Coerência Natural)',
    'Solfeggio 528 Hz (Reparação & DNA)',
    'Solfeggio 741 Hz (Assepsia Sutil)',
    'Ressonância Schumann 7,83 Hz',
  ],
  'Medicação Informacional / Homeopatia': [
    'Arnica Montana 30CH',
    'Ignatia Amara 30CH',
    'Nux Vomica 30CH',
    'Gelsemium Sempervirens 30CH',
    'Arsenicum Album 30CH',
    'Kali Phosphoricum (Sal de Schüssler #5)',
    'Magnesia Phosphorica (Sal de Schüssler #7)',
    'Calcarea Phosphorica (Sal de Schüssler #2)',
    'Natrum Muriaticum (Sal de Schüssler #8)',
    'Silicea (Sal de Schüssler #11)',
    'Ferrum Phosphoricum (Sal de Schüssler #3)',
  ],
  Personalizado: [
    'Fórmula Composta Personalizada',
    'Frequência Informacional de Melatonina',
    'Frequência Informacional de Serotonina',
    'Água Solarizada Polarizada',
  ],
};

export function formatRemedyDurationLabel(durationHours: number): string {
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return 'Emissão contínua';
  }
  if (durationHours < 1) {
    const mins = Math.max(5, Math.round(durationHours * 60));
    return `${mins} min`;
  }
  if (durationHours % 24 === 0 && durationHours >= 48) {
    const days = durationHours / 24;
    return `${durationHours}h (${days} dias)`;
  }
  return `${durationHours} horas`;
}

export function buildEnergeticRemedyTestimony(params: {
  items: string[];
  emitterGraph: EnergeticRemedyEmitterGraph;
  anamnesis: PatientAnamnesis;
}): string {
  const formulaLabel = params.items.join(' + ') || 'Fórmula Informacional';
  const nome = formatInteragentDisplayLabel(params.anamnesis);
  const nasc = formatInteragentBirthOrAge(params.anamnesis);
  return `${formulaLabel} → Direcionado para ${nome} - ${nasc} | Emissor: ${params.emitterGraph}`;
}

export function buildEnergeticRemedyCommand(params: {
  category: EnergeticRemedyCategory;
  items: string[];
  emitterGraph: EnergeticRemedyEmitterGraph;
  durationHours: number;
  dosageInstruction: string;
  anamnesis: PatientAnamnesis;
  ansaeSheet?: ClinicalAnsaeRhenSheet;
}): string {
  const nome = formatInteragentDisplayLabel(params.anamnesis);
  const formulaLabel = params.items.join(', ') || 'fórmula vibracional selecionada';
  const durationLabel = formatRemedyDurationLabel(params.durationHours);

  const imbalancedChakras = (params.ansaeSheet?.chakras || [])
    .filter((c) => c.status !== 'Normal')
    .map((c) => c.name)
    .slice(0, 3);

  const alertOrgans = (params.ansaeSheet?.organs || [])
    .filter(
      (o) =>
        o.isImbalanced ||
        (typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500)
    )
    .map((o) => o.organName)
    .slice(0, 3);

  const targetClause =
    alertOrgans.length > 0 || imbalancedChakras.length > 0
      ? `, alcançando diretamente ${[
          alertOrgans.length > 0 ? `os órgãos e sistemas (${alertOrgans.join(', ')})` : '',
          imbalancedChakras.length > 0
            ? `os centros energéticos (${imbalancedChakras.join(', ')})`
            : '',
        ]
          .filter(Boolean)
          .join(' e ')}`
      : ' e todos os seus sistemas orgânicos, células e chakras que necessitam de restauração';

  const geometryInvocation =
    params.emitterGraph === 'Decágono Duplo'
      ? 'invoco a geometria sagrada do Decágono Duplo para materializar e desimpregnar a matriz informacional pura'
      : params.emitterGraph === 'SCAP Cabalístico'
      ? 'invoco o gráfico emissor SCAP Cabalístico para transmitir em compensação harmônica e blindada à distância a assinatura informacional pura'
      : 'invoco em sinergia a geometria sagrada do Decágono Duplo e do SCAP Cabalístico para materializar, potencializar e blindar a matriz informacional pura';

  const dosageClause = params.dosageInstruction.trim()
    ? ` sob o regime de ${params.dosageInstruction.trim()} (${durationLabel})`
    : ` pelo período programado de ${durationLabel}`;

  return `Eu ${geometryInvocation} de ${formulaLabel} (${params.category}), transmitindo sua frequência vibracional exata por entrelaçamento quântico no Campo de Ponto Zero diretamente às células, mitocôndrias e corpos sutis de ${nome}${targetClause}${dosageClause}, de forma suave, segura e completamente livre de efeitos colaterais materiais. Está materializado, transmitido, selado e ativo na ordem cósmica.`;
}

export function formatEnergeticRemediesForPatient(
  remedies: EnergeticRemedyEmission[] | undefined
): string[] {
  const list = (remedies || []).filter((r) => r.isActive);
  if (list.length === 0) return [];
  return list.map(
    (r) =>
      `${r.items.join(' + ')} (${r.category} · Emissão via ${r.emitterGraph} por ${formatRemedyDurationLabel(
        r.durationHours
      )} — ${r.dosageInstruction})`
  );
}
