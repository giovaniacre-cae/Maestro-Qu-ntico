import { GoogleGenAI } from '@google/genai';
import { CopilotAnalysisResult, InteragentType } from '../types/quantum';
import { FollowUpCategory } from './storage';

declare const process: { env?: Record<string, string | undefined> } | undefined;

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

export interface FollowUpClinicalContextInput {
  bovis?: number;
  hawkins?: number;
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
  chakrasSummary?: string;
}

export interface FollowUpAudioAnalysisInput {
  file: Blob;
  mimeType: string;
  fileName: string;
  patientName: string;
  category: FollowUpCategory;
  activeGraphics: string[];
  clinicalContext?: FollowUpClinicalContextInput;
  signal?: AbortSignal;
}

export interface FollowUpTextAnalysisInput {
  patientName: string;
  category: FollowUpCategory;
  narrative: string;
  activeGraphics: string[];
  clinicalContext?: FollowUpClinicalContextInput;
  signal?: AbortSignal;
}

export interface FollowUpAnalysisResult {
  transcription?: string;
  therapistAnalysis: string;
  patientFeedbackMessage: string;
}

const SINGLE_REQUEST_BASE64_LIMIT = 650_000;
const CHUNK_BASE64_SIZE = 320_000;

export function normalizeAudioBlobMimeType(blobOrMime: Blob | string): string {
  const raw = typeof blobOrMime === 'string' ? blobOrMime : blobOrMime.type || '';
  const base = raw.split(';')[0]?.trim().toLowerCase() || '';

  const aliases: Record<string, string> = {
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

  return aliases[base] || base || 'audio/webm';
}

export function blobToCleanBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const cleanBase64 = result.includes('base64,')
        ? result.split('base64,')[1].trim()
        : result.trim();
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const brMatch = trimmed.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  return '';
}

function getClientGeminiApiKey(): string {
  let envKey = '';
  try {
    envKey = process?.env?.GEMINI_API_KEY || '';
  } catch {
    envKey = '';
  }
  const viteKey =
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GEMINI_API_KEY || '';
  const chosen = (envKey || viteKey || '').trim();
  if (!chosen || chosen === 'MY_GEMINI_API_KEY') {
    return '';
  }
  return chosen;
}

