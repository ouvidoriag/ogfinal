/**
 * Controllers de Estatísticas
 * /api/stats/*
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import { getDateFilter } from '../../utils/queryOptimizer.js';
import { getDataCriacao, getTempoResolucaoEmDias, isConcluido, addMesFilterMongo } from '../../utils/formatting/dateUtils.js';
import Record from '../../models/Record.model.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/stats/average-time
 * Tempo médio de atendimento por órgão/unidade
 */
export async function averageTime(req, res) {
  const meses = req.query.meses ? (Array.isArray(req.query.meses) ? req.query.meses : [req.query.meses]) : null;
  const apenasConcluidos = req.query.apenasConcluidos === 'true';
  const incluirZero = req.query.incluirZero !== 'false';
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const mesesKey = meses && meses.length > 0
    ? `:meses:${meses.slice().sort().join(',')}`
    : '';
  const keyBase = servidor
    ? `avgTime:servidor:${servidor}`
    : unidadeCadastro
      ? `avgTime:uac:${unidadeCadastro}`
      : 'avgTime';
  const key = `${keyBase}${mesesKey}:v3`;

  // Cache de 5 horas para estatísticas pesadas (average-time)
  return withCache(key, 18000, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // Filtrar apenas últimos 24 meses por padrão
    const today = new Date();
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setMonth(today.getMonth() - 24);
    const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

    // Construir filtro de data baseado nos meses selecionados
    if (meses && meses.length > 0) {
      addMesFilterMongo(filter, meses);
    } else {
      // Se não há filtro de meses, adicionar filtro de últimos 24 meses
      filter.$or = [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: today.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (today.getFullYear() - 1).toString() } }
      ];
    }

    filter.dataDaCriacao = { $ne: null };

    // Buscar apenas registros com dados necessários (limitar para evitar timeout)
    const rows = await Record.find(filter)
      .select('orgaos responsavel unidadeCadastro tempoDeResolucaoEmDias dataCriacaoIso dataDaCriacao dataConclusaoIso dataDaConclusao')
      .limit(20000)
      .lean();

    // Agrupar por órgão/unidade e calcular média
    const map = new Map();
    for (const r of rows) {
      const org = r.orgaos || r.responsavel || r.unidadeCadastro || 'Não informado';

      if (apenasConcluidos && !isConcluido(r)) {
        continue;
      }

      const days = getTempoResolucaoEmDias(r, incluirZero);
      if (days === null) continue;

      if (!map.has(org)) map.set(org, { total: 0, sum: 0 });
      const stats = map.get(org);
      stats.total += 1;
      stats.sum += days;
    }

    // Calcular médias e retornar ordenado
    const result = Array.from(map.entries())
      .map(([org, stats]) => ({
        org,
        unit: org, // Compatibilidade com frontend
        dias: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0,
        average: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        media: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        quantidade: stats.total
      }))
      .filter(item => item.dias > 0)
      .sort((a, b) => b.dias - a.dias);

    return result;
  }, null, 60000); // Timeout de 60s para endpoint pesado
}

/**
 * GET /api/stats/average-time/by-day
 * Tempo médio por dia (últimos 30 dias)
 */
