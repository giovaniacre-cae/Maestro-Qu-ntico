import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
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
  analyzeAuricColorsChakraCorrelation,
} from '../types/clinical';
import { QuantumRoomSession } from '../types/quantum';
import {
  applyChartCrystalsToResult,
  formatAngstromsBR,
  formatInteragentBirthOrAge,
  formatInteragentDisplayLabel,
  getHawkinsLevelInfo,
  isPetInteragent,
  resolveCrystalForChart,
} from './antiCatharsis';
import { formatRemedyDurationLabel } from './energeticRemedies';
import {
  DEFAULT_CLINIC_LOGO_URL,
  ProfessionalProfile,
  getAnsaeDraftForSession,
  getOrganPsychosomaticMeaning,
  getPreviousSessionForPatient,
  getProfessionalProfile,
  getSystemPsychosomaticMeaning,
  normalizeAnsaeSheet,
} from './storage';

const NAVY_HEX = '0F172A';
const AMBER_HEX = 'B45309';
const SLATE_TEXT_HEX = '334155';
const MUTED_HEX = '64748B';
const BORDER_HEX = 'CBD5E1';
const LIGHT_BG_HEX = 'FAF8F5';

function normalizeHex6(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const cleaned = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`.toUpperCase();
  }
  return fallback;
}

function hexToRgbTuple(
  color: string | undefined,
  fallback: [number, number, number]
): [number, number, number] {
  const hex = normalizeHex6(color, '');
  if (hex.length !== 6) return fallback;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return fallback;
  return [r, g, b];
}

function buildProfileContactLine(profile: ProfessionalProfile): string {
  return [
    profile.subtitleLine.trim(),
    profile.contacts.trim() ? `Contatos: ${profile.contacts.trim()}` : '',
    profile.emailOrSocial.trim(),
    (profile.website || '').trim(),
  ]
    .filter(Boolean)
    .join(' • ');
}

export interface DocumentExportContext {
  ansaeSheet?: ClinicalAnsaeRhenSheet;
  previousSession?: ClinicalSessionRecord | null;
  sessionType?: SessionMilestoneType;
  welcomeMessage?: string;
}

interface ActiveLogoAssets {
  bytes: Uint8Array;
  dataUrl: string;
  docxType: 'png' | 'jpg';
  pdfFormat: 'PNG' | 'JPEG';
  aspectRatio: number;
}

let cachedDefaultLogoPromise: Promise<ActiveLogoAssets | null> | null = null;

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function measureImageAspect(dataUrl: string): Promise<number> {
  if (typeof Image === 'undefined') return 1;
  return new Promise<number>((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img.naturalWidth / img.naturalHeight);
      } else {
        resolve(1);
      }
    };
    img.onerror = () => resolve(1);
    img.src = dataUrl;
  });
}

async function normalizeDataUrlToPng(dataUrl: string): Promise<{
  dataUrl: string;
  aspectRatio: number;
}> {
  const aspectRatio = await measureImageAspect(dataUrl);
  if (typeof document === 'undefined') {
    return { dataUrl, aspectRatio };
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 256;
      const h = img.naturalHeight || 256;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl, aspectRatio });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        aspectRatio: w / h,
      });
    };
    img.onerror = () => resolve({ dataUrl, aspectRatio });
    img.src = dataUrl;
  });
}

async function loadDefaultClinicLogo(): Promise<ActiveLogoAssets | null> {
  if (!cachedDefaultLogoPromise) {
    cachedDefaultLogoPromise = (async () => {
      try {
        const res = await fetch(DEFAULT_CLINIC_LOGO_URL);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:image/png;base64,${base64}`;
        const aspectRatio = await measureImageAspect(dataUrl);
        return {
          bytes,
          dataUrl,
          docxType: 'png',
          pdfFormat: 'PNG',
          aspectRatio,
        };
      } catch {
        return null;
      }
    })();
  }
  return cachedDefaultLogoPromise;
}

async function loadActiveProfileLogo(
  profile: ProfessionalProfile
): Promise<ActiveLogoAssets | null> {
  if (profile.logoDataUrl && profile.logoDataUrl.startsWith('data:image/')) {
    try {
      const isPng = profile.logoDataUrl.startsWith('data:image/png');
      const isJpeg =
        profile.logoDataUrl.startsWith('data:image/jpeg') ||
        profile.logoDataUrl.startsWith('data:image/jpg');

      if (isPng || isJpeg) {
        const bytes = dataUrlToUint8Array(profile.logoDataUrl);
        const aspectRatio = await measureImageAspect(profile.logoDataUrl);
        return {
          bytes,
          dataUrl: profile.logoDataUrl,
          docxType: isJpeg ? 'jpg' : 'png',
          pdfFormat: isJpeg ? 'JPEG' : 'PNG',
          aspectRatio,
        };
      }

      const normalized = await normalizeDataUrlToPng(profile.logoDataUrl);
      const bytes = dataUrlToUint8Array(normalized.dataUrl);
      return {
        bytes,
        dataUrl: normalized.dataUrl,
        docxType: 'png',
        pdfFormat: 'PNG',
        aspectRatio: normalized.aspectRatio,
      };
    } catch {
      return loadDefaultClinicLogo();
    }
  }
  return loadDefaultClinicLogo();
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

export const INTEGRATIVE_ETHICAL_DISCLAIMER =
  'Ressalva Ética Integrativa: A Radiestesia Terapêutica (ANSAE/RHEN), a Ressonância Harmônica e as práticas vibracionais descritas neste documento atuam estritamente como suporte integrativo complementar, não substituindo consultas, diagnósticos, exames ou tratamentos médicos e psicológicos convencionais. Registro tratado sob sigilo terapêutico conforme a LGPD.';

export const INTEGRATIVE_VETERINARY_ETHICAL_DISCLAIMER =
  'Ressalva Ética Veterinária Integrativa: A Radiestesia Terapêutica Veterinária (ANSAE/RHEN), a Ressonância Harmônica e as práticas vibracionais descritas neste documento atuam estritamente como suporte integrativo complementar para o bem-estar animal, não substituindo consultas, diagnósticos clínicos, exames laboratoriais, vacinas ou tratamentos prescritos pelo médico-veterinário. Registro tratado sob sigilo conforme a LGPD.';

export function getEthicalDisclaimerForAnamnesis(
  anamnesis: QuantumRoomSession['anamnesis']
): string {
  return isPetInteragent(anamnesis)
    ? INTEGRATIVE_VETERINARY_ETHICAL_DISCLAIMER
    : INTEGRATIVE_ETHICAL_DISCLAIMER;
}

function formatLgpdConsentLabel(lgpdConsent?: boolean, lgpdConsentDate?: string): string {
  if (!lgpdConsent) return 'Pendente de registro na Anamnese';
  if (lgpdConsentDate) {
    return `Ciência e consentimento LGPD registrados em ${formatDateTimeBR(lgpdConsentDate)}`;
  }
  return 'Ciência e consentimento LGPD registrados';
}

function buildDocxEthicalFooter(
  disclaimer: string = INTEGRATIVE_ETHICAL_DISCLAIMER
): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
        },
        spacing: { before: 80, after: 0 },
        children: [
          new TextRun({
            text: disclaimer,
            size: 15,
            italics: true,
            color: MUTED_HEX,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
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
  const sheet = normalizeAnsaeSheet(ctx?.ansaeSheet || getAnsaeDraftForSession(session));
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
  const isPet = isPetInteragent(session.anamnesis);
  const attentionChakras = sheet.chakras.filter((c) => c.status !== 'Normal');
  const chakrasSummary =
    attentionChakras.length > 0
      ? `Chakras em atenção (${attentionChakras
          .map((c) => `${c.name} — ligado à glândula ${c.gland}`)
          .join(', ')}): ${
          isPet
            ? 'mantenha um ambiente sereno e acolhedor no espaço de descanso do animal para favorecer o reequilíbrio desses centros.'
            : 'busque momentos de respiração calma levando atenção gentil a essas regiões.'
        }`
      : isPet
      ? 'Os centros energéticos do animal apresentam boa harmonia geral nesta leitura.'
      : 'Seus sete centros de força (chakras) apresentam boa harmonia geral nesta leitura.';

  const colorCorrelation = analyzeAuricColorsChakraCorrelation(
    sheet.auricField.missingColors,
    sheet.auricField.excessColors
  );

  const missingColorsText =
    colorCorrelation.missingMappings.length > 0
      ? `Cores que nutrem ${isPet ? 'o campo do pet' : 'seu campo'} e chakras neste ciclo: ${colorCorrelation.missingMappings.join(
          ', '
        )}. ${
          isPet
            ? 'Você pode utilizá-las em mantinhas, paninhos da caminha ou iluminação suave próxima ao local de descanso.'
            : 'Utilize-as em detalhes de vestuário, objetos do ambiente ou visualizações suaves ao inspirar.'
        }`
      : '';

  const excessColorsText =
    colorCorrelation.excessMappings.length > 0
      ? `Cores e centros em excesso que pedem desaceleração e limpeza: ${colorCorrelation.excessMappings.join(
          ', '
        )} (${colorCorrelation.summaryText}).`
      : '';

  const habits =
    session.aiResult?.prescricoes.bonsHabitos && session.aiResult.prescricoes.bonsHabitos.length > 0
      ? `Hábitos diários recomendados: ${session.aiResult.prescricoes.bonsHabitos.join(' • ')}.`
      : isPet
      ? 'Mantenha água fresca e limpa sempre disponível, caminha higienizada e rotina previsível com voz tranquila.'
      : 'Cultive pausas breves durante o dia, hidratação regular e silêncio antes de dormir.';

  return [chakrasSummary, missingColorsText, excessColorsText, habits].filter(Boolean).join('\n\n');
}

export function getDefaultWelcomeMessage(
  session: QuantumRoomSession,
  customVocative?: string
): string {
  const { anamnesis } = session;
  if (isPetInteragent(anamnesis)) {
    const tutorFirst =
      anamnesis.tutorName?.trim().split(/\s+/)[0] ||
      anamnesis.tutorName?.trim() ||
      'Tutor(a)';
    const petLabel = formatInteragentDisplayLabel(anamnesis);
    const vocative = customVocative || `Prezado(a) ${tutorFirst}:`;
    const behaviorNote = anamnesis.emotionalHistory?.trim()
      ? 'Acolhemos com atenção sensível os sinais comportamentais e emocionais observados na rotina do animal.'
      : 'Cada sinal de sensibilidade do seu companheiro merece cuidado calmo, presença amorosa e respeito ao ritmo dele.';
    const physicalNote = anamnesis.physicalSymptoms?.trim()
      ? 'Também consideramos cuidadosamente os sinais físicos relatados para estruturar um suporte vibracional suave e seguro.'
      : 'Nosso propósito é fortalecer a vitalidade, o conforto físico e a serenidade do pet em sintonia com o lar.';

    return [
      vocative,
      `Receba este guia de acompanhamento para o cuidado vibracional de ${petLabel}. ${behaviorNote} ${physicalNote} Esta leitura radiestésica complementar caminha sempre junto às orientações do médico-veterinário, oferecendo acolhimento energético para o pet e tranquilidade para toda a família.`,
    ].join('\n');
  }

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
  logo: ActiveLogoAssets | null,
  profile: ProfessionalProfile
): Paragraph[] {
  const primaryHex = normalizeHex6(profile.primaryColor, NAVY_HEX);
  const accentHex = normalizeHex6(profile.accentColor, AMBER_HEX);
  const paragraphs: Paragraph[] = [];

  if (logo) {
    const height = 68;
    const width = Math.min(160, Math.max(40, Math.round(height * logo.aspectRatio)));
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new ImageRun({
            data: logo.bytes,
            transformation: { width, height },
            type: logo.docxType,
          }),
        ],
      })
    );
  }

  const therapistChildren: TextRun[] = [
    new TextRun({
      text: profile.therapistName,
      bold: true,
      size: 20,
      color: primaryHex,
      font: 'Calibri',
    }),
  ];
  if (profile.credentials.trim()) {
    therapistChildren.push(
      new TextRun({
        text: ` | ${profile.credentials.trim()}`,
        size: 20,
        color: SLATE_TEXT_HEX,
        font: 'Calibri',
      })
    );
  }

  const contactLine = buildProfileContactLine(profile);

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: profile.clinicName.toUpperCase(),
          bold: true,
          size: 32,
          color: primaryHex,
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
          color: accentHex,
          font: 'Georgia',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: therapistChildren,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      border: {
        bottom: {
          color: accentHex,
          space: 8,
          style: BorderStyle.SINGLE,
          size: 16,
        },
      },
      children: [
        new TextRun({
          text: contactLine || profile.clinicName,
          size: 19,
          color: MUTED_HEX,
          font: 'Calibri',
        }),
      ],
    })
  );

  return paragraphs;
}

