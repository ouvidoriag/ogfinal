/**
 * Helper genérico para filtros de mês e status em páginas
 * Pode ser usado em qualquer página de análise
 */

/**
 * Coletar filtros de mês e status da página
 * @param {string} prefix - Prefixo único para os IDs dos elementos (ex: 'TempoMedio', 'Tema', etc)
 * @returns {Array} Array de filtros no formato esperado pela API
 */
function coletarFiltrosMesStatus(prefix = '') {
  const filtros = [];
  
  // IDs dos elementos
  const idMes = prefix ? `filtroMes${prefix}` : 'filtroMes';
  const idStatus = prefix ? `filtroStatus${prefix}` : 'filtroStatus';
  
  // Filtro por mês
  const mesFiltro = document.getElementById(idMes)?.value?.trim() || '';
  if (mesFiltro) {
    // Formato: YYYY-MM
    const [ano, mes] = mesFiltro.split('-');
    if (ano && mes) {
      // Filtrar por data de criação no mês selecionado
      const dataInicial = `${mesFiltro}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const dataFinal = `${mesFiltro}-${ultimoDia}`;
      
      filtros.push({
        field: 'dataCriacaoIso',
        op: 'gte',
        value: dataInicial
      });
      filtros.push({
        field: 'dataCriacaoIso',
        op: 'lte',
        value: `${dataFinal}T23:59:59.999Z`
      });
    }
  }
  
  // Filtro por status
  const statusFiltro = document.getElementById(idStatus)?.value?.trim() || '';
  if (statusFiltro) {
    if (window.Logger) {
      window.Logger.debug(`📊 Coletando filtro de status: ${statusFiltro} (prefix: ${prefix})`);
    }
    
    if (statusFiltro === 'concluido') {
      // Filtrar por status concluído
      filtros.push({
        field: 'statusDemanda',
        op: 'contains',
        value: 'concluíd'
      });
      if (window.Logger) {
        window.Logger.debug('✅ Filtro de status concluído adicionado');
      }
    } else if (statusFiltro === 'em-andamento') {
      // Filtrar por status em andamento
      filtros.push({
        field: 'statusDemanda',
        op: 'contains',
        value: 'atendimento'
      });
      if (window.Logger) {
        window.Logger.debug('✅ Filtro de status em andamento adicionado');
      }
    }
  }
  
  if (window.Logger && filtros.length > 0) {
    window.Logger.debug(`📊 Filtros coletados (${filtros.length}):`, filtros);
  }
  
  return filtros;
}

/**
 * Popular select de meses com dados disponíveis
 * @param {string} selectId - ID do elemento select
 * @param {string} endpoint - Endpoint da API para obter meses disponíveis
 * @param {string} mesSelecionado - Mês que deve ser selecionado por padrão
 */
async function popularSelectMesesFromEndpoint(selectId, endpoint = '/api/stats/average-time/by-month', mesSelecionado = '') {
  const selectMes = document.getElementById(selectId);
  if (!selectMes) {
    if (window.Logger) {
      window.Logger.warn(`Select ${selectId} não encontrado para popular meses`);
    }
    return Promise.resolve();
  }
  
  if (window.Logger) {
    window.Logger.debug(`📅 Popular select de meses: ${selectId}, endpoint: ${endpoint}`);
  }
  
  try {
    // Verificar se dataLoader está disponível
    if (!window.dataLoader) {
      if (window.Logger) {
        window.Logger.warn('⚠️ dataLoader não disponível, tentando novamente...');
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          popularSelectMesesFromEndpoint(selectId, endpoint, mesSelecionado).then(resolve).catch(resolve);
        }, 200);
      });
    }
    
    // Carregar dados mensais para obter meses disponíveis
    const dataMesRaw = await window.dataLoader.load(endpoint, {
      useDataStore: true,
      ttl: 10 * 60 * 1000,
      fallback: []
    });
    
    // Validar que dataMes é um array
    let dataMes = [];
    if (Array.isArray(dataMesRaw)) {
      dataMes = dataMesRaw;
    } else if (dataMesRaw && typeof dataMesRaw === 'object') {
      // Se for um objeto, tentar extrair array de propriedades
      if (Array.isArray(dataMesRaw.data)) {
        dataMes = dataMesRaw.data;
      } else if (Array.isArray(dataMesRaw.meses)) {
        dataMes = dataMesRaw.meses;
      } else if (Array.isArray(dataMesRaw.results)) {
        dataMes = dataMesRaw.results;
      } else {
        // Tentar converter objeto em array
        dataMes = Object.values(dataMesRaw).filter(item => item && typeof item === 'object');
      }
    }
    
    if (!Array.isArray(dataMes)) {
      if (window.Logger) {
        window.Logger.warn(`⚠️ popularSelectMeses: meses não é um array para ${selectId}: ${endpoint}`, {
          type: typeof dataMesRaw,
          isArray: Array.isArray(dataMesRaw),
          data: dataMesRaw
        });
      }
      return Promise.resolve();
    }
    
    if (window.Logger) {
      window.Logger.debug(`📅 Dados recebidos do endpoint ${endpoint}:`, {
        count: dataMes.length,
        sample: dataMes.slice(0, 3)
      });
    }
    
    // Limpar opções existentes (exceto "Todos os meses")
    while (selectMes.children.length > 1) {
      selectMes.removeChild(selectMes.lastChild);
    }
    
    // Adicionar meses disponíveis (ordenados do mais recente para o mais antigo)
    const meses = dataMes
      .map(d => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          return d.month || d.ym || d._id || d.mes || d.date;
        }
        return null;
      })
      .filter(m => m && typeof m === 'string' && m.length > 0)
      .sort()
      .reverse();
    
    if (window.Logger) {
      window.Logger.debug(`📅 Meses extraídos: ${meses.length}`, meses.slice(0, 5));
    }
    
    if (meses.length === 0) {
      if (window.Logger) {
        window.Logger.warn(`⚠️ Nenhum mês encontrado no endpoint ${endpoint}`);
      }
      return Promise.resolve();
    }
    
    meses.forEach(mes => {
      const option = document.createElement('option');
      option.value = mes;
      
      // Formatar para nome do mês (ex: "Janeiro 2025")
      let nomeMes = mes;
      try {
        if (mes && mes.includes('-')) {
          const [ano, mesNum] = mes.split('-');
          const mesesNomes = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          const mesIndex = parseInt(mesNum) - 1;
          if (mesIndex >= 0 && mesIndex < 12) {
            nomeMes = `${mesesNomes[mesIndex]} ${ano}`;
          }
        }
      } catch (e) {
        // Se der erro, usar formatação padrão
        nomeMes = window.dateUtils?.formatMonthYearShort(mes) || mes;
      }
      
      option.textContent = nomeMes;
      selectMes.appendChild(option);
    });
    
    // Restaurar seleção anterior se existir
    if (mesSelecionado) {
      selectMes.value = mesSelecionado;
    }
    
    if (window.Logger) {
      window.Logger.debug(`✅ Select ${selectId} populado com ${meses.length} meses`);
    }
    
    return Promise.resolve();
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao popular select de meses:', error);
    }
    // Sempre retornar uma Promise, mesmo em caso de erro
    return Promise.reject(error);
  }
}

/**
 * Inicializar listeners de filtros de mês e status
 * @param {Object} config - Configuração dos filtros
 * @param {string} config.prefix - Prefixo para os IDs (ex: 'TempoMedio')
 * @param {string} config.endpoint - Endpoint para popular meses (opcional)
 * @param {Function} config.onChange - Função callback quando filtro mudar
 * @param {string} config.mesSelecionado - Mês selecionado inicialmente (opcional)
 */
function inicializarFiltrosMesStatus(config) {
  const { prefix = '', endpoint = '/api/stats/average-time/by-month', onChange, mesSelecionado = '' } = config;
  
  const idMes = prefix ? `filtroMes${prefix}` : 'filtroMes';
  const idStatus = prefix ? `filtroStatus${prefix}` : 'filtroStatus';
  
  const selectMes = document.getElementById(idMes);
  const selectStatus = document.getElementById(idStatus);
  
  // Listener para filtro de mês
  if (selectMes) {
    selectMes.addEventListener('change', async (e) => {
      const mesValue = e.target.value || '';
      
      if (window.Logger) {
        window.Logger.debug(`📅 Filtro de mês alterado para: ${mesValue || 'Todos'}`);
      }
      
      // Invalidar cache se necessário
      if (window.dataStore && typeof window.dataStore.clear === 'function') {
        window.dataStore.clear('/api/stats/average-time');
        window.dataStore.clear('/api/stats/average-time/stats');
        window.dataStore.clear('/api/dashboard-data');
        window.dataStore.clear('/api/filter/aggregated');
      }
      
      // Chamar callback se fornecido
      if (onChange && typeof onChange === 'function') {
        try {
          await onChange();
        } catch (error) {
          if (window.Logger) {
            window.Logger.error('Erro no callback onChange do filtro de mês:', error);
          }
        }
      }
    });
  }
  
  // Listener para filtro de status
  if (selectStatus) {
    selectStatus.addEventListener('change', async (e) => {
      const statusValue = e.target.value || '';
      
      if (window.Logger) {
        window.Logger.debug(`📊 Filtro de status alterado para: ${statusValue || 'Todos'}`);
      }
      
      // Invalidar cache se necessário
      if (window.dataStore && typeof window.dataStore.clear === 'function') {
        window.dataStore.clear('/api/stats/average-time');
        window.dataStore.clear('/api/stats/average-time/stats');
        window.dataStore.clear('/api/dashboard-data');
        window.dataStore.clear('/api/filter/aggregated');
      }
      
      // Chamar callback se fornecido
      if (onChange && typeof onChange === 'function') {
        try {
          await onChange();
        } catch (error) {
          if (window.Logger) {
            window.Logger.error('Erro no callback onChange do filtro de status:', error);
          }
        }
      }
    });
  }
  
  // Popular select de meses (usar função local assíncrona que busca do endpoint)
  if (selectMes) {
    // Usar a função local assíncrona que aceita endpoint como segundo parâmetro
    // Garantir que sempre retorna uma Promise
    const promise = popularSelectMesesFromEndpoint(idMes, endpoint, mesSelecionado);
    if (promise && typeof promise.catch === 'function') {
      promise.catch(error => {
        if (window.Logger) {
          window.Logger.error('Erro ao popular select de meses:', error);
        }
      });
    } else {
      // Se não retornou Promise, tentar novamente após um delay
      setTimeout(() => {
        const retryPromise = popularSelectMesesFromEndpoint(idMes, endpoint, mesSelecionado);
        if (retryPromise && typeof retryPromise.catch === 'function') {
          retryPromise.catch(error => {
            if (window.Logger) {
              window.Logger.error('Erro ao popular select de meses (retry):', error);
            }
          });
        }
      }, 500);
    }
  }
}

// Exportar funções
window.PageFiltersHelper = {
  coletarFiltrosMesStatus,
  popularSelectMeses: popularSelectMesesFromEndpoint, // Exportar com nome compatível
  popularSelectMesesFromEndpoint, // Exportar também com nome específico
  inicializarFiltrosMesStatus
};
