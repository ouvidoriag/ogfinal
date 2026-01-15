/**
 * Controller: Notificações de Email
 * 
 * Endpoints:
 * - GET /api/notificacoes - Lista todas as notificações com filtros
 * - GET /api/notificacoes/stats - Estatísticas de notificações
 * - GET /api/notificacoes/ultima-execucao - Verifica última execução do cron
 * - GET /api/notificacoes/vencimentos - Busca vencimentos (otimizado, apenas visualização)
 * - POST /api/notificacoes/enviar-selecionados - Envia emails para secretarias selecionadas
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache, safeQuery } from '../../utils/formatting/responseHelper.js';
import { getDataCriacao, isConcluido } from '../../utils/formatting/dateUtils.js';
import NotificacaoEmail from '../../models/NotificacaoEmail.model.js';
import Record from '../../models/Record.model.js';

/**
 * GET /api/notificacoes
 * Lista todas as notificações com filtros opcionais
 * 
 * Query params:
 * - tipo: '15_dias' | 'vencimento' | '30_dias_vencido' | '60_dias_vencido' | 'resumo_geral'
 * - secretaria: Nome da secretaria (busca parcial, case-insensitive)
 * - status: 'enviado' | 'erro' | 'pendente'
 * - protocolo: Número do protocolo (busca parcial, case-insensitive)
 * - emailSecretaria: Email da secretaria (busca parcial, case-insensitive)
 * - dataInicio: YYYY-MM-DD (filtro por data de envio)
 * - dataFim: YYYY-MM-DD (filtro por data de envio)
 * - limit: Número de resultados (padrão: 100)
 * - page: Página (padrão: 1)
 */
