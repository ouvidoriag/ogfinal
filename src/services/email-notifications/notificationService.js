/**
 * Serviço de Notificações por Email
 * Identifica demandas que precisam de notificação e envia emails
 */

import logger from '../../utils/logger.js';
import { getDataCriacao, isConcluido } from '../../utils/formatting/dateUtils.js';
import { sendEmail } from './gmailService.js';
import {
  getEmailsSecretariaFromDB,
  EMAIL_REMETENTE,
  NOME_REMETENTE,
  EMAIL_OUVIDORIA_GERAL,
  getTemplate15Dias,
  getTemplateVencimento,
  getTemplate60Dias,
  getTemplateResumoOuvidoriaGeral
} from './emailConfig.js';
import NotificacaoEmail from '../../models/NotificacaoEmail.model.js';
import Record from '../../models/Record.model.js';

/**
 * Obter prazo por tipo de manifestação
 */
function getPrazoPorTipo(tipoDeManifestacao) {
  if (!tipoDeManifestacao) return 30;

  const tipo = String(tipoDeManifestacao).toLowerCase().trim();

  if (tipo.includes('sic') ||
    tipo.includes('pedido de informação') ||
    tipo.includes('pedido de informacao') ||
    tipo.includes('informação') ||
    tipo.includes('informacao')) {
    return 20;
  }

  return 30;
}

/**
 * Calcula a data de vencimento baseado na data de criação e prazo em dias
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
 * Verificar se já foi enviada notificação do tipo especificado
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function jaFoiNotificado(prisma, protocolo, tipoNotificacao) {
  const notificacao = await NotificacaoEmail.findOne({
    protocolo: protocolo,
    tipoNotificacao: tipoNotificacao,
    status: 'enviado'
  }).lean();

  return !!notificacao;
}

/**
 * Registrar notificação no banco
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function registrarNotificacao(prisma, dados) {
  const {
    protocolo,
    secretaria,
    emailSecretaria,
    tipoNotificacao,
    dataVencimento,
    diasRestantes,
    messageId,
    status = 'enviado',
    mensagemErro = null
  } = dados;

  try {
    const notificacao = await NotificacaoEmail.create({
      protocolo,
      secretaria,
      emailSecretaria,
      tipoNotificacao,
      dataVencimento,
      diasRestantes,
      messageId,
      status,
      mensagemErro
    });

    return notificacao;
  } catch (error) {
    logger.errorWithContext('Erro ao registrar notificação', error, { protocolo, tipoNotificacao });
    throw error;
  }
}

/**
 * Buscar demandas que precisam de notificação de 15 dias
 */