function createDirectGeminiClient(): GoogleGenAI | null {
  const apiKey = getClientGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function getApiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

async function parseJsonOrThrowDetailedError<T>(res: Response, endpointLabel: string): Promise<T> {
  const rawText = await res.text();
  if (!rawText || !rawText.trim()) {
    throw new Error(
      `O servidor retornou uma resposta vazia (HTTP ${res.status}) em ${endpointLabel}.`
    );
  }

  let parsed: T & { error?: unknown };
  try {
    parsed = JSON.parse(rawText) as T & { error?: unknown };
  } catch {
    const snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    throw new Error(
      `HTTP ${res.status} em ${endpointLabel}${snippet ? `: ${snippet}` : ''}`
    );
  }

  if (!res.ok) {
    const message =
      parsed && typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error.trim()
        : `Erro HTTP ${res.status} ao processar requisição em ${endpointLabel}.`;
    throw new Error(message);
  }

  return parsed;
}

function cleanModelJsonText(raw?: string): string {
  return (raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function cleanStr(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\*/g, '').trim() : '';
}

function mapTranscribedPayload(
  data: Record<string, unknown>,
  partialTranscript?: string
): GeminiAudioExtractionResult {
  const rawFields =
    data.extractedFields && typeof data.extractedFields === 'object'
      ? (data.extractedFields as Record<string, unknown>)
      : data;

  const transcription = (
    cleanStr(data.transcription ?? data.transcript) ||
    (partialTranscript || '').trim()
  ).trim();

  const mainComplaint = cleanStr(
    rawFields.mainComplaint ?? rawFields.centralIntention ?? data.centralIntention
  );
  const clinicalHistory = cleanStr(
    rawFields.clinicalHistory ?? rawFields.clinicalComplaints ?? data.clinicalComplaints
  );
  const emotionalSymptoms = cleanStr(
    rawFields.emotionalSymptoms ??
      rawFields.psychosomaticMapping ??
      data.psychosomaticMapping
  );

  const extractedFields: ExtractedAnamnesisFields = {
    patientName: cleanStr(rawFields.patientName),
    birthDate: normalizeBirthDateInput(cleanStr(rawFields.birthDate)),
    mainComplaint,
    clinicalHistory,
    emotionalSymptoms,
    medications: cleanStr(rawFields.medications),
    lifestyleNotes: cleanStr(rawFields.lifestyleNotes),
  };

  const rawOrgans =
    rawFields.highlightedOrgansAndChakras ?? data.highlightedOrgansAndChakras;

  const copilotAnalysis: CopilotAnalysisResult = {
    clinicalComplaints: cleanStr(rawFields.clinicalComplaints) || clinicalHistory,
    psychosomaticMapping: cleanStr(rawFields.psychosomaticMapping) || emotionalSymptoms,
    centralIntention: cleanStr(rawFields.centralIntention) || mainComplaint,
    suggestedFocus:
      cleanStr(rawFields.suggestedFocus ?? data.suggestedFocus) || 'Harmonização Integral',
    highlightedOrgansAndChakras: Array.isArray(rawOrgans)
      ? rawOrgans.map((item) => cleanStr(item)).filter(Boolean)
      : [],
  };

  return {
    transcription,
    extractedFields,
    copilotAnalysis,
  };
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

  // 1. Direct browser execution via @google/genai when API key is present in client bundle
  const directAi = createDirectGeminiClient();
  if (directAi) {
    const cleanName =
      typeof patientName === 'string' && patientName.trim() ? patientName.trim() : 'Paciente';
    const isPet = interagentType === 'pet';
    const partialHint =
      typeof partialTranscript === 'string' && partialTranscript.trim()
        ? `\nRascunho parcial em tempo real (apoio para nomes próprios): "${partialTranscript.trim()}"`
        : '';

    const prompt = `Você é o Copiloto Clínico IA do sistema "Maestro Quântico" (Maestro Terapias Vibracionais).
Ouça atentamente a gravação de áudio da consulta presencial com ${isPet ? `o tutor do animal "${cleanName}"` : `o consulente "${cleanName}"`}.${partialHint}

Execute duas ações em uma única resposta JSON:
1. Transcreva literalmente e com fidelidade em português brasileiro tudo o que foi falado na gravação.
2. Extraia os campos da Ficha de Anamnese mencionados no áudio (use "" quando não citado).

Retorne EXCLUSIVAMENTE um JSON válido com esta estrutura exata:
{
  "transcription": "Transcrição literal, limpa e pontuada da gravação em português.",
  "extractedFields": {
    "patientName": "Nome completo do paciente ou animal se mencionado no áudio, ou ''",
    "birthDate": "Data de nascimento no formato YYYY-MM-DD se mencionada, ou ''",
    "mainComplaint": "Queixa principal / intenção central do atendimento sintetizada para o campo Foco do Atendimento",
    "clinicalHistory": "Sintomas físicos, dores localizadas, diagnósticos clínicos e histórico físico relatado",
    "emotionalSymptoms": "Sintomas emocionais, mentais, traumas, ansiedade, luto ou correlação psicossomática relatada",
    "medications": "Medicações em uso, suplementos ou acompanhamento médico/veterinário mencionado, ou ''",
    "lifestyleNotes": "Observações de estilo de vida, sono, rotina, ambiente doméstico ou notas clínicas do terapeuta",
    "suggestedFocus": "Escolha o foco principal mais compatível entre: Saúde Física, Equilíbrio Emocional, Limpeza Espiritual, Prosperidade/Material, Relacionamentos ou Saúde Animal / PETS.",
    "highlightedOrgansAndChakras": ["Lista de órgãos, sistemas ANSAE e chakras associados às queixas"]
  }
}`;

    const response = await directAi.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            data: audioBase64,
            mimeType,
          },
        },
        { text: prompt },
      ],
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        abortSignal: signal,
      },
    });

    const jsonText = cleanModelJsonText(response.text);
    if (!jsonText) {
      throw new Error('O Gemini retornou uma resposta vazia ao transcrever o áudio.');
    }

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return mapTranscribedPayload(parsed, partialTranscript);
  }

  // 2. Fallback to backend Express proxy when running full-stack with server-side GEMINI_API_KEY
  const apiBase = getApiBase();
  let uploadId: string | undefined;

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

  const data = await parseJsonOrThrowDetailedError<Record<string, unknown>>(
    res,
    '/api/anamnese/transcribe'
  );
  return mapTranscribedPayload(data, partialTranscript);
}

