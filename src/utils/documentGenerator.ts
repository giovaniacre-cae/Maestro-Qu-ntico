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
import { QuantumRoomSession } from '../types/quantum';
import { formatBirthDateBR, getHawkinsLevelInfo } from './antiCatharsis';

const NAVY_HEX = '0F172A';
const AMBER_HEX = 'B45309';
const SLATE_TEXT_HEX = '334155';
const MUTED_HEX = '64748B';
const BORDER_HEX = 'CBD5E1';
const LIGHT_BG_HEX = 'FAF8F5';
const MAESTRO_LOGO_URL =
  './assets/aistudio/Logo_Maestro_terapias_Vibracionais_Sem_fundo__2__f6ac1f97.png';

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

// ---------- DOC 1: THERAPIST TECHNICAL REPORT (.DOCX) ----------

export async function downloadTherapistDocx(session: QuantumRoomSession): Promise<void> {
  const { anamnesis, sensitivity, protocol, aiResult } = session;
  const logo = await loadMaestroLogo();
  const hawkinsInfo = getHawkinsLevelInfo(sensitivity.hawkins);
  const birthBR = formatBirthDateBR(anamnesis.birthDate);
  const alertSystems = sensitivity.organicSystems.filter((s) => s.status === 'Em Alerta');

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
          buildTableCell('Contato', true, true),
          buildTableCell(anamnesis.phone || 'Não informado', false, false),
          buildTableCell('Data do Registro', true, true),
          buildTableCell(formatDateTimeBR(session.activatedAt), false, false),
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

  const bioTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell('Parâmetro Radiestésico', true, true),
          buildTableCell('Aferição', true, true),
          buildTableCell('Leitura Clínica', true, true),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Biômetro de Bovis', true),
          buildTableCell(`${sensitivity.bovis.toLocaleString('pt-BR')} Å`),
          buildTableCell(
            sensitivity.bovis < 6500
              ? 'Abaixo do limiar de estabilidade (6.500 Å) — Risco de catarse'
              : 'Campo vital estável (≥ 6.500 Å)'
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Escala de Hawkins', true),
          buildTableCell(`${sensitivity.hawkins} (${hawkinsInfo.label})`),
          buildTableCell(`${hawkinsInfo.zone} — ${hawkinsInfo.emotion}`),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Proteção Áurica', true),
          buildTableCell(`${sensitivity.auricProtection}%`),
          buildTableCell(
            sensitivity.auricProtection < 50
              ? 'Malha áurica permeável (< 50%) — Exige blindagem prévia'
              : 'Contenção áurica satisfatória'
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Estresse / Sobrecarga Neural', true),
          buildTableCell(`Nível ${sensitivity.stressLevel} / 9`),
          buildTableCell(
            sensitivity.stressLevel >= 4
              ? 'Sobrecarga simpática elevada — Necessária descompressão gradual'
              : 'Tônus adaptativo moderado/estável'
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Interferências Sutis', true),
          buildTableCell(`${sensitivity.subtleInterferences} detectada(s)`),
          buildTableCell(
            sensitivity.interferenceTypes.length > 0
              ? sensitivity.interferenceTypes.join(', ')
              : 'Campo limpo de interferências densas'
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Sistemas Orgânicos em Alerta', true),
          buildTableCell(`${alertSystems.length} de ${sensitivity.organicSystems.length}`),
          buildTableCell(
            alertSystems.length > 0
              ? alertSystems.map((s) => `${s.name} (${s.note})`).join('; ')
              : 'Todos os sistemas em equilíbrio'
          ),
        ],
      }),
    ],
  });

  const chakraTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell('Chakra', true, true),
          buildTableCell('Centro Sânscrito', true, true),
          buildTableCell('Vitalidade (%)', true, true),
          buildTableCell('Estado', true, true),
        ],
      }),
      ...sensitivity.chakras.map(
        (c) =>
          new TableRow({
            children: [
              buildTableCell(c.name, true),
              buildTableCell(c.sanskrit),
              buildTableCell(`${c.percentage}%`),
              buildTableCell(c.status),
            ],
          })
      ),
    ],
  });

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
      ),
      buildBodyParagraph(
        aiResult.prescricoes.fitoterapiaChas.join(' • '),
        'Fitoterapia e Infusões: '
      ),
      buildBodyParagraph(
        aiResult.prescricoes.frequenciasSolfeggio
          .map((f) => `${f.nome} (${f.indicacao})`)
          .join(' | '),
        'Frequências Solfeggio de Apoio: '
      )
    );
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
            'Relatório Técnico e Protocolo Clínico Vibracional',
            logo?.bytes ?? null
          ),
          buildSectionHeading('1. Quadro de Identificação e Anamnese'),
          identificationTable,
          new Paragraph({ spacing: { after: 100 } }),
          buildBodyParagraph(anamnesis.emotionalHistory || 'Sem registros adicionais.', 'Histórico Emocional/Mental: '),
          buildBodyParagraph(anamnesis.physicalSymptoms || 'Sem registros adicionais.', 'Sintomas Físicos Relatados: '),
          buildBodyParagraph(anamnesis.medicalTreatments || 'Não informado.', 'Tratamentos Médicos Vigentes: '),

          buildSectionHeading('2. Panorama Bioenergético e Radiestésico'),
          bioTable,
          new Paragraph({ spacing: { before: 140, after: 80 } }),
          chakraTable,

          buildSectionHeading('3. Diagnóstico Psicossomático'),
          buildBodyParagraph(
            aiResult?.analisePsicossomatica ||
              'Análise psicossomática pendente de processamento no Motor de Ressonância Harmônica.'
          ),

          buildSectionHeading('4. Cronograma Anti-Catarse em Etapas'),
          ...stageParagraphs,

          buildSectionHeading('5. Painel de Testemunhos e Comandos Quânticos'),
          ...(testemunhoParagraphs.length > 0
            ? testemunhoParagraphs
            : [buildBodyParagraph('Nenhum testemunho gerado até o momento.')]),
          ...(comandoParagraphs.length > 0
            ? comandoParagraphs
            : [buildBodyParagraph('Nenhum comando quântico gerado até o momento.')]),

          buildSectionHeading('6. Prescrições Integrativas'),
          ...(prescricaoParagraphs.length > 0
            ? prescricaoParagraphs
            : [buildBodyParagraph('Sem prescrições registradas.')]),

          buildSectionHeading('7. Ressalva Ética e Responsabilidade Terapêutica'),
          buildBodyParagraph(
            'Este relatório documenta procedimentos de Radiestesia Terapêutica, Ressonância Harmônica e Terapias Vibracionais Integrativas. Os atendimentos têm caráter estritamente complementar, educativo e harmonizador do campo bioenergético, não substituindo consultas médicas, exames diagnósticos, prescrições farmacológicas ou acompanhamentos psicoterápicos convencionais.'
          ),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `relatorio_tecnico_${sanitizeFileName(anamnesis.fullName)}.docx`);
}

