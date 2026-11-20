import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const HAWKINS_CANONICAL_LEVELS: ReadonlyArray<{ hz: number; label: string }> = [
  { hz: 20, label: 'Vergonha (20 Hz)' },
  { hz: 30, label: 'Culpa (30 Hz)' },
  { hz: 50, label: 'Apatia (50 Hz)' },
  { hz: 75, label: 'Tristeza (75 Hz)' },
  { hz: 100, label: 'Medo (100 Hz)' },
  { hz: 125, label: 'Desejo (125 Hz)' },
  { hz: 150, label: 'Raiva (150 Hz)' },
  { hz: 175, label: 'Orgulho (175 Hz)' },
  { hz: 200, label: 'Coragem (200 Hz)' },
  { hz: 250, label: 'Neutralidade (250 Hz)' },
  { hz: 310, label: 'Boa Vontade (310 Hz)' },
  { hz: 350, label: 'Aceitação (350 Hz)' },
  { hz: 400, label: 'Razão (400 Hz)' },
  { hz: 500, label: 'Amor (500 Hz)' },
  { hz: 520, label: 'Entrega (520 Hz)' },
  { hz: 540, label: 'Alegria (540 Hz)' },
  { hz: 580, label: 'Completude (580 Hz)' },
  { hz: 600, label: 'Paz (600 Hz)' },
  { hz: 700, label: 'Iluminação (700 Hz)' },
  { hz: 800, label: 'Gratidão / Iluminação Plena (800 Hz)' },
  { hz: 1000, label: 'Consciência Crística / Iluminação Suprema (1000 Hz)' },
];

function getHawkinsLabelServer(hz: number): string {
  const safeHz = Number.isFinite(hz) ? Math.max(20, Math.min(1000, hz)) : 200;
  let closest = HAWKINS_CANONICAL_LEVELS[0];
  let bestDiff = Math.abs(safeHz - closest.hz);
  for (let i = 1; i < HAWKINS_CANONICAL_LEVELS.length; i++) {
    const diff = Math.abs(safeHz - HAWKINS_CANONICAL_LEVELS[i].hz);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = HAWKINS_CANONICAL_LEVELS[i];
    }
  }
  return closest.label;
}

const AURIC_COLOR_CHAKRA_MAP_SERVER: Record<
  string,
  { name: string; chakra: string; tier: 'inferior' | 'medio' | 'superior' | 'complementar' }
> = {
  vermelho: { name: 'Vermelho', chakra: 'Básico / Muladhara', tier: 'inferior' },
  'vermelho denso': { name: 'Vermelho', chakra: 'Básico / Muladhara', tier: 'inferior' },
  laranja: { name: 'Laranja', chakra: 'Sacro / Svadhisthana', tier: 'inferior' },
  'laranja escuro': { name: 'Laranja', chakra: 'Sacro / Svadhisthana', tier: 'inferior' },
  amarelo: { name: 'Amarelo', chakra: 'Plexo Solar / Manipura', tier: 'inferior' },
  'amarelo ouro': { name: 'Amarelo', chakra: 'Plexo Solar / Manipura', tier: 'inferior' },
  'amarelo acido': { name: 'Amarelo', chakra: 'Plexo Solar / Manipura', tier: 'inferior' },
  verde: { name: 'Verde', chakra: 'Cardíaco / Anahata', tier: 'medio' },
  'verde esmeralda': { name: 'Verde', chakra: 'Cardíaco / Anahata', tier: 'medio' },
  'verde turvo': { name: 'Verde', chakra: 'Cardíaco / Anahata', tier: 'medio' },
  'azul claro': { name: 'Azul Claro', chakra: 'Laríngeo / Vishuddha', tier: 'superior' },
  'azul celeste': { name: 'Azul Claro', chakra: 'Laríngeo / Vishuddha', tier: 'superior' },
  indigo: { name: 'Índigo', chakra: 'Frontal / Ajna', tier: 'superior' },
  violeta: { name: 'Violeta', chakra: 'Coronário / Sahasrara', tier: 'superior' },
  rosa: { name: 'Rosa', chakra: 'Cardíaco Superior', tier: 'complementar' },
  dourado: { name: 'Dourado', chakra: 'Coronário / Proteção Solar', tier: 'complementar' },
  branco: { name: 'Branco', chakra: 'Campo Integral', tier: 'complementar' },
  'branco cristalino': { name: 'Branco', chakra: 'Campo Integral', tier: 'complementar' },
  cinza: { name: 'Cinza', chakra: 'Estagnação Mental', tier: 'complementar' },
  marrom: { name: 'Marrom', chakra: 'Básico / Densidade Telúrica', tier: 'complementar' },
  'marrom lodoso': { name: 'Marrom', chakra: 'Básico / Densidade Telúrica', tier: 'complementar' },
  preto: { name: 'Preto', chakra: 'Absorção Densa / Bloqueio', tier: 'complementar' },
  'preto opaco': { name: 'Preto', chakra: 'Absorção Densa / Bloqueio', tier: 'complementar' },
};

