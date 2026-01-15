/**
 * Controller para /api/summary
 * Summary KPIs e insights críticos
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import { getDataCriacao } from '../../utils/formatting/dateUtils.js';
import Record from '../../models/Record.model.js';
import { logger } from '../../utils/logger.js';

/**
 * Calcular últimos 7 e 30 dias usando agregações otimizadas do banco
 * OTIMIZADO: Usa count com filtros de data em vez de buscar todos os registros
 */
async function calculateLastDays(filter, todayStr, last7Str, last30Str) {
  let last7 = 0;
  let last30 = 0;

  try {
    // OTIMIZAÇÃO: Usar count com filtro de dataCriacaoIso (campo indexado)
    // Isso é muito mais rápido que buscar todos os registros e processar em memória

    // Contar últimos 7 dias
    const filterLast7 = {
      ...filter,
      dataCriacaoIso: {
        $gte: last7Str,
        $lte: todayStr
      }
    };

    // Contar últimos 30 dias
    const filterLast30 = {
      ...filter,
      dataCriacaoIso: {
        $gte: last30Str,
        $lte: todayStr
      }
    };

    // Executar contagens em paralelo
    [last7, last30] = await Promise.all([
      Record.countDocuments(filterLast7),
      Record.countDocuments(filterLast30)
    ]);

    // Se dataCriacaoIso não estiver disponível para todos, fazer fallback
    // Verificar se os resultados fazem sentido (não podem ser zero se há registros recentes)
    const totalRecent = await Record.countDocuments({
      ...filter,
      $or: [
        { dataCriacaoIso: { $ne: null } },
        { dataDaCriacao: { $ne: null } }
      ]
    });

    // Se houver registros recentes mas contagem deu zero, usar fallback
    if (totalRecent > 0 && last7 === 0 && last30 === 0) {
      logger.warn('dataCriacaoIso não disponível para todos, usando fallback...');
      // Fallback: buscar apenas registros recentes (últimos 30 dias) e processar
      const recentRecords = await Record.find({
        ...filter,
        $or: [
          { dataCriacaoIso: { $gte: last30Str } },
          { dataDaCriacao: { $regex: todayStr.substring(0, 7) } } // Mês atual
        ]
      })
        .select('dataCriacaoIso dataDaCriacao')
        .limit(20000)
        .lean();

      for (const r of recentRecords) {
        const dataCriacao = getDataCriacao(r);
        if (!dataCriacao) continue;

        if (dataCriacao >= last7Str && dataCriacao <= todayStr) {
          last7++;
        }
        if (dataCriacao >= last30Str && dataCriacao <= todayStr) {
          last30++;
        }
      }
    }

    logger.debug(`Resultado otimizado: últimos 7 dias=${last7}, últimos 30 dias=${last30}`);
  } catch (error) {
    logger.error('Erro ao calcular últimos 7 e 30 dias:', { error: error.message });
    last7 = 0;
    last30 = 0;
  }

  return { last7, last30 };
}

/**
 * Obter top dimensões
 */
async function getTopDimensions(filter) {
  const top = async (col) => {
    const pipeline = [
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      { $group: { _id: `$${col}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ];

    const rows = await Record.aggregate(pipeline);
    return rows.map(r => ({ key: r._id ?? 'Não informado', count: r.count }));
  };

  const [topOrgaos, topUnidadeCadastro, topTipoManifestacao, topTema] = await Promise.all([
    top('orgaos'),
    top('unidadeCadastro'),
    top('tipoDeManifestacao'),
    top('tema')
  ]);

  return { topOrgaos, topUnidadeCadastro, topTipoManifestacao, topTema };
}

/**
 * GET /api/summary
 */
export async function getSummary(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const key = servidor ? `summary:servidor:${servidor}:v2` :
    unidadeCadastro ? `summary:uac:${unidadeCadastro}:v2` :
      'summary:v2';

  // Cache de 1 hora para dados que mudam pouco
  return withCache(key, 3600, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // Totais
    const total = await Record.countDocuments(filter);

    // Por status (normalizado)
    const byStatusPipeline = [
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];

    const byStatus = await Record.aggregate(byStatusPipeline);
    const statusCounts = byStatus.map(r => ({ status: r._id ?? 'Não informado', count: r.count }))
      .sort((a, b) => b.count - a.count);

    // Últimos 7 e 30 dias - OTIMIZADO: usar agregação no banco
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const d7 = new Date(today);
    d7.setDate(today.getDate() - 6);
    const last7Str = d7.toISOString().slice(0, 10);
    const d30 = new Date(today);
    d30.setDate(today.getDate() - 29);
    const last30Str = d30.toISOString().slice(0, 10);

    logger.debug(`Calculando últimos 7 e 30 dias: hoje=${todayStr}, últimos 7 dias de ${last7Str} até ${todayStr}, últimos 30 dias de ${last30Str} até ${todayStr}`);

    const { last7, last30 } = await calculateLastDays(filter, todayStr, last7Str, last30Str);

    // Top dimensões normalizadas
    const { topOrgaos, topUnidadeCadastro, topTipoManifestacao, topTema } = await getTopDimensions(filter);

    return { total, last7, last30, statusCounts, topOrgaos, topUnidadeCadastro, topTipoManifestacao, topTema };
  });
}
