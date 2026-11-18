import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import {
  ClinicalAnsaeRhenSheet,
  ClinicalSessionRecord,
  SessionMilestoneType,
} from '../types/clinical';
import { QuantumRoomSession } from '../types/quantum';
import { formatBirthDateBR, getHawkinsLevelInfo } from './antiCatharsis';
import { getAnsaeDraftForSession, getPreviousSessionForPatient } from './storage';

const NAVY_HEX = '0F172A';
const AMBER_HEX = 'B45309';
const SLATE_TEXT_HEX = '334155';
const MUTED_HEX = '64748B';
const BORDER_HEX = 'CBD5E1';
const LIGHT_BG_HEX = 'FAF8F5';
const MAESTRO_LOGO_URL =
  './assets/aistudio/Logo_Maestro_terapias_Vibracionais_Sem_fundo__2__f6ac1f97.png';

export interface DocumentExportContext {
  ansaeSheet?: ClinicalAnsaeRhenSheet;
  previousSession?: ClinicalSessionRecord | null;
  sessionType?: SessionMilestoneType;
  welcomeMessage?: string;
}

interface MaestroLogoAssets {
  bytes: Uint8Array;
  dataUrl: string;
}

let cachedLogoPromise: Promise<MaestroLogoAssets | null> | null = null;

async function loadMaestroLogo(): Promise<MaestroLogoAssets | null> {
  if (!cachedLogoPromise) {
    cachedLogoPromise = (async () => {
      try {
        const res = await fetch(MAESTRO_LOGO_URL);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return {
          bytes,
          dataUrl: `data:image/png;base64,${base64}`,
        };
      } catch {
        return null;
      }
    })();
  }
  return cachedLogoPromise;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function formatDateTimeBR(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveDocContext(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): {
  sheet: ClinicalAnsaeRhenSheet;
  prev: ClinicalSessionRecord | null;
  sessionType: SessionMilestoneType;
} {
  const sheet = ctx?.ansaeSheet || getAnsaeDraftForSession(session);
  const prev =
    ctx?.previousSession !== undefined
      ? ctx.previousSession
      : getPreviousSessionForPatient(session.anamnesis.id, session.id);
  const sessionType = ctx?.sessionType || session.sessionType || 'Avaliação Inicial';
  return { sheet, prev, sessionType };
}

function buildFallbackChakraAuraHabitsText(
  session: QuantumRoomSession,
  sheet: ClinicalAnsaeRhenSheet
): string {
  const attentionChakras = sheet.chakras.filter((c) => c.status !== 'Normal');
  const chakrasSummary =
    attentionChakras.length > 0
      ? `Chakras em atenção (${attentionChakras
          .map((c) => `${c.name} — ligado à glândula ${c.gland}`)
          .join(', ')}): busque momentos de respiração calma levando atenção gentil a essas regiões.`
      : 'Seus sete centros de força (chakras) apresentam boa harmonia geral nesta leitura.';

  const missingColorsText =
    sheet.auricField.missingColors.length > 0
      ? `Cores que nutrem seu campo neste ciclo: ${sheet.auricField.missingColors.join(
          ', '
        )}. Utilize-as em detalhes de vestuário, objetos do ambiente ou visualizações suaves ao inspirar.`
      : '';

  const excessColorsText =
    sheet.auricField.excessColors.length > 0
      ? `Cores em excesso que pedem desaceleração e limpeza: ${sheet.auricField.excessColors.join(
          ', '
        )} (evite ambientes sobrecarregados e priorize iluminação amena à noite).`
      : '';

  const habits =
    session.aiResult?.prescricoes.bonsHabitos && session.aiResult.prescricoes.bonsHabitos.length > 0
      ? `Hábitos diários recomendados: ${session.aiResult.prescricoes.bonsHabitos.join(' • ')}.`
      : 'Cultive pausas breves durante o dia, hidratação regular e silêncio antes de dormir.';

  return [chakrasSummary, missingColorsText, excessColorsText, habits].filter(Boolean).join('\n\n');
}

export function getDefaultWelcomeMessage(
  session: QuantumRoomSession,
  customVocative?: string
): string {
  const { anamnesis } = session;
  const firstName = anamnesis.fullName.trim().split(/\s+/)[0] || anamnesis.fullName;
  const vocative = customVocative || `Prezado(a) ${firstName}:`;

  const emotionalNote = anamnesis.emotionalHistory?.trim()
    ? 'Tudo o que você tem sentido e carregado emocionalmente merece escuta serena e respeito.'
    : 'Cada sinal que seu corpo e suas emoções manifestam merece atenção gentil e acolhimento.';

  const physicalNote = anamnesis.physicalSymptoms?.trim()
    ? 'Reconhecemos o peso físico e o cansaço relatados em sua conversa inicial, e queremos que saiba que você não precisa atravessar esse momento sozinho(a).'
    : 'Nosso propósito é oferecer suporte amoroso e seguro para restaurar sua disposição e clareza interior.';

  return [
    vocative,
    `Receba este guia com o coração tranquilo. ${emotionalNote} ${physicalNote} Esta leitura vibracional não tem a intenção de assustar ou rotular, mas sim de iluminar com clareza e suavidade os caminhos pelos quais sua energia pode voltar a fluir em equilíbrio. Confie no ritmo sábio do seu organismo: passo a passo, em parceria fraterna e constante, estamos cuidando para que você recupere sua paz, força vital e bem-estar integral.`,
  ].join('\n');
}

export function applyVocativeToWelcomeMessage(text: string, vocative: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `${vocative}\n`;
  }
  const lines = trimmed.split('\n');
  const firstLine = lines[0].trim();
  const looksLikeVocative =
    firstLine.length <= 75 &&
    (firstLine.endsWith(':') ||
      /^(Prezado|Prezada|Prezado\(a\)|Querido|Querida|Querido\(a\)|Meu Amado|Minha Amada|Olá)/i.test(
        firstLine
      ));

  if (looksLikeVocative) {
    const rest = lines.slice(1).join('\n').trimStart();
    return rest ? `${vocative}\n${rest}` : vocative;
  }

  return `${vocative}\n${trimmed}`;
}

// ---------- DOCX HELPERS ----------

function buildDocxOfficialHeader(
  subtitle: string,
  logoBytes: Uint8Array | null
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  if (logoBytes) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new ImageRun({
            data: logoBytes,
            transformation: { width: 88, height: 88 },
            type: 'png',
          }),
        ],
      })
    );
  }

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: 'MAESTRO TERAPIAS VIBRACIONAIS',
          bold: true,
          size: 32,
          color: NAVY_HEX,
          font: 'Georgia',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: subtitle,
          italics: true,
          bold: true,
          size: 24,
          color: AMBER_HEX,
          font: 'Georgia',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'Giovani Caetano',
          bold: true,
          size: 20,
          color: NAVY_HEX,
          font: 'Calibri',
        }),
        new TextRun({
          text: ' | Terapeuta Vibracional • Radiestesista Terapêutico • Neuroterapia & Hipnoterapia',
          size: 20,
          color: SLATE_TEXT_HEX,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      border: {
        bottom: {
          color: AMBER_HEX,
          space: 8,
          style: BorderStyle.SINGLE,
          size: 16,
        },
      },
      children: [
        new TextRun({
          text: 'Atendimentos Integrativos • Contatos: (68) 99247-6436 | (11) 95056-5215',
          size: 19,
          color: MUTED_HEX,
          font: 'Calibri',
        }),
      ],
    })
  );

  return paragraphs;
}

