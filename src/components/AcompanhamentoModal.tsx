import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  FileAudio,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  FollowUpCategory,
  FollowUpLogEntry,
  deleteFollowUpLog,
  getPatientFollowUpLogs,
  upsertFollowUpLog,
} from '../utils/storage';
import { InteragentType } from '../types/quantum';
import {
  analyzeFollowUpAudioWithGemini,
  analyzeFollowUpTextWithGemini,
} from '../utils/geminiAudio';

export interface FollowUpClinicalContext {
  bovis?: number;
  hawkinsLabel?: string;
  auricProtection?: number;
  stressLevel?: number;
  therapeuticFocus?: string;
  emotionalHistory?: string;
  imbalancedChakras?: string[];
  criticalOrgans?: string[];
  phaseLabel?: string;
  interagentType?: InteragentType;
  petSpecies?: string;
  tutorName?: string;
}

interface AcompanhamentoModalProps {
  patientId: string;
  patientName: string;
  patientPhone?: string;
  activeGraphics: string[];
  clinicalContext: FollowUpClinicalContext;
  onLogsUpdated?: () => void;
  onClose: () => void;
}

const CATEGORY_OPTIONS: Array<{
  id: FollowUpCategory;
  label: string;
  helper: string;
}> = [
  {
    id: 'sonho',
    label: 'Sonho',
    helper: 'Relato onírico, símbolos, pesadelos ou sonhos lúcidos',
  },
  {
    id: 'catarse_sintoma',
    label: 'Catarse / Sintoma',
    helper: 'Sensações físicas, bocejos, sono profundo, dores ou descargas',
  },
  {
    id: 'evolucao_emocional',
    label: 'Evolução Emocional',
    helper: 'Mudanças de humor, clareza mental, alívio ou choro terapêutico',
  },
  {
    id: 'retorno_geral',
    label: 'Retorno Geral',
    helper: 'Feedback livre enviado pelo consulente ou tutor',
  },
];

