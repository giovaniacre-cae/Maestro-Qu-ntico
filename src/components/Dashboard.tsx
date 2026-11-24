import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FlaskConical,
  FolderOpen,
  History,
  Play,
  PlusCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import {
  ClinicalSessionRecord,
  MasterClinicalDatabase,
  MasterPatient,
  SessionMilestoneType,
} from '../types/clinical';
import {
  ChartDurationUnit,
  QuantumGeometry,
  QuantumRoomSession,
  RoomPhase,
} from '../types/quantum';
import {
  computeChartEmissionMetrics,
  formatBirthDateBR,
  formatChartDurationLabel,
  getHawkinsLevelInfo,
} from '../utils/antiCatharsis';
import {
  BACKUP_RESTORED_EVENT,
  FollowUpLogEntry,
  exportClinicalBackupJson,
  getAnsaeDraftForSession,
  importClinicalBackupJson,
  loadClinicalDatabase,
  loadFollowUpLogs,
  matchesPatientFollowUpLog,
  roomToClinicalRecord,
  saveClinicalDatabase,
} from '../utils/storage';
import { PatientEvolutionChart } from './PatientEvolutionChart';
import {
  AcompanhamentoModal,
  FollowUpClinicalContext,
} from './AcompanhamentoModal';

interface DashboardProps {
  sessions: QuantumRoomSession[];
  onOpenTable: (sessionId: string) => void;
  onOpenDocuments: (sessionId: string) => void;
  onAdvancePhase: (sessionId: string, nextPhase: RoomPhase) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewConsultation: () => void;
  onResetDemos: () => void;
  onReevaluateSession?: (patient: MasterPatient, baseRecord: ClinicalSessionRecord) => void;
  onResumeTreatment?: (record: ClinicalSessionRecord) => void;
  onStartNewForPatient?: (patient: MasterPatient) => void;
  onWithdrawChartEmission?: (
    sessionId: string,
    stageTag: 'stage1' | 'stage2' | 'single',
    geometryName: string
  ) => void;
  onExtendChartEmission?: (
    sessionId: string,
    stageTag: 'stage1' | 'stage2' | 'single',
    geometryName: string,
    extension: {
      addValue?: number;
      addUnit?: ChartDurationUnit;
      customExpiresAt?: string;
    }
  ) => void;
  onRestoreBackup?: (rooms: QuantumRoomSession[]) => void;
}

function formatDurationClock(ms: number): {
  hours: number;
  minutes: number;
  seconds: number;
  days: number;
  formattedClock: string;
} {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hoursTotal = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const days = Math.floor(hoursTotal / 24) + 1;

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hours: hoursTotal,
    minutes,
    seconds,
    days,
    formattedClock: `${hoursTotal}h ${pad(minutes)}m ${pad(seconds)}s`,
  };
}

