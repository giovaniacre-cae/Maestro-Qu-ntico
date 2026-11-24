import { saveAs } from 'file-saver';
import {
  AnsaeChakraReading,
  AnsaeOrganReading,
  AnsaeSystemCode,
  AnsaeSystemReading,
  BiometerDefinition,
  ClinicalAnsaeRhenSheet,
  ClinicalSessionRecord,
  ElectromagneticFieldReading,
  MasterClinicalDatabase,
  MasterPatient,
  getAuraSizeLabelFromPercent,
  getHawkinsLabelByHz,
  normalizeAuricColorName,
} from '../types/clinical';
import type { PrintableGraphic } from '../data/printableGraphicsData';
import type { TherapeuticKit } from '../data/therapeuticKits';
import { QuantumRoomSession } from '../types/quantum';
import { loadSessions, saveSessions } from '../data/seedSessions';

const CLINICAL_DB_KEY = 'maestro_quantico_clinical_db_v2';
const CUSTOM_BIOMETERS_KEY = 'maestro_quantico_custom_biometers_v2';
export const FOLLOW_UP_LOGS_STORAGE_KEY = 'maestro_quantico_follow_up_logs_v1';

export type FollowUpCategory =
  | 'sonho'
  | 'catarse_sintoma'
  | 'evolucao_emocional'
  | 'retorno_geral';

export interface FollowUpLogEntry {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  category: FollowUpCategory;
  narrative: string;
  activeGraphicsSnapshot: string[];
  therapistAnalysis: string;
  patientFeedbackMessage: string;
}

export const ANSAE_SYSTEMS_META: Record<AnsaeSystemCode, string> = {
  SC: 'Sistema Cardiovascular',
  SD: 'Sistema Digestório',
  SEnd: 'Sistema Endócrino',
  SExc: 'Sistema Excretor',
  SI: 'Sistema Imunológico',
  SL: 'Sistema Linfático',
  SNC: 'Sistema Nervoso Central',
  SNP: 'Sistema Nervoso Periférico',
  SRep: 'Sistema Reprodutor',
  SResp: 'Sistema Respiratório',
  SS: 'Sistema Sensorial',
  SU: 'Sistema Urinário',
  SEsq: 'Sistema Esquelético',
  SM: 'Sistema Muscular',
  ST: 'Sistema Tegumentar',
};

export const ANSAE_38_ORGANS_CATALOG: Array<{
  id: string;
  systemCode: AnsaeSystemCode;
  organName: string;
}> = [
  // SC (2)
  { id: 'org-coracao', systemCode: 'SC', organName: 'Coração' },
  { id: 'org-vasos', systemCode: 'SC', organName: 'Vasos Sanguíneos & Microcirculação' },
  // SD (5)
  { id: 'org-estomago', systemCode: 'SD', organName: 'Estômago' },
  { id: 'org-figado', systemCode: 'SD', organName: 'Fígado' },
  { id: 'org-vesicula', systemCode: 'SD', organName: 'Vesícula Biliar' },
  { id: 'org-int-delgado', systemCode: 'SD', organName: 'Intestino Delgado' },
  { id: 'org-int-grosso', systemCode: 'SD', organName: 'Intestino Grosso' },
  // SEnd (7)
  { id: 'org-pineal', systemCode: 'SEnd', organName: 'Glândula Pineal' },
  { id: 'org-hipofise', systemCode: 'SEnd', organName: 'Hipófise (Pituitária)' },
  { id: 'org-tireoide', systemCode: 'SEnd', organName: 'Tireoide' },
  { id: 'org-paratireoides', systemCode: 'SEnd', organName: 'Paratireoides' },
  { id: 'org-timo', systemCode: 'SEnd', organName: 'Timo' },
  { id: 'org-pancreas', systemCode: 'SEnd', organName: 'Pâncreas Endócrino' },
  { id: 'org-suprarrenais', systemCode: 'SEnd', organName: 'Glândulas Suprarrenais' },
  // SExc (2)
  { id: 'org-sudoriparas', systemCode: 'SExc', organName: 'Glândulas Sudoríparas' },
  { id: 'org-reto', systemCode: 'SExc', organName: 'Reto & Excreção Intestinal' },
  // SI (2)
  { id: 'org-medula-ossea', systemCode: 'SI', organName: 'Medula Óssea' },
  { id: 'org-baco', systemCode: 'SI', organName: 'Baço' },
  // SL (3)
  { id: 'org-linfonodos', systemCode: 'SL', organName: 'Linfonodos' },
  { id: 'org-vasos-linf', systemCode: 'SL', organName: 'Vasos Linfáticos' },
  { id: 'org-tonsilas', systemCode: 'SL', organName: 'Tonsilas (Amígdalas)' },
  // SNC (3)
  { id: 'org-cerebro', systemCode: 'SNC', organName: 'Cérebro (Córtex & Límbico)' },
  { id: 'org-cerebelo', systemCode: 'SNC', organName: 'Cerebelo' },
  { id: 'org-medula-esp', systemCode: 'SNC', organName: 'Medula Espinhal' },
  // SNP (2)
  { id: 'org-cranianos', systemCode: 'SNP', organName: 'Nervos Cranianos' },
  { id: 'org-vago', systemCode: 'SNP', organName: 'Sistema Autônomo / Nervo Vago' },
  // SRep (2)
  { id: 'org-gonadas', systemCode: 'SRep', organName: 'Gônadas (Ovários / Testículos)' },
  { id: 'org-utero-prostata', systemCode: 'SRep', organName: 'Útero / Próstata' },
  // SResp (3)
  { id: 'org-pulmoes', systemCode: 'SResp', organName: 'Pulmões' },
  { id: 'org-bronquios', systemCode: 'SResp', organName: 'Brônquios' },
  { id: 'org-traqueia', systemCode: 'SResp', organName: 'Laringe & Traqueia' },
  // SS (2)
  { id: 'org-olhos', systemCode: 'SS', organName: 'Olhos (Visão)' },
  { id: 'org-ouvidos', systemCode: 'SS', organName: 'Ouvidos (Audição & Labirinto)' },
  // SU (2)
  { id: 'org-rins', systemCode: 'SU', organName: 'Rins' },
  { id: 'org-bexiga', systemCode: 'SU', organName: 'Bexiga & Ureteres' },
  // SEsq (1)
  { id: 'org-esqueleto', systemCode: 'SEsq', organName: 'Coluna Vertebral & Articulações' },
  // SM (1)
  { id: 'org-musculos', systemCode: 'SM', organName: 'Fibras Musculares & Fáscias' },
  // ST (1)
  { id: 'org-pele', systemCode: 'ST', organName: 'Pele & Anexos Cutâneos' },
];