// ---------- DOC 2: PATIENT ORIENTATION GUIDE (.DOCX) ----------

export async function downloadPatientGuideDocx(session: QuantumRoomSession): Promise<void> {
  const { anamnesis, aiResult, protocol } = session;
  const logo = await loadMaestroLogo();
  const pilares = aiResult?.prescricoes.pilaresAutocuidado;

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

          buildSectionHeading('Compreendendo seu Momento Energético'),
          buildBodyParagraph(
            aiResult?.orientacaoPacienteResumo ||
              'Seu campo energético passou por uma avaliação cuidadosa para identificar onde há acúmulo de cansaço emocional e onde precisamos fortalecer sua vitalidade. Nosso objetivo é restaurar seu equilíbrio natural com suavidade, respeitando o tempo do seu corpo e das suas emoções.'
          ),

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
                buildSectionHeading('Sugestões Naturais e Sonoras de Apoio'),
                buildBodyParagraph(
                  aiResult.prescricoes.floraisBach.join(' • '),
                  'Florais de Bach sugeridos: '
                ),
                buildBodyParagraph(
                  aiResult.prescricoes.fitoterapiaChas.join(' • '),
                  'Chás e Infusões acolhedoras: '
                ),
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
    this.doc.setTextColor(15, 23, 42); // #0F172A
    this.doc.text('MAESTRO TERAPIAS VIBRACIONAIS', center, this.y, { align: 'center' });
    this.y += 6.5;

    this.doc.setFont('times', 'italic');
    this.doc.setFontSize(11.5);
    this.doc.setTextColor(180, 83, 9); // #B45309
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

    // Gold horizontal divider line
    this.doc.setDrawColor(180, 83, 9); // #B45309
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

      // Left cell background
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

  public save(filename: string): void {
    this.doc.save(filename);
  }
}

