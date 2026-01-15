/**
 * Sistema de Personalidade e Humanização da CORA
 * Torna a CORA mais humana, empática e natural
 * 
 * MELHORIA CORA - CÉREBRO X-3
 * Data: 12/12/2025
 */

/**
 * Variações de abertura/saudação
 */
export const GREETINGS = {
  primeira_vez: [
    'Olá! 👋 Prazer em conhecê-lo! Sou a Cora, sua assistente virtual especialista em análises de dados municipais.',
    'Oi! 👋 Que bom ter você aqui! Eu sou a Cora, e estou aqui para ajudar com análises dos dados da prefeitura.',
    'Olá! 👋 Bem-vindo! Sou a Cora, sua assistente. Vou te ajudar a entender melhor os dados do sistema.'
  ],
  retorno: [
    'Olá novamente! 👋 Que bom te ver de volta!',
    'Oi! 👋 Que prazer te ver aqui novamente!',
    'Olá! 👋 Bem-vindo de volta! Como posso ajudar hoje?'
  ],
  continuacao: [
    'Claro! Vou verificar isso para você.',
    'Perfeito! Deixa eu analisar isso.',
    'Entendi! Vou buscar essas informações.',
    'Ótimo! Vou investigar isso agora.',
    'Com certeza! Deixa eu verificar.'
  ]
};

/**
 * Variações de reconhecimento
 */
export const ACKNOWLEDGMENTS = {
  entendido: [
    'Entendi!',
    'Perfeito!',
    'Claro!',
    'Com certeza!',
    'Ótimo!',
    'Beleza!',
    'Tranquilo!'
  ],
  interessante: [
    'Interessante!',
    'Que interessante!',
    'Muito interessante!',
    'Hmm, interessante!',
    'Olha só!',
    'Que legal!'
  ],
  preocupacao: [
    'Hmm, isso é preocupante.',
    'Isso precisa de atenção.',
    'Vamos investigar isso melhor.',
    'Isso é algo que merece cuidado.',
    'Precisamos olhar isso com atenção.'
  ],
  sucesso: [
    'Ótimo!',
    'Excelente!',
    'Que bom!',
    'Isso é muito positivo!',
    'Fantástico!',
    'Perfeito!'
  ]
};

/**
 * Variações de transição
 */
export const TRANSITIONS = {
  apresentando_dados: [
    'Olhando os dados, vejo que...',
    'Analisando as informações, encontrei que...',
    'Deixa eu ver o que os dados mostram...',
    'Vou te mostrar o que encontrei...',
    'Olha só o que descobri nos dados...',
    'Analisando aqui, vejo que...'
  ],
  comparando: [
    'Comparando com o período anterior...',
    'Se compararmos com o mês passado...',
    'Em relação ao período anterior...',
    'Fazendo uma comparação...',
    'Vamos ver como está em relação a...'
  ],
  destacando: [
    'O que mais chama atenção é...',
    'Algo importante que notei...',
    'Um ponto que destaco é...',
    'Chama atenção o fato de que...',
    'Vale destacar que...'
  ]
};

/**
 * Perguntas de follow-up proativas
 */
export const FOLLOW_UPS = {
  aprofundar: [
    'Quer que eu aprofunde algum ponto específico?',
    'Posso detalhar mais alguma coisa?',
    'Tem algo específico que você gostaria de saber mais?',
    'Quer que eu investigue mais algum aspecto?'
  ],
  relacionar: [
    'Quer que eu relacione isso com outros dados?',
    'Posso mostrar como isso se relaciona com outros indicadores?',
    'Quer ver como isso impacta outras áreas?'
  ],
  comparar: [
    'Quer comparar com outros períodos?',
    'Posso mostrar a evolução ao longo do tempo?',
    'Quer ver como isso varia por secretaria/bairro?'
  ],
  acao: [
    'Quer que eu sugira algumas ações baseadas nesses dados?',
    'Posso ajudar a identificar pontos de atenção?',
    'Quer que eu destaque os principais pontos de ação?'
  ]
};

/**
 * Expressões empáticas
 */
export const EMPATHY = {
  reconhecendo_esforco: [
    'Sei que é muita informação, mas vamos por partes.',
    'Entendo que pode ser complexo, mas estou aqui para ajudar.',
    'Sei que são muitos dados, mas vou organizar de forma clara.'
  ],
  celebrando: [
    'Isso é muito positivo! 🎉',
    'Que resultado excelente! 👏',
    'Parabéns pelo trabalho! 🎊',
    'Isso mostra um ótimo trabalho! 🌟'
  ],
  preocupacao: [
    'Isso precisa de atenção imediata. ⚠️',
    'Vamos monitorar isso de perto.',
    'Isso é um ponto que merece cuidado.',
    'Sugiro dar uma olhada mais detalhada nisso.'
  ],
  encorajamento: [
    'Vamos investigar isso juntos!',
    'Estou aqui para ajudar a entender melhor.',
    'Não se preocupe, vamos resolver isso.',
    'Vamos descobrir o que está acontecendo.'
  ]
};

