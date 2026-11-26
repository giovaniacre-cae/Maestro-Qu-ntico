import { useCallback, useEffect, useState } from 'react';
import { AnamneseForm } from './components/AnamneseForm';
import { CentralDocumental } from './components/CentralDocumental';
import { Dashboard } from './components/Dashboard';
import {
  GraficosRadionicosTab,
  RecommendedProtocolSequenceItem,
} from './components/GraficosRadionicosTab';
import { MesaQuantica, SelectedTherapeutics } from './components/MesaQuantica';
import { AddPendulatedChartPayload } from './components/AddPendulatedChartPanel';
import { SintoniaSensitiva } from './components/SintoniaSensitiva';
import { TopNav } from './components/TopNav';
import { loadSessions, resetToDemoSeeds, saveSessions } from './data/seedSessions';
import {
  ClinicalAnsaeRhenSheet,
  ClinicalSessionRecord,
  MasterPatient,
  SessionMilestoneType,
  getHawkinsLabelByHz,
} from './types/clinical';
import { TherapeuticKit } from './data/therapeuticKits';
import {
  AntiCatharsisProtocol,
  ChartDurationUnit,
  ChartWithdrawalLogEntry,
  EnergeticRemedyEmission,
  PatientAnamnesis,
  QuantumGenerationResult,
  QuantumGeometry,
  QuantumRoomSession,
  RoomPhase,
  ScreenId,
  SensitivityReading,
} from './types/quantum';
import {
  DEFAULT_CHAKRAS,
  DEFAULT_ORGANIC_SYSTEMS,
  addGeometryToProtocol,
  applyChartCrystalsToResult,
  applyTherapeuticKitToProtocol,
  calculateChartExpiresAt,
  durationUnitToMs,
  evaluateAntiCatharsis,
  formatChartDurationLabel,
  getChartCrystalKey,
  preserveTherapistChartsInProtocol,
  removeGeometryFromProtocol,
} from './utils/antiCatharsis';
import {
  BACKUP_RESTORED_EVENT,
  PROFESSIONAL_PROFILE_UPDATED_EVENT,
  ProfessionalProfile,
  createDefaultAnsaeRhenSheet,
  getAnsaeDraftForSession,
  getPreviousSessionForPatient,
  getProfessionalProfile,
  loadClinicalDatabase,
  normalizeAnsaeSheet,
  saveAnsaeDraftForSession,
  saveClinicalDatabase,
} from './utils/storage';

function createEmptyAnamnesis(): PatientAnamnesis {
  return {
    id: `patient-${Date.now()}`,
    interagentType: 'humano',
    fullName: '',
    birthDate: '',
    phone: '',
    petSpecies: 'Cão',
    petBreed: '',
    petAge: '',
    petEnvironment: '',
    tutorName: '',
    therapeuticFocus: '',
    emotionalHistory: '',
    physicalSymptoms: '',
    medicalTreatments: '',
    clinicalNotes: '',
  };
}

function createDefaultSensitivity(): SensitivityReading {
  return {
    bovis: 6200,
    hawkins: 200,
    hawkinsLevel: getHawkinsLabelByHz(200),
    auricProtection: 55,
    stressLevel: 3,
    subtleInterferences: 0,
    interferenceTypes: [],
    chakras: DEFAULT_CHAKRAS.map((c) => ({ ...c })),
    organicSystems: DEFAULT_ORGANIC_SYSTEMS.map((s) => ({ ...s })),
  };
}

function createEmptyTherapeutics(): SelectedTherapeutics {
  return { florals: [], crystals: [], herbs: [], habits: [] };
}