function buildSectionHeading(title: string, primaryHex = NAVY_HEX): Paragraph {
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
        color: primaryHex,
        font: 'Georgia',
      }),
    ],
  });
}

function buildBodyParagraph(
  text: string,
  boldPrefix?: string,
  primaryHex = NAVY_HEX
): Paragraph {
  const children: TextRun[] = [];
  if (boldPrefix) {
    children.push(
      new TextRun({
        text: boldPrefix,
        bold: true,
        size: 21,
        color: primaryHex,
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

function buildTableCell(
  text: string,
  bold = false,
  shaded = false,
  primaryHex = NAVY_HEX
): TableCell {
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
            color: bold ? primaryHex : SLATE_TEXT_HEX,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function buildDocxWelcomeCard(text: string, accentHex = AMBER_HEX): Table {
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
              left: { style: BorderStyle.SINGLE, size: 24, color: accentHex },
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
  const profile = getProfessionalProfile();
  const primaryHex = normalizeHex6(profile.primaryColor, NAVY_HEX);
  const accentHex = normalizeHex6(profile.accentColor, AMBER_HEX);
  const logo = await loadActiveProfileLogo(profile);
  const hawkinsHz =
    sheet.spiritualPsycho.hawkinsHz ??
    sheet.spiritualPsycho.hawkinsAgathaHz ??
    sensitivity.hawkins;
  const hawkinsInfo = getHawkinsLevelInfo(hawkinsHz);
  const isPet = isPetInteragent(anamnesis);
  const displayInteragent = formatInteragentDisplayLabel(anamnesis);
  const birthOrAge = formatInteragentBirthOrAge(anamnesis);
  const ethicalDisclaimer = getEthicalDisclaimerForAnamnesis(anamnesis);
  const imbalancedOrgans = sheet.organs.filter(
    (o) =>
      o.isImbalanced ||
      o.imbalancePercent > 0 ||
      typeof o.healthEnergyAngstroms === 'number'
  );
  const ansaeSystems = sheet.systems || [];
  const auraColorCorrelation = analyzeAuricColorsChakraCorrelation(
    sheet.auricField.missingColors,
    sheet.auricField.excessColors
  );

  const identificationTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell(isPet ? 'Interagente (PET)' : 'Paciente', true, true),
          buildTableCell(displayInteragent, false, false),
          buildTableCell(isPet ? 'Nasc. / Idade' : 'Nascimento', true, true),
          buildTableCell(birthOrAge, false, false),
        ],
      }),
      ...(isPet
        ? [
            new TableRow({
              children: [
                buildTableCell('Tutor Responsável', true, true),
                buildTableCell(anamnesis.tutorName || 'Não informado', false, false),
                buildTableCell('Ambiente Doméstico', true, true),
                buildTableCell(anamnesis.petEnvironment || 'Não informado', false, false),
              ],
            }),
          ]
        : []),
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
          buildTableCell(isPet ? 'Contato do Tutor' : 'Contato', true, true),
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
      new TableRow({
        children: [
          buildTableCell('Consentimento LGPD', true, true),
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
                    text: formatLgpdConsentLabel(
                      anamnesis.lgpdConsent,
                      anamnesis.lgpdConsentDate
                    ),
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
          buildTableCell(
            hawkinsHz !== hawkinsInfo.hz
              ? `${hawkinsHz} Hz → ${hawkinsInfo.fullLabel}`
              : hawkinsInfo.fullLabel
          ),
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
          buildTableCell(
            `Em falta: ${auraColorCorrelation.missingMappings.join(', ') || '—'}`
          ),
          buildTableCell(
            `Em excesso: ${auraColorCorrelation.excessMappings.join(', ') || '—'}`
          ),
        ],
      }),
      new TableRow({
        children: [
          buildTableCell('Leitura Cores × Chakras', true),
          buildTableCell('Cruzamento Automático'),
          buildTableCell(auraColorCorrelation.summaryText),
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

  // 15 Sistemas Orgânicos ANSAE Table
  const systemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          buildTableCell('Sigla', true, true),
          buildTableCell('Sistema Orgânico', true, true),
          buildTableCell('Energia de Saúde (Å)', true, true),
          buildTableCell('% de Desequilíbrio', true, true),
          buildTableCell('Significado Psicossomático', true, true),
        ],
      }),
      ...ansaeSystems.map(
        (s) =>
          new TableRow({
            children: [
              buildTableCell(s.systemCode, true),
              buildTableCell(s.systemName),
              buildTableCell(formatAngstromsBR(s.healthEnergyAngstroms)),
              buildTableCell(`${s.imbalancePercent}%`),
              buildTableCell(getSystemPsychosomaticMeaning(s.systemCode)),
            ],
          })
      ),
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
                buildTableCell('Órgão / Glândula', true, true),
                buildTableCell('Energia de Saúde (Å)', true, true),
                buildTableCell('% de Desequilíbrio', true, true),
                buildTableCell('Significado Psicossomático', true, true),
              ],
            }),
            ...imbalancedOrgans.map(
              (o) =>
                new TableRow({
                  children: [
                    buildTableCell(o.systemCode, true),
                    buildTableCell(`${o.organName} (${o.systemName})`),
                    buildTableCell(formatAngstromsBR(o.healthEnergyAngstroms)),
                    buildTableCell(
                      o.durationValue > 0
                        ? `${o.imbalancePercent}% (${o.durationValue}${o.durationUnit})`
                        : `${o.imbalancePercent}%`
                    ),
                    buildTableCell(getOrganPsychosomaticMeaning(o.id)),
                  ],
                })
            ),
          ],
        })
      : null;

  const formatGeometriesWithCrystals = (
    geometries: Array<{ name: string; role?: string; source?: 'motor' | 'therapist'; customFocus?: string }>,
    stageTag: string,
    withRole = false
  ) =>
    geometries
      .map((g) => {
        const cr = resolveCrystalForChart(session.chartCrystals, stageTag, g.name);
        const tags: string[] = [];
        if (g.source === 'therapist') tags.push('Pendulado pelo Terapeuta');
        if (cr) tags.push(`Cristal: ${cr}`);
        if (g.customFocus) tags.push(`Foco: ${g.customFocus}`);
        const label = tags.length > 0 ? `${g.name} (${tags.join(' · ')})` : g.name;
        return withRole && g.role ? `${label} — ${g.role}` : label;
      })
      .join(withRole ? ' | ' : ', ');

  // Chronogram Stage Paragraphs
  const stageParagraphs: Paragraph[] = [];
  if (protocol.mode === 'escalonado' && protocol.stage1 && protocol.stage2) {
    stageParagraphs.push(
      buildBodyParagraph(
        `Protocolo Escalonado em 2 Etapas ativado automaticamente. Motivos técnicos: ${protocol.riskReasons.join('; ')}.`,
        'Classificação Clínica: '
      ),
      buildBodyParagraph(
        `${protocol.stage1.durationLabel} — ${protocol.stage1.objective} Geometrias permitidas: ${formatGeometriesWithCrystals(
          protocol.stage1.geometries,
          'stage1'
        )}. Geometrias bloqueadas nesta fase: ${protocol.stage1.blockedGeometries.join('; ')}.`,
        `${protocol.stage1.title}: `
      ),
      buildBodyParagraph(
        'Pausa fisiológica obrigatória de 12 horas entre a conclusão da Etapa 1 e a ativação da Etapa 2 para sedimentação neural e energética.',
        'Intervalo de Repouso: '
      ),
      buildBodyParagraph(
        `${protocol.stage2.durationLabel} — ${protocol.stage2.objective} Geometrias aplicadas: ${formatGeometriesWithCrystals(
          protocol.stage2.geometries,
          'stage2'
        )}.`,
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
        formatGeometriesWithCrystals(protocol.singleStage.geometries, 'single', true),
        'Geometrias Aplicadas: '
      )
    );
  }

  const hasTherapistChartsDocx = [
    ...(protocol.stage1?.geometries || []),
    ...(protocol.stage2?.geometries || []),
    ...(protocol.singleStage?.geometries || []),
  ].some((g) => g.source === 'therapist');

  const effectiveResult =
    (session.chartCrystals && Object.keys(session.chartCrystals).length > 0) ||
    hasTherapistChartsDocx
      ? applyChartCrystalsToResult(
          aiResult,
          protocol,
          anamnesis,
          session.sensitivity,
          session.chartCrystals || {}
        )
      : aiResult;

  const testimonyCommandTables: Table[] = (effectiveResult?.testemunhos || []).map((t, idx) => {
    const c = (effectiveResult?.comandosQuanticos || []).find(
      (cmd) => cmd.geometria === t.geometria && cmd.etapa === t.etapa
    ) || (effectiveResult?.comandosQuanticos || [])[idx];

    const cr =
      t.cristalAncorado ||
      c?.cristalAncorado ||
      resolveCrystalForChart(session.chartCrystals, t.etapa, t.geometria);
    const isTherapist = t.origem === 'therapist' || c?.origem === 'therapist';

    const cellChildren: any[] = [
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `${t.geometria} — ${t.etapa}`,
            bold: true,
            size: 22,
            color: primaryHex,
            font: 'Georgia',
          }),
          ...(isTherapist
            ? [
                new TextRun({
                  text: ' [Pendulado pelo Terapeuta]',
                  bold: true,
                  size: 18,
                  color: accentHex,
                }),
              ]
            : []),
          ...(cr
            ? [
                new TextRun({
                  text: ` | Cristal Ancorado: ${cr}`,
                  bold: true,
                  size: 18,
                  color: accentHex,
                }),
              ]
            : []),
        ],
      }),
      new Paragraph({
        spacing: { before: 40, after: 20 },
        children: [
          new TextRun({
            text: 'TESTEMUNHO INFORMACIONAL:',
            bold: true,
            size: 18,
            color: MUTED_HEX,
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 80, line: 276 },
        shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
        children: [
          new TextRun({
            text: t.testemunhoFormatado,
            size: 20,
            color: primaryHex,
            font: 'Courier New',
          }),
        ],
      }),
    ];

    if (c) {
      cellChildren.push(
        new Paragraph({
          spacing: { before: 60, after: 20 },
          children: [
            new TextRun({
              text: `COMANDO DE ATIVAÇÃO: ${c.tituloComando}`,
              bold: true,
              size: 20,
              color: accentHex,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 40, line: 276 },
          children: [
            new TextRun({
              text: `"${c.comandoTexto}"`,
              italics: true,
              size: 21,
              color: '1E293B',
              font: 'Georgia',
            }),
          ],
        })
      );
    }

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { fill: LIGHT_BG_HEX, type: ShadingType.CLEAR },
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
              children: cellChildren,
            }),
          ],
        }),
      ],
    });
  });

  const energeticRemediesList = session.energeticRemedies || [];
  const energeticRemedyParagraphs: Paragraph[] = [];
  if (energeticRemediesList.length > 0) {
    energeticRemediesList.forEach((rem) => {
      energeticRemedyParagraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({
              text: `${rem.items.join(' + ')} (${rem.category} • Emissor: ${
                rem.emitterGraph
              } • ${formatRemedyDurationLabel(rem.durationHours)} • ${
                rem.isActive ? 'Ativo' : 'Pausado'
              })`,
              bold: true,
              size: 21,
              color: primaryHex,
              font: 'Calibri',
            }),
          ],
        }),
        buildBodyParagraph(rem.dosageInstruction, 'Posologia Sutil: ', primaryHex),
        buildBodyParagraph(rem.testimonyText, 'Testemunho Informacional: ', primaryHex),
        new Paragraph({
          spacing: { after: 120, line: 276 },
          children: [
            new TextRun({
              text: `"${rem.activationCommand}"`,
              italics: true,
              size: 21,
              color: accentHex,
              font: 'Georgia',
            }),
          ],
        })
      );
    });
  } else {
    energeticRemedyParagraphs.push(
      buildBodyParagraph(
        'Nenhum medicamento energético ativado na Estação Radionics para este atendimento.'
      )
    );
  }

  const prescricaoParagraphs: Paragraph[] = [];
  if (effectiveResult?.prescricoes) {
    prescricaoParagraphs.push(
      buildBodyParagraph(
        effectiveResult.prescricoes.floraisBach.join(' • '),
        'Florais de Bach Recomendados: '
      )
    );
    if (effectiveResult.prescricoes.cristais && effectiveResult.prescricoes.cristais.length > 0) {
      prescricaoParagraphs.push(
        buildBodyParagraph(
          effectiveResult.prescricoes.cristais.join(' • '),
          'Cristais Terapêuticos: '
        )
      );
    }
    prescricaoParagraphs.push(
      buildBodyParagraph(
        effectiveResult.prescricoes.fitoterapiaChas.join(' • '),
        'Fitoterapia e Infusões: '
      )
    );
    if (effectiveResult.prescricoes.bonsHabitos && effectiveResult.prescricoes.bonsHabitos.length > 0) {
      prescricaoParagraphs.push(
        buildBodyParagraph(
          effectiveResult.prescricoes.bonsHabitos.join(' • '),
          'Bons Hábitos Aferidos: '
        )
      );
    }
    prescricaoParagraphs.push(
      buildBodyParagraph(
        effectiveResult.prescricoes.frequenciasSolfeggio
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
    const prevHawkinsLabel = getHawkinsLevelInfo(
      prev.ansaeRhen.spiritualPsycho.hawkinsAgathaHz
    ).fullLabel;
    comparisonParagraphs.push(
      buildBodyParagraph(
        `Bovis: ${prev.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å → ${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å (${bovisDelta >= 0 ? `+${bovisDelta}` : bovisDelta} Å) | Hawkins: ${prevHawkinsLabel} → ${hawkinsInfo.fullLabel} (${hawkinsDelta >= 0 ? `+${hawkinsDelta}` : hawkinsDelta} Hz) | Proteção Áurica: ${prev.ansaeRhen.auricField.protectionPercent}% → ${sheet.auricField.protectionPercent}% (${auraDelta >= 0 ? `+${auraDelta}` : auraDelta}%).`,
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
            logo,
            profile
          ),
          buildSectionHeading('1. Quadro de Identificação e Anamnese', primaryHex),
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

          buildSectionHeading('2. Campos Eletromagnéticos (Corpos Sutis)', primaryHex),
          emTable,

          buildSectionHeading('3. Sete Chakras & Glândulas Correspondentes', primaryHex),
          chakraTable,

          buildSectionHeading('4. Campo Áurico, Cromoterapia & Dimensão Espiritual', primaryHex),
          bioAuraTable,
          new Paragraph({ spacing: { before: 120, after: 60 } }),
          lifeAreasTable,

          buildSectionHeading('5. Sistemas Orgânicos e Órgãos/Glândulas (ANSAE)', primaryHex),
          buildBodyParagraph('Aferição dos 15 Sistemas Orgânicos:', ''),
          systemsTable,
          new Paragraph({ spacing: { before: 140, after: 60 } }),
          buildBodyParagraph('Detalhamento de Órgãos e Glândulas (ANSAE):', ''),
          ...(organsTable
            ? [organsTable]
            : [
                buildBodyParagraph(
                  'Nenhum dos 38 órgãos ANSAE foi sinalizado em desequilíbrio ou aferido individualmente.'
                ),
              ]),

          buildSectionHeading('6. Biômetros Virtuais Consultados', primaryHex),
          ...(sheet.biometerReadings.length > 0
            ? sheet.biometerReadings.map((b) =>
                buildBodyParagraph(b.selectedItem, `${b.biometerName}: `)
              )
            : [buildBodyParagraph('Nenhuma leitura extra registrada nos 22 biômetros virtuais.')]),

          ...(comparisonParagraphs.length > 0
            ? [
                buildSectionHeading('7. Comparativo Evolutivo (Antes × Depois)', primaryHex),
                ...comparisonParagraphs,
              ]
            : []),

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '8. Análise da Causa Raiz & Diagnóstico Psicossomático'
              : '7. Análise da Causa Raiz & Diagnóstico Psicossomático',
            primaryHex
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
              : '8. Cronograma Anti-Catarse em Etapas',
            primaryHex
          ),
          ...stageParagraphs,

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '10. Painel de Testemunhos e Comandos Quânticos'
              : '9. Painel de Testemunhos e Comandos Quânticos',
            primaryHex
          ),
          ...(testimonyCommandTables.length > 0
            ? testimonyCommandTables
            : [buildBodyParagraph('Nenhum testemunho ou comando gerado até o momento.')]),

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '11. Painel de Envio de Medicamentos Energéticos (Radionics via Decágono Duplo / SCAP)'
              : '10. Painel de Envio de Medicamentos Energéticos (Radionics via Decágono Duplo / SCAP)',
            primaryHex
          ),
          ...energeticRemedyParagraphs,

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '12. Prescrições Integrativas & Hábitos'
              : '11. Prescrições Integrativas & Hábitos',
            primaryHex
          ),
          ...(prescricaoParagraphs.length > 0
            ? prescricaoParagraphs
            : [buildBodyParagraph('Sem prescrições registradas.')]),

          buildSectionHeading(
            comparisonParagraphs.length > 0
              ? '13. Ressalva Ética Integrativa e Responsabilidade Terapêutica'
              : '12. Ressalva Ética Integrativa e Responsabilidade Terapêutica',
            primaryHex
          ),
          buildBodyParagraph(ethicalDisclaimer),
        ],
        footers: {
          default: buildDocxEthicalFooter(ethicalDisclaimer),
        },
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `relatorio_tecnico_${sanitizeFileName(anamnesis.fullName || 'atendimento')}.docx`);
}

