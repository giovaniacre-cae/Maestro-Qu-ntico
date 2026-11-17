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
      const { anamnesis, sensitivity, protocol } = req.body;

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

      const prompt = `
Você é o Motor de Ressonância Harmônica do sistema clínico "Maestro Quântico" (Maestro Terapias Vibracionais, conduzido pelo terapeuta Giovani Caetano).
Com base nos dados clínicos abaixo, gere o protocolo vibracional completo em JSON estrito.

DADOS DO PACIENTE (ANAMNESE):
- Nome Completo: ${anamnesis.fullName}
- Data de Nascimento: ${birthFormatted}
- Foco Específico: ${anamnesis.therapeuticFocus}
- Histórico Emocional/Mental: ${anamnesis.emotionalHistory}
- Sintomas Físicos: ${anamnesis.physicalSymptoms}
- Tratamentos Médicos Atuais: ${anamnesis.medicalTreatments}
- Observações Clínicas: ${anamnesis.clinicalNotes}

SINTONIA SENSITIVA (RADIESTESIA):
- Biômetro de Bovis: ${sensitivity.bovis} Å
- Escala de Hawkins: ${sensitivity.hawkins}
- Proteção Áurica: ${sensitivity.auricProtection}%
- Nível de Estresse/Sobrecarga: ${sensitivity.stressLevel}/5
- Interferências Sutis: ${sensitivity.subtleInterferences} (${(sensitivity.interferenceTypes || []).join(', ') || 'Nenhuma'})
- Chakras em atenção: ${imbalancedChakras.join('; ') || 'Todos alinhados'}
- Sistemas Orgânicos em alerta: ${alertSystems.join('; ') || 'Nenhum sistema em alerta'}

PROTOCOLO ANTI-CATARSE DEFINIDO:
- Modo: ${protocol.mode === 'escalonado' ? 'Modo Escalonado em 2 Etapas (com pausa de 12h entre etapas)' : 'Protocolo Direto em Etapa Única'}
- Motivos técnicos: ${(protocol.riskReasons || []).join(' | ') || 'Campo estável (>= 6.500 Å)'}
- Geometrias Sagradas selecionadas:
${JSON.stringify(geometriesList, null, 2)}

REGRAS OBRIGATÓRIAS DE REDAÇÃO:
1. "testemunhos": Crie um item para CADA geometria listada acima. O campo "testemunhoFormatado" DEVE seguir rigorosamente o padrão:
   "${anamnesis.fullName} - ${birthFormatted} | [Foco específico adaptado à função daquela geometria]"
2. "comandosQuanticos": Crie comandos quânticos profundos e bem redigidos (agrupados por etapa ou por geometria principal, pelo menos 1 comando completo por etapa ativa). Cada "comandoTexto" DEVE:
   - Ser redigido na 1ª pessoa do presente do indicativo ("Eu colapso...", "Eu ativo...", "Eu ancoro...").
   - Integrar conceitos de física quântica (colapso de função de onda, campo de ponto zero, não-localidade).
   - Integrar Ressonância Harmônica (transferência de informação arquetípica pura, transmutação na Escala de Hawkins).
   - Terminar EXATAMENTE com a frase de selamento: "Está ativado, colapsado e manifestado na ordem cósmica."
3. "analisePsicossomatica": Texto técnico-clínico de 2 parágrafos para o Relatório do Terapeuta correlacionando Bovis, Hawkins, chakras bloqueados/hipo-ativos, sistemas orgânicos e causas emocionais.
4. "orientacaoPacienteResumo": Texto acolhedor, humanizado, claro e sem jargões técnicos pesados (2 parágrafos) explicando para o paciente seu momento energético atual e a relação mente-emoção-corpo.
5. "prescricoes":
   - "floraisBach": 3 a 4 recomendações específicas com justificativa breve.
   - "fitoterapiaChas": 2 a 3 recomendações de chás/fitoterápicos suaves e integrativos.
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
              'Você é um especialista clínico em radiestesia terapêutica, psicossomática e ressonância harmônica. Responda sempre em português brasileiro culto, preciso e acolhedor, seguindo estritamente o esquema JSON solicitado.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
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
              analisePsicossomatica: { type: Type.STRING },
              orientacaoPacienteResumo: { type: Type.STRING },
              prescricoes: {
                type: Type.OBJECT,
                properties: {
                  floraisBach: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  fitoterapiaChas: {
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
                  'fitoterapiaChas',
                  'frequenciasSolfeggio',
                  'pilaresAutocuidado',
                ],
              },
            },
            required: [
              'testemunhos',
              'comandosQuanticos',
              'analisePsicossomatica',
              'orientacaoPacienteResumo',
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
