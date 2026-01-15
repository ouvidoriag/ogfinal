/**
 * Controller para /api/distinct
 * Valores distintos de um campo
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { safeQuery } from '../../utils/formatting/responseHelper.js';
import { optimizedDistinct } from '../../utils/queryOptimizer.js';
import { getNormalizedField } from '../../utils/formatting/fieldMapper.js';
import Record from '../../models/Record.model.js';

/**
 * GET /api/distinct
 */
export async function getDistinct(req, res) {
  return safeQuery(res, async () => {
    try {
      const field = String(req.query.field ?? '').trim();
      if (!field) {
        return res.status(400).json({ error: 'field required' });
      }

      // Normalizar campo
      const normalizedField = getNormalizedField(field);
      if (!normalizedField) {
        return res.status(400).json({ error: `Campo inválido: ${field}` });
      }

      // Construir filtros opcionais
      const filter = {};
      if (req.query.servidor) filter.servidor = req.query.servidor;
      if (req.query.unidadeCadastro) filter.unidadeCadastro = req.query.unidadeCadastro;

      // Usar função otimizada (Mongoose)
      const values = await optimizedDistinct(null, normalizedField, filter, {
        limit: 1000,
        dateFilter: true
      });

      return values;
    } catch (error) {
      // Log detalhado do erro para debug
      console.error(`❌ Erro em getDistinct para campo ${req.query.field}:`, error);
      console.error('Stack:', error.stack);
      throw error; // Re-throw para safeQuery tratar
    }
  });
}
