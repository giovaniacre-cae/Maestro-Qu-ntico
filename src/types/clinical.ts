import { AntiCatharsisProtocol, QuantumGenerationResult, RoomPhase } from './quantum';

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

export interface AuricFieldReading {
  protectionLabel: AuraProtectionLevel;
  protectionPercent: number; // 0 - 100
  sizeLabel: AuraSizeLevel;
  sizePercent: number; // 0 - 200
  missingColors: string[]; // min 3
  excessColors: string[]; // min 3
}

export interface LifeAreasReading {
  familiar: LifeAreaRating;
  relacionamentoAfetivo: LifeAreaRating;
  profissional: LifeAreaRating;
  financeiro: LifeAreaRating;
  missaoDeVida: LifeAreaRating;
}

export interface SpiritualPsychoReading {
  bovis: number; // 0 - 18000+
  hawkinsAgathaHz: number; // 20 - 800 Hz
  stressLevel: number; // 0 - 9
  yinPercent: number; // 0 - 100
  yangPercent: number; // 0 - 100
  spiritualDisturbances: string[];
  implantsDetected: string[];
  karmicCommitments: string[];
  virtuesToAnchor: string[];
  recommendedRadionicBoard: string;
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
  fullName: string;
  birthDate: string;
  phone: string;
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
    | 'Chakras'
    | 'Saúde & ANSAE'
    | 'Psicoemocional'
    | 'Radiestesia & Gráficos'
    | 'Florais & Terapias'
    | 'Personalizado';
  description: string;
  items: string[];
  isCustom?: boolean;
}
