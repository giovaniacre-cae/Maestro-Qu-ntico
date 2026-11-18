import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  Download,
  FileText,
  FolderOpen,
  History,
  Play,
  PlusCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
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
import { QuantumRoomSession, RoomPhase } from '../types/quantum';
import { formatBirthDateBR, getHawkinsLevelInfo } from '../utils/antiCatharsis';
import {
  exportClinicalBackupJson,
  importClinicalBackupJson,
  loadClinicalDatabase,
  roomToClinicalRecord,
  saveClinicalDatabase,
} from '../utils/storage';

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
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
          fullName: room.anamnesis.fullName,
          birthDate: room.anamnesis.birthDate,
          phone: room.anamnesis.phone,
          createdAt: room.activatedAt,
          notes: room.anamnesis.clinicalNotes,
        });
        changed = true;
      }

      const existingRecordIdx = nextSessions.findIndex((s) => s.id === room.id);
      if (existingRecordIdx === -1) {
        nextSessions.push(roomToClinicalRecord(room));
        changed = true;
      } else {
        const currentRec = nextSessions[existingRecordIdx];
        if (currentRec.updatedAt !== room.updatedAt || currentRec.phase !== room.phase) {
          nextSessions[existingRecordIdx] = {
            ...currentRec,
            phase: room.phase,
            isAnchored: room.isAnchored,
            protocol: room.protocol,
            aiResult: room.aiResult,
            selectedSolfeggioHz: room.selectedSolfeggioHz,
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
                          <p className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-[#0F172A]">
                            {session.sensitivity.hawkins} · {hawkinsInfo.label}
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
                    </div>

                    {/* Action Footer */}
                    <div className="px-6 py-4 bg-[#FAF8F5] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
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

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                              {firstSession.ansaeRhen.spiritualPsycho.hawkinsAgathaHz} →{' '}
                              <strong className="text-sm text-[#0F172A]">
                                {latestSession.ansaeRhen.spiritualPsycho.hawkinsAgathaHz} Hz
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
                        </div>
                      </div>
                    )}

                    {/* Sessions Timeline */}
                    <div className="p-6 space-y-3">
                      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                        Linha do Tempo de Atendimentos & Ciclos
                      </p>
                      <div className="space-y-2.5">
                        {pSessions.map((rec) => {
                          const isLinkedToRoom = sessions.some((s) => s.id === rec.id);
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
                                  Hawkins {rec.ansaeRhen.spiritualPsycho.hawkinsAgathaHz} Hz ·{' '}
                                  Aura {rec.ansaeRhen.auricField.protectionPercent}% ·{' '}
                                  Estresse {rec.ansaeRhen.spiritualPsycho.stressLevel}/9
                                </p>
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
    </div>
  );
};
