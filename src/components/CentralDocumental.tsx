import React, { useMemo, useState } from 'react';
import { Download, FileText, MessageCircle, Radio } from 'lucide-react';
import {
  ClinicalAnsaeRhenSheet,
  ClinicalSessionRecord,
  SessionMilestoneType,
} from '../types/clinical';
import { QuantumRoomSession } from '../types/quantum';
import { formatBirthDateBR, getHawkinsLevelInfo } from '../utils/antiCatharsis';
import {
  DocumentExportContext,
  buildWhatsAppShareUrl,
  downloadPatientGuideDocx,
  downloadPatientGuidePdf,
  downloadTherapistDocx,
  downloadTherapistPdf,
} from '../utils/documentGenerator';
import { getAnsaeDraftForSession, getPreviousSessionForPatient } from '../utils/storage';

interface CentralDocumentalProps {
  sessions: QuantumRoomSession[];
  activeSession: QuantumRoomSession;
  ansaeSheet?: ClinicalAnsaeRhenSheet;
  sessionType?: SessionMilestoneType;
  previousSession?: ClinicalSessionRecord | null;
  onSelectSession: (sessionId: string) => void;
  onGoToTable: () => void;
}

export const CentralDocumental: React.FC<CentralDocumentalProps> = ({
  sessions,
  activeSession,
  ansaeSheet,
  sessionType,
  previousSession,
  onSelectSession,
  onGoToTable,
}) => {
  const [docTab, setDocTab] = useState<'therapist' | 'patient'>('therapist');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { anamnesis, sensitivity, protocol, aiResult } = activeSession;
  const resolvedSheet = useMemo(
    () => ansaeSheet || getAnsaeDraftForSession(activeSession),
    [ansaeSheet, activeSession]
  );
  const resolvedPrev = useMemo(
    () =>
      previousSession !== undefined
        ? previousSession
        : getPreviousSessionForPatient(activeSession.anamnesis.id, activeSession.id),
    [previousSession, activeSession]
  );
  const resolvedSessionType = sessionType || activeSession.sessionType || 'Avaliação Inicial';

  const exportCtx: DocumentExportContext = {
    ansaeSheet: resolvedSheet,
    previousSession: resolvedPrev,
    sessionType: resolvedSessionType,
  };

  const hawkinsInfo = getHawkinsLevelInfo(sensitivity.hawkins);
  const imbalancedOrgans = resolvedSheet.organs.filter((o) => o.isImbalanced);

  const handleDownload = async (key: string, fn: () => Promise<void> | void) => {
    setBusyAction(key);
    setDownloadError(null);
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar arquivo para download.';
      setDownloadError(msg);
    } finally {
      setBusyAction(null);
    }
  };

  const whatsappUrl = buildWhatsAppShareUrl(activeSession, exportCtx);

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[#B45309]">
            Etapa Clínica 04 · Central Documental Padrão Maestro v2.0
          </p>
          <h1 className="mt-1.5 font-serif text-3xl font-light text-[#0F172A]">
            Emissão de Documentos Oficiais
          </h1>
          <p className="mt-2 text-sm text-[#45464D] max-w-2xl">
            Exporte o Relatório Técnico completo (ANSAE + RHEN + Biômetros + Anti-Catarse) em Word
            (.DOCX editável) ou PDF e o Guia Humanizado para envio direto ao paciente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {sessions.length > 0 && (
            <select
              aria-label="Selecionar paciente para geração documental"
              value={activeSession.id}
              onChange={(e) => onSelectSession(e.target.value)}
              className="px-3.5 py-2 text-xs font-medium bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] focus:outline-none focus:border-[#D97706]"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.anamnesis.fullName}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onGoToTable}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg hover:border-[#D97706] cursor-pointer whitespace-nowrap"
          >
            <Radio className="w-3.5 h-3.5 text-[#B45309]" />
            Voltar à Mesa
          </button>
        </div>
      </section>

      {downloadError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-[#BA1A1A]/5 border border-[#BA1A1A]/30 text-xs text-[#93000A]"
        >
          {downloadError}
        </div>
      )}

      {/* Document Type Segmented Switch + Export Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.04)]">
        <div
          role="tablist"
          aria-label="Tipo de Documento Oficial"
          className="inline-flex items-center gap-1 p-1 bg-[#FAF8F5] border border-[#E2E8F0] rounded-lg self-start"
        >
          <button
            type="button"
            onClick={() => setDocTab('therapist')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              docTab === 'therapist'
                ? 'bg-[#0F172A] text-white'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Documento 1 · Relatório Técnico (Terapeuta)
          </button>
          <button
            type="button"
            onClick={() => setDocTab('patient')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              docTab === 'patient'
                ? 'bg-[#0F172A] text-white'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Documento 2 · Guia do Paciente
          </button>
        </div>

        {/* Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {docTab === 'therapist' ? (
            <>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  handleDownload('t-docx', () => downloadTherapistDocx(activeSession, exportCtx))
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                {busyAction === 't-docx' ? 'Gerando DOCX...' : 'Baixar .DOCX (Editável)'}
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  handleDownload('t-pdf', () => downloadTherapistPdf(activeSession, exportCtx))
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#B45309] bg-white border border-[#D97706] rounded-lg hover:bg-[#D97706]/5 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                {busyAction === 't-pdf' ? 'Gerando PDF...' : 'Baixar .PDF Oficial'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  handleDownload('p-docx', () =>
                    downloadPatientGuideDocx(activeSession, exportCtx)
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                {busyAction === 'p-docx' ? 'Gerando DOCX...' : 'Baixar Guia .DOCX (Editável)'}
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  handleDownload('p-pdf', () => downloadPatientGuidePdf(activeSession, exportCtx))
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#B45309] bg-white border border-[#D97706] rounded-lg hover:bg-[#D97706]/5 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                {busyAction === 'p-pdf' ? 'Gerando PDF...' : 'Baixar Guia .PDF'}
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] rounded-lg hover:bg-[#15803D] transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Compartilhar Resumo no WhatsApp
              </a>
            </>
          )}
        </div>
      </div>

      {/* Live Document Paper Preview (Padrão Maestro) */}
      <article className="max-w-[920px] mx-auto bg-white border border-[#E2E8F0] rounded-xl p-8 sm:p-12 shadow-[0_4px_24px_-2px_rgba(15,23,42,0.06)] space-y-8">
        {/* Cabeçalho Oficial Obrigatório */}
        <header className="text-center space-y-1.5 pb-6 border-b-2 border-[#B45309]">
          <img
            src="./assets/aistudio/Logo_Maestro_terapias_Vibracionais_Sem_fundo__2__f6ac1f97.png"
            alt="Logo Maestro Terapias Vibracionais"
            referrerPolicy="no-referrer"
            className="w-24 h-24 mx-auto object-contain mb-2"
          />
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-wide text-[#0F172A] uppercase">
            MAESTRO TERAPIAS VIBRACIONAIS
          </h2>
          <p className="font-serif italic text-base font-semibold text-[#B45309]">
            {docTab === 'therapist'
              ? 'Relatório Técnico Completo — ANSAE + RHEN & Protocolo Vibracional'
              : 'Guia de Orientação e Conscientização Vibracional'}
          </p>
          <p className="text-xs sm:text-sm text-[#0F172A] pt-1">
            <strong>Giovani Caetano</strong> | Terapeuta Vibracional • Radiestesista Terapêutico •
            Neuroterapia &amp; Hipnoterapia
          </p>
          <p className="text-xs text-[#64748B]">
            Atendimentos Integrativos • Contatos: (68) 99247-6436 | (11) 95056-5215
          </p>
        </header>

        {docTab === 'therapist' ? (
          <div className="space-y-7 text-sm text-[#334155] leading-relaxed">
            {/* 1. Identificação */}
            <section className="space-y-3">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                1. Quadro de Identificação ({resolvedSessionType})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#FAF8F5] p-4 rounded-lg border border-[#E2E8F0]">
                <p>
                  <strong className="text-[#0F172A]">Paciente:</strong> {anamnesis.fullName}
                </p>
                <p>
                  <strong className="text-[#0F172A]">Nascimento:</strong>{' '}
                  {formatBirthDateBR(anamnesis.birthDate)}
                </p>
                <p>
                  <strong className="text-[#0F172A]">Contato:</strong>{' '}
                  {anamnesis.phone || 'Não informado'}
                </p>
                <p>
                  <strong className="text-[#0F172A]">Mesa Indicada:</strong>{' '}
                  {resolvedSheet.spiritualPsycho.recommendedRadionicBoard}
                </p>
                <p className="sm:col-span-2">
                  <strong className="text-[#0F172A]">Foco Terapêutico:</strong>{' '}
                  {anamnesis.therapeuticFocus}
                </p>
                <p className="sm:col-span-2">
                  <strong className="text-[#0F172A]">Pergunta Raiz:</strong>{' '}
                  {resolvedSheet.rootProblems.join(', ') || 'Avaliação Geral'}
                </p>
              </div>
            </section>

            {/* 2. Campos Eletromagnéticos & 7 Chakras + Glândulas */}
            <section className="space-y-4">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                2. Campos Eletromagnéticos & Sete Chakras + Glândulas
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-[#E2E8F0]">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-left text-[#0F172A]">
                      <th className="p-2 border border-[#E2E8F0]">Campo</th>
                      <th className="p-2 border border-[#E2E8F0]">Desequilíbrio</th>
                      <th className="p-2 border border-[#E2E8F0]">Chakras Afetados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedSheet.electromagneticFields.map((f) => (
                      <tr key={f.id}>
                        <td className="p-2 border border-[#E2E8F0] font-semibold text-[#0F172A]">
                          {f.label}
                        </td>
                        <td className="p-2 border border-[#E2E8F0] font-mono tabular-nums">
                          {f.imbalancePercent}%
                        </td>
                        <td className="p-2 border border-[#E2E8F0]">
                          {f.affectedChakras.join(', ') || 'Sem comprometimento'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-[#E2E8F0]">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-left text-[#0F172A]">
                      <th className="p-2 border border-[#E2E8F0]">Chakra</th>
                      <th className="p-2 border border-[#E2E8F0]">Glândula</th>
                      <th className="p-2 border border-[#E2E8F0]">Polaridade</th>
                      <th className="p-2 border border-[#E2E8F0]">Desequilíbrio</th>
                      <th className="p-2 border border-[#E2E8F0]">Afeta Físico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedSheet.chakras.map((c) => (
                      <tr key={c.id}>
                        <td className="p-2 border border-[#E2E8F0] font-semibold text-[#0F172A]">
                          {c.name} ({c.sanskrit})
                        </td>
                        <td className="p-2 border border-[#E2E8F0]">{c.gland}</td>
                        <td className="p-2 border border-[#E2E8F0] font-semibold text-[#B45309]">
                          {c.status}
                        </td>
                        <td className="p-2 border border-[#E2E8F0] font-mono tabular-nums">
                          {c.imbalancePercent}%
                        </td>
                        <td className="p-2 border border-[#E2E8F0]">
                          {c.affectsPhysicalBody ? 'Sim' : 'Não'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. Campo Áurico, Cores, Áreas da Vida & Dimensão Espiritual */}
            <section className="space-y-3">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                3. Campo Áurico, Cromoterapia, Áreas da Vida & Dimensão Espiritual
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-[#E2E8F0]">
                  <tbody>
                    <tr>
                      <td className="p-2.5 border border-[#E2E8F0] bg-[#FAF8F5] font-semibold text-[#0F172A] w-52">
                        Biômetro de Bovis
                      </td>
                      <td className="p-2.5 border border-[#E2E8F0] font-mono">
                        {resolvedSheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-[#E2E8F0] bg-[#FAF8F5] font-semibold text-[#0F172A]">
                        Hawkins / Ágatha
                      </td>
                      <td className="p-2.5 border border-[#E2E8F0]">
                        {resolvedSheet.spiritualPsycho.hawkinsAgathaHz} Hz ({hawkinsInfo.label} ·{' '}
                        {hawkinsInfo.zone})
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-[#E2E8F0] bg-[#FAF8F5] font-semibold text-[#0F172A]">
                        Estresse & Polaridade
                      </td>
                      <td className="p-2.5 border border-[#E2E8F0] font-mono">
                        Estresse {resolvedSheet.spiritualPsycho.stressLevel}/9 ·{' '}
                        {resolvedSheet.spiritualPsycho.yinPercent}% Yin /{' '}
                        {resolvedSheet.spiritualPsycho.yangPercent}% Yang
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-[#E2E8F0] bg-[#FAF8F5] font-semibold text-[#0F172A]">
                        Campo Áurico & Cores
                      </td>
                      <td className="p-2.5 border border-[#E2E8F0]">
                        Proteção: {resolvedSheet.auricField.protectionLabel} (
                        {resolvedSheet.auricField.protectionPercent}%) · Tamanho:{' '}
                        {resolvedSheet.auricField.sizeLabel} ({resolvedSheet.auricField.sizePercent}
                        %) <br />
                        <strong>Cores em falta:</strong>{' '}
                        {resolvedSheet.auricField.missingColors.join(', ') || '—'} ·{' '}
                        <strong>Em excesso:</strong>{' '}
                        {resolvedSheet.auricField.excessColors.join(', ') || '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-[#E2E8F0] bg-[#FAF8F5] font-semibold text-[#0F172A]">
                        Áreas da Vida (RHEN)
                      </td>
                      <td className="p-2.5 border border-[#E2E8F0]">
                        Familiar: {resolvedSheet.lifeAreas.familiar} · Afetivo:{' '}
                        {resolvedSheet.lifeAreas.relacionamentoAfetivo} · Profissional:{' '}
                        {resolvedSheet.lifeAreas.profissional} · Financeiro:{' '}
                        {resolvedSheet.lifeAreas.financeiro} · Missão:{' '}
                        {resolvedSheet.lifeAreas.missaoDeVida}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-[#E2E8F0] bg-[#FAF8F5] font-semibold text-[#0F172A]">
                        Varredura Espiritual & Virtudes
                      </td>
                      <td className="p-2.5 border border-[#E2E8F0]">
                        Distúrbios:{' '}
                        {resolvedSheet.spiritualPsycho.spiritualDisturbances.join(', ') || 'Nenhum'}{' '}
                        · Implantes:{' '}
                        {resolvedSheet.spiritualPsycho.implantsDetected.join(', ') || 'Nenhum'} ·
                        Carma:{' '}
                        {resolvedSheet.spiritualPsycho.karmicCommitments.join(', ') || 'Nenhum'}{' '}
                        <br />
                        <strong>Virtudes a ancorar:</strong>{' '}
                        {resolvedSheet.spiritualPsycho.virtuesToAnchor.join(', ')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. Sistemas & Órgãos ANSAE + Biômetros Consultados */}
            <section className="space-y-3">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                4. Sistemas & Órgãos ANSAE em Alerta ({imbalancedOrgans.length}) e Biômetros
              </h3>
              {imbalancedOrgans.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse border border-[#E2E8F0]">
                    <thead>
                      <tr className="bg-[#FAF8F5] text-left text-[#0F172A]">
                        <th className="p-2 border border-[#E2E8F0]">Sigla</th>
                        <th className="p-2 border border-[#E2E8F0]">Sistema</th>
                        <th className="p-2 border border-[#E2E8F0]">Órgão / Glândula</th>
                        <th className="p-2 border border-[#E2E8F0]">%</th>
                        <th className="p-2 border border-[#E2E8F0]">Tempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imbalancedOrgans.map((o) => (
                        <tr key={o.id}>
                          <td className="p-2 border border-[#E2E8F0] font-mono font-bold text-[#B45309]">
                            {o.systemCode}
                          </td>
                          <td className="p-2 border border-[#E2E8F0]">{o.systemName}</td>
                          <td className="p-2 border border-[#E2E8F0] font-semibold text-[#0F172A]">
                            {o.organName}
                          </td>
                          <td className="p-2 border border-[#E2E8F0] font-mono">
                            {o.imbalancePercent}%
                          </td>
                          <td className="p-2 border border-[#E2E8F0] font-mono">
                            {o.durationValue}
                            {o.durationUnit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#64748B]">
                  Nenhum dos 38 órgãos ANSAE foi marcado em desequilíbrio.
                </p>
              )}

              {resolvedSheet.biometerReadings.length > 0 && (
                <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] text-xs space-y-1">
                  <p className="font-semibold text-[#0F172A]">Biômetros Virtuais Consultados:</p>
                  <p>
                    {resolvedSheet.biometerReadings
                      .map((b) => `${b.biometerName}: ${b.selectedItem}`)
                      .join(' · ')}
                  </p>
                </div>
              )}
            </section>

            {/* 5. Causa Raiz, Comparativo & Diagnóstico Psicossomático */}
            <section className="space-y-3">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                5. Análise da Causa Raiz & Diagnóstico Psicossomático
              </h3>
              {(resolvedPrev || aiResult?.comparativoEvolutivo) && (
                <div className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#D97706]/40 text-xs space-y-1">
                  <p className="font-bold text-[#B45309]">Comparativo Evolutivo (Antes × Depois):</p>
                  {resolvedPrev && (
                    <p className="font-mono text-[#0F172A]">
                      Bovis: {resolvedPrev.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å →{' '}
                      {resolvedSheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å · Hawkins:{' '}
                      {resolvedPrev.ansaeRhen.spiritualPsycho.hawkinsAgathaHz} Hz →{' '}
                      {resolvedSheet.spiritualPsycho.hawkinsAgathaHz} Hz · Aura:{' '}
                      {resolvedPrev.ansaeRhen.auricField.protectionPercent}% →{' '}
                      {resolvedSheet.auricField.protectionPercent}%
                    </p>
                  )}
                  {aiResult?.comparativoEvolutivo && (
                    <p className="text-[#334155] pt-1">{aiResult.comparativoEvolutivo}</p>
                  )}
                </div>
              )}
              {aiResult?.analiseCausaRaiz && (
                <p className="whitespace-pre-line">
                  <strong className="text-[#0F172A]">Causa Raiz Cruzada: </strong>
                  {aiResult.analiseCausaRaiz}
                </p>
              )}
              <p className="whitespace-pre-line">
                {aiResult?.analisePsicossomatica ||
                  'Gere a análise na Tela 4 (Mesa Radiônica) para incluir o diagnóstico psicossomático completo.'}
              </p>
            </section>

            {/* 6. Cronograma Anti-Catarse */}
            <section className="space-y-2">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                6. Cronograma Anti-Catarse em Etapas
              </h3>
              {protocol.mode === 'escalonado' && protocol.stage1 && protocol.stage2 ? (
                <div className="space-y-2 text-xs sm:text-sm">
                  <p>
                    <strong className="text-[#B45309]">{protocol.stage1.title} (48h–72h):</strong>{' '}
                    {protocol.stage1.geometries.map((g) => g.name).join(', ')}.
                  </p>
                  <p>
                    <strong className="text-[#0F172A]">Intervalo de Repouso:</strong> Pausa
                    obrigatória de {protocol.restIntervalHours} horas entre as etapas.
                  </p>
                  <p>
                    <strong className="text-[#B45309]">{protocol.stage2.title} (7–10 dias):</strong>{' '}
                    {protocol.stage2.geometries.map((g) => g.name).join(', ')}.
                  </p>
                </div>
              ) : (
                <p>
                  <strong>Protocolo Direto em Etapa Única (7–10 dias):</strong>{' '}
                  {protocol.singleStage?.geometries.map((g) => g.name).join(', ')}.
                </p>
              )}
            </section>

            {/* 7. Testemunhos e Comandos Quânticos */}
            <section className="space-y-3">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                7. Painel de Testemunhos e Comandos Quânticos
              </h3>
              {aiResult ? (
                <div className="space-y-3">
                  {aiResult.testemunhos.map((t, i) => (
                    <p
                      key={i}
                      className="text-xs font-mono bg-[#FAF8F5] p-2.5 rounded border border-[#E2E8F0]"
                    >
                      <strong>{t.geometria}:</strong> {t.testemunhoFormatado}
                    </p>
                  ))}
                  {aiResult.comandosQuanticos.map((c, i) => (
                    <blockquote
                      key={i}
                      className="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0] font-serif italic text-xs sm:text-sm text-[#0F172A]"
                    >
                      <span className="not-italic font-sans font-bold text-[#B45309] block mb-1">
                        {c.tituloComando} ({c.etapa})
                      </span>
                      &ldquo;{c.comandoTexto}&rdquo;
                    </blockquote>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#64748B]">Nenhum comando gerado ainda.</p>
              )}
            </section>

            {/* 8. Prescrições & Ressalva */}
            <section className="space-y-2">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                8. Prescrições Integrativas, Cristais, Bons Hábitos & Ressalva Ética
              </h3>
              {aiResult?.prescricoes && (
                <div className="space-y-1.5 text-xs sm:text-sm">
                  <p>
                    <strong>Florais de Bach:</strong> {aiResult.prescricoes.floraisBach.join(' • ')}
                  </p>
                  {aiResult.prescricoes.cristais && aiResult.prescricoes.cristais.length > 0 && (
                    <p>
                      <strong>Cristais Terapêuticos:</strong>{' '}
                      {aiResult.prescricoes.cristais.join(' • ')}
                    </p>
                  )}
                  <p>
                    <strong>Fitoterapia / Chás:</strong>{' '}
                    {aiResult.prescricoes.fitoterapiaChas.join(' • ')}
                  </p>
                  {aiResult.prescricoes.bonsHabitos &&
                    aiResult.prescricoes.bonsHabitos.length > 0 && (
                      <p>
                        <strong>Bons Hábitos:</strong>{' '}
                        {aiResult.prescricoes.bonsHabitos.join(' • ')}
                      </p>
                    )}
                  <p>
                    <strong>Frequências Solfeggio:</strong>{' '}
                    {aiResult.prescricoes.frequenciasSolfeggio
                      .map((f) => `${f.nome} (${f.indicacao})`)
                      .join(' | ')}
                  </p>
                </div>
              )}
              <p className="pt-3 text-xs text-[#64748B] italic">
                Ressalva Ética: Este documento registra terapias integrativas vibracionais de
                caráter estritamente complementar, não substituindo diagnóstico ou tratamento médico
                convencional.
              </p>
            </section>
          </div>
        ) : (
          /* Documento 2 — Guia Humanizado para o Paciente */
          <div className="space-y-7 text-sm text-[#334155] leading-relaxed">
            <div className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0]">
              <p className="font-serif text-base font-bold text-[#0F172A]">
                Olá, {anamnesis.fullName}
              </p>
              <p className="mt-1 text-xs text-[#45464D]">
                Foco do seu acompanhamento: <strong>{anamnesis.therapeuticFocus}</strong>
              </p>
            </div>

            <section className="space-y-2">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                Seu Momento Energético Atual
              </h3>
              <p className="whitespace-pre-line">
                {aiResult?.orientacaoPacienteResumo ||
                  'Realizamos uma leitura cuidadosa do seu campo energético para acolher sinais de desgaste e fortalecer sua vitalidade de forma gradual e segura.'}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                Seus Chakras, Cores da Aura & Hábitos na Prática
              </h3>
              <p className="whitespace-pre-line">
                {aiResult?.orientacaoChakrasAuraHabitos ||
                  `Cores que nutrem seu campo neste ciclo: ${
                    resolvedSheet.auricField.missingColors.join(', ') || 'Dourado e Verde Esmeralda'
                  }. Busque incluir esses tons no vestuário ou na visualização diária durante respirações tranquilas.`}
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif text-base font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1.5">
                Os 4 Pilares Diários de Autocuidado
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0]">
                  <p className="font-bold text-[#B45309] mb-1">1. Hidratação e Fitoterapia</p>
                  <p>
                    {aiResult?.prescricoes.pilaresAutocuidado.hidratacaoFitoterapia ||
                      'Ingira ao menos 2 litros de água pura ao dia e utilize os chás calmantes sugeridos.'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0]">
                  <p className="font-bold text-[#B45309] mb-1">2. Higiene Mental e Oração</p>
                  <p>
                    {aiResult?.prescricoes.pilaresAutocuidado.higieneMentalOracao ||
                      'Dedique 10 minutos diários à respiração tranquila, gratidão ou oração antes de dormir.'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0]">
                  <p className="font-bold text-[#B45309] mb-1">3. Harmonia do Ambiente</p>
                  <p>
                    {aiResult?.prescricoes.pilaresAutocuidado.ambiente ||
                      'Mantenha seu ambiente de descanso arejado, organizado e com luz suave ao anoitecer.'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E2E8F0]">
                  <p className="font-bold text-[#B45309] mb-1">
                    4. Acompanhamento Médico Convencional
                  </p>
                  <p>
                    {aiResult?.prescricoes.pilaresAutocuidado.acompanhamentoMedico ||
                      'Mantenha normalmente suas consultas médicas, exames e medicações prescritas.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </article>
    </div>
  );
};
