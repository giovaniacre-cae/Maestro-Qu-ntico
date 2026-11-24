import { CopilotAnalysisResult, InteragentType } from '../types/quantum';

export interface ExtractedAnamnesisFields {
  patientName?: string;
  birthDate?: string;
  mainComplaint?: string;
  clinicalHistory?: string;
  emotionalSymptoms?: string;
  medications?: string;
  lifestyleNotes?: string;
}

export interface GeminiAudioExtractionResult {
  transcription: string;
  extractedFields: ExtractedAnamnesisFields;
  copilotAnalysis: CopilotAnalysisResult;
}

export interface ExtractAudioOptions {
  recordedBlob: Blob;
  patientName?: string;
  partialTranscript?: string;
  interagentType?: InteragentType;
  signal?: AbortSignal;
}

const SINGLE_REQUEST_BASE64_LIMIT = 380_000;
const CHUNK_BASE64_SIZE = 320_000;

export function normalizeAudioBlobMimeType(blob: Blob): string {
  const raw = typeof blob.type === 'string' ? blob.type : '';
  const base = raw.split(';')[0]?.trim().toLowerCase();
  return base || 'audio/webm';
}

export function blobToCleanBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const cleanBase64 = result.includes('base64,') ? result.split('base64,')[1].trim() : result.trim();
      if (!cleanBase64) {
        reject(new Error('Não foi possível codificar o áudio gravado em Base64.'));
        return;
      }
      resolve(cleanBase64);
    };
    reader.onerror = () => reject(new Error('Falha ao ler os bytes da gravação de áudio.'));
    reader.readAsDataURL(blob);
  });
}

export function normalizeBirthDateInput(rawDate?: string): string {
  if (!rawDate || typeof rawDate !== 'string') return '';
  const trimmed = rawDate.trim();
  if (!trimmed) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
  const brMatch = trimmed.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  return '';
}

async function parseJsonOrThrowDetailedError<T>(res: Response, endpointLabel: string): Promise<T> {
  const rawText = await res.text();
  if (!rawText || !rawText.trim()) {
    throw new Error(
      `O servidor retornou uma resposta vazia (HTTP ${res.status}) em ${endpointLabel}. Seu áudio permanece salvo no player.`
    );
  }

  let parsed: T & { error?: unknown };
  try {
    parsed = JSON.parse(rawText) as T & { error?: unknown };
  } catch {
    const snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    throw new Error(
      `Falha na resposta do proxy/servidor (HTTP ${res.status}${snippet ? `: ${snippet}` : ''}). Seu áudio continua salvo no player acima — toque em Reprocessar Áudio com IA.`
    );
  }

  if (!res.ok) {
    const message =
      parsed && typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error.trim()
        : `Erro HTTP ${res.status} ao processar áudio com Gemini.`;
    throw new Error(message);
  }

  return parsed;
}

function getApiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

export async function extractAnamnesisFromAudioBlob(
  options: ExtractAudioOptions
): Promise<GeminiAudioExtractionResult> {
  const { recordedBlob, patientName, partialTranscript, interagentType, signal } = options;

  if (!recordedBlob || recordedBlob.size === 0) {
    throw new Error('Nenhum áudio válido foi gravado para extração.');
  }

  const audioBase64 = await blobToCleanBase64(recordedBlob);
  const mimeType = normalizeAudioBlobMimeType(recordedBlob);
  const ext = mimeType.includes('mp4')
    ? 'mp4'
    : mimeType.includes('ogg')
    ? 'ogg'
    : mimeType.includes('wav')
    ? 'wav'
    : mimeType.includes('mp3') || mimeType.includes('mpeg')
    ? 'mp3'
    : 'webm';

  const apiBase = getApiBase();
  let uploadId: string | undefined;

  // Split large Base64 payloads into small chunks to prevent reverse-proxy body limits (413/502 HTML)
  if (audioBase64.length > SINGLE_REQUEST_BASE64_LIMIT) {
    const generatedId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const totalChunks = Math.ceil(audioBase64.length / CHUNK_BASE64_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_BASE64_SIZE;
      const chunkData = audioBase64.slice(start, start + CHUNK_BASE64_SIZE);
      const chunkRes = await fetch(`${apiBase}/api/anamnese/transcribe-chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          uploadId: generatedId,
          chunkIndex,
          totalChunks,
          chunkData,
        }),
      });
      await parseJsonOrThrowDetailedError<{ ok: boolean }>(
        chunkRes,
        '/api/anamnese/transcribe-chunk'
      );
    }
    uploadId = generatedId;
  }

  const res = await fetch(`${apiBase}/api/anamnese/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      ...(uploadId ? { uploadId } : { audioBase64 }),
      mimeType,
      fileName: `consulta.${ext}`,
      patientName,
      partialTranscript,
      interagentType,
    }),
  });

  const data = await parseJsonOrThrowDetailedError<{
    transcription?: string;
    transcript?: string;
    extractedFields?: ExtractedAnamnesisFields & Partial<CopilotAnalysisResult>;
    clinicalComplaints?: string;
    psychosomaticMapping?: string;
    centralIntention?: string;
    suggestedFocus?: string;
    highlightedOrgansAndChakras?: string[];
  }>(res, '/api/anamnese/transcribe');

  const transcription = (data.transcription || data.transcript || partialTranscript || '').trim();
  const rawFields = data.extractedFields ?? {};

  const extractedFields: ExtractedAnamnesisFields = {
    patientName: typeof rawFields.patientName === 'string' ? rawFields.patientName.trim() : '',
    birthDate: normalizeBirthDateInput(
      typeof rawFields.birthDate === 'string' ? rawFields.birthDate : ''
    ),
    mainComplaint:
      typeof rawFields.mainComplaint === 'string' && rawFields.mainComplaint.trim()
        ? rawFields.mainComplaint.trim()
        : data.centralIntention || '',
    clinicalHistory:
      typeof rawFields.clinicalHistory === 'string' && rawFields.clinicalHistory.trim()
        ? rawFields.clinicalHistory.trim()
        : data.clinicalComplaints || '',
    emotionalSymptoms:
      typeof rawFields.emotionalSymptoms === 'string' && rawFields.emotionalSymptoms.trim()
        ? rawFields.emotionalSymptoms.trim()
        : data.psychosomaticMapping || '',
    medications: typeof rawFields.medications === 'string' ? rawFields.medications.trim() : '',
    lifestyleNotes:
      typeof rawFields.lifestyleNotes === 'string' ? rawFields.lifestyleNotes.trim() : '',
  };

  const copilotAnalysis: CopilotAnalysisResult = {
    clinicalComplaints:
      rawFields.clinicalComplaints ||
      data.clinicalComplaints ||
      extractedFields.clinicalHistory ||
      '',
    psychosomaticMapping:
      rawFields.psychosomaticMapping ||
      data.psychosomaticMapping ||
      extractedFields.emotionalSymptoms ||
      '',
    centralIntention:
      rawFields.centralIntention ||
      data.centralIntention ||
      extractedFields.mainComplaint ||
      '',
    suggestedFocus:
      rawFields.suggestedFocus || data.suggestedFocus || 'Harmonização Integral',
    highlightedOrgansAndChakras: Array.isArray(rawFields.highlightedOrgansAndChakras)
      ? rawFields.highlightedOrgansAndChakras
      : Array.isArray(data.highlightedOrgansAndChakras)
      ? data.highlightedOrgansAndChakras
      : [],
  };

  return {
    transcription,
    extractedFields,
    copilotAnalysis,
  };
}
