import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  Mic,
  Pause,
  PawPrint,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  User,
  UserCheck,
  UserPlus,
  Volume2,
} from 'lucide-react';
import {
  CopilotAnalysisResult,
  InteragentType,
  PatientAnamnesis,
  PetSpecies,
  QuantumRoomSession,
} from '../types/quantum';
import { formatInteragentDisplayLabel, isPetInteragent } from '../utils/antiCatharsis';
import { extractAnamnesisFromAudioBlob } from '../utils/geminiAudio';

interface AnamneseFormProps {
  anamnesis: PatientAnamnesis;
  existingSessions: QuantumRoomSession[];
  onChange: (updated: PatientAnamnesis) => void;
  onSelectExistingSession: (sessionId: string) => void;
  onResetForm: () => void;
  onProceedToSensitivity: () => void;
}

const VU_BAR_COUNT = 18;
const IDLE_VU_BARS = new Array<number>(VU_BAR_COUNT).fill(8);
const MAX_RECORDING_BYTES = 15 * 1024 * 1024;

function pickSupportedRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

const AUDIO_CONNECTION_FALLBACK_MSG =
  'Falha na conexão com o servidor de áudio. Seu áudio continua salvo no player acima — toque em Reprocessar Áudio com IA para tentar novamente.';

function createVoiceOptimizedRecorder(stream: MediaStream, chosenMime: string): MediaRecorder {
  const preferredOptions: MediaRecorderOptions = chosenMime
    ? { mimeType: chosenMime, audioBitsPerSecond: 24000 }
    : { audioBitsPerSecond: 24000 };

  try {
    return new MediaRecorder(stream, preferredOptions);
  } catch {
    return chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
  }
}

async function safeParseApiJson<T = Record<string, unknown>>(
  res: Response,
  nonJsonFallbackMessage: string
): Promise<T> {
  const rawText = await res.text();
  if (!rawText || !rawText.trim()) {
    throw new Error(nonJsonFallbackMessage);
  }

  let parsed: T & { error?: unknown };
  try {
    parsed = JSON.parse(rawText) as T & { error?: unknown };
  } catch {
    throw new Error(nonJsonFallbackMessage);
  }

  if (!res.ok) {
    const serverError =
      parsed && typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error.trim()
        : nonJsonFallbackMessage;
    throw new Error(serverError);
  }

  return parsed;
}

function describeMicrophoneError(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Permissão de acesso ao microfone negada. Clique no ícone de cadeado ou microfone na barra de endereço para liberar o uso e tente novamente (em ambientes incorporados/iframe, confirme se a política do navegador permite microfone).';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Nenhum microfone detectado neste dispositivo. Conecte um microfone ou fone com áudio e tente novamente.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'O microfone está ocupado ou bloqueado por outro aplicativo. Feche outros programas de chamada/gravação e tente novamente.';
  }
  if (name === 'SecurityError' || /iframe|permissions policy|secure/i.test(msg)) {
    return 'O navegador ou iframe bloqueou a captura de microfone por restrição de segurança/HTTPS. Você pode colar a transcrição manualmente ou abrir em janela direta.';
  }
  return msg
    ? `Não foi possível acessar o microfone (${msg}). Verifique as permissões do navegador.`
    : 'Não foi possível iniciar o microfone neste dispositivo.';
}