export async function downloadTherapistPdf(session: QuantumRoomSession): Promise<void> {
  const { anamnesis, sensitivity, protocol, aiResult } = session;
  const logo = await loadMaestroLogo();
  const hawkinsInfo = getHawkinsLevelInfo(sensitivity.hawkins);
  const birthBR = formatBirthDateBR(anamnesis.birthDate);
  const alertSystems = sensitivity.organicSystems.filter((s) => s.status === 'Em Alerta');

  const pdf = new MaestroPdfBuilder();
  pdf.addOfficialHeader(
    'Relatório Técnico e Protocolo Clínico Vibracional',
    logo?.dataUrl ?? null
  );

  pdf.addSectionTitle('1. Quadro de Identificação e Anamnese');
  pdf.addKeyValueTable([
    ['Paciente', anamnesis.fullName],
    ['Data de Nascimento', birthBR || 'Não informado'],
    ['Contato', anamnesis.phone || 'Não informado'],
    ['Data do Registro', formatDateTimeBR(session.activatedAt)],
    ['Foco Terapêutico', anamnesis.therapeuticFocus],
    ['Histórico Emocional', anamnesis.emotionalHistory || 'Sem observações adicionais'],
    ['Sintomas Físicos', anamnesis.physicalSymptoms || 'Sem sintomas registrados'],
    ['Tratamento Médico', anamnesis.medicalTreatments || 'Não informado'],
  ]);

  pdf.addSectionTitle('2. Panorama Bioenergético e Radiestésico');
  pdf.addKeyValueTable([
    [
      'Biômetro de Bovis',
      `${sensitivity.bovis.toLocaleString('pt-BR')} Å (${
        sensitivity.bovis < 6500 ? 'Abaixo de 6.500 Å — Alerta Anti-Catarse' : 'Estável'
      })`,
    ],
    ['Escala de Hawkins', `${sensitivity.hawkins} — ${hawkinsInfo.label} (${hawkinsInfo.zone})`],
    ['Proteção Áurica', `${sensitivity.auricProtection}%`],
    ['Estresse / Sobrecarga', `Nível ${sensitivity.stressLevel} de 9`],
    [
      'Interferências Sutis',
      `${sensitivity.subtleInterferences} (${
        sensitivity.interferenceTypes.join(', ') || 'Nenhuma'
      })`,
    ],
    [
      'Chakras',
      sensitivity.chakras.map((c) => `${c.name}: ${c.percentage}% (${c.status})`).join(' | '),
    ],
    [
      'Sistemas em Alerta',
      alertSystems.length > 0
        ? alertSystems.map((s) => `${s.name} — ${s.note}`).join('; ')
        : 'Todos os sistemas equilibrados',
    ],
  ]);

  pdf.addSectionTitle('3. Diagnóstico Psicossomático');
  pdf.addParagraph(
    aiResult?.analisePsicossomatica ||
      'Processe o Motor de Ressonância Harmônica na Tela 4 para preencher este diagnóstico.'
  );

  pdf.addSectionTitle('4. Cronograma Anti-Catarse em Etapas');
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

  pdf.addSectionTitle('5. Testemunhos e Comandos Quânticos');
  (aiResult?.testemunhos || []).forEach((t) => {
    pdf.addParagraph(`${t.testemunhoFormatado} (${t.etapa})`, `${t.geometria}: `);
  });
  (aiResult?.comandosQuanticos || []).forEach((cmd) => {
    pdf.addParagraph(`"${cmd.comandoTexto}"`, `${cmd.tituloComando} (${cmd.etapa}): `, true);
  });

  if (aiResult?.prescricoes) {
    pdf.addSectionTitle('6. Prescrições Integrativas');
    pdf.addParagraph(aiResult.prescricoes.floraisBach.join(' • '), 'Florais de Bach: ');
    pdf.addParagraph(aiResult.prescricoes.fitoterapiaChas.join(' • '), 'Fitoterapia / Chás: ');
    pdf.addParagraph(
      aiResult.prescricoes.frequenciasSolfeggio
        .map((f) => `${f.nome} (${f.indicacao})`)
        .join(' | '),
      'Frequências Solfeggio: '
    );
  }

  pdf.addSectionTitle('7. Ressalva Ética');
  pdf.addParagraph(
    'Este protocolo integra Radiestesia Terapêutica e Ressonância Harmônica em caráter complementar e educativo, não substituindo diagnósticos, consultas ou tratamentos médicos e psicológicos convencionais.'
  );

  pdf.save(`relatorio_tecnico_${sanitizeFileName(anamnesis.fullName)}.pdf`);
}