function buildSectionHeading(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    border: {
      bottom: {
        color: BORDER_HEX,
        space: 4,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 24,
        color: NAVY_HEX,
        font: 'Georgia',
      }),
    ],
  });
}

function buildBodyParagraph(text: string, boldPrefix?: string): Paragraph {
  const children: TextRun[] = [];
  if (boldPrefix) {
    children.push(
      new TextRun({
        text: boldPrefix,
        bold: true,
        size: 21,
        color: NAVY_HEX,
        font: 'Calibri',
      })
    );
  }
  children.push(
    new TextRun({
      text,
      size: 21,
      color: SLATE_TEXT_HEX,
      font: 'Calibri',
    })
  );
  return new Paragraph({
    spacing: { after: 110, line: 276 },
    children,
  });
}

function buildTableCell(text: string, bold = false, shaded = false): TableCell {
  return new TableCell({
    shading: shaded
      ? { type: ShadingType.CLEAR, color: 'auto', fill: LIGHT_BG_HEX }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
      left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
    },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold,
            size: 19,
            color: bold ? NAVY_HEX : SLATE_TEXT_HEX,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function buildDocxWelcomeCard(text: string): Table {
  const paragraphs = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F5F9' },
            margins: { top: 160, bottom: 160, left: 240, right: 200 },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'F1F5F9' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'F1F5F9' },
              right: { style: BorderStyle.NONE, size: 0, color: 'F1F5F9' },
              left: { style: BorderStyle.SINGLE, size: 24, color: AMBER_HEX },
            },
            children: (paragraphs.length > 0 ? paragraphs : [text]).map(
              (line, idx, arr) =>
                new Paragraph({
                  spacing: {
                    after: idx === arr.length - 1 ? 0 : 100,
                    line: 290,
                  },
                  children: [
                    new TextRun({
                      text: line,
                      italics: true,
                      bold: idx === 0 && line.endsWith(':'),
                      size: 21,
                      color: '1E293B',
                      font: 'Georgia',
                    }),
                  ],
                })
            ),
          }),
        ],
      }),
    ],
  });
}

// ---------- DOC 1: THERAPIST TECHNICAL REPORT (.DOCX) ----------

