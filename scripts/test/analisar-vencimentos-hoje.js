/**
 * Script para analisar o que seria enviado hoje
 * Mostra protocolos vencendo hoje e emails que receberiam
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getDataCriacao, isConcluido } from '../../src/utils/formatting/dateUtils.js';
import { getEmailsSecretariaFromDB } from '../../src/services/email-notifications/emailConfig.js';

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

async function analisarVencimentosHoje() {
  console.log('🔍 Analisando protocolos vencendo hoje...\n');
  
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
      
      if (!porSecretaria[secretaria]) {
        porSecretaria[secretaria] = [];
      }
      
      porSecretaria[secretaria].push({
        protocolo,
        assunto,
        tipoManifestacao: tipo,
        prazo,
        dataCriacao,
        dataVencimento
      });
      
      totalEncontrados++;
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📊 PROTOCOLOS VENCENDO HOJE: ${totalEncontrados}\n`);
  console.log(`📋 Secretarias envolvidas: ${Object.keys(porSecretaria).length}\n`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (totalEncontrados === 0) {
    console.log('⚠️  Nenhum protocolo vencendo hoje encontrado.');
    await prisma.$disconnect();
    return;
  }
  
  // Analisar cada secretaria
  for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
    console.log(`\n📧 ${secretaria}`);
    console.log(`   Protocolos: ${protocolos.length}`);
    
    // Buscar emails da secretaria
    try {
      const emails = await getEmailsSecretariaFromDB(secretaria, prisma);
      console.log(`   Emails que receberiam: ${emails.length}`);
      emails.forEach((email, index) => {
        console.log(`      ${index + 1}. ${email}`);
      });
    } catch (error) {
      console.log(`   ⚠️  Erro ao buscar emails: ${error.message}`);
    }
    
    console.log(`   \n   Protocolos:`);
    protocolos.forEach((p, index) => {
      console.log(`      ${index + 1}. ${p.protocolo}`);
      console.log(`         Assunto: ${p.assunto || 'N/A'}`);
      console.log(`         Tipo: ${p.tipoManifestacao || 'N/A'}`);
      console.log(`         Prazo: ${p.prazo} dias`);
      console.log(`         Data Criação: ${p.dataCriacao}`);
      console.log('');
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('📊 RESUMO FINAL:\n');
  console.log(`   Total de protocolos: ${totalEncontrados}`);
  console.log(`   Total de secretarias: ${Object.keys(porSecretaria).length}`);
  
  // Calcular total de emails que seriam enviados
  let totalEmails = 0;
  for (const secretaria of Object.keys(porSecretaria)) {
    try {
      const emails = await getEmailsSecretariaFromDB(secretaria, prisma);
      totalEmails += emails.length;
    } catch (error) {
      totalEmails += 1; // Fallback
    }
  }
  
  console.log(`   Total de emails que seriam enviados: ${totalEmails}`);
  console.log(`   (1 email por secretaria × ${Object.keys(porSecretaria).length} secretarias)`);
  console.log(`   (mas cada secretaria pode ter múltiplos emails)\n`);
  
  await prisma.$disconnect();
}

analisarVencimentosHoje().catch(console.error);