export const ANSAE_SYSTEM_PSYCHOSOMATIC: Record<AnsaeSystemCode, string> = {
  SC: 'Alegria de viver, circulação do amor e ritmo afetivo-vital',
  SD: 'Assimilação de experiências, digestão emocional e aceitação do novo',
  SEnd: 'Regulação do ritmo interno, propósito e equilíbrio dos centros sutis',
  SExc: 'Capacidade de desapego, liberação de mágoas e limpeza interna',
  SI: 'Fronteiras psíquicas, autodefesa emocional e proteção da identidade',
  SL: 'Fluidez emocional, drenagem de ressentimentos e renovação sutil',
  SNC: 'Controle mental, clareza decisória e percepção consciente da realidade',
  SNP: 'Conexão mente-corpo, resposta ao estresse e flexibilidade adaptativa',
  SRep: 'Criatividade, prazer vital, continuidade e vínculo afetivo-criador',
  SResp: 'Troca com a vida, liberdade interior e inspiração existencial',
  SS: 'Abertura perceptiva, discernimento e modo de enxergar ou ouvir o mundo',
  SU: 'Segurança existencial, manejo de medos profundos e filtragem emocional',
  SEsq: 'Sustentação estrutural, amparo familiar e flexibilidade diante da vida',
  SM: 'Força de ação, movimento resolutivo e sustentação do esforço diário',
  ST: 'Contato, limite saudável entre o eu e o mundo, e sensibilidade afetiva',
};

export const ANSAE_ORGAN_PSYCHOSOMATIC: Record<string, string> = {
  'org-coracao': 'Centro do amor, coerência afetiva e alegria de existir',
  'org-vasos': 'Fluidez na entrega emocional e circulação da vitalidade',
  'org-estomago': 'Capacidade de digerir situações difíceis e contrariedades',
  'org-figado': 'Raiva contida, frustração, planejamento e transmutação emocional',
  'org-vesicula': 'Amargura reprimida, decisão firme e coragem de agir',
  'org-int-delgado': 'Discernimento e absorção nutritiva das vivências',
  'org-int-grosso': 'Apego ao passado, controle excessivo e dificuldade de soltar',
  'org-pineal': 'Conexão espiritual, ciclo sono-vigília e intuição superior',
  'org-hipofise': 'Comando integrativo entre propósito mental e resposta física',
  'org-tireoide': 'Expressão da verdade pessoal e ritmo de realização ("tempo")',
  'org-paratireoides': 'Sustentação mineral da calma e equilíbrio da pressa interior',
  'org-timo': 'Imunidade afetiva, autoestima e vínculo com a alegria do coração',
  'org-pancreas': 'Doçura da vida, prazer genuíno e acolhimento das emoções',
  'org-suprarrenais': 'Medo, estado de alerta crônico, sobrevivência e reserva vital',
  'org-sudoriparas': 'Liberação de tensões acumuladas e termorregulação emocional',
  'org-reto': 'Desfecho saudável de ciclos e desprendimento de velhas dores',
  'org-medula-ossea': 'Vitalidade ancestral profunda e renovação da força de viver',
  'org-baco': 'Excesso de preocupação mental, ruminação e defesa energética',
  'org-linfonodos': 'Retenção de emoções não expressas e necessidade de proteção',
  'org-vasos-linf': 'Escoamento sutil de sobrecargas afetivas e limpeza orgânica',
  'org-tonsilas': 'Engolir sapos, conflito entre o que se sente e o que se cala',
  'org-cerebro': 'Excesso de controle racional, hipervigilância e carga cognitiva',
  'org-cerebelo': 'Equilíbrio, coordenação de rumos e estabilidade emocional',
  'org-medula-esp': 'Eixo de transmissão entre intenção espiritual e ação corporal',
  'org-cranianos': 'Percepção sensorial refinada e comunicação neural direta',
  'org-vago': 'Autorregulação parassimpática, calma visceral e segurança interna',
  'org-gonadas': 'Força criadora, vitalidade sexual e expressão da identidade',
  'org-utero-prostata': 'Ninho afetivo, criatividade, proteção e realização familiar',
  'org-pulmoes': 'Tristeza profunda, luto não elaborado e direito de respirar livremente',
  'org-bronquios': 'Conflitos territoriais e sufocamento por pressões externas',
  'org-traqueia': 'Expressão livre, passagem da voz e autenticidade emocional',
  'org-olhos': 'Medo de enxergar certas verdades ou sobrecarga visual/mental',
  'org-ouvidos': 'Resistência em ouvir críticas, conflitos ou busca de silêncio',
  'org-rins': 'Medo existencial, insegurança profunda e memória ancestral',
  'org-bexiga': 'Pressão por limites territoriais e irritação contida',
  'org-esqueleto': 'Sobrecarga de responsabilidades, apoio emocional e retidão',
  'org-musculos': 'Tensão para agir, prontidão excessiva e cansaço de sustentar lutas',
  'org-pele': 'Medo de rejeição, exposição ou necessidade de escudo protetor',
};

export function getSystemPsychosomaticMeaning(code: AnsaeSystemCode): string {
  return ANSAE_SYSTEM_PSYCHOSOMATIC[code] || 'Equilíbrio sistêmico e vitalidade orgânica';
}

export function getOrganPsychosomaticMeaning(organId: string): string {
  return ANSAE_ORGAN_PSYCHOSOMATIC[organId] || 'Coerência funcional e integração psicossomática';
}

export function createDefaultAnsaeSystems(): AnsaeSystemReading[] {
  return (Object.keys(ANSAE_SYSTEMS_META) as AnsaeSystemCode[]).map((code) => ({
    systemCode: code,
    systemName: ANSAE_SYSTEMS_META[code],
    isImbalanced: false,
    imbalancePercent: 0,
    durationValue: 0,
    durationUnit: 'd',
  }));
}

export function normalizeAnsaeSheet(sheet: ClinicalAnsaeRhenSheet): ClinicalAnsaeRhenSheet {
  const existingSystems = Array.isArray(sheet.systems) ? sheet.systems : [];
  const systemCodes = Object.keys(ANSAE_SYSTEMS_META) as AnsaeSystemCode[];
  const normalizedSystems: AnsaeSystemReading[] = systemCodes.map((code) => {
    const found = existingSystems.find((s) => s.systemCode === code);
    if (found) {
      return {
        ...found,
        systemName: ANSAE_SYSTEMS_META[code],
      };
    }
    return {
      systemCode: code,
      systemName: ANSAE_SYSTEMS_META[code],
      isImbalanced: false,
      imbalancePercent: 0,
      durationValue: 0,
      durationUnit: 'd',
    };
  });

  const resolvedHawkinsHz =
    sheet.spiritualPsycho?.hawkinsAgathaHz ??
    sheet.spiritualPsycho?.hawkinsHz ??
    200;

  const rawSizePercent = sheet.auricField?.sizePercent ?? 50;
  const clampedSizePercent = Math.max(0, Math.min(100, rawSizePercent));
  const normalizeColorList = (list?: string[]) =>
    Array.from(
      new Set(
        (Array.isArray(list) ? list : [])
          .map((c) => normalizeAuricColorName(String(c)))
          .filter(Boolean)
      )
    );

  return {
    ...sheet,
    auricField: {
      ...sheet.auricField,
      sizePercent: clampedSizePercent,
      sizeLabel: getAuraSizeLabelFromPercent(clampedSizePercent),
      missingColors: normalizeColorList(sheet.auricField?.missingColors),
      excessColors: normalizeColorList(sheet.auricField?.excessColors),
    },
    spiritualPsycho: {
      ...sheet.spiritualPsycho,
      hawkinsAgathaHz: resolvedHawkinsHz,
      hawkinsHz: resolvedHawkinsHz,
      hawkinsLevel: getHawkinsLabelByHz(resolvedHawkinsHz),
      clientPerceptionScore:
        typeof sheet.spiritualPsycho?.clientPerceptionScore === 'number'
          ? Math.max(0, Math.min(10, Math.round(sheet.spiritualPsycho.clientPerceptionScore)))
          : undefined,
    },
    systems: normalizedSystems,
    organs: Array.isArray(sheet.organs) ? sheet.organs : [],
  };
}