export async function downloadTherapistDocx(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): Promise<void> {
  const { anamnesis, sensitivity, protocol, aiResult } = session;
  const { sheet, prev, sessionType } = resolveDocContext(session, ctx);
  const logo = await loadMaestroLogo();
  const hawkinsInfo = getHawkinsLevelInfo(sensitivity.hawkins);
  const birthBR = formatBirthDateBR(anamnesis.birthDate);
  const imbalancedOrgans = sheet.organs.filter((o) => o.isImbalanced);

  const identificationTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell('Paciente', true, true),
          buildTableCell(anamnesis.fullName, false, false),
          buildTableCell('Nascimento', true, true),
          buildTableCell(birthBR || 'Não informado', false, false),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Tipo de Sessão', true, true),
          buildTableCell(sessionType, false, false),
          buildTableCell('Data do Registro', true, true),
          buildTableCell(formatDateTimeBR(session.activatedAt), false, false),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Contato', true, true),
          buildTableCell(anamnesis.phone || 'Não informado', false, false),
          buildTableCell('Mesa Indicada', true, true),
          buildTableCell(sheet.spiritualPsycho.recommendedRadionicBoard, false, false),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Foco Terapêutico', true, true),
          new TableCell({
            columnSpan: 3,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
              left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
              right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: anamnesis.therapeuticFocus,
                    size: 19,
                    color: SLATE_TEXT_HEX,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Campos Eletromagnéticos Table
  const emTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell('Campo Eletromagnético', true, true),
          buildTableCell('Desequilíbrio (%)', true, true),
          buildTableCell('Chakras Afetados', true, true),
        ],
      }),
      ...sheet.electromagneticFields.map(
        (f) =>
          new TableRow({
            children: [
              buildTableCell(f.label, true),
              buildTableCell(`${f.imbalancePercent}%`),
              buildTableCell(f.affectedChakras.join(', ') || 'Sem comprometimento'),
            ],
          })
      ),
    ],
  });

  // 7 Chakras + Glândulas Table
  const chakraTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell('Chakra', true, true),
          buildTableCell('Glândula Endócrina', true, true),
          buildTableCell('Polaridade', true, true),
          buildTableCell('Desequilíbrio', true, true),
          buildTableCell('Afeta Físico', true, true),
        ],
      }),
      ...sheet.chakras.map(
        (c) =>
          new TableRow({
            children: [
              buildTableCell(`${c.name} (${c.sanskrit})`, true),
              buildTableCell(c.gland),
              buildTableCell(c.status),
              buildTableCell(`${c.imbalancePercent}%`),
              buildTableCell(c.affectsPhysicalBody ? 'Sim' : 'Não'),
            ],
          })
      ),
    ],
  });

  // Campo Áurico + Dimensão Espiritual Table
  const bioAuraTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell('Dimensão / Parâmetro', true, true),
          buildTableCell('Aferição Exata', true, true),
          buildTableCell('Observação Clínica', true, true),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Biômetro de Bovis (0–18.000+ Å)', true),
          buildTableCell(`${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å`),
          buildTableCell(
            sheet.spiritualPsycho.bovis < 6500
              ? 'Abaixo de 6.500 Å — Protocolo Anti-Catarse obrigatório'
              : 'Campo estável em zona de coerência'
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Escala de Hawkins / Ágatha', true),
          buildTableCell(`${sheet.spiritualPsycho.hawkinsAgathaHz} Hz (${hawkinsInfo.label})`),
          buildTableCell(`${hawkinsInfo.zone} — ${hawkinsInfo.emotion}`),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Estresse Neural (0–9) & Polaridade', true),
          buildTableCell(`Estresse ${sheet.spiritualPsycho.stressLevel}/9`),
          buildTableCell(
            `${sheet.spiritualPsycho.yinPercent}% Yin / ${sheet.spiritualPsycho.yangPercent}% Yang`
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Campo Áurico (Proteção & Tamanho)', true),
          buildTableCell(
            `${sheet.auricField.protectionLabel} (${sheet.auricField.protectionPercent}%)`
          ),
          buildTableCell(
            `Tamanho: ${sheet.auricField.sizeLabel} (${sheet.auricField.sizePercent}%)`
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Cromoterapia Áurica', true),
          buildTableCell(`Em falta: ${sheet.auricField.missingColors.join(', ') || '—'}`),
          buildTableCell(`Em excesso: ${sheet.auricField.excessColors.join(', ') || '—'}`),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Varredura Espiritual & Cármica', true),
          buildTableCell(
            `${sheet.spiritualPsycho.spiritualDisturbances.length} distúrbio(s) · ${sheet.spiritualPsycho.implantsDetected.length} implante(s)`
          ),
          buildTableCell(
            [
              ...sheet.spiritualPsycho.spiritualDisturbances,
              ...sheet.spiritualPsycho.implantsDetected,
              ...sheet.spiritualPsycho.karmicCommitments,
            ].join('; ') || 'Sem registros densos'
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Virtudes a Ancorar', true),
          buildTableCell(`${sheet.spiritualPsycho.virtuesToAnchor.length} selecionada(s)`),
          buildTableCell(sheet.spiritualPsycho.virtuesToAnchor.join(', ') || 'Serenidade'),
        ],
      }),
    ],
  });

  // Áreas da Vida Table
  const lifeAreasTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell('Familiar', true, true),
          buildTableCell('Relac. Afetivo', true, true),
          buildTableCell('Profissional', true, true),
          buildTableCell('Financeiro', true, true),
          buildTableCell('Missão de Vida', true, true),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell(sheet.lifeAreas.familiar),
          buildTableCell(sheet.lifeAreas.relacionamentoAfetivo),
          buildTableCell(sheet.lifeAreas.profissional),
          buildTableCell(sheet.lifeAreas.financeiro),
          buildTableCell(sheet.lifeAreas.missaoDeVida),
        ],
      }),
    ],
  });

  // ANSAE Organs Table
  const organsTable =
    imbalancedOrgans.length > 0
      ? new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                buildTableCell('Sigla', true, true),
                buildTableCell('Sistema Orgânico', true, true),
                buildTableCell('Órgão / Glândula', true, true),
                buildTableCell('Desequilíbrio', true, true),
                buildTableCell('Tempo', true, true),
              ],
            }),
            ...imbalancedOrgans.map(
              (o) =>
                new TableRow({
                  children: [
                    buildTableCell(o.systemCode, true),
                    buildTableCell(o.systemName),
                    buildTableCell(o.organName),
                    buildTableCell(`${o.imbalancePercent}%`),
                    buildTableCell(`${o.durationValue}${o.durationUnit}`),
                  ],
                })
            ),
          ],
        })
      : null;

  // Chronogram Stage Paragraphs
  const stageParagraphs: Paragraph[] = [];
  if (protocol.mode === 'escalonado' && protocol.stage1 && protocol.stage2) {
    stageParagraphs.push(
      buildBodyParagraph(
        `Protocolo Escalonado em 2 Etapas ativado automaticamente. Motivos técnicos: ${protocol.riskReasons.join('; ')}.`,
        'Classificação Clínica: '
      ),
      buildBodyParagraph(
        `${protocol.stage1.durationLabel} — ${protocol.stage1.objective} Geometrias permitidas: ${protocol.stage1.geometries
          .map((g) => g.name)
          .join(', ')}. Geometrias bloqueadas nesta fase: ${protocol.stage1.blockedGeometries.join('; ')}.`,
        `${protocol.stage1.title}: `
      ),
      buildBodyParagraph(
        'Pausa fisiológica obrigatória de 12 horas entre a conclusão da Etapa 1 e a ativação da Etapa 2 para sedimentação neural e energética.',
        'Intervalo de Repouso: '
      ),
      buildBodyParagraph(
        `${protocol.stage2.durationLabel} — ${protocol.stage2.objective} Geometrias aplicadas: ${protocol.stage2.geometries
          .map((g) => g.name)
          .join(', ')}.`,
        `${protocol.stage2.title}: `
      )
    );
  } else if (protocol.singleStage) {
    stageParagraphs.push(
      buildBodyParagraph(
        `Protocolo Direto em Etapa Única (${protocol.singleStage.durationLabel}). ${protocol.singleStage.objective}`,
        'Classificação Clínica: '
      ),
      buildBodyParagraph(
        protocol.singleStage.geometries.map((g) => `${g.name} (${g.role})`).join(' | '),
        'Geometrias Aplicadas: '
      )
    );
  }

  const testemunhoParagraphs: Paragraph[] = (aiResult?.testemunhos || []).map((t) =>
    buildBodyParagraph(`${t.testemunhoFormatado} [${t.etapa}]`, `${t.geometria}: `)
  );

  const comandoParagraphs: Paragraph[] = [];
  (aiResult?.comandosQuanticos || []).forEach((cmd) => {
    comandoParagraphs.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({
            text: `${cmd.tituloComando} (${cmd.geometria} • ${cmd.etapa})`,
            bold: true,
            size: 21,
            color: AMBER_HEX,
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120, line: 276 },
        children: [
          new TextRun({
            text: `"${cmd.comandoTexto}"`,
            italics: true,
            size: 21,
            color: NAVY_HEX,
            font: 'Georgia',
          }),
        ],
      })
    );
  });

  const prescricaoParagraphs: Paragraph[] = [];
  if (aiResult?.prescricoes) {
    prescricaoParagraphs.push(
      buildBodyParagraph(
        aiResult.prescricoes.floraisBach.join(' • '),
        'Florais de Bach Recomendados: '
      )
    );
    if (aiResult.prescricoes.cristais && aiResult.prescricoes.cristais.length > 0) {
      prescricaoParagraphs.push(
        buildBodyParagraph(
          aiResult.prescricoes.cristais.join(' • '),
          'Cristais Terapêuticos: '
        )
      );
    }
    prescricaoParagraphs.push(
      buildBodyParagraph(
        aiResult.prescricoes.fitoterapiaChas.join(' • '),
        'Fitoterapia e Infusões: '
      )
    );
    if (aiResult.prescricoes.bonsHabitos && aiResult.prescricoes.bonsHabitos.length > 0) {
      prescricaoParagraphs.push(
        buildBodyParagraph(
          aiResult.prescricoes.bonsHabitos.join(' • '),
          'Bons Hábitos Aferidos: '
        )
      );
    }
    prescricaoParagraphs.push(
      buildBodyParagraph(
        aiResult.prescricoes.frequenciasSolfeggio
          .map((f) => `${f.nome} (${f.indicacao})`)
          .join(' | '),
        'Frequências Solfeggio de Apoio: '
      )
    );
  }

  const comparisonParagraphs: Paragraph[] = [];
  if (prev) {
    const bovisDelta = sheet.spiritualPsycho.bovis - prev.ansaeRhen.spiritualPsycho.bovis;
    const hawkinsDelta =
      sheet.spiritualPsycho.hawkinsAgathaHz - prev.ansaeRhen.spiritualPsycho.hawkinsAgathaHz;
    const auraDelta =
      sheet.auricField.protectionPercent - prev.ansaeRhen.auricField.protectionPercent;
    comparisonParagraphs.push(
      buildBodyParagraph(
        `Bovis: ${prev.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å → ${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å (${bovisDelta >= 0 ? `+${bovisDelta}` : bovisDelta} Å) | Hawkins: ${prev.ansaeRhen.spiritualPsycho.hawkinsAgathaHz} Hz → ${sheet.spiritualPsycho.hawkinsAgathaHz} Hz (${hawkinsDelta >= 0 ? `+${hawkinsDelta}` : hawkinsDelta} Hz) | Proteção Áurica: ${prev.ansaeRhen.auricField.protectionPercent}% → ${sheet.auricField.protectionPercent}% (${auraDelta >= 0 ? `+${auraDelta}` : auraDelta}%).`,
        `Evolução (${prev.sessionType} × ${sessionType}): `
      )
    );
  }
  if (aiResult?.comparativoEvolutivo && aiResult.comparativoEvolutivo.trim() !== '') {
    comparisonParagraphs.push(buildBodyParagraph(aiResult.comparativoEvolutivo));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, bottom: 900, left: 1000, right: 1000 },
          },
        },
        children: [
          ...buildDocxOfficialHeader(
            'Relatório Técnico Completo — ANSAE + RHEN & Protocolo Vibracional',
            logo?.bytes ?? null
          ),
          buildSectionHeading('1. Quadro de Identificação e Anamnese'),
          identificationTable,
          new Paragraph({ spacing: { after: 100 } }),
          buildBodyParagraph(
            `Domínios da Pergunta Raiz marcados: ${sheet.rootProblems.join(', ') || 'Avaliação Geral'}.`,
            'Pergunta Raiz ("Onde Existem Problemas?"): '
          ),
          buildBodyParagraph(
            anamnesis.emotionalHistory || 'Sem registros adicionais.',
            'Histórico Emocional/Mental: '
          ),
          buildBodyParagraph(
            anamnesis.physicalSymptoms || 'Sem registros adicionais.',
            'Sintomas Físicos Relatados: '
          ),
          buildBodyParagraph(
            anamnesis.medicalTreatments || 'Não informado.',
            'Tratamentos Médicos Vigentes: '
          ),

          buildSectionHeading('2. Campos Eletromagnéticos (Corpos Sutis)'),
          emTable,

          buildSectionHeading('3. Sete Chakras & Glândulas Correspondentes'),
          chakraTable,

          buildSectionHeading('4. Campo Áurico, Cromoterapia & Dimensão Espiritual'),
          bioAuraTable,
          new Paragraph({ spacing: { before: 120, after: 60 } }),
          lifeAreasTable,

          buildSectionHeading('5. Sistemas Orgânicos e Órgãos/Glândulas (ANSAE)'),
          ...(organsTable
            ? [organsTable]
            : [buildBodyParagraph('Nenhum dos 38 órgãos ANSAE foi sinalizado em desequilíbrio.')]),

          buildSectionHeading('6. Biômetros Virtuais Consultados'),
          ...(sheet.biometerReadings.length > 0
            ? sheet.biometerReadings.map((b) =>
                buildBodyParagraph(b.selectedItem, `${b.biometerName}: `)
              )
            : [buildBodyParagraph('Nenhuma leitura extra registrada nos 22 biômetros virtuais.')]),

          ...(comparisonParagraphs.length > 0
            ? [
                buildSectionHeading('7. Comparativo Evolutivo (Antes × Depois)'),
                ...comparisonParagraphs,
              ]
            : []),

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '8. Análise da Causa Raiz & Diagnóstico Psicossomático'
              : '7. Análise da Causa Raiz & Diagnóstico Psicossomático'
          ),
          ...(aiResult?.analiseCausaRaiz
            ? [buildBodyParagraph(aiResult.analiseCausaRaiz, 'Causa Raiz Cruzada: ')]
            : []),
          buildBodyParagraph(
            aiResult?.analisePsicossomatica ||
              'Análise psicossomática pendente de processamento no Motor de Ressonância Harmônica.'
          ),

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '9. Cronograma Anti-Catarse em Etapas'
              : '8. Cronograma Anti-Catarse em Etapas'
          ),
          ...stageParagraphs,

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '10. Painel de Testemunhos e Comandos Quânticos'
              : '9. Painel de Testemunhos e Comandos Quânticos'
          ),
          ...(testemunhoParagraphs.length > 0
            ? testemunhoParagraphs
            : [buildBodyParagraph('Nenhum testemunho gerado até o momento.')]),
          ...(comandoParagraphs.length > 0
            ? comandoParagraphs
            : [buildBodyParagraph('Nenhum comando quântico gerado até o momento.')]),

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '11. Prescrições Integrativas & Hábitos'
              : '10. Prescrições Integrativas & Hábitos'
          ),
          ...(prescricaoParagraphs.length > 0
            ? prescricaoParagraphs
            : [buildBodyParagraph('Sem prescrições registradas.')]),

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '12. Ressalva Ética e Responsabilidade Terapêutica'
              : '11. Ressalva Ética e Responsabilidade Terapêutica'
          ),
          buildBodyParagraph(
            'Este relatório documenta procedimentos de Radiestesia Terapêutica (ANSAE/RHEN), Ressonância Harmônica e Terapias Vibracionais Integrativas. Os atendimentos têm caráter estritamente complementar, educativo e harmonizador do campo bioenergético, não substituindo consultas médicas, exames diagnósticos, prescrições farmacológicas ou acompanhamentos psicoterápicos convencionais.'
          ),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `relatorio_tecnico_${sanitizeFileName(anamnesis.fullName)}.docx`);
}

