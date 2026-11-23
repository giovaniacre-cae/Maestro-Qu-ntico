export type PrintableGraphicCategory =
  | 'Limpeza & Purificação'
  | 'Potencialização & Geometria Sagrada'
  | 'Proteção & Defesa Espiritual'
  | 'Saúde Física & Vitalidade'
  | 'Harmonização & Chakras'
  | 'Prosperidade & Materialização'
  | 'Relacionamentos & Afeição'
  | 'Personalizados';

export const PRINTABLE_GRAPHIC_CATEGORIES: PrintableGraphicCategory[] = [
  'Limpeza & Purificação',
  'Potencialização & Geometria Sagrada',
  'Proteção & Defesa Espiritual',
  'Saúde Física & Vitalidade',
  'Harmonização & Chakras',
  'Prosperidade & Materialização',
  'Relacionamentos & Afeição',
  'Personalizados',
];

export interface PrintableGraphic {
  id: string;
  number: number;
  title: string;
  category: PrintableGraphicCategory;
  imageUrl: string;
  presentation: string;
  usageAspects: string;
  requiresNorthAlignment: boolean;
  isCustom?: boolean;
}

export function resolveGraphicImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${cleanBase}${cleanPath}`;
}

export const BUILTIN_PRINTABLE_GRAPHICS: PrintableGraphic[] = [
  // ---------------------------------------------------------------------------
  // 1. LIMPEZA & PURIFICAÇÃO
  // ---------------------------------------------------------------------------
  {
    id: 'graf-01-desimpregnador',
    number: 1,
    title: 'Desimpregnador',
    category: 'Limpeza & Purificação',
    imageUrl: '/graficos/01_desimpregnador.png',
    presentation:
      'Composto por um decágono central envolvido por quatro círculos concêntricos e setas radiais centrífugas, o Desimpregnador é o gráfico fundamental de assepsia sutil. Atua desagregando e expulsando energias nocivas, miasmas, formas-pensamento densas, cargas emocionais estagnadas e impregnações astrais aderidas a pessoas, objetos, cristais, testemunhos e ambientes.',
    usageAspects:
      '• Alinhamento: Não exige orientação ao Norte Magnético (geometria radial simétrica 360°).\n• Preparo do testemunho: Escreva nome completo e data de nascimento a lápis grafite em papel branco (ou use foto) previamente valorizado no Decágono Duplo por 15 a 30 minutos.\n• Pedras e objetos: Posicione cristais de trabalho ou objetos pessoais no centro por 10 a 30 minutos para desimpregnação imediata.\n• Tempo na mesa: Para pacientes ou ambientes, mantenha de 24h a 72h conforme aferição radiestésica no pêndulo (excelente para Etapa 1 Anti-Catarse).',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-15-triturador',
    number: 15,
    title: 'Triturador',
    category: 'Limpeza & Purificação',
    imageUrl: '/graficos/15_triturador.png',
    presentation:
      'Placa de geometria dinâmica projetada para fragmentar, dissolver e desintegrar blocos energéticos cristalizados, traumas antigos, mágoas profundas, células doentes em nível sutil e larvas astrais resistentes. Na clínica integrativa, atua quebrando padrões repetitivos de estagnação física ou emocional.',
    usageAspects:
      '• Alinhamento: Geometria circular dinâmica; alinhar a seta/eixo principal ao Norte potencializa o fluxo se desejado, embora opere bem em qualquer posição.\n• Testemunho e objetivo: Coloque o testemunho (grafite em papel branco ou foto) sobre o centro acompanhado do objetivo claro (ex.: "Dissolução de bloqueio emocional ou nódulo energético").\n• Cuidado clínico: Por ser um gráfico de dispersão vigorosa, evite uso prolongado em pacientes com Bovis muito baixo (< 5.000 Å) sem apoio posterior de harmonização.\n• Tempo médio: 24h a 72h aferidas no pêndulo.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-23-mesa-damiens',
    number: 23,
    title: "Mesa D'Amiens",
    category: 'Limpeza & Purificação',
    imageUrl: '/graficos/23_mesa_d_amiens.png',
    presentation:
      "Inspirada nas proporções sagradas da Catedral de Amiens e nas correntes geométricas de onda de forma, a Mesa D'Amiens atua como potente purificador e reequilibrador geobiológico e neuroendócrino. Neutraliza radiações telúricas nocivas, limpa memórias de espaços e harmoniza a água e alimentos.",
    usageAspects:
      '• Alinhamento: Recomenda-se alinhar o eixo principal da placa ao Norte Magnético para máxima ressonância.\n• Uso em água e alimentos: Coloque um copo ou jarra de vidro transparente com água sobre o centro por 15 a 30 minutos para dinamização e purificação vibracional.\n• Uso clínico e ambiental: Testemunho a grafite no centro para reequilíbrio de ambientes carregados, imóveis ou estabilização autônoma do paciente.\n• Ambiente/Leito: Pode ser posicionada sob a cama ou mesa de atendimento para limpeza contínua.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-24-placa-labirinto-damiens',
    number: 24,
    title: "Placa Labirinto D'Amiens",
    category: 'Limpeza & Purificação',
    imageUrl: '/graficos/24_placa_labirinto_d_amiens.png',
    presentation:
      'Baseada no traçado iniciático do Labirinto de Amiens, esta placa gera um campo de alta frequência capaz de transmutar vibrações caóticas, restaurar o sistema nervoso, acalmar a mente hiperativa e limpar pontos de estresse geopatogênico em residências e consultórios.',
    usageAspects:
      '• Alinhamento: Alinhar a entrada/eixo axial do labirinto ao Norte Magnético.\n• Água energizada: Copo de vidro com água filtrada por 20 minutos no centro para suporte a estados de ansiedade, insônia e esgotamento.\n• Testemunho: Coloque o testemunho valorizado no Decágono no centro do labirinto por ciclos de 3 a 7 dias.\n• Ambiente: Ideal para neutralizar pontos de cruzamento Hartmann ou zonas de conflito emocional no lar.',
    requiresNorthAlignment: true,
  },

  // ---------------------------------------------------------------------------
  // 2. POTENCIALIZAÇÃO & GEOMETRIA SAGRADA
  // ---------------------------------------------------------------------------
  {
    id: 'graf-02-decagono-duplo',
    number: 2,
    title: 'Decágono Duplo',
    category: 'Potencialização & Geometria Sagrada',
    imageUrl: '/graficos/02_decagono_duplo.png',
    presentation:
      'O Decágono Duplo é o gráfico mais essencial da radiônica para criação, ativação e potencialização de testemunhos artificiais (palavras-chave, nomes, intenções, remédios vibracionais e pedidos). Sua dupla geometria de 10 lados elimina interferências externas e imprime a informação pura no campo quântico.',
    usageAspects:
      '• Alinhamento: Polígono regular omnidirecional — dispensa alinhamento ao Norte Magnético.\n• Preparo de testemunho (regra de ouro): Antes de levar qualquer testemunho escrito a grafite a outro gráfico, mantenha-o no centro do Decágono Duplo por 15 a 30 minutos (ou tempo aferido no pêndulo) para impregná-lo energeticamente.\n• Emissão de remédios sutis: Utilize para transferir a assinatura vibracional de florais, fitoterápicos ou sais para água ou diretamente para o testemunho do paciente.\n• Manutenção: Mantenha a placa limpa e longe de papéis não relacionados.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-05-trigono',
    number: 5,
    title: 'Trígono',
    category: 'Potencialização & Geometria Sagrada',
    imageUrl: '/graficos/05_trigono.png',
    presentation:
      'Formado pela tríade sagrada associada ao Decágono e ao Turbilhão/círculos protetores, o Trígono integra e amplifica os planos Físico, Mental e Espiritual. Excelente para desbloquear situações estagnadas, proteger pedidos concretos, acelerar projetos e estabilizar metas clínicas.',
    usageAspects:
      '• Alinhamento: Recomenda-se apontar o vértice superior do triângulo para o Norte Magnético.\n• Montagem: Posicione o testemunho já valorizado no Decágono no centro do Trígono, sobrepondo o pedido escrito a grafite de forma objetiva e no presente.\n• Potencializador: Aceita um cristal de quartzo transparente lapidado ou bruto no vértice/centro, se confirmado pelo pêndulo.\n• Duração: Emitir de 3 a 10 dias conforme leitura radiestésica.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-36-vesica-piscis',
    number: 36,
    title: 'Vesica Piscis',
    category: 'Potencialização & Geometria Sagrada',
    imageUrl: '/graficos/36_vesica_piscis.png',
    presentation:
      'Símbolo primordial da geometria sagrada nascido da intersecção de dois círculos idênticos, representa a união dos opostos (Yin/Yang, matéria e espírito) e o portal da criação harmônica. Atua trazendo clareza intuitiva, criatividade, integração entre hemisférios cerebrais e equilíbrio relacional.',
    usageAspects:
      '• Alinhamento: Pode ser usado horizontalmente ou com o eixo vertical orientado ao Norte Magnético.\n• Testemunho: Coloque o testemunho do paciente na zona central de intersecção (mandorla) para integrar dualidades internas ou conflitos emocionais.\n• Água: Dinamiza água para serenidade, discernimento e meditação em 15 minutos.\n• Terapêutica: Excelente apoio durante atendimentos de sintonia para ampliar a conexão intuitiva.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-40-espiral-cosmica',
    number: 40,
    title: 'Espiral Cósmica',
    category: 'Potencialização & Geometria Sagrada',
    imageUrl: '/graficos/40_espiral_cosmica.png',
    presentation:
      'Representação do movimento contínuo de expansão e evolução do universo (sequência áurea), a Espiral Cósmica rompe inércias, movimenta energias paradas, impulsiona novos ciclos de vida, atrai oportunidades profissionais e acelera processos de crescimento pessoal.',
    usageAspects:
      '• Alinhamento: Não requer Norte obrigatório, mas posicionar o início/saída da espiral voltado para o Norte favorece emissões de expansão.\n• Montagem: Coloque o testemunho no olho central da espiral e, acima dele, o objetivo a grafite.\n• Indicação clínica: Muito útil após fase de limpeza para recolocar a vida do interagente em movimento fluido.\n• Duração: 7 a 14 dias com reavaliação periódica no pêndulo.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-42-flor-da-vida',
    number: 42,
    title: 'Flor da Vida',
    category: 'Potencialização & Geometria Sagrada',
    imageUrl: '/graficos/42_flor_da_vida.png',
    presentation:
      'Matriz geométrica universal presente em todas as tradições sagradas e na própria estrutura da vida celular. A Flor da Vida reorganiza o padrão vibracional original do DNA energético, harmoniza o campo áurico integral, neutraliza distorções e promove profunda coerência entre corpo, mente e espírito.',
    usageAspects:
      '• Alinhamento: Geometria hexagonal concêntrica — não exige Norte Magnético.\n• Água solarizada/dinamizada: Excelente base para jarras e garrafas de água de uso diário (15 a 30 min).\n• Base de atendimento: Pode ser usada como base sob copos, florais, cristais ou diretamente sob o testemunho para regeneração profunda.\n• Leito e ambiente: Colocada no quarto ou sala de terapia, irradia ordem harmônica constante.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-45-acelerador',
    number: 45,
    title: 'Acelerador',
    category: 'Potencialização & Geometria Sagrada',
    imageUrl: '/graficos/grafico_acelerador.png',
    presentation:
      'Combinando três anéis externos, a estrela de seis pontas (Selo de Salomão) e uma espiral central propulsora, o Gráfico Acelerador intensifica a velocidade de manifestação de emissões radiônicas, dinamiza florais e catalisa respostas terapêuticas quando o campo já está limpo e estável.',
    usageAspects:
      '• Alinhamento: Alinhar o ápice do triângulo superior da estrela para o Norte Magnético.\n• Protocolo Anti-Catarse: Utilizar preferencialmente na Etapa 2 ou em pacientes com Bovis >= 6.500 Å; evitar aceleração brusca em campos muito debilitados.\n• Montagem: Testemunho e intenção ou remédio vibracional sobre o centro da espiral.\n• Tempo: Monitorar diariamente com o pêndulo, pois sua velocidade de emissão é elevada.',
    requiresNorthAlignment: true,
  },

  // ---------------------------------------------------------------------------
  // 3. PROTEÇÃO & DEFESA ESPIRITUAL
  // ---------------------------------------------------------------------------
  {
    id: 'graf-16-scap',
    number: 16,
    title: 'SCAP (Símbolo Compensador André Philippe)',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/16_scap.png',
    presentation:
      'Criado pelo pesquisador francês André Philippe, o SCAP neutraliza ondas eletromagnéticas nocivas (Wi-Fi, celulares, roteadores, antenas, TVs), radiações telúricas e energias psíquicas densas, emitindo simultaneamente forças benéficas nos espectros elétrico e magnético equilibrados.',
    usageAspects:
      '• Alinhamento: Alinhar a letra/topo superior (eixo do gráfico) ao Norte Magnético para máximo rendimento.\n• Proteção tecnológica: Cole ou posicione sob roteadores, computadores, televisores e cabeceiras de cama.\n• Uso clínico: Testemunho no centro da estrela de 5 pontas/círculo interno para proteção de pacientes sensíveis a campos eletromagnéticos.\n• Limpeza contínua: Não satura facilmente, podendo permanecer por longos períodos.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-17-scap-cabalistico',
    number: 17,
    title: 'SCAP Cabalístico',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/17_scap_cabalistico.png',
    presentation:
      'Versão ampliada do SCAP que associa letras sagradas hebraicas (Shin / Iod-He-Vav-He) à geometria compensadora. Além de anular radiações eletromagnéticas e geopatogênicas, atua fortemente na dissipação de miasmas astrais, inveja, formas-pensamento negativas e desequilíbrios espirituais.',
    usageAspects:
      '• Alinhamento: Orientar o topo (letras superiores) voltado para o Norte Magnético.\n• Emissão de proteção e remédios: Muito utilizado na Etapa 1 de limpeza e em conjunto com o Decágono Duplo para emitir fórmulas sem interferências.\n• Ambientes e leito: Sob o colchão ou na entrada do ambiente para selamento energético.\n• Testemunho: Papel grafite no centro durante 48h a 72h ou tempo aferido.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-25-cruz-cosmica',
    number: 25,
    title: 'Cruz Cósmica',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/25_cruz_cosmica.png',
    presentation:
      'Formada por dois emblemas Atlantes associados a Nove Círculos em cada braço, a Cruz Cósmica é um poderoso escudo contra forças involutivas, energias intrusas, magia negativa e ataques psíquicos, protegendo bens materiais, pessoas e imóveis.',
    usageAspects:
      '• Alinhamento: Alinhar o eixo principal/superior da cruz exatamente para o Norte Magnético.\n• Montagem: Posicionar o testemunho do paciente ou endereço do imóvel no centro de intersecção.\n• Proteção residencial/comercial: Pode ser colocada próxima à porta de entrada ou em local discreto voltada ao Norte.\n• Duração: 7 dias ou manutenção contínua conforme pêndulo.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-26-luxor',
    number: 26,
    title: 'Luxor',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/26_luxor.png',
    presentation:
      'Baseado no anel atlante encontrado no Vale dos Reis (Egito), o gráfico de Luxor possui três barras centrais e triângulos que geram intensa barreira contra energias telúricas de subsolo (veios de água, falhas geológicas, linhas Hartmann/Curry) e protegem contra influências nocivas.',
    usageAspects:
      '• Alinhamento: O eixo longitudinal do gráfico deve ser alinhado ao Norte Magnético (ou direcionado perpendicularmente ao ponto telúrico detectado).\n• Geobiologia: Posicione no chão sobre pontos de anomalia telúrica ou sob a cama para evitar cansaço matinal.\n• Testemunho: Para blindagem pessoal de pacientes expostos a ambientes pesados.\n• Verificação: Testar com o pêndulo a necessidade de renovação após 7 dias.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-27-nove-circulos',
    number: 27,
    title: 'Nove Círculos',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/27_nove_circulos.png',
    presentation:
      'Composto por nove anéis concêntricos de espessura precisa, este gráfico cria uma câmara isolante de proteção física, emocional e espiritual. Protege bens móveis/imóveis, processos profissionais e o campo áurico contra roubo de energia, inveja e instabilidades externas.',
    usageAspects:
      '• Alinhamento: Círculos concêntricos simétricos — não necessita de alinhamento ao Norte.\n• Montagem: Coloque o testemunho do paciente, veículo (placa/documento a lápis) ou imóvel no círculo mais interno.\n• Uso clínico: Excelente para proteger o trabalho terapêutico enquanto outro processo está em andamento.\n• Tempo: 48h a 7 dias ou conforme aferição radiestésica.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-28-onze-circulos',
    number: 28,
    title: 'Onze Círculos',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/28_onze_circulos.png',
    presentation:
      'Evolução de maior densidade protetora dos Nove Círculos, os Onze Círculos formam uma barreira hermética de alta potência indicada contra assédios espirituais persistentes, ataques psíquicos direcionados, vampirismo energético e invasões sutis severas.',
    usageAspects:
      '• Alinhamento: Não exige Norte Magnético por sua simetria circular perfeita.\n• Uso de emergência: Indispensável na Etapa 1 Anti-Catarse quando há indicação de interferências densas ou aura aberta (0% a 30%).\n• Montagem: Testemunho a grafite no núcleo central sem excesso de outros papéis.\n• Duração: 48h a 72h iniciais com rechecagem obrigatória.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-32-anti-magia',
    number: 32,
    title: 'Anti Magia',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/32_anti_magia.png',
    presentation:
      'Baseado no Selo de Salomão (hexagrama entrelaçado) dentro de círculos de contenção e proteção, o Anti Magia anula feitiços, trabalhos astrais negativos, maldições, inveja direcionada e projeções mentais hostis enviadas contra pessoas ou negócios.',
    usageAspects:
      '• Alinhamento: Recomenda-se alinhar a ponta superior do triângulo ascendente para o Norte Magnético.\n• Montagem: Testemunho valorizado no Decágono posicionado exatamente no centro da estrela.\n• Associação: Pode trabalhar em paralelo ao Desimpregnador para limpar e blindar simultaneamente.\n• Tempo: De 48h a 7 dias, checando diariamente a dissipação da carga.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-33-escudo-protetor',
    number: 33,
    title: 'Escudo Protetor',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/33_escudo_protetor.png',
    presentation:
      'Desenvolvido com hexágono inscrito em círculos de ressonância, o Escudo Protetor promove blindagem rápida e prática do campo eletromagnético pessoal contra ambientes carregados, multidões, hospitais e desgastes emocionais cotidianos.',
    usageAspects:
      '• Alinhamento: Funciona em qualquer posição; opcionalmente, alinhar uma ponta do hexágono ao Norte.\n• Uso rápido: Excelente gráfico portátil (pode ser impresso em formato menor para carteira/mesa de trabalho, além da folha A4 de mesa).\n• Clínica: Indicado para terapeutas, médicos e interagentes altamente empáticos ("esponja energética").\n• Duração: Contínuo ou ciclos de 72h.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-34-ioshua',
    number: 34,
    title: 'Ioshua (Nome Místico)',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/34_ioshua_ou_nome_mistico.png',
    presentation:
      'Pantáculo sagrado que traz as quatro letras hebraicas do Nome Místico de Jesus (Iod-He-Shin-Vav-He) inscritas em losango protetor. Atua como poderoso filtro espiritual contra influências astrais negativas, miasmas psíquicos, pesadelos e ambientes hostis.',
    usageAspects:
      '• Alinhamento: Exige alinhamento rigoroso com a ponta superior (letras do topo) apontada para o Norte Magnético (deve ser usado na posição vertical/correta de leitura, nunca invertido).\n• Ambiente e Leito: Em paredes ou sob o travesseiro/colchão, protege o sono e impede perturbações astrais noturnas.\n• Clínica: Testemunho centralizado na face correta por 48h a 72h.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-35-quadrado-magico',
    number: 35,
    title: 'Quadrado Mágico',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/35_quadrado_magico.png',
    presentation:
      'Construído com base na antiga matriz de proteção verbal e geométrica (SATOR / matriz equilibrada), o Quadrado Mágico ancora estabilidade no plano físico, dissipa influências maléficas de ambientes, protege propriedades e afasta perturbações espirituais persistentes.',
    usageAspects:
      '• Alinhamento: Posicionar o topo de leitura alinhado ao Norte Magnético.\n• Imóveis e proteção física: Colocar o testemunho do endereço ou pessoa no centro do quadrado.\n• Complemento: Auxilia pessoas com dificuldade de aterramento e organização prática após limpezas profundas.\n• Duração: 7 dias com verificação radiestésica.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-37-justica-divina',
    number: 37,
    title: 'Justiça Divina',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/37_justica_divina.png',
    presentation:
      'Gráfico de alta ordem espiritual voltado ao restabelecimento da verdade, proteção jurídica e corte de injustiças, perseguições, calúnias ou vínculos cármicos opressivos. Atua promovendo resolução justa e serena em processos judiciais e conflitos éticos.',
    usageAspects:
      '• Alinhamento: Alinhar o eixo superior ao Norte Magnético.\n• Montagem: Posicionar o testemunho do interagente e o resumo objetivo do processo/situação (escrito a grafite, sem desejar mal a terceiros) no centro.\n• Conduta ética: Sempre focar no pedido de justiça, clareza e harmonia para todas as partes.\n• Duração: 7 a 21 dias conforme indicação do pêndulo.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-39-72-nomes-de-deus',
    number: 39,
    title: '72 Nomes de Deus em Hebraico',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/39_72_nomes_de_deus_em_hebraico.png',
    presentation:
      'Mandala sagrada da Cabala contendo os 72 códigos de três letras hebraicas extraídos do Êxodo. Cada tríade funciona como uma antena de frequência divina específica para proteção elevada, transmutação de carma, cura da alma e conexão com a providência superior.',
    usageAspects:
      '• Alinhamento: Alinhar o topo da mandala ao Norte Magnético.\n• Meditação e contemplação: Pode ser observada visualmente da direita para a esquerda em estados meditativos.\n• Uso na Mesa: Testemunho no núcleo central para casos espirituais complexos, libertação de votos antigos e elevação na Escala de Hawkins.\n• Duração: 7 dias com máximo respeito e intenção elevada.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-43-iave',
    number: 43,
    title: 'Iavê',
    category: 'Proteção & Defesa Espiritual',
    imageUrl: '/graficos/43_iave.png',
    presentation:
      'Gráfico emissor hebraico que atua como neutralizador de formas-pensamento negativas, energias intrusas e correntes astrais inferiores. Cria um espaço sagrado inviolável ao redor do testemunho, limpando impregnações mentais sem gerar conflito vibracional.',
    usageAspects:
      '• Alinhamento: Manter o texto hebraico na posição correta de leitura com o topo direcionado ao Norte Magnético.\n• Aplicação: Excelente para colocar antes ou junto a outros gráficos em ambientes muito perturbados ou em atendimentos de desobsessão sutil.\n• Tempo: 48h a 72h aferidas no pêndulo.',
    requiresNorthAlignment: true,
  },

  // ---------------------------------------------------------------------------
  // 4. SAÚDE FÍSICA & VITALIDADE
  // ---------------------------------------------------------------------------
  {
    id: 'graf-06-anti-dor',
    number: 6,
    title: 'Anti Dor',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/06_anti_dor.png',
    presentation:
      'Gráfico de ondas de forma dedicado à analgesia vibracional e acalmamento de processos dolorosos agudos ou crônicos (cefaleias, dores articulares, musculares, inflamatórias e viscerais). Atua reduzindo a sobrecarga elétrica local e facilitando a regeneração tissular.',
    usageAspects:
      '• Alinhamento: Posicionar com o eixo/topo orientado para o Norte Magnético para potencializar o fluxo analgésico.\n• Aplicação direta: Pode-se colocar um copo com água sobre o gráfico por 15 minutos para beber, ou posicionar a placa diretamente sobre o local da dor por 15 a 30 minutos.\n• A distância: Testemunho + papel em grafite indicando o órgão/região afetada.\n• Aviso clínico: Complemento vibracional; não substitui investigação médica da dor.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-07-alta-vitalidade',
    number: 7,
    title: 'Alta Vitalidade',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/07_alta_vitalidade.png',
    presentation:
      'Desenvolvido pelo radiestesista H. O. Busby, este gráfico irradia energia vital de altíssima frequência, elevando rapidamente o padrão no Biômetro de Bovis (para cima de 6.500–9.500 Å). Fortalece o sistema imunológico, combate fadiga crônica, apoia pós-operatórios e revitaliza plantas e alimentos.',
    usageAspects:
      '• Alinhamento: Geometria de círculo com raios/setores — não exige Norte Magnético (embora possa alinhar ao Norte se desejado).\n• Água e remédios: Copo de vidro com água por 10 a 20 minutos energiza todo o organismo; nunca exagerar na dose se houver hipersensibilidade.\n• Protocolo Anti-Catarse: Utilizar apenas na Etapa 2 após limpeza prévia em pacientes muito debilitados.\n• Plantas e vitalidade: Colocar sob vasos ou sementes para vigor biológico.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-12-gerador-piramide',
    number: 12,
    title: 'Gerador de Energia Pirâmide',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/12_gerador_de_energia_piramide.png',
    presentation:
      'Utiliza a geometria piramidal plana para captar e condensar energia cósmica (prana) com foco em regeneração celular, cicatrização, vitalização de órgãos debilitados e estabilização bioenergética de pessoas com exaustão física.',
    usageAspects:
      '• Alinhamento: Orientar uma das faces/topo da pirâmide exatamente para o Norte Magnético.\n• Montagem: Testemunho e objetivo terapêutico no centro geométrico da pirâmide (1/3 da altura ou centro do desenho).\n• Uso tópico/água: Dinamiza água para recuperação energética em 20 minutos.\n• Duração: 3 a 7 dias conforme resposta no pêndulo.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-13-gerador-circulo',
    number: 13,
    title: 'Gerador de Energia Círculo',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/13_gerador_de_energia_circulo.png',
    presentation:
      'Composto por anéis xadrezados concêntricos de alto contraste, o Gerador de Energia Círculo cria um intenso vórtice harmônico que recarrega baterias vitais, sustenta outros gráficos radiônicos e acelera a restauração energética de pessoas convalescentes.',
    usageAspects:
      '• Alinhamento: Simetria radial pura — dispensa alinhamento ao Norte Magnético.\n• Uso em cascata: Pode servir de base amplificadora ou atuar isolado com o testemunho no disco central.\n• Água vitalizada: 15 minutos no centro são suficientes.\n• Duração: Monitorar no pêndulo (usualmente de 48h a 7 dias) para evitar excesso de estímulo em pessoas agitadas.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-14-gerador-quadrado',
    number: 14,
    title: 'Gerador de Energia Quadrado',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/14_gerador_de_energia_quadrado.png',
    presentation:
      'Gráfico de padrão xadrezado estrutural ligado ao elemento Terra e à materialização física. Direciona energia sustentada para recuperação osteomuscular, fortalecimento orgânico concreto, estabilidade imunológica e consolidação de metas materiais.',
    usageAspects:
      '• Alinhamento: Alinhar uma das bordas retas ao Norte Magnético para organizar as correntes cardeais.\n• Montagem: Posicionar testemunho a grafite + órgão/sistema ou meta física no núcleo central.\n• Clínica ANSAE: Muito indicado quando sistemas SEsq, SM ou órgãos em < 6.500 Å necessitam de aterramento e tonicidade.\n• Duração: 5 a 10 dias.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-21-programador-fisico',
    number: 21,
    title: 'Programador Físico',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/21_programador_fisico.png',
    presentation:
      'Placa radiônica de precisão voltada à reprogramação da matriz biológica perfeita das células, tecidos, glândulas e órgãos. Atua informando ao campo sutil o arquétipo original de saúde e funcionamento fisiológico equilibrado.',
    usageAspects:
      '• Alinhamento: Alinhar a placa com o topo voltado para o Norte Magnético.\n• Montagem: Posicionar o testemunho do interagente e o nome exato do órgão/sistema ANSAE a regenerar (escrito a lápis grafite).\n• Água informacional: Pode-se colocar um copo com água por 20 minutos para reforçar a informação celular.\n• Duração: 7 a 14 dias, preferencialmente na Etapa 2.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-22-irradiador-energetico',
    number: 22,
    title: 'Irradiador Energético',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/22_irradiador_energetico.png',
    presentation:
      'Com anéis concêntricos cruzados por arcos em flor/vesica, o Irradiador Energético distribui energia vital contínua em todas as direções a partir de seu núcleo, suprindo carências de prana, restaurando o tônus áurico e apoiando tratamentos à distância.',
    usageAspects:
      '• Alinhamento: Recomenda-se posicionar o topo para o Norte Magnético para irradiar com coerência axial.\n• Montagem: Testemunho no centro; aceita cristal de quartzo verde ou transparente para direcionar cura física.\n• Água e ambiente: Energiza água em 15 minutos e melhora a vitalidade de salas de atendimento.\n• Duração: 3 a 7 dias.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-41-energizador',
    number: 41,
    title: 'Energizador',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/41_energizador.png',
    presentation:
      'Desenhado para recarga energética rápida e combate à fadiga física, sonolência excessiva e apatia vibracional. Restabelece o vigor após períodos de estresse intenso, noites mal dormidas ou esforço físico e mental prolongado.',
    usageAspects:
      '• Alinhamento: Posicionar preferencialmente com o eixo vertical voltado para o Norte Magnético.\n• Uso matinal: Excelente para dinamizar água pela manhã (10 a 15 minutos) — evite uso próximo ao horário de dormir em pessoas com insônia.\n• Testemunho: Coloque no centro por 24h a 72h conforme leitura radiestésica.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-44-placa-cruz-ansata',
    number: 44,
    title: 'Placa Cruz Ansata',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/44_placa_cruz_ansata.png',
    presentation:
      'Representação sagrada do Ankh egípcio associada a decágono/círculos emissores. A Cruz Ansata atua como inversor de ondas nocivas em benéficas, bloqueando processos degenerativos sutis, acelerando recuperações físicas complexas e sustentando a força da vida.',
    usageAspects:
      '• Alinhamento: A alça circular (topo da cruz) deve apontar obrigatoriamente para o Norte Magnético.\n• Aplicação na saúde: Colocar o testemunho sobre a zona de interseção dos braços ou na base conforme aferição do pêndulo.\n• Água e testemunhos: Ótimo para casos crônicos de baixa vitalidade na Etapa 2.\n• Duração: 7 a 10 dias com acompanhamento contínuo.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-47-chakras-pet',
    number: 47,
    title: 'Chakras Pet',
    category: 'Saúde Física & Vitalidade',
    imageUrl: '/graficos/grafico_chakras_pet.jfif',
    presentation:
      'Prancha terapêutica dedicada exclusivamente à radiestesia veterinária e harmonização sutil de cães e gatos. Mapeia os principais centros energéticos dos animais domésticos (incluindo o Chakra Braquial, exclusivo dos animais, responsável pela conexão afetiva e cura).',
    usageAspects:
      '• Alinhamento: Colocar em mesa de atendimento plana (alinhamento ao Norte opcional).\n• Aferição com pêndulo: Passe o pêndulo sobre cada um dos centros desenhados (Coronal, Frontal, Laríngeo, Braquial, Cardíaco, Plexo Solar, Sacral e Básico) conectando-se ao testemunho do pet (nome/foto/tufo de pelo).\n• Harmonização: Após detectar desequilíbrios, emita com cristal ou coloque água do bebedouro sobre gráficos compatíveis (Alta Vitalidade/Harmonia).',
    requiresNorthAlignment: false,
  },

  // ---------------------------------------------------------------------------
  // 5. HARMONIZAÇÃO & CHAKRAS
  // ---------------------------------------------------------------------------
  {
    id: 'graf-08-diafragma-1',
    number: 8,
    title: 'Diafragma 1',
    category: 'Harmonização & Chakras',
    imageUrl: '/graficos/08_diafragma_1.png',
    presentation:
      'Com sua espiral dupla/radial em movimento centrífugo, o Diafragma 1 promove o corte imediato de processos negativos emocionais ou físicos, descongestiona chakras hiperativos ou bloqueados e permite a neutralização rápida de crises de nervosismo e agitação.',
    usageAspects:
      '• Alinhamento: Não exige Norte Magnético obrigatório (atua por rotação geométrica simétrica).\n• Montagem: Posicione um cristal de quartzo rosa ou verde no centro sobre o testemunho em casos de tensão emocional aguda.\n• Atenção clínica: Empregado em momentos pontuais (geralmente 30 min a 24h) para "desarmar" picos de estresse ou dor emocional antes da etapa de Harmonia.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-09-diafragma-2',
    number: 9,
    title: 'Diafragma 2',
    category: 'Harmonização & Chakras',
    imageUrl: '/graficos/09_diafragma_2.png',
    presentation:
      'Complementar ao Diafragma 1, o Diafragma 2 tem movimento convergente e restaurador. Acelera a recomposição do campo áurico após limpezas, integra as energias dos chakras com o corpo físico e promove acolhimento e estabilidade visceral.',
    usageAspects:
      '• Alinhamento: Simetria radial — não necessita orientação rígida ao Norte.\n• Montagem: Ideal após o uso do Diafragma 1 ou Desimpregnador para fechar e nutrir o campo do interagente.\n• Água: Dinamiza água para equilíbrio emocional e recuperação de choque psíquico.\n• Duração: 48h a 7 dias conforme leitura radiestésica.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-11-harmonia',
    number: 11,
    title: 'Harmonia',
    category: 'Harmonização & Chakras',
    imageUrl: '/graficos/11_harmonia.png',
    presentation:
      'Formado por oito círculos externos em torno de um núcleo central em pétalas/estrela, o gráfico Harmonia alinha os sete chakras simultaneamente, pacifica emoções turbulentas, promove concórdia familiar e equilibra as polaridades internas Yin e Yang.',
    usageAspects:
      '• Alinhamento: Não exige orientação ao Norte Magnético.\n• Montagem afetiva/familiar: Pode receber o testemunho individual ou múltiplos testemunhos (ex.: membros da família) dispostos nos círculos periféricos com o pedido central de paz.\n• Água: 15 minutos para água pacificadora antes de dormir.\n• Duração: 7 a 10 dias.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-46-bagua',
    number: 46,
    title: 'Baguá',
    category: 'Harmonização & Chakras',
    imageUrl: '/graficos/grafico_bagua.png',
    presentation:
      'Octógono sagrado do Feng Shui tradicional composto pelos oito trigramas do I Ching envolvendo o símbolo do Tao (Yin/Yang). Atua na harmonização integral de residências, consultórios e das 8 áreas da vida (prosperidade, sucesso, relacionamentos, criatividade, amigos, trabalho, espiritualidade e família).',
    usageAspects:
      '• Alinhamento: Orientar conforme o Norte Magnético ou alinhar a base (Trabalho/Carreira — Kan) conforme a planta do imóvel.\n• Uso ambiental: Fixar ou posicionar na mesa com a planta baixa ou endereço do imóvel no centro para equilibrar fluxos de Chi.\n• Uso pessoal: Equilíbrio profundo de Yin e Yang quando aferido desequilíbrio na Ficha ANSAE.',
    requiresNorthAlignment: true,
  },

  // ---------------------------------------------------------------------------
  // 6. PROSPERIDADE & MATERIALIZAÇÃO
  // ---------------------------------------------------------------------------
  {
    id: 'graf-04-turbilhao-prosperador',
    number: 4,
    title: 'Turbilhão com Prosperador',
    category: 'Prosperidade & Materialização',
    imageUrl: '/graficos/04_turbilhao_com_prosperador.png',
    presentation:
      'Associa a força de movimento rápido do Turbilhão à geometria do Prosperador, criando um potente acelerador de oportunidades financeiras, vendas, novos clientes, abundância material e realização concreta de projetos profissionais.',
    usageAspects:
      '• Alinhamento: Alinhar o topo da placa ao Norte Magnético.\n• Montagem: Posicionar testemunho valorizado no Decágono + meta financeira/profissional objetiva a grafite; opcionalmente colocar uma pedra pirita ou citrino no centro.\n• Pré-requisito: Sempre verifique no pêndulo se é necessário passar primeiro pelo Desembaraçador Material ou Desimpregnador.\n• Duração: 7 a 14 dias.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-10-desembaracador-material',
    number: 10,
    title: 'Desembaraçador Material',
    category: 'Prosperidade & Materialização',
    imageUrl: '/graficos/10_desembaracador_material.png',
    presentation:
      'Gráfico em espiral aberta com pontas direcionais projetado para desobstruir caminhos financeiros, destravar negócios parados, resolver pendências burocráticas, contratos emperrados, recebimentos atrasados e encontrar emprego ou novas fontes de renda.',
    usageAspects:
      '• Alinhamento: Recomenda-se alinhar a saída/seta direcional superior para o Norte Magnético.\n• Montagem: Coloque o testemunho do interagente junto à descrição clara do entrave a ser resolvido (ex.: "Fluidez e venda do imóvel X" ou "Desbloqueio financeiro profissional").\n• Pós-etapa: Após destravar, recomenda-se seguir com Turbilhão com Prosperador ou Júpiter.\n• Duração: 7 a 15 dias.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-19-shrim-fortuna',
    number: 19,
    title: 'Shrim para Fortuna',
    category: 'Prosperidade & Materialização',
    imageUrl: '/graficos/19_shrim_para_fortuna.png',
    presentation:
      'Bija Mantra sagrado de Lakshmi (deusa da abundância e beleza) em escrita devanágari/radiônica dentro de moldura emissora. Ativa o magnetismo de prosperidade legítima, gratidão, alegria em receber recursos e abertura para a fartura espiritual e material.',
    usageAspects:
      '• Alinhamento: Posicionar o mantra em leitura correta com o topo voltado para o Norte Magnético.\n• Montagem: Testemunho sobre o símbolo acompanhado de intenção próspera escrita no presente.\n• Prática integrativa: Pode ser usado junto com meditação ou entoação suave do mantra "Shrim" para ancorar consciência de abundância.\n• Duração: 7 a 10 dias.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-30-turbilhao-jupiter',
    number: 30,
    title: 'Turbilhão com Júpiter',
    category: 'Prosperidade & Materialização',
    imageUrl: '/graficos/30_turbilhao_com_jupiter.png',
    presentation:
      'Une o dinamismo do Turbilhão ao selo planetário de Júpiter, astro da expansão, sabedoria, justiça e boa sorte. Favorece crescimento empresarial, promoções, estudos superiores, vitórias em causas justas e ampliação de patrimônio.',
    usageAspects:
      '• Alinhamento: Alinhar o símbolo planetário de Júpiter e o topo da folha exatamente para o Norte Magnético.\n• Melhor momento: Caso deseje potencializar, iniciar a emissão em uma quinta-feira (dia de Júpiter).\n• Montagem: Testemunho + meta de expansão profissional ou financeira a grafite no centro.\n• Duração: 7 a 21 dias conforme indicação radiestésica.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-31-turbilhao-sol',
    number: 31,
    title: 'Turbilhão com Sol',
    category: 'Prosperidade & Materialização',
    imageUrl: '/graficos/31_turbilhao_com_sol.png',
    presentation:
      'Combina o Turbilhão ao símbolo solar central, irradiando força de sucesso, visibilidade profissional, reconhecimento, liderança luminosa, vitalidade física e superação da invisibilidade ou desânimo em projetos de vida.',
    usageAspects:
      '• Alinhamento: Posicionar o topo da folha direcionado para o Norte Magnético.\n• Montagem: Testemunho no centro do símbolo solar; aceita cristal citrino ou pedra do sol.\n• Clínica: Indicado para pacientes com autoestima rebaixada, medo de se expor profissionalmente ou estagnação na carreira.\n• Duração: 7 a 10 dias.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-38-cruz-atlante',
    number: 38,
    title: 'Cruz Atlante',
    category: 'Prosperidade & Materialização',
    imageUrl: '/graficos/38_cruz_atlante.png',
    presentation:
      'Baseada em proporções antigas de equilíbrio entre os planos celeste e terrestre, a Cruz Atlante possui forte poder realizador no plano material, protegendo investimentos, abrindo caminhos de prosperidade sólida e alinhando o propósito à sabedoria ancestral.',
    usageAspects:
      '• Alinhamento: O eixo maior da cruz deve ser alinhado rigorosamente na linha Norte–Sul magnética.\n• Montagem: Testemunho e intenção colocados no ponto central de cruzamento dos braços.\n• Duração: 7 a 14 dias, reavaliando no pêndulo a evolução do fluxo material.',
    requiresNorthAlignment: true,
  },

  // ---------------------------------------------------------------------------
  // 7. RELACIONAMENTOS & AFEIÇÃO
  // ---------------------------------------------------------------------------
  {
    id: 'graf-03-desembaracador-relacionamentos',
    number: 3,
    title: 'Desembaraçador de Relacionamentos',
    category: 'Relacionamentos & Afeição',
    imageUrl: '/graficos/03_desembaracador_relacionamentos.png',
    presentation:
      'Gráfico de fluxo radial e espiralado desenvolvido especificamente para destravar nós afetivos, dissipar mal-entendidos familiares, acalmar brigas conjugais ou societárias e abrir espaço para o diálogo respeitoso e pacífico.',
    usageAspects:
      '• Alinhamento: Simétrico; opcionalmente alinhar ao Norte Magnético para maior estabilidade.\n• Conduta ética: Nunca emitir para forçar a vontade de terceiros — peça sempre "harmonização, verdade e o que for melhor para ambos".\n• Montagem: Testemunhos dos envolvidos colocados no centro (previamente valorizados no Decágono).\n• Duração: 7 a 10 dias.',
    requiresNorthAlignment: false,
  },
  {
    id: 'graf-18-hrim-unir-casais',
    number: 18,
    title: 'HRIM para Unir Casais',
    category: 'Relacionamentos & Afeição',
    imageUrl: '/graficos/18_hrim_para_unir_casais.png',
    presentation:
      'Bija Mantra da unidade e do coração desperto, o gráfico HRIM atua dissolvendo barreiras de orgulho, distanciamento afetivo e frieza entre casais que já possuem vínculo genuíno, restaurando a sintonia cardíaca, a cumplicidade e o respeito mútuo.',
    usageAspects:
      '• Alinhamento: Orientar o topo de leitura do mantra para o Norte Magnético.\n• Montagem: Nomes completos e datas de nascimento do casal a grafite (previamente valorizados no Decágono) sobre o centro, com pedido de harmonia e amor consciente.\n• Cristal opcional: Quartzo rosa no centro se confirmado pelo pêndulo.\n• Duração: 7 a 14 dias.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-20-klim-amor',
    number: 20,
    title: 'Klim para o Amor',
    category: 'Relacionamentos & Afeição',
    imageUrl: '/graficos/20_klim_para_o_amor.png',
    presentation:
      'Mantra gráfico de atração luminosa e ternura, o Klim eleva o magnetismo afetivo do interagente, cura feridas de rejeição no chakra cardíaco, estimula o amor-próprio e favorece encontros amorosos saudáveis e recíprocos.',
    usageAspects:
      '• Alinhamento: Posicionar o símbolo na orientação correta de leitura com o topo ao Norte Magnético.\n• Uso individual: Excelente para quem deseja abrir o coração para um relacionamento saudável a partir do próprio equilíbrio interno.\n• Montagem: Testemunho único no centro durante 7 a 10 dias.',
    requiresNorthAlignment: true,
  },
  {
    id: 'graf-29-turbilhao-venus',
    number: 29,
    title: 'Turbilhão com Vênus',
    category: 'Relacionamentos & Afeição',
    imageUrl: '/graficos/29_turbilhao_com_venus.png',
    presentation:
      'Combina o movimento acelerador do Turbilhão ao selo planetário de Vênus (astro do amor, beleza, autoestima e diplomacia). Favorece reconciliações harmônicas, suavização de temperamentos rígidos, magnetismo pessoal e criatividade artística.',
    usageAspects:
      '• Alinhamento: Alinhar o topo da placa e o símbolo de Vênus ao Norte Magnético.\n• Melhor momento: Sexta-feira é tradicionalmente favorável para iniciar emissões de Vênus.\n• Montagem: Testemunho no centro do símbolo venusiano + cristal quartzo rosa ou esmeralda.\n• Duração: 7 a 10 dias.',
    requiresNorthAlignment: true,
  },
];