export async function analyzeAnamnesisTextWithGemini(options: {
  transcript: string;
  patientName?: string;
  signal?: AbortSignal;
}): Promise<CopilotAnalysisResult> {
  const { transcript, patientName, signal } = options;
  const cleanText = transcript.trim();
  if (!cleanText) {
    throw new Error('Transcrição vazia ou inválida para análise.');
  }

  const directAi = createDirectGeminiClient();
  if (directAi) {
    const prompt = `Você é o Copiloto Clínico IA do sistema "Maestro Quântico" (Maestro Terapias Vibracionais).
Analise a transcrição abaixo da escuta ativa de um atendimento terapêutico presencial com "${patientName || 'Paciente'}" e extraia os insights estruturados em JSON estrito.

TRANSCRIÇÃO DA SESSÃO:
"""
${cleanText}
"""

Retorne EXCLUSIVAMENTE um JSON válido com estas chaves:
{
  "clinicalComplaints": "Resumo detalhado dos sintomas físicos, dores localizadas e diagnósticos citados.",
  "psychosomaticMapping": "Correlação psicossomática profunda entre os sintomas físicos e os conflitos emocionais ou padrões mentais.",
  "centralIntention": "Intenção Central de Tratamento sintetizada no Padrão Maestro.",
  "suggestedFocus": "Foco principal do atendimento (ex.: Saúde Física, Equilíbrio Emocional, Limpeza Espiritual, Prosperidade/Material, Relacionamentos ou Saúde Animal / PETS).",
  "highlightedOrgansAndChakras": ["Lista de órgãos, sistemas ANSAE e chakras associados às queixas"]
}`;

    const response = await directAi.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        abortSignal: signal,
      },
    });

    const jsonText = cleanModelJsonText(response.text);
    if (!jsonText) {
      throw new Error('O Gemini retornou uma resposta vazia ao analisar o texto da anamnese.');
    }
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      clinicalComplaints: cleanStr(parsed.clinicalComplaints),
      psychosomaticMapping: cleanStr(parsed.psychosomaticMapping),
      centralIntention: cleanStr(parsed.centralIntention),
      suggestedFocus: cleanStr(parsed.suggestedFocus) || 'Harmonização Integral',
      highlightedOrgansAndChakras: Array.isArray(parsed.highlightedOrgansAndChakras)
        ? parsed.highlightedOrgansAndChakras.map((i) => cleanStr(i)).filter(Boolean)
        : [],
    };
  }

  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/anamnese/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      transcript: cleanText,
      patientName,
    }),
  });
  return parseJsonOrThrowDetailedError<CopilotAnalysisResult>(res, '/api/anamnese/copilot');
}