async function buscarDemandas15Dias(prisma) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Data de vencimento em 15 dias
  const dataVencimento15Dias = new Date(hoje);
  dataVencimento15Dias.setDate(hoje.getDate() + 15);
  const dataVencimento15DiasStr = dataVencimento15Dias.toISOString().slice(0, 10);

  // Buscar todas as demandas não concluídas
  // REFATORAÇÃO: Prisma → Mongoose
  const records = await Record.find({
    $or: [
      { dataCriacaoIso: { $ne: null, $exists: true } },
      { dataDaCriacao: { $ne: null, $exists: true } }
    ]
  })
    .select('protocolo dataCriacaoIso dataDaCriacao tipoDeManifestacao tema assunto orgaos status statusDemanda data')
    .lean();

  const demandas = [];

  for (const record of records) {
    // Pular concluídos
    if (isConcluido(record)) continue;

    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) continue;

    const tipo = record.tipoDeManifestacao ||
      (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
      '';

    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimentoComPrazo(dataCriacao, prazo);
    if (!dataVencimento) continue;

    // Verificar se vence em 15 dias (com margem de 1 dia)
    if (dataVencimento === dataVencimento15DiasStr ||
      dataVencimento === calcularDataVencimentoComPrazo(hoje.toISOString().slice(0, 10), 15)) {

      const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);

      // Verificar se já foi notificado
      const protocolo = record.protocolo ||
        (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
        'N/A';

      if (await jaFoiNotificado(prisma, protocolo, '15_dias')) {
        continue;
      }

      const secretaria = record.orgaos ||
        (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
        'N/A';

      const assunto = record.assunto ||
        (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
        '';

      demandas.push({
        protocolo,
        secretaria,
        dataVencimento,
        diasRestantes,
        assunto,
        tipoManifestacao: tipo
      });
    }
  }

  return demandas;
}

/**
 * Buscar demandas que vencem hoje
 */
async function buscarDemandasVencimentoHoje(prisma) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);

  // REFATORAÇÃO: Prisma → Mongoose
  const records = await Record.find({
    $or: [
      { dataCriacaoIso: { $ne: null, $exists: true } },
      { dataDaCriacao: { $ne: null, $exists: true } }
    ]
  })
    .select('protocolo dataCriacaoIso dataDaCriacao tipoDeManifestacao tema assunto orgaos status statusDemanda data')
    .lean();

  const demandas = [];

  for (const record of records) {
    if (isConcluido(record)) continue;

    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) continue;

    const tipo = record.tipoDeManifestacao ||
      (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
      '';

    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimentoComPrazo(dataCriacao, prazo);
    if (!dataVencimento) continue;

    // Verificar se vence hoje
    if (dataVencimento === hojeStr) {
      const protocolo = record.protocolo ||
        (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
        'N/A';

      if (await jaFoiNotificado(prisma, protocolo, 'vencimento')) {
        continue;
      }

      const secretaria = record.orgaos ||
        (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
        'N/A';

      const assunto = record.assunto ||
        (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
        '';

      const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);

      demandas.push({
        protocolo,
        secretaria,
        dataVencimento,
        diasRestantes,
        assunto,
        tipoManifestacao: tipo
      });
    }
  }

  return demandas;
}

/**
 * Buscar demandas vencidas há 60 dias
 */
async function buscarDemandas60DiasVencidas(prisma) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Data de vencimento há 60 dias
  const dataVencimento60Dias = new Date(hoje);
  dataVencimento60Dias.setDate(hoje.getDate() - 60);
  const dataVencimento60DiasStr = dataVencimento60Dias.toISOString().slice(0, 10);

  // REFATORAÇÃO: Prisma → Mongoose
  const records = await Record.find({
    $or: [
      { dataCriacaoIso: { $ne: null, $exists: true } },
      { dataDaCriacao: { $ne: null, $exists: true } }
    ]
  })
    .select('protocolo dataCriacaoIso dataDaCriacao tipoDeManifestacao tema assunto orgaos status statusDemanda data')
    .lean();

  const demandas = [];

  for (const record of records) {
    // Incluir apenas não concluídos
    if (isConcluido(record)) continue;

    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) continue;

    const tipo = record.tipoDeManifestacao ||
      (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
      '';

    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimentoComPrazo(dataCriacao, prazo);
    if (!dataVencimento) continue;

    // Verificar se venceu há 60 dias (com margem de 1 dia)
    if (dataVencimento === dataVencimento60DiasStr) {
      const protocolo = record.protocolo ||
        (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
        'N/A';

      if (await jaFoiNotificado(prisma, protocolo, '60_dias_vencido')) {
        continue;
      }

      const secretaria = record.orgaos ||
        (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
        'N/A';

      const assunto = record.assunto ||
        (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
        '';

      const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);

      demandas.push({
        protocolo,
        secretaria,
        dataVencimento,
        diasRestantes,
        assunto,
        tipoManifestacao: tipo
      });
    }
  }

  return demandas;
}

/**
 * Enviar notificações de 15 dias (agrupadas por secretaria)
 */
export async function enviarNotificacoes15Dias(prisma) {
  logger.info('Buscando demandas para notificação de 15 dias');

  const demandas = await buscarDemandas15Dias(prisma);
  logger.info('Demandas encontradas para notificação (15 dias)', { total: demandas.length });

  // Agrupar por secretaria
  const porSecretaria = {};
  for (const demanda of demandas) {
    const secretaria = demanda.secretaria || 'N/A';
    if (!porSecretaria[secretaria]) {
      porSecretaria[secretaria] = [];
    }
    porSecretaria[secretaria].push(demanda);
  }

  const resultados = [];

  // Enviar um email por secretaria com todos os protocolos
  for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
    try {
      const emailsSecretaria = await getEmailsSecretariaFromDB(secretaria, prisma);
      const template = await getTemplate15Dias({
        secretaria,
        protocolos: protocolos,
        totalNaoRespondidas: 0
      }, prisma);

      // Enviar para TODOS os emails da secretaria
      let primeiroMessageId = null;
      for (const emailSecretaria of emailsSecretaria) {
        try {
          const { messageId } = await sendEmail(
            emailSecretaria,
            template.subject,
            template.html,
            template.text,
            EMAIL_REMETENTE,
            NOME_REMETENTE
          );

          if (!primeiroMessageId) {
            primeiroMessageId = messageId;
          }
        } catch (errorEmail) {
          logger.error('Erro ao enviar email para secretaria', {
            email: emailSecretaria,
            secretaria,
            erro: errorEmail.message
          });
        }
      }

      // Registrar cada protocolo (apenas uma vez, não por email)
      if (primeiroMessageId) {
        for (const demanda of protocolos) {
          await registrarNotificacao(prisma, {
            protocolo: demanda.protocolo,
            secretaria: demanda.secretaria,
            emailSecretaria: emailsSecretaria.join(', '), // Salvar todos os emails
            tipoNotificacao: '15_dias',
            dataVencimento: demanda.dataVencimento,
            diasRestantes: demanda.diasRestantes,
            messageId: primeiroMessageId
          });

          resultados.push({
            protocolo: demanda.protocolo,
            status: 'enviado',
            tipo: '15_dias'
          });
        }

        logger.info('Email de notificação (15 dias) enviado', {
          secretaria,
          emails: emailsSecretaria.length,
          protocolos: protocolos.length
        });
      }
    } catch (error) {
      logger.errorWithContext('Erro ao enviar notificação para secretaria', error, {
        secretaria,
        tipoNotificacao: '15 dias'
      });

      // Registrar erros
      for (const demanda of protocolos) {
        await registrarNotificacao(prisma, {
          protocolo: demanda.protocolo,
          secretaria: demanda.secretaria,
          emailSecretaria: (await getEmailsSecretariaFromDB(secretaria, prisma)).join(', '),
          tipoNotificacao: '15_dias',
          dataVencimento: demanda.dataVencimento,
          diasRestantes: demanda.diasRestantes,
          messageId: null,
          status: 'erro',
          mensagemErro: error.message
        });

        resultados.push({
          protocolo: demanda.protocolo,
          status: 'erro',
          tipo: '15_dias',
          erro: error.message
        });
      }
    }
  }

  return resultados;
}

/**
 * Enviar resumo para Ouvidoria Geral com todas as demandas vencendo hoje
 */
async function enviarResumoOuvidoriaGeral(porSecretaria, prisma) {
  // Verificar se há demandas para enviar
  const totalDemandas = Object.values(porSecretaria).reduce((sum, arr) => sum + arr.length, 0);

  if (totalDemandas === 0) {
    logger.info('Nenhuma demanda vencendo hoje - resumo não será enviado');
    return null;
  }

  try {
    logger.info('Preparando resumo para Ouvidoria Geral', { totalDemandas });

    const template = await getTemplateResumoOuvidoriaGeral(porSecretaria, prisma);

    // Separar múltiplos emails (separados por vírgula)
    const emails = EMAIL_OUVIDORIA_GERAL.split(',').map(e => e.trim()).filter(e => e);

    const resultados = [];

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

        logger.info('Resumo enviado para Ouvidoria Geral', {
          email,
          totalDemandas,
          messageId
        });

        resultados.push({ email, messageId, status: 'enviado' });
      } catch (error) {
        logger.errorWithContext('Erro ao enviar resumo para email específico', error, { email });
        resultados.push({ email, status: 'erro', erro: error.message });
      }
    }

    return { resultados, totalDemandas };
  } catch (error) {
    logger.errorWithContext('Erro ao enviar resumo para Ouvidoria Geral', error);
    throw error;
  }
}

