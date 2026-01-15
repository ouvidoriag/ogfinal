/**
 * Controller de Vencimento
 * /api/vencimento
 * Busca protocolos próximos de vencer ou já vencidos
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import logger from '../../utils/logger.js';
import { withCache } from '../../utils/formatting/responseHelper.js';
import { getDataCriacao, isConcluido, getTempoResolucaoEmDias } from '../../utils/formatting/dateUtils.js';
import Record from '../../models/Record.model.js';

/**
 * Determina o prazo baseado no tipo de manifestação
 * @param {string} tipoDeManifestacao - Tipo de manifestação
 * @returns {number} - Prazo em dias (30 para Ouvidoria, 20 para SIC)
 */
function getPrazoPorTipo(tipoDeManifestacao) {
  if (!tipoDeManifestacao) return 30; // Default: 30 dias

  const tipo = String(tipoDeManifestacao).toLowerCase().trim();

  // SIC (Serviço de Informação ao Cidadão) - 20 dias
  if (tipo.includes('sic') ||
    tipo.includes('pedido de informação') ||
    tipo.includes('pedido de informacao') ||
    tipo.includes('informação') ||
    tipo.includes('informacao')) {
    return 20;
  }

  // Ouvidoria (reclamação, sugestão, denúncia, elogio) - 30 dias
  // Qualquer outro tipo também usa 30 dias como padrão
  return 30;
}

/**
 * Calcula a data de vencimento baseado na data de criação e tipo
 * @param {string} dataCriacao - Data de criação em formato YYYY-MM-DD
 * @param {string} tipoDeManifestacao - Tipo de manifestação
 * @returns {string|null} - Data de vencimento em formato YYYY-MM-DD ou null
 */
function calcularDataVencimento(dataCriacao, tipoDeManifestacao) {
  if (!dataCriacao) return null;

  const prazo = getPrazoPorTipo(tipoDeManifestacao);
  return calcularDataVencimentoComPrazo(dataCriacao, prazo);
}

/**
 * Calcula a data de vencimento baseado na data de criação e prazo em dias
 * @param {string} dataCriacao - Data de criação em formato YYYY-MM-DD
 * @param {number} prazo - Prazo em dias
 * @returns {string|null} - Data de vencimento em formato YYYY-MM-DD ou null
 */
function calcularDataVencimentoComPrazo(dataCriacao, prazo) {
  if (!dataCriacao) return null;

  const data = new Date(dataCriacao + 'T00:00:00');

  if (isNaN(data.getTime())) return null;

  // Adicionar prazo em dias
  data.setDate(data.getDate() + prazo);

  return data.toISOString().slice(0, 10);
}

/**
 * Calcula dias restantes até o vencimento
 * @param {string} dataVencimento - Data de vencimento em formato YYYY-MM-DD
 * @param {Date} hoje - Data de referência (hoje)
 * @returns {number|null} - Dias restantes (negativo se vencido) ou null
 */
function calcularDiasRestantes(dataVencimento, hoje) {
  if (!dataVencimento) return null;

  const vencimento = new Date(dataVencimento + 'T00:00:00');
  if (isNaN(vencimento.getTime())) return null;

  const diff = vencimento - hoje;
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));

  return dias;
}

/**
 * GET /api/vencimento
 * Busca protocolos próximos de vencer ou já vencidos
 * Query params:
 *   - filtro: 'vencidos' | '3' | '7' | '15' | '30' | número customizado (dias)
 *   - mes: YYYY-MM (filtro por mês de criação)
 *   - secretaria: filtro por secretaria/órgão
 *   - servidor: filtro opcional
 *   - unidadeCadastro: filtro opcional
 *   - prazo: número customizado de dias para o prazo (sobrescreve o padrão)
 */
