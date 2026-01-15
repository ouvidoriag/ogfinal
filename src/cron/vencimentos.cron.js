/**
 * Sistema Automático de Vencimentos
 * Dispara emails automaticamente quando vencimentos estão chegando
 * 
 * Executa diariamente às 08:00
 * Verifica demandas que vencem em 15 dias, hoje, ou vencidas há 60 dias
 */

import cron from 'node-cron';
import { getDataCriacao, isConcluido } from '../utils/formatting/dateUtils.js';
import { sendEmail } from '../services/email-notifications/gmailService.js';
import {
  getEmailsSecretariaFromDB,
  EMAIL_REMETENTE,
  NOME_REMETENTE,
  getTemplate15Dias,
  getTemplateVencimento,
  getTemplate60Dias
} from '../services/email-notifications/emailConfig.js';
import NotificacaoEmail from '../models/NotificacaoEmail.model.js';
import Record from '../models/Record.model.js';

// REFATORAÇÃO: Prisma removido - sistema migrado para Mongoose
// Variável mantida apenas para compatibilidade de assinaturas
let prisma = null;

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
    return 20; // SIC: 20 dias
  }

  return 30; // Ouvidoria: 30 dias
}

/**
 * Calcular data de vencimento
 */
function calcularDataVencimento(dataCriacao, prazo) {
  if (!dataCriacao) return null;

  const data = new Date(dataCriacao + 'T00:00:00');
  if (isNaN(data.getTime())) return null;

  data.setDate(data.getDate() + prazo);
  return data.toISOString().slice(0, 10);
}

/**
 * Calcular dias restantes
 */