/**
 * Selecionar variação aleatória de uma categoria
 */
export function getVariation(category, type) {
  const variations = category[type] || [];
  if (variations.length === 0) return '';
  return variations[Math.floor(Math.random() * variations.length)];
}

/**
 * Detectar tom da pergunta do usuário
 */
export function detectUserTone(text) {
  const textLower = text.toLowerCase();
  
  if (textLower.match(/(urgente|urgência|rápido|rapido|agora|imediato)/)) {
    return 'urgente';
  }
  if (textLower.match(/(preocupado|preocupacao|problema|erro|falha)/)) {
    return 'preocupado';
  }
  if (textLower.match(/(parabéns|parabens|bom|ótimo|otimo|excelente|sucesso)/)) {
    return 'positivo';
  }
  if (textLower.match(/(obrigado|obrigada|valeu|grato|gratidao)/)) {
    return 'gratidao';
  }
  
  return 'neutro';
}

/**
 * Gerar resposta empática baseada no tom
 */
export function getEmpatheticResponse(tone, data) {
  switch (tone) {
    case 'urgente':
      return getVariation(EMPATHY, 'preocupacao') + ' ' + getVariation(TRANSITIONS, 'apresentando_dados');
    case 'preocupado':
      return getVariation(EMPATHY, 'encorajamento') + ' ' + getVariation(TRANSITIONS, 'apresentando_dados');
    case 'positivo':
      return getVariation(EMPATHY, 'celebrando') + ' ' + getVariation(TRANSITIONS, 'apresentando_dados');
    case 'gratidao':
      return 'De nada! 😊 Fico feliz em ajudar. ' + getVariation(FOLLOW_UPS, 'aprofundar');
    default:
      return getVariation(TRANSITIONS, 'apresentando_dados');
  }
}

/**
 * Gerar pergunta de follow-up inteligente baseada no contexto
 */
export function generateFollowUp(context, dados, historico) {
  const followUps = [];
  
  // Se há comparação, sugerir aprofundar
  if (dados.comparativo) {
    followUps.push(getVariation(FOLLOW_UPS, 'relacionar'));
  }
  
  // Se há insights preocupantes, sugerir ação
  if (dados.insights && dados.insights.some(i => i.nivel === 'alerta' || i.nivel === 'atencao')) {
    followUps.push(getVariation(FOLLOW_UPS, 'acao'));
  }
  
  // Se há muitos dados, sugerir aprofundar
  if (dados.estatisticasGerais?.total > 1000) {
    followUps.push(getVariation(FOLLOW_UPS, 'aprofundar'));
  }
  
  // Se não há follow-ups específicos, usar genérico
  if (followUps.length === 0) {
    followUps.push(getVariation(FOLLOW_UPS, 'aprofundar'));
  }
  
  return followUps[0];
}

/**
 * Referenciar conversa anterior de forma natural
 */
export function referencePreviousConversation(historico, currentText) {
  if (!historico || historico.length < 4) return null;
  
  // Buscar última pergunta do usuário relevante
  const ultimasPerguntas = historico
    .filter(m => m.sender === 'user')
    .slice(-3)
    .map(m => m.text);
  
  if (ultimasPerguntas.length === 0) return null;
  
  // Detectar se há relação temática
  const temasAnteriores = ultimasPerguntas.join(' ').toLowerCase();
  const temaAtual = currentText.toLowerCase();
  
  // Verificar se há palavras-chave em comum
  const palavrasAnteriores = new Set(temasAnteriores.split(/\s+/).filter(w => w.length > 4));
  const palavrasAtuais = new Set(temaAtual.split(/\s+/).filter(w => w.length > 4));
  const intersecao = [...palavrasAnteriores].filter(w => palavrasAtuais.has(w));
  
  if (intersecao.length > 0) {
    const referencias = [
      'Relacionando com o que você perguntou antes...',
      'Complementando a pergunta anterior...',
      'Expandindo o que discutimos...',
      'Em relação ao que você mencionou...'
    ];
    return referencias[Math.floor(Math.random() * referencias.length)];
  }
  
  return null;
}

/**
 * Adicionar personalidade à resposta
 */
export function humanizeResponse(response, context = {}) {
  let humanized = response;
  
  // Adicionar variações de abertura se for início de conversa
  if (context.isFirstMessage) {
    const greeting = getVariation(GREETINGS, 'primeira_vez');
    humanized = greeting + '\n\n' + humanized;
  }
  
  // Adicionar variações de reconhecimento
  if (context.acknowledgment) {
    const ack = getVariation(ACKNOWLEDGMENTS, context.acknowledgment);
    humanized = ack + ' ' + humanized;
  }
  
  // Adicionar referência a conversa anterior
  if (context.previousReference) {
    humanized = context.previousReference + '\n\n' + humanized;
  }
  
  // Adicionar follow-up proativo
  if (context.followUp) {
    humanized += '\n\n' + context.followUp;
  }
  
  return humanized;
}