function getCategoryLabel(cat: FollowUpCategory): string {
  return CATEGORY_OPTIONS.find((opt) => opt.id === cat)?.label || 'Retorno Geral';
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildWhatsAppHref(phone: string | undefined, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  const textParam = encodeURIComponent(message.trim());
  if (!digits) {
    return `https://wa.me/?text=${textParam}`;
  }
  const normalizedPhone =
    digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${normalizedPhone}?text=${textParam}`;
}

const MAX_AUDIO_FILE_BYTES = 15 * 1024 * 1024;

interface AttachedAudioFile {
  file: File;
  name: string;
  sizeLabel: string;
  mimeType: string;
  previewUrl: string;
}

function formatBytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function resolveClientAudioMimeType(file: File): string | null {
  const rawMime = (file.type || '').split(';')[0].trim().toLowerCase();
  const extMatch = file.name.toLowerCase().match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : '';

  const mimeMap: Record<string, string> = {
    'audio/ogg': 'audio/ogg',
    'application/ogg': 'audio/ogg',
    'audio/opus': 'audio/ogg',
    'audio/mpeg': 'audio/mp3',
    'audio/mp3': 'audio/mp3',
    'audio/mp4': 'audio/mp4',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
    'video/mp4': 'audio/mp4',
    'audio/wav': 'audio/wav',
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
    'audio/webm': 'audio/webm',
    'video/webm': 'audio/webm',
    'audio/aac': 'audio/aac',
    'audio/flac': 'audio/flac',
  };

  if (rawMime && mimeMap[rawMime]) return mimeMap[rawMime];

  const extMap: Record<string, string> = {
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.mp3': 'audio/mp3',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
  };

  if (ext && extMap[ext]) return extMap[ext];
  return null;
}

export const AcompanhamentoModal: React.FC<AcompanhamentoModalProps> = ({
  patientId,
  patientName,
  patientPhone,
  activeGraphics,
  clinicalContext,
  onLogsUpdated,
  onClose,
}) => {
  const [logs, setLogs] = useState<FollowUpLogEntry[]>(() =>
    getPatientFollowUpLogs(patientId, patientName)
  );
  const [category, setCategory] = useState<FollowUpCategory>('sonho');
  const [narrative, setNarrative] = useState('');
  const [therapistAnalysis, setTherapistAnalysis] = useState('');
  const [patientFeedbackMessage, setPatientFeedbackMessage] = useState('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingMode, setAnalyzingMode] = useState<'text' | 'audio' | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [attachedAudio, setAttachedAudio] = useState<AttachedAudioFile | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioPreviewUrlRef = useRef<string | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    setLogs(getPatientFollowUpLogs(patientId, patientName));
  }, [patientId, patientName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore stop errors on unmount
        }
      }
      if (audioPreviewUrlRef.current) {
        URL.revokeObjectURL(audioPreviewUrlRef.current);
        audioPreviewUrlRef.current = null;
      }
    };
  }, [onClose]);

  const showTransientNotice = (msg: string) => {
    setNoticeText(msg);
    setTimeout(() => {
      setNoticeText((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleCopyText = async (text: string, key: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2200);
    } catch {
      setErrorText('Não foi possível copiar automaticamente. Selecione o texto manualmente.');
    }
  };

  const stopVoiceDictation = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
  };

  const toggleVoiceDictation = () => {
    setSpeechNotice(null);
    if (isListening) {
      stopVoiceDictation();
      return;
    }

    const SpeechAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechAPI) {
      setSpeechNotice(
        'Ditado por voz não suportado neste navegador. Digite ou cole o relato diretamente abaixo.'
      );
      return;
    }

    try {
      if (!recognitionRef.current) {
        const recognition = new SpeechAPI();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let finalSegment = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalSegment += event.results[i][0].transcript + ' ';
            }
          }
          if (finalSegment.trim()) {
            setNarrative((prev) =>
              prev.trim() ? `${prev.trim()} ${finalSegment.trim()}` : finalSegment.trim()
            );
          }
        };
        recognition.onerror = () => {
          setSpeechNotice(
            'Não foi possível capturar o áudio do microfone. Verifique as permissões ou digite o relato.'
          );
          isListeningRef.current = false;
          setIsListening(false);
        };
        recognition.onend = () => {
          if (isListeningRef.current) {
            try {
              recognition.start();
            } catch {
              isListeningRef.current = false;
              setIsListening(false);
            }
          }
        };
        recognitionRef.current = recognition;
      }

      isListeningRef.current = true;
      setIsListening(true);
      recognitionRef.current.start();
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      setSpeechNotice(
        'Falha ao iniciar o microfone. Você pode colar ou digitar o relato manualmente.'
      );
    }
  };

  const clearAttachedAudio = () => {
    if (audioPreviewUrlRef.current) {
      URL.revokeObjectURL(audioPreviewUrlRef.current);
      audioPreviewUrlRef.current = null;
    }
    setAttachedAudio(null);
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const handleAudioFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorText(null);
    setNoticeText(null);

    if (file.size > MAX_AUDIO_FILE_BYTES) {
      setErrorText(
        `O áudio selecionado possui ${formatBytesLabel(file.size)} e excede o limite máximo de 15 MB.`
      );
      e.target.value = '';
      return;
    }

    const resolvedMime = resolveClientAudioMimeType(file);
    if (!resolvedMime) {
      setErrorText(
        'Formato de áudio não reconhecido. Selecione um arquivo .ogg, .opus, .mp3, .m4a, .mp4, .wav ou .webm.'
      );
      e.target.value = '';
      return;
    }

    if (audioPreviewUrlRef.current) {
      URL.revokeObjectURL(audioPreviewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    audioPreviewUrlRef.current = previewUrl;

    setAttachedAudio({
      file,
      name: file.name,
      sizeLabel: formatBytesLabel(file.size),
      mimeType: resolvedMime,
      previewUrl,
    });
  };

  const persistEntry = (
    narrativeText: string,
    analysisText: string,
    feedbackText: string,
    existingId: string | null
  ) => {
    const entryId = existingId || `followup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: FollowUpLogEntry = {
      id: entryId,
      patientId,
      patientName,
      date: new Date().toISOString(),
      category,
      narrative: narrativeText.trim(),
      activeGraphicsSnapshot: [...activeGraphics],
      therapistAnalysis: analysisText.trim(),
      patientFeedbackMessage: feedbackText.trim(),
    };
    upsertFollowUpLog(entry);
    setActiveDraftId(entryId);
    setLogs(getPatientFollowUpLogs(patientId, patientName));
    onLogsUpdated?.();
  };

  const handleTranscribeAndAnalyzeAudio = async () => {
    if (!attachedAudio) return;
    if (isListening) {
      stopVoiceDictation();
    }

    setErrorText(null);
    setNoticeText(null);
    setIsAnalyzing(true);
    setAnalyzingMode('audio');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 35000);

    try {
      const data = await analyzeFollowUpAudioWithGemini({
        file: attachedAudio.file,
        mimeType: attachedAudio.mimeType,
        fileName: attachedAudio.name,
        patientName,
        category,
        activeGraphics,
        clinicalContext,
        signal: controller.signal,
      });

      const nextTranscription = (data.transcription || '').trim();
      const nextAnalysis = (data.therapistAnalysis || '').trim();
      const nextFeedback = (data.patientFeedbackMessage || '').trim();

      setNarrative(nextTranscription);
      setTherapistAnalysis(nextAnalysis);
      setPatientFeedbackMessage(nextFeedback);
      persistEntry(nextTranscription, nextAnalysis, nextFeedback, activeDraftId);
      clearAttachedAudio();
      showTransientNotice(
        'Áudio transcrito, analisado e salvo no histórico. Você pode revisar ou editar a narrativa abaixo.'
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErrorText(
          'A transcrição excedeu o tempo limite. Tente um áudio mais curto ou verifique sua conexão.'
        );
      } else {
        setErrorText(
          err instanceof Error
            ? err.message
            : 'Erro ao transcrever e analisar o áudio anexado.'
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsAnalyzing(false);
      setAnalyzingMode(null);
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (attachedAudio) {
      await handleTranscribeAndAnalyzeAudio();
      return;
    }

    const cleanNarrative = narrative.trim();
    if (!cleanNarrative) {
      setErrorText(
        'Descreva, dite ou anexe um áudio do paciente antes de solicitar a análise.'
      );
      return;
    }

    if (isListening) {
      stopVoiceDictation();
    }

    setErrorText(null);
    setNoticeText(null);
    setIsAnalyzing(true);
    setAnalyzingMode('text');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 18000);

    try {
      const data = await analyzeFollowUpTextWithGemini({
        patientName,
        category,
        narrative: cleanNarrative,
        activeGraphics,
        clinicalContext,
        signal: controller.signal,
      });

      const nextAnalysis = (data.therapistAnalysis || '').trim();
      const nextFeedback = (data.patientFeedbackMessage || '').trim();

      setTherapistAnalysis(nextAnalysis);
      setPatientFeedbackMessage(nextFeedback);
      persistEntry(cleanNarrative, nextAnalysis, nextFeedback, activeDraftId);
      showTransientNotice('Análise cruzada gerada e salva automaticamente no diário do paciente.');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErrorText('Tempo limite excedido ao consultar a IA. Tente novamente em instantes.');
      } else {
        setErrorText(
          err instanceof Error
            ? err.message
            : 'Erro ao consultar a IA para análise do acompanhamento.'
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsAnalyzing(false);
      setAnalyzingMode(null);
    }
  };

  const handleSaveManualOrEdits = () => {
    if (!narrative.trim()) {
      setErrorText('Informe o relato do paciente antes de salvar o registro.');
      return;
    }
    setErrorText(null);
    persistEntry(narrative, therapistAnalysis, patientFeedbackMessage, activeDraftId);
    showTransientNotice(
      activeDraftId
        ? 'Alterações atualizadas no diário de acompanhamento.'
        : 'Registro salvo no diário de acompanhamento.'
    );
  };

  const handleStartNewDraft = () => {
    setActiveDraftId(null);
    setNarrative('');
    setTherapistAnalysis('');
    setPatientFeedbackMessage('');
    setErrorText(null);
    setNoticeText(null);
    clearAttachedAudio();
  };

  const handleDeleteEntry = (entryId: string) => {
    deleteFollowUpLog(entryId);
    if (activeDraftId === entryId) {
      setActiveDraftId(null);
    }
    setConfirmDeleteId(null);
    setLogs(getPatientFollowUpLogs(patientId, patientName));
    onLogsUpdated?.();
    showTransientNotice('Registro removido do diário.');
  };

  const activeCategoryHelper = useMemo(
    () => CATEGORY_OPTIONS.find((c) => c.id === category)?.helper || '',
    [category]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="followup-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 bg-white border-b border-[#E2E8F0] flex items-start justify-between gap-4 shrink-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
              Diário de Acompanhamento &amp; Análise Onírica (IA)
            </p>
            <h2
              id="followup-modal-title"
              className="mt-0.5 font-serif text-xl sm:text-2xl font-bold text-[#0F172A]"
            >
              {patientName}
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B] font-mono tabular-nums">
              {clinicalContext.interagentType === 'pet'
                ? `Interagente PET${clinicalContext.petSpecies ? ` (${clinicalContext.petSpecies})` : ''}${
                    clinicalContext.tutorName ? ` · Tutor: ${clinicalContext.tutorName}` : ''
                  }`
                : 'Interagente Humano'}
              {typeof clinicalContext.bovis === 'number'
                ? ` · Bovis ${clinicalContext.bovis.toLocaleString('pt-BR')} Å`
                : ''}
              {clinicalContext.hawkinsLabel ? ` · ${clinicalContext.hawkinsLabel}` : ''}
              {typeof clinicalContext.auricProtection === 'number'
                ? ` · Aura ${clinicalContext.auricProtection}%`
                : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Diário de Acompanhamento"
            className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#FAF8F5] rounded-lg border border-transparent hover:border-[#E2E8F0] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Graphics Snapshot */}
          <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                Gráficos Radiônicos Ativos no Momento ({activeGraphics.length})
              </p>
              {clinicalContext.phaseLabel && (
                <span className="text-xs font-medium text-[#B45309]">
                  {clinicalContext.phaseLabel}
                </span>
              )}
            </div>
            {activeGraphics.length === 0 ? (
              <p className="text-xs text-[#64748B]">
                Nenhuma placa ativa registrada nesta etapa. A análise cruzará o relato com a anamnese e aferições ANSAE + RHEN.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeGraphics.map((graphicName, idx) => (
                  <span
                    key={`${graphicName}-${idx}`}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-[#0F172A] bg-[#FAF8F5] border border-[#D97706]/35 rounded-md"
                  >
                    {graphicName}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Composer Section */}
          <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#0F172A]">
                  Registrar Novo Relato do Paciente
                </h3>
                <p className="text-xs text-[#64748B]">{activeCategoryHelper}</p>
              </div>

              {activeDraftId && (
                <button
                  type="button"
                  onClick={handleStartNewDraft}
                  className="text-xs font-semibold text-[#B45309] hover:underline cursor-pointer whitespace-nowrap"
                >
                  + Limpar para Novo Relato
                </button>
              )}
            </div>

            {/* Category Selector */}
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoria do relato">
              {CATEGORY_OPTIONS.map((opt) => {
                const selected = category === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCategory(opt.id)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-[#FAF8F5] text-[#45464D] border-[#CBD5E1] hover:border-[#D97706] hover:text-[#0F172A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Narrative Input + Audio Upload + Voice Dictation */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="followup-narrative-input"
                  className="text-xs font-semibold text-[#0F172A]"
                >
                  Narrativa do Paciente (texto, ditado ou transcrição de áudio)
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.ogg,.opus,.m4a,.mp4,.mp3,.wav,.webm"
                    onChange={handleAudioFileSelected}
                    className="hidden"
                    aria-label="Anexar arquivo de áudio do WhatsApp ou celular"
                  />
                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => audioInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D97706] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#B45309]" />
                    Anexar Áudio (WhatsApp / Celular)
                  </button>

                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={toggleVoiceDictation}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      isListening
                        ? 'bg-[#DC2626] text-white border-[#B91C1C]'
                        : 'bg-[#FAF8F5] text-[#0F172A] border-[#CBD5E1] hover:border-[#D97706]'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        Parar Ditado por Voz
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-[#B45309]" />
                        Ditar Relato por Voz
                      </>
                    )}
                  </button>
                </div>
              </div>

              {attachedAudio && (
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#D97706]/45 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileAudio className="w-4 h-4 text-[#B45309] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">
                          {attachedAudio.name}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-[#64748B]">
                          {attachedAudio.sizeLabel} · {attachedAudio.mimeType}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={clearAttachedAudio}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#991B1B] bg-white border border-[#DC2626]/30 rounded-md hover:bg-[#FEF2F2] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <X className="w-3 h-3" />
                      Remover Áudio
                    </button>
                  </div>

                  <audio
                    controls
                    src={attachedAudio.previewUrl}
                    className="w-full h-9"
                  />
                </div>
              )}

              <textarea
                id="followup-narrative-input"
                rows={4}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Ex.: Sonhei que estava limpando uma casa antiga com muita água saindo pelo ralo, acordei com leve dor de cabeça e depois senti um alívio grande no peito..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#D97706] focus:ring-1 focus:ring-[#D97706]"
              />

              {speechNotice && (
                <p className="text-xs text-[#92400E] bg-[#FFFBEB] border border-[#D97706]/30 rounded-lg px-3 py-2">
                  {speechNotice}
                </p>
              )}
            </div>

            {errorText && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 text-xs text-[#991B1B]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorText}</span>
              </div>
            )}

            {noticeText && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F0FDF4] border border-[#16A34A]/30 text-xs text-[#166534] font-medium">
                <Check className="w-4 h-4 shrink-0" />
                <span>{noticeText}</span>
              </div>
            )}

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleAnalyzeWithAI}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
                    {analyzingMode === 'audio'
                      ? 'Transcrevendo áudio do paciente e cruzando com os gráficos ativos...'
                      : 'Analisando Simbolismo & Placas Ativas...'}
                  </>
                ) : attachedAudio ? (
                  <>
                    <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                    Transcrever &amp; Analisar Áudio (IA)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                    Analisar Relato &amp; Gerar Devolutiva (IA)
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleSaveManualOrEdits}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5 text-[#B45309]" />
                {activeDraftId ? 'Salvar Edições no Diário' : 'Salvar Registro Manual'}
              </button>
            </div>

            {/* AI / Editable Result Blocks */}
            {(therapistAnalysis || patientFeedbackMessage || activeDraftId) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-[#E2E8F0]">
                {/* Therapist Technical Analysis */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="therapist-analysis-draft"
                      className="text-xs font-bold uppercase tracking-wider text-[#0F172A]"
                    >
                      Análise Clínica para o Terapeuta
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(therapistAnalysis, 'draft-therapist')
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                    >
                      {copiedKey === 'draft-therapist' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    id="therapist-analysis-draft"
                    rows={6}
                    value={therapistAnalysis}
                    onChange={(e) => setTherapistAnalysis(e.target.value)}
                    placeholder="Análise clínica cruzando os símbolos ou sintomas com as placas ativas e avaliação ANSAE + RHEN..."
                    className="w-full px-3 py-2 text-xs leading-relaxed bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                  />
                </div>

                {/* Patient Friendly WhatsApp Feedback */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#D97706]/35 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="patient-feedback-draft"
                      className="text-xs font-bold uppercase tracking-wider text-[#B45309]"
                    >
                      Devolutiva Acolhedora (WhatsApp)
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(patientFeedbackMessage, 'draft-patient')
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:border-[#D97706] cursor-pointer whitespace-nowrap"
                      >
                        {copiedKey === 'draft-patient' ? (
                          <>
                            <Check className="w-3 h-3 text-[#16A34A]" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copiar
                          </>
                        )}
                      </button>

                      {patientFeedbackMessage.trim() && (
                        <a
                          href={buildWhatsAppHref(patientPhone, patientFeedbackMessage)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#16A34A] rounded-md hover:bg-[#15803D] transition-colors whitespace-nowrap"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                  <textarea
                    id="patient-feedback-draft"
                    rows={6}
                    value={patientFeedbackMessage}
                    onChange={(e) => setPatientFeedbackMessage(e.target.value)}
                    placeholder="Mensagem acolhedora, serena e tranquilizadora pronta para envio ao consulente..."
                    className="w-full px-3 py-2 text-xs leading-relaxed bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Chronological Timeline */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#B45309]" />
                <h3 className="font-serif text-lg font-bold text-[#0F172A]">
                  Histórico Cronológico de Acompanhamentos ({logs.length})
                </h3>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-center">
                <p className="text-sm font-medium text-[#0F172A]">
                  Nenhum relato registrado ainda para {patientName}.
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Registre sonhos, sensações de acomodação ou retornos acima para construir o histórico evolutivo.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((entry) => {
                  const copyKey = `log-${entry.id}`;
                  const isConfirmingDelete = confirmDeleteId === entry.id;
                  return (
                    <article
                      key={entry.id}
                      className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-[#B45309]">
                              {getCategoryLabel(entry.category)}
                            </span>
                            <span aria-hidden="true" className="text-[#CBD5E1]">
                              ·
                            </span>
                            <span className="font-mono tabular-nums text-[#64748B]">
                              {formatDateTimeBR(entry.date)}
                            </span>
                          </div>
                          {entry.activeGraphicsSnapshot.length > 0 && (
                            <p className="text-[11px] text-[#64748B]">
                              <span className="font-semibold text-[#0F172A]">Placas no momento: </span>
                              {entry.activeGraphicsSnapshot.join(' · ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#DC2626] rounded-md hover:bg-[#B91C1C] cursor-pointer whitespace-nowrap"
                              >
                                Confirmar Exclusão
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-[11px] font-medium text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(entry.id)}
                              title="Remover registro do diário"
                              aria-label="Remover registro do diário"
                              className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                          Relato Registrado
                        </p>
                        <p className="mt-1 text-xs sm:text-sm text-[#0F172A] leading-relaxed whitespace-pre-wrap">
                          &ldquo;{entry.narrative}&rdquo;
                        </p>
                      </div>

                      {(entry.therapistAnalysis || entry.patientFeedbackMessage) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {entry.therapistAnalysis && (
                            <div className="p-3.5 rounded-lg bg-white border border-[#E2E8F0] space-y-1.5">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F172A]">
                                Análise Clínica (Terapeuta)
                              </p>
                              <p className="text-xs text-[#45464D] leading-relaxed whitespace-pre-wrap">
                                {entry.therapistAnalysis}
                              </p>
                            </div>
                          )}

                          {entry.patientFeedbackMessage && (
                            <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#D97706]/30 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-[#B45309]">
                                  Devolutiva ao Paciente
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(entry.patientFeedbackMessage, copyKey)
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:border-[#D97706] cursor-pointer whitespace-nowrap"
                                  >
                                    {copiedKey === copyKey ? (
                                      <>
                                        <Check className="w-3 h-3 text-[#16A34A]" />
                                        Copiado
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        Copiar
                                      </>
                                    )}
                                  </button>
                                  <a
                                    href={buildWhatsAppHref(
                                      patientPhone,
                                      entry.patientFeedbackMessage
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-[#16A34A] rounded-md hover:bg-[#15803D] transition-colors whitespace-nowrap"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    WhatsApp
                                  </a>
                                </div>
                              </div>
                              <p className="text-xs text-[#0F172A] leading-relaxed whitespace-pre-wrap">
                                {entry.patientFeedbackMessage}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 bg-white border-t border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-[#64748B]">
            Os registros são armazenados localmente no prontuário e incluídos no backup completo (.json).
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg hover:border-[#0F172A] transition-colors cursor-pointer whitespace-nowrap"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
};
