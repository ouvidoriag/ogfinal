/**
 * Controllers de ESIC (e-SIC)
 * /api/esic/*
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import Esic from '../../models/Esic.model.js';
import { categorizarTiposPorAssunto, obterCategoriasDisponiveis } from '../../utils/esicCategorizador.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/esic/summary
 * Resumo geral de dados de ESIC
 */
export async function summary(req, res) {
  const cacheKey = 'esic:summary:v1';
  return withCache(cacheKey, 3600, res, async () => {
    const total = await Esic.countDocuments();

    const [statusCount, tipoInformacaoCount, responsavelCount, unidadeCount] = await Promise.all([
      Esic.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Esic.aggregate([
        { $group: { _id: '$tipoInformacao', count: { $sum: 1 } } }
      ]),
      Esic.aggregate([
        { $group: { _id: '$responsavel', count: { $sum: 1 } } }
      ]),
      Esic.aggregate([
        { $group: { _id: '$unidadeContato', count: { $sum: 1 } } }
      ])
    ]);

    return {
      total,
      porStatus: statusCount.map(s => ({ key: s._id || 'Não informado', count: s.count })),
      porTipoInformacao: tipoInformacaoCount.map(t => ({ key: t._id || 'Não informado', count: t.count })),
      porResponsavel: responsavelCount.map(r => ({ key: r._id || 'Não informado', count: r.count })),
      porUnidade: unidadeCount.map(u => ({ key: u._id || 'Não informado', count: u.count }))
    };
  });
}

/**
 * GET /api/esic/count-by
 * Contagem por campo
 */
