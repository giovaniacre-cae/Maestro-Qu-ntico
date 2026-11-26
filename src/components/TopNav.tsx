import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  DatabaseBackup,
  Download,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { QuantumRoomSession, ScreenId } from '../types/quantum';
import {
  BACKUP_RESTORED_EVENT,
  BackupRestoreMode,
  DEFAULT_CLINIC_LOGO_URL,
  PROFESSIONAL_PROFILE_UPDATED_EVENT,
  ProfessionalProfile,
  downloadFullBackup,
  getProfessionalProfile,
  importFullBackup,
} from '../utils/storage';
import { ProfessionalProfileModal } from './ProfessionalProfileModal';

interface TopNavProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onNewConsultation: () => void;
  onBackupRestored?: (rooms: QuantumRoomSession[]) => void;
}

const NAV_ITEMS: Array<{ id: ScreenId; label: string }> = [
  { id: 'dashboard', label: 'Salas Ativas' },
  { id: 'anamnesis', label: 'Anamnese' },
  { id: 'sensitivity', label: 'Sintonia' },
  { id: 'quantum-table', label: 'Mesa Radiônica' },
  { id: 'radionic-charts', label: 'Gráficos Radiônicos' },
  { id: 'documents', label: 'Documentos' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeScreen,
  onNavigate,
  onNewConsultation,
  onBackupRestored,
}) => {
  const [profile, setProfile] = useState<ProfessionalProfile>(() => getProfessionalProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);
  const [restoreMode, setRestoreMode] = useState<BackupRestoreMode>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncProfile = () => {
      setProfile(getProfessionalProfile());
    };
    window.addEventListener(PROFESSIONAL_PROFILE_UPDATED_EVENT, syncProfile);
    window.addEventListener(BACKUP_RESTORED_EVENT, syncProfile);
    return () => {
      window.removeEventListener(PROFESSIONAL_PROFILE_UPDATED_EVENT, syncProfile);
      window.removeEventListener(BACKUP_RESTORED_EVENT, syncProfile);
    };
  }, []);

  useEffect(() => {
    if (!isBackupMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setIsBackupMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsBackupMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isBackupMenuOpen]);

  const handleExportClick = () => {
    try {
      const { filename, payload } = downloadFullBackup();
      setBackupFeedback({
        type: 'success',
        text: `Arquivo ${filename} gerado (${payload.clinicalDatabase.patients.length} pacientes, ${payload.customBiometers.length} biômetros próprios e ${payload.customPrintableGraphics.length} gráficos próprios).`,
      });
    } catch (err) {
      setBackupFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível exportar a cópia de segurança.',
      });
    }
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setBackupFeedback(null);
    try {
      const summary = await importFullBackup(file, restoreMode);
      onBackupRestored?.(summary.rooms);
      const actionLabel =
        summary.mode === 'merge' ? 'Mesclagem concluída' : 'Backup restaurado';
      setBackupFeedback({
        type: 'success',
        text: `${actionLabel}: ${summary.patientsCount} paciente(s), ${summary.sessionsCount} atendimento(s), ${summary.customBiometersCount} biômetro(s) e ${summary.customGraphicsCount} gráfico(s) próprio(s).`,
      });
    } catch (err) {
      setBackupFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível ler o arquivo de backup selecionado.',
      });
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const activeLogoSrc = profile.logoDataUrl || DEFAULT_CLINIC_LOGO_URL;

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E2E8F0] print:hidden">
        <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-6">
          {/* Linha Superior: Identidade (esquerda) + Ações Rápidas (direita) */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 py-2.5 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              title={`${profile.clinicName} · ${profile.therapistName}`}
              className="flex items-center gap-2 sm:gap-2.5 text-left min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] rounded cursor-pointer"
            >
              <img
                src={activeLogoSrc}
                alt={`Logo ${profile.clinicName}`}
                referrerPolicy="no-referrer"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
              />
              <span className="flex flex-col leading-tight min-w-0 flex-1">
                <span className="font-serif text-sm sm:text-base font-bold tracking-tight text-[#0F172A] truncate sm:max-w-[260px]">
                  {profile.clinicName}
                </span>
                <span className="text-[11px] font-medium text-[#64748B] truncate sm:max-w-[260px]">
                  {profile.therapistName}
                </span>
              </span>
            </button>

            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsBackupMenuOpen(false);
                  setIsProfileModalOpen(true);
                }}
                title="Configurar Minha Clínica / Perfil Profissional (White-Label)"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs font-medium rounded-lg border bg-white/80 text-[#475569] border-[#CBD5E1] hover:text-[#0F172A] hover:border-[#B45309] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]"
              >
                <Building2 className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                <span className="sm:hidden">Clínica</span>
                <span className="hidden sm:inline">Minha Clínica</span>
              </button>

              <div ref={menuContainerRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBackupMenuOpen((prev) => !prev)}
                  aria-expanded={isBackupMenuOpen}
                  aria-haspopup="dialog"
                  title="Backup e sincronização multi-dispositivo"
                  className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] ${
                    isBackupMenuOpen
                      ? 'bg-white text-[#0F172A] border-[#B45309]'
                      : 'bg-white/80 text-[#475569] border-[#CBD5E1] hover:text-[#0F172A] hover:border-[#94A3B8]'
                  }`}
                >
                  <DatabaseBackup className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                  <span className="sm:hidden">Backup</span>
                  <span className="hidden sm:inline">Backup / Sinc.</span>
                </button>

                {isBackupMenuOpen && (
                  <div
                    role="dialog"
                    aria-label="Backup e Restauração Completa"
                    className="absolute right-0 mt-2 w-[310px] sm:w-[356px] max-w-[calc(100vw-1.5rem)] bg-white border border-[#CBD5E1] rounded-xl shadow-[0_12px_32px_-4px_rgba(15,23,42,0.14)] p-4 z-50 space-y-3.5"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                      <div>
                        <h3 className="font-serif text-sm font-bold text-[#0F172A]">
                          Backup Multi-dispositivo
                        </h3>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">
                          Empacota pacientes, sessões, perfil da clínica, biômetros personalizados,
                          edições de setores e gráficos em um único arquivo .json.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBackupMenuOpen(false)}
                        aria-label="Fechar menu de backup"
                        className="p-1 text-[#64748B] hover:text-[#0F172A] rounded cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleExportClick}
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                      Exportar Cópia de Segurança (.json)
                    </button>

                    <div className="pt-2.5 border-t border-[#E2E8F0] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0F172A]">
                          Restaurar Backup (.json)
                        </span>
                        <span className="text-[11px] text-[#64748B]">Modo de importação</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 p-1 bg-[#FAF8F5] border border-[#E2E8F0] rounded-lg">
                        <button
                          type="button"
                          onClick={() => setRestoreMode('merge')}
                          className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                            restoreMode === 'merge'
                              ? 'bg-white text-[#0F172A] font-semibold shadow-sm border border-[#E2E8F0]'
                              : 'text-[#64748B] hover:text-[#0F172A]'
                          }`}
                        >
                          Mesclar registros
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoreMode('replace')}
                          className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                            restoreMode === 'replace'
                              ? 'bg-white text-[#B45309] font-semibold shadow-sm border border-[#E2E8F0]'
                              : 'text-[#64748B] hover:text-[#0F172A]'
                          }`}
                        >
                          Substituir tudo
                        </button>
                      </div>

                      <p className="text-[11px] text-[#64748B] leading-snug">
                        {restoreMode === 'merge'
                          ? 'Preserva seus atendimentos atuais e incorpora novidades do arquivo recebido.'
                          : 'Substitui os dados deste aparelho exatamente pelo conteúdo do backup.'}
                      </p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleRestoreFileChange}
                        className="hidden"
                      />

                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg hover:border-[#B45309] hover:bg-[#FEF3C7]/40 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isRestoring ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#B45309]" />
                            Restaurando dados...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 text-[#B45309]" />
                            Restaurar Backup (.json)
                          </>
                        )}
                      </button>
                    </div>

                    {backupFeedback && (
                      <div
                        className={`p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-2 ${
                          backupFeedback.type === 'success'
                            ? 'bg-[#DCFCE7]/60 border-[#16A34A]/40 text-[#166534]'
                            : 'bg-[#FEF2F2] border-[#BA1A1A]/40 text-[#93000A]'
                        }`}
                      >
                        {backupFeedback.type === 'success' && (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#16A34A]" />
                        )}
                        <span>{backupFeedback.text}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onNewConsultation}
                className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg border border-white/10 hover:shadow-[0_0_16px_rgba(217,119,6,0.25)] hover:bg-[#1E293B] transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]"
              >
                <span className="md:hidden">+ Novo</span>
                <span className="hidden md:inline">+ Novo Atendimento</span>
              </button>
            </div>
          </div>

          {/* Linha Inferior: Barra Dedicada com as 6 Abas (Grade 3x2 no mobile, linha única no desktop) */}
          <nav
            aria-label="Navegação Clínica"
            className="grid grid-cols-3 gap-1.5 sm:gap-2 md:flex md:items-center md:justify-start w-full pt-2 mt-2 pb-1.5 border-t border-slate-200/80"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  title={item.label}
                  className={`flex items-center justify-center text-center text-xs sm:text-sm py-2 px-2 md:px-3.5 rounded-lg font-medium transition-colors min-w-0 md:shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] cursor-pointer ${
                    isActive
                      ? 'bg-amber-50/80 text-amber-900 border-amber-600 font-semibold'
                      : 'border-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-white/70'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <ProfessionalProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};