function buildAuricColorChakraAnalysisServer(
  missingColors: string[] = [],
  excessColors: string[] = []
): string {
  const resolve = (raw: string) => {
    const key = raw
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return AURIC_COLOR_CHAKRA_MAP_SERVER[key];
  };

  const mapList = (list: string[]) =>
    list.map((c) => {
      const info = resolve(c);
      return info ? `${info.name} (${info.chakra})` : c;
    });

  const missingMapped = mapList(missingColors);
  const excessMapped = mapList(excessColors);

  const countTiers = (list: string[]) => {
    let inferior = 0;
    let medio = 0;
    let superior = 0;
    list.forEach((c) => {
      const info = resolve(c);
      if (!info) return;
      if (info.tier === 'inferior') inferior += 1;
      else if (info.tier === 'medio') medio += 1;
      else if (info.tier === 'superior') superior += 1;
    });
    return { inferior, medio, superior };
  };

  const exT = countTiers(excessColors);
  const msT = countTiers(missingColors);
  let pattern = '';
  if (exT.inferior + exT.medio > 0 && msT.superior > 0) {
    pattern = `Sobrecarga nos chakras inferiores/médios (${excessMapped.join(', ')}) e carência nos chakras superiores (${missingMapped.join(', ')}).`;
  } else if (exT.superior > 0 && msT.inferior + msT.medio > 0) {
    pattern = `Excesso nos chakras superiores (${excessMapped.join(', ')}) com carência de aterramento nos inferiores/médios (${missingMapped.join(', ')}).`;
  } else {
    pattern = `Falta: ${missingMapped.join(', ') || 'nenhuma'} | Excesso: ${excessMapped.join(', ') || 'nenhum'}.`;
  }

  return pattern;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY não configurada no ambiente do servidor. Configure a chave no painel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Allow cross-origin API requests when frontend is wrapped in Median.co or GitHub Pages
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Healthcheck
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'maestro-quantico' });
  });

  // Motor de Ressonância Harmônica e Gerador de Comandos via Gemini API
  app.post('/api/quantum/generate', async (req: Request, res: Response) => {
    try {
      const {
        anamnesis,
        sensitivity,
        protocol,
        ansaeRhen,
        sessionType,
        previousSession,
        selectedTherapeutics,
        chartCrystals,
        energeticRemedies,
      } = req.body;

      if (!anamnesis || !sensitivity || !protocol) {
        res.status(400).json({
          error: 'Dados incompletos para geração. Envie anamnesis, sensitivity e protocol.',
        });
        return;
      }

      const ai = getGeminiClient();

      const birthFormatted = (() => {
        const raw = String(anamnesis.birthDate || '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          const [y, m, d] = raw.split('-');
          return `${d}/${m}/${y}`;
        }
        return raw || 'Data não informada';
      })();

      const resolveChartCrystal = (stageKey: string, geoName: string): string => {
        if (!chartCrystals || typeof chartCrystals !== 'object') return '';
        const raw = chartCrystals[`${stageKey}::${geoName}`] || chartCrystals[geoName] || '';
        return typeof raw === 'string' && raw.trim().toLowerCase() !== 'nenhum' ? raw.trim() : '';
      };

      const geometriesList = [
        ...(protocol.stage1?.geometries?.map(
          (g: { name: string; role: string; source?: string; customFocus?: string }) => {
            const crystal = resolveChartCrystal('stage1', g.name);
            return {
              etapa: 'Etapa 1 — Limpeza & Blindagem',
              nome: g.name,
              funcao: g.role,
              origem: g.source === 'therapist' ? 'Pendulado pelo Terapeuta' : 'Sugestão do Motor',
              ...(g.customFocus ? { focoEspecifico: g.customFocus } : {}),
              ...(crystal ? { cristalAncorado: crystal } : {}),
            };
          }
        ) || []),
        ...(protocol.stage2?.geometries?.map(
          (g: { name: string; role: string; source?: string; customFocus?: string }) => {
            const crystal = resolveChartCrystal('stage2', g.name);
            return {
              etapa: 'Etapa 2 — Regeneração & Vitalidade',
              nome: g.name,
              funcao: g.role,
              origem: g.source === 'therapist' ? 'Pendulado pelo Terapeuta' : 'Sugestão do Motor',
              ...(g.customFocus ? { focoEspecifico: g.customFocus } : {}),
              ...(crystal ? { cristalAncorado: crystal } : {}),
            };
          }
        ) || []),
        ...(protocol.singleStage?.geometries?.map(
          (g: { name: string; role: string; source?: string; customFocus?: string }) => {
            const crystal = resolveChartCrystal('single', g.name);
            return {
              etapa: 'Etapa Única — Harmonização Direta',
              nome: g.name,
              funcao: g.role,
              origem: g.source === 'therapist' ? 'Pendulado pelo Terapeuta' : 'Sugestão do Motor',
              ...(g.customFocus ? { focoEspecifico: g.customFocus } : {}),
              ...(crystal ? { cristalAncorado: crystal } : {}),
            };
          }
        ) || []),
      ];

      const alertSystems = (sensitivity.organicSystems || [])
        .filter((s: { status: string }) => s.status === 'Em Alerta')
        .map((s: { name: string; note: string }) => `${s.name}${s.note ? ` (${s.note})` : ''}`);

      const imbalancedChakras = (sensitivity.chakras || [])
        .filter((c: { percentage: number; status: string }) => c.status !== 'Equilibrado' || c.percentage < 65)
        .map((c: { name: string; percentage: number; status: string }) => `${c.name}: ${c.percentage}% (${c.status})`);

      // Detailed ANSAE/RHEN formatting when provided
      const emFieldsText = Array.isArray(ansaeRhen?.electromagneticFields)
        ? ansaeRhen.electromagneticFields
            .map(
              (f: { label: string; imbalancePercent: number; affectedChakras?: string[] }) =>
                `${f.label}: ${f.imbalancePercent}% desequilíbrio (Chakras afetados: ${(f.affectedChakras || []).join(', ') || 'Nenhum'})`
            )
            .join(' | ')
        : 'Não detalhado';

      const ansaeChakrasText = Array.isArray(ansaeRhen?.chakras)
        ? ansaeRhen.chakras
            .map(
              (c: {
                name: string;
                gland: string;
                status: string;
                imbalancePercent: number;
                affectsPhysicalBody: boolean;
              }) =>
                `${c.name} (${c.gland}): ${c.status}, ${c.imbalancePercent}% desequilíbrio${c.affectsPhysicalBody ? ' [AFETA CORPO FÍSICO]' : ''}`
            )
            .join(' | ')
        : imbalancedChakras.join('; ') || 'Todos alinhados';

      const auricText = ansaeRhen?.auricField
        ? `Proteção: ${ansaeRhen.auricField.protectionLabel} (${ansaeRhen.auricField.protectionPercent}%), Tamanho: ${ansaeRhen.auricField.sizeLabel} (${Math.max(0, Math.min(100, Number(ansaeRhen.auricField.sizePercent ?? 50)))}%), Cores em Falta: ${(ansaeRhen.auricField.missingColors || []).join(', ')}, Cores em Excesso: ${(ansaeRhen.auricField.excessColors || []).join(', ')} | Correlação Automática Cores × Chakras: ${buildAuricColorChakraAnalysisServer(ansaeRhen.auricField.missingColors, ansaeRhen.auricField.excessColors)}`
        : `Proteção Áurica: ${sensitivity.auricProtection}%`;

      const lifeAreasText = ansaeRhen?.lifeAreas
        ? `Familiar=${ansaeRhen.lifeAreas.familiar}, Afetivo=${ansaeRhen.lifeAreas.relacionamentoAfetivo}, Profissional=${ansaeRhen.lifeAreas.profissional}, Financeiro=${ansaeRhen.lifeAreas.financeiro}, Missão=${ansaeRhen.lifeAreas.missaoDeVida}`
        : 'Não detalhado';

      const formatAngstromsServer = (val?: number | null) => {
        if (val === undefined || val === null || Number.isNaN(val)) return 'não aferida';
        if (val === 0) return '0.000 Å';
        return `${val.toLocaleString('pt-BR')} Å`;
      };

      const systemsEnergyText = Array.isArray(ansaeRhen?.systems)
        ? ansaeRhen.systems
            .filter(
              (s: { isImbalanced?: boolean; imbalancePercent?: number; healthEnergyAngstroms?: number }) =>
                s.isImbalanced ||
                (s.imbalancePercent ?? 0) > 0 ||
                typeof s.healthEnergyAngstroms === 'number'
            )
            .map(
              (s: {
                systemCode: string;
                systemName: string;
                isImbalanced?: boolean;
                imbalancePercent?: number;
                healthEnergyAngstroms?: number;
              }) =>
                `[${s.systemCode}] ${s.systemName}: ${s.imbalancePercent ?? 0}% desequilíbrio | Energia de Saúde: ${formatAngstromsServer(s.healthEnergyAngstroms)}${
                  typeof s.healthEnergyAngstroms === 'number' && s.healthEnergyAngstroms < 6500
                    ? ' [ALERTA CRÍTICO < 6.500 Å]'
                    : ''
                }`
            )
            .join(' | ') || 'Todos os 15 sistemas sem alertas específicos'
        : 'Não detalhado';

      const imbalancedOrgansText = Array.isArray(ansaeRhen?.organs)
        ? ansaeRhen.organs
            .filter(
              (o: { isImbalanced: boolean; healthEnergyAngstroms?: number; imbalancePercent?: number }) =>
                o.isImbalanced ||
                (o.imbalancePercent ?? 0) > 0 ||
                typeof o.healthEnergyAngstroms === 'number'
            )
            .map(
              (o: {
                systemCode: string;
                organName: string;
                imbalancePercent: number;
                durationValue: number;
                durationUnit: string;
                healthEnergyAngstroms?: number;
              }) =>
                `[${o.systemCode}] ${o.organName}: ${o.imbalancePercent}% desequilíbrio | Energia de Saúde: ${formatAngstromsServer(o.healthEnergyAngstroms)} (tempo: ${o.durationValue}${o.durationUnit})${
                  typeof o.healthEnergyAngstroms === 'number' && o.healthEnergyAngstroms < 6500
                    ? ' [ALERTA CRÍTICO < 6.500 Å]'
                    : ''
                }`
            )
            .join(' | ') || 'Nenhum órgão ANSAE em alerta'
        : alertSystems.join('; ') || 'Nenhum sistema em alerta';

      const biometerReadingsText = Array.isArray(ansaeRhen?.biometerReadings) && ansaeRhen.biometerReadings.length > 0
        ? ansaeRhen.biometerReadings
            .map(
              (b: { biometerName: string; selectedItem: string }) =>
                `${b.biometerName}: ${b.selectedItem}`
            )
            .join(' | ')
        : 'Nenhuma leitura adicional registrada nos biômetros virtuais';

      const spiritualExtra = ansaeRhen?.spiritualPsycho
        ? `Yin/Yang: ${ansaeRhen.spiritualPsycho.yinPercent}% Yin / ${ansaeRhen.spiritualPsycho.yangPercent}% Yang | Distúrbios: ${(ansaeRhen.spiritualPsycho.spiritualDisturbances || []).join(', ') || 'Nenhum'} | Implantes: ${(ansaeRhen.spiritualPsycho.implantsDetected || []).join(', ') || 'Nenhum'} | Carma: ${(ansaeRhen.spiritualPsycho.karmicCommitments || []).join(', ') || 'Nenhum'} | Virtudes a ancorar: ${(ansaeRhen.spiritualPsycho.virtuesToAnchor || []).join(', ') || 'Equilíbrio'} | Mesa Indicada: ${ansaeRhen.spiritualPsycho.recommendedRadionicBoard}`
        : '';

      const anchoredChartCrystalsList = geometriesList
        .filter((g: { cristalAncorado?: string }) => Boolean(g.cristalAncorado))
        .map((g: { nome: string; etapa: string; cristalAncorado?: string }) => `${g.nome} (${g.etapa}): ${g.cristalAncorado}`);

      const activeRemediesList = Array.isArray(energeticRemedies)
        ? energeticRemedies
            .filter((r: { isActive?: boolean; items?: string[] }) => r?.isActive !== false && Array.isArray(r?.items) && r.items.length > 0)
            .map(
              (r: {
                category: string;
                items: string[];
                emitterGraph: string;
                durationHours: number;
                dosageInstruction: string;
              }) =>
                `${r.items.join(' + ')} (${r.category} | Emissor: ${r.emitterGraph} | ${r.durationHours}h — ${r.dosageInstruction})`
            )
        : [];

      const therapeuticsContext = `${
        selectedTherapeutics
          ? `TERAPÊUTICAS / CRISTAIS / HÁBITOS PRÉ-SELECIONADOS PELO TERAPEUTA:\n- Florais: ${(selectedTherapeutics.florals || []).join(', ') || 'A definir pela IA'}\n- Cristais: ${(selectedTherapeutics.crystals || []).join(', ') || 'A definir pela IA'}\n- Fitoterapia/Chás: ${(selectedTherapeutics.herbs || []).join(', ') || 'A definir pela IA'}\n- Bons Hábitos: ${(selectedTherapeutics.habits || []).join(', ') || 'A definir pela IA'}`
          : ''
      }${
        anchoredChartCrystalsList.length > 0
          ? `\nCRISTAIS ANCORADOS DIRETAMENTE NOS GRÁFICOS DA MESA (RADIESTESIA SENSITIVA):\n- ${anchoredChartCrystalsList.join('\n- ')}`
          : ''
      }${
        activeRemediesList.length > 0
          ? `\nMEDICAMENTOS ENERGÉTICOS & REMÉDIOS SUTIS EM EMISSÃO RADIONICS (DECÁGONO DUPLO / SCAP):\n- ${activeRemediesList.join('\n- ')}`
          : ''
      }`;

      const currentHawkinsHz = Number(
        ansaeRhen?.spiritualPsycho?.hawkinsAgathaHz ?? sensitivity.hawkins ?? 200
      );
      const currentHawkinsLevel =
        ansaeRhen?.spiritualPsycho?.hawkinsLevel ||
        sensitivity.hawkinsLevel ||
        getHawkinsLabelServer(currentHawkinsHz);

      const isPostTreatment = Boolean(previousSession) || String(sessionType || '').startsWith('Pós-Tratamento');
      const prevHawkinsHz = previousSession ? Number(previousSession.hawkins ?? 200) : 200;
      const prevHawkinsLevel = previousSession
        ? previousSession.hawkinsLevel || getHawkinsLabelServer(prevHawkinsHz)
        : '';

      const previousSessionContext = previousSession
        ? `HISTÓRICO DA SESSÃO ANTERIOR (COMPARATIVO ANTES × DEPOIS OBRIGATÓRIO):
- Sessão Anterior (${previousSession.sessionType || 'Avaliação Inicial'}): Bovis ${previousSession.bovis} Å | Hawkins ${prevHawkinsLevel} (${prevHawkinsHz} Hz) | Proteção Áurica ${previousSession.auricProtection}% | Estresse ${previousSession.stressLevel}/9 | Órgãos/Sistemas antes em alerta: ${(previousSession.alertOrgans || []).join(', ') || 'N/A'}`
        : isPostTreatment
        ? `Tipo de Sessão: ${sessionType} (Pós-Tratamento — gere análise evolutiva positiva coerente com o quadro atual)`
        : 'Sessão de Avaliação Inicial (não há sessão anterior).';

      const prompt = `
Você é o Motor de Ressonância Harmônica do sistema clínico "Maestro Quântico v2.0" (Maestro Terapias Vibracionais, conduzido pelo terapeuta Giovani Caetano).
Com base na ficha clínica completa ANSAE + RHEN e nos biômetros consultados abaixo, gere o protocolo vibracional completo em JSON estrito.

DADOS DO PACIENTE (ANAMNESE):
- Tipo de Sessão: ${sessionType || 'Avaliação Inicial'}
- Nome Completo: ${anamnesis.fullName}
- Data de Nascimento: ${birthFormatted}
- Foco Específico: ${anamnesis.therapeuticFocus}
- Histórico Emocional/Mental: ${anamnesis.emotionalHistory}
- Sintomas Físicos: ${anamnesis.physicalSymptoms}
- Tratamentos Médicos Atuais: ${anamnesis.medicalTreatments}
- Observações Clínicas: ${anamnesis.clinicalNotes}

FICHA COMPLETA ANSAE & RHEN:
- Pergunta Raiz (Domínios Positivos): ${(ansaeRhen?.rootProblems || []).join(', ') || 'Geral'}
- Biômetro de Bovis: ${sensitivity.bovis} Å
- Escala de Hawkins / Ágatha: ${currentHawkinsLevel} (${currentHawkinsHz} Hz aferidos)
- Nível de Estresse/Sobrecarga Neural: ${sensitivity.stressLevel}/9
- Campos Eletromagnéticos: ${emFieldsText}
- 7 Chakras & Glândulas: ${ansaeChakrasText}
- Campo Áurico & Cromoterapia: ${auricText}
- Áreas da Vida: ${lifeAreasText}
- Dimensão Espiritual & Psicoemocional: ${spiritualExtra || `${sensitivity.subtleInterferences} interferências (${(sensitivity.interferenceTypes || []).join(', ')})`}
- 15 Sistemas Orgânicos ANSAE (% Desequilíbrio e Energia de Saúde em Å): ${systemsEnergyText}
- Órgãos & Glândulas ANSAE (% Desequilíbrio e Energia de Saúde em Å): ${imbalancedOrgansText}
- Leituras dos 22 Biômetros Virtuais Consultados: ${biometerReadingsText}

${therapeuticsContext}

${previousSessionContext}

PROTOCOLO ANTI-CATARSE DEFINIDO:
- Modo: ${protocol.mode === 'escalonado' ? 'Modo Escalonado em 2 Etapas (com pausa de 12h entre etapas)' : 'Protocolo Direto em Etapa Única'}
- Motivos técnicos: ${(protocol.riskReasons || []).join(' | ') || 'Campo estável (>= 6.500 Å)'}
- Geometrias Sagradas selecionadas:
${JSON.stringify(geometriesList, null, 2)}

REGRAS OBRIGATÓRIAS DE REDAÇÃO:
1. "testemunhos": Crie um item para CADA geometria listada acima (incluindo obrigatoriamente todas as marcadas como "Pendulado pelo Terapeuta"). O campo "testemunhoFormatado" DEVE seguir rigorosamente o padrão:
   "${anamnesis.fullName} - ${birthFormatted} | [Foco específico (se houver focoEspecifico, priorize-o) adaptado à função daquela geometria]" — e caso a geometria possua "cristalAncorado", inclua ao final " • Frequência Cristalina: [cristalAncorado]" e preencha "cristalAncorado".
2. "comandosQuanticos": Crie comandos quânticos profundos e personalizados para CADA geometria/etapa ativa selecionada (incluindo obrigatoriamente todas as marcadas como "Pendulado pelo Terapeuta" e respeitando seu "focoEspecifico"), integrando os chakras, órgãos/sistemas ANSAE (citando explicitamente os valores exatos em Ångströms aferidos quando disponíveis, comandando a elevação de órgãos/sistemas em 0.000 Å, 4.500 Å ou < 6.500 Å para acima de 9.500 Å de Energia de Saúde), cores em falta e virtudes detectadas. Se a geometria possuir "cristalAncorado", incorpore explicitamente a assinatura vibracional informacional desse cristal no comando (ex.: "Ativo a geometria de [Gráfico] potencializada pela frequência vibracional informacional de [Cristal] sobre ${anamnesis.fullName}...") e preencha "cristalAncorado". Cada "comandoTexto" DEVE:
   - Ser redigido na 1ª pessoa do presente do indicativo ("Eu colapso...", "Eu ativo...", "Eu ancoro...").
   - Integrar conceitos de física quântica (colapso de função de onda, campo de ponto zero, não-localidade).
   - Integrar Ressonância Harmônica (transferência de informação arquetípica pura, transmutação na Escala de Hawkins).
   - Terminar EXATAMENTE com a frase de selamento: "Está ativado, colapsado e manifestado na ordem cósmica."
3. "analiseCausaRaiz": Análise técnica cruzando especificamente os sistemas e órgãos ANSAE em desequilíbrio (citando % e Energia de Saúde em Å), os chakras/glândulas afetados, os campos eletromagnéticos, as áreas da vida comprometidas e as emoções/causas raiz.
4. "analisePsicossomatica": Texto técnico-clínico de 2 parágrafos para o Relatório do Terapeuta correlacionando Bovis, Hawkins/Ágatha, Yin/Yang, campo áurico (cruzando obrigatoriamente cada cor em falta/excesso com o seu Chakra correspondente — ex.: excessos inferiores/médios vs. carências superiores) e somatização orgânica.
5. "comparativoEvolutivo": ${isPostTreatment ? 'OBRIGATÓRIO: Compare numericamente e clinicamente os ganhos entre a sessão anterior e a leitura atual (Bovis, Hawkins, Aura, Estresse e órgãos), destacando a resposta do organismo ao protocolo.' : 'Retorne string vazia "" por ser Avaliação Inicial.'}
6. "orientacaoPacienteResumo": Texto acolhedor, humanizado, claro e sem jargões técnicos pesados (2 parágrafos) explicando para o paciente seu momento energético atual${activeRemediesList.length > 0 ? ', mencionando com suavidade o suporte vibracional à distância dos remédios sutis programados e reforçando que nunca substitui nem autoriza suspender medicações médicas prescritas' : ''}.
7. "orientacaoChakrasAuraHabitos": Texto prático e acolhedor traduzindo para o paciente o significado dos chakras em atenção, relacionando diretamente cada cor da aura em falta e em excesso ao seu chakra correspondente (como nutrir as cores em falta em roupas, visualização ou ambiente e desacelerar os excessos) e dos hábitos saudáveis aferidos.
8. "welcomeMessage": Redija uma Mensagem Inicial de Acolhimento Humanizado (1 parágrafo acolhedor, empático, fraterno e encorajador, de 5 a 7 linhas) para abrir o Guia do Paciente. Valide com sensibilidade as queixas físicas ou emocionais relatadas pelo interagente na anamnese, desmistifique a leitura energética sem gerar medo ou alarme, e reforce o vínculo terapêutico e a confiança serena no processo de restauração e cura.
9. "prescricoes":
   - "floraisBach": 3 a 4 recomendações específicas (incorporando os aferidos nos biômetros, se houver) com breve justificativa.
   - "cristais": 2 a 4 cristais terapêuticos alinhados aos chakras em desequilíbrio e cores em falta (informando uso prático).
   - "fitoterapiaChas": 2 a 3 recomendações de chás/fitoterápicos suaves e integrativos alinhados aos órgãos ANSAE.
   - "bonsHabitos": 3 a 4 hábitos práticos de rotina aferidos para consolidação do equilíbrio.
   - "frequenciasSolfeggio": 2 a 3 frequências recomendadas escolhidas preferencialmente entre 432, 528 e 741 Hz (com hz numérico, nome e indicação).
   - "pilaresAutocuidado": orientações práticas e acolhedoras para cada um dos 4 pilares diários (hidratacaoFitoterapia, higieneMentalOracao, ambiente, acompanhamentoMedico — sempre reforçando que a terapia vibracional é complementar e não substitui acompanhamento médico convencional).
`;

      const generateRequest = () =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              'Você é um especialista clínico em radiestesia terapêutica (métodos ANSAE e RHEN), psicossomática e ressonância harmônica. Responda sempre em português brasileiro culto, preciso e acolhedor, seguindo estritamente o esquema JSON solicitado.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                welcomeMessage: { type: Type.STRING },
                testemunhos: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      geometria: { type: Type.STRING },
                      etapa: { type: Type.STRING },
                      testemunhoFormatado: { type: Type.STRING },
                      cristalAncorado: { type: Type.STRING },
                    },
                    required: ['geometria', 'etapa', 'testemunhoFormatado'],
                  },
                },
                comandosQuanticos: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      geometria: { type: Type.STRING },
                      etapa: { type: Type.STRING },
                      tituloComando: { type: Type.STRING },
                      comandoTexto: { type: Type.STRING },
                      cristalAncorado: { type: Type.STRING },
                    },
                    required: ['geometria', 'etapa', 'tituloComando', 'comandoTexto'],
                  },
                },
                analiseCausaRaiz: { type: Type.STRING },
                analisePsicossomatica: { type: Type.STRING },
                comparativoEvolutivo: { type: Type.STRING },
                orientacaoPacienteResumo: { type: Type.STRING },
                orientacaoChakrasAuraHabitos: { type: Type.STRING },
                prescricoes: {
                  type: Type.OBJECT,
                  properties: {
                    floraisBach: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    cristais: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    fitoterapiaChas: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    bonsHabitos: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    frequenciasSolfeggio: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          hz: { type: Type.NUMBER },
                          nome: { type: Type.STRING },
                          indicacao: { type: Type.STRING },
                        },
                        required: ['hz', 'nome', 'indicacao'],
                      },
                    },
                    pilaresAutocuidado: {
                      type: Type.OBJECT,
                      properties: {
                        hidratacaoFitoterapia: { type: Type.STRING },
                        higieneMentalOracao: { type: Type.STRING },
                        ambiente: { type: Type.STRING },
                        acompanhamentoMedico: { type: Type.STRING },
                      },
                      required: [
                        'hidratacaoFitoterapia',
                        'higieneMentalOracao',
                        'ambiente',
                        'acompanhamentoMedico',
                      ],
                    },
                  },
                  required: [
                    'floraisBach',
                    'cristais',
                    'fitoterapiaChas',
                    'bonsHabitos',
                    'frequenciasSolfeggio',
                    'pilaresAutocuidado',
                  ],
                },
              },
              required: [
                'welcomeMessage',
                'testemunhos',
                'comandosQuanticos',
                'analiseCausaRaiz',
                'analisePsicossomatica',
                'comparativoEvolutivo',
                'orientacaoPacienteResumo',
                'orientacaoChakrasAuraHabitos',
                'prescricoes',
              ],
            },
          },
        });

      let response;
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await generateRequest();
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const isTransient =
            msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
          if (!isTransient || attempt === maxAttempts) {
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        }
      }

      const rawText = (response?.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Resposta vazia recebida da API Gemini.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        ...parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erro na rota /api/quantum/generate:', error);
      const rawMessage =
        error instanceof Error ? error.message : 'Erro interno ao processar motor de ressonância.';
      const isHighDemand =
        rawMessage.includes('503') || rawMessage.includes('UNAVAILABLE');
      const friendlyMessage = isHighDemand
        ? 'O serviço de geração está com pico temporário de demanda (503). Aguarde alguns segundos e clique em "Tentar Novamente".'
        : rawMessage;
      res.status(isHighDemand ? 503 : 500).json({ error: friendlyMessage });
    }
  });

  // Copiloto IA para Anamnese & Transcrição
  app.post('/api/anamnese/copilot', async (req: Request, res: Response) => {
    try {
      const { transcript, patientName } = req.body;
      if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
        res.status(400).json({ error: 'Transcrição vazia ou inválida.' });
        return;
      }

      const ai = getGeminiClient();
      const prompt = `
Você é o Copiloto Clínico IA do sistema "Maestro Quântico v2.0" (Maestro Terapias Vibracionais, conduzido pelo terapeuta Giovani Caetano).
Analise a transcrição abaixo da escuta ativa de um atendimento terapêutico presencial com o paciente "${patientName || 'Paciente'}" e extraia os insights estruturados em JSON estrito.

TRANSCRIÇÃO DA SESSÃO / ANAMNESE:
"""
${transcript}
"""

Retorne um JSON contendo estritamente as seguintes chaves:
- "clinicalComplaints": Resumo detalhado dos sintomas físicos, dores localizadas, diagnósticos médicos citados e tempo de evolução.
- "psychosomaticMapping": Correlação psicossomática profunda entre os sintomas físicos relatados e os conflitos emocionais, traumas, estresse ou padrões mentais identificados na fala do paciente.
- "centralIntention": Intenção Central de Tratamento sintetizada no Padrão Maestro (ex.: "Harmonização do eixo neuroemocional, restauração da vitalidade física e prosperidade").
- "suggestedFocus": Foco principal do atendimento (ex.: "Saúde Física", "Equilíbrio Emocional", "Limpeza Espiritual", "Prosperidade/Material", "Relacionamentos").
- "highlightedOrgansAndChakras": Array de strings com a lista de órgãos, sistemas ANSAE e chakras associados às queixas para destaque clínico.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Você é um copiloto clínico especialista em anamnese terapêutica e psicossomática. Responda em português brasileiro culto e acolhedor, seguindo estritamente o esquema JSON solicitado.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clinicalComplaints: { type: Type.STRING },
              psychosomaticMapping: { type: Type.STRING },
              centralIntention: { type: Type.STRING },
              suggestedFocus: { type: Type.STRING },
              highlightedOrgansAndChakras: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'clinicalComplaints',
              'psychosomaticMapping',
              'centralIntention',
              'suggestedFocus',
              'highlightedOrgansAndChakras',
            ],
          },
        },
      });

      const rawText = (response?.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Resposta vazia recebida do Copiloto IA.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (error) {
      console.error('Erro na rota /api/anamnese/copilot:', error);
      const msg = error instanceof Error ? error.message : 'Erro interno no Copiloto IA.';
      res.status(500).json({ error: msg });
    }
  });

  // Leitura Óptica Inteligente de Biômetros via Gemini Vision
  app.post('/api/biometros/extract-sectors', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, title } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: 'imageBase64 é obrigatório.' });
        return;
      }

      const ai = getGeminiClient();
      const cleanBase64 = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
      const cleanMime = mimeType || 'image/png';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: cleanMime,
            },
          },
          {
            text: `Analise esta imagem de um gráfico radiestésico / biômetro${title ? ` (Título pretendido: ${title})` : ''}.
Seu objetivo é extrair 100% dos setores, intervalos, fatias, anéis concêntricos e divisões visíveis nesta prancha radiestésica.
Instruções estritas:
1. Percorra cada fatia, setor, anel (interno para externo) e divisão (da esquerda para a direita ou sentido horário).
2. Transcreva TODOS os textos, rótulos e números escritos em cada intervalo. Não resuma, não agrupe e não omita nenhuma opção (mesmo se houver de 30 a 100 divisões).
3. Se houver anéis hierárquicos ou categorias temáticas (ex: Anel interno = Grupo, Anel externo = Essência/Órgão), formate cada item no formato "[Categoria] Nome do Item" ou com o nome completo exato da fatia.
4. REGRA OBRIGATÓRIA PARA ESCALAS NUMÉRICAS (JAMAIS use o prefixo "[Escala]"):
   Sempre que a imagem apresentar arcos, réguas ou setores numéricos, identifique o tipo de grandeza (pelo contexto/título da prancha ou pela amplitude numérica) e formate cada valor SEM o prefixo "[Escala]", aplicando exatamente as seguintes unidades:
   - Escala de 0 a 100 (Percentual): formate cada valor com o símbolo "%" colado ao número — ex.: "0%", "10%", "20%", ..., "100%" (jamais "[Escala] 100").
   - Escala de 0 a 24 (Horas): formate cada valor em horas — ex.: "0 hrs.", "1 hr.", "2 hrs.", ..., "24 hrs.".
   - Escala de 0 a 60 (Minutos): formate cada valor em minutos — ex.: "0 min.", "1 min.", "5 min.", ..., "60 min.".
   - Escala de 0 a 30 (Dias): formate cada valor em dias — ex.: "0 dias", "1 dia", "2 dias", ..., "30 dias".
   - Caso um único biômetro (como o Relógio Radiestésico ou o Gráfico de Cura e Tempo de Tratamento) combine múltiplas escalas diferentes na mesma imagem, aplique a unidade correspondente a cada faixa ("0%" a "100%" para percentual, "0 hrs." a "24 hrs." para horas, "0 min." a "60 min." para minutos e "0 dias" a "30 dias" para dias), sem usar o rótulo "[Escala]".
5. Responda APENAS em formato JSON válido com a seguinte estrutura exata:
{
  "totalIntervals": number,
  "sectors": string[],
  "suggestedTitle": string
}
Nenhum texto adicional fora do JSON.`
          }
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = (response?.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Resposta vazia recebida do Gemini Vision.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed?.sectors)) {
        parsed.sectors = parsed.sectors
          .map((item: unknown) =>
            String(item ?? '')
              .replace(/^\s*\[escala[^\]]*\]\s*/i, '')
              .trim()
          )
          .filter(Boolean);
        parsed.totalIntervals = parsed.sectors.length;
      }
      res.json(parsed);
    } catch (error) {
      console.error('Erro na rota /api/biometros/extract-sectors:', error);
      const msg = error instanceof Error ? error.message : 'Erro interno na extração de biômetro.';
      res.status(500).json({ error: msg });
    }
  });

  // Vite middleware in development, static dist in production
  const distPath = path.resolve(__dirname, 'dist');
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(500).send('Build ausente. Execute npm run build antes de iniciar em produção.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maestro Quântico server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor Maestro Quântico:', err);
  process.exit(1);
});