// ---------- DOC 2: PATIENT ORIENTATION GUIDE (.DOCX) ----------

export async function downloadPatientGuideDocx(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): Promise<void> {
  const { anamnesis, aiResult, protocol } = session;
  const { sheet, prev } = resolveDocContext(session, ctx);
  const profile = getProfessionalProfile();
  const primaryHex = normalizeHex6(profile.primaryColor, NAVY_HEX);
  const accentHex = normalizeHex6(profile.accentColor, AMBER_HEX);
  const logo = await loadActiveProfileLogo(profile);
  const isPet = isPetInteragent(anamnesis);
  const displayInteragent = formatInteragentDisplayLabel(anamnesis);
  const tutorDisplay = anamnesis.tutorName?.trim() || 'Tutor(a) Responsável';
  const ethicalDisclaimer = getEthicalDisclaimerForAnamnesis(anamnesis);
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
        footers: {
          default: buildDocxEthicalFooter(ethicalDisclaimer),
        },
        children: [
          ...buildDocxOfficialHeader(
            isPet
              ? 'Guia de Orientação Veterinária Integrativa ao Tutor'
              : 'Guia de Orientação e Conscientização Vibracional',
            logo,
            profile
          ),
          new Paragraph({
            spacing: { before: 120, after: 140 },
            children: [
              new TextRun({
                text: isPet
                  ? `Preparado para o(a) tutor(a) ${tutorDisplay} • Cuidado de ${displayInteragent}`
                  : `Preparado especialmente para ${anamnesis.fullName}`,
                bold: true,
                size: 24,
                color: primaryHex,
                font: 'Georgia',
              }),
            ],
          }),
          buildBodyParagraph(
            `Foco do Acompanhamento: ${anamnesis.therapeuticFocus} • Ciclo previsto: ${
              protocol.mode === 'escalonado'
                ? 'Cuidado em 2 etapas suaves (Limpeza e depois Vitalização)'
                : 'Harmonização Integrativa Direta (7 a 10 dias)'
            }.${
              anamnesis.lgpdConsent
                ? ` • ${formatLgpdConsentLabel(
                    anamnesis.lgpdConsent,
                    anamnesis.lgpdConsentDate
                  )}.`
                : ''
            }`
          ),

          buildDocxWelcomeCard(welcomeText, accentHex),

          buildSectionHeading(
            isPet ? 'Compreendendo o Momento Energético do Pet' : 'Compreendendo seu Momento Energético',
            primaryHex
          ),
          buildBodyParagraph(
            aiResult?.orientacaoPacienteResumo ||
              (isPet
                ? `O campo energético de ${displayInteragent} passou por uma leitura cuidadosa para identificar pontos de sobrecarga emocional, ambiental ou física e fortalecer sua vitalidade natural com suavidade.`
                : 'Seu campo energético passou por uma avaliação cuidadosa para identificar onde há acúmulo de cansaço emocional e onde precisamos fortalecer sua vitalidade. Nosso objetivo é restaurar seu equilíbrio natural com suavidade, respeitando o tempo do seu corpo e das suas emoções.')
          ),

          ...(prev || aiResult?.comparativoEvolutivo
            ? [
                buildSectionHeading(
                  isPet ? 'Evolução do Pet Neste Ciclo' : 'Sua Evolução Neste Ciclo',
                  primaryHex
                ),
                buildBodyParagraph(
                  aiResult?.comparativoEvolutivo ||
                    `A vitalidade aferida avançou de ${prev?.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å para ${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å e a proteção áurica alcançou ${sheet.auricField.protectionPercent}%.`
                ),
              ]
            : []),

          buildSectionHeading('Chakras, Cores da Aura & Hábitos na Prática', primaryHex),
          ...chakrasAuraGuide
            .split('\n\n')
            .filter(Boolean)
            .map((p) => buildBodyParagraph(p)),

          buildSectionHeading(
            isPet
              ? 'A Sintonia entre Tutor, Ambiente e Saúde Animal'
              : 'A Relação entre Mente, Emoção e Corpo',
            primaryHex
          ),
          buildBodyParagraph(
            isPet
              ? 'Os animais são profundamente sensíveis ao campo emocional do lar e aos hábitos da família. Quando unimos harmonização vibracional, acolhimento calmo do tutor, higiene energética do espaço de descanso e acompanhamento veterinário regular, o organismo do pet encontra segurança para se recuperar com mais leveza.'
              : 'Pensamentos recorrentes, preocupações prolongadas e emoções guardadas funcionam como sinais que influenciam diretamente o ritmo do nosso sistema nervoso, do sono, da digestão e da imunidade. Quando organizamos o campo vibracional e cultivamos hábitos tranquilos no dia a dia, o organismo encontra espaço para se autorregular com mais leveza.'
          ),

          buildSectionHeading(
            isPet ? 'Os 4 Pilares Diários de Cuidado com o Pet' : 'Os 4 Pilares Diários de Autocuidado',
            primaryHex
          ),
          buildBodyParagraph(
            pilares?.hidratacaoFitoterapia ||
              (isPet
                ? 'Disponibilizar água fresca e limpa no bebedouro ao longo de todo o dia; quando indicados, utilizar florais de Bach manipulados exclusivamente sem álcool (base água pura ou glicerina).'
                : 'Beba água pura em pequenos goles ao longo do dia (ao menos 2 litros) e utilize os chás suaves recomendados para auxiliar a limpeza e a calma interna.'),
            isPet ? '1. Água Fresca & Florais sem Álcool: ' : '1. Hidratação e Fitoterapia: ',
            primaryHex
          ),
          buildBodyParagraph(
            pilares?.higieneMentalOracao ||
              (isPet
                ? 'Manter rotina tranquila, manejo gentil e voz serena junto ao animal, evitando tensões ou agitação excessiva no convívio diário.'
                : 'Reserve 10 minutos diários de silêncio, respiração profunda ou oração, escolhendo pensamentos de serenidade e evitando excesso de notícias ou telas antes de dormir.'),
            isPet ? '2. Rotina Calma & Acolhimento do Tutor: ' : '2. Higiene Mental e Oração: ',
            primaryHex
          ),
          buildBodyParagraph(
            pilares?.ambiente ||
              (isPet
                ? 'Higienizar com frequência a caminha, os cobertores, os brinquedos e o local de descanso do pet, mantendo boa ventilação e tranquilidade.'
                : 'Mantenha seu quarto arejado, organizado e com luz suave ao entardecer. Um ambiente limpo e silencioso sustenta a harmonia conquistada na sessão.'),
            isPet ? '3. Higiene do Leito, Caminha & Lar: ' : '3. Harmonia do Ambiente: ',
            primaryHex
          ),
          buildBodyParagraph(
            pilares?.acompanhamentoMedico ||
              (isPet
                ? 'Mantenha rigorosamente todas as consultas, exames, vacinas e medicações prescritas pelo médico-veterinário responsável.'
                : 'Continue seguindo todas as orientações, exames e medicamentos indicados pelo seu médico de confiança. A terapia vibracional caminha sempre de mãos dadas com o cuidado médico convencional.'),
            isPet ? '4. Acompanhamento Médico-Veterinário: ' : '4. Acompanhamento Médico Convencional: ',
            primaryHex
          ),

          ...(aiResult?.prescricoes
            ? [
                buildSectionHeading('Apoios Naturais, Cristais e Frequências', primaryHex),
                buildBodyParagraph(
                  aiResult.prescricoes.floraisBach.join(' • '),
                  isPet ? 'Florais de Bach sugeridos (sem álcool): ' : 'Florais de Bach sugeridos: ',
                  primaryHex
                ),
                ...(aiResult.prescricoes.cristais && aiResult.prescricoes.cristais.length > 0
                  ? [
                      buildBodyParagraph(
                        aiResult.prescricoes.cristais.join(' • '),
                        'Cristais de apoio: ',
                        primaryHex
                      ),
                    ]
                  : []),
                buildBodyParagraph(
                  aiResult.prescricoes.fitoterapiaChas.join(' • '),
                  isPet ? 'Apoios Naturais / Hidratação: ' : 'Chás e Infusões acolhedoras: ',
                  primaryHex
                ),
                ...(aiResult.prescricoes.bonsHabitos &&
                aiResult.prescricoes.bonsHabitos.length > 0
                  ? [
                      buildBodyParagraph(
                        aiResult.prescricoes.bonsHabitos.join(' • '),
                        'Hábitos práticos recomendados: ',
                        primaryHex
                      ),
                    ]
                  : []),
                buildBodyParagraph(
                  aiResult.prescricoes.frequenciasSolfeggio
                    .map((f) => `${f.nome} — ${f.indicacao}`)
                    .join(' | '),
                  'Músicas / Frequências Solfeggio para ouvir em repouso: ',
                  primaryHex
                ),
              ]
            : []),

          ...(session.energeticRemedies &&
          session.energeticRemedies.some((r) => r.isActive)
            ? [
                buildSectionHeading('Remédios Sutis em Emissão Vibracional à Distância', primaryHex),
                buildBodyParagraph(
                  isPet
                    ? `Para apoiar a recuperação e o conforto energético de ${displayInteragent} ao longo deste ciclo, estamos enviando vibracionalmente à distância os seguintes remédios sutis:`
                    : 'Para apoiar sua recuperação e conforto energético ao longo deste ciclo, estamos enviando vibracionalmente à distância os seguintes remédios sutis:'
                ),
                ...session.energeticRemedies
                  .filter((r) => r.isActive)
                  .map((r) =>
                    buildBodyParagraph(
                      `${r.category} · ${formatRemedyDurationLabel(r.durationHours)} — ${
                        r.dosageInstruction
                      }`,
                      `• ${r.items.join(' + ')}: `,
                      primaryHex
                    )
                  ),
                buildBodyParagraph(
                  isPet
                    ? 'Este apoio vibracional atua exclusivamente em nível sutil e integrativo. Nunca suspenda nem altere medicações prescritas pelo médico-veterinário.'
                    : 'Este apoio vibracional atua exclusivamente em nível sutil e integrativo. Nunca suspenda nem altere medicações prescritas pelo seu médico.',
                  'Aviso Ético Importante: ',
                  primaryHex
                ),
              ]
            : []),

          buildSectionHeading('Mensagem de Acompanhamento', primaryHex),
          buildBodyParagraph(
            isPet
              ? 'Qualquer mudança no comportamento, apetite, sono ou dúvida durante os próximos dias pode ser compartilhada pelo WhatsApp de atendimento. Caminhamos juntos pelo bem-estar do seu pet, sempre em respeito ao acompanhamento médico-veterinário.'
              : 'Qualquer percepção, sonho significativo ou dúvida durante os próximos dias pode ser compartilhada diretamente pelo WhatsApp de atendimento. Caminhamos juntos com serenidade, ética e respeito ao seu ritmo.'
          ),
          buildSectionHeading(
            isPet ? 'Ressalva Ética Veterinária Integrativa' : 'Ressalva Ética Integrativa',
            primaryHex
          ),
          buildBodyParagraph(ethicalDisclaimer),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(
    blob,
    `${isPet ? 'guia_tutor_pet' : 'guia_paciente'}_${sanitizeFileName(
      anamnesis.fullName || 'atendimento'
    )}.docx`
  );
}

// ---------- PDF ENGINE (jsPDF) ----------

class MaestroPdfBuilder {
  private doc: jsPDF;
  private y: number = 18;
  private pageWidth: number;
  private margin: number = 18;
  private contentWidth: number;
  private profile: ProfessionalProfile;
  private primaryRgb: [number, number, number];
  private accentRgb: [number, number, number];

  constructor(profile: ProfessionalProfile) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.contentWidth = this.pageWidth - this.margin * 2;
    this.profile = profile;
    this.primaryRgb = hexToRgbTuple(profile.primaryColor, [15, 23, 42]);
    this.accentRgb = hexToRgbTuple(profile.accentColor, [180, 83, 9]);
  }

  private ensureSpace(neededMm: number): void {
    const pageHeight = this.doc.internal.pageSize.getHeight();
    if (this.y + neededMm > pageHeight - 22) {
      this.doc.addPage();
      this.y = 18;
    }
  }

  public addOfficialHeader(subtitle: string, logo: ActiveLogoAssets | null = null): void {
    const center = this.pageWidth / 2;

    if (logo) {
      const logoHeight = 24;
      const logoWidth = Math.min(58, Math.max(16, logoHeight * logo.aspectRatio));
      this.doc.addImage(
        logo.dataUrl,
        logo.pdfFormat,
        center - logoWidth / 2,
        this.y - 4,
        logoWidth,
        logoHeight
      );
      this.y += logoHeight + 1;
    }

    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(15);
    this.doc.setTextColor(...this.primaryRgb);
    this.doc.text(this.profile.clinicName.toUpperCase(), center, this.y, { align: 'center' });
    this.y += 6.5;

    this.doc.setFont('times', 'italic');
    this.doc.setFontSize(11.5);
    this.doc.setTextColor(...this.accentRgb);
    this.doc.text(subtitle, center, this.y, { align: 'center' });
    this.y += 6;

    const therapistLine = this.profile.credentials.trim()
      ? `${this.profile.therapistName} | ${this.profile.credentials.trim()}`
      : this.profile.therapistName;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...this.primaryRgb);
    const therapistLines: string[] = this.doc.splitTextToSize(therapistLine, this.contentWidth);
    therapistLines.forEach((line) => {
      this.doc.text(line, center, this.y, { align: 'center' });
      this.y += 4.5;
    });

    const contactLine = buildProfileContactLine(this.profile);
    if (contactLine) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      this.doc.setTextColor(100, 116, 139);
      this.doc.text(contactLine, center, this.y, { align: 'center', maxWidth: this.contentWidth });
      this.y += 4;
    } else {
      this.y += 1.5;
    }

    this.doc.setDrawColor(...this.accentRgb);
    this.doc.setLineWidth(0.7);
    this.doc.line(this.margin, this.y, this.pageWidth - this.margin, this.y);
    this.y += 8;
  }

  public addSectionTitle(title: string): void {
    this.ensureSpace(14);
    this.y += 2;
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(12);
    this.doc.setTextColor(...this.primaryRgb);
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
        this.doc.setTextColor(...this.primaryRgb);
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
      this.doc.setTextColor(...this.primaryRgb);
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

    this.doc.setFillColor(241, 245, 249);
    this.doc.rect(this.margin, this.y, this.contentWidth, cardHeight, 'F');
    this.doc.setFillColor(...this.accentRgb);
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

  public addTestimonyCommandCard(
    geometria: string,
    etapa: string,
    isTherapist: boolean,
    crystal: string | undefined,
    testemunho: string,
    commandTitle: string,
    commandText: string
  ): void {
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(10.5);
    const titleLines = this.doc.splitTextToSize(`${geometria} — ${etapa}`, this.contentWidth - 12) as string[];
    const testLines = this.doc.splitTextToSize(testemunho, this.contentWidth - 16) as string[];
    const cmdLines = this.doc.splitTextToSize(`"${commandText}"`, this.contentWidth - 16) as string[];

    const cardHeight =
      titleLines.length * 4.5 +
      (crystal || isTherapist ? 5 : 0) +
      6 +
      testLines.length * 4.2 +
      8 +
      cmdLines.length * 4.5 +
      16;

    this.ensureSpace(cardHeight + 6);

    this.doc.setFillColor(250, 248, 245);
    this.doc.setDrawColor(203, 213, 225);
    this.doc.setLineWidth(0.3);
    this.doc.rect(this.margin, this.y, this.contentWidth, cardHeight, 'FD');
    this.doc.setFillColor(...this.accentRgb);
    this.doc.rect(this.margin, this.y, 1.8, cardHeight, 'F');

    let currentY = this.y + 6;
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(...this.primaryRgb);
    titleLines.forEach((l) => {
      this.doc.text(l, this.margin + 5, currentY);
      currentY += 4.5;
    });

    if (isTherapist || crystal) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8);
      let metaStr = '';
      if (isTherapist) metaStr += 'Pendulado pelo Terapeuta';
      if (crystal) metaStr += (metaStr ? ' | ' : '') + `Cristal Ancorado: ${crystal}`;
      this.doc.setTextColor(...this.accentRgb);
      this.doc.text(metaStr, this.margin + 5, currentY);
      currentY += 5;
    }

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text('TESTEMUNHO INFORMACIONAL:', this.margin + 5, currentY);
    currentY += 4.5;

    this.doc.setFont('courier', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...this.primaryRgb);
    testLines.forEach((l) => {
      this.doc.text(l, this.margin + 7, currentY);
      currentY += 4.2;
    });
    currentY += 4;

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.accentRgb);
    this.doc.text(`COMANDO DE ATIVAÇÃO: ${commandTitle}`, this.margin + 5, currentY);
    currentY += 4.5;

    this.doc.setFont('times', 'italic');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(30, 41, 59);
    cmdLines.forEach((l) => {
      this.doc.text(l, this.margin + 7, currentY);
      currentY += 4.5;
    });

    this.y += cardHeight + 6;
  }

  public addMultiColumnTable(
    headers: string[],
    colWidths: number[],
    rows: string[][]
  ): void {
    const drawHeaderRow = () => {
      const headerHeight = 8;
      this.ensureSpace(headerHeight + 6);
      let x = this.margin;
      headers.forEach((h, i) => {
        const w = colWidths[i];
        this.doc.setFillColor(250, 248, 245);
        this.doc.setDrawColor(203, 213, 225);
        this.doc.setLineWidth(0.25);
        this.doc.rect(x, this.y, w, headerHeight, 'FD');
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(8);
        this.doc.setTextColor(...this.primaryRgb);
        this.doc.text(h, x + 2, this.y + 5.2, { maxWidth: w - 3.5 });
        x += w;
      });
      this.y += headerHeight;
    };

    drawHeaderRow();

    rows.forEach((row) => {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      const cellLines = row.map((val, i) =>
        this.doc.splitTextToSize(val || '—', colWidths[i] - 3.5) as string[]
      );
      const maxLines = Math.max(...cellLines.map((l) => l.length), 1);
      const rowHeight = Math.max(7, maxLines * 3.9 + 2.6);

      const pageHeight = this.doc.internal.pageSize.getHeight();
      if (this.y + rowHeight > pageHeight - 22) {
        this.doc.addPage();
        this.y = 18;
        drawHeaderRow();
      }

      let x = this.margin;
      row.forEach((_val, i) => {
        const w = colWidths[i];
        this.doc.setDrawColor(203, 213, 225);
        this.doc.setLineWidth(0.25);
        this.doc.rect(x, this.y, w, rowHeight, 'D');

        this.doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        this.doc.setFontSize(8);
        if (i === 0) {
          this.doc.setTextColor(...this.accentRgb);
        } else {
          this.doc.setTextColor(51, 65, 85);
        }
        cellLines[i].forEach((line, lineIdx) => {
          this.doc.text(line, x + 1.8, this.y + 4.3 + lineIdx * 3.9);
        });
        x += w;
      });

      this.y += rowHeight;
    });

    this.y += 4;
  }

  private applyEthicalFooterToAllPages(
    disclaimer: string = INTEGRATIVE_ETHICAL_DISCLAIMER
  ): void {
    const totalPages = this.doc.getNumberOfPages();
    const pageHeight = this.doc.internal.pageSize.getHeight();

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setDrawColor(226, 232, 240);
      this.doc.setLineWidth(0.3);
      this.doc.line(this.margin, pageHeight - 17, this.pageWidth - this.margin, pageHeight - 17);

      this.doc.setFont('helvetica', 'italic');
      this.doc.setFontSize(6.8);
      this.doc.setTextColor(100, 116, 139);
      const footerLines: string[] = this.doc.splitTextToSize(
        disclaimer,
        this.contentWidth - 18
      );
      footerLines.slice(0, 3).forEach((line, idx) => {
        this.doc.text(line, this.margin, pageHeight - 13.5 + idx * 3.1);
      });

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7);
      this.doc.text(
        `Pág. ${i}/${totalPages}`,
        this.pageWidth - this.margin,
        pageHeight - 13.5,
        { align: 'right' }
      );
    }
  }

  public save(
    filename: string,
    disclaimer: string = INTEGRATIVE_ETHICAL_DISCLAIMER
  ): void {
    this.applyEthicalFooterToAllPages(disclaimer);
    this.doc.save(filename);
  }
}

