/**
 * Sistema Global de Normalização de Datas
 * Usado por TODAS as APIs e páginas do sistema
 */

/**
 * Normaliza qualquer formato de data para YYYY-MM-DD
 * @param {any} dateInput - Data em qualquer formato
 * @returns {string|null} - Data normalizada em formato YYYY-MM-DD ou null se inválida
 */
export function normalizeDate(dateInput) {
  if (!dateInput) return null;
  
  // Se for objeto Date, converter para YYYY-MM-DD
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return dateInput.toISOString().slice(0, 10);
  }
  
  // Se for objeto com propriedades de data (MongoDB Date)
  if (typeof dateInput === 'object' && dateInput !== null) {
    try {
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    } catch (e) {
      // Ignorar erro
    }
  }
  
  const str = String(dateInput).trim();
  if (!str || str === 'null' || str === 'undefined') return null;
  
  // Formato YYYY-MM-DD (já está no formato correto)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // Formato ISO com hora (2025-01-06T03:00:28.000Z) - EXTRAIR APENAS A DATA
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  
  // Formato DD/MM/YYYY
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  
  return null;
}

/**
 * Obtém a data de criação de um registro usando a ordem de prioridade
 * @param {Object} record - Registro do Prisma
 * @returns {string|null} - Data de criação em formato YYYY-MM-DD ou null
 */
export function getDataCriacao(record) {
  // Prioridade 1: dataCriacaoIso (se disponível e válida)
  if (record.dataCriacaoIso) {
    const normalized = normalizeDate(record.dataCriacaoIso);
    if (normalized) return normalized;
  }
  
  // Prioridade 2: dataDaCriacao (100% dos registros têm este campo)
  if (record.dataDaCriacao) {
    const normalized = normalizeDate(record.dataDaCriacao);
    if (normalized) return normalized;
  }
  
  // Prioridade 3: data.data_da_criacao (do JSON)
  if (record.data && typeof record.data === 'object' && record.data.data_da_criacao) {
    const normalized = normalizeDate(record.data.data_da_criacao);
    if (normalized) return normalized;
  }
  
  return null;
}

/**
 * Obtém a data de conclusão de um registro usando a ordem de prioridade
 * @param {Object} record - Registro do Prisma
 * @returns {string|null} - Data de conclusão em formato YYYY-MM-DD ou null
 */
export function getDataConclusao(record) {
  // Prioridade 1: dataConclusaoIso (se disponível e válida)
  if (record.dataConclusaoIso) {
    const normalized = normalizeDate(record.dataConclusaoIso);
    if (normalized) return normalized;
  }
  
  // Prioridade 2: dataDaConclusao
  if (record.dataDaConclusao) {
    const normalized = normalizeDate(record.dataDaConclusao);
    if (normalized) return normalized;
  }
  
  // Prioridade 3: data.data_da_conclusao (do JSON)
  if (record.data && typeof record.data === 'object' && record.data.data_da_conclusao) {
    const normalized = normalizeDate(record.data.data_da_conclusao);
    if (normalized) return normalized;
  }
  
  return null;
}

/**
 * Obtém o mês de um registro baseado na data de criação
 * @param {Object} record - Registro do Prisma
 * @returns {string|null} - Mês no formato YYYY-MM ou null
 */
export function getMes(record) {
  const dataCriacao = getDataCriacao(record);
  if (dataCriacao) {
    return dataCriacao.slice(0, 7); // YYYY-MM
  }
  return null;
}

/**
 * Verifica se um registro está concluído
 * @param {Object} record - Registro do Prisma
 * @returns {boolean} - true se o registro está concluído
 */
export function isConcluido(record) {
  // Verificar se tem data de conclusão
  if (getDataConclusao(record)) return true;
  
  // Verificar status
  const status = (record.status || record.statusDemanda || '').toLowerCase();
  return status.includes('concluída') || 
         status.includes('concluida') || 
         status.includes('encerrada') || 
         status.includes('finalizada') ||
         status.includes('resolvida') ||
         status.includes('arquivamento');
}

/**
 * Calcula o tempo de resolução em dias usando a ordem de prioridade
 * @param {Object} record - Registro do Prisma
 * @param {boolean} incluirZero - Se true, inclui valores zero
 * @returns {number|null} - Tempo de resolução em dias ou null se não puder calcular
 */
