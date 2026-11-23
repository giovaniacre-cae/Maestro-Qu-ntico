export type ScreenId =
  | 'dashboard'
  | 'anamnesis'
  | 'sensitivity'
  | 'quantum-table'
  | 'radionic-charts'
  | 'documents';

export type RoomPhase = 'stage1' | 'rest' | 'stage2' | 'single' | 'completed';

export interface CopilotAnalysisResult {
  clinicalComplaints: string;
  psychosomaticMapping: string;
  centralIntention: string;
  suggestedFocus: string;
  highlightedOrgansAndChakras: string[];
}

export interface PatientAnamnesis {
  id: string;
  fullName: string;
  birthDate: string; // YYYY-MM-DD or DD/MM/YYYY
  phone: string;
  therapeuticFocus: string; // Foco Específico
  emotionalHistory: string;
  physicalSymptoms: string;
  medicalTreatments: string;
  clinicalNotes: string;
  sessionTranscript?: string;
  copilotAnalysis?: CopilotAnalysisResult | null;
  lgpdConsent?: boolean;
  lgpdConsentDate?: string;
}

export interface ChakraReading {
  id: string;
  name: string;
  sanskrit: string;
  percentage: number; // 0-100
  status: 'Equilibrado' | 'Hipo-ativo' | 'Hiper-ativo' | 'Bloqueado';
}

export interface OrganicSystemStatus {
  id: string;
  name: string;
  status: 'Equilibrado' | 'Em Alerta';
  note: string;
  healthEnergyAngstroms?: number;
}

export interface SensitivityReading {
  bovis: number; // Angstroms (0 - 15000)
  hawkins: number; // 20 - 1000
  hawkinsLevel?: string;
  auricProtection: number; // 0 - 100%
  stressLevel: number; // 1 - 5
  subtleInterferences: number; // count 0 - 5
  interferenceTypes: string[];
  chakras: ChakraReading[];
  organicSystems: OrganicSystemStatus[];
  clientPerceptionScore?: number; // 0 - 10
  clientPerceptionMoment?: 'antes' | 'pos';
  clientPerceptionNote?: string;
}

export type ChartDurationUnit = 'minutos' | 'horas' | 'dias';

export type ChartEmissionStatus = 'active' | 'warning' | 'expired' | 'withdrawn';

export interface QuantumGeometry {
  id?: string;
  name: string;
  category: 'assepsia' | 'protecao' | 'regeneracao' | 'prosperidade' | 'harmonia';
  role: string;
  durationHint: string;
  anchoredCrystal?: string;
  source?: 'motor' | 'therapist';
  customFocus?: string;
  activatedAt?: string;
  durationValue?: number;
  durationUnit?: ChartDurationUnit;
  expiresAt?: string;
  status?: ChartEmissionStatus;
  withdrawnAt?: string;
}

export interface AntiCatharsisProtocol {
  mode: 'escalonado' | 'direto';
  riskTriggered: boolean;
  riskReasons: string[];
  stage1: {
    title: string;
    durationLabel: string;
    minHours: number;
    maxHours: number;
    objective: string;
    geometries: QuantumGeometry[];
    blockedGeometries: string[];
  } | null;
  restIntervalHours: number;
  stage2: {
    title: string;
    durationLabel: string;
    totalDays: number;
    objective: string;
    geometries: QuantumGeometry[];
  } | null;
  singleStage: {
    title: string;
    durationLabel: string;
    totalDays: number;
    objective: string;
    geometries: QuantumGeometry[];
  } | null;
}

export interface TestemunhoItem {
  geometria: string;
  etapa: string;
  testemunhoFormatado: string;
  cristalAncorado?: string;
  origem?: 'motor' | 'therapist';
  focoEspecifico?: string;
}

export interface ComandoQuanticoItem {
  geometria: string;
  etapa: string;
  tituloComando: string;
  comandoTexto: string;
  cristalAncorado?: string;
  origem?: 'motor' | 'therapist';
  focoEspecifico?: string;
}

export interface SolfeggioRecommendation {
  hz: number;
  nome: string;
  indicacao: string;
}

export interface PrescricoesIntegrativas {
  floraisBach: string[];
  cristais?: string[];
  fitoterapiaChas: string[];
  bonsHabitos?: string[];
  frequenciasSolfeggio: SolfeggioRecommendation[];
  pilaresAutocuidado: {
    hidratacaoFitoterapia: string;
    higieneMentalOracao: string;
    ambiente: string;
    acompanhamentoMedico: string;
  };
}

export interface QuantumGenerationResult {
  welcomeMessage?: string;
  testemunhos: TestemunhoItem[];
  comandosQuanticos: ComandoQuanticoItem[];
  analiseCausaRaiz?: string;
  analisePsicossomatica: string;
  comparativoEvolutivo?: string | null;
  orientacaoPacienteResumo: string;
  orientacaoChakrasAuraHabitos?: string;
  prescricoes: PrescricoesIntegrativas;
  generatedAt: string;
}

export type EnergeticRemedyCategory =
  | 'Florais de Bach'
  | 'Fitoterapia & Chás'
  | 'Suplementos / Oligoelementos'
  | 'Frequências & Cromoterapia'
  | 'Medicação Informacional / Homeopatia'
  | 'Personalizado';

export type EnergeticRemedyEmitterGraph =
  | 'Decágono Duplo'
  | 'SCAP Cabalístico'
  | 'Decágono Duplo + SCAP';

export interface EnergeticRemedyEmission {
  id: string;
  category: EnergeticRemedyCategory;
  items: string[];
  emitterGraph: EnergeticRemedyEmitterGraph;
  durationHours: number;
  dosageInstruction: string;
  testimonyText: string;
  activationCommand: string;
  isActive: boolean;
  activatedAt?: string;
}

export interface ChartWithdrawalLogEntry {
  id: string;
  geometryName: string;
  stageLabel: string;
  activatedAt: string;
  expiresAt: string;
  withdrawnAt: string;
  durationLabel: string;
}

export interface QuantumRoomSession {
  id: string;
  sessionType?: 'Avaliação Inicial' | 'Pós-Tratamento 1' | 'Pós-Tratamento 2' | 'Novo Ciclo';
  anamnesis: PatientAnamnesis;
  sensitivity: SensitivityReading;
  protocol: AntiCatharsisProtocol;
  aiResult: QuantumGenerationResult | null;
  phase: RoomPhase;
  isAnchored: boolean;
  activatedAt: string; // ISO timestamp of current phase start or wave anchor
  stage1StartedAt?: string;
  stage2StartedAt?: string;
  restStartedAt?: string;
  selectedSolfeggioHz: number;
  chartCrystals?: Record<string, string>;
  energeticRemedies?: EnergeticRemedyEmission[];
  withdrawnEmissions?: ChartWithdrawalLogEntry[];
  clientPerceptionScore?: number; // 0 - 10
  clientPerceptionMoment?: 'antes' | 'pos';
  clientPerceptionNote?: string;
  updatedAt: string;
}
