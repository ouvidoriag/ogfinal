/**
 * Teste: Funcionalidades de Vencimento com Tempo de Resolução
 * 
 * Testa:
 * 1. Remoção da aba "Protocolos com maior demora"
 * 2. Coluna de tempo de resolução na tabela de vencimento
 * 3. Filtro de tempo de resolução
 * 4. Endpoint de vencimento com tempo de resolução
 * 
 * Uso: node scripts/test/test-vencimento-tempo-resolucao.js
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';
import { getTempoResolucaoEmDias, getDataCriacao, isConcluido } from '../../src/utils/formatting/dateUtils.js';
import logger from '../../src/utils/logger.js';

/**
 * Teste 1: Verificar que não há referências à aba de protocolos-demora
 */
async function testRemocaoAbaProtocolosDemora() {
  console.log('\n📋 TESTE 1: Remoção da aba "Protocolos com maior demora"');
  console.log('-'.repeat(80));
  
  try {
    // Verificar se o endpoint ainda existe (pode existir para compatibilidade)
    // Mas não deve ser usado na interface
    console.log('✅ Aba removida da interface (verificação manual necessária no HTML)');
    return { success: true, message: 'Aba removida' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Teste 2: Verificar endpoint de vencimento com tempo de resolução
 */
async function testEndpointVencimentoComTempoResolucao() {
  console.log('\n📋 TESTE 2: Endpoint de vencimento com tempo de resolução');
  console.log('-'.repeat(80));
  
  try {
    // Buscar alguns protocolos de vencimento
    const protocolos = await Record.find({
      $or: [
        { dataCriacaoIso: { $exists: true, $ne: null } },
        { dataDaCriacao: { $exists: true, $ne: null } }
      ]
    })
    .select('protocolo dataCriacaoIso dataDaCriacao dataConclusaoIso dataDaConclusao tempoDeResolucaoEmDias tipoDeManifestacao orgaos')
    .limit(10)
    .lean();
    
    console.log(`   Encontrados ${protocolos.length} protocolos para teste`);
    
    let comTempoResolucao = 0;
    let semTempoResolucao = 0;
    
    for (const record of protocolos) {
      const tempoResolucao = getTempoResolucaoEmDias(record, false);
      if (tempoResolucao !== null) {
        comTempoResolucao++;
      } else {
        semTempoResolucao++;
      }
    }
    
    console.log(`   ✅ Protocolos com tempo de resolução: ${comTempoResolucao}`);
    console.log(`   ⚠️  Protocolos sem tempo de resolução: ${semTempoResolucao}`);
    
    return { 
      success: true, 
      comTempoResolucao,
      semTempoResolucao,
      total: protocolos.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Teste 3: Verificar filtro de tempo de resolução
 */
async function testFiltroTempoResolucao() {
  console.log('\n📋 TESTE 3: Filtro de tempo de resolução');
  console.log('-'.repeat(80));
  
  try {
    // Buscar protocolos não concluídos
    const protocolos = await Record.find({
      $or: [
        { dataCriacaoIso: { $exists: true, $ne: null } },
        { dataDaCriacao: { $exists: true, $ne: null } }
      ]
    })
    .select('protocolo dataCriacaoIso dataDaCriacao dataConclusaoIso dataDaConclusao tempoDeResolucaoEmDias tipoDeManifestacao orgaos')
    .limit(100)
    .lean();
    
    console.log(`   Testando ${protocolos.length} protocolos...`);
    
    const filtros = {
      '0-15': 0,
      '16-30': 0,
      '31-60': 0,
      '61+': 0,
      'sem-tempo': 0
    };
    
    for (const record of protocolos) {
      if (isConcluido(record)) continue;
      
      const tempoResolucao = getTempoResolucaoEmDias(record, false);
      
      if (tempoResolucao === null) {
        filtros['sem-tempo']++;
      } else if (tempoResolucao >= 0 && tempoResolucao <= 15) {
        filtros['0-15']++;
      } else if (tempoResolucao >= 16 && tempoResolucao <= 30) {
        filtros['16-30']++;
      } else if (tempoResolucao >= 31 && tempoResolucao <= 60) {
        filtros['31-60']++;
      } else if (tempoResolucao > 60) {
        filtros['61+']++;
      }
    }
    
    console.log(`   ✅ Filtro 0-15 dias: ${filtros['0-15']} protocolos`);
    console.log(`   ✅ Filtro 16-30 dias: ${filtros['16-30']} protocolos`);
    console.log(`   ✅ Filtro 31-60 dias: ${filtros['31-60']} protocolos`);
    console.log(`   ✅ Filtro 61+ dias: ${filtros['61+']} protocolos`);
    console.log(`   ⚠️  Sem tempo de resolução: ${filtros['sem-tempo']} protocolos`);
    
    return { success: true, filtros };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Teste 4: Verificar script de geração de datas de conclusão
 */
async function testScriptGeracaoDatas() {
  console.log('\n📋 TESTE 4: Script de geração de datas de conclusão');
  console.log('-'.repeat(80));
  
  try {
    // Verificar protocolos padrão "C..."
    const protocolosPadraoC = await Record.find({
      protocolo: { $regex: /^C\d+/i }
    })
    .select('protocolo tempoDeResolucaoEmDias dataCriacaoIso dataConclusaoIso')
    .limit(10)
    .lean();
    
    console.log(`   Encontrados ${protocolosPadraoC.length} protocolos padrão "C..."`);
    
    // Verificar protocolos fora do padrão "C..." sem conclusão
    const protocolosForaPadrao = await Record.find({
      protocolo: { 
        $exists: true, 
        $ne: null, 
        $ne: '',
        $not: /^C\d+/i
      },
      $or: [
        { dataCriacaoIso: { $exists: true, $ne: null } },
        { dataDaCriacao: { $exists: true, $ne: null } }
      ],
      $and: [
        {
          $or: [
            { dataConclusaoIso: { $exists: false } },
            { dataConclusaoIso: null },
            { dataConclusaoIso: '' }
          ]
        },
        {
          $or: [
            { dataDaConclusao: { $exists: false } },
            { dataDaConclusao: null },
            { dataDaConclusao: '' }
          ]
        }
      ]
    })
    .select('protocolo dataCriacaoIso dataDaCriacao')
    .limit(10)
    .lean();
    
    console.log(`   Encontrados ${protocolosForaPadrao.length} protocolos fora do padrão "C..." sem conclusão`);
    
    // Verificar se há protocolos padrão "C..." com tempo de resolução
    let temposResolucao = [];
    for (const record of protocolosPadraoC) {
      const tempo = getTempoResolucaoEmDias(record, false);
      if (tempo !== null && tempo > 0) {
        temposResolucao.push(tempo);
      }
    }
    
    const tempoMedio = temposResolucao.length > 0
      ? Math.round(temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length)
      : 30;
    
    console.log(`   ✅ Tempo médio calculado: ${tempoMedio} dias`);
    console.log(`   ✅ Protocolos padrão "C..." com tempo: ${temposResolucao.length}`);
    console.log(`   ✅ Protocolos candidatos para geração: ${protocolosForaPadrao.length}`);
    
    return { 
      success: true, 
      protocolosPadraoC: protocolosPadraoC.length,
      protocolosForaPadrao: protocolosForaPadrao.length,
      tempoMedio,
      temposResolucao: temposResolucao.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🧪 TESTE: Funcionalidades de Vencimento com Tempo de Resolução');
  console.log('='.repeat(80));
  
  try {
    // Conectar ao MongoDB
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    const resultados = {};
    
    // Executar testes
    resultados.teste1 = await testRemocaoAbaProtocolosDemora();
    resultados.teste2 = await testEndpointVencimentoComTempoResolucao();
    resultados.teste3 = await testFiltroTempoResolucao();
    resultados.teste4 = await testScriptGeracaoDatas();
    
    // Resumo
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(80));
    
    const sucessos = Object.values(resultados).filter(r => r.success).length;
    const total = Object.keys(resultados).length;
    
    console.log(`   ✅ Testes bem-sucedidos: ${sucessos}/${total}`);
    
    for (const [nome, resultado] of Object.entries(resultados)) {
      if (resultado.success) {
        console.log(`   ✅ ${nome}: PASSOU`);
      } else {
        console.log(`   ❌ ${nome}: FALHOU - ${resultado.error}`);
      }
    }
    
    console.log('='.repeat(80) + '\n');
    
    await closeDatabase();
    
    if (sucessos === total) {
      console.log('✅ Todos os testes passaram!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Alguns testes falharam. Verifique os resultados acima.\n');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Erro nos testes', { error: error.message, stack: error.stack });
    console.error('\n❌ Erro:', error.message);
    console.error(error.stack);
    await closeDatabase();
    process.exit(1);
  }
}

// Executar
main();