export function getTempoResolucaoEmDias(record, incluirZero = true) {
  // Prioridade 1: tempoDeResolucaoEmDias (campo direto)
  if (record.tempoDeResolucaoEmDias !== null && record.tempoDeResolucaoEmDias !== undefined && record.tempoDeResolucaoEmDias !== '') {
    const parsed = parseFloat(record.tempoDeResolucaoEmDias);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1000) {
      let finalValue = parsed;
      if (parsed === 0) {
        const dataCriacao = getDataCriacao(record);
        const dataConclusao = getDataConclusao(record);
        if (dataCriacao && dataConclusao && dataCriacao === dataConclusao) {
          finalValue = 1; // Mesmo dia = 1 dia
        }
      }
      
      if (!incluirZero && finalValue === 0) {
        // Continuar tentando calcular das datas
      } else {
        return finalValue;
      }
    }
  }
  
  // Prioridade 2: Calcular a partir das datas ISO
  const dataCriacao = getDataCriacao(record);
  const dataConclusao = getDataConclusao(record);
  
  if (dataCriacao && dataConclusao) {
    const start = new Date(dataCriacao + 'T00:00:00');
    const end = new Date(dataConclusao + 'T00:00:00');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      let calculated = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (calculated === 0) {
        calculated = 1;
      } else {
        calculated = calculated + 1;
      }
      if (calculated >= 0 && calculated <= 1000) {
        if (incluirZero || calculated > 0) {
          return calculated;
        }
      }
    }
  }
  
  // Prioridade 3: Calcular a partir de data.data_da_criacao e data.data_da_conclusao
  if (record.data && typeof record.data === 'object') {
    const dataCriacaoJson = normalizeDate(record.data.data_da_criacao);
    const dataConclusaoJson = normalizeDate(record.data.data_da_conclusao);
    
    if (dataCriacaoJson && dataConclusaoJson) {
      const start = new Date(dataCriacaoJson + 'T00:00:00');
      const end = new Date(dataConclusaoJson + 'T00:00:00');
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        let calculated = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        if (calculated === 0) {
          calculated = 1;
        } else {
          calculated = calculated + 1;
        }
        if (calculated >= 0 && calculated <= 1000) {
          if (incluirZero || calculated > 0) {
            return calculated;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Filtra registros por mês(es) usando dataDaCriacao
 * @param {Object} where - Objeto where do Prisma
 * @param {string[]|null} meses - Array de meses no formato YYYY-MM
 * @returns {Object} - Objeto where atualizado
 */
/**
 * Filtra registros por mês(es) usando dataDaCriacao
 * @param {Object} where - Objeto where do Prisma (DEPRECATED - usar addMesFilterMongo)
 * @param {string[]|null} meses - Array de meses no formato YYYY-MM
 * @returns {Object} - Objeto where atualizado
 * @deprecated Use addMesFilterMongo para MongoDB
 */
export function addMesFilter(where, meses) {
  if (meses && meses.length > 0) {
    const monthFilters = meses.map(month => {
      // Se já está em formato YYYY-MM, usar diretamente
      if (/^\d{4}-\d{2}$/.test(month)) return month;
      // Se está em formato MM/YYYY, converter
      const match = month.match(/^(\d{2})\/(\d{4})$/);
      if (match) return `${match[2]}-${match[1]}`;
      return month;
    });
    
    // Adicionar filtro OR para qualquer um dos meses
    if (where.OR) {
      where.AND = [
        ...(where.AND || []),
        { OR: monthFilters.map(month => ({ dataDaCriacao: { startsWith: month } })) }
      ];
    } else {
      where.OR = monthFilters.map(month => ({
        dataDaCriacao: { startsWith: month }
      }));
    }
  }
  return where;
}

/**
 * Adiciona filtro de mês(es) para MongoDB
 * @param {Object} filter - Objeto filter do MongoDB
 * @param {string[]|null} meses - Array de meses no formato YYYY-MM ou MM/YYYY
 * @returns {Object} - Objeto filter atualizado com $or para meses
 */
export function addMesFilterMongo(filter, meses) {
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
    const monthOrFilters = monthFilters.map(month => ({
      dataDaCriacao: { $regex: `^${month}`, $options: 'i' }
    }));
    
    // Se já existe $or, combinar com AND
    if (filter.$or) {
      filter.$and = [
        ...(filter.$and || []),
        { $or: monthOrFilters }
      ];
    } else {
      filter.$or = monthOrFilters;
    }
  }
  return filter;
}

