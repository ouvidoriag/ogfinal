/**
 * Controller do Painel Central
 * Endpoints para dados consolidados de todos os sistemas
 * 
 * CÉREBRO X-3
 */

import Record from '../../models/Record.model.js';
import Zeladoria from '../../models/Zeladoria.model.js';
import Esic from '../../models/Esic.model.js';
import { logger } from '../../utils/logger.js';
import { withCache } from '../../utils/formatting/responseHelper.js';

/**
 * GET /api/central/dashboard
 * Dashboard principal com dados consolidados
 */
export async function getDashboard(req, res) {
  const key = 'central:dashboard:v2';

  return withCache(key, 300, res, async () => {
    try {
      // ============================================
      // 1. TOTAIS E CONTAGENS BÁSICAS
      // ============================================
      const [zeladoriaTotal, ouvidoriaTotal, esicTotal] = await Promise.all([
        Zeladoria.countDocuments(),
        Record.countDocuments(),
        Esic.countDocuments()
      ]);

      const totalDemandas = zeladoriaTotal + ouvidoriaTotal + esicTotal;

      // ============================================
      // 2. STATUS E EM ATENDIMENTO
      // ============================================
      const [zeladoriaEmAtendimento, ouvidoriaEmAtendimento, esicEmAtendimento] = await Promise.all([
        Zeladoria.countDocuments({
          status: { $nin: ['CONCLUÍDO', 'CONCLUIDO', 'FECHADO', 'RESOLVIDO'] }
        }),
        Record.countDocuments({
          status: { $nin: ['CONCLUÍDO', 'CONCLUIDO', 'FECHADO', 'RESOLVIDO'] }
        }),
        Esic.countDocuments({
          status: { $nin: ['CONCLUÍDO', 'CONCLUIDO', 'FECHADO', 'RESOLVIDO'] }
        })
      ]);

      // ============================================
      // 3. TEMPO MÉDIO DE RESOLUÇÃO
      // ============================================
      // Zeladoria - usar mesma abordagem do zeladoriaController
      const fechadosZeladoria = await Zeladoria.find({
        status: { $in: ['FECHADO', 'CONCLUÍDO', 'CONCLUIDO', 'RESOLVIDO'] },
        dataCriacaoIso: { $ne: null, $exists: true },
        dataConclusaoIso: { $ne: null, $exists: true }
      })
        .select('dataCriacaoIso dataConclusaoIso')
        .limit(10000)
        .lean();

      let tempoMedioZeladoria = 0;
      if (fechadosZeladoria.length > 0) {
        const tempos = fechadosZeladoria
          .map(r => {
            try {
              const inicio = new Date(r.dataCriacaoIso + 'T00:00:00');
              const fim = new Date(r.dataConclusaoIso + 'T00:00:00');
              if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
                const dias = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24));
                return dias > 0 ? dias : null;
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
            return null;
          })
          .filter(t => t !== null && t > 0 && t < 1000);

        if (tempos.length > 0) {
          tempoMedioZeladoria = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
        }
      }

      // Ouvidoria - usar tempoDeResolucaoEmDias se disponível, senão calcular de datas
      const fechadosOuvidoria = await Record.find({
        status: { $in: ['CONCLUÍDO', 'CONCLUIDO', 'FECHADO', 'RESOLVIDO'] },
        $or: [
          { tempoDeResolucaoEmDias: { $exists: true, $ne: null } },
          { dataCriacaoIso: { $ne: null, $exists: true }, dataConclusaoIso: { $ne: null, $exists: true } }
        ]
      })
        .select('tempoDeResolucaoEmDias dataCriacaoIso dataConclusaoIso')
        .limit(10000)
        .lean();

      let tempoMedioOuvidoria = 0;
      if (fechadosOuvidoria.length > 0) {
        const tempos = fechadosOuvidoria
          .map(r => {
            // Prioridade: usar tempoDeResolucaoEmDias se for número válido
            if (r.tempoDeResolucaoEmDias) {
              const parsed = parseFloat(String(r.tempoDeResolucaoEmDias));
              if (!isNaN(parsed) && parsed > 0 && parsed < 1000) {
                return parsed;
              }
            }
            // Fallback: calcular de datas
            if (r.dataCriacaoIso && r.dataConclusaoIso) {
              try {
                const inicio = new Date(r.dataCriacaoIso + 'T00:00:00');
                const fim = new Date(r.dataConclusaoIso + 'T00:00:00');
                if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
                  const dias = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24));
                  return dias > 0 ? dias : null;
                }
              } catch (e) {
                // Ignorar erros
              }
            }
            return null;
          })
          .filter(t => t !== null && t > 0 && t < 1000);

        if (tempos.length > 0) {
          tempoMedioOuvidoria = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
        }
      }

      // E-SIC - similar
      const fechadosEsic = await Esic.find({
        status: { $in: ['CONCLUÍDO', 'CONCLUIDO', 'FECHADO', 'RESOLVIDO'] },
        $or: [
          { tempoResolucao: { $exists: true, $ne: null } },
          { dataCriacaoIso: { $ne: null, $exists: true }, dataConclusaoIso: { $ne: null, $exists: true } }
        ]
      })
        .select('tempoResolucao dataCriacaoIso dataConclusaoIso')
        .limit(10000)
        .lean();

      let tempoMedioEsic = 0;
      if (fechadosEsic.length > 0) {
        const tempos = fechadosEsic
          .map(r => {
            if (r.tempoResolucao && typeof r.tempoResolucao === 'number') {
              return r.tempoResolucao > 0 && r.tempoResolucao < 1000 ? r.tempoResolucao : null;
            }
            if (r.dataCriacaoIso && r.dataConclusaoIso) {
              try {
                const inicio = new Date(r.dataCriacaoIso + 'T00:00:00');
                const fim = new Date(r.dataConclusaoIso + 'T00:00:00');
                if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
                  const dias = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24));
                  return dias > 0 ? dias : null;
                }
              } catch (e) {
                // Ignorar
              }
            }
            return null;
          })
          .filter(t => t !== null && t > 0 && t < 1000);

        if (tempos.length > 0) {
          tempoMedioEsic = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
        }
      }

      // Tempo médio consolidado
      const tempos = [tempoMedioZeladoria, tempoMedioOuvidoria, tempoMedioEsic].filter(t => t > 0);
      const tempoMedioConsolidado = tempos.length > 0
        ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
        : 0;

      // ============================================
      // 4. EVOLUÇÃO TEMPORAL (últimos 6 meses)
      // ============================================
      const hoje = new Date();
      const seisMesesAtras = new Date(hoje);
      seisMesesAtras.setMonth(hoje.getMonth() - 6);
      const seisMesesAtrasStr = seisMesesAtras.toISOString().split('T')[0]; // YYYY-MM-DD

      // Evolução Zeladoria
      const evolucaoZeladoria = await Zeladoria.aggregate([
        {
          $match: {
            dataCriacaoIso: { $gte: seisMesesAtrasStr, $exists: true, $ne: null }
          }
        },
        {
          $project: {
            year: { $substr: ['$dataCriacaoIso', 0, 4] },
            month: { $substr: ['$dataCriacaoIso', 5, 2] }
          }
        },
        {
          $group: {
            _id: {
              year: { $toInt: '$year' },
              month: { $toInt: '$month' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Evolução Ouvidoria
      const evolucaoOuvidoria = await Record.aggregate([
        {
          $match: {
            dataCriacaoIso: { $gte: seisMesesAtrasStr, $exists: true, $ne: null }
          }
        },
        {
          $project: {
            year: { $substr: ['$dataCriacaoIso', 0, 4] },
            month: { $substr: ['$dataCriacaoIso', 5, 2] }
          }
        },
        {
          $group: {
            _id: {
              year: { $toInt: '$year' },
              month: { $toInt: '$month' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Evolução E-SIC
      const evolucaoEsic = await Esic.aggregate([
        {
          $match: {
            $or: [
              { dataCriacaoIso: { $gte: seisMesesAtrasStr, $exists: true, $ne: null } },
              { dataCriacao: { $gte: seisMesesAtras, $exists: true } }
            ]
          }
        },
        {
          $project: {
            year: {
              $cond: {
                if: { $ne: ['$dataCriacaoIso', null] },
                then: { $substr: ['$dataCriacaoIso', 0, 4] },
                else: { $year: '$dataCriacao' }
              }
            },
            month: {
              $cond: {
                if: { $ne: ['$dataCriacaoIso', null] },
                then: { $substr: ['$dataCriacaoIso', 5, 2] },
                else: { $month: '$dataCriacao' }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $toInt: '$year' },
              month: { $toInt: '$month' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Combinar evolução temporal
      const evolucaoMap = new Map();

      evolucaoZeladoria.forEach(e => {
        const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
        if (!evolucaoMap.has(key)) {
          evolucaoMap.set(key, { periodo: key, zeladoria: 0, ouvidoria: 0, esic: 0, total: 0 });
        }
        const item = evolucaoMap.get(key);
        item.zeladoria = e.count;
        item.total += e.count;
      });

      evolucaoOuvidoria.forEach(e => {
        const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
        if (!evolucaoMap.has(key)) {
          evolucaoMap.set(key, { periodo: key, zeladoria: 0, ouvidoria: 0, esic: 0, total: 0 });
        }
        const item = evolucaoMap.get(key);
        item.ouvidoria = e.count;
        item.total += e.count;
      });

      evolucaoEsic.forEach(e => {
        const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
        if (!evolucaoMap.has(key)) {
          evolucaoMap.set(key, { periodo: key, zeladoria: 0, ouvidoria: 0, esic: 0, total: 0 });
        }
        const item = evolucaoMap.get(key);
        item.esic = e.count;
        item.total += e.count;
      });

      const evolucaoTemporal = Array.from(evolucaoMap.values()).sort((a, b) =>
        a.periodo.localeCompare(b.periodo)
      );

      // ============================================
      // 5. ALERTAS E INDICADORES CRÍTICOS
      // ============================================
      const alerts = [];

      // Verificar vencimentos - Zeladoria (demandas antigas)
      const sessentaDiasAtras = new Date();
      sessentaDiasAtras.setDate(sessentaDiasAtras.getDate() - 60);
      const sessentaDiasAtrasStr = sessentaDiasAtras.toISOString().split('T')[0];

      // Verificar vencimentos Zeladoria - apenas por data antiga (não tem campo tempoResolucao)
      const vencidasZeladoria = await Zeladoria.countDocuments({
        status: { $nin: ['CONCLUÍDO', 'FECHADO', 'RESOLVIDO', 'CONCLUIDO'] },
        dataCriacaoIso: { $exists: true, $ne: null, $lt: sessentaDiasAtrasStr }
      });

      if (vencidasZeladoria > 0) {
        alerts.push({
          severity: 'critical',
          title: `${vencidasZeladoria} demandas vencidas na Zeladoria`,
          message: 'Ação imediata necessária',
          system: 'zeladoria',
          timestamp: new Date().toLocaleString('pt-BR')
        });
      }

      // Verificar vencimentos - Ouvidoria (prazoRestante < 0)
      // Buscar registros e filtrar em JavaScript para evitar erro de conversão
      const registrosOuvidoria = await Record.find({
        prazoRestante: { $exists: true, $ne: null },
        status: { $nin: ['CONCLUÍDO', 'CONCLUIDO', 'FECHADO', 'RESOLVIDO'] }
      })
        .select('prazoRestante')
        .limit(50000)
        .lean();

      const vencidasOuvidoria = registrosOuvidoria.filter(r => {
        if (!r.prazoRestante) return false;
        const dias = parseInt(String(r.prazoRestante));
        return !isNaN(dias) && dias < 0;
      }).length;

      if (vencidasOuvidoria > 0) {
        alerts.push({
          severity: 'critical',
          title: `${vencidasOuvidoria} manifestações vencidas na Ouvidoria`,
          message: 'Ação imediata necessária',
          system: 'ouvidoria',
          timestamp: new Date().toLocaleString('pt-BR')
        });
      }

      // ============================================
      // 6. TIMELINE DE EVENTOS RECENTES
      // ============================================
      const timeline = [];

      // Eventos Zeladoria
      const eventosZeladoria = await Zeladoria.find({})
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(3)
        .select('status categoria updatedAt createdAt dataCriacaoIso')
        .lean();

      eventosZeladoria.forEach(e => {
        const timestamp = e.updatedAt || e.createdAt || (e.dataCriacaoIso ? new Date(e.dataCriacaoIso + 'T00:00:00') : null);
        timeline.push({
          system: 'zeladoria',
          title: `Demanda ${e.status || 'N/A'}`,
          description: `Categoria: ${e.categoria || 'N/A'}`,
          timestamp: timestamp ? timestamp.toLocaleString('pt-BR') : ''
        });
      });

      // Eventos Ouvidoria
      const eventosOuvidoria = await Record.find({})
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(3)
        .select('status tema updatedAt createdAt dataConclusaoIso dataCriacaoIso')
        .lean();

      eventosOuvidoria.forEach(e => {
        const timestamp = e.updatedAt || e.createdAt ||
          (e.dataConclusaoIso ? new Date(e.dataConclusaoIso + 'T00:00:00') : null) ||
          (e.dataCriacaoIso ? new Date(e.dataCriacaoIso + 'T00:00:00') : null);
        timeline.push({
          system: 'ouvidoria',
          title: `Manifestação ${e.status || 'N/A'}`,
          description: `Tema: ${e.tema || 'N/A'}`,
          timestamp: timestamp ? timestamp.toLocaleString('pt-BR') : ''
        });
      });

      // Ordenar timeline por timestamp (mais recente primeiro)
      // Usar updatedAt/createdAt para ordenação antes de formatar
      timeline.sort((a, b) => {
        // Se temos timestamps formatados, tentar parsear
        if (a.timestamp && b.timestamp) {
          try {
            // Formato: "DD/MM/YYYY, HH:MM:SS"
            const partsA = a.timestamp.split(', ');
            const partsB = b.timestamp.split(', ');
            if (partsA.length === 2 && partsB.length === 2) {
              const [dateA, timeA] = partsA;
              const [dateB, timeB] = partsB;
              const [dayA, monthA, yearA] = dateA.split('/');
              const [dayB, monthB, yearB] = dateB.split('/');
              const dateObjA = new Date(`${yearA}-${monthA}-${dayA}T${timeA}`);
              const dateObjB = new Date(`${yearB}-${monthB}-${dayB}T${timeB}`);
              if (!isNaN(dateObjA.getTime()) && !isNaN(dateObjB.getTime())) {
                return dateObjB - dateObjA;
              }
            }
          } catch (e) {
            // Se falhar, manter ordem original
          }
        }
        return 0;
      });
      timeline.splice(10); // Limitar a 10 eventos

      // ============================================
      // 7. RETORNAR DADOS CONSOLIDADOS
      // ============================================
      return {
        totalDemandas,
        zeladoria: {
          total: zeladoriaTotal,
          emAtendimento: zeladoriaEmAtendimento,
          concluidas: zeladoriaTotal - zeladoriaEmAtendimento,
          tempoMedio: tempoMedioZeladoria
        },
        ouvidoria: {
          total: ouvidoriaTotal,
          emAtendimento: ouvidoriaEmAtendimento,
          concluidas: ouvidoriaTotal - ouvidoriaEmAtendimento,
          tempoMedio: tempoMedioOuvidoria
        },
        esic: {
          total: esicTotal,
          emAtendimento: esicEmAtendimento,
          concluidas: esicTotal - esicEmAtendimento,
          tempoMedio: tempoMedioEsic
        },
        // CORA: Assistente virtual - mostra total de manifestações de ouvidoria
        cora: {
          ocorrenciasAtivas: ouvidoriaTotal, // Total de manifestações de ouvidoria
          total: ouvidoriaTotal,
          emAtendimento: ouvidoriaEmAtendimento
        },
        tempoMedioConsolidado,
        evolucaoTemporal,
        alerts,
        timeline
      };

    } catch (error) {
      logger.error('Erro ao buscar dados do dashboard central:', {
        message: error.message,
        name: error.name,
        code: error.code
      });
      throw error;
    }
  });
}