export const DEFAULT_ELECTROMAGNETIC_FIELDS: ElectromagneticFieldReading[] = [
  { id: 'mental', label: 'Campo Mental', imbalancePercent: 15, affectedChakras: [] },
  { id: 'emocional', label: 'Campo Emocional', imbalancePercent: 20, affectedChakras: [] },
  { id: 'espiritual', label: 'Campo Espiritual', imbalancePercent: 10, affectedChakras: [] },
  { id: 'fisico', label: 'Campo Físico', imbalancePercent: 15, affectedChakras: [] },
];

export const DEFAULT_ANSAE_CHAKRAS: AnsaeChakraReading[] = [
  {
    id: 'coronario',
    name: 'Coronário',
    sanskrit: 'Sahasrara',
    gland: 'Pineal',
    status: 'Normal',
    imbalancePercent: 10,
    affectsPhysicalBody: false,
  },
  {
    id: 'frontal',
    name: 'Frontal',
    sanskrit: 'Ajna',
    gland: 'Hipófise',
    status: 'Normal',
    imbalancePercent: 15,
    affectsPhysicalBody: false,
  },
  {
    id: 'laringeo',
    name: 'Laríngeo',
    sanskrit: 'Vishuddha',
    gland: 'Tireoide',
    status: 'Normal',
    imbalancePercent: 15,
    affectsPhysicalBody: false,
  },
  {
    id: 'cardiaco',
    name: 'Cardíaco',
    sanskrit: 'Anahata',
    gland: 'Timo',
    status: 'Normal',
    imbalancePercent: 20,
    affectsPhysicalBody: false,
  },
  {
    id: 'plexo',
    name: 'Plexo Solar',
    sanskrit: 'Manipura',
    gland: 'Pâncreas',
    status: 'Hipo',
    imbalancePercent: 35,
    affectsPhysicalBody: true,
  },
  {
    id: 'sacro',
    name: 'Sacro / Umbilical',
    sanskrit: 'Svadhisthana',
    gland: 'Gônadas',
    status: 'Normal',
    imbalancePercent: 15,
    affectsPhysicalBody: false,
  },
  {
    id: 'basico',
    name: 'Básico / Raiz',
    sanskrit: 'Muladhara',
    gland: 'Suprarrenais',
    status: 'Normal',
    imbalancePercent: 20,
    affectsPhysicalBody: false,
  },
];

export function createDefaultAnsaeRhenSheet(
  fromRoom?: QuantumRoomSession
): ClinicalAnsaeRhenSheet {
  const bovis = fromRoom?.sensitivity.bovis ?? 6200;
  const hawkins = fromRoom?.sensitivity.hawkins ?? 200;
  const auraPct = fromRoom?.sensitivity.auricProtection ?? 55;
  const stress = fromRoom?.sensitivity.stressLevel ?? 3;

  const organs: AnsaeOrganReading[] = ANSAE_38_ORGANS_CATALOG.map((item) => ({
    id: item.id,
    systemCode: item.systemCode,
    systemName: ANSAE_SYSTEMS_META[item.systemCode],
    organName: item.organName,
    isImbalanced: false,
    imbalancePercent: 0,
    durationValue: 0,
    durationUnit: 'd',
  }));

  const rootProblems: ClinicalAnsaeRhenSheet['rootProblems'] = [];
  if (bovis < 6500) rootProblems.push('Emocional', 'Aura');
  if (stress >= 4) rootProblems.push('Mental');
  if ((fromRoom?.sensitivity.subtleInterferences ?? 0) > 0) rootProblems.push('Espiritual');
  if (
    fromRoom?.sensitivity.organicSystems.some((s) => s.status === 'Em Alerta')
  ) {
    rootProblems.push('Físico', 'Órgãos');
  }

  return {
    rootProblems: Array.from(new Set(rootProblems)),
    electromagneticFields: DEFAULT_ELECTROMAGNETIC_FIELDS.map((f) => ({ ...f })),
    chakras: DEFAULT_ANSAE_CHAKRAS.map((c) => {
      const legacy = fromRoom?.sensitivity.chakras.find(
        (lc) => lc.id === c.id || (c.id === 'sacro' && lc.id === 'umbilical')
      );
      if (!legacy) return { ...c };
      const status: AnsaeChakraReading['status'] =
        legacy.status === 'Bloqueado'
          ? 'Nulo'
          : legacy.status === 'Hipo-ativo'
          ? 'Hipo'
          : legacy.status === 'Hiper-ativo'
          ? 'Hiper'
          : 'Normal';
      return {
        ...c,
        status,
        imbalancePercent: Math.max(0, 100 - legacy.percentage),
        affectsPhysicalBody: legacy.percentage < 55,
      };
    }),
    auricField: (() => {
      const defaultSizePercent = auraPct < 45 ? 30 : auraPct > 75 ? 85 : 55;
      return {
        protectionLabel:
          auraPct < 35 ? 'Aberta 0%' : auraPct < 75 ? 'Média 50%' : 'Fechada 100%',
        protectionPercent: auraPct,
        sizeLabel: getAuraSizeLabelFromPercent(defaultSizePercent),
        sizePercent: defaultSizePercent,
        missingColors: ['Violeta', 'Índigo', 'Azul Claro'],
        excessColors: ['Vermelho', 'Laranja', 'Verde'],
      };
    })(),
    lifeAreas: {
      familiar: 'Bom',
      relacionamentoAfetivo: 'Bom',
      profissional: 'Bom',
      financeiro: 'Bom',
      missaoDeVida: 'Bom',
    },
    spiritualPsycho: {
      bovis,
      hawkinsAgathaHz: hawkins,
      hawkinsHz: hawkins,
      hawkinsLevel: getHawkinsLabelByHz(hawkins),
      stressLevel: stress,
      yinPercent: 50,
      yangPercent: 50,
      spiritualDisturbances: fromRoom?.sensitivity.interferenceTypes || [],
      implantsDetected: [],
      karmicCommitments: [],
      virtuesToAnchor: ['Serenidade', 'Discernimento', 'Vitalidade'],
      recommendedRadionicBoard:
        bovis < 6500
          ? 'Mesa de Assepsia & Blindagem Anti-Catarse'
          : 'Mesa Radiônica Quântica de Alta Vitalidade',
      clientPerceptionScore:
        fromRoom?.clientPerceptionScore ?? fromRoom?.sensitivity.clientPerceptionScore,
      clientPerceptionMoment:
        fromRoom?.clientPerceptionMoment ?? fromRoom?.sensitivity.clientPerceptionMoment,
      clientPerceptionNote:
        fromRoom?.clientPerceptionNote ?? fromRoom?.sensitivity.clientPerceptionNote,
    },
    systems: createDefaultAnsaeSystems(),
    organs,
    biometerReadings: [],
  };
}