// ---------- DOC 2: PATIENT ORIENTATION GUIDE (.DOCX) ----------

export async function downloadPatientGuideDocx(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): Promise<void> {
  const { anamnesis, aiResult, protocol } = session;
  const { sheet, prev } = resolveDocContext(session, ctx);
  const logo = await loadMaestroLogo();
  const pilares = aiResult?.prescricoes.pilaresAutocuidado;
  const chakrasAuraGuide =
    aiResult?.orientacaoChakrasAuraHabitos || buildFallbackChakraAuraHabitsText(session, sheet);
  const welcomeText =
    ctx?.welcomeMessage?.trim() ||
    aiResult?.welcomeMessage?.trim() ||
    getDefaultWelcomeMessage(session);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, bottom: 900, left: 1000, right: 1000 },
          },
        },
        children: [
          ...buildDocxOfficialHeader(
            'Guia de Orientação e Conscientização Vibracional',
            logo?.bytes ?? null
          ),
          new Paragraph({
            spacing: { before: 120, after: 140 },
            children: [
              new TextRun({
                text: `Preparado especialmente para ${anamnesis.fullName}`,
                bold: true,
                size: 24,
                color: NAVY_HEX,
                font: 'Georgia',
              }),
            ],
          }),
          buildBodyParagraph(
            `Foco do Acompanhamento: ${anamnesis.therapeuticFocus} • Ciclo previsto: ${
              protocol.mode === 'escalonado'
                ? 'Cuidado em 2 etapas suaves (Limpeza e depois Vitalização)'
                : 'Harmonização Integrativa Direta (7 a 10 dias)'
            }.`
          ),

          buildDocxWelcomeCard(welcomeText),

          buildSectionHeading('Compreendendo seu Momento Energético'),
          buildBodyParagraph(
            aiResult?.orientacaoPacienteResumo ||
              'Seu campo energético passou por uma avaliação cuidadosa para identificar onde há acúmulo de cansaço emocional e onde precisamos fortalecer sua vitalidade. Nosso objetivo é restaurar seu equilíbrio natural com suavidade, respeitando o tempo do seu corpo e das suas emoções.'
          ),

          ...(prev || aiResult?.comparativoEvolutivo
            ? [
                buildSectionHeading('Sua Evolução Neste Ciclo'),
                buildBodyParagraph(
                  aiResult?.comparativoEvolutivo ||
                    `Sua vitalidade avançou de ${prev?.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å para ${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å e sua proteção áurica alcançou ${sheet.auricField.protectionPercent}%.`
                ),
              ]
            : []),

          buildSectionHeading('Chakras, Cores da Aura & Hábitos na Prática'),
          ...chakrasAuraGuide
            .split('\n\n')
            .filter(Boolean)
            .map((p) => buildBodyParagraph(p)),

          buildSectionHeading('A Relação entre Mente, Emoção e Corpo'),
          buildBodyParagraph(
            'Pensamentos recorrentes, preocupações prolongadas e emoções guardadas funcionam como sinais que influenciam diretamente o ritmo do nosso sistema nervoso, do sono, da digestão e da imunidade. Quando organizamos o campo vibracional e cultivamos hábitos tranquilos no dia a dia, o organismo encontra espaço para se autorregular com mais leveza.'
          ),

          buildSectionHeading('Os 4 Pilares Diários de Autocuidado'),
          buildBodyParagraph(
            pilares?.hidratacaoFitoterapia ||
              'Beba água pura em pequenos goles ao longo do dia (ao menos 2 litros) e utilize os chás suaves recomendados para auxiliar a limpeza e a calma interna.',
            '1. Hidratação e Fitoterapia: '
          ),
          buildBodyParagraph(
            pilares?.higieneMentalOracao ||
              'Reserve 10 minutos diários de silêncio, respiração profunda ou oração, escolhendo pensamentos de serenidade e evitando excesso de notícias ou telas antes de dormir.',
            '2. Higiene Mental e Oração: '
          ),
          buildBodyParagraph(
            pilares?.ambiente ||
              'Mantenha seu quarto arejado, organizado e com luz suave ao entardecer. Um ambiente limpo e silencioso sustenta a harmonia conquistada na sessão.',
            '3. Harmonia do Ambiente: '
          ),
          buildBodyParagraph(
            pilares?.acompanhamentoMedico ||
              'Continue seguindo todas as orientações, exames e medicamentos indicados pelo seu médico de confiança. A terapia vibracional caminha sempre de mãos dadas com o cuidado médico convencional.',
            '4. Acompanhamento Médico Convencional: '
          ),

          ...(aiResult?.prescricoes
            ? [
                buildSectionHeading('Apoios Naturais, Cristais e Frequências'),
                buildBodyParagraph(
                  aiResult.prescricoes.floraisBach.join(' • '),
                  'Florais de Bach sugeridos: '
                ),
                ...(aiResult.prescricoes.cristais && aiResult.prescricoes.cristais.length > 0
                  ? [
                      buildBodyParagraph(
                        aiResult.prescricoes.cristais.join(' • '),
                        'Cristais de apoio: '
                      ),
                    ]
                  : []),
                buildBodyParagraph(
                  aiResult.prescricoes.fitoterapiaChas.join(' • '),
                  'Chás e Infusões acolhedoras: '
                ),
                ...(aiResult.prescricoes.bonsHabitos &&
                aiResult.prescricoes.bonsHabitos.length > 0
                  ? [
                      buildBodyParagraph(
                        aiResult.prescricoes.bonsHabitos.join(' • '),
                        'Hábitos práticos recomendados: '
                      ),
                    ]
                  : []),
                buildBodyParagraph(
                  aiResult.prescricoes.frequenciasSolfeggio
                    .map((f) => `${f.nome} — ${f.indicacao}`)
                    .join(' | '),
                  'Músicas / Frequências Solfeggio para ouvir em repouso: '
                ),
              ]
            : []),

          buildSectionHeading('Mensagem de Acompanhamento'),
          buildBodyParagraph(
            'Qualquer percepção, sonho significativo ou dúvida durante os próximos dias pode ser compartilhada diretamente pelo WhatsApp de atendimento. Caminhamos juntos com serenidade, ética e respeito ao seu ritmo.'
          ),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `guia_paciente_${sanitizeFileName(anamnesis.fullName)}.docx`);
}