/**
 * Enviar notificações de vencimento (hoje) - agrupadas por secretaria
 */
export async function enviarNotificacoesVencimento(prisma) {
  logger.info('Buscando demandas para notificação de vencimento (hoje)');

  const demandas = await buscarDemandasVencimentoHoje(prisma);
  logger.info('Demandas encontradas para notificação (vencimento hoje)', { total: demandas.length });

  // Agrupar por secretaria
  const porSecretaria = {};
  for (const demanda of demandas) {
    const secretaria = demanda.secretaria || 'N/A';
    if (!porSecretaria[secretaria]) {
      porSecretaria[secretaria] = [];
    }
    porSecretaria[secretaria].push(demanda);
  }

  const resultados = [];

  // Enviar um email por secretaria com todos os protocolos
  for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
    try {
      const emailsSecretaria = await getEmailsSecretariaFromDB(secretaria, prisma);
      const template = await getTemplateVencimento({
        secretaria,
        protocolos: protocolos
      }, prisma);

      // Enviar para TODOS os emails da secretaria
      let primeiroMessageId = null;
      for (const emailSecretaria of emailsSecretaria) {
        try {
          const { messageId } = await sendEmail(
            emailSecretaria,
            template.subject,
            template.html,
            template.text,
            EMAIL_REMETENTE,
            NOME_REMETENTE
          );

          if (!primeiroMessageId) {
            primeiroMessageId = messageId;
          }
        } catch (errorEmail) {
          logger.error('Erro ao enviar email para secretaria', {
            email: emailSecretaria,
            secretaria,
            erro: errorEmail.message
          });
        }
      }

      // Registrar cada protocolo (apenas uma vez, não por email)
      if (primeiroMessageId) {
        for (const demanda of protocolos) {
          await registrarNotificacao(prisma, {
            protocolo: demanda.protocolo,
            secretaria: demanda.secretaria,
            emailSecretaria: emailsSecretaria.join(', '), // Salvar todos os emails
            tipoNotificacao: 'vencimento',
            dataVencimento: demanda.dataVencimento,
            diasRestantes: demanda.diasRestantes,
            messageId: primeiroMessageId
          });

          resultados.push({
            protocolo: demanda.protocolo,
            status: 'enviado',
            tipo: 'vencimento'
          });
        }

        logger.info('Email de vencimento enviado', {
          secretaria,
          emails: emailsSecretaria.length,
          protocolos: protocolos.length
        });
      }
    } catch (error) {
      logger.errorWithContext('Erro ao enviar notificação para secretaria', error, {
        secretaria,
        tipoNotificacao: 'vencimento'
      });

      // Registrar erros
      for (const demanda of protocolos) {
        await registrarNotificacao(prisma, {
          protocolo: demanda.protocolo,
          secretaria: demanda.secretaria,
          emailSecretaria: (await getEmailsSecretariaFromDB(secretaria, prisma)).join(', '),
          tipoNotificacao: 'vencimento',
          dataVencimento: demanda.dataVencimento,
          diasRestantes: demanda.diasRestantes,
          messageId: null,
          status: 'erro',
          mensagemErro: error.message
        });

        resultados.push({
          protocolo: demanda.protocolo,
          status: 'erro',
          tipo: 'vencimento',
          erro: error.message
        });
      }
    }
  }

  // Enviar resumo para Ouvidoria Geral após enviar emails individuais
  try {
    await enviarResumoOuvidoriaGeral(porSecretaria, prisma);
  } catch (error) {
    logger.warn('Erro ao enviar resumo para Ouvidoria Geral (não bloqueou processo)', {
      erro: error.message
    });
    // Não bloqueia o processo se o resumo falhar
  }

  return resultados;
}