export async function getVencimento(req, res) {
  const filtro = req.query.filtro || 'vencidos'; // Default: vencidos
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;
  const mes = req.query.mes; // Filtro por mês (YYYY-MM)
  const secretaria = req.query.secretaria; // Filtro por secretaria
  const prazoCustomizado = req.query.prazo ? parseInt(req.query.prazo) : null; // Prazo customizado em dias
  const tempoResolucaoFiltro = req.query.tempoResolucao || ''; // Filtro de tempo de resolução: '0-15', '16-30', '31-60', '61+'

  // Debug: log dos parâmetros recebidos
  logger.debug('Parâmetros de vencimento recebidos', {
    filtro,
    mes,
    secretaria,
    servidor,
    unidadeCadastro,
    prazoCustomizado
  });

  const key = `vencimento:${filtro}:${mes || ''}:${prazoCustomizado || ''}:${servidor || ''}:${unidadeCadastro || ''}:${secretaria || ''}:${tempoResolucaoFiltro || ''}:v4`;

  // Cache de 5 horas (dados de vencimento mudam a cada ~5h)
  // Timeout de 60s para endpoint pesado (processa muitos registros em memória)
  return withCache(key, 18000, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // NOTA: Filtro de secretaria será aplicado em memória após buscar os registros
    // para garantir case-insensitive e correspondência parcial correta
    const secretariaFiltro = secretaria && secretaria.trim() !== '' ? secretaria.trim() : null;
    if (secretariaFiltro) {
      logger.debug('Filtro de secretaria será aplicado em memória', { secretariaFiltro });
    }

    // Filtrar por mês se fornecido
    if (mes && mes.trim() !== '' && mes !== 'todos' && /^\d{4}-\d{2}$/.test(mes.trim())) {
      const mesTrimmed = mes.trim();
      // Usar múltiplas estratégias para garantir que funcione com diferentes formatos de data
      filter.$or = [
        // Para dataCriacaoIso (formato ISO: YYYY-MM-DD)
        { dataCriacaoIso: { $regex: `^${mesTrimmed}` } },
        // Para dataDaCriacao (pode ter vários formatos)
        { dataDaCriacao: { $regex: `^${mesTrimmed}` } },
        // Também verificar se contém o mês (para formatos como DD/MM/YYYY ou outros)
        { dataDaCriacao: { $regex: `-${mesTrimmed.substring(5)}-` } }, // Contém -MM-
        { dataDaCriacao: { $regex: mesTrimmed } } // Contém YYYY-MM
      ];
      logger.debug('Filtro de mês aplicado', { mes: mesTrimmed, filter });
    } else if (mes && mes.trim() !== '') {
      logger.warn('Mês fornecido mas formato inválido', { mes });
    }

    // Filtrar apenas registros com data de criação (necessário para calcular vencimento)
    // A verificação de se está concluído será feita pela função isConcluido() no loop
    // para garantir consistência com o resto do sistema
    if (!filter.$or) {
      filter.$or = [];
    }
    filter.$or.push(
      { dataCriacaoIso: { $ne: null } },
      { dataDaCriacao: { $ne: null } }
    );

    // OTIMIZAÇÃO CRÍTICA: Adicionar filtro de data (últimos 24 meses) para reduzir volume
    const today = new Date();
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setMonth(today.getMonth() - 24);
    const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

    // Adicionar filtro de data se não houver filtro de mês específico
    if (!mes || mes.trim() === '' || mes === 'todos' || !/^\d{4}-\d{2}$/.test(mes.trim())) {
      if (!filter.$or) filter.$or = [];
      filter.$or.push(
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: today.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (today.getFullYear() - 1).toString() } }
      );
    }

    // Debug: log do filter
    logger.debug('Filter construído', { filter });

    // OTIMIZAÇÃO CRÍTICA: Limitar a 20000 registros máximo para evitar sobrecarga
    // Se precisar de mais, implementar paginação ou usar agregações MongoDB
    const rows = await Record.find(filter)
      .select('_id protocolo dataCriacaoIso dataDaCriacao dataConclusaoIso dataDaConclusao tipoDeManifestacao tema assunto orgaos unidadeCadastro status statusDemanda responsavel tempoDeResolucaoEmDias')
      .limit(20000)
      .lean();

    logger.info('Registros encontrados no banco', { total: rows.length });

    // Aplicar filtros em memória na ordem correta
    let rowsFiltrados = rows;

    // 1. Primeiro aplicar filtro de mês em memória (como fallback caso o filtro do banco não funcione)
    const mesFiltro = mes && mes.trim() !== '' && mes !== 'todos' && /^\d{4}-\d{2}$/.test(mes.trim()) ? mes.trim() : null;
    if (mesFiltro) {
      const antesFiltroMes = rowsFiltrados.length;
      rowsFiltrados = rowsFiltrados.filter(row => {
        const dataCriacao = getDataCriacao(row);
        if (!dataCriacao) return false;
        // Extrair mês da data (YYYY-MM-DD ou outros formatos)
        const mesData = dataCriacao.substring(0, 7); // YYYY-MM
        return mesData === mesFiltro;
      });
      logger.debug('Filtro de mês aplicado em memória', {
        antes: antesFiltroMes,
        depois: rowsFiltrados.length,
        mes: mesFiltro
      });

      // Log de alguns exemplos de datas para debug
      if (rowsFiltrados.length > 0) {
        const exemplosDatas = rowsFiltrados.slice(0, 5).map(r => {
          const dataCriacao = getDataCriacao(r);
          return {
            dataCriacaoIso: r.dataCriacaoIso,
            dataDaCriacao: r.dataDaCriacao,
            dataCriacaoNormalizada: dataCriacao,
            mesExtraido: dataCriacao ? dataCriacao.substring(0, 7) : null
          };
        });
        logger.debug('Exemplos de datas após filtro de mês', { exemplosDatas });
      } else if (rows.length > 0) {
        // Se não encontrou nada, mostrar exemplos do que existe no banco
        const exemplosDatas = rows.slice(0, 10).map(r => {
          const dataCriacao = getDataCriacao(r);
          return {
            dataCriacaoIso: r.dataCriacaoIso,
            dataDaCriacao: r.dataDaCriacao,
            dataCriacaoNormalizada: dataCriacao,
            mesExtraido: dataCriacao ? dataCriacao.substring(0, 7) : null
          };
        });
        logger.debug('Exemplos de datas antes do filtro de mês', { exemplosDatas });
      }
    }

    // 2. Depois aplicar filtro de secretaria em memória (case-insensitive)
    // 2. Depois aplicar filtro de secretaria em memória (case-insensitive)
    if (secretariaFiltro) {
      const secretariaLower = secretariaFiltro.toLowerCase();
      logger.debug('Aplicando filtro de secretaria em memória', {
        secretaria: secretariaFiltro,
        lowercase: secretariaLower,
        totalAntes: rowsFiltrados.length
      });

      rowsFiltrados = rowsFiltrados.filter(row => {
        const orgaos = (row.orgaos || '').toLowerCase();
        // Também verificar se o campo pode ter múltiplos valores separados por " | "
        const orgaosArray = orgaos.split(' | ').map(o => o.trim());
        const match = orgaos.includes(secretariaLower) ||
          orgaosArray.some(o => o.includes(secretariaLower));
        return match;
      });

      logger.debug('Registros após filtro de secretaria', {
        secretaria: secretariaFiltro,
        total: rowsFiltrados.length
      });

      // Log de alguns exemplos de orgaos encontrados para debug
      if (rowsFiltrados.length > 0) {
        const exemplosOrgaos = [...new Set(rowsFiltrados.slice(0, 5).map(r => r.orgaos).filter(Boolean))];
        logger.debug('Exemplos de órgãos encontrados', { exemplosOrgaos });
      } else if (rows.length > 0) {
        // Se não encontrou nada, mostrar exemplos do que existe no banco
        const exemplosOrgaos = [...new Set(rows.slice(0, 20).map(r => r.orgaos).filter(Boolean))];
        logger.debug('Debug filtro de secretaria', {
          exemplosOrgaos,
          procurandoPor: secretariaFiltro,
          lowercase: secretariaLower
        });

        // Verificar se há correspondências parciais
        const matchesParciais = rows.filter(row => {
          const orgaos = (row.orgaos || '').toLowerCase();
          return orgaos.includes(secretariaLower.substring(0, 10)) ||
            secretariaLower.includes(orgaos.substring(0, 10));
        });
        if (matchesParciais.length > 0) {
          const exemplosParciais = [...new Set(matchesParciais.slice(0, 5).map(r => r.orgaos).filter(Boolean))];
          logger.debug('Correspondências parciais encontradas', {
            total: matchesParciais.length,
            exemplos: exemplosParciais
          });
        }
      }
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Processar registros e calcular vencimentos
    const protocolos = [];

    // Se o filtro de tempo de resolução está ativo, mostrar apenas protocolos CONCLUÍDOS
    // Caso contrário, mostrar apenas protocolos NÃO CONCLUÍDOS (comportamento padrão de vencimento)
    const mostrarConcluidos = tempoResolucaoFiltro && tempoResolucaoFiltro.trim() !== '';

    for (const row of rowsFiltrados) {
      // Verificar se está concluído
      const concluido = isConcluido(row);

      // Se o filtro de tempo de resolução está ativo, mostrar apenas concluídos
      // Se não está ativo, mostrar apenas não concluídos (comportamento padrão)
      if (mostrarConcluidos && !concluido) {
        continue; // Filtro ativo: pular não concluídos
      } else if (!mostrarConcluidos && concluido) {
        continue; // Filtro não ativo: pular concluídos (comportamento padrão)
      }

      // Obter data de criação
      const dataCriacao = getDataCriacao(row);
      if (!dataCriacao) continue;

      // Extrair informações
      const protocolo = row.protocolo ||
        (row.data && typeof row.data === 'object' ? row.data.protocolo : null) ||
        'N/A';

      const setor = row.unidadeCadastro ||
        (row.data && typeof row.data === 'object' ? row.data.unidade_cadastro : null) ||
        'N/A';

      const secretaria = row.orgaos ||
        (row.data && typeof row.data === 'object' ? row.data.orgaos : null) ||
        'N/A';

      const tipoManifestacao = row.tipoDeManifestacao ||
        (row.data && typeof row.data === 'object' ? row.data.tipo_de_manifestacao : null) ||
        'N/A';

      const assunto = row.assunto ||
        (row.data && typeof row.data === 'object' ? row.data.assunto : null) ||
        '';

      const tema = row.tema ||
        (row.data && typeof row.data === 'object' ? row.data.tema : null) ||
        '';

      const oQueE = assunto || tema || tipoManifestacao || 'N/A';

      let tempoResolucao = null;
      let dataVencimento = null;
      let diasRestantes = null;
      let prazo = null;

      if (mostrarConcluidos) {
        // Para protocolos concluídos: calcular tempo de resolução real
        tempoResolucao = getTempoResolucaoEmDias(row, false);

        // Aplicar filtro de tempo de resolução
        if (tempoResolucao === null) {
          continue; // Pular se não conseguiu calcular tempo de resolução
        }

        let incluirPorTempo = false;
        if (tempoResolucaoFiltro === '0-15') {
          incluirPorTempo = tempoResolucao >= 0 && tempoResolucao <= 15;
        } else if (tempoResolucaoFiltro === '16-30') {
          incluirPorTempo = tempoResolucao >= 16 && tempoResolucao <= 30;
        } else if (tempoResolucaoFiltro === '31-60') {
          incluirPorTempo = tempoResolucao >= 31 && tempoResolucao <= 60;
        } else if (tempoResolucaoFiltro === '61+') {
          incluirPorTempo = tempoResolucao > 60;
        }

        if (!incluirPorTempo) continue;

        // Para concluídos, calcular dados de vencimento para exibição (mesmo que já estejam concluídos)
        const tipo = tipoManifestacao || '';
        prazo = prazoCustomizado || getPrazoPorTipo(tipo);
        dataVencimento = calcularDataVencimentoComPrazo(dataCriacao, prazo);
        if (dataVencimento) {
          diasRestantes = calcularDiasRestantes(dataVencimento, hoje);
        }
      } else {
        // Para protocolos não concluídos: comportamento padrão de vencimento
        // Calcular data de vencimento
        const tipo = tipoManifestacao || '';

        // Usar prazo customizado se fornecido, senão usar o padrão por tipo
        prazo = prazoCustomizado || getPrazoPorTipo(tipo);
        dataVencimento = calcularDataVencimentoComPrazo(dataCriacao, prazo);
        if (!dataVencimento) continue;

        // Calcular dias restantes
        diasRestantes = calcularDiasRestantes(dataVencimento, hoje);
        if (diasRestantes === null) continue;

        // Aplicar filtro de vencimento
        let incluir = false;

        if (filtro === 'vencidos') {
          incluir = diasRestantes < 0; // Vencidos
        } else {
          const diasFiltro = parseInt(filtro);
          if (!isNaN(diasFiltro)) {
            // Próximos de vencer em X dias
            incluir = diasRestantes >= 0 && diasRestantes <= diasFiltro;
          }
        }

        if (!incluir) continue;

        // Calcular tempo decorrido para não concluídos
        try {
          const dataCriacaoDate = new Date(dataCriacao + 'T00:00:00');
          if (!isNaN(dataCriacaoDate.getTime())) {
            const diffMs = hoje.getTime() - dataCriacaoDate.getTime();
            const diasDecorridos = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diasDecorridos >= 0 && diasDecorridos <= 1000) {
              tempoResolucao = diasDecorridos;
            }
          }
        } catch (error) {
          // Ignorar erros de cálculo
          logger.debug('Erro ao calcular tempo decorrido', { error: error.message, protocolo: row.protocolo });
        }
      }

      protocolos.push({
        protocolo,
        setor,
        secretaria,
        oQueE,
        tipoManifestacao,
        dataCriacao,
        dataVencimento,
        diasRestantes,
        prazo: prazo || (prazoCustomizado || getPrazoPorTipo(tipoManifestacao || '')),
        tempoResolucao: tempoResolucao
      });
    }

    // Ordenar conforme o contexto
    if (mostrarConcluidos) {
      // Para protocolos concluídos: ordenar por tempo de resolução (maior primeiro)
      protocolos.sort((a, b) => {
        const tempoA = a.tempoResolucao || 0;
        const tempoB = b.tempoResolucao || 0;
        return tempoB - tempoA; // Maior tempo primeiro
      });
    } else {
      // Para protocolos não concluídos: ordenar por dias restantes (mais urgentes primeiro)
      protocolos.sort((a, b) => {
        // Vencidos primeiro (negativos)
        if (a.diasRestantes < 0 && b.diasRestantes >= 0) return -1;
        if (a.diasRestantes >= 0 && b.diasRestantes < 0) return 1;
        // Dentro de cada grupo, ordenar por dias restantes (menor primeiro)
        return a.diasRestantes - b.diasRestantes;
      });
    }

    return {
      total: protocolos.length,
      filtro,
      protocolos
    };
  }, null, 60000); // Timeout de 60s para endpoint pesado
}