// ---------- PDF ENGINE (jsPDF) ----------

class MaestroPdfBuilder {
  private doc: jsPDF;
  private y: number = 18;
  private pageWidth: number;
  private margin: number = 18;
  private contentWidth: number;

  constructor() {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.contentWidth = this.pageWidth - this.margin * 2;
  }

  private ensureSpace(neededMm: number): void {
    const pageHeight = this.doc.internal.pageSize.getHeight();
    if (this.y + neededMm > pageHeight - 16) {
      this.doc.addPage();
      this.y = 18;
    }
  }

  public addOfficialHeader(subtitle: string, logoDataUrl: string | null = null): void {
    const center = this.pageWidth / 2;

    if (logoDataUrl) {
      const logoSize = 26;
      this.doc.addImage(logoDataUrl, 'PNG', center - logoSize / 2, this.y - 4, logoSize, logoSize);
      this.y += logoSize + 1;
    }

    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(15);
    this.doc.setTextColor(15, 23, 42);
    this.doc.text('MAESTRO TERAPIAS VIBRACIONAIS', center, this.y, { align: 'center' });
    this.y += 6.5;

    this.doc.setFont('times', 'italic');
    this.doc.setFontSize(11.5);
    this.doc.setTextColor(180, 83, 9);
    this.doc.text(subtitle, center, this.y, { align: 'center' });
    this.y += 6;

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(15, 23, 42);
    this.doc.text(
      'Giovani Caetano | Terapeuta Vibracional • Radiestesista Terapêutico • Neuroterapia & Hipnoterapia',
      center,
      this.y,
      { align: 'center', maxWidth: this.contentWidth }
    );
    this.y += 5;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text(
      'Atendimentos Integrativos • Contatos: (68) 99247-6436 | (11) 95056-5215',
      center,
      this.y,
      { align: 'center' }
    );
    this.y += 4;

    this.doc.setDrawColor(180, 83, 9);
    this.doc.setLineWidth(0.7);
    this.doc.line(this.margin, this.y, this.pageWidth - this.margin, this.y);
    this.y += 8;
  }