export async function getNotificacoes(req, res) {
  // Criar chave de cache baseada nos filtros para evitar cache incorreto
  const { tipo, secretaria, status, protocolo, emailSecretaria, dataInicio, dataFim, limit, page } = req.query;
  const cacheKey = `notificacoes:list:${JSON.stringify({ tipo, secretaria, status, protocolo, emailSecretaria, dataInicio, dataFim, limit, page })}:v3`;
  const ttlSeconds = 60; // Cache de 1 minuto

  return withCache(
    cacheKey,
    ttlSeconds,
    res,
    async () => {
      const {
        tipo,
        secretaria,
        status,
        protocolo,
        emailSecretaria,
        dataInicio,
        dataFim,
        limit = 100,
        page = 1
      } = req.query;

      // Construir filtros
      const filter = {};

      // Filtro por tipo de notificação
      if (tipo) {
        filter.tipoNotificacao = tipo;
      }

      // Filtro por secretaria (busca parcial, case-insensitive)
      if (secretaria) {
        filter.secretaria = { $regex: secretaria, $options: 'i' };
      }

      // Filtro por status da notificação (enviado, erro, pendente)
      if (status) {
        filter.status = status;
      }

      // Filtro por protocolo (busca parcial, case-insensitive)
      if (protocolo) {
        filter.protocolo = { $regex: protocolo, $options: 'i' };
      }

      // Filtro por email da secretaria (busca parcial, case-insensitive)
      if (emailSecretaria) {
        filter.emailSecretaria = { $regex: emailSecretaria, $options: 'i' };
      }

      // Filtro por período de envio
      if (dataInicio || dataFim) {
        filter.enviadoEm = {};
        if (dataInicio) {
          filter.enviadoEm.$gte = new Date(dataInicio + 'T00:00:00');
        }
        if (dataFim) {
          filter.enviadoEm.$lte = new Date(dataFim + 'T23:59:59');
        }
      }

      // Calcular paginação
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // Buscar total
      const total = await NotificacaoEmail.countDocuments(filter);

      // Buscar notificações
      const notificacoes = await NotificacaoEmail.find(filter)
        .sort({ enviadoEm: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      return {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        notificacoes
      };
    }
  );
}

/**
 * GET /api/notificacoes/meses-disponiveis
 * Retorna lista de meses únicos com notificações (para popular select)
 */
export async function getMesesDisponiveis(req, res) {
  const cacheKey = 'notificacoes:meses-disponiveis:v1';
  const ttlSeconds = 300; // Cache de 5 minutos

  return withCache(
    cacheKey,
    ttlSeconds,
    res,
    async () => {
      // Agregação para obter meses únicos (YYYY-MM) das datas de envio
      const meses = await NotificacaoEmail.aggregate([
        {
          $match: {
            enviadoEm: { $exists: true, $ne: null }
          }
        },
        {
          $project: {
            ano: { $year: '$enviadoEm' },
            mes: { $month: '$enviadoEm' }
          }
        },
        {
          $group: {
            _id: {
              ano: '$ano',
              mes: '$mes'
            }
          }
        },
        {
          $project: {
            _id: 0,
            mes: {
              $concat: [
                { $toString: '$_id.ano' },
                '-',
                {
                  $cond: [
                    { $lt: ['$_id.mes', 10] },
                    { $concat: ['0', { $toString: '$_id.mes' }] },
                    { $toString: '$_id.mes' }
                  ]
                }
              ]
            }
          }
        },
        {
          $sort: { mes: -1 } // Mais recente primeiro
        }
      ]);

      return meses.map(m => m.mes);
    }
  );
}

/**
 * GET /api/notificacoes/stats
 * Estatísticas de notificações
 */
export async function getNotificacoesStats(req, res) {
  const cacheKey = 'notificacoes:stats:v2';
  const ttlSeconds = 300; // Cache de 5 minutos

  return withCache(
    cacheKey,
    ttlSeconds,
    res,
    async () => {
      // Total de notificações
      const total = await NotificacaoEmail.countDocuments();

      // Por status
      const porStatus = await NotificacaoEmail.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Por tipo
      const porTipo = await NotificacaoEmail.aggregate([
        { $group: { _id: '$tipoNotificacao', count: { $sum: 1 } } }
      ]);

      // Por secretaria (top 10)
      const porSecretaria = await NotificacaoEmail.aggregate([
        { $group: { _id: '$secretaria', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Últimas 24 horas
      const ultimas24h = new Date();
      ultimas24h.setHours(ultimas24h.getHours() - 24);
      const total24h = await NotificacaoEmail.countDocuments({
        enviadoEm: { $gte: ultimas24h }
      });

      // Hoje
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const totalHoje = await NotificacaoEmail.countDocuments({
        enviadoEm: { $gte: hoje }
      });

      // Última notificação
      const ultimaNotificacao = await NotificacaoEmail.findOne({})
        .sort({ enviadoEm: -1 })
        .lean();

      return {
        total,
        porStatus: porStatus.map(s => ({
          status: s._id,
          total: s.count
        })),
        porTipo: porTipo.map(t => ({
          tipo: t._id,
          total: t.count
        })),
        porSecretaria: porSecretaria.map(s => ({
          secretaria: s._id,
          total: s.count
        })),
        ultimas24h: total24h,
        hoje: totalHoje,
        ultimaNotificacao: ultimaNotificacao ? {
          enviadoEm: ultimaNotificacao.enviadoEm,
          tipo: ultimaNotificacao.tipoNotificacao,
          secretaria: ultimaNotificacao.secretaria
        } : null
      };
    }
  );
}

/**
 * GET /api/notificacoes/ultima-execucao
 * Verifica última execução do cron e quantos emails foram enviados hoje
 */
export async function getUltimaExecucao(req, res) {
  return safeQuery(res, async () => {
    // Hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Última notificação enviada
    const ultimaNotificacao = await NotificacaoEmail.findOne({ status: 'enviado' })
      .sort({ enviadoEm: -1 })
      .lean();

    // Notificações enviadas hoje
    const hojeEnviadas = await NotificacaoEmail.countDocuments({
      status: 'enviado',
      enviadoEm: { $gte: hoje }
    });

    // Notificações com erro hoje
    const hojeErros = await NotificacaoEmail.countDocuments({
      status: 'erro',
      enviadoEm: { $gte: hoje }
    });

    // Agrupar por tipo hoje
    const porTipoHoje = await NotificacaoEmail.aggregate([
      { $match: { status: 'enviado', enviadoEm: { $gte: hoje } } },
      { $group: { _id: '$tipoNotificacao', count: { $sum: 1 } } }
    ]);

    // Agrupar por secretaria hoje
    const porSecretariaHoje = await NotificacaoEmail.aggregate([
      { $match: { status: 'enviado', enviadoEm: { $gte: hoje } } },
      { $group: { _id: '$secretaria', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return {
      ultimaExecucao: ultimaNotificacao ? {
        data: ultimaNotificacao.enviadoEm,
        tipo: ultimaNotificacao.tipoNotificacao,
        secretaria: ultimaNotificacao.secretaria,
        protocolo: ultimaNotificacao.protocolo
      } : null,
      hoje: {
        totalEnviados: hojeEnviadas,
        totalErros: hojeErros,
        porTipo: porTipoHoje.map(t => ({
          tipo: t._id,
          total: t.count
        })),
        porSecretaria: porSecretariaHoje.map(s => ({
          secretaria: s._id,
          total: s.count
        }))
      }
    };
  });
}

/**
 * GET /api/notificacoes/vencimentos
 * Busca vencimentos sem enviar emails (apenas para visualização)
 * OTIMIZADO: Filtra por range de datas no banco, batch queries, cache de emails
 * 
 * Query params:
 * - tipo: 'hoje' | '15' | '30' | '60' | 'geral' (padrão: 'hoje')
 *   - 'hoje': Vencimentos hoje
 *   - '15': Vencimentos em 15 dias
 *   - '30': Vencimentos há 30+ dias
 *   - '60': Vencimentos há 60+ dias
 *   - 'geral': Consolidação geral (vencidos a partir de 30 dias)
 */
export async function buscarVencimentos(req, res) {
  const { tipo = 'hoje' } = req.query;

  const cacheKey = `notificacoes:vencimentos:${tipo}:v2`;
  const ttlSeconds = 300; // Cache de 5 minutos

  return withCache(
    cacheKey,
    ttlSeconds,
    res,
    async () => {
      // Importar funções necessárias
      const { getEmailSecretaria } = await import('../../services/email-notifications/emailConfig.js');

      // Funções auxiliares
      function getPrazoPorTipo(tipoDeManifestacao) {
        if (!tipoDeManifestacao) return 30;
        const tipo = String(tipoDeManifestacao).toLowerCase().trim();
        if (tipo.includes('sic') || tipo.includes('pedido de informação') ||
          tipo.includes('pedido de informacao') || tipo.includes('informação') ||
          tipo.includes('informacao')) {
          return 20;
        }
        return 30;
      }

      function calcularDataVencimento(dataCriacao, prazo) {
        if (!dataCriacao) return null;
        const data = new Date(dataCriacao + 'T00:00:00');
        if (isNaN(data.getTime())) return null;
        data.setDate(data.getDate() + prazo);
        return data.toISOString().slice(0, 10);
      }

      function calcularDiasRestantes(dataVencimento, hoje) {
        if (!dataVencimento) return null;
        const venc = new Date(dataVencimento + 'T00:00:00');
        if (isNaN(venc.getTime())) return null;
        const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
        return diff;
      }

      // Calcular dias alvo
      let diasAlvo;
      let tipoNotificacao;
      if (tipo === 'hoje') {
        diasAlvo = 0;
        tipoNotificacao = 'vencimento';
      } else if (tipo === '15') {
        diasAlvo = 15;
        tipoNotificacao = '15_dias';
      } else if (tipo === '30') {
        diasAlvo = -30;
        tipoNotificacao = '30_dias_vencido';
      } else if (tipo === '60') {
        diasAlvo = -60;
        tipoNotificacao = '60_dias_vencido';
      } else if (tipo === 'geral') {
        diasAlvo = -30; // Consolidação geral: a partir de 30 dias
        tipoNotificacao = 'consolidacao_geral';
      } else {
        return res.status(400).json({ error: 'Tipo inválido. Use: hoje, 15, 30, 60 ou geral' });
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const dataAlvo = new Date(hoje);
      dataAlvo.setDate(hoje.getDate() + diasAlvo);
      const dataAlvoStr = dataAlvo.toISOString().slice(0, 10);

      // OTIMIZAÇÃO 1: Calcular range de datas de criação para filtrar no banco
      let dataCriacaoMin = null;
      let dataCriacaoMax = null;

      if (diasAlvo === 0) {
        // Vencimento hoje: buscar registros criados há 20-35 dias (SIC: 20, Ouvidoria: 30)
        dataCriacaoMin = new Date(hoje);
        dataCriacaoMin.setDate(hoje.getDate() - 35);
        dataCriacaoMax = new Date(hoje);
        dataCriacaoMax.setDate(hoje.getDate() - 15);
      } else if (diasAlvo === 15) {
        // Vencimento em 15 dias: buscar registros criados há 0-20 dias
        dataCriacaoMin = new Date(hoje);
        dataCriacaoMin.setDate(hoje.getDate() - 20);
        dataCriacaoMax = new Date(hoje);
      } else if (diasAlvo === -30) {
        // Vencimento há 30 dias: buscar registros criados há 60-90 dias
        dataCriacaoMin = new Date(hoje);
        dataCriacaoMin.setDate(hoje.getDate() - 90);
        dataCriacaoMax = new Date(hoje);
        dataCriacaoMax.setDate(hoje.getDate() - 30);
      } else if (diasAlvo === -60) {
        // Vencimento há 60 dias: buscar registros criados há 90-125 dias
        dataCriacaoMin = new Date(hoje);
        dataCriacaoMin.setDate(hoje.getDate() - 125);
        dataCriacaoMax = new Date(hoje);
        dataCriacaoMax.setDate(hoje.getDate() - 85);
      }

      // Construir filtro otimizado
      const filter = {
        $or: [
          { dataCriacaoIso: { $ne: null } },
          { dataDaCriacao: { $ne: null } }
        ]
      };

      // OTIMIZAÇÃO 2: Filtrar por range de datas no banco
      if (dataCriacaoMin && dataCriacaoMax) {
        const minStr = dataCriacaoMin.toISOString().slice(0, 10);
        const maxStr = dataCriacaoMax.toISOString().slice(0, 10);

        filter.$and = [
          {
            $or: [
              { dataCriacaoIso: { $gte: minStr, $lte: maxStr } },
              {
                $and: [
                  { dataDaCriacao: { $ne: null } },
                  {
                    $or: [
                      { dataDaCriacao: { $regex: dataCriacaoMin.getFullYear().toString() } },
                      { dataDaCriacao: { $regex: dataCriacaoMax.getFullYear().toString() } }
                    ]
                  }
                ]
              }
            ]
          }
        ];
      }

      // Buscar registros no range (muito mais rápido)
      const records = await Record.find(filter)
        .select('_id protocolo dataCriacaoIso dataDaCriacao tipoDeManifestacao tema assunto orgaos status statusDemanda data')
        .limit(20000)
        .lean();

      // Processar protocolos
      const protocolosEncontrados = [];

      for (const record of records) {
        if (isConcluido(record)) continue;

        const dataCriacao = getDataCriacao(record);
        if (!dataCriacao) continue;

        const tipoManifest = record.tipoDeManifestacao ||
          (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
          '';

        const prazo = getPrazoPorTipo(tipoManifest);
        const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
        if (!dataVencimento) continue;

        // Para tipos de vencimento negativo (30, 60, geral), mostrar todos vencidos há X+ dias
        // Para outros tipos, verificar data exata
        if (tipo === '30' || tipo === '60' || tipo === 'geral') {
          // Verificar se está vencido há X+ dias (dataVencimento <= dataAlvo)
          if (dataVencimento > dataAlvoStr) continue;
        } else {
          // Para 'hoje' e '15', verificar data exata
          if (dataVencimento !== dataAlvoStr) continue;
        }

        const protocolo = record.protocolo ||
          (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
          'N/A';

        const secretaria = record.orgaos ||
          (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
          'N/A';

        const assunto = record.assunto ||
          (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
          '';

        protocolosEncontrados.push({
          protocolo,
          secretaria,
          dataVencimento,
          assunto,
          tipoManifestacao: tipoManifest,
          prazo
        });
      }

      // OTIMIZAÇÃO 3: Buscar notificações existentes em batch
      const protocolosList = protocolosEncontrados.map(p => p.protocolo).filter(p => p !== 'N/A');
      const notificacoesExistentes = protocolosList.length > 0 ? await NotificacaoEmail.find({
        protocolo: { $in: protocolosList },
        tipoNotificacao: tipoNotificacao,
        status: 'enviado'
      })
        .select('protocolo')
        .lean() : [];

      const protocolosJaNotificados = new Set(notificacoesExistentes.map(n => n.protocolo));

      // OTIMIZAÇÃO 4: Cache de emails (buscar do banco de uma vez)
      const secretariasUnicas = [...new Set(protocolosEncontrados.map(p => p.secretaria))];

      // Usar função que busca emails corretamente do banco (incluindo alternateEmail)
      const { getEmailSecretariaFromDB } = await import('../../services/email-notifications/emailConfig.js');

      const emailsCache = new Map();

      // Buscar emails de todas as secretarias em paralelo
      const promises = secretariasUnicas.map(async (secretaria) => {
        const email = await getEmailSecretariaFromDB(secretaria, null);
        return { secretaria, email };
      });

      const resultados = await Promise.all(promises);
      resultados.forEach(({ secretaria, email }) => {
        emailsCache.set(secretaria, email);
      });

      // Agrupar por secretaria
      const porSecretaria = {};

      for (const prot of protocolosEncontrados) {
        const jaNotificado = protocolosJaNotificados.has(prot.protocolo);
        const diasRestantes = calcularDiasRestantes(prot.dataVencimento, hoje);
        const emailSecretaria = emailsCache.get(prot.secretaria) || 'N/A';

        if (!porSecretaria[prot.secretaria]) {
          porSecretaria[prot.secretaria] = {
            secretaria: prot.secretaria,
            email: emailSecretaria,
            protocolos: []
          };
        }

        porSecretaria[prot.secretaria].protocolos.push({
          protocolo: prot.protocolo,
          dataVencimento: prot.dataVencimento,
          diasRestantes,
          assunto: prot.assunto,
          tipoManifestacao: prot.tipoManifestacao,
          prazo: prot.prazo,
          jaNotificado
        });
      }

      // Converter para array
      const emails = Object.values(porSecretaria);

      return {
        tipo,
        tipoNotificacao,
        dataAlvo: dataAlvoStr,
        totalSecretarias: emails.length,
        totalProtocolos: emails.reduce((sum, e) => sum + e.protocolos.length, 0),
        emails: emails.map(e => ({
          ...e,
          totalProtocolos: e.protocolos.length,
          jaNotificados: e.protocolos.filter(p => p.jaNotificado).length,
          naoNotificados: e.protocolos.filter(p => !p.jaNotificado).length
        }))
      };
    }
  );
}

/**
 * POST /api/notificacoes/enviar-selecionados
 * Envia emails para as secretarias selecionadas
 * OTIMIZADO: Batch de registros, processamento paralelo limitado
 * 
 * Body: {
 *   tipo: 'hoje' | '15' | '30' | '60' | 'geral',
 *   secretarias: ['Secretaria 1', 'Secretaria 2', ...]
 * }
 */
export async function enviarSelecionados(req, res) {
  return safeQuery(res, async () => {
    const { tipo, secretarias } = req.body;

    if (!tipo || !Array.isArray(secretarias) || secretarias.length === 0) {
      return res.status(400).json({
        error: 'Tipo e lista de secretarias são obrigatórios'
      });
    }

    // Importar funções necessárias
    const { sendEmail } = await import('../../services/email-notifications/gmailService.js');
    const {
      getEmailSecretaria,
      EMAIL_REMETENTE,
      NOME_REMETENTE,
      EMAIL_OUVIDORIA_GERAL,
      getTemplate15Dias,
      getTemplateVencimento,
      getTemplate30Dias,
      getTemplate60Dias,
      getTemplateConsolidacaoGeral,
      getTemplateResumoOuvidoriaGeral
    } = await import('../../services/email-notifications/emailConfig.js');

    // Funções auxiliares
    function getPrazoPorTipo(tipoDeManifestacao) {
      if (!tipoDeManifestacao) return 30;
      const tipo = String(tipoDeManifestacao).toLowerCase().trim();
      if (tipo.includes('sic') || tipo.includes('pedido de informação') ||
        tipo.includes('pedido de informacao') || tipo.includes('informação') ||
        tipo.includes('informacao')) {
        return 20;
      }
      return 30;
    }

    function calcularDataVencimento(dataCriacao, prazo) {
      if (!dataCriacao) return null;
      const data = new Date(dataCriacao + 'T00:00:00');
      if (isNaN(data.getTime())) return null;
      data.setDate(data.getDate() + prazo);
      return data.toISOString().slice(0, 10);
    }

    function calcularDiasRestantes(dataVencimento, hoje) {
      if (!dataVencimento) return null;
      const venc = new Date(dataVencimento + 'T00:00:00');
      if (isNaN(venc.getTime())) return null;
      const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
      return diff;
    }

    // Calcular dias alvo e template
    let diasAlvo;
    let tipoNotificacao;
    let getTemplate;

    if (tipo === 'hoje') {
      diasAlvo = 0;
      tipoNotificacao = 'vencimento';
      getTemplate = getTemplateVencimento;
    } else if (tipo === '15') {
      diasAlvo = 15;
      tipoNotificacao = '15_dias';
      getTemplate = getTemplate15Dias;
    } else if (tipo === '30') {
      diasAlvo = -30;
      tipoNotificacao = '30_dias_vencido';
      getTemplate = getTemplate30Dias;
    } else if (tipo === '60') {
      diasAlvo = -60;
      tipoNotificacao = '60_dias_vencido';
      getTemplate = getTemplate60Dias;
    } else if (tipo === 'geral') {
      diasAlvo = -30; // Consolidação geral: a partir de 30 dias
      tipoNotificacao = 'consolidacao_geral';
      getTemplate = getTemplateConsolidacaoGeral;
    } else {
      return res.status(400).json({ error: 'Tipo inválido. Use: hoje, 15, 30, 60 ou geral' });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataAlvo = new Date(hoje);
    dataAlvo.setDate(hoje.getDate() + diasAlvo);
    const dataAlvoStr = dataAlvo.toISOString().slice(0, 10);

    // OTIMIZAÇÃO: Filtrar por range de datas e secretarias no banco
    let dataCriacaoMin = null;
    let dataCriacaoMax = null;

    if (diasAlvo === 0) {
      dataCriacaoMin = new Date(hoje);
      dataCriacaoMin.setDate(hoje.getDate() - 35);
      dataCriacaoMax = new Date(hoje);
      dataCriacaoMax.setDate(hoje.getDate() - 15);
    } else if (diasAlvo === 15) {
      dataCriacaoMin = new Date(hoje);
      dataCriacaoMin.setDate(hoje.getDate() - 20);
      dataCriacaoMax = new Date(hoje);
    } else if (diasAlvo === -30) {
      dataCriacaoMin = new Date(hoje);
      dataCriacaoMin.setDate(hoje.getDate() - 90);
      dataCriacaoMax = new Date(hoje);
      dataCriacaoMax.setDate(hoje.getDate() - 30);
    } else if (diasAlvo === -60) {
      dataCriacaoMin = new Date(hoje);
      dataCriacaoMin.setDate(hoje.getDate() - 125);
      dataCriacaoMax = new Date(hoje);
      dataCriacaoMax.setDate(hoje.getDate() - 85);
    }

    const filter = {
      $or: [
        { dataCriacaoIso: { $ne: null } },
        { dataDaCriacao: { $ne: null } }
      ],
      orgaos: { $in: secretarias }
    };

    if (dataCriacaoMin && dataCriacaoMax) {
      const minStr = dataCriacaoMin.toISOString().slice(0, 10);
      const maxStr = dataCriacaoMax.toISOString().slice(0, 10);

      filter.$and = [
        {
          $or: [
            { dataCriacaoIso: { $gte: minStr, $lte: maxStr } },
            {
              $and: [
                { dataDaCriacao: { $ne: null } },
                {
                  $or: [
                    { dataDaCriacao: { $regex: dataCriacaoMin.getFullYear().toString() } },
                    { dataDaCriacao: { $regex: dataCriacaoMax.getFullYear().toString() } }
                  ]
                }
              ]
            }
          ]
        }
      ];
    }

    // Buscar protocolos para as secretarias selecionadas
    const records = await Record.find(filter)
      .select('_id protocolo dataCriacaoIso dataDaCriacao tipoDeManifestacao tema assunto orgaos status statusDemanda data')
      .lean();

    const resultados = {
      enviados: 0,
      erros: 0,
      detalhes: []
    };

    // Agrupar por secretaria
    const porSecretaria = {};

    for (const record of records) {
      if (isConcluido(record)) continue;

      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;

      const tipoManifest = record.tipoDeManifestacao ||
        (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
        '';

      const prazo = getPrazoPorTipo(tipoManifest);
      const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
      if (!dataVencimento) continue;

      // Para tipos de vencimento negativo (30, 60, geral), mostrar todos vencidos há X+ dias
      // Para outros tipos, verificar data exata
      if (tipo === '30' || tipo === '60' || tipo === 'geral') {
        // Verificar se está vencido há X+ dias (dataVencimento <= dataAlvo)
        if (dataVencimento > dataAlvoStr) continue;
      } else {
        // Para 'hoje' e '15', verificar data exata
        if (dataVencimento !== dataAlvoStr) continue;
      }

      const protocolo = record.protocolo ||
        (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
        'N/A';

      const secretaria = record.orgaos ||
        (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
        'N/A';

      if (!secretarias.includes(secretaria)) continue;

      const assunto = record.assunto ||
        (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
        '';

      const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);

      if (!porSecretaria[secretaria]) {
        porSecretaria[secretaria] = [];
      }

      porSecretaria[secretaria].push({
        protocolo,
        dataVencimento,
        diasRestantes,
        assunto,
        tipoManifestacao: tipoManifest
      });
    }

    // OTIMIZAÇÃO: Cache de emails (buscar do banco de uma vez)
    // Usar função que busca emails corretamente do banco (incluindo alternateEmail)
    const { getEmailSecretariaFromDB } = await import('../../services/email-notifications/emailConfig.js');

    const emailsCache = new Map();

    // Buscar emails de todas as secretarias em paralelo
    const emailPromises = secretarias.map(async (secretaria) => {
      const email = await getEmailSecretariaFromDB(secretaria, null);
      return { secretaria, email };
    });

    const emailResultados = await Promise.all(emailPromises);
    emailResultados.forEach(({ secretaria, email }) => {
      emailsCache.set(secretaria, email);
    });

    // Enviar emails (processamento paralelo limitado)
    const BATCH_SIZE = 5; // Limitar a 5 emails por vez
    const sendPromises = [];

    for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
      if (protocolos.length === 0) continue;

      sendPromises.push(
        (async () => {
          const emailSecretaria = emailsCache.get(secretaria);
          if (!emailSecretaria) {
            resultados.erros++;
            resultados.detalhes.push({
              secretaria,
              status: 'erro',
              motivo: 'Email não encontrado'
            });
            return;
          }

          try {
            const template = await getTemplate({
              secretaria,
              protocolos: protocolos
            });

            const { messageId } = await sendEmail(
              emailSecretaria,
              template.subject,
              template.html,
              template.text,
              EMAIL_REMETENTE,
              NOME_REMETENTE
            );

            // OTIMIZAÇÃO: Batch insert de notificações
            await NotificacaoEmail.insertMany(
              protocolos.map(prot => ({
                protocolo: prot.protocolo,
                secretaria: secretaria,
                emailSecretaria: emailSecretaria,
                tipoNotificacao: tipoNotificacao,
                dataVencimento: prot.dataVencimento,
                diasRestantes: prot.diasRestantes,
                messageId: messageId,
                status: 'enviado',
                enviadoEm: new Date()
              }))
            );

            resultados.enviados++;
            resultados.detalhes.push({
              secretaria,
              email: emailSecretaria,
              protocolos: protocolos.length,
              status: 'enviado',
              messageId
            });
          } catch (error) {
            resultados.erros++;
            resultados.detalhes.push({
              secretaria,
              email: emailSecretaria,
              status: 'erro',
              motivo: error.message
            });

            // Batch insert de erros
            await NotificacaoEmail.insertMany(
              protocolos.map(prot => ({
                protocolo: prot.protocolo,
                secretaria: secretaria,
                emailSecretaria: emailSecretaria,
                tipoNotificacao: tipoNotificacao,
                dataVencimento: prot.dataVencimento,
                diasRestantes: prot.diasRestantes,
                status: 'erro',
                mensagemErro: error.message,
                enviadoEm: new Date()
              }))
            );
          }
        })()
      );
    }

    // Executar em batches paralelos
    for (let i = 0; i < sendPromises.length; i += BATCH_SIZE) {
      await Promise.all(sendPromises.slice(i, i + BATCH_SIZE));
    }

    // Enviar resumo para Ouvidoria Geral (apenas para tipo "hoje")
    if (tipo === 'hoje' && EMAIL_OUVIDORIA_GERAL && resultados.enviados > 0) {
      try {
        // Verificar se há demandas para enviar
        const totalDemandas = Object.values(porSecretaria).reduce((sum, arr) => sum + arr.length, 0);

        if (totalDemandas > 0) {
          const template = await getTemplateResumoOuvidoriaGeral(porSecretaria);

          // Separar múltiplos emails (separados por vírgula)
          const emails = EMAIL_OUVIDORIA_GERAL.split(',').map(e => e.trim()).filter(e => e);

          const resumosEnviados = [];

          // Enviar para cada email
          for (const email of emails) {
            try {
              const { messageId } = await sendEmail(
                email,
                template.subject,
                template.html,
                template.text,
                EMAIL_REMETENTE,
                NOME_REMETENTE
              );

              resumosEnviados.push({ email, messageId, status: 'enviado' });
            } catch (error) {
              resumosEnviados.push({ email, status: 'erro', erro: error.message });
              console.error(`Erro ao enviar resumo para ${email}:`, error.message);
            }
          }

          resultados.resumoEnviado = resumosEnviados.length > 0;
          resultados.resumosEnviados = resumosEnviados;
          resultados.resumoEmails = emails;
          resultados.totalDemandasResumo = totalDemandas;
        }
      } catch (error) {
        // Não bloquear o processo se o resumo falhar
        resultados.resumoEnviado = false;
        resultados.resumoErro = error.message;
        console.error('Erro ao enviar resumo para Ouvidoria Geral:', error);
      }
    }

    return resultados;
  });
}

/**
 * POST /api/notificacoes/enviar-extra
 * Envia email extra para emails informados manualmente
 * 
 * Body: {
 *   emails: ['email1@exemplo.com', 'email2@exemplo.com', ...]
 * }
 */
export async function enviarEmailExtra(req, res) {
  return safeQuery(res, async () => {
    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        error: 'Lista de emails é obrigatória'
      });
    }

    // Validar formato de emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailsInvalidos = emails.filter(e => !emailRegex.test(e));
    if (emailsInvalidos.length > 0) {
      return res.status(400).json({
        error: `Emails inválidos: ${emailsInvalidos.join(', ')}`
      });
    }

    // Importar funções necessárias
    const { sendEmail } = await import('../../services/email-notifications/gmailService.js');
    const {
      EMAIL_REMETENTE,
      NOME_REMETENTE
    } = await import('../../services/email-notifications/emailConfig.js');

    const resultados = {
      enviados: 0,
      erros: 0,
      detalhes: []
    };

    // Template simples para envio extra
    const template = {
      subject: 'Comunicação da Ouvidoria Geral de Duque de Caxias',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #e3f2fd; border-left: 4px solid #2196f3; color: #333; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px 20px; background: #fff; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📧 Ouvidoria Geral de Duque de Caxias</h2>
              <p>Comunicação Extra</p>
            </div>
            <div class="content">
              <h3>Prezados(as),</h3>
              
              <p style="font-size: 16px; margin: 20px 0;">
                Este é um email extra enviado pela Ouvidoria Geral de Duque de Caxias.
              </p>
              
              <p style="margin-top: 20px;">
                Permanecemos à disposição para quaisquer esclarecimentos.
              </p>
              
              <p style="margin-top: 20px;">
                Atenciosamente,<br>
                <strong>Ouvidoria Geral de Duque de Caxias</strong>
              </p>
            </div>
            <div class="footer">
              <p>Este é um email automático do sistema de Ouvidoria Geral de Duque de Caxias.</p>
              <p>Por favor, não responda este email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Ouvidoria Geral de Duque de Caxias
Comunicação Extra

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezados(as),

Este é um email extra enviado pela Ouvidoria Geral de Duque de Caxias.

Permanecemos à disposição para quaisquer esclarecimentos.

Atenciosamente,
Ouvidoria Geral de Duque de Caxias

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este é um email automático. Por favor, não responda.
      `.trim()
    };

    // Enviar para cada email
    const BATCH_SIZE = 5; // Limitar a 5 emails por vez
    const sendPromises = [];

    for (const email of emails) {
      sendPromises.push(
        (async () => {
          try {
            const { messageId } = await sendEmail(
              email,
              template.subject,
              template.html,
              template.text,
              EMAIL_REMETENTE,
              NOME_REMETENTE
            );

            // Registrar notificação
            await NotificacaoEmail.create({
              protocolo: 'EXTRA',
              secretaria: 'Envio Extra',
              emailSecretaria: email,
              tipoNotificacao: 'envio_extra',
              status: 'enviado',
              messageId: messageId,
              enviadoEm: new Date()
            });

            resultados.enviados++;
            resultados.detalhes.push({
              email,
              status: 'enviado',
              messageId
            });
          } catch (error) {
            resultados.erros++;
            resultados.detalhes.push({
              email,
              status: 'erro',
              motivo: error.message
            });

            // Registrar erro
            await NotificacaoEmail.create({
              protocolo: 'EXTRA',
              secretaria: 'Envio Extra',
              emailSecretaria: email,
              tipoNotificacao: 'envio_extra',
              status: 'erro',
              mensagemErro: error.message,
              enviadoEm: new Date()
            });
          }
        })()
      );
    }

    // Executar em batches paralelos
    for (let i = 0; i < sendPromises.length; i += BATCH_SIZE) {
      await Promise.all(sendPromises.slice(i, i + BATCH_SIZE));
    }

    return resultados;
  });
}