export function roomToClinicalRecord(room: QuantumRoomSession): ClinicalSessionRecord {
  const perceptionScore =
    room.clientPerceptionScore ?? room.sensitivity.clientPerceptionScore;
  const perceptionMoment =
    room.clientPerceptionMoment ?? room.sensitivity.clientPerceptionMoment;
  const perceptionNote =
    room.clientPerceptionNote ?? room.sensitivity.clientPerceptionNote;

  return {
    id: room.id,
    patientId: room.anamnesis.id || `patient-${room.id}`,
    sessionType: room.phase === 'stage2' ? 'Pós-Tratamento 1' : 'Avaliação Inicial',
    therapeuticFocus: room.anamnesis.therapeuticFocus,
    emotionalHistory: room.anamnesis.emotionalHistory,
    physicalSymptoms: room.anamnesis.physicalSymptoms,
    medicalTreatments: room.anamnesis.medicalTreatments,
    clinicalNotes: room.anamnesis.clinicalNotes,
    ansaeRhen: createDefaultAnsaeRhenSheet(room),
    protocol: room.protocol,
    aiResult: room.aiResult,
    phase: room.phase,
    isAnchored: room.isAnchored,
    activatedAt: room.activatedAt,
    completedAt: room.phase === 'completed' ? room.updatedAt : undefined,
    selectedSolfeggioHz: room.selectedSolfeggioHz,
    chartCrystals: room.chartCrystals,
    energeticRemedies: room.energeticRemedies || [],
    withdrawnEmissions: room.withdrawnEmissions || [],
    clientPerceptionScore: perceptionScore,
    clientPerceptionMoment: perceptionMoment,
    clientPerceptionNote: perceptionNote,
    updatedAt: room.updatedAt,
  };
}

export function loadClinicalDatabase(): MasterClinicalDatabase {
  const customBiometers = loadCustomBiometers();
  try {
    const raw = localStorage.getItem(CLINICAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MasterClinicalDatabase;
      if (parsed && Array.isArray(parsed.patients) && Array.isArray(parsed.sessions)) {
        return {
          version: 2,
          patients: parsed.patients,
          sessions: parsed.sessions.map((s) => ({
            ...s,
            ansaeRhen: normalizeAnsaeSheet(s.ansaeRhen),
          })),
          customBiometers,
        };
      }
    }
  } catch {
    // Fallback to seed rooms
  }

  const rooms = loadSessions();
  const patients: MasterPatient[] = rooms.map((r) => ({
    id: r.anamnesis.id || `patient-${r.id}`,
    interagentType: r.anamnesis.interagentType,
    fullName: r.anamnesis.fullName,
    birthDate: r.anamnesis.birthDate,
    phone: r.anamnesis.phone,
    petSpecies: r.anamnesis.petSpecies,
    petBreed: r.anamnesis.petBreed,
    petAge: r.anamnesis.petAge,
    petEnvironment: r.anamnesis.petEnvironment,
    tutorName: r.anamnesis.tutorName,
    createdAt: r.activatedAt,
    notes: r.anamnesis.clinicalNotes,
  }));
  const sessions: ClinicalSessionRecord[] = rooms.map(roomToClinicalRecord);

  // Add a realistic historical completed initial session for José Marcos so "Antes x Depois" comparison works immediately
  const joseCurrent = sessions.find((s) => s.patientId === 'patient-jose-marcos');
  if (joseCurrent) {
    const joseInitialAnsae = createDefaultAnsaeRhenSheet();
    joseInitialAnsae.spiritualPsycho.bovis = 5800;
    joseInitialAnsae.spiritualPsycho.hawkinsAgathaHz = 175;
    joseInitialAnsae.spiritualPsycho.hawkinsHz = 175;
    joseInitialAnsae.spiritualPsycho.hawkinsLevel = getHawkinsLabelByHz(175);
    joseInitialAnsae.spiritualPsycho.stressLevel = 6;
    joseInitialAnsae.spiritualPsycho.clientPerceptionScore = 4;
    joseInitialAnsae.spiritualPsycho.clientPerceptionMoment = 'antes';
    joseInitialAnsae.spiritualPsycho.clientPerceptionNote =
      'Cansaço acentuado e tensão lombar antes do primeiro ciclo.';
    joseInitialAnsae.auricField.protectionPercent = 44;
    joseInitialAnsae.auricField.protectionLabel = 'Média 50%';

    const joseInitial: ClinicalSessionRecord = {
      ...joseCurrent,
      id: 'room-jose-initial-history',
      sessionType: 'Avaliação Inicial',
      phase: 'completed',
      isAnchored: true,
      activatedAt: new Date(Date.now() - 180 * 3600 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 92 * 3600 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 92 * 3600 * 1000).toISOString(),
      clientPerceptionScore: 4,
      clientPerceptionMoment: 'antes',
      clientPerceptionNote: 'Cansaço acentuado e tensão lombar antes do primeiro ciclo.',
      ansaeRhen: joseInitialAnsae,
    };
    sessions.push(joseInitial);
  }

  const db: MasterClinicalDatabase = {
    version: 2,
    patients,
    sessions,
    customBiometers,
  };
  saveClinicalDatabase(db);
  return db;
}

