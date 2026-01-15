/**
 * Utilitários para Paginação Cursor-Based
 * 
 * Evita usar .skip() em coleções grandes, que é ineficiente.
 * Usa cursor-based pagination com createdAt e _id para escalabilidade.
 * 
 * Benefício: Escalável para milhões de documentos
 */

import { ObjectId } from 'mongodb';

/**
 * Codificar cursor (base64)
 * @param {Date|string} createdAt - Data de criação
 * @param {string|ObjectId} id - ID do documento
 * @returns {string} Cursor codificado
 */
export function encodeCursor(createdAt, id) {
  const cursorData = {
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    id: id instanceof ObjectId ? id.toString() : id
  };
  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

/**
 * Decodificar cursor
 * @param {string} cursor - Cursor codificado
 * @returns {{createdAt: string, id: string}} Dados do cursor
 */
export function decodeCursor(cursor) {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString();
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Paginar com cursor (forward pagination)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @param {Object} match - Filtros $match
 * @param {number} pageSize - Tamanho da página
 * @param {string|null} cursor - Cursor para próxima página (null para primeira página)
 * @param {Object} sort - Ordenação (padrão: { createdAt: -1, _id: -1 })
 * @param {string} collection - Nome da collection
 * @returns {Promise<{results: Array, nextCursor: string|null, hasMore: boolean}>}
 */
export async function paginateWithCursor(
  getMongoClient,
  match = {},
  pageSize = 50,
  cursor = null,
  sort = { createdAt: -1, _id: -1 },
  collection = 'records'
) {
  try {
    const client = await getMongoClient();
    const db = client.db(process.env.DB_NAME || process.env.MONGODB_DB_NAME || 'dashboard');
    const coll = db.collection(collection);
    
    // Construir query com cursor
    const query = { ...match };
    
    if (cursor) {
      const { createdAt, id } = decodeCursor(cursor);
      
      // Construir query para documentos anteriores ao cursor
      // Ordenação descendente: documentos com createdAt menor OU (createdAt igual E _id menor)
      const cursorDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
      const cursorId = ObjectId.isValid(id) ? new ObjectId(id) : id;
      
      query.$or = [
        { createdAt: { $lt: cursorDate } },
        {
          createdAt: cursorDate,
          _id: { $lt: cursorId }
        }
      ];
    }
    
    // Buscar pageSize + 1 para verificar se há mais páginas
    const limit = pageSize + 1;
    
    const docs = await coll
      .find(query)
      .sort(sort)
      .limit(limit)
      .toArray();
    
    // Verificar se há mais páginas
    const hasMore = docs.length > pageSize;
    const results = hasMore ? docs.slice(0, pageSize) : docs;
    
    // Gerar próximo cursor se houver mais páginas
    let nextCursor = null;
    if (hasMore && results.length > 0) {
      const lastDoc = results[results.length - 1];
      const lastCreatedAt = lastDoc.createdAt || lastDoc.dataCriacaoIso || lastDoc.dataDaCriacao;
      const lastId = lastDoc._id || lastDoc.id;
      
      if (lastCreatedAt && lastId) {
        nextCursor = encodeCursor(lastCreatedAt, lastId);
      }
    }
    
    return {
      results,
      nextCursor,
      hasMore,
      pageSize,
      totalReturned: results.length
    };
  } catch (error) {
    console.error('❌ Erro na paginação cursor-based:', error);
    throw error;
  }
}

/**
 * Paginar com cursor (backward pagination - páginas anteriores)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @param {Object} match - Filtros $match
 * @param {number} pageSize - Tamanho da página
 * @param {string|null} cursor - Cursor para página anterior
 * @param {Object} sort - Ordenação (padrão: { createdAt: -1, _id: -1 })
 * @param {string} collection - Nome da collection
 * @returns {Promise<{results: Array, prevCursor: string|null, hasMore: boolean}>}
 */
export async function paginateBackwardWithCursor(
  getMongoClient,
  match = {},
  pageSize = 50,
  cursor = null,
  sort = { createdAt: -1, _id: -1 },
  collection = 'records'
) {
  try {
    const client = await getMongoClient();
    const db = client.db(process.env.DB_NAME || process.env.MONGODB_DB_NAME || 'dashboard');
    const coll = db.collection(collection);
    
    // Construir query com cursor (para backward, invertemos a lógica)
    const query = { ...match };
    
    if (cursor) {
      const { createdAt, id } = decodeCursor(cursor);
      
      const cursorDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
      const cursorId = ObjectId.isValid(id) ? new ObjectId(id) : id;
      
      // Para backward: documentos com createdAt maior OU (createdAt igual E _id maior)
      query.$or = [
        { createdAt: { $gt: cursorDate } },
        {
          createdAt: cursorDate,
          _id: { $gt: cursorId }
        }
      ];
    }
    
    // Inverter ordenação para backward
    const invertedSort = {};
    for (const [key, value] of Object.entries(sort)) {
      invertedSort[key] = value * -1; // Inverter direção
    }
    
    const limit = pageSize + 1;
    
    const docs = await coll
      .find(query)
      .sort(invertedSort)
      .limit(limit)
      .toArray();
    
    // Reverter ordem dos resultados
    docs.reverse();
    
    const hasMore = docs.length > pageSize;
    const results = hasMore ? docs.slice(0, pageSize) : docs;
    
    // Gerar cursor anterior
    let prevCursor = null;
    if (hasMore && results.length > 0) {
      const firstDoc = results[0];
      const firstCreatedAt = firstDoc.createdAt || firstDoc.dataCriacaoIso || firstDoc.dataDaCriacao;
      const firstId = firstDoc._id || firstDoc.id;
      
      if (firstCreatedAt && firstId) {
        prevCursor = encodeCursor(firstCreatedAt, firstId);
      }
    }
    
    return {
      results,
      prevCursor,
      hasMore,
      pageSize,
      totalReturned: results.length
    };
  } catch (error) {
    console.error('❌ Erro na paginação backward:', error);
    throw error;
  }
}

/**
 * Converter resultados para formato compatível com Prisma
 * @param {Array} results - Resultados do MongoDB
 * @returns {Array} Resultados formatados
 */
export function formatPaginatedResults(results) {
  return results.map(doc => {
    // Converter _id para id se necessário
    if (doc._id && !doc.id) {
      doc.id = doc._id.toString();
    }
    return doc;
  });
}

