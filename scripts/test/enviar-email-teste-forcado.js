/**
 * Script para forçar envio de email de teste
 * Envia um email mesmo que já tenha sido notificado (para testes)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getDataCriacao, isConcluido } from '../../src/utils/formatting/dateUtils.js';
import { sendEmail } from '../../src/services/email-notifications/gmailService.js';
import { 
  getEmailSecretaria, 
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

async function enviarEmailTeste() {
  console.log('📧 Enviando email de teste (forçado)...\n');
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);
  
  console.log(`📅 Data de hoje: ${hojeStr}\n`);
  
  // Buscar protocolos que vencem hoje (mesmo que já tenham sido notificados)
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
    },
    take: 10000
  });
  
  const porSecretaria = {};
  
  for (const record of records) {
    if (isConcluido(record)) continue;
    
    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) continue;
    
    const tipo = record.tipoDeManifestacao || 
                 (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
                 '';
    
    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
    if (!dataVencimento) continue;
    
    // Verificar se vence HOJE
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
    }
  }
  
  if (Object.keys(porSecretaria).length === 0) {
    console.log('⚠️  Nenhum protocolo vencendo hoje encontrado.');
    console.log('   Vou enviar um email de teste mesmo assim...\n');
    
    // Enviar email de teste com dados fictícios
    const template = await getTemplateVencimento({
      secretaria: 'Secretaria de Teste',
      protocolos: [{
        protocolo: 'TESTE-001',
        dataVencimento: hojeStr,
        diasRestantes: 0,
        assunto: 'Email de teste do sistema',
        tipoManifestacao: 'Reclamação'
      }]
    }, prisma);
    
    const emailDestino = getEmailSecretaria('Secretaria de Teste');
    
    console.log(`📤 Enviando email de teste para: ${emailDestino}`);
    
    const { messageId, threadId } = await sendEmail(
      emailDestino,
      template.subject,
      template.html,
      template.text,
      EMAIL_REMETENTE,
      NOME_REMETENTE
    );
    
    console.log('\n✅ Email de teste enviado com sucesso!');
    console.log(`📧 Message ID: ${messageId}`);
    console.log(`🔗 Thread ID: ${threadId}`);
    console.log(`📬 Verifique a caixa de entrada de: ${emailDestino}\n`);
    
  } else {
    console.log(`📊 Encontrados protocolos vencendo hoje em ${Object.keys(porSecretaria).length} secretaria(s)\n`);
    
    // Enviar emails por secretaria
    for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
      const emailSecretaria = getEmailSecretaria(secretaria);
      
      console.log(`📤 Enviando email para ${secretaria} (${protocolos.length} protocolos)...`);
      console.log(`   Destinatário: ${emailSecretaria}`);
      
      const template = await getTemplateVencimento({
        secretaria,
        protocolos: protocolos
      }, prisma);
      
      const { messageId, threadId } = await sendEmail(
        emailSecretaria,
        template.subject,
        template.html,
        template.text,
        EMAIL_REMETENTE,
        NOME_REMETENTE
      );
      
      console.log(`   ✅ Enviado! Message ID: ${messageId}\n`);
    }
    
    // Enviar resumo
    console.log('📤 Enviando email de resumo para Ouvidoria Geral...');
    console.log(`   Destinatário: ${EMAIL_OUVIDORIA_GERAL}`);
    
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
    
    console.log('✅ Todos os emails foram enviados com sucesso!');
    console.log(`📬 Verifique a caixa de entrada de: ${EMAIL_OUVIDORIA_GERAL}\n`);
  }
  
  await prisma.$disconnect();
}

enviarEmailTeste().catch(console.error);

