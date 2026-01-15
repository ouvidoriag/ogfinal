/**
 * Script de Reversão: Protocolos de Outros Meses
 * 
 * Reverte mudanças feitas em protocolos que NÃO são de jan-mai 2025
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, isConcluido, getDataConclusao } from '../../src/utils/formatting/dateUtils.js';

const MESES_ALVO = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

async function main() {
  console.log('⚠️  CÉREBRO X-3: Reversão de Protocolos de Outros Meses\n');
  console.log('   REVERTENDO mudanças feitas em protocolos que NÃO são de jan-mai 2025\n');
  if (DRY_RUN) {
    console.log('⚠️  MODO DRY-RUN ATIVADO: Nenhuma mudança será aplicada no banco de dados\n');
  }
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    // ============================================
    // ETAPA 1: IDENTIFICAR PROTOCOLOS DE OUTROS MESES ALTERADOS
    // ============================================
    console.log('📊 ETAPA 1: Identificando Protocolos de Outros Meses Alterados\n');
    
    const todosProtocolos = await Record.find({}).lean();
    console.log(`   Total de protocolos no banco: ${todosProtocolos.length}`);
    
    // Identificar protocolos de outros meses que foram alterados
    // Critério: protocolos concluídos com dataConclusaoIso que NÃO são de jan-mai 2025
    // e que têm tempoDeResolucaoEmDias <= 60 (indicando que foram ajustados)
    const protocolosParaReverter = [];
    
    for (const record of todosProtocolos) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;
      
      const mes = dataCriacao.slice(0, 7); // YYYY-MM
      
      // Pular protocolos de jan-mai 2025 (esses devem ser mantidos)
      if (MESES_ALVO.includes(mes)) continue;
      
      // Verificar se é concluído e tem data de conclusão
      if (!isConcluido(record)) continue;
      
      const dataConclusao = getDataConclusao(record);
      if (!dataConclusao) continue;
      
      // Calcular tempo de resolução
      const start = new Date(dataCriacao + 'T00:00:00');
      const end = new Date(dataConclusao + 'T00:00:00');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
      
      const diffDias = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      const tempoAtual = diffDias >= 0 ? diffDias + 1 : null;
      
      if (tempoAtual === null) continue;
      
      // Se o tempo está <= 60 dias e o protocolo é de outro mês,
      // provavelmente foi alterado pelo script errado
      // Vamos verificar também o campo tempoDeResolucaoEmDias
      const tempoCampo = record.tempoDeResolucaoEmDias ? parseFloat(record.tempoDeResolucaoEmDias) : null;
      
      // Se o tempo calculado é <= 60, provavelmente foi ajustado
      // Mas precisamos ter cuidado - pode ser que o protocolo realmente tenha sido concluído em <= 60 dias
      // Vamos marcar apenas aqueles que claramente parecem ter sido alterados
      // (tempoDeResolucaoEmDias <= 60 e data de conclusão muito próxima da criação)
      
      // Critério mais seguro: protocolos com tempoDeResolucaoEmDias <= 60
      // que foram alterados recentemente (updatedAt recente)
      // Mas como não temos histórico, vamos usar um critério diferente:
      // Protocolos que têm dataConclusaoIso mas o tempo é exatamente <= 60
      // E que não são de jan-mai 2025
      
      // Na verdade, o problema é que não temos os valores originais
      // Vou criar um script que apenas identifica e alerta
      // O usuário precisará restaurar manualmente ou de um backup
      
      if (tempoAtual <= 60 && tempoCampo !== null && tempoCampo <= 60) {
        protocolosParaReverter.push({
          _id: record._id,
          protocolo: record.protocolo,
          mes: mes,
          dataCriacaoIso: dataCriacao,
          dataConclusaoIso: dataConclusao,
          tempoAtual: tempoAtual,
          tempoCampo: tempoCampo,
          record: record
        });
      }
    }
    
    console.log(`   ⚠️  Protocolos de outros meses que podem ter sido alterados: ${protocolosParaReverter.length}\n`);
    
    if (protocolosParaReverter.length === 0) {
      console.log('✅ Nenhum protocolo identificado para reversão.');
      await mongoose.disconnect();
      return;
    }
    
    // Mostrar alguns exemplos
    console.log('📋 Primeiros 20 protocolos identificados:');
    protocolosParaReverter.slice(0, 20).forEach((p, i) => {
      console.log(`\n   ${i + 1}. Protocolo: ${p.protocolo || 'N/A'}`);
      console.log(`      Mês: ${p.mes}`);
      console.log(`      Criação: ${p.dataCriacaoIso}`);
      console.log(`      Conclusão: ${p.dataConclusaoIso}`);
      console.log(`      Tempo atual: ${p.tempoAtual} dias`);
      console.log(`      Campo tempoDeResolucaoEmDias: ${p.tempoCampo} dias`);
    });
    
    console.log('\n⚠️  ATENÇÃO: Não temos backup dos valores originais!');
    console.log('   Este script apenas identifica os protocolos que podem ter sido alterados.');
    console.log('   Para reverter completamente, você precisará:');
    console.log('   1. Restaurar de um backup do banco de dados');
    console.log('   2. Ou executar o pipeline novamente para sincronizar com a planilha');
    console.log('   3. Ou ajustar manualmente baseado em dados externos\n');
    
    // Estatísticas por mês
    const porMes = {};
    protocolosParaReverter.forEach(p => {
      if (!porMes[p.mes]) porMes[p.mes] = [];
      porMes[p.mes].push(p);
    });
    
    console.log('📅 Distribuição por Mês:');
    Object.keys(porMes).sort().forEach(mes => {
      console.log(`   ${mes}: ${porMes[mes].length} protocolos`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  AÇÃO NECESSÁRIA:');
    console.log('   Os protocolos de outros meses foram alterados incorretamente.');
    console.log('   Recomendação: Restaurar de backup ou executar pipeline de sincronização.');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Erro durante o processo:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Desconectado do MongoDB Atlas');
  }
}

main().catch(console.error);