export async function averageTimeByDay(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;
  const meses = req.query.meses ? (Array.isArray(req.query.meses) ? req.query.meses : [req.query.meses]) : null;
  const apenasConcluidos = req.query.apenasConcluidos === 'true';
  const incluirZero = req.query.incluirZero !== 'false';

  const key = servidor ? `avgTimeByDay:servidor:${servidor}:v4` :
    unidadeCadastro ? `avgTimeByDay:uac:${unidadeCadastro}:v4` :
      meses ? `avgTimeByDay:meses:${meses.sort().join(',')}:v4` :
        'avgTimeByDay:v4';

  // Cache de 5 horas para estatísticas diárias
  return withCache(key, 18000, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // Aplicar filtro de mês se fornecido
    if (meses && meses.length > 0) {
      addMesFilterMongo(filter, meses);
    } else {
      // Filtrar apenas últimos 24 meses se não houver filtro específico
      const todayForFilter = new Date();
      const twoYearsAgo = new Date(todayForFilter);
      twoYearsAgo.setMonth(todayForFilter.getMonth() - 24);
      const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

      filter.$or = [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: todayForFilter.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (todayForFilter.getFullYear() - 1).toString() } }
      ];
    }

    filter.dataDaCriacao = { $ne: null };

    const rows = await Record.find(filter)
      .select('dataCriacaoIso dataDaCriacao tempoDeResolucaoEmDias dataConclusaoIso dataDaConclusao')
      .limit(20000)
      .lean();

    const map = new Map();
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);
    const minDateForProcessing = ninetyDaysAgo.toISOString().slice(0, 10);

    for (const r of rows) {
      const dataCriacao = getDataCriacao(r);
      if (!dataCriacao || dataCriacao < minDateForProcessing) continue;

      if (apenasConcluidos && !isConcluido(r)) continue;

      const days = getTempoResolucaoEmDias(r, incluirZero);
      if (days === null) continue;

      if (!map.has(dataCriacao)) map.set(dataCriacao, { total: 0, sum: 0 });
      const stats = map.get(dataCriacao);
      stats.total += 1;
      stats.sum += days;
    }

    // Gerar últimos 30 dias
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const stats = map.get(dateKey) || { total: 0, sum: 0 };
      result.push({
        date: dateKey,
        _id: dateKey, // Compatibilidade
        dias: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0,
        average: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        media: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        quantidade: stats.total
      });
    }

    return result;
  }, null, 60000); // Timeout de 60s para endpoint pesado
}

/**
 * GET /api/stats/average-time/by-week
 * Tempo médio por semana (últimas 12 semanas)
 */
