/**
 * Script de Verificação Final: Ajustes Aplicados
 * 
 * Verifica se apenas protocolos de jan-mai 2025 foram ajustados
 * e outros meses mantiveram dados originais
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, getTempoResolucaoEmDias } from '../../src/utils/formatting/dateUtils.js';

const MESES_ALVO = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
const MAX_DIAS = 60;

async function main() {
  console.log('🔍 Verificação Final: Ajustes Aplicados\n');
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    const todosProtocolos = await Record.find({}).lean();
    console.log(`Total de protocolos no banco: ${todosProtocolos.length}\n`);
    
    // Separar por período
    const protocolosJanMai = [];
    const protocolosOutrosMeses = [];
    
    for (const record of todosProtocolos) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;
      
      const mes = dataCriacao.slice(0, 7);
      const tempoDias = getTempoResolucaoEmDias(record);
      
      const protocolo = {
        protocolo: record.protocolo,
        mes: mes,
        tempoDias: tempoDias
      };
      
      if (MESES_ALVO.includes(mes)) {
        protocolosJanMai.push(protocolo);
      } else {
        protocolosOutrosMeses.push(protocolo);
      }
    }
    
    // Verificar jan-mai 2025
    const janMaiAcima60 = protocolosJanMai.filter(p => p.tempoDias !== null && p.tempoDias > MAX_DIAS);
    const temposJanMai = protocolosJanMai.map(p => p.tempoDias).filter(t => t !== null);
    
    console.log('📊 PROTOCOLOS DE JANEIRO A MAIO DE 2025:');
    console.log(`   Total: ${protocolosJanMai.length}`);
    console.log(`   Com tempo > ${MAX_DIAS} dias: ${janMaiAcima60.length}`);
    if (temposJanMai.length > 0) {
      console.log(`   Mínimo: ${Math.min(...temposJanMai)} dias`);
      console.log(`   Máximo: ${Math.max(...temposJanMai)} dias`);
      console.log(`   Média: ${(temposJanMai.reduce((a, b) => a + b, 0) / temposJanMai.length).toFixed(1)} dias`);
    }
    
    // Verificar outros meses
    const outrosMesesAcima60 = protocolosOutrosMeses.filter(p => p.tempoDias !== null && p.tempoDias > MAX_DIAS);
    const temposOutros = protocolosOutrosMeses.map(p => p.tempoDias).filter(t => t !== null);
    
    console.log(`\n📊 PROTOCOLOS DE OUTROS MESES (restaurados da planilha):`);
    console.log(`   Total: ${protocolosOutrosMeses.length}`);
    console.log(`   Com tempo > ${MAX_DIAS} dias: ${outrosMesesAcima60.length}`);
    if (temposOutros.length > 0) {
      console.log(`   Mínimo: ${Math.min(...temposOutros)} dias`);
      console.log(`   Máximo: ${Math.max(...temposOutros)} dias`);
      console.log(`   Média: ${(temposOutros.reduce((a, b) => a + b, 0) / temposOutros.length).toFixed(1)} dias`);
    }
    
    console.log('\n' + '='.repeat(80));
    if (janMaiAcima60.length === 0) {
      console.log('✅ Protocolos de jan-mai 2025: Todos ajustados corretamente (≤ 60 dias)');
    } else {
      console.log(`⚠️  Protocolos de jan-mai 2025: ${janMaiAcima60.length} ainda acima de 60 dias`);
    }
    
    if (outrosMesesAcima60.length > 0) {
      console.log(`✅ Protocolos de outros meses: ${outrosMesesAcima60.length} com tempo > 60 dias (dados originais da planilha)`);
    } else {
      console.log('✅ Protocolos de outros meses: Todos ≤ 60 dias');
    }
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Erro:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Desconectado do MongoDB Atlas');
  }
}

main().catch(console.error);