  public addSectionTitle(title: string): void {
    this.ensureSpace(14);
    this.y += 2;
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(12);
    this.doc.setTextColor(15, 23, 42);
    this.doc.text(title, this.margin, this.y);
    this.y += 2;
    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, this.y, this.pageWidth - this.margin, this.y);
    this.y += 5.5;
  }

  public addParagraph(text: string, boldLabel?: string, italic = false): void {
    this.doc.setFont('helvetica', italic ? 'italic' : 'normal');
    this.doc.setFontSize(9.8);
    this.doc.setTextColor(51, 65, 85);

    const fullText = boldLabel ? `${boldLabel}${text}` : text;
    const lines: string[] = this.doc.splitTextToSize(fullText, this.contentWidth);

    lines.forEach((line, idx) => {
      this.ensureSpace(5.5);
      if (boldLabel && idx === 0 && line.startsWith(boldLabel)) {
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(15, 23, 42);
        this.doc.text(boldLabel, this.margin, this.y);
        const labelWidth = this.doc.getTextWidth(boldLabel);
        this.doc.setFont('helvetica', italic ? 'italic' : 'normal');
        this.doc.setTextColor(51, 65, 85);
        this.doc.text(line.slice(boldLabel.length), this.margin + labelWidth, this.y);
      } else {
        this.doc.setFont('helvetica', italic ? 'italic' : 'normal');
        this.doc.setTextColor(51, 65, 85);
        this.doc.text(line, this.margin, this.y);
      }
      this.y += 4.8;
    });
    this.y += 2.2;
  }

  public addKeyValueTable(rows: Array<[string, string]>): void {
    const col1W = 54;
    const col2W = this.contentWidth - col1W;

    rows.forEach(([key, value]) => {
      const valueLines: string[] = this.doc.splitTextToSize(value, col2W - 5);
      const rowHeight = Math.max(7.5, valueLines.length * 4.5 + 3);
      this.ensureSpace(rowHeight + 2);

      this.doc.setFillColor(250, 248, 245);
      this.doc.setDrawColor(203, 213, 225);
      this.doc.setLineWidth(0.25);
      this.doc.rect(this.margin, this.y, col1W, rowHeight, 'FD');
      this.doc.rect(this.margin + col1W, this.y, col2W, rowHeight, 'D');

      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      this.doc.setTextColor(15, 23, 42);
      this.doc.text(key, this.margin + 2.5, this.y + 4.8, { maxWidth: col1W - 5 });

      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(51, 65, 85);
      valueLines.forEach((line, i) => {
        this.doc.text(line, this.margin + col1W + 2.5, this.y + 4.8 + i * 4.5);
      });

      this.y += rowHeight;
    });
    this.y += 4;
  }

  public addWelcomeCard(text: string): void {
    const paragraphs = text
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
    const items = paragraphs.length > 0 ? paragraphs : [text];

    this.doc.setFont('times', 'italic');
    this.doc.setFontSize(10);

    const wrappedParagraphs = items.map((p) =>
      this.doc.splitTextToSize(p, this.contentWidth - 11) as string[]
    );
    const totalLines = wrappedParagraphs.reduce((sum, lines) => sum + lines.length, 0);
    const paragraphGaps = Math.max(0, wrappedParagraphs.length - 1) * 2.2;
    const cardHeight = totalLines * 4.9 + paragraphGaps + 9;

    this.ensureSpace(cardHeight + 6);

    // Fundo suave #F1F5F9 e borda esquerda Âmbar/Dourado #B45309
    this.doc.setFillColor(241, 245, 249);
    this.doc.rect(this.margin, this.y, this.contentWidth, cardHeight, 'F');
    this.doc.setFillColor(180, 83, 9);
    this.doc.rect(this.margin, this.y, 1.6, cardHeight, 'F');

    let textY = this.y + 6;
    this.doc.setTextColor(30, 41, 59);
    wrappedParagraphs.forEach((lines, pIdx) => {
      const isVocative = pIdx === 0 && items[0].endsWith(':');
      this.doc.setFont('times', isVocative ? 'bolditalic' : 'italic');
      lines.forEach((line) => {
        this.doc.text(line, this.margin + 5.5, textY);
        textY += 4.9;
      });
      textY += 2.2;
    });

    this.y += cardHeight + 6;
  }

  public save(filename: string): void {
    this.doc.save(filename);
  }
}

