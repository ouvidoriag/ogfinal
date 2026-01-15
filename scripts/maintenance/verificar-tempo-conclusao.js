/**
 * Script de Verificação: Tempo de Conclusão
 * 
 * Verifica protocolos de jan-mai 2025 com tempo de conclusão > 60 dias
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, getDataConclusao, getTempoResolucaoEmDias } from '../../src/utils/formatting/dateUtils.js';

const MESES_ALVO = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
const MAX_DIAS = 60;

async function main() {
  console.log('🔍 Verificando Tempo de Conclusão - Jan-Mai 2025\n');
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    // Buscar protocolos
    const filtroCompleto = {
      $or: [
        ...MESES_ALVO.map(mes => ({
          dataCriacaoIso: { $regex: `^${mes}`, $options: 'i' }
        })),
        ...MESES_ALVO.map(mes => ({
          dataDaCriacao: { $regex: `^${mes}`, $options: 'i' }
        }))
      ]
    };
    
    const todosProtocolos = await Record.find(filtroCompleto).lean();
    console.log(`Total de protocolos encontrados: ${todosProtocolos.length}\n`);
    
    // Processar e calcular tempos
    const protocolosComTempo = todosProtocolos
      .map(record => {
        const dataCriacao = getDataCriacao(record);
        const dataConclusao = getDataConclusao(record);
        
        if (!dataCriacao) return null;
        
        const mes = dataCriacao.slice(0, 7);
        if (!MESES_ALVO.includes(mes)) return null;
        
        let tempoDias = getTempoResolucaoEmDias(record);
        
        // Se não conseguiu calcular, calcular manualmente
        if (tempoDias === null && dataCriacao && dataConclusao) {
          const start = new Date(dataCriacao + 'T00:00:00');
          const end = new Date(dataConclusao + 'T00:00:00');
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
            tempoDias = diff >= 0 ? diff + 1 : null;
          }
        }
        
        return {
          _id: record._id,
          protocolo: record.protocolo,
          dataCriacaoIso: dataCriacao,
          dataConclusaoIso: dataConclusao,
          tempoDias: tempoDias,
          tempoDeResolucaoEmDias: record.tempoDeResolucaoEmDias,
          record: record
        };
      })
      .filter(p => p !== null && p.tempoDias !== null);
    
    console.log(`Protocolos com tempo calculado: ${protocolosComTempo.length}\n`);
    
    // Estatísticas
    const tempos = protocolosComTempo.map(p => p.tempoDias);
    const min = Math.min(...tempos);
    const max = Math.max(...tempos);
    const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
    
    console.log('📊 Estatísticas de Tempo de Conclusão:');
    console.log(`   Mínimo: ${min} dias`);
    console.log(`   Máximo: ${max} dias`);
    console.log(`   Média: ${media.toFixed(1)} dias\n`);
    
    // Protocolos com mais de 60 dias
    const acimaDe60 = protocolosComTempo.filter(p => p.tempoDias > MAX_DIAS);
    console.log(`⚠️  Protocolos com mais de ${MAX_DIAS} dias: ${acimaDe60.length}\n`);
    
    if (acimaDe60.length > 0) {
      console.log('📋 Primeiros 20 protocolos acima de 60 dias:');
      acimaDe60
        .sort((a, b) => b.tempoDias - a.tempoDias)
        .slice(0, 20)
        .forEach((p, i) => {
          console.log(`   ${i + 1}. Protocolo: ${p.protocolo || 'N/A'}`);
          console.log(`      Criação: ${p.dataCriacaoIso}`);
          console.log(`      Conclusão: ${p.dataConclusaoIso}`);
          console.log(`      Tempo: ${p.tempoDias} dias`);
          console.log(`      Campo tempoDeResolucaoEmDias: ${p.tempoDeResolucaoEmDias || 'N/A'}\n`);
        });
      
      // Distribuição por faixas
      console.log('\n📊 Distribuição por Faixas:');
      const faixas = [
        { min: 0, max: 30, count: 0 },
        { min: 31, max: 60, count: 0 },
        { min: 61, max: 100, count: 0 },
        { min: 101, max: 200, count: 0 },
        { min: 201, max: 300, count: 0 },
        { min: 301, max: Infinity, count: 0 }
      ];
      
      protocolosComTempo.forEach(p => {
        const faixa = faixas.find(f => p.tempoDias >= f.min && p.tempoDias <= f.max);
        if (faixa) faixa.count++;
      });
      
      faixas.forEach(f => {
        if (f.max === Infinity) {
          console.log(`   ${f.min}+ dias: ${f.count} protocolos`);
        } else {
          console.log(`   ${f.min}-${f.max} dias: ${f.count} protocolos`);
        }
      });
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

