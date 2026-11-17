import { useCallback, useEffect, useState } from 'react';
import { AnamneseForm } from './components/AnamneseForm';
import { CentralDocumental } from './components/CentralDocumental';
import { Dashboard } from './components/Dashboard';
import { MesaQuantica } from './components/MesaQuantica';
import { SintoniaSensitiva } from './components/SintoniaSensitiva';
import { TopNav } from './components/TopNav';
import { loadSessions, resetToDemoSeeds, saveSessions } from './data/seedSessions';
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

export default function App() {
  const [sessions, setSessions] = useState<QuantumRoomSession[]>(() => loadSessions());
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');

  // Active working draft state
  const [draftSessionId, setDraftSessionId] = useState<string>(
    () => loadSessions()[0]?.id || `room-${Date.now()}`
  );
  const [draftAnamnesis, setDraftAnamnesis] = useState<PatientAnamnesis>(
    () => loadSessions()[0]?.anamnesis || createEmptyAnamnesis()
  );
  const [draftSensitivity, setDraftSensitivity] = useState<SensitivityReading>(
    () => loadSessions()[0]?.sensitivity || createDefaultSensitivity()
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

  const loadSessionIntoDraft = useCallback(
    (session: QuantumRoomSession) => {
      setDraftSessionId(session.id);
      setDraftAnamnesis(session.anamnesis);
      setDraftSensitivity(session.sensitivity);
      setDraftProtocol(session.protocol);
      setDraftAiResult(session.aiResult);
      setDraftIsAnchored(session.isAnchored);
      setDraftSelectedHz(session.selectedSolfeggioHz || 432);
      setGenerationError(null);
    },
    []
  );

  const handleNewConsultation = useCallback(() => {
    const emptyA = createEmptyAnamnesis();
    const defaultS = createDefaultSensitivity();
    setDraftSessionId(`room-${Date.now()}`);
    setDraftAnamnesis(emptyA);
    setDraftSensitivity(defaultS);
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
      protocolInput: AntiCatharsisProtocol
    ) => {
      setIsGenerating(true);
      setGenerationError(null);
      try {
        const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        const res = await fetch(`${apiBase}/api/quantum/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anamnesis: anamnesisInput,
            sensitivity: sensitivityInput,
            protocol: protocolInput,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
          ? await res.json()
          : { error: `Servidor não respondeu em JSON (HTTP ${res.status}). Verifique se o backend Node está ativo.` };
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
    const nextProtocol = evaluateAntiCatharsis(draftAnamnesis, draftSensitivity);
    setDraftProtocol(nextProtocol);
    setActiveScreen('quantum-table');
    void generateWithGemini(draftAnamnesis, draftSensitivity, nextProtocol);
  }, [draftAnamnesis, draftSensitivity, generateWithGemini]);

  const handleAnchorAndCollapse = useCallback(() => {
    const nowIso = new Date().toISOString();
    const initialPhase: RoomPhase =
      draftProtocol.mode === 'escalonado' ? 'stage1' : 'single';

    setDraftIsAnchored(true);

    setSessions((prev) => {
      const existing = prev.find((s) => s.id === draftSessionId);
      if (existing) {
        return prev.map((s) =>
          s.id === draftSessionId
            ? {
                ...s,
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
            onRegenerateAI={() =>
              void generateWithGemini(draftAnamnesis, draftSensitivity, draftProtocol)
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
