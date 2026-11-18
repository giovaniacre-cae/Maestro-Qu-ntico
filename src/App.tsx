import { useCallback, useEffect, useState } from 'react';
import { AnamneseForm } from './components/AnamneseForm';
import { CentralDocumental } from './components/CentralDocumental';
import { Dashboard } from './components/Dashboard';
import { MesaQuantica, SelectedTherapeutics } from './components/MesaQuantica';
import { SintoniaSensitiva } from './components/SintoniaSensitiva';
import { TopNav } from './components/TopNav';
import { loadSessions, resetToDemoSeeds, saveSessions } from './data/seedSessions';
import {
  ClinicalAnsaeRhenSheet,
  ClinicalSessionRecord,
  MasterPatient,
  SessionMilestoneType,
} from './types/clinical';
import {
  AntiCatharsisProtocol,
  PatientAnamnesis,
  QuantumGenerationResult,
  QuantumRoomSession,
  RoomPhase,
  ScreenId,
  SensitivityReading,
} from './types/quantum';
import {
  DEFAULT_CHAKRAS,
  DEFAULT_ORGANIC_SYSTEMS,
  evaluateAntiCatharsis,
} from './utils/antiCatharsis';
import {
  createDefaultAnsaeRhenSheet,
  getAnsaeDraftForSession,
  getPreviousSessionForPatient,
  loadClinicalDatabase,
  saveAnsaeDraftForSession,
  saveClinicalDatabase,
} from './utils/storage';

