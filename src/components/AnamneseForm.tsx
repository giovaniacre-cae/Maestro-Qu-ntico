import React from 'react';
import { ArrowRight, UserCheck, UserPlus } from 'lucide-react';
import { PatientAnamnesis, QuantumRoomSession } from '../types/quantum';

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
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
            Etapa Clínica 01 · Anamnese & Testemunho Base
          </p>
          <h1 className="mt-1.5 font-serif text-3xl font-light text-[#0F172A]">
            Anamnese e Intenção Central
          </h1>
          <p className="mt-2 text-sm text-[#45464D] max-w-2xl">
            Registre os dados de sintonização do testemunho informacional, as queixas clínicas e o
            foco do atendimento para calibrar a leitura radiestésica.
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