export async function averageTimeByWeek(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;
  const meses = req.query.meses ? (Array.isArray(req.query.meses) ? req.query.meses : [req.query.meses]) : null;
  const apenasConcluidos = req.query.apenasConcluidos === 'true';
  const incluirZero = req.query.incluirZero !== 'false';

  const key = servidor ? `avgTimeByWeek:servidor:${servidor}:v4` :
    unidadeCadastro ? `avgTimeByWeek:uac:${unidadeCadastro}:v4` :
      meses ? `avgTimeByWeek:meses:${meses.sort().join(',')}:v4` :
        'avgTimeByWeek:v4';

  // Cache de 5 horas para estatísticas semanais
  return withCache(key, 18000, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // Aplicar filtro de mês se fornecido
    if (meses && meses.length > 0) {
      addMesFilterMongo(filter, meses);
    } else {
      // Filtrar apenas últimos 24 meses se não houver filtro específico
      const todayForFilter = new Date();
      const twoYearsAgo = new Date(todayForFilter);
      twoYearsAgo.setMonth(todayForFilter.getMonth() - 24);
      const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

      filter.$or = [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: todayForFilter.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (todayForFilter.getFullYear() - 1).toString() } }
      ];
    }

    filter.dataDaCriacao = { $ne: null };

    const rows = await Record.find(filter)
      .select('dataCriacaoIso dataDaCriacao tempoDeResolucaoEmDias dataConclusaoIso dataDaConclusao')
      .limit(20000)
      .lean();

    // Função para obter semana ISO (YYYY-Www) - implementação simplificada e robusta
    function getISOWeek(dateStr) {
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr + 'T12:00:00');
        if (isNaN(date.getTime())) return null;

        // Calcular semana ISO 8601
        // A semana ISO começa na segunda-feira (dia 1)
        const d = new Date(date);
        const day = d.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
        const dayOfWeek = day === 0 ? 7 : day; // Converter domingo de 0 para 7

        // Mover para a quinta-feira da semana atual (dia 4)
        const thursday = new Date(d);
        thursday.setDate(d.getDate() + (4 - dayOfWeek));

        // Calcular número da semana baseado na quinta-feira
        const year = thursday.getFullYear();
        const jan1 = new Date(year, 0, 1);
        const jan1Day = jan1.getDay() || 7; // Converter domingo para 7

        // Encontrar a primeira quinta-feira do ano
        let firstThursday = new Date(jan1);
        if (jan1Day <= 4) {
          // Se 1º de janeiro é segunda a quinta, a primeira semana já começou
          firstThursday.setDate(1 + (4 - jan1Day));
        } else {
          // Se 1º de janeiro é sexta, sábado ou domingo, a primeira semana começa na próxima segunda
          firstThursday.setDate(1 + (7 - jan1Day + 4));
        }

        // Calcular diferença em dias
        const diffTime = thursday - firstThursday;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const weekNo = Math.floor(diffDays / 7) + 1;

        // Garantir que a semana está no intervalo válido (1-53)
        const validWeekNo = Math.max(1, Math.min(53, weekNo));

        // Formato: YYYY-Www
        return `${year}-W${String(validWeekNo).padStart(2, '0')}`;
      } catch (e) {
        console.error('Erro ao calcular semana ISO:', e, dateStr);
        return null;
      }
    }

    const map = new Map();
    const today = new Date();
    // Aumentar o range para garantir que capturemos todas as últimas 12 semanas
    // 12 semanas = 84 dias, mas vamos usar 100 dias para garantir margem
    const hundredDaysAgo = new Date(today);
    hundredDaysAgo.setDate(today.getDate() - 100);
    const minDateForProcessing = hundredDaysAgo.toISOString().slice(0, 10);

    let processedCount = 0;
    for (const r of rows) {
      const dataCriacao = getDataCriacao(r);
      if (!dataCriacao) continue;

      // Filtrar apenas registros das últimas 100 dias (últimas 12 semanas + margem)
      if (dataCriacao < minDateForProcessing) continue;

      if (apenasConcluidos && !isConcluido(r)) continue;

      const days = getTempoResolucaoEmDias(r, incluirZero);
      if (days === null) continue;

      const week = getISOWeek(dataCriacao);
      if (!week) {
        logger.warn('Semana ISO não calculada para data:', { dataCriacao });
        continue;
      }

      if (!map.has(week)) map.set(week, { total: 0, sum: 0 });
      const stats = map.get(week);
      stats.total += 1;
      stats.sum += days;
      processedCount++;
    }

    logger.debug(`averageTimeByWeek: Processados ${processedCount} registros válidos de ${rows.length} totais. Semanas encontradas: ${map.size}`);

    // Gerar últimas 12 semanas (garantir que todas as semanas apareçam)
    const result = [];
    const weekSet = new Set();

    // Primeiro, adicionar todas as semanas encontradas nos dados
    for (const week of map.keys()) {
      weekSet.add(week);
    }

    // Depois, adicionar as últimas 12 semanas mesmo que não tenham dados
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - (i * 7));
      const week = getISOWeek(d.toISOString().slice(0, 10));
      if (week) {
        weekSet.add(week);
      }
    }

    // Converter para array e ordenar
    const weeks = Array.from(weekSet).sort().slice(-12);

    // Log para debug
    if (weeks.length === 0) {
      logger.warn('averageTimeByWeek: Nenhuma semana encontrada', { totalProcessed: rows.length });
    }

    // Criar resultado com todas as semanas
    for (const week of weeks) {
      const stats = map.get(week) || { total: 0, sum: 0 };
      result.push({
        week,
        _id: week, // Compatibilidade
        dias: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0,
        average: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        media: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        quantidade: stats.total
      });
    }

    // Log final para debug
    logger.debug(`averageTimeByWeek: Retornando ${result.length} semanas`, {
      primeira: result[0]?.week,
      ultima: result[result.length - 1]?.week
    });

    return result;
  }, null, 60000); // Timeout de 60s para endpoint pesado
}

/**
 * GET /api/stats/average-time/by-month
 * Tempo médio por mês
 */