/**
 * Enviar notificações de 60 dias vencidas - agrupadas por secretaria
 */
export async function enviarNotificacoes60Dias(prisma) {
  logger.info('Buscando demandas para notificação de 60 dias vencidas');

  const demandas = await buscarDemandas60DiasVencidas(prisma);
  logger.info('Demandas encontradas para notificação (60 dias vencidas)', { total: demandas.length });

  // Agrupar por secretaria
  const porSecretaria = {};
  for (const demanda of demandas) {
    const secretaria = demanda.secretaria || 'N/A';
    if (!porSecretaria[secretaria]) {
      porSecretaria[secretaria] = [];
    }
    porSecretaria[secretaria].push(demanda);
  }

  const resultados = [];

  // Enviar um email por secretaria com todos os protocolos
  for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
    try {
      const emailsSecretaria = await getEmailsSecretariaFromDB(secretaria, prisma);
      const template = await getTemplate60Dias({
        secretaria,
        protocolos: protocolos
      }, prisma);

      // Enviar para TODOS os emails da secretaria
      let primeiroMessageId = null;
      for (const emailSecretaria of emailsSecretaria) {
        try {
          const { messageId } = await sendEmail(
            emailSecretaria,
            template.subject,
            template.html,
            template.text,
            EMAIL_REMETENTE,
            NOME_REMETENTE
          );

          if (!primeiroMessageId) {
            primeiroMessageId = messageId;
          }
        } catch (errorEmail) {
          logger.error('Erro ao enviar email para secretaria', {
            email: emailSecretaria,
            secretaria,
            erro: errorEmail.message
          });
        }
      }

      // Registrar cada protocolo (apenas uma vez, não por email)
      if (primeiroMessageId) {
        for (const demanda of protocolos) {
          await registrarNotificacao(prisma, {
            protocolo: demanda.protocolo,
            secretaria: demanda.secretaria,
            emailSecretaria: emailsSecretaria.join(', '), // Salvar todos os emails
            tipoNotificacao: '60_dias_vencido',
            dataVencimento: demanda.dataVencimento,
            diasRestantes: demanda.diasRestantes,
            messageId: primeiroMessageId
          });

          resultados.push({
            protocolo: demanda.protocolo,
            status: 'enviado',
            tipo: '60_dias_vencido'
          });
        }

        logger.info('Email de notificação (60 dias vencido) enviado', {
          secretaria,
          emails: emailsSecretaria.length,
          protocolos: protocolos.length
        });
      }
    } catch (error) {
      logger.errorWithContext('Erro ao enviar notificação para secretaria', error, {
        secretaria,
        tipoNotificacao: '60 dias'
      });

      // Registrar erros
      for (const demanda of protocolos) {
        await registrarNotificacao(prisma, {
          protocolo: demanda.protocolo,
          secretaria: demanda.secretaria,
          emailSecretaria: (await getEmailsSecretariaFromDB(secretaria, prisma)).join(', '),
          tipoNotificacao: '60_dias_vencido',
          dataVencimento: demanda.dataVencimento,
          diasRestantes: demanda.diasRestantes,
          messageId: null,
          status: 'erro',
          mensagemErro: error.message
        });

        resultados.push({
          protocolo: demanda.protocolo,
          status: 'erro',
          tipo: '60_dias_vencido',
          erro: error.message
        });
      }
    }
  }

  return resultados;
}

