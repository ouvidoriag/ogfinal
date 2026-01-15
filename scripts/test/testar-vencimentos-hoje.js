/**
 * Script de Teste: Verificar Protocolos que Vencem Hoje
 * 
 * Este script verifica:
 * 1. Quantos protocolos vencem hoje
 * 2. Se estão sendo identificados corretamente
 * 3. Se o cálculo de vencimento está correto
 * 4. Se já foram notificados
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getDataCriacao, isConcluido } from '../../src/utils/formatting/dateUtils.js';

const prisma = new PrismaClient();

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
 */
async function jaFoiNotificado(protocolo, tipoNotificacao) {
  const notificacao = await prisma.notificacaoEmail.findFirst({
    where: {
      protocolo: protocolo,
      tipoNotificacao: tipoNotificacao,
      status: 'enviado'
    }
  });
  
  return !!notificacao;
}

async function testarVencimentosHoje() {
  console.log('🔍 Testando identificação de protocolos que vencem HOJE\n');
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);
  
  console.log(`📅 Data de hoje: ${hojeStr}`);
  console.log(`📅 Data formatada (DD/MM/YYYY): ${hoje.toLocaleDateString('pt-BR')}\n`);
  
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
    },
    take: 10000 // Limitar para teste
  });
  
  console.log(`📊 Total de registros encontrados: ${records.length}\n`);
  
  const protocolosVencendoHoje = [];
  const protocolosJaNotificados = [];
  const protocolosComProblema = [];
  
  for (const record of records) {
    // Pular concluídos
    if (isConcluido(record)) continue;
    
    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) {
      protocolosComProblema.push({
        protocolo: record.protocolo || 'N/A',
        problema: 'Sem data de criação'
      });
      continue;
    }
    
    const tipo = record.tipoDeManifestacao || 
                 (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
                 '';
    
    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
    
    if (!dataVencimento) {
      protocolosComProblema.push({
        protocolo: record.protocolo || 'N/A',
        problema: 'Não foi possível calcular data de vencimento'
      });
      continue;
    }
    
    // Verificar se vence HOJE
    if (dataVencimento === hojeStr) {
      const protocolo = record.protocolo || 
                        (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
                        'N/A';
      
      const secretaria = record.orgaos || 
                        (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
                        'N/A';
      
      const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);
      
      const protocoloData = {
        protocolo,
        secretaria,
        dataCriacao,
        dataVencimento,
        diasRestantes,
        prazo,
        tipoManifestacao: tipo
      };
      
      // Verificar se já foi notificado
      const jaNotificado = await jaFoiNotificado(protocolo, 'vencimento');
      
      if (jaNotificado) {
        protocolosJaNotificados.push(protocoloData);
      } else {
        protocolosVencendoHoje.push(protocoloData);
      }
    }
  }
  
  // Exibir resultados
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ PROTOCOLOS QUE VENCEM HOJE (${hojeStr}):\n`);
  console.log(`   Total encontrados: ${protocolosVencendoHoje.length}\n`);
  
  if (protocolosVencendoHoje.length > 0) {
    console.log('   Detalhes:\n');
    protocolosVencendoHoje.slice(0, 10).forEach((p, idx) => {
      console.log(`   ${idx + 1}. Protocolo: ${p.protocolo}`);
      console.log(`      Secretaria: ${p.secretaria}`);
      console.log(`      Data Criação: ${p.dataCriacao}`);
      console.log(`      Data Vencimento: ${p.dataVencimento} (HOJE)`);
      console.log(`      Prazo: ${p.prazo} dias`);
      console.log(`      Tipo: ${p.tipoManifestacao || 'N/A'}`);
      console.log(`      Dias Restantes: ${p.diasRestantes}`);
      console.log('');
    });
    
    if (protocolosVencendoHoje.length > 10) {
      console.log(`   ... e mais ${protocolosVencendoHoje.length - 10} protocolos\n`);
    }
    
    // Agrupar por secretaria
    const porSecretaria = {};
    protocolosVencendoHoje.forEach(p => {
      if (!porSecretaria[p.secretaria]) {
        porSecretaria[p.secretaria] = [];
      }
      porSecretaria[p.secretaria].push(p);
    });
    
    console.log('   Agrupados por Secretaria:\n');
    Object.entries(porSecretaria).forEach(([secretaria, protocolos]) => {
      console.log(`   - ${secretaria}: ${protocolos.length} protocolo(s)`);
    });
    console.log('');
  } else {
    console.log('   ⚠️  Nenhum protocolo vencendo hoje encontrado!\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📧 PROTOCOLOS JÁ NOTIFICADOS:\n`);
  console.log(`   Total: ${protocolosJaNotificados.length}\n`);
  
  if (protocolosJaNotificados.length > 0) {
    protocolosJaNotificados.slice(0, 5).forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.protocolo} - ${p.secretaria}`);
    });
    if (protocolosJaNotificados.length > 5) {
      console.log(`   ... e mais ${protocolosJaNotificados.length - 5} protocolos\n`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log(`⚠️  PROTOCOLOS COM PROBLEMAS:\n`);
  console.log(`   Total: ${protocolosComProblema.length}\n`);
  
  if (protocolosComProblema.length > 0) {
    protocolosComProblema.slice(0, 5).forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.protocolo}: ${p.problema}`);
    });
    if (protocolosComProblema.length > 5) {
      console.log(`   ... e mais ${protocolosComProblema.length - 5} protocolos\n`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('📊 RESUMO:\n');
  console.log(`   ✅ Protocolos vencendo hoje (não notificados): ${protocolosVencendoHoje.length}`);
  console.log(`   📧 Protocolos já notificados: ${protocolosJaNotificados.length}`);
  console.log(`   ⚠️  Protocolos com problemas: ${protocolosComProblema.length}`);
  console.log('');
  
  // Verificar se o script de cron identificaria os mesmos protocolos
  console.log('🔍 Verificando se o script de cron identificaria os mesmos protocolos...\n');
  
  if (protocolosVencendoHoje.length > 0) {
    console.log('   ✅ O script de cron DEVERIA enviar emails para estes protocolos');
    console.log(`   📧 Total de emails a enviar: ${Object.keys(porSecretaria).length} (um por secretaria)`);
  } else {
    console.log('   ⚠️  O script de cron NÃO encontraria protocolos para enviar hoje');
  }
  
  await prisma.$disconnect();
}

testarVencimentosHoje().catch(console.error);