function createEmptyAnamnesis(): PatientAnamnesis {
  return {
    id: `patient-${Date.now()}`,
    fullName: '',
    birthDate: '',
    phone: '',
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

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const loadSessionIntoDraft = useCallback((session: QuantumRoomSession) => {
    setDraftSessionId(session.id);
    setDraftSessionType(session.sessionType || 'Avaliação Inicial');
    setDraftAnamnesis(session.anamnesis);
    setDraftSensitivity(session.sensitivity);
    setDraftAnsaeSheet(getAnsaeDraftForSession(session));
    setDraftPreviousSession(getPreviousSessionForPatient(session.anamnesis.id, session.id));
    setDraftProtocol(session.protocol);
    setDraftAiResult(session.aiResult);
    setDraftIsAnchored(session.isAnchored);
    setDraftSelectedHz(session.selectedSolfeggioHz || 432);
    setDraftTherapeutics(createEmptyTherapeutics());
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
        fullName: patient.fullName,
        birthDate: patient.birthDate,
        phone: patient.phone,
        therapeuticFocus: baseRecord.therapeuticFocus,
        emotionalHistory: baseRecord.emotionalHistory,
        physicalSymptoms: baseRecord.physicalSymptoms,
        medicalTreatments: baseRecord.medicalTreatments,
        clinicalNotes: baseRecord.clinicalNotes,
      };
      const clonedSensitivity: SensitivityReading = {
        bovis: baseRecord.ansaeRhen.spiritualPsycho.bovis,
        hawkins: baseRecord.ansaeRhen.spiritualPsycho.hawkinsAgathaHz,
        auricProtection: baseRecord.ansaeRhen.auricField.protectionPercent,
        stressLevel: baseRecord.ansaeRhen.spiritualPsycho.stressLevel,
        subtleInterferences: baseRecord.ansaeRhen.spiritualPsycho.spiritualDisturbances.length,
        interferenceTypes: [...baseRecord.ansaeRhen.spiritualPsycho.spiritualDisturbances],
        chakras: DEFAULT_CHAKRAS.map((c) => ({ ...c })),
        organicSystems: DEFAULT_ORGANIC_SYSTEMS.map((s) => ({ ...s })),
      };
      const clonedSheet: ClinicalAnsaeRhenSheet = JSON.parse(
        JSON.stringify(baseRecord.ansaeRhen)
      ) as ClinicalAnsaeRhenSheet;

      saveAnsaeDraftForSession(patient.id, clonedSheet);

      setDraftSessionId(newSessionId);
      setDraftSessionType(nextMilestone);
      setDraftAnamnesis(clonedAnamnesis);
      setDraftSensitivity(clonedSensitivity);
      setDraftAnsaeSheet(clonedSheet);
      setDraftPreviousSession(baseRecord);
      setDraftTherapeutics(createEmptyTherapeutics());
      setDraftProtocol(evaluateAntiCatharsis(clonedAnamnesis, clonedSensitivity));
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
          fullName: patient?.fullName || 'Paciente',
          birthDate: patient?.birthDate || '',
          phone: patient?.phone || '',
          therapeuticFocus: record.therapeuticFocus,
          emotionalHistory: record.emotionalHistory,
          physicalSymptoms: record.physicalSymptoms,
          medicalTreatments: record.medicalTreatments,
          clinicalNotes: record.clinicalNotes,
        },
        sensitivity: {
          bovis: record.ansaeRhen.spiritualPsycho.bovis,
          hawkins: record.ansaeRhen.spiritualPsycho.hawkinsAgathaHz,
          auricProtection: record.ansaeRhen.auricField.protectionPercent,
          stressLevel: record.ansaeRhen.spiritualPsycho.stressLevel,
          subtleInterferences: record.ansaeRhen.spiritualPsycho.spiritualDisturbances.length,
          interferenceTypes: record.ansaeRhen.spiritualPsycho.spiritualDisturbances,
          chakras: DEFAULT_CHAKRAS.map((c) => ({ ...c })),
          organicSystems: DEFAULT_ORGANIC_SYSTEMS.map((s) => ({ ...s })),
        },
        protocol: record.protocol,
        aiResult: record.aiResult,
        phase: record.phase === 'completed' ? 'stage2' : record.phase,
        isAnchored: true,
        activatedAt: nowIso,
        selectedSolfeggioHz: record.selectedSolfeggioHz || 432,
        updatedAt: nowIso,
      };
      saveAnsaeDraftForSession(record.patientId, record.ansaeRhen);
      setSessions((prev) => [restoredRoom, ...prev]);
      loadSessionIntoDraft(restoredRoom);
      setActiveScreen('quantum-table');
    },
    [loadSessionIntoDraft, sessions]
  );

  const handleStartNewForPatient = useCallback((patient: MasterPatient) => {
    const emptyA: PatientAnamnesis = {
      id: patient.id,
      fullName: patient.fullName,
      birthDate: patient.birthDate,
      phone: patient.phone,
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
      therapeuticsInput: SelectedTherapeutics
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
              auricProtection: prevSessionInput.ansaeRhen.auricField.protectionPercent,
              stressLevel: prevSessionInput.ansaeRhen.spiritualPsycho.stressLevel,
              alertOrgans: prevSessionInput.ansaeRhen.organs
                .filter((o) => o.isImbalanced)
                .map((o) => `${o.systemCode} ${o.organName} (${o.imbalancePercent}%)`),
            }
          : null;

        const res = await fetch(`${apiBase}/api/quantum/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anamnesis: anamnesisInput,
            sensitivity: sensitivityInput,
            protocol: protocolInput,
            ansaeRhen: sheetInput,
            sessionType: sessionTypeInput,
            previousSession: previousSummary,
            selectedTherapeutics: therapeuticsInput,
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

        const result = payload as QuantumGenerationResult;
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
    [draftSessionId]
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
      updatedAt: new Date().toISOString(),
    });
    setDraftAnsaeSheet(latestSheet);
    const nextProtocol = evaluateAntiCatharsis(draftAnamnesis, draftSensitivity);
    setDraftProtocol(nextProtocol);
    setActiveScreen('quantum-table');
    void generateWithGemini(
      draftAnamnesis,
      draftSensitivity,
      nextProtocol,
      latestSheet,
      draftSessionType,
      draftPreviousSession,
      draftTherapeutics
    );
  }, [
    draftAiResult,
    draftAnamnesis,
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
    if (
      draftAnamnesis.fullName.trim() &&
      !db.patients.some((p) => p.id === patientId)
    ) {
      db.patients.push({
        id: patientId,
        fullName: draftAnamnesis.fullName,
        birthDate: draftAnamnesis.birthDate,
        phone: draftAnamnesis.phone,
        createdAt: nowIso,
        notes: draftAnamnesis.clinicalNotes,
      });
    }
    const existingRecIdx = db.sessions.findIndex((s) => s.id === draftSessionId);
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
        updatedAt: nowIso,
      };
      return [newRoom, ...prev];
    });
  }, [
    draftAiResult,
    draftAnamnesis,
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
      updatedAt: new Date().toISOString(),
    };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#0F172A] flex flex-col">
      <TopNav
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
        onNewConsultation={handleNewConsultation}
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
              setDraftProtocol(evaluateAntiCatharsis(updated, draftSensitivity));
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
              setDraftSensitivity(updated);
              setDraftProtocol(evaluateAntiCatharsis(draftAnamnesis, updated));
              setDraftAnsaeSheet(
                getAnsaeDraftForSession({
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
                })
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
            onUpdateTherapeutics={setDraftTherapeutics}
            onRegenerateAI={() =>
              void generateWithGemini(
                draftAnamnesis,
                draftSensitivity,
                draftProtocol,
                draftAnsaeSheet,
                draftSessionType,
                draftPreviousSession,
                draftTherapeutics
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
            Maestro Terapias Vibracionais · Giovani Caetano · Atendimentos Integrativos
          </span>
          <span>Contatos: (68) 99247-6436 · (11) 95056-5215</span>
        </div>
      </footer>
    </div>
  );
}