export const AnamneseForm: React.FC<AnamneseFormProps> = ({
  anamnesis,
  existingSessions,
  onChange,
  onSelectExistingSession,
  onResetForm,
  onProceedToSensitivity,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>(anamnesis.sessionTranscript || '');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [copilotAnalysis, setCopilotAnalysis] = useState<CopilotAnalysisResult | null>(
    anamnesis.copilotAnalysis || null
  );
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [micStatusNote, setMicStatusNote] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [vuBars, setVuBars] = useState<number[]>(IDLE_VU_BARS);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const isRecordingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const anamnesisRef = useRef<PatientAnamnesis>(anamnesis);
  const transcriptRef = useRef<string>(transcript);
  const recordedAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    anamnesisRef.current = anamnesis;
  }, [anamnesis]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    setTranscript(anamnesis.sessionTranscript || '');
    setCopilotAnalysis(anamnesis.copilotAnalysis || null);
  }, [anamnesis.id, anamnesis.sessionTranscript, anamnesis.copilotAnalysis]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, isPaused]);

  const stopVuMeterLoop = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setAudioLevel(0);
    setVuBars(IDLE_VU_BARS);
  };

  const startVuMeterLoop = () => {
    stopVuMeterLoop();
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const tick = () => {
      if (!isRecordingRef.current || isPausedRef.current || !analyserRef.current) {
        return;
      }
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = bufferLength > 0 ? sum / bufferLength : 0;
      const normalizedPct = Math.min(100, Math.round((avg / 110) * 100));
      setAudioLevel(normalizedPct);

      const nextBars: number[] = [];
      const usefulBins = Math.max(1, Math.min(bufferLength, VU_BAR_COUNT));
      for (let b = 0; b < VU_BAR_COUNT; b++) {
        const binIndex = Math.min(bufferLength - 1, Math.floor((b / VU_BAR_COUNT) * usefulBins));
        const val = dataArray[binIndex] ?? 0;
        const heightPct = Math.max(10, Math.min(100, Math.round((val / 160) * 100)));
        nextBars.push(heightPct);
      }
      setVuBars(nextBars);

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  };

  const releaseMediaResources = () => {
    stopVuMeterLoop();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }

    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      audioSourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {
        // Ignore close errors
      }
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      isPausedRef.current = false;
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors on unmount
        }
      }
      releaseMediaResources();
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
        recordedAudioUrlRef.current = null;
      }
    };
  }, []);

  const startLiveSpeechRecognition = () => {
    const SpeechAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechAPI) {
      setMicStatusNote(
        'Microfone conectado e gravando áudio real. A transcrição completa será gerada pela IA ao finalizar a consulta.'
      );
      return;
    }

    try {
      const recognition = new SpeechAPI();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const piece = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalStr += piece + ' ';
          } else {
            interimStr += piece;
          }
        }
        setInterimTranscript(interimStr.trim());
        if (finalStr.trim()) {
          setTranscript((prev) => {
            const next = (prev ? `${prev.trim()} ` : '') + finalStr.trim();
            transcriptRef.current = next;
            onChange({ ...anamnesisRef.current, sessionTranscript: next });
            return next;
          });
        }
      };

      recognition.onerror = (e: any) => {
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setMicStatusNote(
            'Transcrição nativa indisponível neste navegador/iframe, mas a gravação de áudio real continua ativa para transcrição via IA.'
          );
        }
      };

      recognition.onend = () => {
        setInterimTranscript('');
        if (isRecordingRef.current && !isPausedRef.current) {
          try {
            recognition.start();
          } catch {
            // Ignore restart race when stopping
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setMicStatusNote(
        'Gravação de áudio real ativa! A transcrição será processada automaticamente pela IA ao finalizar.'
      );
    }
  };

  const startRecording = async () => {
    setCopilotError(null);
    setMicStatusNote(null);
    setSuccessNotice(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCopilotError(
        'Este navegador ou contexto não permite captura de microfone (verifique se está em HTTPS ou fora de um iframe bloqueado).'
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setCopilotError(describeMicrophoneError(err));
      return;
    }

    // Revoke previous conference recording if starting a fresh recording
    if (recordedAudioUrlRef.current) {
      URL.revokeObjectURL(recordedAudioUrlRef.current);
      recordedAudioUrlRef.current = null;
    }
    setRecordedAudioUrl(null);
    setRecordedAudioBlob(null);
    setDurationSeconds(0);
    setInterimTranscript('');

    mediaStreamRef.current = stream;

    // 1. Setup AudioContext + AnalyserNode for live VU Meter
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        audioSourceRef.current = source;
        analyserRef.current = analyser;
      }
    } catch (audioCtxErr) {
      console.warn('Não foi possível inicializar o medidor VU:', audioCtxErr);
    }

    // 2. Setup MediaRecorder (webm/opus or mp4 fallback for Safari/iOS)
    try {
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder não suportado neste navegador.');
      }
      const chosenMime = pickSupportedRecorderMimeType();
      const recorder = createVoiceOptimizedRecorder(stream, chosenMime);

      audioChunksRef.current = [];
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
    } catch (recErr) {
      releaseMediaResources();
      setCopilotError(
        recErr instanceof Error
          ? `Não foi possível iniciar o gravador de áudio: ${recErr.message}`
          : 'Não foi possível iniciar o gravador de áudio neste navegador.'
      );
      return;
    }

    isRecordingRef.current = true;
    isPausedRef.current = false;
    setIsRecording(true);
    setIsPaused(false);
    startVuMeterLoop();
    startLiveSpeechRecognition();
  };

  const pauseRecording = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    setInterimTranscript('');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
      } catch {
        // Ignore pause unsupported
      }
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }

    stopVuMeterLoop();
  };

  const resumeRecording = async () => {
    isPausedRef.current = false;
    setIsPaused(false);

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch {
        // Ignore resume errors
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
      } catch {
        // Ignore resume unsupported
      }
    }

    startVuMeterLoop();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Ignore restart errors
      }
    }
  };

  const finalizeRecorderToBlob = (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      if (audioChunksRef.current.length > 0) {
        const mime = recorder?.mimeType || 'audio/webm';
        return Promise.resolve(new Blob(audioChunksRef.current, { type: mime }));
      }
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mime = recorder.mimeType || pickSupportedRecorderMimeType() || 'audio/webm';
        const blob =
          audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: mime })
            : null;
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  };

  const processCapturedDataWithAI = async (blobToProcess: Blob | null, textFallback: string) => {
    setIsAnalyzing(true);
    setCopilotError(null);
    setMicStatusNote(null);
    setSuccessNotice(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 50000);

    try {
      if (blobToProcess && blobToProcess.size > 0 && blobToProcess.size <= MAX_RECORDING_BYTES) {
        const result = await extractAnamnesisFromAudioBlob({
          recordedBlob: blobToProcess,
          patientName: anamnesisRef.current.fullName,
          partialTranscript: textFallback,
          interagentType: anamnesisRef.current.interagentType,
          signal: controller.signal,
        });

        const resolvedTranscript = (result.transcription || textFallback || '').trim();
        if (resolvedTranscript) {
          setTranscript(resolvedTranscript);
          transcriptRef.current = resolvedTranscript;
        }
        setCopilotAnalysis(result.copilotAnalysis);

        const latestAnamnesis = anamnesisRef.current;
        const fields = result.extractedFields;
        const nextFullName = fields.patientName?.trim()
          ? fields.patientName.trim()
          : latestAnamnesis.fullName;
        const nextBirthDate = fields.birthDate?.trim()
          ? fields.birthDate.trim()
          : latestAnamnesis.birthDate;
        const nextTherapeuticFocus = fields.mainComplaint?.trim()
          ? fields.mainComplaint.trim()
          : result.copilotAnalysis.centralIntention || latestAnamnesis.therapeuticFocus;
        const nextPhysicalSymptoms = fields.clinicalHistory?.trim()
          ? fields.clinicalHistory.trim()
          : result.copilotAnalysis.clinicalComplaints || latestAnamnesis.physicalSymptoms;
        const nextEmotionalHistory = fields.emotionalSymptoms?.trim()
          ? fields.emotionalSymptoms.trim()
          : result.copilotAnalysis.psychosomaticMapping || latestAnamnesis.emotionalHistory;
        const nextMedicalTreatments = fields.medications?.trim()
          ? fields.medications.trim()
          : latestAnamnesis.medicalTreatments;
        const nextClinicalNotes = fields.lifestyleNotes?.trim()
          ? fields.lifestyleNotes.trim()
          : latestAnamnesis.clinicalNotes;

        onChange({
          ...latestAnamnesis,
          fullName: nextFullName,
          birthDate: nextBirthDate,
          therapeuticFocus: nextTherapeuticFocus,
          physicalSymptoms: nextPhysicalSymptoms,
          emotionalHistory: nextEmotionalHistory,
          medicalTreatments: nextMedicalTreatments,
          clinicalNotes: nextClinicalNotes,
          sessionTranscript: resolvedTranscript,
          copilotAnalysis: result.copilotAnalysis,
        });
        setSuccessNotice('Dados extraídos da gravação e preenchidos na Anamnese');
        return;
      }

      if (blobToProcess && blobToProcess.size > MAX_RECORDING_BYTES && !textFallback.trim()) {
        throw new Error(
          'O áudio gravado excedeu 15 MB e não há transcrição parcial de apoio. Cole o resumo na caixa abaixo.'
        );
      }

      const cleanText = textFallback.trim();
      if (!cleanText) {
        throw new Error(
          'Nenhum áudio captado ou texto digitado para analisar. Verifique seu microfone ou digite a anamnese abaixo.'
        );
      }

      const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/anamnese/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          transcript: cleanText,
          patientName: anamnesisRef.current.fullName,
        }),
      });
      const data = await safeParseApiJson<CopilotAnalysisResult>(
        res,
        blobToProcess
          ? AUDIO_CONNECTION_FALLBACK_MSG
          : 'Falha na conexão ao processar a análise da anamnese. Tente novamente em instantes.'
      );
      setCopilotAnalysis(data);

      const latestAnamnesis = anamnesisRef.current;
      onChange({
        ...latestAnamnesis,
        sessionTranscript: cleanText,
        copilotAnalysis: data,
        physicalSymptoms: data.clinicalComplaints || latestAnamnesis.physicalSymptoms,
        emotionalHistory: data.psychosomaticMapping || latestAnamnesis.emotionalHistory,
        therapeuticFocus: data.centralIntention || latestAnamnesis.therapeuticFocus,
      });
      setSuccessNotice('Dados extraídos da gravação e preenchidos na Anamnese');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setCopilotError(AUDIO_CONNECTION_FALLBACK_MSG);
      } else {
        setCopilotError(
          err instanceof Error && err.message ? err.message : AUDIO_CONNECTION_FALLBACK_MSG
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  const stopAndAnalyze = async () => {
    const wasRecording = isRecordingRef.current;
    isRecordingRef.current = false;
    isPausedRef.current = false;
    setIsRecording(false);
    setIsPaused(false);
    setInterimTranscript('');

    let capturedBlob = recordedAudioBlob;
    if (wasRecording) {
      capturedBlob = await finalizeRecorderToBlob();
      releaseMediaResources();
      mediaRecorderRef.current = null;

      if (capturedBlob && capturedBlob.size > 0) {
        if (recordedAudioUrlRef.current) {
          URL.revokeObjectURL(recordedAudioUrlRef.current);
        }
        const url = URL.createObjectURL(capturedBlob);
        recordedAudioUrlRef.current = url;
        setRecordedAudioUrl(url);
        setRecordedAudioBlob(capturedBlob);
      }
    }

    await processCapturedDataWithAI(capturedBlob, transcriptRef.current);
  };

  const applySuggestions = () => {
    if (!copilotAnalysis) return;
    onChange({
      ...anamnesis,
      physicalSymptoms: copilotAnalysis.clinicalComplaints || anamnesis.physicalSymptoms,
      emotionalHistory: copilotAnalysis.psychosomaticMapping || anamnesis.emotionalHistory,
      therapeuticFocus: copilotAnalysis.centralIntention || anamnesis.therapeuticFocus,
    });
    setSuccessNotice('Sugestões da Copiloto aplicadas com sucesso nos campos da anamnese!');
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isPet = isPetInteragent(anamnesis);
  const petSpeciesOptions: PetSpecies[] = ['Cão', 'Gato', 'Ave', 'Equino', 'Outro'];

  const handleField = (field: keyof PatientAnamnesis, value: string) => {
    onChange({ ...anamnesis, [field]: value });
  };

  const handleInteragentTypeChange = (nextType: InteragentType) => {
    if (nextType === 'pet') {
      onChange({
        ...anamnesis,
        interagentType: 'pet',
        petSpecies: anamnesis.petSpecies || 'Cão',
      });
    } else {
      onChange({
        ...anamnesis,
        interagentType: 'humano',
      });
    }
  };

  const handleLgpdToggle = (checked: boolean) => {
    onChange({
      ...anamnesis,
      lgpdConsent: checked,
      lgpdConsentDate: checked ? new Date().toISOString() : undefined,
    });
  };

  const formatConsentTimestamp = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasBirthOrPetAge = isPet
    ? anamnesis.birthDate.trim().length > 0 || (anamnesis.petAge || '').trim().length > 0
    : anamnesis.birthDate.trim().length > 0;

  const hasValidTutor = !isPet || (anamnesis.tutorName || '').trim().length >= 2;

  const canProceed =
    anamnesis.fullName.trim().length >= (isPet ? 2 : 3) &&
    hasBirthOrPetAge &&
    hasValidTutor &&
    anamnesis.therapeuticFocus.trim().length >= 3 &&
    Boolean(anamnesis.lgpdConsent);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) return;
    onProceedToSensitivity();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
            Etapa Clínica 01 · Anamnese, Escuta Ativa & Copiloto IA
          </p>
          <h1 className="mt-1.5 font-serif text-3xl font-light text-[#0F172A]">
            Anamnese e Intenção Central
          </h1>
          <p className="mt-2 text-sm text-[#45464D] max-w-2xl">
            Ative a escuta ativa por voz em tempo real ou preencha manualmente o testemunho
            informacional para calibrar a leitura radiestésica.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {existingSessions.length > 0 && (
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#B45309] shrink-0" />
              <select
                aria-label="Carregar paciente existente"
                value=""
                onChange={(e) => {
                  if (e.target.value) onSelectExistingSession(e.target.value);
                }}
                className="px-3 py-2 text-xs font-medium bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
              >
                <option value="">Carregar paciente salvo...</option>
                {existingSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatInteragentDisplayLabel(s.anamnesis)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onResetForm}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#64748B] bg-white border border-[#E2E8F0] rounded-lg hover:text-[#0F172A] cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Limpar Ficha
          </button>
        </div>
      </section>

      {/* Seletor de Perfil do Interagente: Pessoa (Humano) vs Animal (PET) */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[#B45309]">
            Perfil do Interagente
          </p>
          <p className="text-xs text-[#45464D]">
            {isPet
              ? 'Modo Veterinário Integrativo ativo: testemunho, Dock Contextual (Saúde Animal / PETS) e Guia do Tutor serão adaptados automaticamente.'
              : 'Selecione se o atendimento vibracional é direcionado para uma pessoa (humano) ou para um animal de estimação (PET).'}
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Perfil do Interagente"
          className="inline-flex items-center gap-1.5 p-1 bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg self-start md:self-auto shrink-0"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!isPet}
            onClick={() => handleInteragentTypeChange('humano')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              !isPet
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <User className={`w-3.5 h-3.5 ${!isPet ? 'text-[#F59E0B]' : 'text-[#64748B]'}`} />
            Pessoa (Humano)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={isPet}
            onClick={() => handleInteragentTypeChange('pet')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              isPet
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <PawPrint className={`w-3.5 h-3.5 ${isPet ? 'text-[#F59E0B]' : 'text-[#64748B]'}`} />
            Animal (PET)
          </button>
        </div>
      </section>

      {/* Escuta Ativa & Copiloto IA Panel */}
      <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#D97706]/40 text-[#B45309]">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#0F172A]">
                Escuta Ativa & Copiloto IA (Atendimento Presencial)
              </h2>
              <p className="text-xs text-[#64748B]">
                Transcreva a conversa da consulta em tempo real e deixe a Copiloto IA estruturar a anamnese.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isRecording ? (
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={startRecording}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] disabled:opacity-50 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Mic className="w-3.5 h-3.5" />
                Iniciar Escuta Ativa
              </button>
            ) : isPaused ? (
              <button
                type="button"
                onClick={resumeRecording}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0F172A] bg-[#FEF3C7] border border-[#D97706]/50 rounded-lg hover:bg-[#FDE68A] cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-[#B45309]" />
                Retomar Gravação
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseRecording}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0F172A] bg-[#FEF3C7] border border-[#D97706]/50 rounded-lg hover:bg-[#FDE68A] cursor-pointer whitespace-nowrap"
              >
                <Pause className="w-3.5 h-3.5 text-[#B45309]" />
                Pausar Gravação
              </button>
            )}

            <button
              type="button"
              disabled={isAnalyzing || (!transcript.trim() && !isRecording && !recordedAudioBlob)}
              onClick={stopAndAnalyze}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Transcrevendo e Analisando (IA)...
                </>
              ) : (
                <>
                  {isRecording ? (
                    <Square className="w-3.5 h-3.5 text-[#F59E0B]" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                  )}
                  Finalizar &amp; Extrair Dados para Anamnese
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Recording Telemetry Panel + VU Meter + Conference Player */}
        {(isRecording || durationSeconds > 0 || recordedAudioUrl) && (
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {isRecording && !isPaused ? (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#DC2626] text-white text-[11px] font-bold tracking-wider uppercase">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    ● GRAVANDO ÁUDIO
                  </span>
                ) : isPaused ? (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FEF3C7] border border-[#D97706]/50 text-[#92400E] text-[11px] font-bold tracking-wider uppercase">
                    <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                    GRAVAÇÃO PAUSADA
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white border border-[#CBD5E1] text-[#475569] text-[11px] font-semibold uppercase tracking-wider">
                    ÁUDIO CAPTURADO PARA CONFERÊNCIA
                  </span>
                )}

                <span className="text-xs text-[#45464D]">
                  {isRecording && !isPaused
                    ? 'Microfone ativo · captando voz em tempo real'
                    : isPaused
                    ? 'Clique em "Retomar Gravação" para continuar'
                    : 'Reproduza abaixo para conferir ou clique em reprocessar'}
                </span>
              </div>

              <div className="font-mono tabular-nums text-sm font-bold text-[#0F172A]">
                {formatTimer(durationSeconds)}
              </div>
            </div>

            {/* Dynamic VU Meter Waveform */}
            {isRecording && (
              <div className="p-3 rounded-lg bg-white border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F172A]">
                    <Volume2 className="w-3.5 h-3.5 text-[#B45309]" />
                    Nível de Captação do Microfone (VU Meter)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[#B45309]">
                    {isPaused ? '0%' : `${audioLevel}%`}
                  </span>
                </div>
                <div
                  className="h-10 flex items-end justify-between gap-1 px-1"
                  aria-label="Medidor visual de ondas de áudio do microfone"
                >
                  {vuBars.map((barHeight, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-sm transition-[height] duration-75 ${
                        isPaused
                          ? 'bg-[#CBD5E1]'
                          : barHeight > 65
                          ? 'bg-[#DC2626]'
                          : barHeight > 32
                          ? 'bg-[#D97706]'
                          : 'bg-[#0F172A]/60'
                      }`}
                      style={{ height: `${isPaused ? 10 : barHeight}%` }}
                    />
                  ))}
                </div>
                {interimTranscript && (
                  <p className="text-[11px] italic text-[#64748B] truncate pt-1 border-t border-[#E2E8F0]">
                    Ouvindo: &ldquo;{interimTranscript}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Conference Audio Player */}
            {recordedAudioUrl && !isRecording && (
              <div className="p-3 rounded-lg bg-white border border-[#D97706]/35 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Player de Conferência da Consulta Gravada
                  </span>
                  {recordedAudioBlob && (
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() =>
                        void processCapturedDataWithAI(recordedAudioBlob, transcriptRef.current)
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] bg-[#FAF8F5] border border-[#CBD5E1] rounded-md hover:border-[#D97706] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="w-3 h-3 text-[#B45309]" />
                      Reprocessar Áudio com IA
                    </button>
                  )}
                </div>
                <audio controls src={recordedAudioUrl} className="w-full h-9" />
              </div>
            )}
          </div>
        )}

        {micStatusNote && (
          <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#D97706]/35 text-xs text-[#92400E]">
            {micStatusNote}
          </div>
        )}

        {copilotError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FEF2F2] border border-[#BA1A1A]/40 text-xs text-[#93000A]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{copilotError}</span>
          </div>
        )}

        {successNotice && !copilotError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#DCFCE7] border border-[#16A34A]/40 text-xs font-semibold text-[#166534]">
            <Check className="w-4 h-4 shrink-0 text-[#16A34A]" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Transcription Textarea */}
        <div className="space-y-1.5">
          <label htmlFor="sessionTranscript" className="block text-xs font-semibold text-[#0F172A]">
            Transcrição ao Vivo da Sessão (Editável ou Colada Manualmente)
          </label>
          <textarea
            id="sessionTranscript"
            rows={5}
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              onChange({ ...anamnesis, sessionTranscript: e.target.value });
            }}
            placeholder="A transcrição da fala aparecerá aqui automaticamente conforme o paciente relata seus sintomas e emoções, ou você pode colar/editar o texto diretamente..."
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#FAF8F5] border border-[#CBD5E1] rounded-lg text-[#0F172A] font-sans focus:outline-none focus:border-[#D97706]"
          />
        </div>

        {/* Copilot Insights Card */}
        {copilotAnalysis && (
          <div className="p-5 rounded-xl bg-[#FAF8F5] border-2 border-[#D97706]/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#B45309]" />
                <h3 className="font-serif text-base font-bold text-[#0F172A]">
                  Insights Clínicos da Copiloto IA
                </h3>
              </div>
              <button
                type="button"
                onClick={applySuggestions}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] rounded-lg hover:bg-[#15803D] transition-colors cursor-pointer whitespace-nowrap shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Aplicar Sugestões nos Campos da Anamnese
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-white border border-[#E2E8F0] space-y-1">
                <span className="font-bold text-[#B45309]">Foco Sugerido:</span>
                <p className="font-serif font-bold text-[#0F172A] text-sm">
                  {copilotAnalysis.suggestedFocus}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#E2E8F0] space-y-1">
                <span className="font-bold text-[#B45309]">Intenção Central Sugerida:</span>
                <p className="font-medium text-[#0F172A]">{copilotAnalysis.centralIntention}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#E2E8F0] space-y-1 md:col-span-2">
                <span className="font-bold text-[#B45309]">Resumo das Queixas Clínicas Físicas:</span>
                <p className="text-[#334155] leading-relaxed">{copilotAnalysis.clinicalComplaints}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#E2E8F0] space-y-1 md:col-span-2">
                <span className="font-bold text-[#B45309]">Mapeamento Psicossomático:</span>
                <p className="text-[#334155] leading-relaxed">{copilotAnalysis.psychosomaticMapping}</p>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#E2E8F0] space-y-1.5 md:col-span-2">
                <span className="font-bold text-[#B45309]">Órgãos ANSAE & Chakras Destaque:</span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {(copilotAnalysis.highlightedOrgansAndChakras || []).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-[11px] font-semibold rounded bg-[#FEF3C7] text-[#92400E] border border-[#D97706]/40"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Identificação & Foco */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
            <h2 className="font-serif text-lg font-bold text-[#0F172A]">
              {isPet ? 'Dados do Pet & Tutor Responsável' : 'Identificação e Foco do Atendimento'}
            </h2>
            {isPet && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-[#FEF3C7] text-[#92400E] border border-[#D97706]/40">
                <PawPrint className="w-3 h-3" />
                PET
              </span>
            )}
          </div>

          {isPet ? (
            <>
              {/* Dados do Pet */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#B45309]">
                  Dados do Pet
                </p>

                <div>
                  <label htmlFor="fullName" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Nome do Animal *
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={anamnesis.fullName}
                    onChange={(e) => handleField('fullName', e.target.value)}
                    placeholder="Ex.: Thor, Luna, Pipoca..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="petSpecies" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Espécie *
                    </label>
                    <select
                      id="petSpecies"
                      value={anamnesis.petSpecies || 'Cão'}
                      onChange={(e) => handleField('petSpecies', e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                    >
                      {petSpeciesOptions.map((sp) => (
                        <option key={sp} value={sp}>
                          {sp}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="petBreed" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Raça
                    </label>
                    <input
                      id="petBreed"
                      type="text"
                      value={anamnesis.petBreed || ''}
                      onChange={(e) => handleField('petBreed', e.target.value)}
                      placeholder="Ex.: Golden Retriever, SRD..."
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="birthDate" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Data de Nascimento
                    </label>
                    <input
                      id="birthDate"
                      type="date"
                      value={anamnesis.birthDate}
                      onChange={(e) => handleField('birthDate', e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] font-mono focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                    />
                  </div>
                  <div>
                    <label htmlFor="petAge" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Idade {!anamnesis.birthDate ? '*' : '(opcional)'}
                    </label>
                    <input
                      id="petAge"
                      type="text"
                      value={anamnesis.petAge || ''}
                      onChange={(e) => handleField('petAge', e.target.value)}
                      placeholder="Ex.: 4 anos / 8 meses"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="petEnvironment" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Ambiente Doméstico
                  </label>
                  <input
                    id="petEnvironment"
                    type="text"
                    value={anamnesis.petEnvironment || ''}
                    onChange={(e) => handleField('petEnvironment', e.target.value)}
                    placeholder="Ex.: Apartamento, casa com quintal, convive com outros animais..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                  />
                </div>
              </div>

              {/* Dados do Tutor Responsável */}
              <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#B45309]">
                  Dados do Tutor Responsável
                </p>

                <div>
                  <label htmlFor="tutorName" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Nome Completo do Tutor *
                  </label>
                  <input
                    id="tutorName"
                    type="text"
                    required
                    value={anamnesis.tutorName || ''}
                    onChange={(e) => handleField('tutorName', e.target.value)}
                    placeholder="Ex.: Ana Paula Ferreira"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    WhatsApp / Contato do Tutor
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={anamnesis.phone}
                    onChange={(e) => handleField('phone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] font-mono focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="fullName" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Nome Completo do Paciente *
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={anamnesis.fullName}
                  onChange={(e) => handleField('fullName', e.target.value)}
                  placeholder="Ex.: Maria Clara de Oliveira Santos"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="birthDate" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Data de Nascimento *
                  </label>
                  <input
                    id="birthDate"
                    type="date"
                    required
                    value={anamnesis.birthDate}
                    onChange={(e) => handleField('birthDate', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] font-mono focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={anamnesis.phone}
                    onChange={(e) => handleField('phone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] font-mono focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="therapeuticFocus"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Foco do Atendimento / Intenção Central *
            </label>
            <input
              id="therapeuticFocus"
              type="text"
              required
              value={anamnesis.therapeuticFocus}
              onChange={(e) => handleField('therapeuticFocus', e.target.value)}
              placeholder={
                isPet
                  ? 'Ex.: Ansiedade de separação, alergia de pele e vitalidade articular'
                  : 'Ex.: Equilíbrio Neuroemocional, Vitalidade e Prosperidade Profissional'
              }
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
            />
            {!isPet && (
              <p className="mt-1.5 text-xs text-[#64748B]">
                Se o foco incluir prosperidade, finanças ou carreira, o algoritmo habilita o arquétipo
                Turbilhão com Prosperador na Etapa 2.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="medicalTreatments"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              {isPet
                ? 'Acompanhamento Veterinário / Medicações em Uso'
                : 'Acompanhamento Médico / Medicações em Uso'}
            </label>
            <textarea
              id="medicalTreatments"
              rows={3}
              value={anamnesis.medicalTreatments}
              onChange={(e) => handleField('medicalTreatments', e.target.value)}
              placeholder={
                isPet
                  ? 'Descreva diagnósticos veterinários, vermífugos, ração terapêutica ou medicações atuais do animal...'
                  : 'Descreva diagnósticos clínicos, acompanhamentos médicos ou medicações atuais...'
              }
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
            />
          </div>
        </div>

        {/* Queixas Clínicas e Histórico */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <h2 className="font-serif text-lg font-bold text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
              {isPet
                ? 'Comportamento do Pet, Sinais Clínicos & Campo do Lar'
                : 'Queixas Clínicas e Mapeamento Psicossomático'}
            </h2>

            <div>
              <label
                htmlFor="emotionalHistory"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                {isPet
                  ? 'Comportamento, Rotina Emocional e Mudanças no Ambiente'
                  : 'Histórico Emocional, Mental e Gatilhos Recentes'}
              </label>
              <textarea
                id="emotionalHistory"
                rows={4}
                value={anamnesis.emotionalHistory}
                onChange={(e) => handleField('emotionalHistory', e.target.value)}
                placeholder={
                  isPet
                    ? 'Medo de fogos/trovões, agitação, tristeza, mudança de residência, chegada de outro animal ou bebê, apego ao tutor...'
                    : 'Ansiedade, luto, sobrecarga familiar/profissional, padrões de pensamento recorrentes, qualidade do sono...'
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
              />
            </div>

            <div>
              <label
                htmlFor="physicalSymptoms"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                {isPet
                  ? 'Queixas Físicas, Pele/Pelo e Sinais Observados'
                  : 'Queixas Clínicas Físicas e Sinais Corporais'}
              </label>
              <textarea
                id="physicalSymptoms"
                rows={4}
                value={anamnesis.physicalSymptoms}
                onChange={(e) => handleField('physicalSymptoms', e.target.value)}
                placeholder={
                  isPet
                    ? 'Coceira, dermatite, queda de pelo, sensibilidade digestiva/renal, dor articular, falta de apetite ou prostração...'
                    : 'Fadiga, dores musculares/cervicais, alterações digestivas, baixa imunidade, enxaqueca...'
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
              />
            </div>

            <div>
              <label
                htmlFor="clinicalNotes"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Observações do Terapeuta
              </label>
              <textarea
                id="clinicalNotes"
                rows={2}
                value={anamnesis.clinicalNotes}
                onChange={(e) => handleField('clinicalNotes', e.target.value)}
                placeholder={
                  isPet
                    ? 'Percepções sobre a sintonia do pet com o tutor e ambiente da casa...'
                    : 'Percepções iniciais durante a entrevista clínica...'
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
              />
            </div>
          </div>

          {/* Bloco Ciência e Consentimento (LGPD) */}
          <div
            className={`rounded-xl border p-4 transition-colors ${
              anamnesis.lgpdConsent
                ? 'bg-[#DCFCE7]/35 border-[#16A34A]/45'
                : 'bg-[#FAF8F5] border-[#D97706]/45'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 ${
                    anamnesis.lgpdConsent ? 'text-[#16A34A]' : 'text-[#B45309]'
                  }`}
                />
                <span className="text-xs font-bold text-[#0F172A]">
                  {isPet
                    ? 'Consentimento Ético Veterinário e LGPD do Tutor *'
                    : 'Ciência e Consentimento (LGPD) *'}
                </span>
              </div>
              {anamnesis.lgpdConsent && anamnesis.lgpdConsentDate && (
                <span className="text-[11px] font-mono tabular-nums text-[#166534]">
                  Registrado em {formatConsentTimestamp(anamnesis.lgpdConsentDate)}
                </span>
              )}
            </div>

            <label
              htmlFor="lgpdConsent"
              className="flex items-start gap-2.5 cursor-pointer select-none"
            >
              <input
                id="lgpdConsent"
                type="checkbox"
                checked={Boolean(anamnesis.lgpdConsent)}
                onChange={(e) => handleLgpdToggle(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#0F172A] accent-[#0F172A] focus:ring-[#D97706] shrink-0 cursor-pointer"
              />
              <span className="text-xs leading-relaxed text-[#334155]">
                {isPet
                  ? 'Tutor responsável ciente de que a Radiestesia Terapêutica Veterinária atua estritamente como suporte vibracional integrativo complementar, não substituindo consulta, diagnóstico, exames ou tratamento do médico-veterinário, e autoriza o registro confidencial dos dados.'
                  : 'Consulente ciente de que a Radiestesia Terapêutica atua como suporte vibracional integrativo complementar, não substituindo diagnóstico ou tratamento médico/psicológico, e autoriza o registro confidencial dos seus dados.'}
              </span>
            </label>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-[#64748B]">
              {!anamnesis.lgpdConsent
                ? isPet
                  ? 'Preencha os campos com * (Pet, Tutor, Foco) e confirme o consentimento ético veterinário para avançar.'
                  : 'Campos com * e confirmação de ciência LGPD são obrigatórios para avançar.'
                : 'Campos com * são obrigatórios para formatar o Testemunho Informacional.'}
            </p>
            <button
              type="submit"
              disabled={!canProceed}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] hover:shadow-[0_0_16px_rgba(217,119,6,0.25)] disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
            >
              {isPet ? 'Avançar para Sintonia (Contexto PETS)' : 'Avançar para Sintonia Sensitiva'}
              <ArrowRight className="w-4 h-4 text-[#F59E0B]" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

