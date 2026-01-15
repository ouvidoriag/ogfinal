/**
 * Script de Verificação: Datas Inconsistentes
 * 
 * Verifica protocolos com datas de conclusão futuras ou inconsistentes
 * que podem estar causando cálculos errados
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, getDataConclusao } from '../../src/utils/formatting/dateUtils.js';

async function main() {
  console.log('🔍 Verificando Datas Inconsistentes\n');
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    const todosProtocolos = await Record.find({}).lean();
    console.log(`Total de protocolos no banco: ${todosProtocolos.length}\n`);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Buscar protocolos com datas inconsistentes
    const protocolosInconsistentes = [];
    
    for (const record of todosProtocolos) {
      const dataCriacao = getDataCriacao(record);
      const dataConclusao = getDataConclusao(record);
      
      if (!dataCriacao || !dataConclusao) continue;
      
      const dataCriacaoObj = new Date(dataCriacao + 'T00:00:00');
      const dataConclusaoObj = new Date(dataConclusao + 'T00:00:00');
      
      if (isNaN(dataCriacaoObj.getTime()) || isNaN(dataConclusaoObj.getTime())) continue;
      
      // Calcular diferença em dias
      const diffMs = dataConclusaoObj.getTime() - dataCriacaoObj.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const tempoDias = diffDias >= 0 ? diffDias + 1 : diffDias;
      
      // Verificar se a data de conclusão é futura (depois de hoje)
      const conclusaoFutura = dataConclusaoObj > hoje;
      
      // Verificar se o tempo é muito alto (> 200 dias)
      if (tempoDias > 200 || conclusaoFutura) {
        const mes = dataCriacao.slice(0, 7);
        
        protocolosInconsistentes.push({
          protocolo: record.protocolo,
          mes: mes,
          dataCriacaoIso: dataCriacao,
          dataConclusaoIso: dataConclusao,
          tempoDias: tempoDias,
          conclusaoFutura: conclusaoFutura,
          tempoDeResolucaoEmDias: record.tempoDeResolucaoEmDias
        });
      }
    }
    
    console.log(`Protocolos com datas inconsistentes (> 200 dias ou conclusão futura): ${protocolosInconsistentes.length}\n`);
    
    if (protocolosInconsistentes.length > 0) {
      // Ordenar por tempo (maior primeiro)
      protocolosInconsistentes.sort((a, b) => b.tempoDias - a.tempoDias);
      
      console.log('📋 Top 30 Protocolos com Datas Inconsistentes:');
      protocolosInconsistentes.slice(0, 30).forEach((p, i) => {
        console.log(`\n   ${i + 1}. Protocolo: ${p.protocolo || 'N/A'}`);
        console.log(`      Mês: ${p.mes}`);
        console.log(`      Criação: ${p.dataCriacaoIso}`);
        console.log(`      Conclusão: ${p.dataConclusaoIso} ${p.conclusaoFutura ? '⚠️ FUTURA' : ''}`);
        console.log(`      Tempo calculado: ${p.tempoDias} dias`);
        console.log(`      Campo tempoDeResolucaoEmDias: ${p.tempoDeResolucaoEmDias || 'N/A'}`);
      });
      
      // Estatísticas
      const tempos = protocolosInconsistentes.map(p => p.tempoDias);
      const max = Math.max(...tempos);
      const min = Math.min(...tempos);
      const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      
      console.log('\n📊 Estatísticas dos Protocolos Inconsistentes:');
      console.log(`   Mínimo: ${min} dias`);
      console.log(`   Máximo: ${max} dias`);
      console.log(`   Média: ${media.toFixed(1)} dias`);
      
      // Protocolos com conclusão futura
      const futuros = protocolosInconsistentes.filter(p => p.conclusaoFutura);
      console.log(`\n⚠️  Protocolos com conclusão futura: ${futuros.length}`);
      
      if (futuros.length > 0) {
        console.log('\n📋 Protocolos com Conclusão Futura:');
        futuros.slice(0, 10).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.protocolo}: ${p.dataCriacaoIso} → ${p.dataConclusaoIso} (${p.tempoDias} dias)`);
        });
      }
      
      // Verificar se são de jan-mai 2025
      const MESES_ALVO = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
      const janMai = protocolosInconsistentes.filter(p => MESES_ALVO.includes(p.mes));
      
      if (janMai.length > 0) {
        console.log(`\n❌ PROBLEMA: ${janMai.length} protocolos de jan-mai 2025 com datas inconsistentes!`);
      }
    } else {
      console.log('✅ Nenhum protocolo encontrado com datas inconsistentes');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Erro:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Desconectado do MongoDB Atlas');
  }
}

main().catch(console.error);