export async function analyzeFollowUpAudioWithGemini(
  input: FollowUpAudioAnalysisInput
): Promise<FollowUpAnalysisResult> {
  const { file, mimeType, fileName, patientName, category, activeGraphics, clinicalContext, signal } =
    input;

  const audioBase64 = await blobToCleanBase64(file);
  const normalizedMime = normalizeAudioBlobMimeType(mimeType || file.type || 'audio/webm');

  const directAi = createDirectGeminiClient();
  if (directAi) {
    const categoryLabelMap: Record<FollowUpCategory, string> = {
      sonho: 'Sonho / Simbologia Onírica',
      catarse_sintoma: 'Sintoma Físico / Catarse de Limpeza',
      evolucao_emocional: 'Evolução Emocional / Percepção Mental',
      retorno_geral: 'Retorno Geral de Acompanhamento',
    };
    const graphicsText =
      activeGraphics.length > 0
        ? activeGraphics.join(', ')
        : 'Nenhum gráfico ativo no momento';

    const contextLines = [
      clinicalContext?.therapeuticFocus
        ? `Intenção central da anamnese: ${clinicalContext.therapeuticFocus}`
        : '',
      typeof clinicalContext?.bovis === 'number'
        ? `Nível de Bovis aferido: ${clinicalContext.bovis.toLocaleString('pt-BR')} Å`
        : '',
      clinicalContext?.hawkinsLabel
        ? `Escala de Hawkins: ${clinicalContext.hawkinsLabel}`
        : typeof clinicalContext?.hawkins === 'number'
        ? `Escala de Hawkins: ${clinicalContext.hawkins} Hz`
        : '',
      typeof clinicalContext?.auricProtection === 'number'
        ? `Proteção áurica: ${clinicalContext.auricProtection}%`
        : '',
      clinicalContext?.imbalancedChakras?.length
        ? `Chakras em desequilíbrio: ${clinicalContext.imbalancedChakras.join(', ')}`
        : clinicalContext?.chakrasSummary
        ? `Chakras: ${clinicalContext.chakrasSummary}`
        : '',
      clinicalContext?.criticalOrgans?.length
        ? `Órgãos em alerta: ${clinicalContext.criticalOrgans.join(', ')}`
        : '',
      clinicalContext?.phaseLabel ? `Fase da mesa: ${clinicalContext.phaseLabel}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const prompt = `Você é o Analista Clínico Integrativo e Simbólico do sistema "Maestro Quântico" (Maestro Terapias Vibracionais, conduzido pelo terapeuta Giovani Caetano).
Ouça atentamente este áudio enviado pelo paciente "${patientName}" (categoria: ${categoryLabelMap[category]}).
Gráficos radiônicos ativos na mesa neste momento: ${graphicsText}.
${contextLines ? `Contexto clínico do paciente: ${contextLines}.` : ''}

Execute duas etapas e retorne EXCLUSIVAMENTE um JSON válido com estas três chaves:
{
  "transcription": "Transcrição fiel em português brasileiro de tudo o que foi relatado no áudio.",
  "therapistAnalysis": "Análise clínica objetiva para o terapeuta cruzando os símbolos/sintomas do áudio com os gráficos radiônicos ativos, chakras, Bovis, Hawkins e histórico.",
  "patientFeedbackMessage": "Mensagem acolhedora, tranquilizadora e humanizada pronta para enviar ao paciente via WhatsApp (sem asteriscos ou markdown)."
}`;

    const response = await directAi.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            data: audioBase64,
            mimeType: normalizedMime,
          },
        },
        { text: prompt },
      ],
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        abortSignal: signal,
      },
    });

    const jsonText = cleanModelJsonText(response.text);
    if (!jsonText) {
      throw new Error('O Gemini retornou uma resposta vazia ao transcrever o áudio do diário.');
    }
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      transcription: cleanStr(parsed.transcription),
      therapistAnalysis: cleanStr(parsed.therapistAnalysis),
      patientFeedbackMessage: cleanStr(parsed.patientFeedbackMessage),
    };
  }

  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/clinical/analyze-dream-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      audioBase64,
      mimeType: normalizedMime,
      fileName,
      patientName,
      category,
      activeGraphics,
      clinicalContext,
    }),
  });
  return parseJsonOrThrowDetailedError<FollowUpAnalysisResult>(
    res,
    '/api/clinical/analyze-dream-audio'
  );
}

export async function analyzeFollowUpTextWithGemini(
  input: FollowUpTextAnalysisInput
): Promise<FollowUpAnalysisResult> {
  const { patientName, category, narrative, activeGraphics, clinicalContext, signal } = input;

  const directAi = createDirectGeminiClient();
  if (directAi) {
    const graphicsText =
      activeGraphics.length > 0
        ? activeGraphics.join(', ')
        : 'Nenhum gráfico ativo no momento';
    const contextLines = [
      clinicalContext?.therapeuticFocus
        ? `Intenção central: ${clinicalContext.therapeuticFocus}`
        : '',
      typeof clinicalContext?.bovis === 'number'
        ? `Bovis: ${clinicalContext.bovis.toLocaleString('pt-BR')} Å`
        : '',
      clinicalContext?.hawkinsLabel
        ? `Hawkins: ${clinicalContext.hawkinsLabel}`
        : typeof clinicalContext?.hawkins === 'number'
        ? `Hawkins: ${clinicalContext.hawkins} Hz`
        : '',
      typeof clinicalContext?.auricProtection === 'number'
        ? `Proteção áurica: ${clinicalContext.auricProtection}%`
        : '',
      clinicalContext?.imbalancedChakras?.length
        ? `Chakras em desequilíbrio: ${clinicalContext.imbalancedChakras.join(', ')}`
        : clinicalContext?.chakrasSummary
        ? `Chakras: ${clinicalContext.chakrasSummary}`
        : '',
      clinicalContext?.criticalOrgans?.length
        ? `Órgãos em alerta: ${clinicalContext.criticalOrgans.join(', ')}`
        : '',
      clinicalContext?.phaseLabel ? `Fase da mesa: ${clinicalContext.phaseLabel}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const prompt = `Você é o Analista Clínico Integrativo e Simbólico do sistema "Maestro Quântico" (Maestro Terapias Vibracionais).
Analise o relato abaixo do paciente "${patientName}" (categoria: ${category}).
Gráficos ativos na mesa: ${graphicsText}.
${contextLines ? `Contexto clínico: ${contextLines}.` : ''}

RELATO DO PACIENTE:
"""
${narrative.trim()}
"""

Retorne EXCLUSIVAMENTE um JSON válido com estas duas chaves:
{
  "therapistAnalysis": "Análise clínica cruzando o relato com os gráficos ativos, chakras, Bovis, Hawkins e histórico.",
  "patientFeedbackMessage": "Devolutiva acolhedora, tranquilizadora e humanizada pronta para enviar ao paciente por WhatsApp (sem asteriscos)."
}`;

    const response = await directAi.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        abortSignal: signal,
      },
    });

    const jsonText = cleanModelJsonText(response.text);
    if (!jsonText) {
      throw new Error('O Gemini retornou uma resposta vazia ao analisar o relato.');
    }
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      therapistAnalysis: cleanStr(parsed.therapistAnalysis),
      patientFeedbackMessage: cleanStr(parsed.patientFeedbackMessage),
    };
  }

  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/clinical/analyze-dream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      patientName,
      category,
      narrative,
      activeGraphics,
      clinicalContext,
    }),
  });
  return parseJsonOrThrowDetailedError<FollowUpAnalysisResult>(res, '/api/clinical/analyze-dream');
}