export async function downloadTherapistPdf(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): Promise<void> {
  const { anamnesis, sensitivity, protocol, aiResult } = session;
  const { sheet, prev, sessionType } = resolveDocContext(session, ctx);
  const logo = await loadMaestroLogo();
  const hawkinsInfo = getHawkinsLevelInfo(sensitivity.hawkins);
  const birthBR = formatBirthDateBR(anamnesis.birthDate);
  const imbalancedOrgans = sheet.organs.filter((o) => o.isImbalanced);

  const pdf = new MaestroPdfBuilder();
  pdf.addOfficialHeader(
    'Relatório Técnico Completo — ANSAE + RHEN & Protocolo Vibracional',
    logo?.dataUrl ?? null
  );

  pdf.addSectionTitle('1. Quadro de Identificação e Anamnese');
  pdf.addKeyValueTable([
    ['Paciente', anamnesis.fullName],
    ['Tipo de Sessão', sessionType],
    ['Data de Nascimento', birthBR || 'Não informado'],
    ['Contato', anamnesis.phone || 'Não informado'],
    ['Data do Registro', formatDateTimeBR(session.activatedAt)],
    ['Foco Terapêutico', anamnesis.therapeuticFocus],
    ['Pergunta Raiz', sheet.rootProblems.join(', ') || 'Avaliação Geral'],
    ['Histórico Emocional', anamnesis.emotionalHistory || 'Sem observações adicionais'],
    ['Sintomas Físicos', anamnesis.physicalSymptoms || 'Sem sintomas registrados'],
    ['Tratamento Médico', anamnesis.medicalTreatments || 'Não informado'],
  ]);

  pdf.addSectionTitle('2. Campos Eletromagnéticos & Sete Chakras + Glândulas');
  pdf.addKeyValueTable(
    sheet.electromagneticFields.map((f) => [
      f.label,
      `${f.imbalancePercent}% de desequilíbrio · Chakras: ${
        f.affectedChakras.join(', ') || 'Nenhum'
      }`,
    ])
  );
  pdf.addKeyValueTable(
    sheet.chakras.map((c) => [
      `${c.name} (${c.gland})`,
      `${c.status} · ${c.imbalancePercent}% desequilíbrio · Afeta físico: ${
        c.affectsPhysicalBody ? 'Sim' : 'Não'
      }`,
    ])
  );

  pdf.addSectionTitle('3. Campo Áurico, Cromoterapia, Dimensão Espiritual & Áreas da Vida');
  pdf.addKeyValueTable([
    [
      'Biômetro de Bovis',
      `${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å (${
        sheet.spiritualPsycho.bovis < 6500 ? 'Abaixo de 6.500 Å — Alerta Anti-Catarse' : 'Estável'
      })`,
    ],
    [
      'Hawkins / Ágatha',
      `${sheet.spiritualPsycho.hawkinsAgathaHz} Hz — ${hawkinsInfo.label} (${hawkinsInfo.zone})`,
    ],
    [
      'Estresse & Yin/Yang',
      `Estresse ${sheet.spiritualPsycho.stressLevel}/9 · ${sheet.spiritualPsycho.yinPercent}% Yin / ${sheet.spiritualPsycho.yangPercent}% Yang`,
    ],
    [
      'Campo Áurico',
      `Proteção: ${sheet.auricField.protectionLabel} (${sheet.auricField.protectionPercent}%) · Tamanho: ${sheet.auricField.sizeLabel} (${sheet.auricField.sizePercent}%)`,
    ],
    [
      'Cores da Aura',
      `Em falta: ${sheet.auricField.missingColors.join(', ') || '—'} | Em excesso: ${
        sheet.auricField.excessColors.join(', ') || '—'
      }`,
    ],
    [
      'Áreas da Vida',
      `Familiar: ${sheet.lifeAreas.familiar} | Afetivo: ${sheet.lifeAreas.relacionamentoAfetivo} | Profissional: ${sheet.lifeAreas.profissional} | Financeiro: ${sheet.lifeAreas.financeiro} | Missão: ${sheet.lifeAreas.missaoDeVida}`,
    ],
    [
      'Espiritual & Carma',
      [
        ...sheet.spiritualPsycho.spiritualDisturbances,
        ...sheet.spiritualPsycho.implantsDetected,
        ...sheet.spiritualPsycho.karmicCommitments,
      ].join('; ') || 'Sem registros densos',
    ],
    ['Virtudes a Ancorar', sheet.spiritualPsycho.virtuesToAnchor.join(', ') || 'Serenidade'],
    ['Mesa Radiônica Indicada', sheet.spiritualPsycho.recommendedRadionicBoard],
  ]);

  pdf.addSectionTitle('4. Órgãos ANSAE em Alerta & Biômetros Consultados');
  if (imbalancedOrgans.length > 0) {
    pdf.addKeyValueTable(
      imbalancedOrgans.map((o) => [
        `[${o.systemCode}] ${o.organName}`,
        `${o.systemName} · ${o.imbalancePercent}% desequilíbrio · Tempo: ${o.durationValue}${o.durationUnit}`,
      ])
    );
  } else {
    pdf.addParagraph('Nenhum órgão dos 15 sistemas ANSAE sinalizado em desequilíbrio.');
  }

  if (sheet.biometerReadings.length > 0) {
    pdf.addKeyValueTable(
      sheet.biometerReadings.map((b) => [b.biometerName, b.selectedItem])
    );
  }

  if (prev || aiResult?.comparativoEvolutivo) {
    pdf.addSectionTitle('5. Comparativo Evolutivo (Antes × Depois)');
    if (prev) {
      pdf.addParagraph(
        `Bovis: ${prev.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å → ${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å | Hawkins: ${prev.ansaeRhen.spiritualPsycho.hawkinsAgathaHz} Hz → ${sheet.spiritualPsycho.hawkinsAgathaHz} Hz | Proteção Áurica: ${prev.ansaeRhen.auricField.protectionPercent}% → ${sheet.auricField.protectionPercent}%.`,
        `${prev.sessionType} × ${sessionType}: `
      );
    }
    if (aiResult?.comparativoEvolutivo) {
      pdf.addParagraph(aiResult.comparativoEvolutivo);
    }
  }

  pdf.addSectionTitle('6. Análise da Causa Raiz & Diagnóstico Psicossomático');
  if (aiResult?.analiseCausaRaiz) {
    pdf.addParagraph(aiResult.analiseCausaRaiz, 'Causa Raiz Cruzada: ');
  }
  pdf.addParagraph(
    aiResult?.analisePsicossomatica ||
      'Processe o Motor de Ressonância Harmônica na Tela 4 para preencher este diagnóstico.'
  );

  pdf.addSectionTitle('7. Cronograma Anti-Catarse em Etapas');
  if (protocol.mode === 'escalonado' && protocol.stage1 && protocol.stage2) {
    pdf.addParagraph(
      `Motivos técnicos: ${protocol.riskReasons.join('; ')}.`,
      'Modo Escalonado em 2 Etapas Ativado: '
    );
    pdf.addParagraph(
      `${protocol.stage1.durationLabel} — ${protocol.stage1.objective} Geometrias: ${protocol.stage1.geometries
        .map((g) => g.name)
        .join(', ')}. Bloqueadas: ${protocol.stage1.blockedGeometries.join('; ')}.`,
      `${protocol.stage1.title}: `
    );
    pdf.addParagraph(
      'Pausa obrigatória de 12 horas entre as etapas.',
      'Intervalo de Repouso: '
    );
    pdf.addParagraph(
      `${protocol.stage2.durationLabel} — ${protocol.stage2.objective} Geometrias: ${protocol.stage2.geometries
        .map((g) => g.name)
        .join(', ')}.`,
      `${protocol.stage2.title}: `
    );
  } else if (protocol.singleStage) {
    pdf.addParagraph(
      `${protocol.singleStage.durationLabel} — ${protocol.singleStage.objective} Geometrias: ${protocol.singleStage.geometries
        .map((g) => g.name)
        .join(', ')}.`,
      'Protocolo Direto em Etapa Única: '
    );
  }

  pdf.addSectionTitle('8. Testemunhos e Comandos Quânticos');
  (aiResult?.testemunhos || []).forEach((t) => {
    pdf.addParagraph(`${t.testemunhoFormatado} (${t.etapa})`, `${t.geometria}: `);
  });
  (aiResult?.comandosQuanticos || []).forEach((cmd) => {
    pdf.addParagraph(`"${cmd.comandoTexto}"`, `${cmd.tituloComando} (${cmd.etapa}): `, true);
  });

  if (aiResult?.prescricoes) {
    pdf.addSectionTitle('9. Prescrições Integrativas, Cristais & Bons Hábitos');
    pdf.addParagraph(aiResult.prescricoes.floraisBach.join(' • '), 'Florais de Bach: ');
    if (aiResult.prescricoes.cristais && aiResult.prescricoes.cristais.length > 0) {
      pdf.addParagraph(aiResult.prescricoes.cristais.join(' • '), 'Cristais Terapêuticos: ');
    }
    pdf.addParagraph(aiResult.prescricoes.fitoterapiaChas.join(' • '), 'Fitoterapia / Chás: ');
    if (aiResult.prescricoes.bonsHabitos && aiResult.prescricoes.bonsHabitos.length > 0) {
      pdf.addParagraph(aiResult.prescricoes.bonsHabitos.join(' • '), 'Bons Hábitos: ');
    }
    pdf.addParagraph(
      aiResult.prescricoes.frequenciasSolfeggio
        .map((f) => `${f.nome} (${f.indicacao})`)
        .join(' | '),
      'Frequências Solfeggio: '
    );
  }

  pdf.addSectionTitle('10. Ressalva Ética');
  pdf.addParagraph(
    'Este protocolo integra Radiestesia Terapêutica (ANSAE/RHEN) e Ressonância Harmônica em caráter complementar e educativo, não substituindo diagnósticos, consultas ou tratamentos médicos e psicológicos convencionais.'
  );

  pdf.save(`relatorio_tecnico_${sanitizeFileName(anamnesis.fullName)}.pdf`);
}

