/**
 * Script de Verificação: Protocolos com ~295 dias
 * 
 * Verifica protocolos que têm tempo próximo de 295 dias
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, getTempoResolucaoEmDias, getDataConclusao } from '../../src/utils/formatting/dateUtils.js';

async function main() {
  console.log('🔍 Verificando Protocolos com ~295 dias\n');
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    const todosProtocolos = await Record.find({}).lean();
    console.log(`Total de protocolos no banco: ${todosProtocolos.length}\n`);
    
    // Buscar protocolos com tempo próximo de 295 dias
    const protocolos295 = [];
    
    for (const record of todosProtocolos) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;
      
      const tempoDias = getTempoResolucaoEmDias(record);
      if (tempoDias === null) continue;
      
      // Buscar protocolos com tempo entre 290 e 300 dias
      if (tempoDias >= 290 && tempoDias <= 300) {
        const dataConclusao = getDataConclusao(record);
        const mes = dataCriacao.slice(0, 7);
        
        protocolos295.push({
          protocolo: record.protocolo,
          mes: mes,
          dataCriacaoIso: dataCriacao,
          dataConclusaoIso: dataConclusao,
          tempoDias: tempoDias,
          tempoDeResolucaoEmDias: record.tempoDeResolucaoEmDias,
          statusDemanda: record.statusDemanda,
          status: record.status
        });
      }
    }
    
    console.log(`Protocolos com tempo entre 290-300 dias: ${protocolos295.length}\n`);
    
    if (protocolos295.length > 0) {
      console.log('📋 Protocolos encontrados:');
      protocolos295
        .sort((a, b) => b.tempoDias - a.tempoDias)
        .forEach((p, i) => {
          console.log(`\n   ${i + 1}. Protocolo: ${p.protocolo || 'N/A'}`);
          console.log(`      Mês: ${p.mes}`);
          console.log(`      Criação: ${p.dataCriacaoIso}`);
          console.log(`      Conclusão: ${p.dataConclusaoIso || 'N/A'}`);
          console.log(`      Tempo: ${p.tempoDias} dias`);
          console.log(`      Campo tempoDeResolucaoEmDias: ${p.tempoDeResolucaoEmDias || 'N/A'}`);
          console.log(`      Status: ${p.statusDemanda || p.status || 'N/A'}`);
        });
      
      // Agrupar por mês
      const porMes = {};
      protocolos295.forEach(p => {
        if (!porMes[p.mes]) porMes[p.mes] = [];
        porMes[p.mes].push(p);
      });
      
      console.log('\n📅 Distribuição por Mês:');
      Object.keys(porMes).sort().forEach(mes => {
        console.log(`   ${mes}: ${porMes[mes].length} protocolos`);
      });
      
      // Verificar se são de jan-mai 2025 ou outros meses
      const MESES_ALVO = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
      const janMai = protocolos295.filter(p => MESES_ALVO.includes(p.mes));
      const outros = protocolos295.filter(p => !MESES_ALVO.includes(p.mes));
      
      console.log('\n⚠️  ANÁLISE:');
      console.log(`   Protocolos de jan-mai 2025: ${janMai.length} (NÃO DEVERIAM TER MAIS DE 60 DIAS!)`);
      console.log(`   Protocolos de outros meses: ${outros.length} (dados originais da planilha)`);
      
      if (janMai.length > 0) {
        console.log('\n❌ PROBLEMA: Há protocolos de jan-mai 2025 com mais de 60 dias!');
        console.log('   Esses protocolos precisam ser ajustados.');
      }
    } else {
      console.log('✅ Nenhum protocolo encontrado com tempo entre 290-300 dias');
    }
    
    // Verificar também o máximo geral
    const todosTempos = [];
    for (const record of todosProtocolos) {
      const tempoDias = getTempoResolucaoEmDias(record);
      if (tempoDias !== null) {
        todosTempos.push(tempoDias);
      }
    }
    
    if (todosTempos.length > 0) {
      const max = Math.max(...todosTempos);
      const min = Math.min(...todosTempos);
      const media = todosTempos.reduce((a, b) => a + b, 0) / todosTempos.length;
      
      console.log('\n📊 Estatísticas Gerais de TODOS os Protocolos:');
      console.log(`   Mínimo: ${min} dias`);
      console.log(`   Máximo: ${max} dias`);
      console.log(`   Média: ${media.toFixed(1)} dias`);
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


