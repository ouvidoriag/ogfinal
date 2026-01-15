/**
 * Sistema de Memória e Aprendizado da CORA
 * Aprende preferências e estilo do usuário ao longo do tempo
 * 
 * MELHORIA CORA - CÉREBRO X-3
 * Data: 12/12/2025
 */

import ChatMessage from '../../models/ChatMessage.model.js';
import { logger } from '../logger.js';

/**
 * Analisar padrões de uso do usuário
 */
export async function analyzeUserPatterns(userId, context) {
  try {
    // Buscar últimas 50 mensagens do usuário
    const messages = await ChatMessage.find({
      userId: userId,
      context: context,
      sender: 'user'
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (messages.length < 5) {
      return null; // Não há dados suficientes
    }

    const patterns = {
      temasFrequentes: {},
      tiposPerguntas: {
        contar: 0,
        comparar: 0,
        ranking: 0,
        tempo: 0,
        detalhar: 0
      },
      preferenciaDetalhamento: 'medio', // baixo, medio, alto
      preferenciaFormato: 'texto', // texto, tabela, lista
      tomUsual: 'neutro'
    };

    // Analisar temas frequentes
    messages.forEach(msg => {
      const text = msg.text.toLowerCase();

      // Detectar tipo de pergunta
      if (text.match(/(quant[ao]s?|total|soma|contagem)/)) patterns.tiposPerguntas.contar++;
      if (text.match(/(compar|versus|diferença|diferenca)/)) patterns.tiposPerguntas.comparar++;
      if (text.match(/(top|ranking|mais|maior|menor)/)) patterns.tiposPerguntas.ranking++;
      if (text.match(/(tempo|prazo|duração|duracao|sla)/)) patterns.tiposPerguntas.tempo++;
      if (text.match(/(detalhar|detalhes|explicar|como funciona)/)) patterns.tiposPerguntas.detalhar++;

      // Detectar temas
      if (text.includes('saúde') || text.includes('saude')) patterns.temasFrequentes.saude = (patterns.temasFrequentes.saude || 0) + 1;
      if (text.includes('educação') || text.includes('educacao')) patterns.temasFrequentes.educacao = (patterns.temasFrequentes.educacao || 0) + 1;
      if (text.includes('zeladoria') || text.includes('limpeza')) patterns.temasFrequentes.zeladoria = (patterns.temasFrequentes.zeladoria || 0) + 1;
      if (text.includes('secretaria') || text.includes('órgão') || text.includes('orgao')) patterns.temasFrequentes.orgaos = (patterns.temasFrequentes.orgaos || 0) + 1;
      if (text.includes('bairro')) patterns.temasFrequentes.bairro = (patterns.temasFrequentes.bairro || 0) + 1;
      if (text.includes('tempo') || text.includes('prazo')) patterns.temasFrequentes.tempo = (patterns.temasFrequentes.tempo || 0) + 1;
    });

    // Determinar preferência de detalhamento
    const detalharCount = patterns.tiposPerguntas.detalhar;
    const total = messages.length;
    if (detalharCount / total > 0.3) {
      patterns.preferenciaDetalhamento = 'alto';
    } else if (detalharCount / total < 0.1) {
      patterns.preferenciaDetalhamento = 'baixo';
    }

    // Determinar tom usual
    const urgentCount = messages.filter(m => m.metadata?.tone === 'urgente').length;
    const preocupadoCount = messages.filter(m => m.metadata?.tone === 'preocupado').length;
    if (urgentCount / total > 0.2) {
      patterns.tomUsual = 'urgente';
    } else if (preocupadoCount / total > 0.2) {
      patterns.tomUsual = 'preocupado';
    }

    return patterns;
  } catch (error) {
    logger.warn('Erro ao analisar padrões do usuário:', error.message);
    return null;
  }
}

/**
 * Adaptar resposta baseada nos padrões do usuário
 */
export function adaptResponseToUser(response, patterns) {
  if (!patterns) return response;

  let adapted = response;

  // Se usuário prefere menos detalhes, simplificar
  if (patterns.preferenciaDetalhamento === 'baixo') {
    // Remover seções muito detalhadas (manter apenas essencial)
    adapted = adapted.replace(/\n\n\*\*.*?\*\*:[\s\S]*?(?=\n\n\*\*|\n\n💡|$)/g, (match) => {
      if (match.length > 500) {
        return match.substring(0, 200) + '...';
      }
      return match;
    });
  }

  // Se usuário prefere mais detalhes, adicionar contexto
  if (patterns.preferenciaDetalhamento === 'alto') {
    // Já está detalhado, não precisa mudar
  }

  // Se usuário costuma fazer perguntas de ranking, destacar rankings
  if (patterns.tiposPerguntas.ranking > patterns.tiposPerguntas.contar) {
    adapted = adapted.replace(/(\d+\.\s+[^\n]+)/g, '**$1**');
  }

  return adapted;
}

/**
 * Gerar sugestão personalizada baseada nos padrões
 */
export function generatePersonalizedSuggestion(patterns) {
  if (!patterns) return null;

  const topTipo = Object.entries(patterns.tiposPerguntas)
    .sort((a, b) => b[1] - a[1])[0];

  const topTema = Object.entries(patterns.temasFrequentes)
    .sort((a, b) => b[1] - a[1])[0];

  if (!topTipo || !topTema) return null;

  const sugestoes = {
    contar: {
      saude: 'Quantas manifestações sobre saúde temos este mês?',
      educacao: 'Quantas manifestações sobre educação temos?',
      zeladoria: 'Quantas ocorrências de zeladoria temos?',
      orgaos: 'Quantas manifestações temos por secretaria?',
      bairro: 'Quantas manifestações temos por bairro?'
    },
    ranking: {
      saude: 'Quais os top 5 temas relacionados à saúde?',
      educacao: 'Quais os top 5 temas relacionados à educação?',
      zeladoria: 'Quais os top 5 bairros com mais ocorrências?',
      orgaos: 'Quais as top 5 secretarias com mais manifestações?',
      bairro: 'Quais os top 5 bairros com mais demandas?'
    },
    tempo: {
      saude: 'Qual o tempo médio de resolução de manifestações sobre saúde?',
      educacao: 'Qual o tempo médio de resolução de manifestações sobre educação?',
      zeladoria: 'Qual o tempo médio de resolução de ocorrências de zeladoria?',
      orgaos: 'Qual o tempo médio por secretaria?',
      bairro: 'Qual o tempo médio por bairro?'
    }
  };

  return sugestoes[topTipo[0]]?.[topTema[0]] || null;
}

