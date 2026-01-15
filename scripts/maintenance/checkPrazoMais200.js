/**
 * Script para verificar registros com prazos de mais de 200 dias
 * 
 * Uso: node scripts/checkPrazoMais200.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getTempoResolucaoEmDias } from '../src/utils/dateUtils.js';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log('🔍 Verificando registros com prazos de mais de 200 dias...\n');
  
  try {
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar todos os registros
    console.log('📊 Buscando todos os registros...');
    const allRecords = await prisma.record.findMany({
      select: {
        id: true,
        protocolo: true,
        tempoDeResolucaoEmDias: true,
        dataDaCriacao: true,
        dataDaConclusao: true,
        dataCriacaoIso: true,
        dataConclusaoIso: true,
        statusDemanda: true,
        tema: true,
        assunto: true,
        orgaos: true,
        responsavel: true,
        data: true
      }
    });
    
    console.log(`✅ ${allRecords.length} registros encontrados\n`);
    
    // Filtrar registros com mais de 200 dias
    const registrosMais200 = [];
    
    console.log('🔄 Calculando tempo de resolução para cada registro...');
    for (const record of allRecords) {
      const tempoDias = getTempoResolucaoEmDias(record, true);
      
      if (tempoDias !== null && tempoDias > 200) {
        registrosMais200.push({
          ...record,
          tempoCalculado: tempoDias
        });
      }
    }
    
    console.log(`\n📊 Resultados:\n`);
    console.log(`   Total de registros: ${allRecords.length}`);
    console.log(`   Registros com mais de 200 dias: ${registrosMais200.length}`);
    console.log(`   Percentual: ${((registrosMais200.length / allRecords.length) * 100).toFixed(2)}%\n`);
    
    if (registrosMais200.length > 0) {
      console.log('⚠️  REGISTROS COM MAIS DE 200 DIAS:\n');
      console.log('='.repeat(100));
      
      // Ordenar por tempo (maior primeiro)
      registrosMais200.sort((a, b) => b.tempoCalculado - a.tempoCalculado);
      
      // Mostrar top 50
      const top50 = registrosMais200.slice(0, 50);
      
      for (const record of top50) {
        console.log(`\n📋 Protocolo: ${record.protocolo || 'N/A'}`);
        console.log(`   Tempo de Resolução: ${record.tempoCalculado} dias`);
        console.log(`   Status: ${record.statusDemanda || 'N/A'}`);
        console.log(`   Tema: ${record.tema || 'N/A'}`);
        console.log(`   Assunto: ${record.assunto || 'N/A'}`);
        console.log(`   Órgão: ${record.orgaos || 'N/A'}`);
        console.log(`   Responsável: ${record.responsavel || 'N/A'}`);
        console.log(`   Data Criação: ${record.dataDaCriacao || record.dataCriacaoIso || 'N/A'}`);
        console.log(`   Data Conclusão: ${record.dataDaConclusao || record.dataConclusaoIso || 'N/A'}`);
        console.log(`   Campo tempoDeResolucaoEmDias: ${record.tempoDeResolucaoEmDias || 'N/A'}`);
        console.log('-'.repeat(100));
      }
      
      if (registrosMais200.length > 50) {
        console.log(`\n... e mais ${registrosMais200.length - 50} registros\n`);
      }
      
      // Estatísticas adicionais
      console.log('\n📈 ESTATÍSTICAS:\n');
      
      const tempos = registrosMais200.map(r => r.tempoCalculado);
      const maxTempo = Math.max(...tempos);
      const minTempo = Math.min(...tempos);
      const avgTempo = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      
      console.log(`   Tempo máximo: ${maxTempo} dias`);
      console.log(`   Tempo mínimo: ${minTempo} dias`);
      console.log(`   Tempo médio: ${avgTempo.toFixed(2)} dias`);
      
      // Agrupar por faixas
      const faixas = {
        '201-300': 0,
        '301-400': 0,
        '401-500': 0,
        '501-600': 0,
        '600+': 0
      };
      
      for (const tempo of tempos) {
        if (tempo <= 300) faixas['201-300']++;
        else if (tempo <= 400) faixas['301-400']++;
        else if (tempo <= 500) faixas['401-500']++;
        else if (tempo <= 600) faixas['501-600']++;
        else faixas['600+']++;
      }
      
      console.log('\n   Distribuição por faixas:');
      for (const [faixa, count] of Object.entries(faixas)) {
        if (count > 0) {
          console.log(`     ${faixa} dias: ${count} registros`);
        }
      }
      
      // Agrupar por status
      const porStatus = {};
      for (const record of registrosMais200) {
        const status = record.statusDemanda || 'Não informado';
        porStatus[status] = (porStatus[status] || 0) + 1;
      }
      
      console.log('\n   Por Status:');
      const statusSorted = Object.entries(porStatus).sort((a, b) => b[1] - a[1]);
      for (const [status, count] of statusSorted.slice(0, 10)) {
        console.log(`     ${status}: ${count} registros`);
      }
      
      // Agrupar por órgão
      const porOrgao = {};
      for (const record of registrosMais200) {
        const orgao = record.orgaos || 'Não informado';
        porOrgao[orgao] = (porOrgao[orgao] || 0) + 1;
      }
      
      console.log('\n   Top 10 Órgãos:');
      const orgaoSorted = Object.entries(porOrgao).sort((a, b) => b[1] - a[1]);
      for (const [orgao, count] of orgaoSorted.slice(0, 10)) {
        console.log(`     ${orgao}: ${count} registros`);
      }
    } else {
      console.log('✅ Nenhum registro encontrado com mais de 200 dias!');
    }
    
  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
main()
  .then(() => {
    console.log('\n🎉 Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });


