/**
 * Controller para /api/records
 * Listagem paginada de registros
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { safeQuery } from '../../utils/formatting/responseHelper.js';
import Record from '../../models/Record.model.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/records
 * Listagem paginada de registros com filtros opcionais
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function getRecords(req, res) {
  return safeQuery(res, async () => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 50), 500);
    const skip = (page - 1) * pageSize;

    // Construir filtros MongoDB
    const filter = {};

    // Filtros opcionais
    if (req.query.servidor) filter.servidor = req.query.servidor;
    if (req.query.unidadeCadastro) filter.unidadeCadastro = req.query.unidadeCadastro;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.tema) filter.tema = req.query.tema;
    if (req.query.assunto) filter.assunto = req.query.assunto;

    // Buscar registros e total em paralelo
    const [records, total] = await Promise.all([
      Record.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(), // Retornar objetos JavaScript simples (mais rápido)
      Record.countDocuments(filter)
    ]);

    logger.debug(`Records listados: ${records.length} de ${total} (página ${page})`);

    return {
      data: records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  });
}
