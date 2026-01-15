/**
 * Sistema de Insights Automáticos para CORA
 * Detecta padrões, anomalias e tendências nos dados
 * 
 * MELHORIA CORA - CÉREBRO X-3
 * Data: 12/12/2025
 */

import Record from '../../models/Record.model.js';
import Zeladoria from '../../models/Zeladoria.model.js';
import Esic from '../../models/Esic.model.js';
import { logger } from '../logger.js';

/**
 * Detectar insights automáticos baseados nos dados
 */
export async function detectInsights(context, periodo = null) {
  const insights = [];

  try {
    if (context === 'ouvidoria' || context === 'central') {
      const hoje = new Date();
      const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);

      // Insight 1: Crescimento/queda significativa
      const mesAtualCount = await Record.countDocuments({
        dataCriacaoIso: { $gte: mesAtual.toISOString().split('T')[0] }
      });

      const mesAnteriorCount = await Record.countDocuments({
        dataCriacaoIso: {
          $gte: mesAnterior.toISOString().split('T')[0],
          $lte: fimMesAnterior.toISOString().split('T')[0]
        }
      });

      if (mesAnteriorCount > 0) {
        const variacao = ((mesAtualCount - mesAnteriorCount) / mesAnteriorCount) * 100;
        if (Math.abs(variacao) > 20) {
          insights.push({
            tipo: 'variacao_significativa',
            nivel: variacao > 0 ? 'crescimento' : 'queda',
            valor: Math.abs(variacao).toFixed(1),
            descricao: variacao > 0
              ? `📈 Crescimento significativo de ${Math.abs(variacao).toFixed(1)}% em relação ao mês anterior`
              : `📉 Queda significativa de ${Math.abs(variacao).toFixed(1)}% em relação ao mês anterior`
          });
        }
      }

      // Insight 2: Protocolos vencidos
      const vencidos = await Record.countDocuments({
        prazoRestante: { $lt: 0 }
      });

      if (vencidos > 0) {
        const total = await Record.countDocuments({});
        const percentual = total > 0 ? ((vencidos / total) * 100).toFixed(1) : 0;
        if (percentual > 5) {
          insights.push({
            tipo: 'vencimentos_criticos',
            nivel: 'alerta',
            valor: vencidos,
            percentual: parseFloat(percentual),
            descricao: `⚠️ ${vencidos.toLocaleString('pt-BR')} protocolos vencidos (${percentual}% do total)`
          });
        }
      }

      // Insight 3: Tempo médio alto
      const tempoMedio = await Record.aggregate([
        { $match: { tempoDeResolucaoEmDias: { $ne: null, $ne: '' } } },
        { $project: { dias: { $toDouble: '$tempoDeResolucaoEmDias' } } },
        { $group: { _id: null, media: { $avg: '$dias' } } }
      ]);

      if (tempoMedio[0] && tempoMedio[0].media > 60) {
        insights.push({
          tipo: 'tempo_medio_alto',
          nivel: 'atencao',
          valor: tempoMedio[0].media.toFixed(1),
          descricao: `⏱️ Tempo médio de resolução alto: ${tempoMedio[0].media.toFixed(1)} dias`
        });
      }

      // Insight 4: Secretaria com mais demanda
      const topOrgao = await Record.aggregate([
        { $match: { orgaos: { $ne: null, $ne: '' } } },
        { $group: { _id: '$orgaos', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]);

      if (topOrgao[0]) {
        const total = await Record.countDocuments({});
        const percentual = total > 0 ? ((topOrgao[0].count / total) * 100).toFixed(1) : 0;
        if (percentual > 20) {
          insights.push({
            tipo: 'concentracao_demanda',
            nivel: 'info',
            valor: topOrgao[0].count,
            percentual: parseFloat(percentual),
            descricao: `🏛️ ${topOrgao[0]._id} concentra ${percentual}% das manifestações (${topOrgao[0].count.toLocaleString('pt-BR')})`
          });
        }
      }
    }

    if (context === 'zeladoria' || context === 'central') {
      // Insights específicos de zeladoria
      const total = await Zeladoria.countDocuments();
      const pendentes = await Zeladoria.countDocuments({
        status: { $in: ['pendente', 'em andamento', 'aberto'] }
      });

      if (total > 0) {
        const percentualPendentes = ((pendentes / total) * 100).toFixed(1);
        if (percentualPendentes > 30) {
          insights.push({
            tipo: 'pendentes_alto',
            nivel: 'atencao',
            valor: pendentes,
            percentual: parseFloat(percentualPendentes),
            descricao: `📋 ${percentualPendentes}% das ocorrências estão pendentes (${pendentes.toLocaleString('pt-BR')})`
          });
        }
      }
    }

  } catch (error) {
    logger.warn('Erro ao detectar insights:', error.message);
  }

  return insights;
}

/**
 * Formatar insights para exibição
 */
export function formatInsights(insights) {
  if (!insights || insights.length === 0) {
    return '';
  }

  const parts = ['\n💡 **INSIGHTS AUTOMÁTICOS:**\n'];

  insights.forEach((insight, index) => {
    parts.push(`${index + 1}. ${insight.descricao}`);
  });

  return parts.join('\n');
}