export async function averageTimeByMonth(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;
  const apenasConcluidos = req.query.apenasConcluidos === 'true';
  const incluirZero = req.query.incluirZero !== 'false';

  const key = servidor ? `avgTimeByMonth:servidor:${servidor}:v3` :
    unidadeCadastro ? `avgTimeByMonth:uac:${unidadeCadastro}:v3` :
      'avgTimeByMonth:v3';

  // Cache de 5 horas para estatísticas mensais
  return withCache(key, 18000, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    filter.dataDaCriacao = { $ne: null };

    const rows = await Record.find(filter)
      .select('dataCriacaoIso dataDaCriacao tempoDeResolucaoEmDias dataConclusaoIso dataDaConclusao')
      .limit(20000)
      .lean();

    const map = new Map();
    for (const r of rows) {
      const mes = getDataCriacao(r)?.slice(0, 7); // YYYY-MM
      if (!mes) continue;

      if (apenasConcluidos && !isConcluido(r)) continue;

      const days = getTempoResolucaoEmDias(r, incluirZero);
      if (days === null) continue;

      if (!map.has(mes)) map.set(mes, { total: 0, sum: 0 });
      const stats = map.get(mes);
      stats.total += 1;
      stats.sum += days;
    }

    return Array.from(map.entries())
      .map(([month, stats]) => ({
        month,
        ym: month, // Compatibilidade
        dias: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0,
        average: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        media: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        quantidade: stats.total
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, null, 60000); // Timeout de 60s para endpoint pesado
}

/**
 * GET /api/stats/average-time/stats
 * Estatísticas gerais de tempo (média, mediana, min, max)
 */
export async function averageTimeStats(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;
  const meses = req.query.meses ? (Array.isArray(req.query.meses) ? req.query.meses : [req.query.meses]) : null;
  const apenasConcluidos = req.query.apenasConcluidos === 'true';
  const incluirZero = req.query.incluirZero !== 'false';

  const mesesKey = meses && meses.length > 0
    ? `:meses:${meses.slice().sort().join(',')}`
    : '';
  const keyBase = servidor
    ? `avgTimeStats:servidor:${servidor}`
    : unidadeCadastro
      ? `avgTimeStats:uac:${unidadeCadastro}`
      : 'avgTimeStats';
  const key = `${keyBase}${mesesKey}:v2`;

  // Cache de 5 horas para estatísticas agregadas
  return withCache(key, 18000, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    if (meses && meses.length > 0) {
      addMesFilterMongo(filter, meses);
    }

    filter.dataDaCriacao = { $ne: null };

    const rows = await Record.find(filter)
      .select('tempoDeResolucaoEmDias dataCriacaoIso dataDaCriacao dataConclusaoIso dataDaConclusao')
      .limit(20000)
      .lean();

    const days = [];
    for (const r of rows) {
      if (apenasConcluidos && !isConcluido(r)) continue;

      const d = getTempoResolucaoEmDias(r, incluirZero);
      if (d !== null && d > 0) {
        days.push(d);
      }
    }

    if (days.length === 0) {
      return { media: 0, mediana: 0, minimo: 0, maximo: 0, total: 0 };
    }

    days.sort((a, b) => a - b);
    const media = days.reduce((a, b) => a + b, 0) / days.length;
    const mediana = days.length % 2 === 0
      ? (days[days.length / 2 - 1] + days[days.length / 2]) / 2
      : days[Math.floor(days.length / 2)];
    const minimo = days[0];
    const maximo = days[days.length - 1];

    return {
      media: Number(media.toFixed(2)),
      mediana: Number(mediana.toFixed(2)),
      minimo,
      maximo,
      total: days.length
    };
  }, null, 60000); // Timeout de 60s para endpoint pesado
}

/**
 * GET /api/stats/average-time/by-unit
 * Tempo médio por unidade de cadastro
 */
export async function averageTimeByUnit(req, res) {
  const meses = req.query.meses ? (Array.isArray(req.query.meses) ? req.query.meses : [req.query.meses]) : null;
  const apenasConcluidos = req.query.apenasConcluidos === 'true';
  const incluirZero = req.query.incluirZero !== 'false';

  const key = meses ? `avgTimeByUnit:meses:${meses.sort().join(',')}:v2` : 'avgTimeByUnit:v2';

  // Cache de 5 horas para estatísticas por unidade
  return withCache(key, 18000, res, async () => {
    const filter = {};
    if (meses && meses.length > 0) {
      addMesFilterMongo(filter, meses);
    }

    filter.dataDaCriacao = { $ne: null };
    filter.unidadeCadastro = { $ne: null };

    const rows = await Record.find(filter)
      .select('unidadeCadastro tempoDeResolucaoEmDias dataCriacaoIso dataDaCriacao dataConclusaoIso dataDaConclusao')
      .limit(20000)
      .lean();

    const map = new Map();
    for (const r of rows) {
      const unit = r.unidadeCadastro || 'Não informado';

      if (apenasConcluidos && !isConcluido(r)) continue;

      const days = getTempoResolucaoEmDias(r, incluirZero);
      if (days === null) continue;

      if (!map.has(unit)) map.set(unit, { total: 0, sum: 0 });
      const stats = map.get(unit);
      stats.total += 1;
      stats.sum += days;
    }

    return Array.from(map.entries())
      .map(([unit, stats]) => ({
        unit,
        org: unit, // Compatibilidade
        _id: unit, // Compatibilidade
        dias: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0,
        average: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        media: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
        quantidade: stats.total
      }))
      .filter(item => item.dias > 0)
      .sort((a, b) => b.dias - a.dias);
  }, null, 60000); // Timeout de 60s para endpoint pesado
}

/**
 * GET /api/stats/average-time/by-month-unit
 * Tempo médio por mês e unidade
 */
export async function averageTimeByMonthUnit(req, res) {
  const meses = req.query.meses ? (Array.isArray(req.query.meses) ? req.query.meses : [req.query.meses]) : null;
  const apenasConcluidos = req.query.apenasConcluidos === 'true';
  const incluirZero = req.query.incluirZero !== 'false';

  const key = meses ? `avgTimeByMonthUnit:meses:${meses.sort().join(',')}:v2` : 'avgTimeByMonthUnit:v2';

  // Cache de 5 horas para estatísticas por mês/unidade
  return withCache(key, 18000, res, async () => {
    // Construir filtro MongoDB diretamente
    const filter = {
      dataDaCriacao: { $ne: null },
      unidadeCadastro: { $ne: null }
    };

    // Adicionar filtros de mês se existirem
    if (meses && meses.length > 0) {
      const monthFilters = meses.map(month => {
        // Se já está em formato YYYY-MM, usar diretamente
        if (/^\d{4}-\d{2}$/.test(month)) return month;
        // Se está em formato MM/YYYY, converter
        const match = month.match(/^(\d{2})\/(\d{4})$/);
        if (match) return `${match[2]}-${match[1]}`;
        return month;
      });

      // Criar filtro OR para qualquer um dos meses usando regex
      filter.$or = monthFilters.map(month => ({
        dataDaCriacao: { $regex: `^${month}`, $options: 'i' }
      }));
    }

    const rows = await Record.find(filter)
      .select('unidadeCadastro dataCriacaoIso dataDaCriacao tempoDeResolucaoEmDias dataConclusaoIso dataDaConclusao')
      .limit(20000) // OTIMIZAÇÃO: Reduzido de 50000 para 20000 para melhor performance
      .lean();

    const map = new Map();
    for (const r of rows) {
      const unit = r.unidadeCadastro || 'Não informado';
      const mes = getDataCriacao(r)?.slice(0, 7);
      if (!mes) continue;

      if (apenasConcluidos && !isConcluido(r)) continue;

      const days = getTempoResolucaoEmDias(r, incluirZero);
      if (days === null) continue;

      const key = `${unit}|${mes}`;
      if (!map.has(key)) map.set(key, { total: 0, sum: 0 });
      const stats = map.get(key);
      stats.total += 1;
      stats.sum += days;
    }

    return Array.from(map.entries())
      .map(([key, stats]) => {
        const [unit, month] = key.split('|');
        return {
          unit,
          month,
          ym: month, // Compatibilidade
          dias: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0,
          average: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
          media: stats.total > 0 ? Number((stats.sum / stats.total).toFixed(2)) : 0, // Compatibilidade
          quantidade: stats.total
        };
      })
      .sort((a, b) => {
        if (a.month !== b.month) return a.month.localeCompare(b.month);
        return a.unit.localeCompare(b.unit);
      });
  }, null, 60000); // Timeout de 60s para endpoint pesado
}

/**
 * GET /api/stats/status-overview
 * Visão geral de status (percentuais)
 * OTIMIZAÇÃO: Usa pipeline MongoDB nativo com cache inteligente
 */
export async function statusOverview(req, res, getMongoClient) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const key = servidor ? `statusOverview:servidor:${servidor}:v2` :
    unidadeCadastro ? `statusOverview:uac:${unidadeCadastro}:v2` :
      'statusOverview:v2';

  // REFATORAÇÃO FASE 4: Remover cache duplo - usar APENAS withSmartCache para filtros dinâmicos
  // Não usar withCache() + withSmartCache() (cache duplo)
  const filter = {};
  if (servidor) filter.servidor = servidor;
  if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

  const total = await Record.countDocuments(filter);

  // Construir filtros para pipeline
  const filters = {};
  if (servidor) filters.servidor = servidor;
  if (unidadeCadastro) filters.unidadeCadastro = unidadeCadastro;

  try {
    // Usar pipeline MongoDB nativo com Mongoose (único cache)
    let statusGroups;
    if (getMongoClient) {
      const { executeAggregation } = await import('../../utils/dbAggregations.js');
      const { buildStatusPipeline } = await import('../../utils/pipelines/index.js');
      const { formatGroupByResult } = await import('../../utils/formatting/dataFormatter.js');
      const { sanitizeFilters } = await import('../../utils/filters/validateFilters.js');
      const { withSmartCache } = await import('../../utils/cache/smartCache.js');

      const sanitizedFilters = sanitizeFilters(filters);

      statusGroups = await withSmartCache(
        'status',
        sanitizedFilters,
        async () => {
          const pipeline = buildStatusPipeline(sanitizedFilters);
          const result = await executeAggregation(getMongoClient, pipeline);
          return formatGroupByResult(result, '_id', 'count');
        },
        null,
        [] // Fallback seguro
      );
    } else {
      // Fallback para Mongoose aggregation
      const pipeline = [
        ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ];

      const rows = await Record.aggregate(pipeline);
      statusGroups = rows.map(r => ({
        key: r._id ?? 'Não informado',
        count: r.count,
        _id: r._id ?? 'Não informado'
      }));
    }

    let concluidas = 0;
    let emAtendimento = 0;

    for (const group of statusGroups) {
      const statusValue = group.key || group.status || group._id || '';
      const status = `${statusValue}`.toLowerCase();

      if (status.includes('concluída') || status.includes('concluida') ||
        status.includes('encerrada') || status.includes('arquivamento') ||
        status.includes('resposta final')) {
        concluidas += group.count || group.value || group._count?._all || 0;
      } else if (status.includes('em atendimento') || status.includes('aberto') ||
        status.includes('pendente') || status.includes('análise') ||
        status.includes('departamento') || status.includes('ouvidoria') ||
        status.length > 0) {
        emAtendimento += group.count || group.value || group._count?._all || 0;
      }
    }

    const totalCount = total || 0;

    const result = {
      total: totalCount,
      concluida: {
        quantidade: concluidas,
        percentual: totalCount > 0 ? Number(((concluidas / totalCount) * 100).toFixed(1)) : 0
      },
      emAtendimento: {
        quantidade: emAtendimento,
        percentual: totalCount > 0 ? Number(((emAtendimento / totalCount) * 100).toFixed(1)) : 0
      }
    };
    return res.json(result);
  } catch (error) {
    try {
      // Fallback
      const allRecords = await Record.find(Object.keys(filter).length > 0 ? filter : {})
        .select('status statusDemanda')
        .lean();

      let concluidas = 0;
      let emAtendimento = 0;

      for (const r of allRecords) {
        const statusValue = r.status || r.statusDemanda || '';
        const status = `${statusValue}`.toLowerCase();

        if (status.includes('concluída') || status.includes('concluida') ||
          status.includes('encerrada') || status.includes('arquivamento') ||
          status.includes('resposta final')) {
          concluidas++;
        } else if (status.includes('em atendimento') || status.includes('aberto') ||
          status.includes('pendente') || status.includes('análise') ||
          status.includes('departamento') || status.includes('ouvidoria') ||
          status.length > 0) {
          emAtendimento++;
        }
      }

      const totalCount = total || 0;

      const result = {
        total: totalCount,
        concluida: {
          quantidade: concluidas,
          percentual: totalCount > 0 ? Number(((concluidas / totalCount) * 100).toFixed(1)) : 0
        },
        emAtendimento: {
          quantidade: emAtendimento,
          percentual: totalCount > 0 ? Number(((emAtendimento / totalCount) * 100).toFixed(1)) : 0
        }
      };
      return res.json(result);
    } catch (fallbackError) {
      logger.error('Erro ao buscar status overview:', { error: fallbackError.message });
      return res.status(500).json({
        error: 'Erro interno do servidor',
        message: fallbackError.message
      });
    }
  }
}