export async function countBy(req, res) {
  const field = String(req.query.field ?? '').trim();
  if (!field) {
    return res.status(400).json({ error: 'field required' });
  }

  const cacheKey = `esic:countBy:${field}:v1`;
  return withCache(cacheKey, 3600, res, async () => {
    // Mapear campo para coluna normalizada
    const fieldMap = {
      'status': 'status',
      'tipoInformacao': 'tipoInformacao',
      'responsavel': 'responsavel',
      'unidadeContato': 'unidadeContato',
      'canal': 'canal',
      'prioridade': 'prioridade',
      'bairro': 'bairro',
      'escolaridade': 'escolaridade',
      'genero': 'genero',
      'raca': 'raca'
    };

    const col = fieldMap[field.toLowerCase()] || field.toLowerCase();

    try {
      const rows = await Esic.aggregate([
        { $group: { _id: `$${col}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      return rows
        .map(r => ({ key: r._id || 'Não informado', count: r.count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      // Fallback: agrega pelo JSON
      const rows = await Esic.find({})
        .select('data')
        .lean();

      const map = new Map();
      for (const r of rows) {
        const dat = r.data || {};
        const key = dat?.[field] ?? dat?.[field.toLowerCase()] ?? 'Não informado';
        const k = `${key}`;
        map.set(k, (map.get(k) ?? 0) + 1);
      }

      return Array.from(map.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
    }
  });
}

/**
 * GET /api/esic/by-month
 * Agregação por mês
 */
export async function byMonth(req, res) {
  const cacheKey = 'esic:byMonth:v1';
  return withCache(cacheKey, 3600, res, async () => {
    const rows = await Esic.find({
      dataCriacaoIso: { $ne: null }
    })
      .select('dataCriacaoIso')
      .lean();

    const map = new Map();
    for (const r of rows) {
      if (r.dataCriacaoIso) {
        const month = r.dataCriacaoIso.substring(0, 7); // YYYY-MM
        map.set(month, (map.get(month) || 0) + 1);
      }
    }

    return Array.from(map.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  });
}

/**
 * GET /api/esic/time-series
 * Série temporal
 */
export async function timeSeries(req, res) {
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  const cacheKey = `esic:timeSeries:${startDate || 'all'}:${endDate || 'all'}:v1`;
  return withCache(cacheKey, 3600, res, async () => {
    const filter = {
      dataCriacaoIso: { $ne: null }
    };

    if (startDate) filter.dataCriacaoIso.$gte = startDate;
    if (endDate) filter.dataCriacaoIso.$lte = endDate;

    const rows = await Esic.find(filter)
      .select('dataCriacaoIso')
      .lean();

    const map = new Map();
    for (const r of rows) {
      if (r.dataCriacaoIso) {
        map.set(r.dataCriacaoIso, (map.get(r.dataCriacaoIso) || 0) + 1);
      }
    }

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });
}

/**
 * GET /api/esic/records
 * Lista de registros com paginação
 */
export async function records(req, res) {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
  const skip = (page - 1) * limit;

  const status = req.query.status;
  const tipoInformacao = req.query.tipoInformacao;
  const responsavel = req.query.responsavel;
  const unidadeContato = req.query.unidadeContato;

  const filter = {};
  if (status) filter.status = status;
  if (tipoInformacao) filter.tipoInformacao = tipoInformacao;
  if (responsavel) filter.responsavel = responsavel;
  if (unidadeContato) filter.unidadeContato = unidadeContato;

  const cacheKey = `esic:records:${JSON.stringify(filter)}:${page}:${limit}:v1`;
  return withCache(cacheKey, 300, res, async () => {
    const [data, total] = await Promise.all([
      Esic.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Esic.countDocuments(filter)
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  });
}

/**
 * GET /api/esic/stats
 * Estatísticas gerais
 */
export async function stats(req, res) {
  const cacheKey = 'esic:stats:v1';
  return withCache(cacheKey, 3600, res, async () => {
    const [total, encerrados, emAberto, comPrazo] = await Promise.all([
      Esic.countDocuments(),
      Esic.countDocuments({ status: { $regex: /encerrada|fechada|arquivada/i } }),
      Esic.countDocuments({ status: { $not: { $regex: /encerrada|fechada|arquivada/i } } }),
      Esic.countDocuments({ prazo: { $ne: null, $ne: '' } })
    ]);

    // Tempo médio de resolução (apenas encerrados com datas)
    const encerradosComDatas = await Esic.find({
      status: { $regex: /encerrada|fechada|arquivada/i },
      dataCriacaoIso: { $ne: null },
      dataEncerramentoIso: { $ne: null }
    })
      .select('dataCriacaoIso dataEncerramentoIso')
      .lean();

    let tempoMedio = 0;
    if (encerradosComDatas.length > 0) {
      const tempos = encerradosComDatas.map(r => {
        const inicio = new Date(r.dataCriacaoIso);
        const fim = new Date(r.dataEncerramentoIso);
        return Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24)); // dias
      }).filter(t => t > 0);

      if (tempos.length > 0) {
        tempoMedio = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
      }
    }

    return {
      total,
      encerrados,
      emAberto,
      comPrazo,
      tempoMedioResolucao: tempoMedio,
      taxaResolucao: total > 0 ? Math.round((encerrados / total) * 100) : 0
    };
  });
}

/**
 * GET /api/esic/sla
 * Compliance com SLA (prazo)
 */
export async function sla(req, res) {
  const cacheKey = 'esic:sla:v1';
  return withCache(cacheKey, 3600, res, async () => {
    const encerradosComPrazo = await Esic.find({
      status: { $regex: /encerrada|fechada|arquivada/i },
      dataEncerramentoIso: { $ne: null },
      prazo: { $ne: null, $ne: '' }
    })
      .select('dataEncerramentoIso prazo')
      .lean();

    if (encerradosComPrazo.length === 0) {
      return { total: 0, noPrazo: 0, percentual: 0 };
    }

    let noPrazo = 0;
    for (const r of encerradosComPrazo) {
      const fim = new Date(r.dataEncerramentoIso);
      const prazo = new Date(r.prazo);
      if (fim <= prazo) noPrazo++;
    }

    return {
      total: encerradosComPrazo.length,
      noPrazo,
      percentual: Math.round((noPrazo / encerradosComPrazo.length) * 100)
    };
  });
}

/**
 * GET /api/esic/by-status-month
 * Status por mês
 */
export async function byStatusMonth(req, res) {
  const cacheKey = 'esic:byStatusMonth:v1';
  return withCache(cacheKey, 3600, res, async () => {
    const rows = await Esic.find({
      dataCriacaoIso: { $ne: null }
    })
      .select('status dataCriacaoIso')
      .lean();

    const map = new Map();
    for (const r of rows) {
      if (r.dataCriacaoIso) {
        const month = r.dataCriacaoIso.substring(0, 7);
        const key = `${month}|${r.status || 'Não informado'}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }

    const result = {};
    for (const [key, count] of map.entries()) {
      const [month, status] = key.split('|');
      if (!result[month]) result[month] = {};
      result[month][status] = count;
    }

    return result;
  });
}

/**
 * GET /api/esic/by-tipo-responsavel
 * Tipo de Informação por Responsável
 */
export async function byTipoResponsavel(req, res) {
  const cacheKey = 'esic:byTipoResponsavel:v1';
  return withCache(cacheKey, 3600, res, async () => {
    const rows = await Esic.aggregate([
      { $group: { _id: { tipoInformacao: '$tipoInformacao', responsavel: '$responsavel' }, count: { $sum: 1 } } }
    ]);

    const result = {};
    for (const r of rows) {
      const tipoInformacao = r._id.tipoInformacao || 'Não informado';
      const responsavel = r._id.responsavel || 'Não informado';

      if (!result[tipoInformacao]) result[tipoInformacao] = {};
      result[tipoInformacao][responsavel] = r.count;
    }

    return result;
  });
}

/**
 * GET /api/esic/by-canal-unidade
 * Canal por Unidade
 */
export async function byCanalUnidade(req, res) {
  const cacheKey = 'esic:byCanalUnidade:v1';
  return withCache(cacheKey, 3600, res, async () => {
    const rows = await Esic.aggregate([
      { $group: { _id: { canal: '$canal', unidadeContato: '$unidadeContato' }, count: { $sum: 1 } } }
    ]);

    const result = {};
    for (const r of rows) {
      const canal = r._id.canal || 'Não informado';
      const unidade = r._id.unidadeContato || 'Não informado';

      if (!result[canal]) result[canal] = {};
      result[canal][unidade] = r.count;
    }

    return result;
  });
}

/**
 * GET /api/esic/categorias-por-assunto
 * Categoriza tipos de pedidos de informação com base nos assuntos
 * 
 * Analisa especificacaoInformacao e detalhesSolicitacao para categorizar
 * cada tipoInformacao em categorias semânticas (Administrativa, Financeira, etc.)
 * 
 * Query params:
 * - limit: Limite de tipos de informação a processar (padrão: 50)
 * - tipoInformacao: Filtrar por um tipo específico
 */
export async function categoriasPorAssunto(req, res) {
  const limit = parseInt(req.query.limit || '50', 10);
  const tipoInformacaoFilter = req.query.tipoInformacao;

  const cacheKey = `esic:categoriasPorAssunto:${tipoInformacaoFilter || 'all'}:${limit}:v1`;
  return withCache(cacheKey, 7200, res, async () => {
    try {
      // Construir filtro
      const filter = {
        $or: [
          { especificacaoInformacao: { $exists: true, $ne: null, $ne: '' } },
          { detalhesSolicitacao: { $exists: true, $ne: null, $ne: '' } }
        ]
      };

      if (tipoInformacaoFilter) {
        filter.tipoInformacao = tipoInformacaoFilter;
      }

      // Buscar registros com especificação ou detalhes
      const registros = await Esic.find(filter)
        .select('tipoInformacao especificacaoInformacao detalhesSolicitacao')
        .limit(Math.min(limit * 10, 10000)) // Buscar mais registros para ter amostra representativa
        .lean();

      if (registros.length === 0) {
        return {
          tipos: [],
          totalRegistros: 0,
          categoriasDisponiveis: obterCategoriasDisponiveis(),
          mensagem: 'Nenhum registro encontrado com especificação ou detalhes'
        };
      }

      // Categorizar tipos por assunto
      const tiposCategorizados = await categorizarTiposPorAssunto(registros);

      // Limitar resultados
      const tiposLimitados = tiposCategorizados.slice(0, limit);

      // Calcular estatísticas gerais
      const totalRegistros = registros.length;
      const categoriasUtilizadas = new Set();
      tiposCategorizados.forEach(tipo => {
        tipo.categorias.forEach(cat => categoriasUtilizadas.add(cat.categoria));
      });

      return {
        tipos: tiposLimitados,
        totalRegistros,
        totalTipos: tiposCategorizados.length,
        categoriasDisponiveis: obterCategoriasDisponiveis(),
        categoriasUtilizadas: Array.from(categoriasUtilizadas).sort(),
        metadata: {
          registrosAnalisados: registros.length,
          limiteAplicado: limit,
          filtroTipoInformacao: tipoInformacaoFilter || null
        }
      };

    } catch (error) {
      logger.error('Erro ao categorizar tipos por assunto:', {
        message: error.message,
        stack: error.stack
      });

      throw error;
    }
  });
}

