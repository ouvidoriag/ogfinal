/**
 * Script: Ajustar Protocolo Restante de Jan-Mai 2025
 * 
 * Ajusta o último protocolo de jan-mai 2025 que ainda está acima de 60 dias
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, getTempoResolucaoEmDias, isConcluido } from '../../src/utils/formatting/dateUtils.js';

const MESES_ALVO = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
const MAX_DIAS = 60;

function adicionarDias(dataIso, dias) {
  const data = new Date(dataIso + 'T00:00:00');
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

async function main() {
  console.log('🔧 Ajustando Protocolo Restante de Jan-Mai 2025\n');
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    const todosProtocolos = await Record.find({}).lean();
    
    // Encontrar protocolos de jan-mai 2025 acima de 60 dias
    const protocolosAcima60 = [];
    
    for (const record of todosProtocolos) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;
      
      const mes = dataCriacao.slice(0, 7);
      if (!MESES_ALVO.includes(mes)) continue;
      
      if (!isConcluido(record)) continue;
      
      const tempoDias = getTempoResolucaoEmDias(record);
      if (tempoDias !== null && tempoDias > MAX_DIAS) {
        protocolosAcima60.push({
          _id: record._id,
          protocolo: record.protocolo,
          dataCriacaoIso: dataCriacao,
          tempoAtual: tempoDias,
          record: record
        });
      }
    }
    
    console.log(`Protocolos de jan-mai 2025 acima de 60 dias: ${protocolosAcima60.length}\n`);
    
    if (protocolosAcima60.length === 0) {
      console.log('✅ Nenhum protocolo encontrado acima de 60 dias!');
      await mongoose.disconnect();
      return;
    }
    
    // Mostrar protocolos encontrados
    protocolosAcima60.forEach((p, i) => {
      console.log(`${i + 1}. Protocolo: ${p.protocolo}`);
      console.log(`   Criação: ${p.dataCriacaoIso}`);
      console.log(`   Tempo atual: ${p.tempoAtual} dias\n`);
    });
    
    // Ajustar cada protocolo para 60 dias
    console.log('Ajustando protocolos...\n');
    
    for (const protocolo of protocolosAcima60) {
      // Adicionar 59 dias para que o resultado final seja 60 (sistema adiciona +1)
      const diasConclusao = MAX_DIAS - 1; // 59 dias
      const novaDataConclusao = adicionarDias(protocolo.dataCriacaoIso, diasConclusao);
      
      const dataCriacao = new Date(protocolo.dataCriacaoIso + 'T00:00:00');
      const dataConclusao = new Date(novaDataConclusao + 'T00:00:00');
      const diffDias = Math.floor((dataConclusao - dataCriacao) / (1000 * 60 * 60 * 24));
      const tempoResolucao = diffDias >= 0 ? diffDias + 1 : 1;
      
      await Record.updateOne(
        { _id: protocolo._id },
        {
          $set: {
            dataConclusaoIso: novaDataConclusao,
            dataDaConclusao: novaDataConclusao.split('-').reverse().join('/'),
            tempoDeResolucaoEmDias: String(tempoResolucao),
            statusDemanda: protocolo.record.statusDemanda || 'Concluída',
            status: protocolo.record.status || 'Concluída'
          }
        }
      );
      
      console.log(`✅ Ajustado: ${protocolo.protocolo} - ${protocolo.tempoAtual} dias → ${tempoResolucao} dias`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Processo concluído!');
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