export function saveClinicalDatabase(db: MasterClinicalDatabase): void {
  try {
    localStorage.setItem(CLINICAL_DB_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Erro ao salvar banco clínico V2:', err);
  }
}

export function loadCustomBiometers(): BiometerDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_BIOMETERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BiometerDefinition[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomBiometers(biometers: BiometerDefinition[]): void {
  try {
    localStorage.setItem(CUSTOM_BIOMETERS_KEY, JSON.stringify(biometers));
  } catch (err) {
    console.error('Erro ao salvar biômetros personalizados:', err);
  }
}

const HIDDEN_BIOMETERS_KEY = 'maestro_hidden_official_biometers_v1';

export function loadHiddenOfficialBiometers(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_BIOMETERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function saveHiddenOfficialBiometers(ids: string[]): void {
  try {
    localStorage.setItem(HIDDEN_BIOMETERS_KEY, JSON.stringify(ids));
  } catch (err) {
    console.error('Erro ao salvar biômetros ocultos:', err);
  }
}

const BIOMETER_OVERRIDES_KEY = 'maestro_biometer_overrides_v1';

export function loadBiometerOverrides(): Record<string, { name?: string; items: string[] }> {
  try {
    const raw = localStorage.getItem(BIOMETER_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveBiometerOverrides(overrides: Record<string, { name?: string; items: string[] }>): void {
  try {
    localStorage.setItem(BIOMETER_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.error('Erro ao salvar edições de biômetros:', err);
  }
}

const CUSTOM_PRINTABLE_GRAPHICS_KEY = 'maestro_custom_printable_graphics_v1';
const HIDDEN_OFFICIAL_GRAPHICS_KEY = 'maestro_hidden_official_graphics_v1';
const PRINTABLE_GRAPHIC_OVERRIDES_KEY = 'maestro_printable_graphic_overrides_v1';

export interface PrintableGraphicOverride {
  title?: string;
  category?: import('../data/printableGraphicsData').PrintableGraphicCategory;
  imageUrl?: string;
  presentation?: string;
  usageAspects?: string;
  requiresNorthAlignment?: boolean;
}

export function loadCustomPrintableGraphics(): import('../data/printableGraphicsData').PrintableGraphic[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRINTABLE_GRAPHICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPrintableGraphics(
  graphics: import('../data/printableGraphicsData').PrintableGraphic[]
): void {
  try {
    localStorage.setItem(CUSTOM_PRINTABLE_GRAPHICS_KEY, JSON.stringify(graphics));
  } catch (err) {
    console.error('Erro ao salvar gráficos personalizados:', err);
    throw err;
  }
}

export function loadHiddenOfficialGraphics(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_OFFICIAL_GRAPHICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHiddenOfficialGraphics(ids: string[]): void {
  try {
    localStorage.setItem(HIDDEN_OFFICIAL_GRAPHICS_KEY, JSON.stringify(ids));
  } catch (err) {
    console.error('Erro ao salvar gráficos ocultos:', err);
  }
}

export function loadPrintableGraphicOverrides(): Record<string, PrintableGraphicOverride> {
  try {
    const raw = localStorage.getItem(PRINTABLE_GRAPHIC_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function savePrintableGraphicOverrides(
  overrides: Record<string, PrintableGraphicOverride>
): void {
  try {
    localStorage.setItem(PRINTABLE_GRAPHIC_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.error('Erro ao salvar edições de gráficos:', err);
    throw err;
  }
}

const CUSTOM_THERAPEUTIC_KITS_KEY = 'maestro_custom_therapeutic_kits_v1';

export function loadCustomTherapeuticKits(): TherapeuticKit[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THERAPEUTIC_KITS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TherapeuticKit[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTherapeuticKits(kits: TherapeuticKit[]): void {
  try {
    localStorage.setItem(CUSTOM_THERAPEUTIC_KITS_KEY, JSON.stringify(kits));
  } catch (err) {
    console.error('Erro ao salvar kits terapêuticos personalizados:', err);
  }
}

export const BACKUP_RESTORED_EVENT = 'maestro-backup-restored';

export const DEFAULT_CLINIC_LOGO_URL =
  './assets/aistudio/Logo_Maestro_terapias_Vibracionais_Sem_fundo__2__f6ac1f97.png';

export const PROFESSIONAL_PROFILE_STORAGE_KEY = 'maestro_professional_profile_v1';
export const PROFESSIONAL_PROFILE_UPDATED_EVENT = 'maestro-professional-profile-updated';

export interface ProfessionalProfile {
  clinicName: string;
  therapistName: string;
  credentials: string;
  subtitleLine: string;
  contacts: string;
  emailOrSocial: string;
  website?: string;
  logoDataUrl: string | null;
  primaryColor: string;
  accentColor: string;
}

export const DEFAULT_PROFESSIONAL_PROFILE: ProfessionalProfile = {
  clinicName: 'MAESTRO TERAPIAS VIBRACIONAIS',
  therapistName: 'Giovani Caetano',
  credentials:
    'Terapeuta Vibracional • Radiestesista Terapêutico • Neuroterapia & Hipnoterapia',
  subtitleLine: 'Consultoria Holística Integrativa',
  contacts: '(68) 99247-6436 | (11) 95056-5215',
  emailOrSocial: '',
  website: '',
  logoDataUrl: null,
  primaryColor: '#0F172A',
  accentColor: '#B45309',
};

function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function normalizeProfessionalProfile(
  input?: Partial<ProfessionalProfile> | null
): ProfessionalProfile {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_PROFESSIONAL_PROFILE };
  }

  const strOrDefault = (val: unknown, fallback: string): string => {
    if (typeof val !== 'string') return fallback;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };

  const optionalStr = (val: unknown): string =>
    typeof val === 'string' ? val.trim() : '';

  const logoDataUrl =
    typeof input.logoDataUrl === 'string' && input.logoDataUrl.startsWith('data:image/')
      ? input.logoDataUrl
      : null;

  return {
    clinicName: strOrDefault(input.clinicName, DEFAULT_PROFESSIONAL_PROFILE.clinicName),
    therapistName: strOrDefault(
      input.therapistName,
      DEFAULT_PROFESSIONAL_PROFILE.therapistName
    ),
    credentials:
      typeof input.credentials === 'string'
        ? input.credentials.trim()
        : DEFAULT_PROFESSIONAL_PROFILE.credentials,
    subtitleLine:
      typeof input.subtitleLine === 'string'
        ? input.subtitleLine.trim()
        : DEFAULT_PROFESSIONAL_PROFILE.subtitleLine,
    contacts:
      typeof input.contacts === 'string'
        ? input.contacts.trim()
        : DEFAULT_PROFESSIONAL_PROFILE.contacts,
    emailOrSocial: optionalStr(input.emailOrSocial),
    website: optionalStr(input.website),
    logoDataUrl,
    primaryColor: sanitizeHexColor(
      input.primaryColor,
      DEFAULT_PROFESSIONAL_PROFILE.primaryColor
    ),
    accentColor: sanitizeHexColor(
      input.accentColor,
      DEFAULT_PROFESSIONAL_PROFILE.accentColor
    ),
  };
}

export function getProfessionalProfile(): ProfessionalProfile {
  try {
    const raw = localStorage.getItem(PROFESSIONAL_PROFILE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFESSIONAL_PROFILE };
    const parsed = JSON.parse(raw) as Partial<ProfessionalProfile>;
    return normalizeProfessionalProfile(parsed);
  } catch {
    return { ...DEFAULT_PROFESSIONAL_PROFILE };
  }
}

export function saveProfessionalProfile(
  profile: ProfessionalProfile
): ProfessionalProfile {
  const normalized = normalizeProfessionalProfile(profile);
  try {
    localStorage.setItem(PROFESSIONAL_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  } catch (err) {
    console.error('Erro ao salvar perfil profissional:', err);
    throw new Error(
      'Não foi possível salvar a identidade visual (verifique se a logomarca não excedeu o espaço do navegador).'
    );
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PROFESSIONAL_PROFILE_UPDATED_EVENT, { detail: normalized })
    );
  }
  return normalized;
}

export function resetProfessionalProfile(): ProfessionalProfile {
  try {
    localStorage.removeItem(PROFESSIONAL_PROFILE_STORAGE_KEY);
  } catch (err) {
    console.error('Erro ao restaurar perfil profissional padrão:', err);
  }
  const reset = { ...DEFAULT_PROFESSIONAL_PROFILE };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PROFESSIONAL_PROFILE_UPDATED_EVENT, { detail: reset })
    );
  }
  return reset;
}

const ANSAE_DRAFT_PREFIX = 'maestro_quantico_ansae_draft_';

export type BackupRestoreMode = 'merge' | 'replace';

export interface FullBackupPayload {
  backupVersion: 3;
  exportedAt: string;
  app: 'Maestro Quântico';
  rooms: QuantumRoomSession[];
  clinicalDatabase: MasterClinicalDatabase;
  ansaeDrafts: Record<string, ClinicalAnsaeRhenSheet>;
  customBiometers: BiometerDefinition[];
  biometerOverrides: Record<string, { name?: string; items: string[] }>;
  hiddenOfficialBiometers: string[];
  customPrintableGraphics: PrintableGraphic[];
  hiddenOfficialGraphics: string[];
  printableGraphicOverrides: Record<string, PrintableGraphicOverride>;
  customTherapeuticKits?: TherapeuticKit[];
  professionalProfile?: ProfessionalProfile;
  followUpLogs?: FollowUpLogEntry[];
}

export interface FullBackupImportSummary {
  mode: BackupRestoreMode;
  rooms: QuantumRoomSession[];
  patientsCount: number;
  sessionsCount: number;
  customBiometersCount: number;
  biometerOverridesCount: number;
  customGraphicsCount: number;
  ansaeDraftsCount: number;
  followUpLogsCount?: number;
}

function collectAllAnsaeDrafts(): Record<string, ClinicalAnsaeRhenSheet> {
  const drafts: Record<string, ClinicalAnsaeRhenSheet> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ANSAE_DRAFT_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as ClinicalAnsaeRhenSheet;
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.organs)) {
            drafts[key] = normalizeAnsaeSheet(parsed);
          }
        } catch {
          // Ignore malformed draft entry
        }
      }
    }
  } catch {
    // Ignore storage access error
  }
  return drafts;
}

function clearAllAnsaeDrafts(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ANSAE_DRAFT_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}

function mergeById<T extends { id: string; updatedAt?: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  for (const item of incoming) {
    if (!item || !item.id) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    if (prev.updatedAt && item.updatedAt) {
      const prevTime = new Date(prev.updatedAt).getTime();
      const nextTime = new Date(item.updatedAt).getTime();
      if (!Number.isNaN(prevTime) && !Number.isNaN(nextTime) && prevTime > nextTime) {
        continue;
      }
    }
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

export function exportFullBackup(): {
  filename: string;
  json: string;
  payload: FullBackupPayload;
} {
  const clinicalDatabase = loadClinicalDatabase();
  const rooms = loadSessions();
  const customBiometers = loadCustomBiometers();
  const biometerOverrides = loadBiometerOverrides();
  const hiddenOfficialBiometers = loadHiddenOfficialBiometers();
  const customPrintableGraphics = loadCustomPrintableGraphics();
  const hiddenOfficialGraphics = loadHiddenOfficialGraphics();
  const printableGraphicOverrides = loadPrintableGraphicOverrides();
  const customTherapeuticKits = loadCustomTherapeuticKits();
  const professionalProfile = getProfessionalProfile();
  const ansaeDrafts = collectAllAnsaeDrafts();
  const followUpLogs = loadFollowUpLogs();

  const payload: FullBackupPayload = {
    backupVersion: 3,
    exportedAt: new Date().toISOString(),
    app: 'Maestro Quântico',
    rooms,
    clinicalDatabase: {
      ...clinicalDatabase,
      customBiometers,
    },
    ansaeDrafts,
    customBiometers,
    biometerOverrides,
    hiddenOfficialBiometers,
    customPrintableGraphics,
    hiddenOfficialGraphics,
    printableGraphicOverrides,
    customTherapeuticKits,
    professionalProfile,
    followUpLogs,
  };

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `maestro-quantico-backup-${yyyy}-${mm}-${dd}.json`;

  return {
    filename,
    json: JSON.stringify(payload, null, 2),
    payload,
  };
}

export function downloadFullBackup(): {
  filename: string;
  payload: FullBackupPayload;
} {
  const { filename, json, payload } = exportFullBackup();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  saveAs(blob, filename);
  return { filename, payload };
}

export async function importFullBackup(
  file: File,
  mode: BackupRestoreMode = 'merge'
): Promise<FullBackupImportSummary> {
  const rawJson = await file.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    throw new Error('O arquivo selecionado não contém JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Estrutura de backup inválida.');
  }

  const incomingRoomsRaw = Array.isArray(parsed.rooms)
    ? (parsed.rooms as QuantumRoomSession[])
    : Array.isArray(parsed.activeRooms)
    ? (parsed.activeRooms as QuantumRoomSession[])
    : null;

  const incomingDb =
    parsed.clinicalDatabase && typeof parsed.clinicalDatabase === 'object'
      ? (parsed.clinicalDatabase as MasterClinicalDatabase)
      : null;

  if (!incomingDb && !incomingRoomsRaw) {
    throw new Error(
      'Arquivo incompatível: não foram encontrados registros do Maestro Quântico neste backup.'
    );
  }

  const incomingCustomBiometers: BiometerDefinition[] = Array.isArray(parsed.customBiometers)
    ? (parsed.customBiometers as BiometerDefinition[])
    : Array.isArray(incomingDb?.customBiometers)
    ? incomingDb.customBiometers
    : [];

  const incomingBiometerOverrides: Record<string, { name?: string; items: string[] }> =
    parsed.biometerOverrides && typeof parsed.biometerOverrides === 'object'
      ? (parsed.biometerOverrides as Record<string, { name?: string; items: string[] }>)
      : {};

  const incomingHiddenBiometers: string[] = Array.isArray(parsed.hiddenOfficialBiometers)
    ? (parsed.hiddenOfficialBiometers as string[])
    : [];

  const incomingCustomGraphics: PrintableGraphic[] = Array.isArray(parsed.customPrintableGraphics)
    ? (parsed.customPrintableGraphics as PrintableGraphic[])
    : [];

  const incomingHiddenGraphics: string[] = Array.isArray(parsed.hiddenOfficialGraphics)
    ? (parsed.hiddenOfficialGraphics as string[])
    : [];

  const incomingGraphicOverrides: Record<string, PrintableGraphicOverride> =
    parsed.printableGraphicOverrides && typeof parsed.printableGraphicOverrides === 'object'
      ? (parsed.printableGraphicOverrides as Record<string, PrintableGraphicOverride>)
      : {};

  const incomingDrafts: Record<string, ClinicalAnsaeRhenSheet> =
    parsed.ansaeDrafts && typeof parsed.ansaeDrafts === 'object'
      ? (parsed.ansaeDrafts as Record<string, ClinicalAnsaeRhenSheet>)
      : {};

  const incomingCustomKits: TherapeuticKit[] = Array.isArray(parsed.customTherapeuticKits)
    ? (parsed.customTherapeuticKits as TherapeuticKit[])
    : [];

  const incomingFollowUpLogs: FollowUpLogEntry[] = Array.isArray(parsed.followUpLogs)
    ? normalizeFollowUpLogs(parsed.followUpLogs as Partial<FollowUpLogEntry>[])
    : [];

  let finalRooms: QuantumRoomSession[];
  let finalDb: MasterClinicalDatabase;
  let finalCustomBiometers: BiometerDefinition[];
  let finalBiometerOverrides: Record<string, { name?: string; items: string[] }>;
  let finalHiddenBiometers: string[];
  let finalCustomGraphics: PrintableGraphic[];
  let finalHiddenGraphics: string[];
  let finalGraphicOverrides: Record<string, PrintableGraphicOverride>;
  let finalCustomKits: TherapeuticKit[];
  let finalFollowUpLogs: FollowUpLogEntry[];

  if (mode === 'replace') {
    finalRooms = incomingRoomsRaw ?? [];
    finalCustomBiometers = incomingCustomBiometers;
    finalBiometerOverrides = incomingBiometerOverrides;
    finalHiddenBiometers = Array.from(new Set(incomingHiddenBiometers));
    finalCustomGraphics = incomingCustomGraphics;
    finalHiddenGraphics = Array.from(new Set(incomingHiddenGraphics));
    finalGraphicOverrides = incomingGraphicOverrides;
    finalCustomKits = incomingCustomKits;
    finalFollowUpLogs = incomingFollowUpLogs;

    finalDb = {
      version: 2,
      patients: Array.isArray(incomingDb?.patients) ? incomingDb.patients : [],
      sessions: Array.isArray(incomingDb?.sessions)
        ? incomingDb.sessions.map((s) => ({
            ...s,
            ansaeRhen: normalizeAnsaeSheet(s.ansaeRhen),
          }))
        : [],
      customBiometers: finalCustomBiometers,
    };

    clearAllAnsaeDrafts();
    for (const [key, sheet] of Object.entries(incomingDrafts)) {
      if (key.startsWith(ANSAE_DRAFT_PREFIX) && sheet && Array.isArray(sheet.organs)) {
        try {
          localStorage.setItem(key, JSON.stringify(normalizeAnsaeSheet(sheet)));
        } catch {
          // Ignore quota errors
        }
      }
    }
  } else {
    const existingRooms = loadSessions();
    const existingDb = loadClinicalDatabase();
    const existingCustomBiometers = loadCustomBiometers();
    const existingBiometerOverrides = loadBiometerOverrides();
    const existingHiddenBiometers = loadHiddenOfficialBiometers();
    const existingCustomGraphics = loadCustomPrintableGraphics();
    const existingHiddenGraphics = loadHiddenOfficialGraphics();
    const existingGraphicOverrides = loadPrintableGraphicOverrides();
    const existingCustomKits = loadCustomTherapeuticKits();
    const existingFollowUpLogs = loadFollowUpLogs();

    finalRooms = incomingRoomsRaw
      ? mergeById(existingRooms, incomingRoomsRaw)
      : existingRooms;

    finalCustomBiometers = mergeById(existingCustomBiometers, incomingCustomBiometers);
    finalBiometerOverrides = { ...existingBiometerOverrides, ...incomingBiometerOverrides };
    finalHiddenBiometers = Array.from(
      new Set([...existingHiddenBiometers, ...incomingHiddenBiometers])
    );
    finalCustomGraphics = mergeById(existingCustomGraphics, incomingCustomGraphics);
    finalHiddenGraphics = Array.from(
      new Set([...existingHiddenGraphics, ...incomingHiddenGraphics])
    );
    finalGraphicOverrides = { ...existingGraphicOverrides, ...incomingGraphicOverrides };
    finalCustomKits = mergeById(existingCustomKits, incomingCustomKits);
    finalFollowUpLogs = mergeById(
      existingFollowUpLogs.map((item) => ({ ...item, updatedAt: item.date })),
      incomingFollowUpLogs.map((item) => ({ ...item, updatedAt: item.date }))
    )
      .map(({ updatedAt: _u, ...rest }) => rest as FollowUpLogEntry)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const incomingPatients = Array.isArray(incomingDb?.patients) ? incomingDb.patients : [];
    const incomingSessions = Array.isArray(incomingDb?.sessions)
      ? incomingDb.sessions.map((s) => ({
          ...s,
          ansaeRhen: normalizeAnsaeSheet(s.ansaeRhen),
        }))
      : [];

    finalDb = {
      version: 2,
      patients: mergeById(existingDb.patients, incomingPatients),
      sessions: mergeById(existingDb.sessions, incomingSessions),
      customBiometers: finalCustomBiometers,
    };

    for (const [key, sheet] of Object.entries(incomingDrafts)) {
      if (key.startsWith(ANSAE_DRAFT_PREFIX) && sheet && Array.isArray(sheet.organs)) {
        try {
          localStorage.setItem(key, JSON.stringify(normalizeAnsaeSheet(sheet)));
        } catch {
          // Ignore quota errors
        }
      }
    }
  }

  saveSessions(finalRooms);
  saveCustomBiometers(finalCustomBiometers);
  saveBiometerOverrides(finalBiometerOverrides);
  saveHiddenOfficialBiometers(finalHiddenBiometers);
  saveClinicalDatabase(finalDb);
  saveCustomTherapeuticKits(finalCustomKits);
  saveFollowUpLogs(finalFollowUpLogs);

  try {
    saveCustomPrintableGraphics(finalCustomGraphics);
  } catch {
    // Ignore quota errors on large custom graphic payloads
  }
  saveHiddenOfficialGraphics(finalHiddenGraphics);
  try {
    savePrintableGraphicOverrides(finalGraphicOverrides);
  } catch {
    // Ignore quota errors
  }

  if (
    parsed.professionalProfile &&
    typeof parsed.professionalProfile === 'object'
  ) {
    try {
      saveProfessionalProfile(
        normalizeProfessionalProfile(
          parsed.professionalProfile as Partial<ProfessionalProfile>
        )
      );
    } catch {
      // Ignore quota errors on embedded logo
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BACKUP_RESTORED_EVENT));
  }

  return {
    mode,
    rooms: finalRooms,
    patientsCount: finalDb.patients.length,
    sessionsCount: finalDb.sessions.length,
    customBiometersCount: finalCustomBiometers.length,
    biometerOverridesCount: Object.keys(finalBiometerOverrides).length,
    customGraphicsCount: finalCustomGraphics.length,
    ansaeDraftsCount: Object.keys(incomingDrafts).length,
    followUpLogsCount: finalFollowUpLogs.length,
  };
}

export function exportClinicalBackupJson(): string {
  return exportFullBackup().json;
}

export function importClinicalBackupJson(rawJson: string): {
  db: MasterClinicalDatabase;
  rooms: QuantumRoomSession[];
} {
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Arquivo JSON inválido.');
  }

  const db: MasterClinicalDatabase | undefined = parsed.clinicalDatabase;
  const rooms: QuantumRoomSession[] | undefined =
    Array.isArray(parsed.rooms) ? parsed.rooms : parsed.activeRooms;

  if (!db || !Array.isArray(db.patients) || !Array.isArray(db.sessions)) {
    throw new Error('Estrutura de prontuários ausente no arquivo de backup.');
  }

  saveClinicalDatabase(db);
  if (Array.isArray(parsed.customBiometers)) {
    saveCustomBiometers(parsed.customBiometers);
  } else if (Array.isArray(db.customBiometers)) {
    saveCustomBiometers(db.customBiometers);
  }
  if (parsed.biometerOverrides && typeof parsed.biometerOverrides === 'object') {
    saveBiometerOverrides(parsed.biometerOverrides);
  }
  if (Array.isArray(parsed.hiddenOfficialBiometers)) {
    saveHiddenOfficialBiometers(parsed.hiddenOfficialBiometers);
  }
  if (Array.isArray(parsed.customPrintableGraphics)) {
    try {
      saveCustomPrintableGraphics(parsed.customPrintableGraphics);
    } catch {
      // Ignore quota
    }
  }
  if (Array.isArray(parsed.hiddenOfficialGraphics)) {
    saveHiddenOfficialGraphics(parsed.hiddenOfficialGraphics);
  }
  if (parsed.printableGraphicOverrides && typeof parsed.printableGraphicOverrides === 'object') {
    try {
      savePrintableGraphicOverrides(parsed.printableGraphicOverrides);
    } catch {
      // Ignore quota
    }
  }
  if (parsed.ansaeDrafts && typeof parsed.ansaeDrafts === 'object') {
    for (const [key, sheet] of Object.entries(
      parsed.ansaeDrafts as Record<string, ClinicalAnsaeRhenSheet>
    )) {
      if (key.startsWith(ANSAE_DRAFT_PREFIX) && sheet && Array.isArray(sheet.organs)) {
        try {
          localStorage.setItem(key, JSON.stringify(normalizeAnsaeSheet(sheet)));
        } catch {
          // Ignore quota
        }
      }
    }
  }
  if (Array.isArray(parsed.customTherapeuticKits)) {
    saveCustomTherapeuticKits(parsed.customTherapeuticKits);
  }
  if (Array.isArray(parsed.followUpLogs)) {
    saveFollowUpLogs(normalizeFollowUpLogs(parsed.followUpLogs));
  }
  if (Array.isArray(rooms)) {
    saveSessions(rooms);
  }
  if (
    parsed.professionalProfile &&
    typeof parsed.professionalProfile === 'object'
  ) {
    try {
      saveProfessionalProfile(
        normalizeProfessionalProfile(
          parsed.professionalProfile as Partial<ProfessionalProfile>
        )
      );
    } catch {
      // Ignore quota errors
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BACKUP_RESTORED_EVENT));
  }

  return {
    db,
    rooms: Array.isArray(rooms) ? rooms : loadSessions(),
  };
}

export function getAnsaeDraftKey(patientId: string): string {
  return `${ANSAE_DRAFT_PREFIX}${patientId || 'default'}`;
}

export function getAnsaeDraftForSession(session: QuantumRoomSession): ClinicalAnsaeRhenSheet {
  const patientId = session.anamnesis.id || `patient-${session.id}`;
  try {
    const raw = localStorage.getItem(getAnsaeDraftKey(patientId));
    if (raw) {
      const parsed = JSON.parse(raw) as ClinicalAnsaeRhenSheet;
      if (parsed && Array.isArray(parsed.organs) && parsed.organs.length === 38) {
        return normalizeAnsaeSheet(parsed);
      }
    }
  } catch {
    // Fallback to clinical DB or default
  }

  const db = loadClinicalDatabase();
  const matched =
    db.sessions.find((s) => s.id === session.id) ||
    db.sessions.find((s) => s.patientId === patientId && s.phase !== 'completed') ||
    db.sessions.find((s) => s.patientId === patientId);

  if (matched && matched.ansaeRhen && Array.isArray(matched.ansaeRhen.organs)) {
    return normalizeAnsaeSheet(matched.ansaeRhen);
  }

  return createDefaultAnsaeRhenSheet(session);
}

export function saveAnsaeDraftForSession(
  patientId: string,
  sheet: ClinicalAnsaeRhenSheet
): void {
  try {
    localStorage.setItem(getAnsaeDraftKey(patientId), JSON.stringify(sheet));
  } catch {
    // Ignore storage quota errors
  }
}

export function getPreviousSessionForPatient(
  patientId: string,
  excludeSessionId?: string
): ClinicalSessionRecord | null {
  if (!patientId) return null;
  const db = loadClinicalDatabase();
  const candidates = db.sessions
    .filter((s) => s.patientId === patientId && s.id !== excludeSessionId)
    .sort(
      (a, b) => new Date(a.activatedAt).getTime() - new Date(b.activatedAt).getTime()
    );
  return candidates.length > 0 ? candidates[0] : null;
}

function normalizeFollowUpTextKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const VALID_FOLLOW_UP_CATEGORIES: FollowUpCategory[] = [
  'sonho',
  'catarse_sintoma',
  'evolucao_emocional',
  'retorno_geral',
];

function normalizeFollowUpLogs(items: Partial<FollowUpLogEntry>[]): FollowUpLogEntry[] {
  return items
    .filter((item): item is Partial<FollowUpLogEntry> & { id: string } =>
      Boolean(item && typeof item.id === 'string' && item.id.trim().length > 0)
    )
    .map((item) => {
      const rawCategory = item.category as FollowUpCategory;
      const category: FollowUpCategory = VALID_FOLLOW_UP_CATEGORIES.includes(rawCategory)
        ? rawCategory
        : 'retorno_geral';
      return {
        id: item.id,
        patientId: typeof item.patientId === 'string' ? item.patientId : '',
        patientName: typeof item.patientName === 'string' ? item.patientName : 'Consulente',
        date:
          typeof item.date === 'string' && !Number.isNaN(new Date(item.date).getTime())
            ? item.date
            : new Date().toISOString(),
        category,
        narrative: typeof item.narrative === 'string' ? item.narrative : '',
        activeGraphicsSnapshot: Array.isArray(item.activeGraphicsSnapshot)
          ? item.activeGraphicsSnapshot.map((g) => String(g)).filter(Boolean)
          : [],
        therapistAnalysis: typeof item.therapistAnalysis === 'string' ? item.therapistAnalysis : '',
        patientFeedbackMessage:
          typeof item.patientFeedbackMessage === 'string' ? item.patientFeedbackMessage : '',
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function loadFollowUpLogs(): FollowUpLogEntry[] {
  try {
    const raw = localStorage.getItem(FOLLOW_UP_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeFollowUpLogs(parsed as Partial<FollowUpLogEntry>[]);
  } catch {
    return [];
  }
}

export function saveFollowUpLogs(logs: FollowUpLogEntry[]): void {
  try {
    const sorted = [...logs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    localStorage.setItem(FOLLOW_UP_LOGS_STORAGE_KEY, JSON.stringify(sorted));
  } catch (err) {
    console.error('Erro ao salvar diário de acompanhamento:', err);
  }
}

export function matchesPatientFollowUpLog(
  entry: FollowUpLogEntry,
  patientId: string,
  patientName?: string
): boolean {
  if (patientId && entry.patientId === patientId) return true;
  if (patientName && patientName.trim()) {
    return (
      normalizeFollowUpTextKey(entry.patientName) ===
      normalizeFollowUpTextKey(patientName)
    );
  }
  return false;
}

export function getPatientFollowUpLogs(
  patientId: string,
  patientName?: string
): FollowUpLogEntry[] {
  return loadFollowUpLogs().filter((entry) =>
    matchesPatientFollowUpLog(entry, patientId, patientName)
  );
}

export function upsertFollowUpLog(entry: FollowUpLogEntry): FollowUpLogEntry[] {
  const existing = loadFollowUpLogs();
  const idx = existing.findIndex((item) => item.id === entry.id);
  const next =
    idx >= 0
      ? existing.map((item, i) => (i === idx ? entry : item))
      : [entry, ...existing];
  saveFollowUpLogs(next);
  return loadFollowUpLogs();
}

export function deleteFollowUpLog(entryId: string): FollowUpLogEntry[] {
  const next = loadFollowUpLogs().filter((item) => item.id !== entryId);
  saveFollowUpLogs(next);
  return next;
}