export async function downloadPatientGuidePdf(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): Promise<void> {
  const { anamnesis, aiResult, protocol } = session;
  const { sheet, prev } = resolveDocContext(session, ctx);
  const logo = await loadMaestroLogo();
  const pilares = aiResult?.prescricoes.pilaresAutocuidado;
  const chakrasAuraGuide =
    aiResult?.orientacaoChakrasAuraHabitos || buildFallbackChakraAuraHabitsText(session, sheet);
  const welcomeText =
    ctx?.welcomeMessage?.trim() ||
    aiResult?.welcomeMessage?.trim() ||
    getDefaultWelcomeMessage(session);

  const pdf = new MaestroPdfBuilder();
  pdf.addOfficialHeader(
    'Guia de Orientação e Conscientização Vibracional',
    logo?.dataUrl ?? null
  );

  pdf.addParagraph(
    `${anamnesis.fullName} • Foco: ${anamnesis.therapeuticFocus}`,
    'Paciente: '
  );
  pdf.addParagraph(
    protocol.mode === 'escalonado'
      ? 'Protocolo suave em 2 etapas (Limpeza/Blindagem inicial de 48h–72h, pausa de 12h e Vitalização de 7–10 dias).'
      : 'Protocolo direto de harmonização e vitalidade (7 a 10 dias).',
    'Jornada de Cuidado: '
  );

  pdf.addWelcomeCard(welcomeText);

  pdf.addSectionTitle('Seu Momento Energético Atual');
  pdf.addParagraph(
    aiResult?.orientacaoPacienteResumo ||
      'Realizamos uma leitura cuidadosa do seu campo energético para acolher sinais de cansaço e organizar sua vitalidade com suavidade.'
  );

  if (prev || aiResult?.comparativoEvolutivo) {
    pdf.addSectionTitle('Sua Evolução Neste Ciclo');
    pdf.addParagraph(
      aiResult?.comparativoEvolutivo ||
        `Sua vitalidade avançou de ${prev?.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å para ${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å e sua proteção áurica alcançou ${sheet.auricField.protectionPercent}%.`
    );
  }

  pdf.addSectionTitle('Chakras, Cores da Aura & Hábitos na Prática');
  chakrasAuraGuide
    .split('\n\n')
    .filter(Boolean)
    .forEach((p) => pdf.addParagraph(p));

  pdf.addSectionTitle('A Conexão entre Mente, Emoção e Corpo');
  pdf.addParagraph(
    'Nossos pensamentos, sentimentos e rotina diária dialogam continuamente com o corpo físico. Ao cuidar da serenidade emocional e harmonizar seu campo sutil, você favorece o sono reparador, a disposição e o bem-estar integral.'
  );

  pdf.addSectionTitle('Os 4 Pilares Diários de Autocuidado');
  pdf.addParagraph(
    pilares?.hidratacaoFitoterapia ||
      'Ingira água pura ao longo do dia e utilize os chás suaves recomendados.',
    '1. Hidratação e Fitoterapia: '
  );
  pdf.addParagraph(
    pilares?.higieneMentalOracao ||
      'Reserve momentos de silêncio, respiração profunda ou oração antes de dormir.',
    '2. Higiene Mental e Oração: '
  );
  pdf.addParagraph(
    pilares?.ambiente ||
      'Mantenha o quarto ventilado, limpo e com iluminação acolhedora ao anoitecer.',
    '3. Ambiente: '
  );
  pdf.addParagraph(
    pilares?.acompanhamentoMedico ||
      'Mantenha sempre suas consultas, exames e orientações médicas convencionais.',
    '4. Acompanhamento Médico Convencional: '
  );

  if (aiResult?.prescricoes) {
    pdf.addSectionTitle('Apoios Naturais, Cristais e Frequências');
    pdf.addParagraph(aiResult.prescricoes.floraisBach.join(' • '), 'Florais de Bach: ');
    if (aiResult.prescricoes.cristais && aiResult.prescricoes.cristais.length > 0) {
      pdf.addParagraph(aiResult.prescricoes.cristais.join(' • '), 'Cristais Terapêuticos: ');
    }
    pdf.addParagraph(aiResult.prescricoes.fitoterapiaChas.join(' • '), 'Chás e Infusões: ');
    if (aiResult.prescricoes.bonsHabitos && aiResult.prescricoes.bonsHabitos.length > 0) {
      pdf.addParagraph(aiResult.prescricoes.bonsHabitos.join(' • '), 'Bons Hábitos Diários: ');
    }
    pdf.addParagraph(
      aiResult.prescricoes.frequenciasSolfeggio
        .map((f) => `${f.nome} — ${f.indicacao}`)
        .join(' | '),
      'Frequências Sonoras: '
    );
  }

  pdf.save(`guia_paciente_${sanitizeFileName(anamnesis.fullName)}.pdf`);
}

export function buildWhatsAppShareUrl(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): string {
  const { anamnesis, aiResult, protocol } = session;
  const { sheet } = resolveDocContext(session, ctx);
  const pilares = aiResult?.prescricoes.pilaresAutocuidado;
  const freqs =
    aiResult?.prescricoes.frequenciasSolfeggio.map((f) => `${f.hz} Hz`).join(', ') || '432 Hz';
  const missingColors = sheet.auricField.missingColors.join(', ');
  const welcomeText =
    ctx?.welcomeMessage?.trim() ||
    aiResult?.welcomeMessage?.trim() ||
    getDefaultWelcomeMessage(session);
  const welcomeLines = welcomeText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const welcomeBody =
    welcomeLines.length > 1 && welcomeLines[0].endsWith(':')
      ? welcomeLines.slice(1).join(' ')
      : welcomeLines.join(' ');
  const welcomeSynthesis =
    welcomeBody.length > 260 ? `${welcomeBody.slice(0, 257).trimEnd()}...` : welcomeBody;

  const text = [
    `*MAESTRO TERAPIAS VIBRACIONAIS*`,
    `_Guia de Orientação e Conscientização Vibracional_`,
    ``,
    `Olá, *${anamnesis.fullName}*!`,
    welcomeSynthesis ? `_${welcomeSynthesis}_` : '',
    `Segue o resumo do seu atendimento integrativo:`,
    ``,
    `*Foco:* ${anamnesis.therapeuticFocus}`,
    `*Etapa:* ${
      protocol.mode === 'escalonado'
        ? 'Protocolo Suave em 2 Etapas (Limpeza & Blindagem -> Pausa 12h -> Vitalização)'
        : 'Harmonização Direta (7 a 10 dias)'
    }`,
    missingColors ? `*Cores da Aura para nutrir seu campo:* ${missingColors}` : '',
    ``,
    `*4 Pilares Diários:*`,
    `1. Hidratação/Chás: ${pilares?.hidratacaoFitoterapia || 'Beber 2L de água pura e chás suaves.'}`,
    `2. Higiene Mental/Oração: ${pilares?.higieneMentalOracao || '10 min de respiração calma e oração diária.'}`,
    `3. Ambiente: ${pilares?.ambiente || 'Manter o quarto arejado e livre de excesso de telas à noite.'}`,
    `4. Acompanhamento Médico: ${pilares?.acompanhamentoMedico || 'Manter normalmente seus cuidados médicos convencionais.'}`,
    ``,
    `*Frequência Solfeggio indicada:* ${freqs}`,
    ``,
    `_Giovani Caetano • Terapeuta Vibracional_`,
    `_(68) 99247-6436 | (11) 95056-5215_`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
