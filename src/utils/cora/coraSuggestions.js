/**
 * Sistema de Sugestões de Perguntas para CORA
 * Gera sugestões contextuais baseadas no sistema e dados disponíveis
 * 
 * MELHORIA CORA - CÉREBRO X-3
 * Data: 12/12/2025
 */

import Record from '../../models/Record.model.js';
import Zeladoria from '../../models/Zeladoria.model.js';
import Esic from '../../models/Esic.model.js';
import { logger } from '../logger.js';

/**
 * Sugestões base por contexto
 */
const SUGGESTIONS_BASE = {
  ouvidoria: [
    'Quantas manifestações tivemos este mês?',
    'Qual o tempo médio de resolução?',
    'Quais os top 5 temas mais frequentes?',
    'Quantas reclamações sobre saúde?',
    'Qual secretaria tem mais manifestações?',
    'Quantos protocolos estão vencidos?',
    'Qual o bairro com mais ocorrências?',
    'Como está a distribuição por status?',
    'Qual a evolução mensal dos últimos 6 meses?',
    'Quantas denúncias recebemos?'
  ],
  zeladoria: [
    'Quantas ocorrências de zeladoria temos?',
    'Qual a categoria mais frequente?',
    'Quais os top 5 bairros com mais ocorrências?',
    'Qual o tempo médio de resolução?',
    'Como está a distribuição por departamento?',
    'Quantas ocorrências estão pendentes?',
    'Qual o canal mais usado?',
    'Quais os principais problemas de limpeza?',
    'Como está a evolução mensal?',
    'Qual departamento resolve mais rápido?'
  ],
  esic: [
    'Quantas solicitações de informação temos?',
    'Qual o tempo médio de resposta?',
    'Quais os tipos de informação mais solicitados?',
    'Quantas solicitações estão pendentes?',
    'Qual unidade recebe mais pedidos?',
    'Como está a distribuição por status?',
    'Qual o canal mais usado?',
    'Quais os prazos de resposta?',
    'Como está a evolução mensal?',
    'Quantas solicitações foram atendidas no prazo?'
  ],
  central: [
    'Qual o total de demandas em todos os sistemas?',
    'Como está a distribuição entre Ouvidoria, Zeladoria e E-SIC?',
    'Qual o tempo médio geral de resolução?',
    'Quais os principais temas em todos os sistemas?',
    'Como está a evolução consolidada?',
    'Quantos protocolos estão vencidos no total?',
    'Qual sistema tem mais demanda?',
    'Quais os top 5 bairros em todos os sistemas?',
    'Como está a performance geral?',
    'Quais as principais tendências?'
  ]
};

/**
 * Gerar sugestões dinâmicas baseadas em dados reais
 */
export async function generateDynamicSuggestions(context, limit = 5) {
  try {
    const suggestions = [...(SUGGESTIONS_BASE[context] || SUGGESTIONS_BASE.ouvidoria)];

    // Adicionar sugestões dinâmicas baseadas em dados reais
    if (context === 'ouvidoria' || context === 'central') {
      try {
        // Top temas
        const topTemas = await Record.aggregate([
          { $match: { tema: { $ne: null, $ne: '' } } },
          { $group: { _id: '$tema', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 3 }
        ]);

        topTemas.forEach(tema => {
          suggestions.push(`Quantas manifestações sobre ${tema._id}?`);
        });

        // Top secretarias
        const topOrgaos = await Record.aggregate([
          { $match: { orgaos: { $ne: null, $ne: '' } } },
          { $group: { _id: '$orgaos', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 2 }
        ]);

        topOrgaos.forEach(orgao => {
          suggestions.push(`Quantas manifestações na ${orgao._id}?`);
        });
      } catch (error) {
        logger.warn('Erro ao gerar sugestões dinâmicas (ouvidoria):', error.message);
      }
    }

    if (context === 'zeladoria' || context === 'central') {
      try {
        // Top categorias
        const topCategorias = await Zeladoria.aggregate([
          { $match: { categoria: { $ne: null, $ne: '' } } },
          { $group: { _id: '$categoria', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 2 }
        ]);

        topCategorias.forEach(cat => {
          suggestions.push(`Quantas ocorrências de ${cat._id}?`);
        });
      } catch (error) {
        logger.warn('Erro ao gerar sugestões dinâmicas (zeladoria):', error.message);
      }
    }

    // Retornar sugestões aleatórias (limit)
    const shuffled = suggestions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);

  } catch (error) {
    logger.warn('Erro ao gerar sugestões:', error.message);
    return SUGGESTIONS_BASE[context]?.slice(0, limit) || [];
  }
}

/**
 * Obter sugestões para um contexto
 */
export async function getSuggestions(context, limit = 5) {
  try {
    // 80% sugestões base, 20% dinâmicas
    const baseCount = Math.ceil(limit * 0.8);
    const dynamicCount = limit - baseCount;

    const base = SUGGESTIONS_BASE[context]?.slice(0, baseCount) || [];
    const dynamic = await generateDynamicSuggestions(context, dynamicCount);

    return [...base, ...dynamic].slice(0, limit);
  } catch (error) {
    logger.warn('Erro ao obter sugestões:', error.message);
    return SUGGESTIONS_BASE[context]?.slice(0, limit) || [];
  }
}

