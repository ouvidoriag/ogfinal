/**
 * Controller de SLA
 * /api/sla/summary
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import { getDataCriacao, isConcluido, getTempoResolucaoEmDias, addMesFilterMongo } from '../../utils/formatting/dateUtils.js';
import Record from '../../models/Record.model.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/sla/summary
 * Resumo de SLA: concluídos, verde claro (0-30), amarelo (31-60), vermelho (61+)
 */
export async function slaSummary(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;
  const meses = req.query.meses ? (Array.isArray(req.query.meses) ? req.query.meses : [req.query.meses]) : null;

  const key = servidor ? `sla:servidor:${servidor}:v4` :
    unidadeCadastro ? `sla:uac:${unidadeCadastro}:v4` :
      meses ? `sla:meses:${meses.sort().join(',')}:v4` :
        'sla:v4';

  // Cache de 5 horas (dados de SLA seguem o mesmo ritmo de atualização)
  // Timeout de 90s para evitar 504 em cálculos pesados (alinhado com dataLoader)
  return withCache(key, 18000, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // Adicionar filtro de meses se fornecido
    addMesFilterMongo(filter, meses);

    const today = new Date();

    // OTIMIZAÇÃO: Adicionar filtro de data (últimos 24 meses) para melhor performance
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setMonth(today.getMonth() - 24);
    const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

    // Adicionar filtro de data se não houver filtro de meses
    if (!meses || meses.length === 0) {
      if (!filter.$or) filter.$or = [];
      filter.$or.push(
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: today.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (today.getFullYear() - 1).toString() } }
      );
    }

    // OTIMIZAÇÃO: Adicionar filtro de dataCriacaoIso para reduzir volume
    // Buscar apenas registros dos últimos 24 meses (já filtrado acima)
    if (!filter.$or) filter.$or = [];
    filter.$or.push(
      { dataCriacaoIso: { $gte: minDateStr } },
      { dataDaCriacao: { $ne: null } }
    );

    // Buscar campos necessários usando sistema global de datas
    // OTIMIZADO: Reduzir take e usar filtros mais específicos
    const rows = await Record.find(filter)
      .select('dataCriacaoIso dataDaCriacao dataConclusaoIso dataDaConclusao tempoDeResolucaoEmDias status statusDemanda tipoDeManifestacao')
      .limit(20000)
      .lean();

    // Buckets: concluídos (verde escuro), verde claro (0-30), amarelo (31-60), vermelho (61+)
    const buckets = {
      concluidos: 0,      // Verde escuro
      verdeClaro: 0,      // 0-30 dias
      amarelo: 0,         // 31-60 dias
      vermelho: 0         // 61+ dias (atraso)
    };

    for (const r of rows) {
      // Se está concluído, marcar como verde escuro
      if (isConcluido(r)) {
        buckets.concluidos += 1;
        continue;
      }

      // Se não está concluído, calcular tempo de resolução usando sistema global
      const tempoResolucao = getTempoResolucaoEmDias(r, true);

      // Se não conseguir calcular pelo tempo, calcular dias desde criação
      let days = tempoResolucao;
      if (days === null) {
        const dataCriacao = getDataCriacao(r);
        if (dataCriacao) {
          const d = new Date(dataCriacao + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            days = Math.floor((today - d) / (1000 * 60 * 60 * 24));
          }
        }
      }

      if (days === null) continue;

      // Classificar por faixa de dias
      if (days <= 30) {
        buckets.verdeClaro += 1;
      } else if (days <= 60) {
        buckets.amarelo += 1;
      } else {
        buckets.vermelho += 1;
      }
    }

    return buckets;
  }, null, 90000); // Timeout de 90s (alinhado com dataLoader)
}

