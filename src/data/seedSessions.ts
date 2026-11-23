import { QuantumRoomSession } from '../types/quantum';
import {
  DEFAULT_CHAKRAS,
  DEFAULT_ORGANIC_SYSTEMS,
  evaluateAntiCatharsis,
} from '../utils/antiCatharsis';

const STORAGE_KEY = 'maestro_quantico_rooms_v1';

function hoursAgoISO(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

export function createSeedSessions(): QuantumRoomSession[] {
  // Caso 1: Rossana Valenzuela Bejarano (Etapa 1: Desobstrução & Blindagem — 48h/72h concluídas)
  const rossanaAnamnesis = {
    id: 'patient-rossana',
    fullName: 'Rossana Valenzuela Bejarano',
    birthDate: '1978-05-14',
    phone: '(11) 98742-3109',
    therapeuticFocus: 'Restauração da Vitalidade, Blindagem Emocional e Equilíbrio Neuroendócrino',
    emotionalHistory:
      'Relata esgotamento por sobrecarga familiar e profissional nos últimos 6 meses, sensação de absorver tensões do ambiente, insônia intermitente e aperto no plexo solar.',
    physicalSymptoms:
      'Fadiga matinal persistente, tensão cervical, digestão lenta após situações de estresse e queda da imunidade recorrente.',
    medicalTreatments:
      'Acompanhamento clínico endocrinológico regular e reposição de vitamina D3 prescrita por médico.',
    clinicalNotes:
      'Paciente altamente empática com permeabilidade áurica reduzida. Priorizar assepsia antes de estímulo vital.',
  };

  const rossanaSensitivity = {
    bovis: 5400,
    hawkins: 175,
    auricProtection: 42,
    stressLevel: 4,
    subtleInterferences: 2,
    interferenceTypes: [
      'Miasmas & Impregnações Densas',
      'Formas-Pensamento Autogeradas',
    ],
    chakras: DEFAULT_CHAKRAS.map((c) => {
      if (c.id === 'plexo') return { ...c, percentage: 35, status: 'Bloqueado' as const };
      if (c.id === 'cardiaco') return { ...c, percentage: 48, status: 'Hipo-ativo' as const };
      if (c.id === 'basico') return { ...c, percentage: 45, status: 'Hipo-ativo' as const };
      return c;
    }),
    organicSystems: DEFAULT_ORGANIC_SYSTEMS.map((s) => {
      if (s.id === 'nervoso') return { ...s, status: 'Em Alerta' as const, note: 'Hiperatividade simpática noturna' };
      if (s.id === 'endocrino') return { ...s, status: 'Em Alerta' as const, note: 'Oscilação de cortisol basal' };
      if (s.id === 'digestivo') return { ...s, status: 'Em Alerta' as const, note: 'Retenção emocional gástrica' };
      return s;
    }),
    clientPerceptionScore: 4,
    clientPerceptionMoment: 'antes' as const,
    clientPerceptionNote: 'Fadiga matinal e sensação de peso no plexo solar antes do ciclo.',
  };

  const rossanaProtocol = evaluateAntiCatharsis(rossanaAnamnesis, rossanaSensitivity);
  const rossanaActivatedAt = hoursAgoISO(48.25); // 48h 15m elapsed -> triggers transition window alert

  // Caso 2: José Marcos Amaral Ferreira Filho (Etapa 2: Regeneração Celular & Alta Vitalidade — Dia 4 de 10)
  const joseAnamnesis = {
    id: 'patient-jose-marcos',
    fullName: 'José Marcos Amaral Ferreira Filho',
    birthDate: '1983-11-22',
    phone: '(68) 99918-4420',
    therapeuticFocus: 'Regeneração Celular, Alta Vitalidade e Expansão de Prosperidade Profissional',
    emotionalHistory:
      'Após concluir a etapa inicial de desobstrução e repouso de 12h, relata leveza mental significativa, maior clareza nas decisões e redução acentuada da ansiedade.',
    physicalSymptoms:
      'Recuperação gradual do vigor físico; leve desconforto lombar residual em fase de estabilização.',
    medicalTreatments:
      'Check-up cardiológico anual em dia, prática de fisioterapia postural preventiva.',
    clinicalNotes:
      'Campo estabilizado após Etapa 1. Atualmente em Etapa 2 com Turbilhão com Prosperador ativo para projetos profissionais.',
  };

  const joseSensitivity = {
    bovis: 7800,
    hawkins: 350,
    auricProtection: 78,
    stressLevel: 2,
    subtleInterferences: 0,
    interferenceTypes: [],
    chakras: DEFAULT_CHAKRAS.map((c) => ({ ...c, percentage: Math.min(92, c.percentage + 14), status: 'Equilibrado' as const })),
    organicSystems: DEFAULT_ORGANIC_SYSTEMS.map((s) => {
      if (s.id === 'osteomuscular') return { ...s, status: 'Em Alerta' as const, note: 'Tensão lombar em regressão' };
      return s;
    }),
    clientPerceptionScore: 8,
    clientPerceptionMoment: 'pos' as const,
    clientPerceptionNote: 'Sono restaurado e maior clareza mental após a Etapa 1.',
  };

  // For José Marcos, we keep the 2-stage history (he transitioned from Stage 1 into Stage 2, Day 4 of 10)
  const joseProtocol = evaluateAntiCatharsis(joseAnamnesis, {
    ...joseSensitivity,
    bovis: 6100, // Originally triggered 2-stage before Stage 1 lifted him to 7800
    auricProtection: 46,
  });
  // Ensure Turbilhão com Prosperador is in Stage 2
  const joseStage2ActivatedAt = hoursAgoISO(78); // 3 days + 6h = Dia 4 de 10

  return [
    {
      id: 'room-rossana',
      anamnesis: rossanaAnamnesis,
      sensitivity: rossanaSensitivity,
      protocol: rossanaProtocol,
      phase: 'stage1',
      isAnchored: true,
      activatedAt: rossanaActivatedAt,
      stage1StartedAt: rossanaActivatedAt,
      selectedSolfeggioHz: 432,
      updatedAt: rossanaActivatedAt,
      aiResult: {
        generatedAt: rossanaActivatedAt,
        testemunhos: [
          {
            geometria: 'Decágono Duplo',
            etapa: 'Etapa 1 — Limpeza & Blindagem',
            testemunhoFormatado:
              'Rossana Valenzuela Bejarano - 14/05/1978 | Potencialização de Assepsia Energética e Restauração da Vitalidade',
          },
          {
            geometria: 'SCAP Cabalístico',
            etapa: 'Etapa 1 — Limpeza & Blindagem',
            testemunhoFormatado:
              'Rossana Valenzuela Bejarano - 14/05/1978 | Neutralização de Miasmas, Cargas Densas e Desequilíbrios Eletromagnéticos',
          },
          {
            geometria: 'Yoshua',
            etapa: 'Etapa 1 — Limpeza & Blindagem',
            testemunhoFormatado:
              'Rossana Valenzuela Bejarano - 14/05/1978 | Desimpregnação de Formas-Pensamento e Pacificação do Plexo Solar',
          },
          {
            geometria: 'Pirâmide de Tao / Escudo Mágico',
            etapa: 'Etapa 1 — Limpeza & Blindagem',
            testemunhoFormatado:
              'Rossana Valenzuela Bejarano - 14/05/1978 | Blindagem Áurica Integrada e Estabilização Neuroendócrina',
          },
        ],
        comandosQuanticos: [
          {
            geometria: 'Decágono Duplo & SCAP Cabalístico',
            etapa: 'Etapa 1 — 48h a 72h',
            tituloComando: 'Comando de Assepsia Sutil e Colapso de Coerência',
            comandoTexto:
              'Eu colapso neste instante a função de onda da mais pura assepsia informacional no campo de Rossana Valenzuela Bejarano através do Campo de Ponto Zero. Em não-localidade absoluta, transfiro informação arquetípica pura para dissolver miasmas, impressões densas e sobrecargas eletromagnéticas, transmutando padrões de tensão e orgulho defensivo na Escala de Hawkins rumo à serenidade e segurança biológica. Está ativado, colapsado e manifestado na ordem cósmica.',
          },
          {
            geometria: 'Yoshua & Pirâmide de Tao / Escudo Mágico',
            etapa: 'Etapa 1 — 48h a 72h',
            tituloComando: 'Comando de Blindagem Áurica e Contenção Anti-Catarse',
            comandoTexto:
              'Eu ancoro no aqui e agora a frequência de proteção soberana e discernimento vibracional para Rossana Valenzuela Bejarano, selando sua malha áurica com suavidade clínica. Pela Ressonância Harmônica, desfaço cordões de drenagem emocional no plexo solar e acalmo o eixo neuroendócrino sem gerar catarse, elevando seu padrão bioenergético em paz e integridade. Está ativado, colapsado e manifestado na ordem cósmica.',
          },
        ],
        analisePsicossomatica:
          'A leitura bioenergética de 5.400 Å associada à proteção áurica reduzida (42%) e ao bloqueio do Plexo Solar (35%) evidencia um padrão de hiperpermeabilidade emocional: a paciente absorve demandas externas sem filtro adequado, mantendo o sistema nervoso autônomo em estado simpático prolongado (alerta 4/5). Psicossomaticamente, a retenção no eixo digestivo e a oscilação endócrina refletem dificuldade em estabelecer fronteiras energéticas saudáveis sem recorrer à rigidez defensiva (175 na Escala de Hawkins). O protocolo escalonado protege o organismo de uma crise de eliminação brusca ao priorizar 48h–72h de desimpregnação suave.',
        orientacaoPacienteResumo:
          'Neste primeiro ciclo de 48 a 72 horas, o trabalho vibracional está focado em limpar o excesso de cansaço energético acumulado e fortalecer suas fronteiras de proteção natural, como organizar e arejar uma casa antes de redecorá-la. Quando assumimos preocupações que não são nossas, o corpo responde com tensão no estômago, nos ombros e no sono. Este cuidado respeita o seu ritmo para que você sinta alívio gradual, clareza e descanso verdadeiro.',
        prescricoes: {
          floraisBach: [
            'Walnut (proteção contra influências externas e transições)',
            'White Chestnut (silenciamento de pensamentos circulares noturnos)',
            'Olive (restauração profunda da exaustão física e mental)',
          ],
          fitoterapiaChas: [
            'Infusão de Melissa (Erva-Cidreira) com Camomila antes do repouso noturno',
            'Chá de Espinheira-Santa morno após o almoço para conforto gástrico',
          ],
          frequenciasSolfeggio: [
            {
              hz: 432,
              nome: '432 Hz — Coerência Natural',
              indicacao: 'Desaceleração do sistema nervoso autônomo e aterramento áurico',
            },
            {
              hz: 741,
              nome: '741 Hz — Limpeza & Expressão',
              indicacao: 'Desimpregnação sutil e dissolução de cargas emocionais densas',
            },
          ],
          pilaresAutocuidado: {
            hidratacaoFitoterapia:
              'Ingerir ao menos 2 litros de água pura ao longo do dia para favorecer a condução bioelétrica, intercalando com a infusão de Melissa à noite.',
            higieneMentalOracao:
              'Reservar 10 minutos antes de dormir para respiração lenta (4-6 segundos), silêncio contemplativo ou oração de entrega, evitando telas 45 minutos antes do sono.',
            ambiente:
              'Manter o quarto ventilado, com iluminação amena ao entardecer, realizando limpeza simples do espaço de descanso e evitando acúmulo de eletrônicos próximos à cabeceira.',
            acompanhamentoMedico:
              'Manter rigorosamente as consultas médicas, exames laboratoriais e a suplementação de vitamina D3 prescritas pelo seu médico assistente. A terapia vibracional atua de forma integrativa e complementar.',
          },
        },
      },
    },
    {
      id: 'room-jose-marcos',
      anamnesis: joseAnamnesis,
      sensitivity: joseSensitivity,
      protocol: joseProtocol,
      phase: 'stage2',
      isAnchored: true,
      activatedAt: joseStage2ActivatedAt,
      stage1StartedAt: hoursAgoISO(162),
      restStartedAt: hoursAgoISO(90),
      stage2StartedAt: joseStage2ActivatedAt,
      selectedSolfeggioHz: 528,
      updatedAt: joseStage2ActivatedAt,
      aiResult: {
        generatedAt: joseStage2ActivatedAt,
        testemunhos: [
          {
            geometria: 'Alta Vitalidade',
            etapa: 'Etapa 2 — Regeneração & Vitalidade',
            testemunhoFormatado:
              'José Marcos Amaral Ferreira Filho - 22/11/1983 | Regeneração Celular e Sustentação Bioenergética em 9.000+ Å',
          },
          {
            geometria: 'Programador Físico',
            etapa: 'Etapa 2 — Regeneração & Vitalidade',
            testemunhoFormatado:
              'José Marcos Amaral Ferreira Filho - 22/11/1983 | Reorganização Estrutural Osteomuscular e Homeostase Física',
          },
          {
            geometria: "Mesa D'Amiens",
            etapa: 'Etapa 2 — Regeneração & Vitalidade',
            testemunhoFormatado:
              'José Marcos Amaral Ferreira Filho - 22/11/1983 | Irradiação em Proporção Áurea para Clareza e Coerência Cardíaca',
          },
          {
            geometria: 'Harmonia',
            etapa: 'Etapa 2 — Regeneração & Vitalidade',
            testemunhoFormatado:
              'José Marcos Amaral Ferreira Filho - 22/11/1983 | Integração Plena dos Sete Chakras em Frequência de Aceitação e Expansão',
          },
          {
            geometria: 'Turbilhão com Prosperador',
            etapa: 'Etapa 2 — Regeneração & Vitalidade',
            testemunhoFormatado:
              'José Marcos Amaral Ferreira Filho - 22/11/1983 | Expansão de Prosperidade Profissional e Realização Material Harmônica',
          },
        ],
        comandosQuanticos: [
          {
            geometria: "Alta Vitalidade, Programador Físico & Mesa D'Amiens",
            etapa: 'Etapa 2 — 7 a 10 dias',
            tituloComando: 'Comando de Regeneração Celular e Coerência Biofísica',
            comandoTexto:
              'Eu ativo no Campo de Ponto Zero o colapso de função de onda de regeneração celular e vitalidade plena para José Marcos Amaral Ferreira Filho. Em ressonância harmônica e não-localidade quântica, transfiro a informação arquetípica pura da saúde estrutural para reordenar sua matriz osteomuscular e elevar sua força vital em equilíbrio contínuo, consolidando o patamar de aceitação e clareza na Escala de Hawkins. Está ativado, colapsado e manifestado na ordem cósmica.',
          },
          {
            geometria: 'Harmonia & Turbilhão com Prosperador',
            etapa: 'Etapa 2 — 7 a 10 dias',
            tituloComando: 'Comando de Coerência Integral e Fluxo de Prosperidade',
            comandoTexto:
              'Eu colapso neste instante a ordem harmônica entre propósito, saúde e abundância no campo informacional de José Marcos Amaral Ferreira Filho. Através da Ressonância Harmônica pura, dissolvo bloqueios sutis à realização profissional, alinhando seus sete centros de força à criatividade serena e ao fluxo próspero e ético da vida. Está ativado, colapsado e manifestado na ordem cósmica.',
          },
        ],
        analisePsicossomatica:
          'Após concluir com sucesso a janela de desobstrução e o intervalo fisiológico de 12 horas, o campo de José Marcos atingiu 7.800 Å com proteção áurica de 78% e nível de consciência em 350 (Aceitação). O sistema osteomuscular apresenta apenas tensão lombar residual em remissão, frequentemente associada ao senso de responsabilidade excessiva sobre sustento e metas profissionais. O ingresso na Etapa 2 potencializa a reparação tecidual sutil e direciona a energia liberada para projetos de prosperidade com estabilidade emocional.',
        orientacaoPacienteResumo:
          'Você já atravessou a fase inicial de limpeza e agora está na etapa mais luminosa do protocolo: a reconstrução da vitalidade e a abertura de novos caminhos. Com a mente mais leve e o campo fortalecido, cada dia desta etapa consolida mais disposição física, postura firme e clareza para suas metas de trabalho e prosperidade.',
        prescricoes: {
          floraisBach: [
            'Oak (sustentação equilibrada da força sem sobrecarga na lombar)',
            'Larch (confiança criativa para novos projetos profissionais)',
            'Hornbeam (vigor renovado para a rotina produtiva)',
          ],
          fitoterapiaChas: [
            'Chá de Alecrim com Gengibre fresco pela manhã para foco e circulação',
            'Infusão de Cúrcuma com pimenta-do-reino leve após o almoço para suporte anti-inflamatório natural',
          ],
          frequenciasSolfeggio: [
            {
              hz: 528,
              nome: '528 Hz — Transformação & Reparação',
              indicacao: 'Regeneração celular, vitalidade física e coerência estrutural',
            },
            {
              hz: 432,
              nome: '432 Hz — Harmonia Fundamental',
              indicacao: 'Estabilização contínua da clareza mental e prosperidade serena',
            },
          ],
          pilaresAutocuidado: {
            hidratacaoFitoterapia:
              'Manter hidratação consciente com água mineralizada ao longo da manhã, associada ao chá de Alecrim matinal para vitalidade cognitiva.',
            higieneMentalOracao:
              'Praticar diariamente 5 minutos de gratidão ativa e visualização serena dos objetivos profissionais com foco em serviço e realização.',
            ambiente:
              'Organizar a mesa de trabalho com iluminação clara, boa ergonomia lombar e entrada de ar natural para sustentar o fluxo produtivo.',
            acompanhamentoMedico:
              'Dar continuidade às sessões de fisioterapia postural preventiva e ao acompanhamento médico anual, integrando os cuidados físicos ao trabalho vibracional.',
          },
        },
      },
    },
  ];
}

export function loadSessions(): QuantumRoomSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeds = createSeedSessions();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeds = createSeedSessions();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
      return seeds;
    }
    return parsed as QuantumRoomSession[];
  } catch {
    return createSeedSessions();
  }
}

export function saveSessions(sessions: QuantumRoomSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error('Erro ao salvar sessões no localStorage:', err);
  }
}

export function resetToDemoSeeds(): QuantumRoomSession[] {
  const seeds = createSeedSessions();
  saveSessions(seeds);
  return seeds;
}
