/**
 * Script para FORÇAR envio de emails de protocolos vencendo hoje
 * IGNORA a verificação de "já foi notificado" e reenvia tudo
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getDataCriacao, isConcluido } from '../../src/utils/formatting/dateUtils.js';
import { sendEmail } from '../../src/services/email-notifications/gmailService.js';
import { 
  getEmailsSecretariaFromDB, 
  EMAIL_REMETENTE, 
  NOME_REMETENTE,
  EMAIL_OUVIDORIA_GERAL,
  getTemplateVencimento,
  getTemplateResumoOuvidoriaGeral
} from '../../src/services/email-notifications/emailConfig.js';

const prisma = new PrismaClient();

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
  const vencimento = new Date(dataVencimento + 'T00:00:00');
  if (isNaN(vencimento.getTime())) return null;
  const diff = vencimento - hoje;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

async function enviarVencimentosHojeForcado() {
  console.log('📧 FORÇANDO envio de emails de protocolos vencendo hoje...\n');
  console.log('⚠️  MODO FORÇADO: Ignorando verificação de "já foi notificado"\n');
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);
  
  console.log(`📅 Data de hoje: ${hojeStr} (${hoje.toLocaleDateString('pt-BR')})\n`);
  
  // Buscar todas as demandas não concluídas
  const records = await prisma.record.findMany({
    where: {
      OR: [
        { dataCriacaoIso: { not: null } },
        { dataDaCriacao: { not: null } }
      ]
    },
    select: {
      id: true,
      protocolo: true,
      dataCriacaoIso: true,
      dataDaCriacao: true,
      tipoDeManifestacao: true,
      tema: true,
      assunto: true,
      orgaos: true,
      status: true,
      statusDemanda: true,
      data: true
    }
  });
  
  console.log(`📊 Total de registros encontrados: ${records.length}\n`);
  
  const porSecretaria = {};
  let totalEncontrados = 0;
  
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
    
    // Verificar se vence HOJE (ignorando se já foi notificado)
    if (dataVencimento === hojeStr) {
      const protocolo = record.protocolo || 
                        (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
                        'N/A';
      
      const secretaria = record.orgaos || 
                        (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
                        'N/A';
      
      const assunto = record.assunto || 
                     (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
                     '';
      
      const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);
      
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
      
      totalEncontrados++;
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📊 PROTOCOLOS ENCONTRADOS VENCENDO HOJE: ${totalEncontrados}\n`);
  
  if (totalEncontrados === 0) {
    console.log('⚠️  Nenhum protocolo vencendo hoje encontrado.');
    await prisma.$disconnect();
    return;
  }
  
  // Mostrar resumo por secretaria
  console.log('📋 Resumo por Secretaria:\n');
  for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
    console.log(`   ${secretaria}: ${protocolos.length} protocolo(s)`);
    protocolos.forEach(p => {
      console.log(`      - ${p.protocolo} (${p.assunto || 'Sem assunto'})`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('📤 ENVIANDO EMAILS...\n');
  
  let emailsEnviados = 0;
  let erros = 0;
  
  // Enviar emails por secretaria
  for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
    try {
      const emailsSecretaria = await getEmailsSecretariaFromDB(secretaria, prisma);
      
      console.log(`📧 Enviando para ${secretaria}:`);
      console.log(`   Emails: ${emailsSecretaria.join(', ')}`);
      console.log(`   Protocolos: ${protocolos.length}`);
      
      const template = await getTemplateVencimento({
        secretaria,
        protocolos: protocolos
      }, prisma);
      
      // Enviar para TODOS os emails da secretaria
      for (const emailSecretaria of emailsSecretaria) {
        try {
          const { messageId, threadId } = await sendEmail(
            emailSecretaria,
            template.subject,
            template.html,
            template.text,
            EMAIL_REMETENTE,
            NOME_REMETENTE
          );
          
          console.log(`   ✅ Enviado para ${emailSecretaria}! Message ID: ${messageId}`);
          emailsEnviados++;
        } catch (errorEmail) {
          console.error(`   ❌ Erro ao enviar para ${emailSecretaria}: ${errorEmail.message}`);
          erros++;
        }
      }
      
      console.log(''); // Linha em branco
      
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}\n`);
      erros++;
    }
  }
  
  // Enviar resumo para Ouvidoria Geral
  if (Object.keys(porSecretaria).length > 0) {
    try {
      console.log(`📧 Enviando resumo para Ouvidoria Geral:`);
      console.log(`   Email: ${EMAIL_OUVIDORIA_GERAL}`);
      console.log(`   Total de protocolos: ${totalEncontrados}`);
      
      const templateResumo = await getTemplateResumoOuvidoriaGeral(porSecretaria, prisma);
      
      const { messageId: resumoMessageId, threadId: resumoThreadId } = await sendEmail(
        EMAIL_OUVIDORIA_GERAL,
        templateResumo.subject,
        templateResumo.html,
        templateResumo.text,
        EMAIL_REMETENTE,
        NOME_REMETENTE
      );
      
      console.log(`   ✅ Resumo enviado! Message ID: ${resumoMessageId}\n`);
      emailsEnviados++;
      
    } catch (error) {
      console.error(`   ❌ Erro ao enviar resumo: ${error.message}\n`);
      erros++;
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📊 RESUMO FINAL:\n');
  console.log(`   ✅ Emails enviados: ${emailsEnviados}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`   📋 Total de protocolos: ${totalEncontrados}`);
  console.log(`   📧 Todos os emails foram enviados para: ouvgeral.gestao@gmail.com\n`);
  
  await prisma.$disconnect();
}

enviarVencimentosHojeForcado().catch(console.error);