function calcularDiasRestantes(dataVencimento, hoje) {
  if (!dataVencimento) return null;

  const vencimento = new Date(dataVencimento + 'T00:00:00');
  if (isNaN(vencimento.getTime())) return null;

  const diff = vencimento - hoje;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Verificar se já foi notificado
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function jaFoiNotificado(protocolo, tipoNotificacao) {
  const notificacao = await NotificacaoEmail.findOne({
    protocolo: protocolo,
    tipoNotificacao: tipoNotificacao,
    status: 'enviado'
  }).lean();

  return !!notificacao;
}

/**
 * Registrar notificação enviada
 */
async function registrarNotificacao(dados) {
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
    // REFATORAÇÃO: Prisma → Mongoose
    await NotificacaoEmail.create({
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
  } catch (error) {
    console.error('❌ Erro ao registrar notificação:', error);
  }
}

/**
 * Buscar e enviar notificações para um período específico
 */
async function processarVencimentos(diasAlvo, tipoNotificacao, getTemplate) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Calcular data alvo
  const dataAlvo = new Date(hoje);
  if (diasAlvo > 0) {
    dataAlvo.setDate(hoje.getDate() + diasAlvo);
  } else {
    dataAlvo.setDate(hoje.getDate() + diasAlvo); // Negativo para 60 dias atrás
  }
  const dataAlvoStr = dataAlvo.toISOString().slice(0, 10);

  console.log(`📧 Verificando vencimentos para ${tipoNotificacao} (data alvo: ${dataAlvoStr})...`);

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

  // Coletar protocolos por secretaria
  const porSecretaria = {};

  for (const record of records) {
    // Pular concluídos
    if (isConcluido(record)) continue;

    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) continue;

    const tipo = record.tipoDeManifestacao ||
      (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
      '';

    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
    if (!dataVencimento) continue;

    // Verificar se corresponde à data alvo
    // Para 60+ dias vencido (diasAlvo < 0), mostrar todos vencidos há 60+ dias
    // Para outros tipos, verificar data exata
    if (diasAlvo < 0) {
      // Verificar se está vencido há 60+ dias (dataVencimento <= dataAlvo)
      if (dataVencimento > dataAlvoStr) continue;
    } else {
      // Para 'hoje' e '15', verificar data exata
      if (dataVencimento !== dataAlvoStr) continue;
    }

    const protocolo = record.protocolo ||
      (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
      'N/A';

    // Verificar se já foi notificado
    if (await jaFoiNotificado(protocolo, tipoNotificacao)) {
      continue;
    }

    const secretaria = record.orgaos ||
      (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
      'N/A';

    const assunto = record.assunto ||
      (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
      '';

    const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);

    // Agrupar por secretaria
    if (!porSecretaria[secretaria]) {
      porSecretaria[secretaria] = [];
    }

    porSecretaria[secretaria].push({
      protocolo,
      secretaria,
      dataVencimento,
      diasRestantes,
      assunto,
      tipoManifestacao: tipo
    });
  }

  let enviados = 0;
  let erros = 0;

  // Enviar um email por secretaria com todos os protocolos
  for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
    try {
      // Obter TODOS os emails da secretaria
      // REFATORAÇÃO: Prisma → Mongoose (prisma não é mais usado)
      const emailsSecretaria = await getEmailsSecretariaFromDB(secretaria, null);

      // Obter template com todos os protocolos
      const template = await getTemplate({
        secretaria,
        protocolos: protocolos
      }, prisma);

      // Enviar para TODOS os emails da secretaria
      let primeiroMessageId = null;
      for (const emailSecretaria of emailsSecretaria) {
        try {
          // Enviar email usando o serviço Gmail
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

          console.log(`✅ Email enviado para ${secretaria} → ${emailSecretaria}`);
        } catch (errorEmail) {
          console.error(`❌ Erro ao enviar para ${emailSecretaria}:`, errorEmail.message);
        }
      }

      // Registrar cada protocolo (apenas uma vez, não por email)
      if (primeiroMessageId) {
        for (const protocoloData of protocolos) {
          await registrarNotificacao({
            protocolo: protocoloData.protocolo,
            secretaria: protocoloData.secretaria,
            emailSecretaria: emailsSecretaria.join(', '), // Salvar todos os emails
            tipoNotificacao,
            dataVencimento: protocoloData.dataVencimento,
            diasRestantes: protocoloData.diasRestantes,
            messageId: primeiroMessageId
          });
        }
        enviados += protocolos.length;
        console.log(`✅ ${protocolos.length} protocolos enviados para ${secretaria} (${emailsSecretaria.length} email(s))`);
      } else {
        erros += protocolos.length;
      }

    } catch (error) {
      erros += protocolos.length;
      console.error(`❌ Erro ao enviar email para ${secretaria}:`, error.message);

      // Registrar erro para cada protocolo
      for (const protocoloData of protocolos) {
        await registrarNotificacao({
          protocolo: protocoloData.protocolo,
          secretaria: protocoloData.secretaria,
          emailSecretaria: getEmailSecretaria(secretaria),
          tipoNotificacao,
          dataVencimento: protocoloData.dataVencimento,
          diasRestantes: protocoloData.diasRestantes,
          messageId: null,
          status: 'erro',
          mensagemErro: error.message
        });
      }
    }
  }

  console.log(`📊 ${tipoNotificacao}: ${enviados} protocolos enviados, ${erros} erros`);

  return { enviados, erros };
}

/**
 * Função principal que executa todas as verificações
 */
async function executarVerificacaoVencimentos() {
  console.log('🔔 Iniciando verificação automática de vencimentos...');
  console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);

  const resultados = {
    '15_dias': { enviados: 0, erros: 0 },
    'vencimento': { enviados: 0, erros: 0 },
    '60_dias_vencido': { enviados: 0, erros: 0 }
  };

  try {
    // 1. Notificações de 15 dias antes
    resultados['15_dias'] = await processarVencimentos(
      15,
      '15_dias',
      getTemplate15Dias
    );

    // 2. Notificações de vencimento (hoje)
    resultados['vencimento'] = await processarVencimentos(
      0,
      'vencimento',
      getTemplateVencimento
    );

    // 3. Notificações de 60 dias vencidas
    resultados['60_dias_vencido'] = await processarVencimentos(
      -60,
      '60_dias_vencido',
      getTemplate60Dias
    );

    const totalEnviados = resultados['15_dias'].enviados +
      resultados['vencimento'].enviados +
      resultados['60_dias_vencido'].enviados;

    const totalErros = resultados['15_dias'].erros +
      resultados['vencimento'].erros +
      resultados['60_dias_vencido'].erros;

    console.log('✅ Verificação concluída!');
    console.log(`📊 Total: ${totalEnviados} emails enviados, ${totalErros} erros`);

    return resultados;

  } catch (error) {
    console.error('❌ Erro na verificação de vencimentos:', error);
    throw error;
  }
}

/**
 * Inicializar o cron job
 * Executa diariamente às 08:00
 */
export function iniciarCronVencimentos(prismaClient) {
  // REFATORAÇÃO: Prisma → Mongoose (prisma não é mais necessário)
  // Mantido para compatibilidade, mas não usado

  // Executar diariamente às 16:00
  // Formato: segundo minuto hora dia mês dia-da-semana
  cron.schedule('0 16 * * *', async () => {
    console.log('⏰ Executando verificação automática de vencimentos (16h)...');
    await executarVerificacaoVencimentos();
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo'
  });

  console.log('✅ Cron de vencimentos iniciado (execução diária às 16h)');
}

/**
 * Executar verificação manualmente (para testes)
 */
export async function executarVerificacaoManual(prismaClient) {
  // REFATORAÇÃO: Prisma → Mongoose (prisma não é mais necessário)
  // Mantido para compatibilidade, mas não usado
  return await executarVerificacaoVencimentos();
}

