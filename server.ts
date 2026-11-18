import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

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

      const geometriesList = [
        ...(protocol.stage1?.geometries?.map((g: { name: string; role: string }) => ({
          etapa: 'Etapa 1 — Limpeza & Blindagem',
          nome: g.name,
          funcao: g.role,
        })) || []),
        ...(protocol.stage2?.geometries?.map((g: { name: string; role: string }) => ({
          etapa: 'Etapa 2 — Regeneração & Vitalidade',
          nome: g.name,
          funcao: g.role,
        })) || []),
        ...(protocol.singleStage?.geometries?.map((g: { name: string; role: string }) => ({
          etapa: 'Etapa Única — Harmonização Direta',
          nome: g.name,
          funcao: g.role,
        })) || []),
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
        ? `Proteção: ${ansaeRhen.auricField.protectionLabel} (${ansaeRhen.auricField.protectionPercent}%), Tamanho: ${ansaeRhen.auricField.sizeLabel} (${ansaeRhen.auricField.sizePercent}%), Cores em Falta: ${(ansaeRhen.auricField.missingColors || []).join(', ')}, Cores em Excesso: ${(ansaeRhen.auricField.excessColors || []).join(', ')}`
        : `Proteção Áurica: ${sensitivity.auricProtection}%`;

      const lifeAreasText = ansaeRhen?.lifeAreas
        ? `Familiar=${ansaeRhen.lifeAreas.familiar}, Afetivo=${ansaeRhen.lifeAreas.relacionamentoAfetivo}, Profissional=${ansaeRhen.lifeAreas.profissional}, Financeiro=${ansaeRhen.lifeAreas.financeiro}, Missão=${ansaeRhen.lifeAreas.missaoDeVida}`
        : 'Não detalhado';

      const imbalancedOrgansText = Array.isArray(ansaeRhen?.organs)
        ? ansaeRhen.organs
            .filter((o: { isImbalanced: boolean }) => o.isImbalanced)
            .map(
              (o: {
                systemCode: string;
                organName: string;
                imbalancePercent: number;
                durationValue: number;
                durationUnit: string;
              }) =>
                `[${o.systemCode}] ${o.organName}: ${o.imbalancePercent}% desequilíbrio (tempo: ${o.durationValue}${o.durationUnit})`
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

      const therapeuticsContext = selectedTherapeutics
        ? `TERAPÊUTICAS / CRISTAIS / HÁBITOS PRÉ-SELECIONADOS PELO TERAPEUTA:\n- Florais: ${(selectedTherapeutics.florals || []).join(', ') || 'A definir pela IA'}\n- Cristais: ${(selectedTherapeutics.crystals || []).join(', ') || 'A definir pela IA'}\n- Fitoterapia/Chás: ${(selectedTherapeutics.herbs || []).join(', ') || 'A definir pela IA'}\n- Bons Hábitos: ${(selectedTherapeutics.habits || []).join(', ') || 'A definir pela IA'}`
        : '';

      const isPostTreatment = Boolean(previousSession) || String(sessionType || '').startsWith('Pós-Tratamento');
      const previousSessionContext = previousSession
        ? `HISTÓRICO DA SESSÃO ANTERIOR (COMPARATIVO ANTES × DEPOIS OBRIGATÓRIO):
- Sessão Anterior (${previousSession.sessionType || 'Avaliação Inicial'}): Bovis ${previousSession.bovis} Å | Hawkins ${previousSession.hawkins} Hz | Proteção Áurica ${previousSession.auricProtection}% | Estresse ${previousSession.stressLevel}/9 | Órgãos/Sistemas antes em alerta: ${(previousSession.alertOrgans || []).join(', ') || 'N/A'}`
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
- Escala de Hawkins / Ágatha: ${sensitivity.hawkins} Hz
- Nível de Estresse/Sobrecarga Neural: ${sensitivity.stressLevel}/9
- Campos Eletromagnéticos: ${emFieldsText}
- 7 Chakras & Glândulas: ${ansaeChakrasText}
- Campo Áurico & Cromoterapia: ${auricText}
- Áreas da Vida: ${lifeAreasText}
- Dimensão Espiritual & Psicoemocional: ${spiritualExtra || `${sensitivity.subtleInterferences} interferências (${(sensitivity.interferenceTypes || []).join(', ')})`}
- Órgãos & Sistemas ANSAE em Desequilíbrio: ${imbalancedOrgansText}
- Leituras dos 22 Biômetros Virtuais Consultados: ${biometerReadingsText}

${therapeuticsContext}

${previousSessionContext}

PROTOCOLO ANTI-CATARSE DEFINIDO:
- Modo: ${protocol.mode === 'escalonado' ? 'Modo Escalonado em 2 Etapas (com pausa de 12h entre etapas)' : 'Protocolo Direto em Etapa Única'}
- Motivos técnicos: ${(protocol.riskReasons || []).join(' | ') || 'Campo estável (>= 6.500 Å)'}
- Geometrias Sagradas selecionadas:
${JSON.stringify(geometriesList, null, 2)}

REGRAS OBRIGATÓRIAS DE REDAÇÃO:
1. "testemunhos": Crie um item para CADA geometria listada acima. O campo "testemunhoFormatado" DEVE seguir rigorosamente o padrão:
   "${anamnesis.fullName} - ${birthFormatted} | [Foco específico adaptado à função daquela geometria]"
2. "comandosQuanticos": Crie comandos quânticos profundos e personalizados para CADA geometria/etapa ativa selecionada, integrando os chakras, órgãos ANSAE, cores em falta e virtudes detectadas. Cada "comandoTexto" DEVE:
   - Ser redigido na 1ª pessoa do presente do indicativo ("Eu colapso...", "Eu ativo...", "Eu ancoro...").
   - Integrar conceitos de física quântica (colapso de função de onda, campo de ponto zero, não-localidade).
   - Integrar Ressonância Harmônica (transferência de informação arquetípica pura, transmutação na Escala de Hawkins).
   - Terminar EXATAMENTE com a frase de selamento: "Está ativado, colapsado e manifestado na ordem cósmica."
3. "analiseCausaRaiz": Análise técnica cruzando especificamente os órgãos ANSAE em desequilíbrio, os chakras/glândulas afetados, os campos eletromagnéticos, as áreas da vida comprometidas e as emoções/causas raiz.
4. "analisePsicossomatica": Texto técnico-clínico de 2 parágrafos para o Relatório do Terapeuta correlacionando Bovis, Hawkins/Ágatha, Yin/Yang, campo áurico (cores em falta/excesso) e somatização orgânica.
5. "comparativoEvolutivo": ${isPostTreatment ? 'OBRIGATÓRIO: Compare numericamente e clinicamente os ganhos entre a sessão anterior e a leitura atual (Bovis, Hawkins, Aura, Estresse e órgãos), destacando a resposta do organismo ao protocolo.' : 'Retorne string vazia "" por ser Avaliação Inicial.'}
6. "orientacaoPacienteResumo": Texto acolhedor, humanizado, claro e sem jargões técnicos pesados (2 parágrafos) explicando para o paciente seu momento energético atual.
7. "orientacaoChakrasAuraHabitos": Texto prático e acolhedor traduzindo para o paciente o significado dos chakras em atenção, das cores da aura em falta/excesso (como utilizá-las em roupas, visualização ou ambiente) e dos hábitos saudáveis aferidos.
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