export default function App() {
  const [sessions, setSessions] = useState<QuantumRoomSession[]>(() => loadSessions());
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');

  // Active working draft state
  const [draftSessionId, setDraftSessionId] = useState<string>(
    () => loadSessions()[0]?.id || `room-${Date.now()}`
  );
  const [draftSessionType, setDraftSessionType] = useState<SessionMilestoneType>(
    () => loadSessions()[0]?.sessionType || 'Avaliação Inicial'
  );
  const [draftAnamnesis, setDraftAnamnesis] = useState<PatientAnamnesis>(
    () => loadSessions()[0]?.anamnesis || createEmptyAnamnesis()
  );
  const [draftSensitivity, setDraftSensitivity] = useState<SensitivityReading>(
    () => loadSessions()[0]?.sensitivity || createDefaultSensitivity()
  );
  const [draftAnsaeSheet, setDraftAnsaeSheet] = useState<ClinicalAnsaeRhenSheet>(() => {
    const first = loadSessions()[0];
    return first ? getAnsaeDraftForSession(first) : createDefaultAnsaeRhenSheet();
  });
  const [draftPreviousSession, setDraftPreviousSession] =
    useState<ClinicalSessionRecord | null>(() => {
      const first = loadSessions()[0];
      return first ? getPreviousSessionForPatient(first.anamnesis.id, first.id) : null;
    });
  const [draftTherapeutics, setDraftTherapeutics] = useState<SelectedTherapeutics>(() =>
    createEmptyTherapeutics()
  );
  const [draftChartCrystals, setDraftChartCrystals] = useState<Record<string, string>>(
    () => loadSessions()[0]?.chartCrystals || {}
  );
  const [draftEnergeticRemedies, setDraftEnergeticRemedies] = useState<EnergeticRemedyEmission[]>(
    () => loadSessions()[0]?.energeticRemedies || []
  );
  const [draftProtocol, setDraftProtocol] = useState<AntiCatharsisProtocol>(() => {
    const first = loadSessions()[0];
    return first
      ? first.protocol
      : evaluateAntiCatharsis(createEmptyAnamnesis(), createDefaultSensitivity());
  });
  const [draftAiResult, setDraftAiResult] = useState<QuantumGenerationResult | null>(
    () => loadSessions()[0]?.aiResult || null
  );
  const [draftIsAnchored, setDraftIsAnchored] = useState<boolean>(
    () => loadSessions()[0]?.isAnchored ?? false
  );
  const [draftSelectedHz, setDraftSelectedHz] = useState<number>(
    () => loadSessions()[0]?.selectedSolfeggioHz || 432
  );

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [professionalProfile, setProfessionalProfile] = useState<ProfessionalProfile>(() =>
    getProfessionalProfile()
  );

  useEffect(() => {
    const syncProfile = () => {
      setProfessionalProfile(getProfessionalProfile());
    };
    window.addEventListener(PROFESSIONAL_PROFILE_UPDATED_EVENT, syncProfile);
    window.addEventListener(BACKUP_RESTORED_EVENT, syncProfile);
    return () => {
      window.removeEventListener(PROFESSIONAL_PROFILE_UPDATED_EVENT, syncProfile);
      window.removeEventListener(BACKUP_RESTORED_EVENT, syncProfile);
    };
  }, []);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const loadSessionIntoDraft = useCallback((session: QuantumRoomSession) => {
    setDraftSessionId(session.id);
    setDraftSessionType(session.sessionType || 'Avaliação Inicial');
    setDraftAnamnesis(session.anamnesis);
    setDraftSensitivity({
      ...session.sensitivity,
      hawkinsLevel: getHawkinsLabelByHz(session.sensitivity.hawkins),
    });
    setDraftAnsaeSheet(getAnsaeDraftForSession(session));
    setDraftPreviousSession(getPreviousSessionForPatient(session.anamnesis.id, session.id));
    setDraftProtocol(session.protocol);
    setDraftAiResult(session.aiResult);
    setDraftIsAnchored(session.isAnchored);
    setDraftSelectedHz(session.selectedSolfeggioHz || 432);
    setDraftTherapeutics(createEmptyTherapeutics());
    setDraftChartCrystals(session.chartCrystals || {});
    setDraftEnergeticRemedies(session.energeticRemedies || []);
    setGenerationError(null);
  }, []);

  const handleNewConsultation = useCallback(() => {
    const emptyA = createEmptyAnamnesis();
    const defaultS = createDefaultSensitivity();
    const defaultSheet = createDefaultAnsaeRhenSheet();
    setDraftSessionId(`room-${Date.now()}`);
    setDraftSessionType('Avaliação Inicial');
    setDraftAnamnesis(emptyA);
    setDraftSensitivity(defaultS);
    setDraftAnsaeSheet(defaultSheet);
    setDraftPreviousSession(null);
    setDraftTherapeutics(createEmptyTherapeutics());
    setDraftChartCrystals({});
    setDraftEnergeticRemedies([]);
    setDraftProtocol(evaluateAntiCatharsis(emptyA, defaultS));
    setDraftAiResult(null);
    setDraftIsAnchored(false);
    setDraftSelectedHz(432);
    setGenerationError(null);
    setActiveScreen('anamnesis');
  }, []);

  const handleReevaluateSession = useCallback(
    (patient: MasterPatient, baseRecord: ClinicalSessionRecord) => {
      const db = loadClinicalDatabase();
      const patientSessions = db.sessions.filter((s) => s.patientId === patient.id);
      const nextMilestone: SessionMilestoneType =
        patientSessions.length <= 1
          ? 'Pós-Tratamento 1'
          : patientSessions.length === 2
          ? 'Pós-Tratamento 2'
          : 'Novo Ciclo';

      const newSessionId = `room-${Date.now()}`;
      const clonedAnamnesis: PatientAnamnesis = {
        id: patient.id,
        interagentType: patient.interagentType,
        fullName: patient.fullName,
        birthDate: patient.birthDate,
        phone: patient.phone,
        petSpecies: patient.petSpecies,
        petBreed: patient.petBreed,
        petAge: patient.petAge,
        petEnvironment: patient.petEnvironment,
        tutorName: patient.tutorName,
        therapeuticFocus: baseRecord.therapeuticFocus,
        emotionalHistory: baseRecord.emotionalHistory,
        physicalSymptoms: baseRecord.physicalSymptoms,
        medicalTreatments: baseRecord.medicalTreatments,
        clinicalNotes: baseRecord.clinicalNotes,
      };
      const clonedHawkinsHz = baseRecord.ansaeRhen.spiritualPsycho.hawkinsAgathaHz;
      const clonedSensitivity: SensitivityReading = {
        bovis: baseRecord.ansaeRhen.spiritualPsycho.bovis,
        hawkins: clonedHawkinsHz,
        hawkinsLevel: getHawkinsLabelByHz(clonedHawkinsHz),
        auricProtection: baseRecord.ansaeRhen.auricField.protectionPercent,
        stressLevel: baseRecord.ansaeRhen.spiritualPsycho.stressLevel,
        subtleInterferences: baseRecord.ansaeRhen.spiritualPsycho.spiritualDisturbances.length,
        interferenceTypes: [...baseRecord.ansaeRhen.spiritualPsycho.spiritualDisturbances],
        chakras: DEFAULT_CHAKRAS.map((c) => ({ ...c })),
        organicSystems: DEFAULT_ORGANIC_SYSTEMS.map((s) => ({ ...s })),
        clientPerceptionScore:
          baseRecord.clientPerceptionScore ??
          baseRecord.ansaeRhen.spiritualPsycho.clientPerceptionScore,
        clientPerceptionMoment: 'pos',
        clientPerceptionNote: '',
      };
      const clonedSheet: ClinicalAnsaeRhenSheet = normalizeAnsaeSheet(
        JSON.parse(JSON.stringify(baseRecord.ansaeRhen)) as ClinicalAnsaeRhenSheet
      );
      clonedSheet.spiritualPsycho.clientPerceptionScore =
        clonedSensitivity.clientPerceptionScore;
      clonedSheet.spiritualPsycho.clientPerceptionMoment = 'pos';
      clonedSheet.spiritualPsycho.clientPerceptionNote = '';

      saveAnsaeDraftForSession(patient.id, clonedSheet);

      setDraftSessionId(newSessionId);
      setDraftSessionType(nextMilestone);
      setDraftAnamnesis(clonedAnamnesis);
      setDraftSensitivity(clonedSensitivity);
      setDraftAnsaeSheet(clonedSheet);
      setDraftPreviousSession(baseRecord);
      setDraftTherapeutics(createEmptyTherapeutics());
      setDraftChartCrystals({});
      setDraftEnergeticRemedies([]);
      setDraftProtocol(evaluateAntiCatharsis(clonedAnamnesis, clonedSensitivity, clonedSheet));
      setDraftAiResult(null);
      setDraftIsAnchored(false);
      setDraftSelectedHz(baseRecord.selectedSolfeggioHz || 432);
      setGenerationError(null);
      setActiveScreen('sensitivity');
    },
    []
  );

  const handleResumeTreatment = useCallback(
    (record: ClinicalSessionRecord) => {
      const existingRoom = sessions.find((s) => s.id === record.id);
      if (existingRoom) {
        if (existingRoom.phase === 'completed') {
          const nowIso = new Date().toISOString();
          const reactivated: QuantumRoomSession = {
            ...existingRoom,
            phase: existingRoom.protocol.mode === 'escalonado' ? 'stage2' : 'single',
            activatedAt: nowIso,
            updatedAt: nowIso,
          };
          setSessions((prev) => prev.map((s) => (s.id === existingRoom.id ? reactivated : s)));
          loadSessionIntoDraft(reactivated);
        } else {
          loadSessionIntoDraft(existingRoom);
        }
        setActiveScreen('quantum-table');
        return;
      }

      const db = loadClinicalDatabase();
      const patient = db.patients.find((p) => p.id === record.patientId);
      const nowIso = new Date().toISOString();
      const restoredRoom: QuantumRoomSession = {
        id: record.id,
        sessionType: record.sessionType,
        anamnesis: {
          id: record.patientId,
          interagentType: patient?.interagentType,
          fullName: patient?.fullName || 'Paciente',
          birthDate: patient?.birthDate || '',
          phone: patient?.phone || '',
          petSpecies: patient?.petSpecies,
          petBreed: patient?.petBreed,
          petAge: patient?.petAge,
          petEnvironment: patient?.petEnvironment,
          tutorName: patient?.tutorName,
          therapeuticFocus: record.therapeuticFocus,
          emotionalHistory: record.emotionalHistory,
          physicalSymptoms: record.physicalSymptoms,
          medicalTreatments: record.medicalTreatments,
          clinicalNotes: record.clinicalNotes,
        },
        sensitivity: {
          bovis: record.ansaeRhen.spiritualPsycho.bovis,
          hawkins: record.ansaeRhen.spiritualPsycho.hawkinsAgathaHz,
          hawkinsLevel: getHawkinsLabelByHz(record.ansaeRhen.spiritualPsycho.hawkinsAgathaHz),
          auricProtection: record.ansaeRhen.auricField.protectionPercent,
          stressLevel: record.ansaeRhen.spiritualPsycho.stressLevel,
          subtleInterferences: record.ansaeRhen.spiritualPsycho.spiritualDisturbances.length,
          interferenceTypes: record.ansaeRhen.spiritualPsycho.spiritualDisturbances,
          chakras: DEFAULT_CHAKRAS.map((c) => ({ ...c })),
          organicSystems: DEFAULT_ORGANIC_SYSTEMS.map((s) => ({ ...s })),
          clientPerceptionScore:
            record.clientPerceptionScore ??
            record.ansaeRhen.spiritualPsycho.clientPerceptionScore,
          clientPerceptionMoment:
            record.clientPerceptionMoment ??
            record.ansaeRhen.spiritualPsycho.clientPerceptionMoment,
          clientPerceptionNote:
            record.clientPerceptionNote ??
            record.ansaeRhen.spiritualPsycho.clientPerceptionNote,
        },
        protocol: record.protocol,
        aiResult: record.aiResult,
        phase: record.phase === 'completed' ? 'stage2' : record.phase,
        isAnchored: true,
        activatedAt: nowIso,
        selectedSolfeggioHz: record.selectedSolfeggioHz || 432,
        chartCrystals: record.chartCrystals || {},
        energeticRemedies: record.energeticRemedies || [],
        clientPerceptionScore:
          record.clientPerceptionScore ??
          record.ansaeRhen.spiritualPsycho.clientPerceptionScore,
        clientPerceptionMoment:
          record.clientPerceptionMoment ??
          record.ansaeRhen.spiritualPsycho.clientPerceptionMoment,
        clientPerceptionNote:
          record.clientPerceptionNote ??
          record.ansaeRhen.spiritualPsycho.clientPerceptionNote,
        updatedAt: nowIso,
      };
      saveAnsaeDraftForSession(record.patientId, normalizeAnsaeSheet(record.ansaeRhen));
      setSessions((prev) => [restoredRoom, ...prev]);
      loadSessionIntoDraft(restoredRoom);
      setActiveScreen('quantum-table');
    },
    [loadSessionIntoDraft, sessions]
  );

  const handleStartNewForPatient = useCallback((patient: MasterPatient) => {
    const emptyA: PatientAnamnesis = {
      id: patient.id,
      interagentType: patient.interagentType,
      fullName: patient.fullName,
      birthDate: patient.birthDate,
      phone: patient.phone,
      petSpecies: patient.petSpecies,
      petBreed: patient.petBreed,
      petAge: patient.petAge,
      petEnvironment: patient.petEnvironment,
      tutorName: patient.tutorName,
      therapeuticFocus: '',
      emotionalHistory: '',
      physicalSymptoms: '',
      medicalTreatments: '',
      clinicalNotes: patient.notes || '',
    };
    const defaultS = createDefaultSensitivity();
    const defaultSheet = createDefaultAnsaeRhenSheet();
    saveAnsaeDraftForSession(patient.id, defaultSheet);

    setDraftSessionId(`room-${Date.now()}`);
    setDraftSessionType('Novo Ciclo');
    setDraftAnamnesis(emptyA);
    setDraftSensitivity(defaultS);
    setDraftAnsaeSheet(defaultSheet);
    setDraftPreviousSession(getPreviousSessionForPatient(patient.id));
    setDraftTherapeutics(createEmptyTherapeutics());
    setDraftChartCrystals({});
    setDraftEnergeticRemedies([]);
    setDraftProtocol(evaluateAntiCatharsis(emptyA, defaultS));
    setDraftAiResult(null);
    setDraftIsAnchored(false);
    setDraftSelectedHz(432);
    setGenerationError(null);
    setActiveScreen('anamnesis');
  }, []);

  const generateWithGemini = useCallback(
    async (
      anamnesisInput: PatientAnamnesis,
      sensitivityInput: SensitivityReading,
      protocolInput: AntiCatharsisProtocol,
      sheetInput: ClinicalAnsaeRhenSheet,
      sessionTypeInput: SessionMilestoneType,
      prevSessionInput: ClinicalSessionRecord | null,
      therapeuticsInput: SelectedTherapeutics,
      chartCrystalsInput: Record<string, string> = draftChartCrystals,
      remediesInput: EnergeticRemedyEmission[] = draftEnergeticRemedies
    ) => {
      setIsGenerating(true);
      setGenerationError(null);
      try {
        const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        const previousSummary = prevSessionInput
          ? {
              sessionType: prevSessionInput.sessionType,
              bovis: prevSessionInput.ansaeRhen.spiritualPsycho.bovis,
              hawkins: prevSessionInput.ansaeRhen.spiritualPsycho.hawkinsAgathaHz,
              hawkinsLevel: getHawkinsLabelByHz(
                prevSessionInput.ansaeRhen.spiritualPsycho.hawkinsAgathaHz
              ),
              auricProtection: prevSessionInput.ansaeRhen.auricField.protectionPercent,
              stressLevel: prevSessionInput.ansaeRhen.spiritualPsycho.stressLevel,
              alertOrgans: prevSessionInput.ansaeRhen.organs
                .filter(
                  (o) =>
                    o.isImbalanced ||
                    (typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500)
                )
                .map(
                  (o) =>
                    `${o.systemCode} ${o.organName} (${o.imbalancePercent}%${
                      typeof o.healthEnergyAngstroms === 'number'
                        ? `, ${o.healthEnergyAngstroms === 0 ? '0.000' : o.healthEnergyAngstroms.toLocaleString('pt-BR')} Å`
                        : ''
                    })`
                ),
            }
          : null;

        const enrichedSensitivity: SensitivityReading = {
          ...sensitivityInput,
          hawkinsLevel: getHawkinsLabelByHz(sensitivityInput.hawkins),
        };

        const res = await fetch(`${apiBase}/api/quantum/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anamnesis: anamnesisInput,
            sensitivity: enrichedSensitivity,
            protocol: protocolInput,
            ansaeRhen: sheetInput,
            sessionType: sessionTypeInput,
            previousSession: previousSummary,
            selectedTherapeutics: therapeuticsInput,
            chartCrystals: chartCrystalsInput,
            energeticRemedies: remediesInput,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
          ? await res.json()
          : {
              error: `Servidor não respondeu em JSON (HTTP ${res.status}). Verifique se o backend Node está ativo.`,
            };
        if (!res.ok) {
          throw new Error(payload?.error || `Erro HTTP ${res.status}`);
        }

        const rawResult = payload as QuantumGenerationResult;
        const result = applyChartCrystalsToResult(
          rawResult,
          protocolInput,
          anamnesisInput,
          enrichedSensitivity,
          chartCrystalsInput
        );
        setDraftAiResult(result);

        const recommendedHz = result.prescricoes?.frequenciasSolfeggio?.[0]?.hz;
        if (recommendedHz && [432, 528, 741].includes(recommendedHz)) {
          setDraftSelectedHz(recommendedHz);
        }

        // Sync back if this session already exists in Dashboard
        setSessions((prev) =>
          prev.map((s) =>
            s.id === draftSessionId
              ? {
                  ...s,
                  sessionType: sessionTypeInput,
                  anamnesis: anamnesisInput,
                  sensitivity: sensitivityInput,
                  protocol: protocolInput,
                  aiResult: result,
                  chartCrystals: chartCrystalsInput,
                  energeticRemedies: remediesInput,
                  updatedAt: new Date().toISOString(),
                }
              : s
          )
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Falha ao conectar com /api/quantum/generate.';
        setGenerationError(msg);
      } finally {
        setIsGenerating(false);
      }
    },
    [draftChartCrystals, draftEnergeticRemedies, draftSessionId]
  );

  const handleConfirmChartCrystal = useCallback(
    (
      stageTag: 'stage1' | 'stage2' | 'single',
      geometryName: string,
      crystalName: string
    ) => {
      const key = getChartCrystalKey(stageTag, geometryName);
      const nextChartCrystals: Record<string, string> = { ...draftChartCrystals };
      if (!crystalName || crystalName.trim().toLowerCase() === 'nenhum') {
        delete nextChartCrystals[key];
      } else {
        nextChartCrystals[key] = crystalName.trim();
      }

      const nextAiResult = applyChartCrystalsToResult(
        draftAiResult,
        draftProtocol,
        draftAnamnesis,
        draftSensitivity,
        nextChartCrystals
      );
      const nowIso = new Date().toISOString();

      setDraftChartCrystals(nextChartCrystals);
      setDraftAiResult(nextAiResult);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === draftSessionId
            ? {
                ...s,
                chartCrystals: nextChartCrystals,
                aiResult: nextAiResult,
                updatedAt: nowIso,
              }
            : s
        )
      );

      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex((s) => s.id === draftSessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          chartCrystals: nextChartCrystals,
          aiResult: nextAiResult,
          updatedAt: nowIso,
        };
        saveClinicalDatabase(db);
      }
    },
    [
      draftAiResult,
      draftAnamnesis,
      draftChartCrystals,
      draftProtocol,
      draftSensitivity,
      draftSessionId,
    ]
  );

  const handleAddPendulatedChart = useCallback(
    (payload: AddPendulatedChartPayload): 'stage1' | 'stage2' | 'single' => {
      const { protocol: nextProtocol, resolvedStage } = addGeometryToProtocol(
        draftProtocol,
        payload.stageTag,
        payload.geometry
      );

      const nextChartCrystals: Record<string, string> = { ...draftChartCrystals };
      const crystalKey = getChartCrystalKey(resolvedStage, payload.geometry.name);
      if (payload.crystalName && payload.crystalName.toLowerCase() !== 'nenhum') {
        nextChartCrystals[crystalKey] = payload.crystalName;
      }

      const nextAiResult = applyChartCrystalsToResult(
        draftAiResult,
        nextProtocol,
        draftAnamnesis,
        draftSensitivity,
        nextChartCrystals
      );
      const nowIso = new Date().toISOString();

      setDraftProtocol(nextProtocol);
      setDraftChartCrystals(nextChartCrystals);
      setDraftAiResult(nextAiResult);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === draftSessionId
            ? {
                ...s,
                protocol: nextProtocol,
                chartCrystals: nextChartCrystals,
                aiResult: nextAiResult,
                updatedAt: nowIso,
              }
            : s
        )
      );

      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex((s) => s.id === draftSessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          protocol: nextProtocol,
          chartCrystals: nextChartCrystals,
          aiResult: nextAiResult,
          updatedAt: nowIso,
        };
        saveClinicalDatabase(db);
      }

      return resolvedStage;
    },
    [
      draftAiResult,
      draftAnamnesis,
      draftChartCrystals,
      draftProtocol,
      draftSensitivity,
      draftSessionId,
    ]
  );

  const handleRemovePendulatedChart = useCallback(
    (stageTag: 'stage1' | 'stage2' | 'single', geometryName: string) => {
      const nextProtocol = removeGeometryFromProtocol(draftProtocol, stageTag, geometryName);
      const nextChartCrystals: Record<string, string> = { ...draftChartCrystals };
      delete nextChartCrystals[getChartCrystalKey(stageTag, geometryName)];

      const nextAiResult = applyChartCrystalsToResult(
        draftAiResult,
        nextProtocol,
        draftAnamnesis,
        draftSensitivity,
        nextChartCrystals
      );
      const nowIso = new Date().toISOString();

      setDraftProtocol(nextProtocol);
      setDraftChartCrystals(nextChartCrystals);
      setDraftAiResult(nextAiResult);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === draftSessionId
            ? {
                ...s,
                protocol: nextProtocol,
                chartCrystals: nextChartCrystals,
                aiResult: nextAiResult,
                updatedAt: nowIso,
              }
            : s
        )
      );

      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex((s) => s.id === draftSessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          protocol: nextProtocol,
          chartCrystals: nextChartCrystals,
          aiResult: nextAiResult,
          updatedAt: nowIso,
        };
        saveClinicalDatabase(db);
      }
    },
    [
      draftAiResult,
      draftAnamnesis,
      draftChartCrystals,
      draftProtocol,
      draftSensitivity,
      draftSessionId,
    ]
  );

  const updateGeometryInProtocol = (
    protocol: AntiCatharsisProtocol,
    stageTag: 'stage1' | 'stage2' | 'single',
    geometryName: string,
    updater: (geo: QuantumGeometry) => QuantumGeometry
  ): AntiCatharsisProtocol => {
    const targetLower = geometryName.trim().toLowerCase();
    const mapList = (list: QuantumGeometry[]) =>
      list.map((g) => (g.name.trim().toLowerCase() === targetLower ? updater(g) : g));

    if (stageTag === 'stage1' && protocol.stage1) {
      return {
        ...protocol,
        stage1: {
          ...protocol.stage1,
          geometries: mapList(protocol.stage1.geometries),
        },
      };
    }
    if (stageTag === 'stage2' && protocol.stage2) {
      return {
        ...protocol,
        stage2: {
          ...protocol.stage2,
          geometries: mapList(protocol.stage2.geometries),
        },
      };
    }
    if (stageTag === 'single' && protocol.singleStage) {
      return {
        ...protocol,
        singleStage: {
          ...protocol.singleStage,
          geometries: mapList(protocol.singleStage.geometries),
        },
      };
    }
    return protocol;
  };

  const handleApplyTherapeuticKit = useCallback(
    (kit: TherapeuticKit) => {
      const { protocol: nextProtocol, stage1Added, stage2Added, singleAdded } =
        applyTherapeuticKitToProtocol(draftProtocol, kit);

      const nextAiResult = applyChartCrystalsToResult(
        draftAiResult,
        nextProtocol,
        draftAnamnesis,
        draftSensitivity,
        draftChartCrystals
      );
      const nowIso = new Date().toISOString();

      setDraftProtocol(nextProtocol);
      setDraftAiResult(nextAiResult);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === draftSessionId
            ? {
                ...s,
                protocol: nextProtocol,
                aiResult: nextAiResult,
                updatedAt: nowIso,
              }
            : s
        )
      );

      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex((s) => s.id === draftSessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          protocol: nextProtocol,
          aiResult: nextAiResult,
          updatedAt: nowIso,
        };
        saveClinicalDatabase(db);
      }

      return { stage1Added, stage2Added, singleAdded };
    },
    [
      draftAiResult,
      draftAnamnesis,
      draftChartCrystals,
      draftProtocol,
      draftSensitivity,
      draftSessionId,
    ]
  );

  const handleApplyRadionicProtocolToTable = useCallback(
    (
      protocolTitle: string,
      items: RecommendedProtocolSequenceItem[],
      witnessTemplate?: string
    ) => {
      const norm = (v: string) =>
        v
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

      let accProtocol = draftProtocol;

      items.forEach((item, index) => {
        const combined = norm(`${item.step} ${item.graphicTitle} ${item.role}`);
        const stepNorm = norm(item.step);

        let category: QuantumGeometry['category'] = 'regeneracao';
        if (
          combined.includes('prote') ||
          combined.includes('defesa') ||
          combined.includes('anti magia') ||
          combined.includes('anti-magia') ||
          combined.includes('scap') ||
          combined.includes('iave') ||
          combined.includes('yoshua') ||
          combined.includes('ioshua') ||
          combined.includes('nove circulos') ||
          combined.includes('quadrado magico')
        ) {
          category = 'protecao';
        } else if (
          combined.includes('limpeza') ||
          combined.includes('desimpregn') ||
          combined.includes('desobstru') ||
          combined.includes('decagono') ||
          combined.includes('triturador') ||
          combined.includes('desembarac')
        ) {
          category = 'assepsia';
        } else if (
          combined.includes('prosper') ||
          combined.includes('fortuna') ||
          combined.includes('abund') ||
          combined.includes('shrim') ||
          combined.includes('jupiter') ||
          combined.includes('material')
        ) {
          category = 'prosperidade';
        } else if (
          combined.includes('harmon') ||
          combined.includes('relacion') ||
          combined.includes('amor') ||
          combined.includes('chakra') ||
          combined.includes('sono')
        ) {
          category = 'harmonia';
        }

        const isExplicitStage2 =
          stepNorm.includes('etapa 2') ||
          stepNorm.includes('fase 2') ||
          stepNorm.includes('aceleracao') ||
          stepNorm.includes('potencializacao');
        const isStage1Concept =
          stepNorm.includes('etapa 0') ||
          stepNorm.includes('etapa 1') ||
          stepNorm.includes('preparo') ||
          stepNorm.includes('valorizacao') ||
          category === 'assepsia' ||
          category === 'protecao';

        const requestedStage: 'stage1' | 'stage2' | 'single' =
          accProtocol.mode === 'escalonado'
            ? isExplicitStage2
              ? 'stage2'
              : isStage1Concept
                ? 'stage1'
                : 'stage2'
            : 'single';

        const geometry: QuantumGeometry = {
          id: `rad-ai-${Date.now()}-${index}`,
          name: item.graphicTitle,
          category,
          role: `${item.role} (${item.alignment})`,
          durationHint: item.durationHint || 'Conforme pêndulo',
          source: 'therapist',
          customFocus: witnessTemplate
            ? `${protocolTitle} — ${witnessTemplate}`
            : protocolTitle,
        };

        accProtocol = addGeometryToProtocol(accProtocol, requestedStage, geometry).protocol;
      });

      const nextAiResult = applyChartCrystalsToResult(
        draftAiResult,
        accProtocol,
        draftAnamnesis,
        draftSensitivity,
        draftChartCrystals
      );
      const nowIso = new Date().toISOString();

      setDraftProtocol(accProtocol);
      setDraftAiResult(nextAiResult);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === draftSessionId
            ? {
                ...s,
                protocol: accProtocol,
                aiResult: nextAiResult,
                updatedAt: nowIso,
              }
            : s
        )
      );

      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex((s) => s.id === draftSessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          protocol: accProtocol,
          aiResult: nextAiResult,
          updatedAt: nowIso,
        };
        saveClinicalDatabase(db);
      }

      setActiveScreen('quantum-table');
    },
    [
      draftAiResult,
      draftAnamnesis,
      draftChartCrystals,
      draftProtocol,
      draftSensitivity,
      draftSessionId,
    ]
  );

  const handleActivateChartTimer = useCallback(
    (
      stageTag: 'stage1' | 'stage2' | 'single',
      geometryName: string,
      config: {
        durationValue: number;
        durationUnit: ChartDurationUnit;
        customExpiresAt?: string;
      }
    ) => {
      const nowIso = new Date().toISOString();
      const expiresAt = config.customExpiresAt
        ? new Date(config.customExpiresAt).toISOString()
        : calculateChartExpiresAt(nowIso, config.durationValue, config.durationUnit);

      const diffMs = Math.max(60000, new Date(expiresAt).getTime() - new Date(nowIso).getTime());
      const resolvedValue = config.customExpiresAt
        ? Math.max(1, Math.round(diffMs / 3600000))
        : config.durationValue;
      const resolvedUnit: ChartDurationUnit = config.customExpiresAt
        ? 'horas'
        : config.durationUnit;

      const nextProtocol = updateGeometryInProtocol(
        draftProtocol,
        stageTag,
        geometryName,
        (geo) => ({
          ...geo,
          activatedAt: nowIso,
          durationValue: resolvedValue,
          durationUnit: resolvedUnit,
          expiresAt,
          status: 'active',
          withdrawnAt: undefined,
        })
      );

      setDraftProtocol(nextProtocol);
      setDraftIsAnchored(true);

      const initialPhase: RoomPhase =
        nextProtocol.mode === 'escalonado' ? 'stage1' : 'single';

      const latestSheet = getAnsaeDraftForSession({
        id: draftSessionId,
        anamnesis: draftAnamnesis,
        sensitivity: draftSensitivity,
        protocol: nextProtocol,
        aiResult: draftAiResult,
        phase: initialPhase,
        isAnchored: true,
        activatedAt: nowIso,
        selectedSolfeggioHz: draftSelectedHz,
        updatedAt: nowIso,
      });

      setSessions((prev) => {
        const exists = prev.some((s) => s.id === draftSessionId);
        if (exists) {
          return prev.map((s) =>
            s.id === draftSessionId
              ? {
                  ...s,
                  anamnesis: draftAnamnesis,
                  sensitivity: draftSensitivity,
                  protocol: nextProtocol,
                  aiResult: draftAiResult,
                  isAnchored: true,
                  chartCrystals: draftChartCrystals,
                  energeticRemedies: draftEnergeticRemedies,
                  selectedSolfeggioHz: draftSelectedHz,
                  updatedAt: nowIso,
                }
              : s
          );
        }

        const createdRoom: QuantumRoomSession = {
          id: draftSessionId,
          sessionType: draftSessionType,
          anamnesis: draftAnamnesis,
          sensitivity: draftSensitivity,
          protocol: nextProtocol,
          aiResult: draftAiResult,
          phase: initialPhase,
          isAnchored: true,
          activatedAt: nowIso,
          stage1StartedAt: initialPhase === 'stage1' ? nowIso : undefined,
          selectedSolfeggioHz: draftSelectedHz,
          chartCrystals: draftChartCrystals,
          energeticRemedies: draftEnergeticRemedies,
          withdrawnEmissions: [],
          updatedAt: nowIso,
        };
        return [createdRoom, ...prev];
      });

      const db = loadClinicalDatabase();
      const patientId = draftAnamnesis.id || `patient-${draftSessionId}`;
      if (draftAnamnesis.fullName.trim()) {
        const existingPatientIdx = db.patients.findIndex((p) => p.id === patientId);
        const patientRecord: MasterPatient = {
          id: patientId,
          interagentType: draftAnamnesis.interagentType,
          fullName: draftAnamnesis.fullName,
          birthDate: draftAnamnesis.birthDate,
          phone: draftAnamnesis.phone,
          petSpecies: draftAnamnesis.petSpecies,
          petBreed: draftAnamnesis.petBreed,
          petAge: draftAnamnesis.petAge,
          petEnvironment: draftAnamnesis.petEnvironment,
          tutorName: draftAnamnesis.tutorName,
          createdAt:
            existingPatientIdx >= 0 ? db.patients[existingPatientIdx].createdAt : nowIso,
          notes: draftAnamnesis.clinicalNotes,
        };
        if (existingPatientIdx >= 0) {
          db.patients[existingPatientIdx] = patientRecord;
        } else {
          db.patients.push(patientRecord);
        }
      }
      const idx = db.sessions.findIndex((s) => s.id === draftSessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          ansaeRhen: latestSheet,
          protocol: nextProtocol,
          aiResult: draftAiResult,
          isAnchored: true,
          chartCrystals: draftChartCrystals,
          energeticRemedies: draftEnergeticRemedies,
          clientPerceptionScore:
            draftSensitivity.clientPerceptionScore ??
            latestSheet.spiritualPsycho.clientPerceptionScore,
          clientPerceptionMoment:
            draftSensitivity.clientPerceptionMoment ??
            latestSheet.spiritualPsycho.clientPerceptionMoment,
          clientPerceptionNote:
            draftSensitivity.clientPerceptionNote ??
            latestSheet.spiritualPsycho.clientPerceptionNote,
          updatedAt: nowIso,
        };
      } else {
        db.sessions.unshift({
          id: draftSessionId,
          patientId,
          sessionType: draftSessionType,
          therapeuticFocus: draftAnamnesis.therapeuticFocus,
          emotionalHistory: draftAnamnesis.emotionalHistory,
          physicalSymptoms: draftAnamnesis.physicalSymptoms,
          medicalTreatments: draftAnamnesis.medicalTreatments,
          clinicalNotes: draftAnamnesis.clinicalNotes,
          ansaeRhen: latestSheet,
          protocol: nextProtocol,
          aiResult: draftAiResult,
          phase: initialPhase,
          isAnchored: true,
          activatedAt: nowIso,
          selectedSolfeggioHz: draftSelectedHz,
          chartCrystals: draftChartCrystals,
          energeticRemedies: draftEnergeticRemedies,
          withdrawnEmissions: [],
          clientPerceptionScore:
            draftSensitivity.clientPerceptionScore ??
            latestSheet.spiritualPsycho.clientPerceptionScore,
          clientPerceptionMoment:
            draftSensitivity.clientPerceptionMoment ??
            latestSheet.spiritualPsycho.clientPerceptionMoment,
          clientPerceptionNote:
            draftSensitivity.clientPerceptionNote ??
            latestSheet.spiritualPsycho.clientPerceptionNote,
          updatedAt: nowIso,
        });
      }
      saveClinicalDatabase(db);
    },
    [
      draftAiResult,
      draftAnamnesis,
      draftChartCrystals,
      draftEnergeticRemedies,
      draftProtocol,
      draftSelectedHz,
      draftSensitivity,
      draftSessionId,
      draftSessionType,
    ]
  );

  const handleWithdrawChartEmission = useCallback(
    (
      sessionId: string,
      stageTag: 'stage1' | 'stage2' | 'single',
      geometryName: string
    ) => {
      const nowIso = new Date().toISOString();
      const stageLabel =
        stageTag === 'stage1'
          ? 'Etapa 1 — Limpeza & Blindagem'
          : stageTag === 'stage2'
          ? 'Etapa 2 — Regeneração & Vitalidade'
          : 'Etapa Única — Harmonização Direta';

      let targetGeo: QuantumGeometry | undefined;
      const targetSession = sessions.find((s) => s.id === sessionId);
      const sourceProtocol =
        targetSession?.protocol || (sessionId === draftSessionId ? draftProtocol : undefined);

      if (sourceProtocol) {
        const list =
          stageTag === 'stage1'
            ? sourceProtocol.stage1?.geometries || []
            : stageTag === 'stage2'
            ? sourceProtocol.stage2?.geometries || []
            : sourceProtocol.singleStage?.geometries || [];
        targetGeo = list.find(
          (g) => g.name.trim().toLowerCase() === geometryName.trim().toLowerCase()
        );
      }

      const logEntry: ChartWithdrawalLogEntry = {
        id: `withdraw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        geometryName: targetGeo?.name || geometryName,
        stageLabel,
        activatedAt: targetGeo?.activatedAt || nowIso,
        expiresAt: targetGeo?.expiresAt || nowIso,
        withdrawnAt: nowIso,
        durationLabel:
          targetGeo?.durationValue && targetGeo?.durationUnit
            ? formatChartDurationLabel(targetGeo.durationValue, targetGeo.durationUnit)
            : targetGeo?.durationHint || 'Personalizado',
      };

      if (sessionId === draftSessionId) {
        setDraftProtocol((prev) =>
          updateGeometryInProtocol(prev, stageTag, geometryName, (geo) => ({
            ...geo,
            status: 'withdrawn',
            withdrawnAt: nowIso,
          }))
        );
      }

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            protocol: updateGeometryInProtocol(s.protocol, stageTag, geometryName, (geo) => ({
              ...geo,
              status: 'withdrawn',
              withdrawnAt: nowIso,
            })),
            withdrawnEmissions: [logEntry, ...(s.withdrawnEmissions || [])],
            updatedAt: nowIso,
          };
        })
      );

      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex((s) => s.id === sessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          protocol: updateGeometryInProtocol(
            db.sessions[idx].protocol,
            stageTag,
            geometryName,
            (geo) => ({
              ...geo,
              status: 'withdrawn',
              withdrawnAt: nowIso,
            })
          ),
          withdrawnEmissions: [logEntry, ...(db.sessions[idx].withdrawnEmissions || [])],
          updatedAt: nowIso,
        };
        saveClinicalDatabase(db);
      }
    },
    [draftProtocol, draftSessionId, sessions]
  );

  const handleExtendChartEmission = useCallback(
    (
      sessionId: string,
      stageTag: 'stage1' | 'stage2' | 'single',
      geometryName: string,
      extension: {
        addValue?: number;
        addUnit?: ChartDurationUnit;
        customExpiresAt?: string;
      }
    ) => {
      const nowIso = new Date().toISOString();
      const applyExtension = (geo: QuantumGeometry): QuantumGeometry => {
        const currentExpiresMs = geo.expiresAt ? new Date(geo.expiresAt).getTime() : Date.now();
        const baseMs = Number.isNaN(currentExpiresMs)
          ? Date.now()
          : Math.max(Date.now(), currentExpiresMs);

        const nextExpiresAt = extension.customExpiresAt
          ? new Date(extension.customExpiresAt).toISOString()
          : new Date(
              baseMs +
                durationUnitToMs(extension.addValue || 24, extension.addUnit || 'horas')
            ).toISOString();

        const startMs = geo.activatedAt ? new Date(geo.activatedAt).getTime() : Date.now();
        const totalDiffMs = Math.max(
          60000,
          new Date(nextExpiresAt).getTime() - (Number.isNaN(startMs) ? Date.now() : startMs)
        );
        const totalHours = Math.max(1, Math.round(totalDiffMs / 3600000));

        return {
          ...geo,
          activatedAt: geo.activatedAt || nowIso,
          expiresAt: nextExpiresAt,
          durationValue: totalHours >= 48 && totalHours % 24 === 0 ? totalHours / 24 : totalHours,
          durationUnit: totalHours >= 48 && totalHours % 24 === 0 ? 'dias' : 'horas',
          status: 'active',
          withdrawnAt: undefined,
        };
      };

      if (sessionId === draftSessionId) {
        setDraftProtocol((prev) =>
          updateGeometryInProtocol(prev, stageTag, geometryName, applyExtension)
        );
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                protocol: updateGeometryInProtocol(s.protocol, stageTag, geometryName, applyExtension),
                updatedAt: nowIso,
              }
            : s
        )
      );

      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex((s) => s.id === sessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          protocol: updateGeometryInProtocol(
            db.sessions[idx].protocol,
            stageTag,
            geometryName,
            applyExtension
          ),
          updatedAt: nowIso,
        };
        saveClinicalDatabase(db);
      }
    },
    [draftSessionId]
  );

  const persistRemediesUpdate = useCallback(
    (nextRemedies: EnergeticRemedyEmission[]) => {
      const nowIso = new Date().toISOString();
      setDraftEnergeticRemedies(nextRemedies);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === draftSessionId
            ? { ...s, energeticRemedies: nextRemedies, updatedAt: nowIso }
            : s
        )
      );

      const db = loadClinicalDatabase();
      const idx = db.sessions.findIndex((s) => s.id === draftSessionId);
      if (idx >= 0) {
        db.sessions[idx] = {
          ...db.sessions[idx],
          energeticRemedies: nextRemedies,
          updatedAt: nowIso,
        };
        saveClinicalDatabase(db);
      }
    },
    [draftSessionId]
  );

  const handleAddEnergeticRemedy = useCallback(
    (remedy: EnergeticRemedyEmission) => {
      persistRemediesUpdate([remedy, ...draftEnergeticRemedies]);
    },
    [draftEnergeticRemedies, persistRemediesUpdate]
  );

  const handleUpdateEnergeticRemedy = useCallback(
    (id: string, patch: Partial<EnergeticRemedyEmission>) => {
      persistRemediesUpdate(
        draftEnergeticRemedies.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    [draftEnergeticRemedies, persistRemediesUpdate]
  );

  const handleRemoveEnergeticRemedy = useCallback(
    (id: string) => {
      persistRemediesUpdate(draftEnergeticRemedies.filter((r) => r.id !== id));
    },
    [draftEnergeticRemedies, persistRemediesUpdate]
  );

  const handleProcessProtocol = useCallback(() => {
    const latestSheet = getAnsaeDraftForSession({
      id: draftSessionId,
      anamnesis: draftAnamnesis,
      sensitivity: draftSensitivity,
      protocol: draftProtocol,
      aiResult: draftAiResult,
      phase: 'stage1',
      isAnchored: draftIsAnchored,
      activatedAt: new Date().toISOString(),
      selectedSolfeggioHz: draftSelectedHz,
      chartCrystals: draftChartCrystals,
      updatedAt: new Date().toISOString(),
    });
    setDraftAnsaeSheet(latestSheet);
    const nextProtocol = preserveTherapistChartsInProtocol(
      evaluateAntiCatharsis(draftAnamnesis, draftSensitivity, latestSheet),
      draftProtocol
    );
    setDraftProtocol(nextProtocol);
    setActiveScreen('quantum-table');
    void generateWithGemini(
      draftAnamnesis,
      draftSensitivity,
      nextProtocol,
      latestSheet,
      draftSessionType,
      draftPreviousSession,
      draftTherapeutics,
      draftChartCrystals
    );
  }, [
    draftAiResult,
    draftAnamnesis,
    draftChartCrystals,
    draftIsAnchored,
    draftPreviousSession,
    draftProtocol,
    draftSelectedHz,
    draftSensitivity,
    draftSessionId,
    draftSessionType,
    draftTherapeutics,
    generateWithGemini,
  ]);

  const handleAnchorAndCollapse = useCallback(() => {
    const nowIso = new Date().toISOString();
    const initialPhase: RoomPhase =
      draftProtocol.mode === 'escalonado' ? 'stage1' : 'single';

    setDraftIsAnchored(true);

    const latestSheet = getAnsaeDraftForSession({
      id: draftSessionId,
      anamnesis: draftAnamnesis,
      sensitivity: draftSensitivity,
      protocol: draftProtocol,
      aiResult: draftAiResult,
      phase: initialPhase,
      isAnchored: true,
      activatedAt: nowIso,
      selectedSolfeggioHz: draftSelectedHz,
      updatedAt: nowIso,
    });
    setDraftAnsaeSheet(latestSheet);

    // Save into Master Clinical DB V2 as well
    const db = loadClinicalDatabase();
    const patientId = draftAnamnesis.id || `patient-${draftSessionId}`;
    if (draftAnamnesis.fullName.trim()) {
      const existingPatientIdx = db.patients.findIndex((p) => p.id === patientId);
      const patientRecord: MasterPatient = {
        id: patientId,
        interagentType: draftAnamnesis.interagentType,
        fullName: draftAnamnesis.fullName,
        birthDate: draftAnamnesis.birthDate,
        phone: draftAnamnesis.phone,
        petSpecies: draftAnamnesis.petSpecies,
        petBreed: draftAnamnesis.petBreed,
        petAge: draftAnamnesis.petAge,
        petEnvironment: draftAnamnesis.petEnvironment,
        tutorName: draftAnamnesis.tutorName,
        createdAt:
          existingPatientIdx >= 0 ? db.patients[existingPatientIdx].createdAt : nowIso,
        notes: draftAnamnesis.clinicalNotes,
      };
      if (existingPatientIdx >= 0) {
        db.patients[existingPatientIdx] = patientRecord;
      } else {
        db.patients.push(patientRecord);
      }
    }
    const existingRecIdx = db.sessions.findIndex((s) => s.id === draftSessionId);
    const existingRec = existingRecIdx >= 0 ? db.sessions[existingRecIdx] : undefined;
    const recordV2: ClinicalSessionRecord = {
      id: draftSessionId,
      patientId,
      sessionType: draftSessionType,
      therapeuticFocus: draftAnamnesis.therapeuticFocus,
      emotionalHistory: draftAnamnesis.emotionalHistory,
      physicalSymptoms: draftAnamnesis.physicalSymptoms,
      medicalTreatments: draftAnamnesis.medicalTreatments,
      clinicalNotes: draftAnamnesis.clinicalNotes,
      ansaeRhen: latestSheet,
      protocol: draftProtocol,
      aiResult: draftAiResult,
      phase: initialPhase,
      isAnchored: true,
      activatedAt: nowIso,
      selectedSolfeggioHz: draftSelectedHz,
      chartCrystals: draftChartCrystals,
      energeticRemedies: draftEnergeticRemedies,
      withdrawnEmissions: existingRec?.withdrawnEmissions || [],
      clientPerceptionScore:
        draftSensitivity.clientPerceptionScore ??
        latestSheet.spiritualPsycho.clientPerceptionScore,
      clientPerceptionMoment:
        draftSensitivity.clientPerceptionMoment ??
        latestSheet.spiritualPsycho.clientPerceptionMoment,
      clientPerceptionNote:
        draftSensitivity.clientPerceptionNote ??
        latestSheet.spiritualPsycho.clientPerceptionNote,
      updatedAt: nowIso,
    };
    if (existingRecIdx >= 0) {
      db.sessions[existingRecIdx] = recordV2;
    } else {
      db.sessions.unshift(recordV2);
    }
    saveClinicalDatabase(db);

    setSessions((prev) => {
      const existing = prev.find((s) => s.id === draftSessionId);
      if (existing) {
        return prev.map((s) =>
          s.id === draftSessionId
            ? {
                ...s,
                sessionType: draftSessionType,
                anamnesis: draftAnamnesis,
                sensitivity: draftSensitivity,
                protocol: draftProtocol,
                aiResult: draftAiResult,
                isAnchored: true,
                selectedSolfeggioHz: draftSelectedHz,
                chartCrystals: draftChartCrystals,
                energeticRemedies: draftEnergeticRemedies,
                clientPerceptionScore:
                  draftSensitivity.clientPerceptionScore ??
                  latestSheet.spiritualPsycho.clientPerceptionScore,
                clientPerceptionMoment:
                  draftSensitivity.clientPerceptionMoment ??
                  latestSheet.spiritualPsycho.clientPerceptionMoment,
                clientPerceptionNote:
                  draftSensitivity.clientPerceptionNote ??
                  latestSheet.spiritualPsycho.clientPerceptionNote,
                updatedAt: nowIso,
              }
            : s
        );
      }

      const newRoom: QuantumRoomSession = {
        id: draftSessionId,
        sessionType: draftSessionType,
        anamnesis: draftAnamnesis,
        sensitivity: draftSensitivity,
        protocol: draftProtocol,
        aiResult: draftAiResult,
        phase: initialPhase,
        isAnchored: true,
        activatedAt: nowIso,
        stage1StartedAt: initialPhase === 'stage1' ? nowIso : undefined,
        selectedSolfeggioHz: draftSelectedHz,
        chartCrystals: draftChartCrystals,
        energeticRemedies: draftEnergeticRemedies,
        clientPerceptionScore:
          draftSensitivity.clientPerceptionScore ??
          latestSheet.spiritualPsycho.clientPerceptionScore,
        clientPerceptionMoment:
          draftSensitivity.clientPerceptionMoment ??
          latestSheet.spiritualPsycho.clientPerceptionMoment,
        clientPerceptionNote:
          draftSensitivity.clientPerceptionNote ??
          latestSheet.spiritualPsycho.clientPerceptionNote,
        updatedAt: nowIso,
      };
      return [newRoom, ...prev];
    });
  }, [
    draftAiResult,
    draftAnamnesis,
    draftChartCrystals,
    draftEnergeticRemedies,
    draftProtocol,
    draftSelectedHz,
    draftSensitivity,
    draftSessionId,
    draftSessionType,
  ]);

  const handleAdvancePhase = useCallback((sessionId: string, nextPhase: RoomPhase) => {
    const nowIso = new Date().toISOString();
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          phase: nextPhase,
          activatedAt: nowIso,
          restStartedAt: nextPhase === 'rest' ? nowIso : s.restStartedAt,
          stage2StartedAt: nextPhase === 'stage2' ? nowIso : s.stage2StartedAt,
          updatedAt: nowIso,
        };
      })
    );
  }, []);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        if (draftSessionId === sessionId && next.length > 0) {
          loadSessionIntoDraft(next[0]);
        }
        return next;
      });
    },
    [draftSessionId, loadSessionIntoDraft]
  );

  const handleResetDemos = useCallback(() => {
    const seeds = resetToDemoSeeds();
    setSessions(seeds);
    if (seeds[0]) {
      loadSessionIntoDraft(seeds[0]);
    }
  }, [loadSessionIntoDraft]);

  const activeDocSession: QuantumRoomSession =
    sessions.find((s) => s.id === draftSessionId) || {
      id: draftSessionId,
      sessionType: draftSessionType,
      anamnesis: draftAnamnesis,
      sensitivity: draftSensitivity,
      protocol: draftProtocol,
      aiResult: draftAiResult,
      phase: draftProtocol.mode === 'escalonado' ? 'stage1' : 'single',
      isAnchored: draftIsAnchored,
      activatedAt: new Date().toISOString(),
      selectedSolfeggioHz: draftSelectedHz,
      chartCrystals: draftChartCrystals,
      energeticRemedies: draftEnergeticRemedies,
      updatedAt: new Date().toISOString(),
    };

  const handleBackupRestored = useCallback(
    (restoredRooms: QuantumRoomSession[]) => {
      setSessions(restoredRooms);
      const matchingCurrent = restoredRooms.find((s) => s.id === draftSessionId);
      const target = matchingCurrent || restoredRooms[0];
      if (target) {
        loadSessionIntoDraft(target);
      }
    },
    [draftSessionId, loadSessionIntoDraft]
  );

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#FAF8F5] text-[#0F172A] flex flex-col">
      <TopNav
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
        onNewConsultation={handleNewConsultation}
        onBackupRestored={handleBackupRestored}
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-8">
        {activeScreen === 'dashboard' && (
          <Dashboard
            sessions={sessions}
            onOpenTable={(id) => {
              const found = sessions.find((s) => s.id === id);
              if (found) loadSessionIntoDraft(found);
              setActiveScreen('quantum-table');
            }}
            onOpenDocuments={(id) => {
              const found = sessions.find((s) => s.id === id);
              if (found) loadSessionIntoDraft(found);
              setActiveScreen('documents');
            }}
            onAdvancePhase={handleAdvancePhase}
            onDeleteSession={handleDeleteSession}
            onNewConsultation={handleNewConsultation}
            onResetDemos={handleResetDemos}
            onReevaluateSession={handleReevaluateSession}
            onResumeTreatment={handleResumeTreatment}
            onStartNewForPatient={handleStartNewForPatient}
            onWithdrawChartEmission={handleWithdrawChartEmission}
            onExtendChartEmission={handleExtendChartEmission}
            onRestoreBackup={(restoredRooms) => {
              setSessions(restoredRooms);
              if (restoredRooms[0]) {
                loadSessionIntoDraft(restoredRooms[0]);
              }
            }}
          />
        )}

        {activeScreen === 'anamnesis' && (
          <AnamneseForm
            anamnesis={draftAnamnesis}
            existingSessions={sessions}
            onChange={(updated) => {
              setDraftAnamnesis(updated);
              setDraftProtocol(
                preserveTherapistChartsInProtocol(
                  evaluateAntiCatharsis(updated, draftSensitivity, draftAnsaeSheet),
                  draftProtocol
                )
              );
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === draftSessionId
                    ? {
                        ...s,
                        anamnesis: updated,
                        updatedAt: new Date().toISOString(),
                      }
                    : s
                )
              );
            }}
            onSelectExistingSession={(id) => {
              const found = sessions.find((s) => s.id === id);
              if (found) loadSessionIntoDraft(found);
            }}
            onResetForm={handleNewConsultation}
            onProceedToSensitivity={() => setActiveScreen('sensitivity')}
          />
        )}

        {activeScreen === 'sensitivity' && (
          <SintoniaSensitiva
            anamnesis={draftAnamnesis}
            sensitivity={draftSensitivity}
            onChange={(updated) => {
              const latestSheet = getAnsaeDraftForSession({
                id: draftSessionId,
                anamnesis: draftAnamnesis,
                sensitivity: updated,
                protocol: draftProtocol,
                aiResult: draftAiResult,
                phase: 'stage1',
                isAnchored: draftIsAnchored,
                activatedAt: new Date().toISOString(),
                selectedSolfeggioHz: draftSelectedHz,
                updatedAt: new Date().toISOString(),
              });
              const nextProtocol = preserveTherapistChartsInProtocol(
                evaluateAntiCatharsis(draftAnamnesis, updated, latestSheet),
                draftProtocol
              );
              setDraftSensitivity(updated);
              setDraftAnsaeSheet(latestSheet);
              setDraftProtocol(nextProtocol);
              const nowIso = new Date().toISOString();
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === draftSessionId
                    ? {
                        ...s,
                        sensitivity: updated,
                        protocol: nextProtocol,
                        clientPerceptionScore:
                          updated.clientPerceptionScore ??
                          latestSheet.spiritualPsycho.clientPerceptionScore,
                        clientPerceptionMoment:
                          updated.clientPerceptionMoment ??
                          latestSheet.spiritualPsycho.clientPerceptionMoment,
                        clientPerceptionNote:
                          updated.clientPerceptionNote ??
                          latestSheet.spiritualPsycho.clientPerceptionNote,
                        updatedAt: nowIso,
                      }
                    : s
                )
              );
            }}
            onProcessProtocol={handleProcessProtocol}
            onBackToAnamnesis={() => setActiveScreen('anamnesis')}
          />
        )}

        {activeScreen === 'quantum-table' && (
          <MesaQuantica
            anamnesis={draftAnamnesis}
            sensitivity={draftSensitivity}
            protocol={draftProtocol}
            aiResult={draftAiResult}
            isGenerating={isGenerating}
            generationError={generationError}
            isAnchored={draftIsAnchored}
            selectedHz={draftSelectedHz}
            ansaeSheet={draftAnsaeSheet}
            sessionType={draftSessionType}
            previousSession={draftPreviousSession}
            selectedTherapeutics={draftTherapeutics}
            chartCrystals={draftChartCrystals}
            onUpdateTherapeutics={setDraftTherapeutics}
            onConfirmChartCrystal={handleConfirmChartCrystal}
            onAddPendulatedChart={handleAddPendulatedChart}
            onRemovePendulatedChart={handleRemovePendulatedChart}
            onApplyTherapeuticKit={handleApplyTherapeuticKit}
            onActivateChartTimer={handleActivateChartTimer}
            onWithdrawChartEmission={(stageTag, geometryName) =>
              handleWithdrawChartEmission(draftSessionId, stageTag, geometryName)
            }
            energeticRemedies={draftEnergeticRemedies}
            onAddEnergeticRemedy={handleAddEnergeticRemedy}
            onUpdateEnergeticRemedy={handleUpdateEnergeticRemedy}
            onRemoveEnergeticRemedy={handleRemoveEnergeticRemedy}
            onRegenerateAI={() =>
              void generateWithGemini(
                draftAnamnesis,
                draftSensitivity,
                draftProtocol,
                draftAnsaeSheet,
                draftSessionType,
                draftPreviousSession,
                draftTherapeutics,
                draftChartCrystals,
                draftEnergeticRemedies
              )
            }
            onSelectHz={(hz) => {
              setDraftSelectedHz(hz);
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === draftSessionId ? { ...s, selectedSolfeggioHz: hz } : s
                )
              );
            }}
            onAnchorAndCollapse={handleAnchorAndCollapse}
            onGoToDocuments={() => setActiveScreen('documents')}
            onBackToSensitivity={() => setActiveScreen('sensitivity')}
          />
        )}

        {activeScreen === 'radionic-charts' && (
          <GraficosRadionicosTab onApplyProtocolToTable={handleApplyRadionicProtocolToTable} />
        )}

        {activeScreen === 'documents' && (
          <CentralDocumental
            sessions={sessions}
            activeSession={activeDocSession}
            ansaeSheet={draftAnsaeSheet}
            sessionType={draftSessionType}
            previousSession={draftPreviousSession}
            onSelectSession={(id) => {
              const found = sessions.find((s) => s.id === id);
              if (found) loadSessionIntoDraft(found);
            }}
            onGoToTable={() => setActiveScreen('quantum-table')}
          />
        )}
      </main>

      <footer className="border-t border-[#E2E8F0] bg-[#FAF8F5] py-5">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#64748B]">
          <span>
            {[
              professionalProfile.clinicName,
              professionalProfile.therapistName,
              professionalProfile.subtitleLine,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span>
            {[
              professionalProfile.contacts ? `Contatos: ${professionalProfile.contacts}` : '',
              professionalProfile.emailOrSocial,
              professionalProfile.website,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      </footer>
    </div>
  );
}