function formatDateBR(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

function nextMilestoneType(existingCount: number): SessionMilestoneType {
  if (existingCount === 0) return 'Avaliação Inicial';
  if (existingCount === 1) return 'Pós-Tratamento 1';
  if (existingCount === 2) return 'Pós-Tratamento 2';
  return 'Novo Ciclo';
}

export const Dashboard: React.FC<DashboardProps> = ({
  sessions,
  onOpenTable,
  onOpenDocuments,
  onAdvancePhase,
  onDeleteSession,
  onNewConsultation,
  onResetDemos,
  onReevaluateSession,
  onResumeTreatment,
  onStartNewForPatient,
  onWithdrawChartEmission,
  onExtendChartEmission,
  onRestoreBackup,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [activeTab, setActiveTab] = useState<'rooms' | 'history'>('rooms');
  const [filterMode, setFilterMode] = useState<'all' | 'transition' | 'stage2'>('all');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [clinicalDb, setClinicalDb] = useState<MasterClinicalDatabase>(() =>
    loadClinicalDatabase()
  );
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [extendingPlateKey, setExtendingPlateKey] = useState<string | null>(null);
  const [extendValue, setExtendValue] = useState<number>(24);
  const [extendUnit, setExtendUnit] = useState<ChartDurationUnit>('horas');
  const [followUpLogs, setFollowUpLogs] = useState<FollowUpLogEntry[]>(() =>
    loadFollowUpLogs()
  );
  const [followUpTarget, setFollowUpTarget] = useState<{
    patientId: string;
    patientName: string;
    patientPhone?: string;
    activeGraphics: string[];
    clinicalContext: FollowUpClinicalContext;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleBackupRestored = () => {
      setClinicalDb(loadClinicalDatabase());
      setFollowUpLogs(loadFollowUpLogs());
    };
    window.addEventListener(BACKUP_RESTORED_EVENT, handleBackupRestored);
    return () => {
      window.removeEventListener(BACKUP_RESTORED_EVENT, handleBackupRestored);
    };
  }, []);

  // Sync active rooms into MasterClinicalDatabase whenever sessions change
  useEffect(() => {
    const db = loadClinicalDatabase();
    let changed = false;
    const nextPatients = [...db.patients];
    const nextSessions = [...db.sessions];

    for (const room of sessions) {
      const patientId = room.anamnesis.id || `patient-${room.id}`;
      const existingPatientIdx = nextPatients.findIndex((p) => p.id === patientId);
      if (existingPatientIdx === -1 && room.anamnesis.fullName.trim()) {
        nextPatients.push({
          id: patientId,
          interagentType: room.anamnesis.interagentType,
          fullName: room.anamnesis.fullName,
          birthDate: room.anamnesis.birthDate,
          phone: room.anamnesis.phone,
          petSpecies: room.anamnesis.petSpecies,
          petBreed: room.anamnesis.petBreed,
          petAge: room.anamnesis.petAge,
          petEnvironment: room.anamnesis.petEnvironment,
          tutorName: room.anamnesis.tutorName,
          createdAt: room.activatedAt,
          notes: room.anamnesis.clinicalNotes,
        });
        changed = true;
      } else if (
        existingPatientIdx >= 0 &&
        room.anamnesis.interagentType &&
        nextPatients[existingPatientIdx].interagentType !== room.anamnesis.interagentType
      ) {
        nextPatients[existingPatientIdx] = {
          ...nextPatients[existingPatientIdx],
          interagentType: room.anamnesis.interagentType,
          petSpecies: room.anamnesis.petSpecies,
          petBreed: room.anamnesis.petBreed,
          petAge: room.anamnesis.petAge,
          petEnvironment: room.anamnesis.petEnvironment,
          tutorName: room.anamnesis.tutorName,
        };
        changed = true;
      }

      const existingRecordIdx = nextSessions.findIndex((s) => s.id === room.id);
      if (existingRecordIdx === -1) {
        nextSessions.push(roomToClinicalRecord(room));
        changed = true;
      } else {
        const currentRec = nextSessions[existingRecordIdx];
        const roomPerceptionScore =
          room.clientPerceptionScore ?? room.sensitivity.clientPerceptionScore;
        const roomPerceptionMoment =
          room.clientPerceptionMoment ?? room.sensitivity.clientPerceptionMoment;
        const roomPerceptionNote =
          room.clientPerceptionNote ?? room.sensitivity.clientPerceptionNote;

        if (
          currentRec.updatedAt !== room.updatedAt ||
          currentRec.phase !== room.phase ||
          currentRec.clientPerceptionScore !== roomPerceptionScore
        ) {
          const syncedHawkinsHz = room.sensitivity.hawkins;
          nextSessions[existingRecordIdx] = {
            ...currentRec,
            phase: room.phase,
            isAnchored: room.isAnchored,
            protocol: room.protocol,
            aiResult: room.aiResult,
            selectedSolfeggioHz: room.selectedSolfeggioHz,
            chartCrystals: room.chartCrystals,
            energeticRemedies: room.energeticRemedies || [],
            withdrawnEmissions:
              room.withdrawnEmissions || currentRec.withdrawnEmissions || [],
            clientPerceptionScore:
              roomPerceptionScore ?? currentRec.clientPerceptionScore,
            clientPerceptionMoment:
              roomPerceptionMoment ?? currentRec.clientPerceptionMoment,
            clientPerceptionNote:
              roomPerceptionNote ?? currentRec.clientPerceptionNote,
            ansaeRhen: {
              ...currentRec.ansaeRhen,
              auricField: {
                ...currentRec.ansaeRhen.auricField,
                protectionPercent: room.sensitivity.auricProtection,
              },
              spiritualPsycho: {
                ...currentRec.ansaeRhen.spiritualPsycho,
                bovis: room.sensitivity.bovis,
                hawkinsAgathaHz: syncedHawkinsHz,
                hawkinsHz: syncedHawkinsHz,
                stressLevel: room.sensitivity.stressLevel,
                clientPerceptionScore:
                  roomPerceptionScore ??
                  currentRec.ansaeRhen.spiritualPsycho.clientPerceptionScore,
                clientPerceptionMoment:
                  roomPerceptionMoment ??
                  currentRec.ansaeRhen.spiritualPsycho.clientPerceptionMoment,
                clientPerceptionNote:
                  roomPerceptionNote ??
                  currentRec.ansaeRhen.spiritualPsycho.clientPerceptionNote,
              },
            },
            updatedAt: room.updatedAt,
            completedAt: room.phase === 'completed' ? room.updatedAt : currentRec.completedAt,
          };
          changed = true;
        }
      }
    }

    if (changed) {
      const updatedDb: MasterClinicalDatabase = {
        ...db,
        patients: nextPatients,
        sessions: nextSessions,
      };
      saveClinicalDatabase(updatedDb);
      setClinicalDb(updatedDb);
    } else {
      setClinicalDb(db);
    }
  }, [sessions]);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const getRoomMetrics = (session: QuantumRoomSession) => {
    const startMs = new Date(session.activatedAt).getTime();
    const elapsedMs = Math.max(0, nowMs - startMs);
    const clock = formatDurationClock(elapsedMs);
    const elapsedHours = elapsedMs / (1000 * 3600);

    let stageLabel = '';
    let progressPercent = 0;
    let progressText = '';
    let transitionAlert: string | null = null;
    let nextActionLabel: string | null = null;
    let nextPhase: RoomPhase | null = null;

    if (session.phase === 'stage1') {
      const targetMaxHours = session.protocol.stage1?.maxHours || 72;
      const targetMinHours = session.protocol.stage1?.minHours || 48;
      stageLabel = 'Etapa 1: Desobstrução & Blindagem';
      progressPercent = Math.min(100, Math.round((elapsedHours / targetMaxHours) * 100));
      progressText = `${Math.min(targetMaxHours, Math.floor(elapsedHours))}h / ${targetMaxHours}h`;
      if (elapsedHours >= targetMinHours) {
        transitionAlert =
          elapsedHours >= targetMaxHours
            ? 'Ciclo de 72h concluído — Iniciar pausa obrigatória de 12h antes da Etapa 2.'
            : 'Janela de transição atingida (≥ 48h de assepsia) — Pronto para Intervalo de 12h e Etapa 2.';
      }
      nextActionLabel = 'Iniciar Intervalo 12h';
      nextPhase = 'rest';
    } else if (session.phase === 'rest') {
      stageLabel = 'Intervalo Fisiológico de Repouso';
      progressPercent = Math.min(100, Math.round((elapsedHours / 12) * 100));
      progressText = `${Math.min(12, elapsedHours).toFixed(1)}h / 12h`;
      if (elapsedHours >= 12) {
        transitionAlert = 'Pausa de 12h concluída — Campo apto para ativação da Etapa 2.';
      }
      nextActionLabel = 'Ativar Etapa 2';
      nextPhase = 'stage2';
    } else if (session.phase === 'stage2') {
      const totalDays = session.protocol.stage2?.totalDays || 10;
      const currentDay = Math.min(totalDays, clock.days);
      stageLabel = 'Etapa 2: Regeneração Celular & Alta Vitalidade';
      progressPercent = Math.min(100, Math.round((elapsedHours / (totalDays * 24)) * 100));
      progressText = `Dia ${currentDay} de ${totalDays}`;
      if (elapsedHours >= totalDays * 24) {
        transitionAlert = `Ciclo de ${totalDays} dias concluído — Realizar nova aferição de Bovis.`;
      }
      nextActionLabel = 'Concluir Ciclo';
      nextPhase = 'completed';
    } else if (session.phase === 'single') {
      const totalDays = session.protocol.singleStage?.totalDays || 10;
      const currentDay = Math.min(totalDays, clock.days);
      stageLabel = 'Etapa Única: Harmonização Direta & Vitalidade';
      progressPercent = Math.min(100, Math.round((elapsedHours / (totalDays * 24)) * 100));
      progressText = `Dia ${currentDay} de ${totalDays}`;
      if (elapsedHours >= totalDays * 24) {
        transitionAlert = `Ciclo direto de ${totalDays} dias concluído.`;
      }
      nextActionLabel = 'Concluir Ciclo';
      nextPhase = 'completed';
    } else {
      stageLabel = 'Ciclo Terapêutico Concluído';
      progressPercent = 100;
      progressText = 'Finalizado';
    }

    return {
      clock,
      stageLabel,
      progressPercent,
      progressText,
      transitionAlert,
      nextActionLabel,
      nextPhase,
    };
  };

  const roomsWithMetrics = sessions.map((s) => ({
    session: s,
    metrics: getRoomMetrics(s),
  }));

  const transitionCount = roomsWithMetrics.filter((r) => Boolean(r.metrics.transitionAlert)).length;
  const activeCount = sessions.filter((s) => s.phase !== 'completed').length;
  const stage2Count = sessions.filter((s) => s.phase === 'stage2' || s.phase === 'single').length;

  const filteredRooms = roomsWithMetrics.filter(({ session, metrics }) => {
    if (filterMode === 'transition') return Boolean(metrics.transitionAlert);
    if (filterMode === 'stage2') return session.phase === 'stage2' || session.phase === 'single';
    return true;
  });

  const activePlateEmissions = useMemo(() => {
    const items: Array<{
      key: string;
      session: QuantumRoomSession;
      stageTag: 'stage1' | 'stage2' | 'single';
      stageLabel: string;
      geometry: QuantumGeometry;
      metrics: ReturnType<typeof computeChartEmissionMetrics>;
    }> = [];

    for (const session of sessions) {
      const stages: Array<{
        tag: 'stage1' | 'stage2' | 'single';
        label: string;
        geos: QuantumGeometry[];
      }> = [
        {
          tag: 'stage1',
          label: 'Etapa 1 — Limpeza & Blindagem',
          geos: session.protocol.stage1?.geometries || [],
        },
        {
          tag: 'stage2',
          label: 'Etapa 2 — Regeneração & Vitalidade',
          geos: session.protocol.stage2?.geometries || [],
        },
        {
          tag: 'single',
          label: 'Etapa Única — Harmonização Direta',
          geos: session.protocol.singleStage?.geometries || [],
        },
      ];

      for (const st of stages) {
        for (const geo of st.geos) {
          const metrics = computeChartEmissionMetrics(geo, nowMs);
          if (metrics.hasTimer && metrics.status !== 'withdrawn') {
            items.push({
              key: `${session.id}::${st.tag}::${geo.name}`,
              session,
              stageTag: st.tag,
              stageLabel: st.label,
              geometry: geo,
              metrics,
            });
          }
        }
      }
    }

    const rank: Record<string, number> = {
      expired: 0,
      warning: 1,
      active: 2,
    };

    return items.sort((a, b) => {
      const ra = rank[a.metrics.status] ?? 3;
      const rb = rank[b.metrics.status] ?? 3;
      if (ra !== rb) return ra - rb;
      return a.metrics.remainingMs - b.metrics.remainingMs;
    });
  }, [nowMs, sessions]);

  const expiredPlatesCount = activePlateEmissions.filter(
    (p) => p.metrics.status === 'expired'
  ).length;
  const warningPlatesCount = activePlateEmissions.filter(
    (p) => p.metrics.status === 'warning'
  ).length;
  const healthyPlatesCount = activePlateEmissions.filter(
    (p) => p.metrics.status === 'active'
  ).length;

  const patientsWithHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return clinicalDb.patients
      .filter((p) => {
        if (!q) return true;
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q)
        );
      })
      .map((patient) => {
        const patientSessions = clinicalDb.sessions
          .filter((s) => s.patientId === patient.id)
          .sort(
            (a, b) =>
              new Date(a.activatedAt).getTime() - new Date(b.activatedAt).getTime()
          );
        const firstSession = patientSessions[0] || null;
        const latestSession = patientSessions[patientSessions.length - 1] || null;
        return {
          patient,
          sessions: patientSessions,
          firstSession,
          latestSession,
        };
      });
  }, [clinicalDb, historySearch]);

  const handleExportBackup = () => {
    try {
      const jsonStr = exportClinicalBackupJson();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const dateStr = new Date().toISOString().slice(0, 10);
      saveAs(blob, `Maestro_Quantico_Backup_${dateStr}.json`);
      showNotice('success', 'Backup completo (.json) exportado com sucesso.');
    } catch {
      showNotice('error', 'Não foi possível gerar o arquivo de backup.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const { db, rooms } = importClinicalBackupJson(raw);
      setClinicalDb(db);
      if (onRestoreBackup) {
        onRestoreBackup(rooms);
      }
      showNotice(
        'success',
        `Backup restaurado: ${db.patients.length} paciente(s) e ${db.sessions.length} sessão(ões).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao importar arquivo JSON.';
      showNotice('error', msg);
    } finally {
      e.target.value = '';
    }
  };

  const handleReevaluateClick = (
    patient: MasterPatient,
    baseRecord: ClinicalSessionRecord,
    existingCount: number
  ) => {
    if (onReevaluateSession) {
      onReevaluateSession(patient, baseRecord);
      return;
    }

    const milestone = nextMilestoneType(existingCount);
    const nowIso = new Date().toISOString();
    const clonedRecord: ClinicalSessionRecord = {
      ...baseRecord,
      id: `room-reeval-${Date.now()}`,
      sessionType: milestone,
      phase: 'stage1',
      isAnchored: false,
      activatedAt: nowIso,
      completedAt: undefined,
      updatedAt: nowIso,
    };

    const nextDb: MasterClinicalDatabase = {
      ...clinicalDb,
      sessions: [clonedRecord, ...clinicalDb.sessions],
    };
    saveClinicalDatabase(nextDb);
    setClinicalDb(nextDb);

    const activeRoom = sessions.find((s) => s.anamnesis.id === patient.id);
    if (activeRoom) {
      onOpenTable(activeRoom.id);
    }
    showNotice(
      'success',
      `Reavaliação "${milestone}" registrada para ${patient.fullName}.`
    );
  };

  const handleResumeClick = (record: ClinicalSessionRecord) => {
    if (onResumeTreatment) {
      onResumeTreatment(record);
      return;
    }

    const matchingRoom = sessions.find((s) => s.id === record.id);
    if (matchingRoom) {
      if (matchingRoom.phase === 'completed') {
        onAdvancePhase(matchingRoom.id, 'stage2');
      }
      onOpenTable(matchingRoom.id);
      return;
    }

    const nextDb: MasterClinicalDatabase = {
      ...clinicalDb,
      sessions: clinicalDb.sessions.map((s) =>
        s.id === record.id
          ? {
              ...s,
              phase: s.phase === 'completed' ? 'stage2' : s.phase,
              updatedAt: new Date().toISOString(),
            }
          : s
      ),
    };
    saveClinicalDatabase(nextDb);
    setClinicalDb(nextDb);
    showNotice('success', `Tratamento retomado no prontuário (${record.sessionType}).`);
  };

  const handleStartNewForPatientClick = (patient: MasterPatient) => {
    if (onStartNewForPatient) {
      onStartNewForPatient(patient);
      return;
    }
    onNewConsultation();
  };

  const countLogsForPatient = (patientId: string, patientName: string): number => {
    return followUpLogs.filter((entry) =>
      matchesPatientFollowUpLog(entry, patientId, patientName)
    ).length;
  };

  const collectActiveGraphicsFromRoom = (room: QuantumRoomSession): string[] => {
    const geos =
      room.phase === 'stage1'
        ? room.protocol.stage1?.geometries || []
        : room.phase === 'stage2'
        ? room.protocol.stage2?.geometries || []
        : room.phase === 'rest'
        ? [
            ...(room.protocol.stage1?.geometries || []),
            ...(room.protocol.stage2?.geometries || []),
          ]
        : room.protocol.singleStage?.geometries || [];

    const geoNames = geos.map((g) => g.name).filter(Boolean);
    const remedyNames = (room.energeticRemedies || [])
      .filter((r) => r.isActive)
      .map((r) => `${r.emitterGraph} (${r.items.join(' + ')})`);

    return Array.from(new Set([...geoNames, ...remedyNames]));
  };

  const openFollowUpFromRoom = (room: QuantumRoomSession) => {
    const patientId = room.anamnesis.id || `patient-${room.id}`;
    const patientName = room.anamnesis.fullName || 'Consulente';
    const ansaeSheet = getAnsaeDraftForSession(room);
    const activeGraphics = collectActiveGraphicsFromRoom(room);
    const metrics = getRoomMetrics(room);

    const imbalancedChakras = ansaeSheet.chakras
      .filter((c) => c.status !== 'Normal' || c.imbalancePercent >= 25)
      .map((c) => `${c.name} (${c.status}, ${c.imbalancePercent}%)`);

    const criticalOrgans = ansaeSheet.organs
      .filter((o) => o.isImbalanced)
      .slice(0, 8)
      .map((o) => `${o.organName} (${o.imbalancePercent}%)`);

    setFollowUpTarget({
      patientId,
      patientName,
      patientPhone: room.anamnesis.phone,
      activeGraphics,
      clinicalContext: {
        bovis: room.sensitivity.bovis,
        hawkinsLabel: getHawkinsLevelInfo(room.sensitivity.hawkins).fullLabel,
        auricProtection: room.sensitivity.auricProtection,
        stressLevel: room.sensitivity.stressLevel,
        therapeuticFocus: room.anamnesis.therapeuticFocus,
        emotionalHistory: room.anamnesis.emotionalHistory,
        imbalancedChakras,
        criticalOrgans,
        phaseLabel: metrics.stageLabel,
        interagentType: room.anamnesis.interagentType,
        petSpecies: room.anamnesis.petSpecies,
        tutorName: room.anamnesis.tutorName,
      },
    });
  };

  const openFollowUpFromPatient = (
    patient: MasterPatient,
    latestSession: ClinicalSessionRecord | null
  ) => {
    const matchingRoom =
      sessions.find(
        (s) =>
          s.anamnesis.id === patient.id ||
          (latestSession && s.id === latestSession.id)
      ) || null;

    if (matchingRoom) {
      openFollowUpFromRoom(matchingRoom);
      return;
    }

    const activeGraphics: string[] = [];
    if (latestSession) {
      const geos =
        latestSession.phase === 'stage1'
          ? latestSession.protocol.stage1?.geometries || []
          : latestSession.phase === 'stage2'
          ? latestSession.protocol.stage2?.geometries || []
          : latestSession.protocol.singleStage?.geometries || [];
      geos.forEach((g) => {
        if (g.name) activeGraphics.push(g.name);
      });
      (latestSession.energeticRemedies || [])
        .filter((r) => r.isActive)
        .forEach((r) =>
          activeGraphics.push(`${r.emitterGraph} (${r.items.join(' + ')})`)
        );
    }

    const ansae = latestSession?.ansaeRhen;
    const imbalancedChakras = ansae
      ? ansae.chakras
          .filter((c) => c.status !== 'Normal' || c.imbalancePercent >= 25)
          .map((c) => `${c.name} (${c.status}, ${c.imbalancePercent}%)`)
      : [];
    const criticalOrgans = ansae
      ? ansae.organs
          .filter((o) => o.isImbalanced)
          .slice(0, 8)
          .map((o) => `${o.organName} (${o.imbalancePercent}%)`)
      : [];

    setFollowUpTarget({
      patientId: patient.id,
      patientName: patient.fullName,
      patientPhone: patient.phone,
      activeGraphics: Array.from(new Set(activeGraphics)),
      clinicalContext: {
        bovis: ansae?.spiritualPsycho.bovis,
        hawkinsLabel: ansae
          ? getHawkinsLevelInfo(ansae.spiritualPsycho.hawkinsAgathaHz).fullLabel
          : undefined,
        auricProtection: ansae?.auricField.protectionPercent,
        stressLevel: ansae?.spiritualPsycho.stressLevel,
        therapeuticFocus: latestSession?.therapeuticFocus,
        emotionalHistory: latestSession?.emotionalHistory,
        imbalancedChakras,
        criticalOrgans,
        phaseLabel:
          latestSession?.phase === 'completed'
            ? 'Ciclo Concluído (Pós-Atendimento)'
            : latestSession?.sessionType || 'Prontuário Mestre',
        interagentType: patient.interagentType,
        petSpecies: patient.petSpecies,
        tutorName: patient.tutorName,
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Editorial Hero Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E2E8F0] pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
            Maestro Terapias Vibracionais · Giovani Caetano
          </p>
          <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-light text-[#0F172A] tracking-tight">
            {activeTab === 'rooms'
              ? 'Central de Salas Quânticas Ativas'
              : 'Prontuários & Histórico Concluído'}
          </h1>
          <p className="mt-2 text-sm text-[#45464D] max-w-2xl leading-relaxed">
            {activeTab === 'rooms'
              ? 'Monitoramento contínuo das ondas escalares em ressonância, cronômetro clínico em tempo real e alertas automáticos para janelas de transição do Protocolo Anti-Catarse.'
              : 'Cadastro mestre de pacientes, histórico comparativo Antes × Depois (ANSAE + RHEN), reavaliações pós-tratamento e backup completo em JSON.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onResetDemos}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Casos Demo
          </button>
          <button
            type="button"
            onClick={onNewConsultation}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] hover:shadow-[0_0_16px_rgba(217,119,6,0.25)] transition-all cursor-pointer whitespace-nowrap"
          >
            + Novo Atendimento Quântico
            <ArrowRight className="w-4 h-4 text-[#F59E0B]" />
          </button>
        </div>
      </section>

      {/* Primary View Tabs: Salas Ativas vs Prontuários & Histórico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Alternar visão do painel clínico"
          className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rooms'}
            onClick={() => setActiveTab('rooms')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'rooms'
                ? 'bg-[#0F172A] text-white'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-[#F59E0B]" />
            Salas Ativas ({sessions.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-[#0F172A] text-white'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#F59E0B]" />
            Prontuários & Histórico Concluído ({clinicalDb.patients.length})
          </button>
        </div>

        {statusMessage && (
          <div
            className={`text-xs font-medium px-3.5 py-2 rounded-lg border ${
              statusMessage.type === 'success'
                ? 'bg-white border-[#D97706]/50 text-[#0F172A]'
                : 'bg-[#BA1A1A]/10 border-[#BA1A1A]/30 text-[#BA1A1A]'
            }`}
          >
            {statusMessage.text}
          </div>
        )}
      </div>

      {activeTab === 'rooms' ? (
        <>
          {/* 3-Column KPI Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-medium text-[#64748B]">Salas em Emissão Contínua</p>
              <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-[#0F172A]">
                {activeCount}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Persistência local ativa · Sincronia 24h
              </p>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-medium text-[#64748B]">Em Janela de Transição</p>
              <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-[#B45309]">
                {transitionCount}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Prontos para pausa de 12h ou Etapa 2
              </p>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]">
              <p className="text-xs font-medium text-[#64748B]">Em Regeneração & Vitalidade</p>
              <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-[#0F172A]">
                {stage2Count}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Etapa 2 ou Harmonização Direta
              </p>
            </div>
          </section>

          {/* Monitor de Placas & Emissões Ativas */}
          <section className="bg-white border border-[#D97706]/40 rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
              <div className="flex items-start gap-3">
                <Timer className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#0F172A]">
                    Monitor de Placas & Emissões Ativas
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Controle em tempo real dos prazos de exposição sobre os gráficos radiônicos,
                    com semáforo de saturação e registro de retirada no prontuário.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                <span className="inline-flex items-center gap-1.5 text-[#166534] font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                  {healthyPlatesCount} Em emissão
                </span>
                <span aria-hidden="true" className="text-[#CBD5E1]">
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#92400E] font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                  {warningPlatesCount} Aviso prévio
                </span>
                <span aria-hidden="true" className="text-[#CBD5E1]">
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#991B1B] font-semibold">
                  <span
                    className={`w-2.5 h-2.5 rounded-full bg-[#DC2626] ${
                      expiredPlatesCount > 0 ? 'animate-pulse' : ''
                    }`}
                  />
                  {expiredPlatesCount} Vencida{expiredPlatesCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {activePlateEmissions.length === 0 ? (
              <div className="p-5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] text-center space-y-1">
                <p className="text-sm font-medium text-[#0F172A]">
                  Nenhuma placa radiônica com cronômetro ativo no momento.
                </p>
                <p className="text-xs text-[#64748B]">
                  Abra a Mesa Quântica de qualquer consulente e clique em{' '}
                  <strong>&ldquo;Ativar Cronômetro na Mesa&rdquo;</strong> no gráfico desejado para
                  monitorar a contagem regressiva e alertas de retirada aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activePlateEmissions.map(
                  ({ key, session, stageTag, stageLabel, geometry, metrics }) => {
                    const isExtending = extendingPlateKey === key;
                    const cardTone =
                      metrics.status === 'expired'
                        ? 'border-[#DC2626]/50 bg-[#FEF2F2]/60'
                        : metrics.status === 'warning'
                        ? 'border-[#D97706]/50 bg-[#FFFBEB]/70'
                        : 'border-[#E2E8F0] bg-[#FAF8F5]';

                    const dotTone =
                      metrics.status === 'expired'
                        ? 'bg-[#DC2626] animate-pulse'
                        : metrics.status === 'warning'
                        ? 'bg-[#D97706]'
                        : 'bg-[#16A34A]';

                    const labelTone =
                      metrics.status === 'expired'
                        ? 'text-[#991B1B]'
                        : metrics.status === 'warning'
                        ? 'text-[#92400E]'
                        : 'text-[#166534]';

                    const barTone =
                      metrics.status === 'expired'
                        ? 'bg-[#DC2626]'
                        : metrics.status === 'warning'
                        ? 'bg-[#D97706]'
                        : 'bg-[#16A34A]';

                    return (
                      <div
                        key={key}
                        className={`p-4 rounded-xl border space-y-3 transition-colors ${cardTone}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold text-[#B45309]">
                              {session.anamnesis.fullName || 'Consulente'} · {stageLabel}
                            </p>
                            <h3 className="font-serif text-base font-bold text-[#0F172A] mt-0.5">
                              {geometry.name}
                            </h3>
                            <p className="text-[11px] text-[#64748B] font-mono tabular-nums mt-0.5">
                              Prazo: {formatChartDurationLabel(geometry.durationValue, geometry.durationUnit)}{' '}
                              · Retirada prevista:{' '}
                              {geometry.expiresAt
                                ? new Date(geometry.expiresAt).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </p>
                          </div>

                          <span className="font-mono tabular-nums text-sm font-bold text-[#0F172A] shrink-0">
                            {metrics.countdownText}
                          </span>
                        </div>

                        {/* Semáforo de Saturação & Barra Temporal */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className={`inline-flex items-center gap-1.5 font-semibold ${labelTone}`}>
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotTone}`} />
                              {metrics.statusLabel}
                            </span>
                            <span className="font-mono tabular-nums text-[11px] text-[#45464D]">
                              {metrics.progressPercent}% decorrido
                            </span>
                          </div>
                          <div className="h-2 w-full bg-white border border-[#E2E8F0] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barTone}`}
                              style={{ width: `${metrics.progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Ações Diretas */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {onWithdrawChartEmission && (
                              <button
                                type="button"
                                onClick={() => {
                                  onWithdrawChartEmission(session.id, stageTag, geometry.name);
                                  showNotice(
                                    'success',
                                    `Retirada de "${geometry.name}" registrada no histórico de ${session.anamnesis.fullName}.`
                                  );
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                                Registrar Retirada & Concluir
                              </button>
                            )}

                            {onExtendChartEmission && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExtendingPlateKey(isExtending ? null : key)
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] cursor-pointer whitespace-nowrap"
                              >
                                <CalendarPlus className="w-3.5 h-3.5 text-[#B45309]" />
                                Prorrogar Prazo
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onOpenTable(session.id)}
                            className="text-[11px] font-semibold text-[#B45309] hover:underline cursor-pointer"
                          >
                            Abrir Mesa →
                          </button>
                        </div>

                        {isExtending && onExtendChartEmission && (
                          <div className="p-3 rounded-lg bg-white border border-[#D97706]/40 space-y-2.5">
                            <p className="text-[11px] font-semibold text-[#0F172A]">
                              Prorrogar exposição da placa {geometry.name}:
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {[
                                { label: '+12h', v: 12, u: 'horas' as const },
                                { label: '+24h', v: 24, u: 'horas' as const },
                                { label: '+48h', v: 48, u: 'horas' as const },
                                { label: '+7 dias', v: 7, u: 'dias' as const },
                              ].map((q) => (
                                <button
                                  key={q.label}
                                  type="button"
                                  onClick={() => {
                                    onExtendChartEmission(session.id, stageTag, geometry.name, {
                                      addValue: q.v,
                                      addUnit: q.u,
                                    });
                                    setExtendingPlateKey(null);
                                    showNotice(
                                      'success',
                                      `Prazo de "${geometry.name}" prorrogado em ${q.label}.`
                                    );
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-mono font-semibold bg-[#FAF8F5] border border-[#CBD5E1] rounded hover:border-[#D97706] cursor-pointer text-[#0F172A]"
                                >
                                  {q.label}
                                </button>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E2E8F0]">
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={extendValue}
                                onChange={(e) =>
                                  setExtendValue(Math.max(1, Number(e.target.value) || 1))
                                }
                                aria-label="Quantidade adicional"
                                className="w-16 px-2 py-1 text-xs font-mono bg-[#FAF8F5] border border-[#CBD5E1] rounded text-[#0F172A]"
                              />
                              <select
                                value={extendUnit}
                                onChange={(e) =>
                                  setExtendUnit(e.target.value as ChartDurationUnit)
                                }
                                aria-label="Unidade adicional"
                                className="px-2 py-1 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded text-[#0F172A]"
                              >
                                <option value="minutos">Minutos</option>
                                <option value="horas">Horas</option>
                                <option value="dias">Dias</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  onExtendChartEmission(session.id, stageTag, geometry.name, {
                                    addValue: extendValue,
                                    addUnit: extendUnit,
                                  });
                                  setExtendingPlateKey(null);
                                  showNotice(
                                    'success',
                                    `Prazo de "${geometry.name}" prorrogado (+${extendValue} ${extendUnit}).`
                                  );
                                }}
                                className="px-3 py-1 text-[11px] font-semibold text-white bg-[#0F172A] rounded hover:bg-[#1E293B] cursor-pointer"
                              >
                                Aplicar Prorrogação
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          {/* Segmented Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Filtrar Salas Quânticas"
              className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-lg"
            >
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  filterMode === 'all'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Todas ({sessions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('transition')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  filterMode === 'transition'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Alerta de Transição ({transitionCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('stage2')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  filterMode === 'stage2'
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Regeneração ({stage2Count})
              </button>
            </div>
          </div>

          {/* Quantum Room Cards */}
          {filteredRooms.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center">
              <p className="font-serif text-lg text-[#0F172A]">
                Nenhuma Sala Quântica encontrada neste filtro.
              </p>
              <p className="mt-1 text-sm text-[#64748B]">
                Inicie um novo atendimento ou altere o filtro para visualizar todas as salas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredRooms.map(({ session, metrics }) => {
                const hawkinsInfo = getHawkinsLevelInfo(session.sensitivity.hawkins);
                const activeGeometries =
                  session.phase === 'stage1'
                    ? session.protocol.stage1?.geometries || []
                    : session.phase === 'stage2'
                    ? session.protocol.stage2?.geometries || []
                    : session.protocol.singleStage?.geometries || [];
                const activeRemedies = (session.energeticRemedies || []).filter((r) => r.isActive);

                return (
                  <article
                    key={session.id}
                    className="relative overflow-hidden bg-white border border-[#E2E8F0] rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between"
                  >
                    <div
                      aria-hidden="true"
                      className="h-[2px] w-full"
                      style={{
                        background: 'linear-gradient(90deg, #D97706 0%, transparent 100%)',
                      }}
                    />

                    <div className="p-6 space-y-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                            <span className="font-semibold text-[#B45309]">{metrics.stageLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>Nasc. {formatBirthDateBR(session.anamnesis.birthDate)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{session.selectedSolfeggioHz} Hz</span>
                          </div>
                          <h2 className="mt-1.5 font-serif text-xl font-bold text-[#0F172A]">
                            {session.anamnesis.fullName}
                          </h2>
                          <p className="mt-1 text-sm text-[#45464D]">
                            {session.anamnesis.therapeuticFocus}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteSession(session.id)}
                          title="Remover sala do painel"
                          aria-label={`Remover sala de ${session.anamnesis.fullName}`}
                          className="p-2 text-[#94A3B8] hover:text-[#BA1A1A] rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {metrics.transitionAlert && (
                        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#D97706]/8 border border-[#D97706]/30 text-xs text-[#663500]">
                          <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <span className="font-semibold text-[#0F172A]">Alerta de Janela Clínica: </span>
                            {metrics.transitionAlert}
                          </div>
                        </div>
                      )}

                      {/* Real-time Chronometer & Stage Progress */}
                      <div className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 text-xs font-medium text-[#45464D]">
                            <Clock className="w-4 h-4 text-[#B45309]" />
                            <span>Tempo em Ressonância</span>
                          </div>
                          <span className="font-mono tabular-nums text-base font-semibold text-[#0F172A]">
                            {metrics.clock.formattedClock}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#64748B]">Progresso da Etapa</span>
                            <span className="font-mono tabular-nums font-semibold text-[#B45309]">
                              {metrics.progressText} ({metrics.progressPercent}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#D97706] rounded-full transition-all duration-300"
                              style={{ width: `${metrics.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Telemetry Grid */}
                      <div className="grid grid-cols-3 gap-4 pt-1 border-t border-[#E2E8F0]/70">
                        <div>
                          <p className="text-[11px] text-[#64748B]">Biômetro Bovis</p>
                          <p className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-[#0F172A]">
                            {session.sensitivity.bovis.toLocaleString('pt-BR')} Å
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[#64748B]">Hawkins</p>
                          <p className="mt-0.5 font-mono tabular-nums text-xs sm:text-sm font-semibold text-[#0F172A]">
                            {hawkinsInfo.fullLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-[#64748B]">Proteção Áurica</p>
                          <p className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-[#0F172A]">
                            {session.sensitivity.auricProtection}%
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-[#45464D]">
                        <span className="font-semibold text-[#0F172A]">Geometrias ativas: </span>
                        {activeGeometries.length > 0
                          ? activeGeometries.map((g) => g.name).join(' · ')
                          : 'Repouso fisiológico (sem emissão ativa)'}
                      </div>

                      {activeRemedies.length > 0 && (
                        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0F172A]/[0.03] border border-[#B45309]/30 text-xs">
                          <FlaskConical className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0F172A] tabular-nums">
                              {activeRemedies.length} Medicamento{activeRemedies.length === 1 ? '' : 's'}{' '}
                              Energético{activeRemedies.length === 1 ? '' : 's'} em transmissão paralela
                            </p>
                            <p className="text-[11px] text-[#64748B] truncate">
                              {activeRemedies
                                .map((r) => `${r.items.join(' + ')} (${r.emitterGraph})`)
                                .join(' · ')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Footer */}
                    <div className="px-6 py-4 bg-[#FAF8F5] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenTable(session.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] hover:text-[#B45309] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          Abrir Mesa
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDocuments(session.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] hover:text-[#B45309] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Documentos
                        </button>
                        <button
                          type="button"
                          onClick={() => openFollowUpFromRoom(session)}
                          title="Diário de Acompanhamento & Sonhos (IA)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#D97706]/50 rounded-lg hover:bg-[#D97706]/10 hover:border-[#D97706] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#B45309]" />
                          Diário &amp; Sonhos (IA)
                          <span className="font-mono tabular-nums text-[11px] text-[#B45309]">
                            ({countLogsForPatient(
                              session.anamnesis.id || `patient-${session.id}`,
                              session.anamnesis.fullName
                            )})
                          </span>
                        </button>
                      </div>

                      {metrics.nextActionLabel && metrics.nextPhase && (
                        <button
                          type="button"
                          onClick={() => onAdvancePhase(session.id, metrics.nextPhase!)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Activity className="w-3.5 h-3.5 text-[#F59E0B]" />
                          {metrics.nextActionLabel}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Prontuários & Histórico Concluído View */
        <section className="space-y-6">
          {/* Toolbar: Search & Backup Export/Import */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar paciente por nome ou telefone..."
                className="w-full pl-10 pr-3.5 py-2 text-xs bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#B45309]" />
                Exportar Backup (.json)
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
                aria-label="Selecionar arquivo JSON de backup clínico"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-[#F59E0B]" />
                Importar Backup (.json)
              </button>
            </div>
          </div>

          {/* Patient Master Records */}
          {patientsWithHistory.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center">
              <p className="font-serif text-lg text-[#0F172A]">
                Nenhum prontuário encontrado para esta busca.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {patientsWithHistory.map(({ patient, sessions: pSessions, firstSession, latestSession }) => {
                const hasComparison =
                  pSessions.length >= 2 && firstSession && latestSession && firstSession.id !== latestSession.id;

                const bovisDelta = hasComparison
                  ? latestSession.ansaeRhen.spiritualPsycho.bovis -
                    firstSession.ansaeRhen.spiritualPsycho.bovis
                  : 0;
                const hawkinsDelta = hasComparison
                  ? latestSession.ansaeRhen.spiritualPsycho.hawkinsAgathaHz -
                    firstSession.ansaeRhen.spiritualPsycho.hawkinsAgathaHz
                  : 0;
                const auraDelta = hasComparison
                  ? latestSession.ansaeRhen.auricField.protectionPercent -
                    firstSession.ansaeRhen.auricField.protectionPercent
                  : 0;
                const stressDelta = hasComparison
                  ? latestSession.ansaeRhen.spiritualPsycho.stressLevel -
                    firstSession.ansaeRhen.spiritualPsycho.stressLevel
                  : 0;
                const firstPerception =
                  firstSession?.clientPerceptionScore ??
                  firstSession?.ansaeRhen.spiritualPsycho.clientPerceptionScore;
                const latestPerception =
                  latestSession?.clientPerceptionScore ??
                  latestSession?.ansaeRhen.spiritualPsycho.clientPerceptionScore;
                const hasPerceptionDelta =
                  hasComparison &&
                  typeof firstPerception === 'number' &&
                  typeof latestPerception === 'number';
                const perceptionDelta = hasPerceptionDelta
                  ? latestPerception - firstPerception
                  : 0;

                return (
                  <article
                    key={patient.id}
                    className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] overflow-hidden"
                  >
                    <div className="p-6 border-b border-[#E2E8F0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                          <span className="font-semibold text-[#B45309]">Prontuário Mestre</span>
                          <span aria-hidden="true">·</span>
                          <span>Nasc. {formatBirthDateBR(patient.birthDate)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{patient.phone || 'Sem telefone'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-[#0F172A]">
                            {pSessions.length} sessão(ões)
                          </span>
                        </div>
                        <h2 className="mt-1.5 font-serif text-2xl font-bold text-[#0F172A]">
                          {patient.fullName}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openFollowUpFromPatient(patient, latestSession)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#D97706]/50 rounded-lg hover:bg-[#D97706]/10 cursor-pointer whitespace-nowrap"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#B45309]" />
                          Diário de Acompanhamento &amp; Sonhos (IA)
                          <span className="font-mono tabular-nums text-[11px] text-[#B45309]">
                            ({countLogsForPatient(patient.id, patient.fullName)})
                          </span>
                        </button>
                        {latestSession && (
                          <button
                            type="button"
                            onClick={() =>
                              handleReevaluateClick(patient, latestSession, pSessions.length)
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#D97706]/50 rounded-lg hover:bg-[#D97706]/10 cursor-pointer whitespace-nowrap"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-[#B45309]" />
                            Reavaliar (Pós-Tratamento)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartNewForPatientClick(patient)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] cursor-pointer whitespace-nowrap"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
                          Iniciar Novo Atendimento
                        </button>
                      </div>
                    </div>

                    {/* Antes × Depois Comparison Panel */}
                    {hasComparison && firstSession && latestSession && (
                      <div className="px-6 py-4 bg-[#FAF8F5] border-b border-[#E2E8F0] space-y-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[#B45309]" />
                          <p className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                            Comparativo Evolutivo: Antes ({firstSession.sessionType}) × Depois ({latestSession.sessionType})
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                          <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                            <p className="text-[11px] text-[#64748B]">Biômetro Bovis</p>
                            <p className="mt-1 font-mono tabular-nums text-xs text-[#45464D]">
                              {firstSession.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} →{' '}
                              <strong className="text-sm text-[#0F172A]">
                                {latestSession.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å
                              </strong>
                            </p>
                            <p
                              className={`mt-0.5 font-mono text-[11px] font-semibold ${
                                bovisDelta >= 0 ? 'text-[#B45309]' : 'text-[#BA1A1A]'
                              }`}
                            >
                              {bovisDelta >= 0 ? `+${bovisDelta.toLocaleString('pt-BR')}` : bovisDelta.toLocaleString('pt-BR')} Å
                            </p>
                          </div>

                          <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                            <p className="text-[11px] text-[#64748B]">Hawkins / Ágatha</p>
                            <p className="mt-1 font-mono tabular-nums text-xs text-[#45464D]">
                              {
                                getHawkinsLevelInfo(
                                  firstSession.ansaeRhen.spiritualPsycho.hawkinsAgathaHz
                                ).label
                              }{' '}
                              ({firstSession.ansaeRhen.spiritualPsycho.hawkinsAgathaHz} Hz) →{' '}
                              <strong className="text-xs sm:text-sm text-[#0F172A]">
                                {
                                  getHawkinsLevelInfo(
                                    latestSession.ansaeRhen.spiritualPsycho.hawkinsAgathaHz
                                  ).fullLabel
                                }
                              </strong>
                            </p>
                            <p
                              className={`mt-0.5 font-mono text-[11px] font-semibold ${
                                hawkinsDelta >= 0 ? 'text-[#B45309]' : 'text-[#BA1A1A]'
                              }`}
                            >
                              {hawkinsDelta >= 0 ? `+${hawkinsDelta}` : hawkinsDelta} Hz
                            </p>
                          </div>

                          <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                            <p className="text-[11px] text-[#64748B]">Proteção Áurica</p>
                            <p className="mt-1 font-mono tabular-nums text-xs text-[#45464D]">
                              {firstSession.ansaeRhen.auricField.protectionPercent}% →{' '}
                              <strong className="text-sm text-[#0F172A]">
                                {latestSession.ansaeRhen.auricField.protectionPercent}%
                              </strong>
                            </p>
                            <p
                              className={`mt-0.5 font-mono text-[11px] font-semibold ${
                                auraDelta >= 0 ? 'text-[#B45309]' : 'text-[#BA1A1A]'
                              }`}
                            >
                              {auraDelta >= 0 ? `+${auraDelta}` : auraDelta}%
                            </p>
                          </div>

                          <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                            <p className="text-[11px] text-[#64748B]">Estresse Neural (0–9)</p>
                            <p className="mt-1 font-mono tabular-nums text-xs text-[#45464D]">
                              {firstSession.ansaeRhen.spiritualPsycho.stressLevel} →{' '}
                              <strong className="text-sm text-[#0F172A]">
                                {latestSession.ansaeRhen.spiritualPsycho.stressLevel} / 9
                              </strong>
                            </p>
                            <p
                              className={`mt-0.5 font-mono text-[11px] font-semibold ${
                                stressDelta <= 0 ? 'text-[#B45309]' : 'text-[#BA1A1A]'
                              }`}
                            >
                              {stressDelta > 0 ? `+${stressDelta}` : stressDelta} nível
                            </p>
                          </div>

                          <div className="bg-white border border-[#E2E8F0] rounded-lg p-3">
                            <p className="text-[11px] text-[#64748B]">Percepção Consulente</p>
                            <p className="mt-1 font-mono tabular-nums text-xs text-[#45464D]">
                              {typeof firstPerception === 'number' ? `${firstPerception}` : '—'} →{' '}
                              <strong className="text-sm text-[#0F172A]">
                                {typeof latestPerception === 'number'
                                  ? `${latestPerception} / 10`
                                  : '—'}
                              </strong>
                            </p>
                            <p
                              className={`mt-0.5 font-mono text-[11px] font-semibold ${
                                hasPerceptionDelta
                                  ? perceptionDelta >= 0
                                    ? 'text-[#16A34A]'
                                    : 'text-[#BA1A1A]'
                                  : 'text-[#64748B]'
                              }`}
                            >
                              {hasPerceptionDelta
                                ? `${perceptionDelta > 0 ? `+${perceptionDelta}` : perceptionDelta} pts`
                                : 'Sem comparativo'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Linha do Tempo Evolutiva Visual (SVG) */}
                    {pSessions.length > 0 && (
                      <PatientEvolutionChart sessions={pSessions} />
                    )}

                    {/* Sessions Timeline */}
                    <div className="p-6 space-y-3">
                      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                        Linha do Tempo de Atendimentos & Ciclos
                      </p>
                      <div className="space-y-2.5">
                        {pSessions.map((rec) => {
                          const isLinkedToRoom = sessions.some((s) => s.id === rec.id);
                          const recPerception =
                            rec.clientPerceptionScore ??
                            rec.ansaeRhen.spiritualPsycho.clientPerceptionScore;
                          const recPerceptionNote =
                            rec.clientPerceptionNote ??
                            rec.ansaeRhen.spiritualPsycho.clientPerceptionNote;
                          return (
                            <div
                              key={rec.id}
                              className="p-4 rounded-xl border border-[#E2E8F0] bg-[#FAF8F5] flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-bold text-[#0F172A]">
                                    {rec.sessionType}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-[#64748B]">
                                    Início: {formatDateBR(rec.activatedAt)}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono text-[#B45309] font-semibold">
                                    {rec.phase === 'completed' ? 'Concluído' : 'Em andamento'}
                                  </span>
                                </div>
                                <p className="text-xs text-[#45464D]">{rec.therapeuticFocus}</p>
                                <p className="text-[11px] font-mono text-[#64748B]">
                                  Bovis {rec.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å ·{' '}
                                  Hawkins{' '}
                                  {
                                    getHawkinsLevelInfo(
                                      rec.ansaeRhen.spiritualPsycho.hawkinsAgathaHz
                                    ).fullLabel
                                  }{' '}
                                  · Aura {rec.ansaeRhen.auricField.protectionPercent}% · Estresse{' '}
                                  {rec.ansaeRhen.spiritualPsycho.stressLevel}/9
                                  {typeof recPerception === 'number'
                                    ? ` · Percepção ${recPerception}/10`
                                    : ''}
                                </p>
                                {recPerceptionNote && recPerceptionNote.trim() !== '' && (
                                  <p className="text-[11px] text-[#45464D] italic">
                                    Relato: &ldquo;{recPerceptionNote}&rdquo;
                                  </p>
                                )}
                                {rec.withdrawnEmissions && rec.withdrawnEmissions.length > 0 && (
                                  <div className="pt-1.5 space-y-1">
                                    <p className="text-[11px] font-semibold text-[#166534]">
                                      Placas retiradas / concluídas ({rec.withdrawnEmissions.length}):
                                    </p>
                                    <ul className="text-[11px] text-[#45464D] space-y-0.5 font-mono">
                                      {rec.withdrawnEmissions.map((w) => (
                                        <li key={w.id}>
                                          • {w.geometryName} ({w.durationLabel}) — retirada em{' '}
                                          {new Date(w.withdrawnAt).toLocaleString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleResumeClick(rec)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] cursor-pointer whitespace-nowrap"
                                >
                                  <Play className="w-3.5 h-3.5 text-[#B45309]" />
                                  Retomar Tratamento
                                </button>
                                {isLinkedToRoom && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenDocuments(rec.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] cursor-pointer whitespace-nowrap"
                                  >
                                    <FolderOpen className="w-3.5 h-3.5 text-[#B45309]" />
                                    Abrir Documentos
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {followUpTarget && (
        <AcompanhamentoModal
          patientId={followUpTarget.patientId}
          patientName={followUpTarget.patientName}
          patientPhone={followUpTarget.patientPhone}
          activeGraphics={followUpTarget.activeGraphics}
          clinicalContext={followUpTarget.clinicalContext}
          onLogsUpdated={() => setFollowUpLogs(loadFollowUpLogs())}
          onClose={() => setFollowUpTarget(null)}
        />
      )}
    </div>
  );
};