export async function downloadPatientGuidePdf(session: QuantumRoomSession): Promise<void> {
  const { anamnesis, aiResult, protocol } = session;
  const logo = await loadMaestroLogo();
  const pilares = aiResult?.prescricoes.pilaresAutocuidado;

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

  pdf.addSectionTitle('Seu Momento Energético Atual');
  pdf.addParagraph(
    aiResult?.orientacaoPacienteResumo ||
      'Realizamos uma leitura cuidadosa do seu campo energético para acolher sinais de cansaço e organizar sua vitalidade com suavidade.'
  );

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
    pdf.addSectionTitle('Apoios Naturais e Frequências Recomendadas');
    pdf.addParagraph(aiResult.prescricoes.floraisBach.join(' • '), 'Florais de Bach: ');
    pdf.addParagraph(aiResult.prescricoes.fitoterapiaChas.join(' • '), 'Chás e Infusões: ');
    pdf.addParagraph(
      aiResult.prescricoes.frequenciasSolfeggio
        .map((f) => `${f.nome} — ${f.indicacao}`)
        .join(' | '),
      'Frequências Sonoras: '
    );
  }

  pdf.save(`guia_paciente_${sanitizeFileName(anamnesis.fullName)}.pdf`);
}

export function buildWhatsAppShareUrl(session: QuantumRoomSession): string {
  const { anamnesis, aiResult, protocol } = session;
  const pilares = aiResult?.prescricoes.pilaresAutocuidado;
  const freqs = aiResult?.prescricoes.frequenciasSolfeggio.map((f) => `${f.hz} Hz`).join(', ') || '432 Hz';

  const text = [
    `*MAESTRO TERAPIAS VIBRACIONAIS*`,
    `_Guia de Orientação e Conscientização Vibracional_`,
    ``,
    `Olá, *${anamnesis.fullName}*!`,
    `Segue o resumo do seu atendimento integrativo:`,
    ``,
    `*Foco:* ${anamnesis.therapeuticFocus}`,
    `*Etapa:* ${
      protocol.mode === 'escalonado'
        ? 'Protocolo Suave em 2 Etapas (Limpeza & Blindagem -> Pausa 12h -> Vitalização)'
        : 'Harmonização Direta (7 a 10 dias)'
    }`,
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
  ].join('\n');

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
