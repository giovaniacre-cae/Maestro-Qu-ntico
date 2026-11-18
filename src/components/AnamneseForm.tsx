import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { CopilotAnalysisResult, PatientAnamnesis, QuantumRoomSession } from '../types/quantum';

interface AnamneseFormProps {
  anamnesis: PatientAnamnesis;
  existingSessions: QuantumRoomSession[];
  onChange: (updated: PatientAnamnesis) => void;
  onSelectExistingSession: (sessionId: string) => void;
  onResetForm: () => void;
  onProceedToSensitivity: () => void;
}

export const AnamneseForm: React.FC<AnamneseFormProps> = ({
  anamnesis,
  existingSessions,
  onChange,
  onSelectExistingSession,
  onResetForm,
  onProceedToSensitivity,
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>(anamnesis.sessionTranscript || '');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [copilotAnalysis, setCopilotAnalysis] = useState<CopilotAnalysisResult | null>(
    anamnesis.copilotAnalysis || null
  );
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let timer: any = null;
    if (isListening && !isPaused) {
      timer = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isListening, isPaused]);

  const startListening = () => {
    setCopilotError(null);
    const SpeechAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) {
      setCopilotError(
        'Reconhecimento de fala nativo não suportado neste navegador. Você pode digitar ou colar a transcrição manualmente abaixo.'
      );
      setIsListening(true);
      setIsPaused(false);
      return;
    }

    try {
      if (!recognitionRef.current) {
        const recognition = new SpeechAPI();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let finalStr = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalStr += event.results[i][0].transcript + ' ';
            }
          }
          if (finalStr) {
            setTranscript((prev) => {
              const next = (prev ? prev + ' ' : '') + finalStr.trim();
              onChange({ ...anamnesis, sessionTranscript: next });
              return next;
            });
          }
        };
        recognition.onerror = (e: any) => {
          console.warn('Speech recognition error:', e);
        };
        recognition.onend = () => {
          if (isListening && !isPaused) {
            try {
              recognition.start();
            } catch {}
          }
        };
        recognitionRef.current = recognition;
      }
      recognitionRef.current.start();
      setIsListening(true);
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsListening(true);
      setIsPaused(false);
    }
  };

  const pauseListening = () => {
    setIsPaused(true);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  const resumeListening = () => {
    setIsPaused(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {}
    }
  };

  const stopAndAnalyze = async () => {
    setIsListening(false);
    setIsPaused(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const currentText = transcript.trim();
    if (!currentText) {
      setCopilotError(
        'Nenhum conteúdo na transcrição para analisar. Fale ao microfone ou digite a anamnese abaixo.'
      );
      return;
    }

    setIsAnalyzing(true);
    setCopilotError(null);
    try {
      const res = await fetch('/api/anamnese/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: currentText,
          patientName: anamnesis.fullName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar análise da Copiloto IA.');
      }
      setCopilotAnalysis(data);

      // Auto-fill form fields immediately
      onChange({
        ...anamnesis,
        sessionTranscript: currentText,
        copilotAnalysis: data,
        physicalSymptoms: data.clinicalComplaints || anamnesis.physicalSymptoms,
        emotionalHistory: data.psychosomaticMapping || anamnesis.emotionalHistory,
        therapeuticFocus: data.centralIntention || anamnesis.therapeuticFocus,
      });
      setSuccessNotice('Análise concluída e ficha preenchida automaticamente pela Copiloto IA!');
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err) {
      setCopilotError(err instanceof Error ? err.message : 'Erro ao comunicar com o servidor.');
    } finally {
      setIsAnalyzing(false);
    }
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

  const handleField = (field: keyof PatientAnamnesis, value: string) => {
    onChange({ ...anamnesis, [field]: value });
  };

  const canProceed =
    anamnesis.fullName.trim().length >= 3 &&
    anamnesis.birthDate.trim().length > 0 &&
    anamnesis.therapeuticFocus.trim().length >= 3;

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
                    {s.anamnesis.fullName}
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
            {!isListening ? (
              <button
                type="button"
                onClick={startListening}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] shadow-sm cursor-pointer whitespace-nowrap"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                Iniciar Escuta / Gravação
              </button>
            ) : isPaused ? (
              <button
                type="button"
                onClick={resumeListening}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0F172A] bg-[#FEF3C7] border border-[#D97706]/50 rounded-lg hover:bg-[#FDE68A] cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-[#B45309]" />
                Retomar Escuta
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseListening}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0F172A] bg-[#FEF3C7] border border-[#D97706]/50 rounded-lg hover:bg-[#FDE68A] cursor-pointer whitespace-nowrap"
              >
                <Pause className="w-3.5 h-3.5 text-[#B45309]" />
                Pausar Gravação
              </button>
            )}

            <button
              type="button"
              disabled={isAnalyzing || (!transcript.trim() && !isListening)}
              onClick={stopAndAnalyze}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analisando com Copiloto IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Encerrar e Analisar com Copiloto IA
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Status & Timer */}
        {(isListening || durationSeconds > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] text-xs">
            <div className="flex items-center gap-2">
              {isListening && !isPaused ? (
                <>
                  <span className="w-3 h-3 rounded-full bg-[#DC2626] animate-ping" />
                  <span className="font-bold text-[#DC2626]">Captando áudio em tempo real...</span>
                </>
              ) : isPaused ? (
                <>
                  <span className="w-3 h-3 rounded-full bg-[#D97706]" />
                  <span className="font-bold text-[#B45309]">Gravação pausada</span>
                </>
              ) : (
                <span className="font-semibold text-[#64748B]">Escuta encerrada</span>
              )}
            </div>
            <div className="font-mono font-semibold text-[#0F172A]">
              Duração da Consulta: {formatTimer(durationSeconds)}
            </div>
          </div>
        )}

        {copilotError && (
          <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#BA1A1A]/40 text-xs text-[#93000A]">
            {copilotError}
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

            {successNotice && (
              <div className="p-3 rounded-lg bg-[#DCFCE7] border border-[#16A34A]/40 text-xs font-semibold text-[#166534]">
                {successNotice}
              </div>
            )}

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
          <h2 className="font-serif text-lg font-bold text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
            Identificação e Foco do Atendimento
          </h2>

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
              placeholder="Ex.: Equilíbrio Neuroemocional, Vitalidade e Prosperidade Profissional"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
            />
            <p className="mt-1.5 text-xs text-[#64748B]">
              Se o foco incluir prosperidade, finanças ou carreira, o algoritmo habilita o arquétipo
              Turbilhão com Prosperador na Etapa 2.
            </p>
          </div>

          <div>
            <label
              htmlFor="medicalTreatments"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Acompanhamento Médico / Medicações em Uso
            </label>
            <textarea
              id="medicalTreatments"
              rows={3}
              value={anamnesis.medicalTreatments}
              onChange={(e) => handleField('medicalTreatments', e.target.value)}
              placeholder="Descreva diagnósticos clínicos, acompanhamentos médicos ou medicações atuais..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
            />
          </div>
        </div>

        {/* Queixas Clínicas e Histórico */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)] flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <h2 className="font-serif text-lg font-bold text-[#0F172A] pb-3 border-b border-[#E2E8F0]">
              Queixas Clínicas e Mapeamento Psicossomático
            </h2>

            <div>
              <label
                htmlFor="emotionalHistory"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Histórico Emocional, Mental e Gatilhos Recentes
              </label>
              <textarea
                id="emotionalHistory"
                rows={4}
                value={anamnesis.emotionalHistory}
                onChange={(e) => handleField('emotionalHistory', e.target.value)}
                placeholder="Ansiedade, luto, sobrecarga familiar/profissional, padrões de pensamento recorrentes, qualidade do sono..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
              />
            </div>

            <div>
              <label
                htmlFor="physicalSymptoms"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Queixas Clínicas Físicas e Sinais Corporais
              </label>
              <textarea
                id="physicalSymptoms"
                rows={4}
                value={anamnesis.physicalSymptoms}
                onChange={(e) => handleField('physicalSymptoms', e.target.value)}
                placeholder="Fadiga, dores musculares/cervicais, alterações digestivas, baixa imunidade, enxaqueca..."
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
                placeholder="Percepções iniciais durante a entrevista clínica..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/15"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-[#64748B]">
              Campos com * são obrigatórios para formatar o Testemunho Informacional.
            </p>
            <button
              type="submit"
              disabled={!canProceed}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] hover:shadow-[0_0_16px_rgba(217,119,6,0.25)] disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
            >
              Avançar para Sintonia Sensitiva
              <ArrowRight className="w-4 h-4 text-[#F59E0B]" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

