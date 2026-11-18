import {
  AnsaeChakraReading,
  AnsaeOrganReading,
  AnsaeSystemCode,
  BiometerDefinition,
  ClinicalAnsaeRhenSheet,
  ClinicalSessionRecord,
  ElectromagneticFieldReading,
  MasterClinicalDatabase,
  MasterPatient,
} from '../types/clinical';
import { QuantumRoomSession } from '../types/quantum';
import { loadSessions, saveSessions } from '../data/seedSessions';

const CLINICAL_DB_KEY = 'maestro_quantico_clinical_db_v2';
const CUSTOM_BIOMETERS_KEY = 'maestro_quantico_custom_biometers_v2';

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
    auricField: {
      protectionLabel:
        auraPct < 35 ? 'Aberta 0%' : auraPct < 75 ? 'Média 50%' : 'Fechada 100%',
      protectionPercent: auraPct,
      sizeLabel: auraPct < 45 ? 'Encolhida' : auraPct > 80 ? 'Expandida' : 'Regular',
      sizePercent: auraPct < 45 ? 65 : 100,
      missingColors: ['Dourado', 'Violeta', 'Verde Esmeralda'],
      excessColors: ['Vermelho Denso', 'Cinza', 'Laranja Escuro'],
    },
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
    },
    organs,
    biometerReadings: [],
  };
}

export function roomToClinicalRecord(room: QuantumRoomSession): ClinicalSessionRecord {
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
          sessions: parsed.sessions,
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
    fullName: r.anamnesis.fullName,
    birthDate: r.anamnesis.birthDate,
    phone: r.anamnesis.phone,
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
    joseInitialAnsae.spiritualPsycho.stressLevel = 6;
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

export function exportClinicalBackupJson(): string {
  const db = loadClinicalDatabase();
  const rooms = loadSessions();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'Maestro Quântico v2.0',
      clinicalDatabase: db,
      activeRooms: rooms,
    },
    null,
    2
  );
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
  const rooms: QuantumRoomSession[] | undefined = parsed.activeRooms;

  if (!db || !Array.isArray(db.patients) || !Array.isArray(db.sessions)) {
    throw new Error('Estrutura de prontuários ausente no arquivo de backup.');
  }

  saveClinicalDatabase(db);
  if (Array.isArray(db.customBiometers)) {
    saveCustomBiometers(db.customBiometers);
  }
  if (Array.isArray(rooms)) {
    saveSessions(rooms);
  }

  return {
    db,
    rooms: Array.isArray(rooms) ? rooms : loadSessions(),
  };
}

export function getAnsaeDraftKey(patientId: string): string {
  return `maestro_quantico_ansae_draft_${patientId || 'default'}`;
}

export function getAnsaeDraftForSession(session: QuantumRoomSession): ClinicalAnsaeRhenSheet {
  const patientId = session.anamnesis.id || `patient-${session.id}`;
  try {
    const raw = localStorage.getItem(getAnsaeDraftKey(patientId));
    if (raw) {
      const parsed = JSON.parse(raw) as ClinicalAnsaeRhenSheet;
      if (parsed && Array.isArray(parsed.organs) && parsed.organs.length === 38) {
        return parsed;
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
    return matched.ansaeRhen;
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