export async function downloadTherapistPdf(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): Promise<void> {
  const { anamnesis, sensitivity, protocol, aiResult } = session;
  const { sheet, prev, sessionType } = resolveDocContext(session, ctx);
  const profile = getProfessionalProfile();
  const logo = await loadActiveProfileLogo(profile);
  const hawkinsHz =
    sheet.spiritualPsycho.hawkinsHz ??
    sheet.spiritualPsycho.hawkinsAgathaHz ??
    sensitivity.hawkins;
  const hawkinsInfo = getHawkinsLevelInfo(hawkinsHz);
  const isPet = isPetInteragent(anamnesis);
  const displayInteragent = formatInteragentDisplayLabel(anamnesis);
  const birthOrAge = formatInteragentBirthOrAge(anamnesis);
  const ethicalDisclaimer = getEthicalDisclaimerForAnamnesis(anamnesis);
  const ansaeSystems = sheet.systems || [];
  const auraColorCorrelation = analyzeAuricColorsChakraCorrelation(
    sheet.auricField.missingColors,
    sheet.auricField.excessColors
  );
  const imbalancedOrgans = sheet.organs.filter(
    (o) =>
      o.isImbalanced ||
      o.imbalancePercent > 0 ||
      typeof o.healthEnergyAngstroms === 'number'
  );

  const pdf = new MaestroPdfBuilder(profile);
  pdf.addOfficialHeader(
    isPet
      ? 'Relatório Técnico Veterinário Integrativo — ANSAE + RHEN & Protocolo Vibracional'
      : 'Relatório Técnico Completo — ANSAE + RHEN & Protocolo Vibracional',
    logo
  );

  pdf.addSectionTitle('1. Quadro de Identificação e Anamnese');
  pdf.addKeyValueTable([
    [isPet ? 'Interagente (PET)' : 'Paciente', displayInteragent],
    ...(isPet
      ? ([
          ['Tutor Responsável', anamnesis.tutorName || 'Não informado'],
          ['Ambiente Doméstico', anamnesis.petEnvironment || 'Não informado'],
        ] as Array<[string, string]>)
      : []),
    ['Tipo de Sessão', sessionType],
    [isPet ? 'Nasc. / Idade' : 'Data de Nascimento', birthOrAge],
    [isPet ? 'Contato do Tutor' : 'Contato', anamnesis.phone || 'Não informado'],
    ['Data do Registro', formatDateTimeBR(session.activatedAt)],
    ['Foco Terapêutico', anamnesis.therapeuticFocus],
    [
      'Consentimento LGPD',
      formatLgpdConsentLabel(anamnesis.lgpdConsent, anamnesis.lgpdConsentDate),
    ],
    ['Pergunta Raiz', sheet.rootProblems.join(', ') || 'Avaliação Geral'],
    [
      isPet ? 'Comportamento / Rotina' : 'Histórico Emocional',
      anamnesis.emotionalHistory || 'Sem observações adicionais',
    ],
    ['Sintomas Físicos', anamnesis.physicalSymptoms || 'Sem sintomas registrados'],
    [
      isPet ? 'Acompanhamento Veterinário' : 'Tratamento Médico',
      anamnesis.medicalTreatments || 'Não informado',
    ],
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
      `${hawkinsHz !== hawkinsInfo.hz ? `${hawkinsHz} Hz → ` : ''}${hawkinsInfo.fullLabel} (${hawkinsInfo.zone})`,
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
      `Em falta: ${auraColorCorrelation.missingMappings.join(', ') || '—'} | Em excesso: ${
        auraColorCorrelation.excessMappings.join(', ') || '—'
      }`,
    ],
    [
      'Leitura Cores × Chakras',
      auraColorCorrelation.summaryText,
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

  pdf.addSectionTitle('4. Sistemas Orgânicos e Órgãos/Glândulas (ANSAE) & Biômetros');
  pdf.addMultiColumnTable(
    [
      'Sigla',
      'Sistema Orgânico',
      'Energia de Saúde (Å)',
      '% Deseq.',
      'Significado Psicossomático',
    ],
    [14, 42, 28, 18, 72],
    ansaeSystems.map((s) => [
      s.systemCode,
      s.systemName,
      formatAngstromsBR(s.healthEnergyAngstroms),
      `${s.imbalancePercent}%`,
      getSystemPsychosomaticMeaning(s.systemCode),
    ])
  );

  if (imbalancedOrgans.length > 0) {
    pdf.addMultiColumnTable(
      [
        'Sigla',
        'Órgão / Glândula',
        'Energia de Saúde (Å)',
        '% Deseq.',
        'Significado Psicossomático',
      ],
      [14, 42, 28, 22, 68],
      imbalancedOrgans.map((o) => [
        o.systemCode,
        `${o.organName} (${o.systemName})`,
        formatAngstromsBR(o.healthEnergyAngstroms),
        o.durationValue > 0
          ? `${o.imbalancePercent}% (${o.durationValue}${o.durationUnit})`
          : `${o.imbalancePercent}%`,
        getOrganPsychosomaticMeaning(o.id),
      ])
    );
  } else {
    pdf.addParagraph(
      'Nenhum dos 38 órgãos ANSAE sinalizado em desequilíbrio ou aferido individualmente.'
    );
  }

  if (sheet.biometerReadings.length > 0) {
    pdf.addKeyValueTable(
      sheet.biometerReadings.map((b) => [b.biometerName, b.selectedItem])
    );
  }

  if (prev || aiResult?.comparativoEvolutivo) {
    pdf.addSectionTitle('5. Comparativo Evolutivo (Antes × Depois)');
    if (prev) {
      const prevHawkinsLabel = getHawkinsLevelInfo(
        prev.ansaeRhen.spiritualPsycho.hawkinsAgathaHz
      ).fullLabel;
      pdf.addParagraph(
        `Bovis: ${prev.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å → ${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å | Hawkins: ${prevHawkinsLabel} → ${hawkinsInfo.fullLabel} | Proteção Áurica: ${prev.ansaeRhen.auricField.protectionPercent}% → ${sheet.auricField.protectionPercent}%.`,
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

  const formatPdfGeometries = (
    geometries: Array<{ name: string; source?: 'motor' | 'therapist'; customFocus?: string }>,
    stageTag: string
  ) =>
    geometries
      .map((g) => {
        const cr = resolveCrystalForChart(session.chartCrystals, stageTag, g.name);
        const tags: string[] = [];
        if (g.source === 'therapist') tags.push('Pendulado pelo Terapeuta');
        if (cr) tags.push(`Cristal: ${cr}`);
        if (g.customFocus) tags.push(`Foco: ${g.customFocus}`);
        return tags.length > 0 ? `${g.name} (${tags.join(' · ')})` : g.name;
      })
      .join(', ');

  pdf.addSectionTitle('7. Cronograma Anti-Catarse em Etapas');
  if (protocol.mode === 'escalonado' && protocol.stage1 && protocol.stage2) {
    pdf.addParagraph(
      `Motivos técnicos: ${protocol.riskReasons.join('; ')}.`,
      'Modo Escalonado em 2 Etapas Ativado: '
    );
    pdf.addParagraph(
      `${protocol.stage1.durationLabel} — ${protocol.stage1.objective} Geometrias: ${formatPdfGeometries(
        protocol.stage1.geometries,
        'stage1'
      )}. Bloqueadas: ${protocol.stage1.blockedGeometries.join('; ')}.`,
      `${protocol.stage1.title}: `
    );
    pdf.addParagraph(
      'Pausa obrigatória de 12 horas entre as etapas.',
      'Intervalo de Repouso: '
    );
    pdf.addParagraph(
      `${protocol.stage2.durationLabel} — ${protocol.stage2.objective} Geometrias: ${formatPdfGeometries(
        protocol.stage2.geometries,
        'stage2'
      )}.`,
      `${protocol.stage2.title}: `
    );
  } else if (protocol.singleStage) {
    pdf.addParagraph(
      `${protocol.singleStage.durationLabel} — ${protocol.singleStage.objective} Geometrias: ${formatPdfGeometries(
        protocol.singleStage.geometries,
        'single'
      )}.`,
      'Protocolo Direto em Etapa Única: '
    );
  }

  const hasTherapistChartsPdf = [
    ...(protocol.stage1?.geometries || []),
    ...(protocol.stage2?.geometries || []),
    ...(protocol.singleStage?.geometries || []),
  ].some((g) => g.source === 'therapist');

  const effectivePdfResult =
    (session.chartCrystals && Object.keys(session.chartCrystals).length > 0) ||
    hasTherapistChartsPdf
      ? applyChartCrystalsToResult(
          aiResult,
          protocol,
          anamnesis,
          session.sensitivity,
          session.chartCrystals || {}
        )
      : aiResult;

  pdf.addSectionTitle('8. Testemunhos e Comandos Quânticos');
  const pdfTestemunhos = effectivePdfResult?.testemunhos || [];
  const pdfComandos = effectivePdfResult?.comandosQuanticos || [];

  if (pdfTestemunhos.length > 0) {
    pdfTestemunhos.forEach((t, idx) => {
      const c = pdfComandos.find(
        (cmd) => cmd.geometria === t.geometria && cmd.etapa === t.etapa
      ) || pdfComandos[idx];

      const cr =
        t.cristalAncorado ||
        c?.cristalAncorado ||
        resolveCrystalForChart(session.chartCrystals, t.etapa, t.geometria);
      const isTherapist = t.origem === 'therapist' || c?.origem === 'therapist';

      pdf.addTestimonyCommandCard(
        t.geometria,
        t.etapa,
        isTherapist,
        cr,
        t.testemunhoFormatado,
        c?.tituloComando || 'Ativação Quântica',
        c?.comandoTexto || ''
      );
    });
  } else {
    pdf.addParagraph('Nenhum testemunho ou comando gerado até o momento.');
  }

  pdf.addSectionTitle(
    '9. Painel de Envio de Medicamentos Energéticos (Radionics via Decágono Duplo / SCAP)'
  );
  if ((session.energeticRemedies || []).length > 0) {
    (session.energeticRemedies || []).forEach((rem) => {
      pdf.addParagraph(
        `${rem.category} • Emissor: ${rem.emitterGraph} • Duração: ${formatRemedyDurationLabel(
          rem.durationHours
        )} • Status: ${rem.isActive ? 'Ativo' : 'Pausado'} — ${rem.dosageInstruction}`,
        `${rem.items.join(' + ')}: `
      );
      pdf.addParagraph(rem.testimonyText, 'Testemunho Informacional: ');
      pdf.addParagraph(`"${rem.activationCommand}"`, 'Comando de Ativação: ', true);
    });
  } else {
    pdf.addParagraph(
      'Nenhum medicamento energético ativado na Estação Radionics para este atendimento.'
    );
  }

  if (effectivePdfResult?.prescricoes) {
    pdf.addSectionTitle('10. Prescrições Integrativas, Cristais & Bons Hábitos');
    pdf.addParagraph(effectivePdfResult.prescricoes.floraisBach.join(' • '), 'Florais de Bach: ');
    if (
      effectivePdfResult.prescricoes.cristais &&
      effectivePdfResult.prescricoes.cristais.length > 0
    ) {
      pdf.addParagraph(
        effectivePdfResult.prescricoes.cristais.join(' • '),
        'Cristais Terapêuticos: '
      );
    }
    pdf.addParagraph(
      effectivePdfResult.prescricoes.fitoterapiaChas.join(' • '),
      'Fitoterapia / Chás: '
    );
    if (
      effectivePdfResult.prescricoes.bonsHabitos &&
      effectivePdfResult.prescricoes.bonsHabitos.length > 0
    ) {
      pdf.addParagraph(
        effectivePdfResult.prescricoes.bonsHabitos.join(' • '),
        'Bons Hábitos: '
      );
    }
    pdf.addParagraph(
      effectivePdfResult.prescricoes.frequenciasSolfeggio
        .map((f) => `${f.nome} (${f.indicacao})`)
        .join(' | '),
      'Frequências Solfeggio: '
    );
  }

  pdf.addSectionTitle(
    isPet ? '11. Ressalva Ética Veterinária Integrativa' : '11. Ressalva Ética Integrativa'
  );
  pdf.addParagraph(ethicalDisclaimer);

  pdf.save(
    `relatorio_tecnico_${sanitizeFileName(anamnesis.fullName || 'atendimento')}.pdf`,
    ethicalDisclaimer
  );
}

export async function downloadPatientGuidePdf(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): Promise<void> {
  const { anamnesis, aiResult, protocol } = session;
  const { sheet, prev } = resolveDocContext(session, ctx);
  const profile = getProfessionalProfile();
  const logo = await loadActiveProfileLogo(profile);
  const isPet = isPetInteragent(anamnesis);
  const displayInteragent = formatInteragentDisplayLabel(anamnesis);
  const tutorDisplay = anamnesis.tutorName?.trim() || 'Tutor(a) Responsável';
  const ethicalDisclaimer = getEthicalDisclaimerForAnamnesis(anamnesis);
  const pilares = aiResult?.prescricoes.pilaresAutocuidado;
  const chakrasAuraGuide =
    aiResult?.orientacaoChakrasAuraHabitos || buildFallbackChakraAuraHabitsText(session, sheet);
  const welcomeText =
    ctx?.welcomeMessage?.trim() ||
    aiResult?.welcomeMessage?.trim() ||
    getDefaultWelcomeMessage(session);

  const pdf = new MaestroPdfBuilder(profile);
  pdf.addOfficialHeader(
    isPet
      ? 'Guia de Orientação Veterinária Integrativa ao Tutor'
      : 'Guia de Orientação e Conscientização Vibracional',
    logo
  );

  pdf.addParagraph(
    isPet
      ? `${tutorDisplay} • Pet: ${displayInteragent} • Foco: ${anamnesis.therapeuticFocus}`
      : `${anamnesis.fullName} • Foco: ${anamnesis.therapeuticFocus}`,
    isPet ? 'Tutor & Pet: ' : 'Paciente: '
  );
  if (anamnesis.lgpdConsent) {
    pdf.addParagraph(
      formatLgpdConsentLabel(anamnesis.lgpdConsent, anamnesis.lgpdConsentDate),
      'Consentimento LGPD: '
    );
  }
  pdf.addParagraph(
    protocol.mode === 'escalonado'
      ? 'Protocolo suave em 2 etapas (Limpeza/Blindagem inicial de 48h–72h, pausa de 12h e Vitalização de 7–10 dias).'
      : 'Protocolo direto de harmonização e vitalidade (7 a 10 dias).',
    'Jornada de Cuidado: '
  );

  pdf.addWelcomeCard(welcomeText);

  pdf.addSectionTitle(
    isPet ? 'Momento Energético Atual do Pet' : 'Seu Momento Energético Atual'
  );
  pdf.addParagraph(
    aiResult?.orientacaoPacienteResumo ||
      (isPet
        ? `Realizamos uma leitura cuidadosa do campo energético de ${displayInteragent} para acolher sinais de sobrecarga e fortalecer sua vitalidade natural com suavidade.`
        : 'Realizamos uma leitura cuidadosa do seu campo energético para acolher sinais de cansaço e organizar sua vitalidade com suavidade.')
  );

  if (prev || aiResult?.comparativoEvolutivo) {
    pdf.addSectionTitle(isPet ? 'Evolução do Pet Neste Ciclo' : 'Sua Evolução Neste Ciclo');
    pdf.addParagraph(
      aiResult?.comparativoEvolutivo ||
        `A vitalidade aferida avançou de ${prev?.ansaeRhen.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å para ${sheet.spiritualPsycho.bovis.toLocaleString('pt-BR')} Å e a proteção áurica alcançou ${sheet.auricField.protectionPercent}%.`
    );
  }

  pdf.addSectionTitle('Chakras, Cores da Aura & Hábitos na Prática');
  chakrasAuraGuide
    .split('\n\n')
    .filter(Boolean)
    .forEach((p) => pdf.addParagraph(p));

  pdf.addSectionTitle(
    isPet
      ? 'A Sintonia entre Tutor, Ambiente e Saúde Animal'
      : 'A Conexão entre Mente, Emoção e Corpo'
  );
  pdf.addParagraph(
    isPet
      ? 'Os animais percebem com sensibilidade a energia do lar e o estado emocional do tutor. Ao associar harmonização vibracional, rotina serena, higiene do cantinho de descanso e acompanhamento veterinário, favorecemos a recuperação e o bem-estar do pet.'
      : 'Nossos pensamentos, sentimentos e rotina diária dialogam continuamente com o corpo físico. Ao cuidar da serenidade emocional e harmonizar seu campo sutil, você favorece o sono reparador, a disposição e o bem-estar integral.'
  );

  pdf.addSectionTitle(
    isPet ? 'Os 4 Pilares Diários de Cuidado com o Pet' : 'Os 4 Pilares Diários de Autocuidado'
  );
  pdf.addParagraph(
    pilares?.hidratacaoFitoterapia ||
      (isPet
        ? 'Mantenha água fresca e limpa no bebedouro; quando indicados, utilize florais de Bach manipulados sem álcool (base água pura ou glicerina).'
        : 'Ingira água pura ao longo do dia e utilize os chás suaves recomendados.'),
    isPet ? '1. Água Fresca & Florais sem Álcool: ' : '1. Hidratação e Fitoterapia: '
  );
  pdf.addParagraph(
    pilares?.higieneMentalOracao ||
      (isPet
        ? 'Mantenha rotina calma, voz serena e manejo gentil próximo ao animal.'
        : 'Reserve momentos de silêncio, respiração profunda ou oração antes de dormir.'),
    isPet ? '2. Rotina Calma & Acolhimento do Tutor: ' : '2. Higiene Mental e Oração: '
  );
  pdf.addParagraph(
    pilares?.ambiente ||
      (isPet
        ? 'Higienize regularmente a caminha, cobertores e espaço de descanso do animal.'
        : 'Mantenha o quarto ventilado, limpo e com iluminação acolhedora ao anoitecer.'),
    isPet ? '3. Higiene do Leito, Caminha & Lar: ' : '3. Ambiente: '
  );
  pdf.addParagraph(
    pilares?.acompanhamentoMedico ||
      (isPet
        ? 'Mantenha sempre consultas, exames, vacinas e prescrições do médico-veterinário.'
        : 'Mantenha sempre suas consultas, exames e orientações médicas convencionais.'),
    isPet ? '4. Acompanhamento Médico-Veterinário: ' : '4. Acompanhamento Médico Convencional: '
  );

  if (aiResult?.prescricoes) {
    pdf.addSectionTitle('Apoios Naturais, Cristais e Frequências');
    pdf.addParagraph(
      aiResult.prescricoes.floraisBach.join(' • '),
      isPet ? 'Florais de Bach (sem álcool): ' : 'Florais de Bach: '
    );
    if (aiResult.prescricoes.cristais && aiResult.prescricoes.cristais.length > 0) {
      pdf.addParagraph(aiResult.prescricoes.cristais.join(' • '), 'Cristais Terapêuticos: ');
    }
    pdf.addParagraph(
      aiResult.prescricoes.fitoterapiaChas.join(' • '),
      isPet ? 'Apoios Naturais / Hidratação: ' : 'Chás e Infusões: '
    );
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

  const activePatientRemediesPdf = (session.energeticRemedies || []).filter((r) => r.isActive);
  if (activePatientRemediesPdf.length > 0) {
    pdf.addSectionTitle('Remédios Sutis em Emissão Vibracional à Distância');
    pdf.addParagraph(
      isPet
        ? `Para apoiar a recuperação de ${displayInteragent} com suavidade, os seguintes remédios sutis estão sendo enviados vibracionalmente à distância para o campo do animal:`
        : 'Para apoiar sua recuperação com suavidade, os seguintes remédios sutis estão sendo enviados vibracionalmente à distância para o seu campo:'
    );
    activePatientRemediesPdf.forEach((rem) => {
      pdf.addParagraph(
        `${rem.category} · ${formatRemedyDurationLabel(rem.durationHours)} — ${
          rem.dosageInstruction
        }`,
        `• ${rem.items.join(' + ')}: `
      );
    });
    pdf.addParagraph(
      isPet
        ? 'Este suporte energético é estritamente complementar e nunca substitui nem autoriza suspender medicações prescritas pelo médico-veterinário.'
        : 'Este suporte energético é estritamente complementar e nunca substitui nem autoriza suspender medicações prescritas pelo seu médico.',
      'Aviso Ético Importante: '
    );
  }

  pdf.addSectionTitle(
    isPet ? 'Ressalva Ética Veterinária Integrativa' : 'Ressalva Ética Integrativa'
  );
  pdf.addParagraph(ethicalDisclaimer);

  pdf.save(
    `${isPet ? 'guia_tutor_pet' : 'guia_paciente'}_${sanitizeFileName(
      anamnesis.fullName || 'atendimento'
    )}.pdf`,
    ethicalDisclaimer
  );
}

export function buildWhatsAppShareUrl(
  session: QuantumRoomSession,
  ctx?: DocumentExportContext
): string {
  const { anamnesis, aiResult, protocol } = session;
  const { sheet } = resolveDocContext(session, ctx);
  const profile = getProfessionalProfile();
  const isPet = isPetInteragent(anamnesis);
  const displayInteragent = formatInteragentDisplayLabel(anamnesis);
  const tutorGreeting = anamnesis.tutorName?.trim() || 'Tutor(a)';
  const pilares = aiResult?.prescricoes.pilaresAutocuidado;
  const freqs =
    aiResult?.prescricoes.frequenciasSolfeggio.map((f) => `${f.hz} Hz`).join(', ') || '432 Hz';
  const missingColors = sheet.auricField.missingColors.join(', ');
  const activeRemedies = (session.energeticRemedies || []).filter((r) => r.isActive);
  const remediesSummary =
    activeRemedies.length > 0
      ? activeRemedies
          .map(
            (r) =>
              `${r.items.join(' + ')} (${r.category}, ${formatRemedyDurationLabel(
                r.durationHours
              )})`
          )
          .join('; ')
      : '';
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

  const therapistSummary = profile.credentials.trim()
    ? `${profile.therapistName} • ${profile.credentials.trim()}`
    : profile.therapistName;
  const contactSummary = [
    profile.contacts.trim(),
    profile.emailOrSocial.trim(),
    (profile.website || '').trim(),
  ]
    .filter(Boolean)
    .join(' | ');

  const text = [
    `*${profile.clinicName.toUpperCase()}*`,
    isPet
      ? `_Guia de Orientação Veterinária Integrativa ao Tutor_`
      : `_Guia de Orientação e Conscientização Vibracional_`,
    ``,
    isPet ? `Olá, *${tutorGreeting}*!` : `Olá, *${anamnesis.fullName}*!`,
    isPet ? `*Interagente PET:* ${displayInteragent}` : '',
    welcomeSynthesis ? `_${welcomeSynthesis}_` : '',
    isPet
      ? `Segue o resumo do atendimento vibracional complementar do seu pet:`
      : `Segue o resumo do seu atendimento integrativo:`,
    ``,
    `*Foco:* ${anamnesis.therapeuticFocus}`,
    `*Etapa:* ${
      protocol.mode === 'escalonado'
        ? 'Protocolo Suave em 2 Etapas (Limpeza & Blindagem -> Pausa 12h -> Vitalização)'
        : 'Harmonização Direta (7 a 10 dias)'
    }`,
    missingColors
      ? `*Cores da Aura para nutrir ${isPet ? 'o campo do pet' : 'seu campo'}:* ${missingColors}`
      : '',
    remediesSummary
      ? `*Remédios Sutis em apoio vibracional à distância:* ${remediesSummary} _(apoio complementar — nunca suspenda medicações prescritas pelo ${
          isPet ? 'médico-veterinário' : 'seu médico'
        })_`
      : '',
    ``,
    isPet ? `*4 Pilares Diários de Cuidado com o Pet:*` : `*4 Pilares Diários:*`,
    isPet
      ? `1. Água Fresca & Florais sem Álcool: ${
          pilares?.hidratacaoFitoterapia ||
          'Manter água limpa e fresca no bebedouro; florais físicos sempre manipulados sem álcool.'
        }`
      : `1. Hidratação/Chás: ${
          pilares?.hidratacaoFitoterapia || 'Beber 2L de água pura e chás suaves.'
        }`,
    isPet
      ? `2. Rotina Calma & Acolhimento: ${
          pilares?.higieneMentalOracao ||
          'Manter voz serena, manejo gentil e tranquilidade emocional no lar.'
        }`
      : `2. Higiene Mental/Oração: ${
          pilares?.higieneMentalOracao || '10 min de respiração calma e oração diária.'
        }`,
    isPet
      ? `3. Higiene do Leito & Caminha: ${
          pilares?.ambiente ||
          'Higienizar caminha, cobertores e o espaço de descanso do animal.'
        }`
      : `3. Ambiente: ${
          pilares?.ambiente || 'Manter o quarto arejado e livre de excesso de telas à noite.'
        }`,
    isPet
      ? `4. Acompanhamento Veterinário: ${
          pilares?.acompanhamentoMedico ||
          'Manter normalmente consultas, exames, vacinas e prescrições do médico-veterinário.'
        }`
      : `4. Acompanhamento Médico: ${
          pilares?.acompanhamentoMedico || 'Manter normalmente seus cuidados médicos convencionais.'
        }`,
    ``,
    `*Frequência Solfeggio indicada:* ${freqs}`,
    ``,
    `_${therapistSummary}_`,
    contactSummary ? `_${contactSummary}_` : '',
    isPet
      ? `_Ressalva Ética Veterinária: Apoio vibracional integrativo complementar; não substitui consulta, diagnóstico ou tratamento do médico-veterinário (LGPD)._`
      : `_Ressalva Ética: Apoio vibracional integrativo complementar; não substitui diagnóstico ou tratamento médico/psicológico (LGPD)._`,
  ]
    .filter((line) => line !== undefined && line !== '')
    .join('\n');

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