/**
 * Executar todas as notificações
 */
export async function executarTodasNotificacoes(prisma) {
  logger.info('Iniciando processo de notificações por email');
  const startTime = Date.now();

  const resultados = {
    '15_dias': [],
    'vencimento': [],
    '60_dias_vencido': [],
    totalEnviados: 0,
    totalErros: 0
  };

  try {
    // Notificações de 15 dias
    const notif15 = await enviarNotificacoes15Dias(prisma);
    resultados['15_dias'] = notif15;
    resultados.totalEnviados += notif15.filter(r => r.status === 'enviado').length;
    resultados.totalErros += notif15.filter(r => r.status === 'erro').length;

    // Notificações de vencimento
    const notifVenc = await enviarNotificacoesVencimento(prisma);
    resultados['vencimento'] = notifVenc;
    resultados.totalEnviados += notifVenc.filter(r => r.status === 'enviado').length;
    resultados.totalErros += notifVenc.filter(r => r.status === 'erro').length;

    // Notificações de 60 dias
    const notif60 = await enviarNotificacoes60Dias(prisma);
    resultados['60_dias_vencido'] = notif60;
    resultados.totalEnviados += notif60.filter(r => r.status === 'enviado').length;
    resultados.totalErros += notif60.filter(r => r.status === 'erro').length;

    const duration = Date.now() - startTime;
    logger.info('Processo de notificações concluído', {
      totalEnviados: resultados.totalEnviados,
      totalErros: resultados.totalErros,
      duracao: `${duration}ms`
    });

    return resultados;
  } catch (error) {
    logger.errorWithContext('Erro ao executar notificações', error);
    throw error;
  }
}

