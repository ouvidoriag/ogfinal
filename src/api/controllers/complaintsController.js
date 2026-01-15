/**
 * Controller para /api/complaints-denunciations
 * Reclamações e denúncias
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import Record from '../../models/Record.model.js';

/**
 * GET /api/complaints-denunciations
 */
export async function getComplaints(req, res) {
  const key = 'complaints:v3';

  return withCache(key, 3600, res, async () => {
    // Buscar variações do texto para cobrir diferentes grafias
    const allRecords = await Record.find({
      $or: [
        { tipoDeManifestacao: { $regex: 'Reclamação', $options: 'i' } },
        { tipoDeManifestacao: { $regex: 'Reclamacao', $options: 'i' } },
        { tipoDeManifestacao: { $regex: 'Reclama', $options: 'i' } },
        { tipoDeManifestacao: { $regex: 'Denúncia', $options: 'i' } },
        { tipoDeManifestacao: { $regex: 'Denuncia', $options: 'i' } },
        { tipoDeManifestacao: { $regex: 'Denún', $options: 'i' } }
      ]
    })
      .select('assunto tipoDeManifestacao')
      .limit(5000)
      .lean();

    // Filtrar em memória para case-insensitive
    const records = allRecords.filter(r => {
      const tipo = (r.tipoDeManifestacao || '').toLowerCase();
      return tipo.includes('reclamação') || tipo.includes('reclamacao') ||
        tipo.includes('denúncia') || tipo.includes('denuncia');
    });

    const assuntoMap = new Map();
    const tipoMap = new Map();

    for (const r of records) {
      const tipo = r.tipoDeManifestacao || 'Não informado';
      const assunto = r.assunto || 'Não informado';

      assuntoMap.set(assunto, (assuntoMap.get(assunto) || 0) + 1);
      tipoMap.set(tipo, (tipoMap.get(tipo) || 0) + 1);
    }

    const assuntos = Array.from(assuntoMap.entries())
      .map(([assunto, count]) => ({ assunto, quantidade: count }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const tipos = Array.from(tipoMap.entries())
      .map(([tipo, count]) => ({ tipo, quantidade: count }))
      .sort((a, b) => b.quantidade - a.quantidade);

    return { assuntos, tipos };
  });
}

