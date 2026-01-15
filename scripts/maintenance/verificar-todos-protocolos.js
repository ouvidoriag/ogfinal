/**
 * Script de Verificação: TODOS os Protocolos
 * 
 * Verifica TODOS os protocolos do banco com tempo > 60 dias
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, getTempoResolucaoEmDias } from '../../src/utils/formatting/dateUtils.js';

const MAX_DIAS = 60;

async function main() {
  console.log('🔍 Verificando TODOS os Protocolos com Tempo > 60 dias\n');
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    // Buscar TODOS os protocolos
    console.log('📊 Buscando todos os protocolos...');
    const todosProtocolos = await Record.find({}).lean();
    console.log(`Total de protocolos no banco: ${todosProtocolos.length}\n`);
    
    // Processar e calcular tempos
    const protocolosComTempo = [];
    
    for (const record of todosProtocolos) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;
      
      // Calcular tempo de duas formas
      let tempoCalculado = getTempoResolucaoEmDias(record);
      
      // Se não conseguiu calcular, calcular manualmente
      if (tempoCalculado === null) {
        const dataConclusao = record.dataConclusaoIso || record.dataDaConclusao;
        if (dataConclusao) {
          const start = new Date(dataCriacao + 'T00:00:00');
          const end = new Date(dataConclusao + 'T00:00:00');
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
            tempoCalculado = diff >= 0 ? diff + 1 : null;
          }
        }
      }
      
      // Verificar campo direto também
      let tempoCampo = null;
      if (record.tempoDeResolucaoEmDias) {
        const parsed = parseFloat(record.tempoDeResolucaoEmDias);
        if (!isNaN(parsed)) {
          tempoCampo = parsed;
        }
      }
      
      // Usar o maior valor entre calculado e campo
      const tempoFinal = tempoCalculado !== null ? tempoCalculado : tempoCampo;
      
      if (tempoFinal !== null && tempoFinal > MAX_DIAS) {
        protocolosComTempo.push({
          _id: record._id,
          protocolo: record.protocolo,
          dataCriacaoIso: dataCriacao,
          dataConclusaoIso: record.dataConclusaoIso || record.dataDaConclusao,
          tempoCalculado: tempoCalculado,
          tempoCampo: tempoCampo,
          tempoFinal: tempoFinal,
          tempoDeResolucaoEmDias: record.tempoDeResolucaoEmDias,
          mes: dataCriacao.slice(0, 7)
        });
      }
    }
    
    console.log(`⚠️  Protocolos com tempo > ${MAX_DIAS} dias: ${protocolosComTempo.length}\n`);
    
    if (protocolosComTempo.length > 0) {
      // Ordenar por tempo (maior primeiro)
      protocolosComTempo.sort((a, b) => b.tempoFinal - a.tempoFinal);
      
      console.log('📋 Top 30 Protocolos com maior tempo:');
      protocolosComTempo.slice(0, 30).forEach((p, i) => {
        console.log(`\n   ${i + 1}. Protocolo: ${p.protocolo || 'N/A'}`);
        console.log(`      Mês: ${p.mes}`);
        console.log(`      Criação: ${p.dataCriacaoIso}`);
        console.log(`      Conclusão: ${p.dataConclusaoIso || 'N/A'}`);
        console.log(`      Tempo Calculado: ${p.tempoCalculado !== null ? p.tempoCalculado + ' dias' : 'N/A'}`);
        console.log(`      Tempo Campo: ${p.tempoCampo !== null ? p.tempoCampo + ' dias' : 'N/A'}`);
        console.log(`      Tempo Final: ${p.tempoFinal} dias`);
        console.log(`      Campo tempoDeResolucaoEmDias: ${p.tempoDeResolucaoEmDias || 'N/A'}`);
      });
      
      // Estatísticas
      const tempos = protocolosComTempo.map(p => p.tempoFinal);
      const max = Math.max(...tempos);
      const min = Math.min(...tempos);
      const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      
      console.log('\n📊 Estatísticas:');
      console.log(`   Mínimo: ${min} dias`);
      console.log(`   Máximo: ${max} dias`);
      console.log(`   Média: ${media.toFixed(1)} dias\n`);
      
      // Agrupar por mês
      const porMes = {};
      protocolosComTempo.forEach(p => {
        if (!porMes[p.mes]) porMes[p.mes] = [];
        porMes[p.mes].push(p);
      });
      
      console.log('📅 Distribuição por Mês:');
      Object.keys(porMes).sort().forEach(mes => {
        console.log(`   ${mes}: ${porMes[mes].length} protocolos`);
      });
    } else {
      console.log('✅ Nenhum protocolo encontrado com tempo > 60 dias!');
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

