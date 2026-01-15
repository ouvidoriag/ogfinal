/**
 * Script de Verificação: Cálculo de Vencimentos
 * 
 * Verifica:
 * 1. Protocolos próximos de vencer (0-7 dias)
 * 2. Se o cálculo de vencimento está correto
 * 3. Exemplos de protocolos com suas datas
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getDataCriacao, isConcluido } from '../../src/utils/formatting/dateUtils.js';

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

async function verificarCalculoVencimentos() {
  console.log('🔍 Verificando cálculo de vencimentos\n');
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);
  
  console.log(`📅 Data de hoje: ${hojeStr} (${hoje.toLocaleDateString('pt-BR')})\n`);
  
  // Buscar alguns registros para análise
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
      orgaos: true,
      status: true,
      statusDemanda: true,
      data: true
    },
    take: 5000
  });
  
  console.log(`📊 Analisando ${records.length} registros...\n`);
  
  const protocolosProximos = {
    hoje: [],
    amanha: [],
    '2-7_dias': [],
    '8-15_dias': [],
    vencidos: []
  };
  
  const exemplos = [];
  
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
    
    const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);
    if (diasRestantes === null) continue;
    
    const protocolo = record.protocolo || 
                      (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
                      'N/A';
    
    const secretaria = record.orgaos || 
                      (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
                      'N/A';
    
    // Coletar exemplos
    if (exemplos.length < 20) {
      exemplos.push({
        protocolo,
        secretaria,
        dataCriacao,
        dataVencimento,
        diasRestantes,
        prazo,
        tipo
      });
    }
    
    // Categorizar
    if (diasRestantes === 0) {
      protocolosProximos.hoje.push({ protocolo, secretaria, dataVencimento, diasRestantes });
    } else if (diasRestantes === 1) {
      protocolosProximos.amanha.push({ protocolo, secretaria, dataVencimento, diasRestantes });
    } else if (diasRestantes >= 2 && diasRestantes <= 7) {
      protocolosProximos['2-7_dias'].push({ protocolo, secretaria, dataVencimento, diasRestantes });
    } else if (diasRestantes >= 8 && diasRestantes <= 15) {
      protocolosProximos['8-15_dias'].push({ protocolo, secretaria, dataVencimento, diasRestantes });
    } else if (diasRestantes < 0) {
      protocolosProximos.vencidos.push({ protocolo, secretaria, dataVencimento, diasRestantes });
    }
  }
  
  // Exibir resultados
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📊 PROTOCOLOS POR CATEGORIA:\n');
  console.log(`   🚨 Vencendo HOJE (0 dias): ${protocolosProximos.hoje.length}`);
  console.log(`   ⚠️  Vencendo AMANHÃ (1 dia): ${protocolosProximos.amanha.length}`);
  console.log(`   📅 Vencendo em 2-7 dias: ${protocolosProximos['2-7_dias'].length}`);
  console.log(`   📆 Vencendo em 8-15 dias: ${protocolosProximos['8-15_dias'].length}`);
  console.log(`   ❌ Já vencidos: ${protocolosProximos.vencidos.length}`);
  console.log('');
  
  // Detalhes dos que vencem hoje
  if (protocolosProximos.hoje.length > 0) {
    console.log('🚨 PROTOCOLOS VENCENDO HOJE:\n');
    protocolosProximos.hoje.slice(0, 10).forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.protocolo} - ${p.secretaria}`);
      console.log(`      Vencimento: ${p.dataVencimento} (HOJE)`);
    });
    console.log('');
  }
  
  // Detalhes dos que vencem amanhã
  if (protocolosProximos.amanha.length > 0) {
    console.log('⚠️  PROTOCOLOS VENCENDO AMANHÃ:\n');
    protocolosProximos.amanha.slice(0, 5).forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.protocolo} - ${p.secretaria}`);
      console.log(`      Vencimento: ${p.dataVencimento} (1 dia)`);
    });
    console.log('');
  }
  
  // Exemplos de cálculo
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📋 EXEMPLOS DE CÁLCULO (primeiros 10):\n');
  exemplos.slice(0, 10).forEach((ex, idx) => {
    console.log(`   ${idx + 1}. Protocolo: ${ex.protocolo}`);
    console.log(`      Secretaria: ${ex.secretaria}`);
    console.log(`      Data Criação: ${ex.dataCriacao}`);
    console.log(`      Tipo: ${ex.tipo || 'N/A'}`);
    console.log(`      Prazo: ${ex.prazo} dias`);
    console.log(`      Data Vencimento Calculada: ${ex.dataVencimento}`);
    console.log(`      Dias Restantes: ${ex.diasRestantes} ${ex.diasRestantes === 0 ? '(HOJE!)' : ex.diasRestantes < 0 ? '(VENCIDO)' : ''}`);
    console.log('');
  });
  
  // Verificar se há protocolos que deveriam vencer hoje mas não estão sendo identificados
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('🔍 VERIFICAÇÃO DE LÓGICA:\n');
  console.log(`   Data de hoje: ${hojeStr}`);
  console.log(`   Protocolos vencendo hoje: ${protocolosProximos.hoje.length}`);
  
  if (protocolosProximos.hoje.length === 0) {
    console.log('\n   ⚠️  Nenhum protocolo vencendo hoje encontrado.');
    console.log('   Isso pode ser normal se realmente não houver protocolos vencendo hoje.');
    console.log('   Verifique os protocolos que vencem amanhã para confirmar que o cálculo está correto.\n');
  } else {
    console.log('\n   ✅ Protocolos vencendo hoje encontrados!');
    console.log('   O script de cron DEVERIA enviar emails para estes protocolos.\n');
  }
  
  await prisma.$disconnect();
}

verificarCalculoVencimentos().catch(console.error);

