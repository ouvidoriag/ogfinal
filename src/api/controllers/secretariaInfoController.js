/**
 * Controller: Informações de Secretarias
 * 
 * Endpoints:
 * - GET /api/secretarias-info         -> Lista todas as secretarias com dados básicos
 * - GET /api/secretarias-info/:id     -> Detalhes de uma secretaria específica
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache, safeQuery } from '../../utils/formatting/responseHelper.js';
import SecretariaInfo from '../../models/SecretariaInfo.model.js';

/**
 * GET /api/secretarias-info
 * Lista todas as secretarias com informações principais
 */
export async function getSecretariasInfo(req, res) {
  const cacheKey = 'secretarias-info:all:v3';
  // Cache de 1 hora – dados mudam apenas quando a planilha é importada
  const ttlSeconds = 60 * 60;

  return withCache(
    cacheKey,
    ttlSeconds,
    res,
    async () => {
      const secretarias = await SecretariaInfo.find({})
        .sort({ name: 1 })
        .lean();

      // Mapear para um formato mais enxuto para o frontend
      const items = secretarias.map((s) => {
        // Se name está vazio, usar fallback (acronym, email ou ID)
        let nomeExibicao = s.name;
        if (!nomeExibicao || nomeExibicao.trim() === '') {
          nomeExibicao = s.acronym ||
            (s.email ? s.email.split('@')[0] : null) ||
            `Secretaria ${s._id.toString().slice(-6)}` ||
            'N/A';
        }

        return {
          id: s._id.toString(),
          name: nomeExibicao,
          acronym: s.acronym || '',
          email: s.email || '',
          alternateEmail: s.alternateEmail || '',
          phone: s.phone || '',
          phoneAlt: s.phoneAlt || '',
          address: s.address || '',
          bairro: s.bairro || '',
          district: s.district || '',
          notes: s.notes || '',
        };
      });

      return {
        total: items.length,
        items,
      };
    }
  );
}

/**
 * GET /api/secretarias-info/:id
 * Retorna os detalhes completos de uma secretaria
 */
export async function getSecretariaInfoById(req, res) {
  const { id } = req.params;

  return safeQuery(res, async () => {
    const secretaria = await SecretariaInfo.findById(id).lean();

    if (!secretaria) {
      return res.status(404).json({ error: 'Secretaria não encontrada' });
    }

    // Converter _id para id
    const result = {
      ...secretaria,
      id: secretaria._id.toString()
    };
    delete result._id;

    return result;
  });
}


