import {
  AntiCatharsisProtocol,
  ChakraReading,
  OrganicSystemStatus,
  PatientAnamnesis,
  QuantumGeometry,
  SensitivityReading,
} from '../types/quantum';

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
  label: string;
  emotion: string;
  zone: 'Contração' | 'Neutralidade' | 'Expansão';
} {
  if (score < 30) return { label: 'Vergonha', emotion: 'Humilhação e retração profunda', zone: 'Contração' };
  if (score < 50) return { label: 'Culpa', emotion: 'Autopunição e remorso', zone: 'Contração' };
  if (score < 75) return { label: 'Apatia', emotion: 'Desesperança e paralisia', zone: 'Contração' };
  if (score < 100) return { label: 'Tristeza', emotion: 'Luto e perda energética', zone: 'Contração' };
  if (score < 125) return { label: 'Medo', emotion: 'Ansiedade e hipervigilância', zone: 'Contração' };
  if (score < 150) return { label: 'Desejo', emotion: 'Carência e compulsão', zone: 'Contração' };
  if (score < 175) return { label: 'Raiva', emotion: 'Irritação e conflito inflamatório', zone: 'Contração' };
  if (score < 200) return { label: 'Orgulho', emotion: 'Rigidez defensiva', zone: 'Contração' };
  if (score < 250) return { label: 'Coragem', emotion: 'Limiar da integridade e empoderamento', zone: 'Neutralidade' };
  if (score < 310) return { label: 'Neutralidade', emotion: 'Desapego e flexibilidade clínica', zone: 'Neutralidade' };
  if (score < 350) return { label: 'Disposição', emotion: 'Abertura e otimismo regenerativo', zone: 'Neutralidade' };
  if (score < 400) return { label: 'Aceitação', emotion: 'Transcendência e responsabilidade serena', zone: 'Expansão' };
  if (score < 500) return { label: 'Razão', emotion: 'Clareza mental e coerência científica', zone: 'Expansão' };
  if (score < 540) return { label: 'Amor', emotion: 'Compaixão incondicional e cura profunda', zone: 'Expansão' };
  if (score < 600) return { label: 'Alegria', emotion: 'Serenidade luminosa e sincronicidade', zone: 'Expansão' };
  return { label: 'Paz', emotion: 'Silêncio pleno e não-dualidade', zone: 'Expansão' };
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

export function formatTestemunho(
  anamnesis: PatientAnamnesis,
  customFocus?: string
): string {
  const nome = anamnesis.fullName.trim() || 'Paciente';
  const nasc = formatBirthDateBR(anamnesis.birthDate) || 'Data não informada';
  const foco = (customFocus || anamnesis.therapeuticFocus || 'Equilíbrio Vibracional Integral').trim();
  return `${nome} - ${nasc} | ${foco}`;
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

export function evaluateAntiCatharsis(
  anamnesis: PatientAnamnesis,
  sensitivity: SensitivityReading
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
      `Sobrecarga / Estresse do Sistema Nervoso em nível ${sensitivity.stressLevel}/5 (≥ 4 exige descompressão gradual)`
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
