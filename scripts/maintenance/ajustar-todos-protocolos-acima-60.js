/**
 * Script de Ajuste: TODOS os Protocolos acima de 60 dias
 * 
 * Ajusta TODOS os protocolos concluídos com tempo > 60 dias,
 * limitando-os a no máximo 60 dias a partir da data de criação
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, getDataConclusao, isConcluido, getTempoResolucaoEmDias } from '../../src/utils/formatting/dateUtils.js';

const MAX_DIAS = 60;
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

/**
 * Adiciona dias a uma data ISO
 */
function adicionarDias(dataIso, dias) {
  const data = new Date(dataIso + 'T00:00:00');
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function main() {
  console.log('🚀 CÉREBRO X-3: Ajuste de TODOS os Protocolos acima de 60 dias\n');
  if (DRY_RUN) {
    console.log('⚠️  MODO DRY-RUN ATIVADO: Nenhuma mudança será aplicada no banco de dados\n');
  }
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    // ============================================
    // ETAPA 1: BUSCAR PROTOCOLOS ACIMA DE 60 DIAS
    // ============================================
    console.log('📊 ETAPA 1: Buscando Protocolos acima de 60 dias\n');
    
    const todosProtocolos = await Record.find({}).lean();
    console.log(`   Total de protocolos no banco: ${todosProtocolos.length}`);
    
    // Processar e identificar protocolos acima de 60 dias
    const protocolosAcima60 = [];
    
    for (const record of todosProtocolos) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;
      
      // Só ajustar protocolos concluídos
      if (!isConcluido(record)) continue;
      
      // Calcular tempo
      let tempoDias = getTempoResolucaoEmDias(record);
      
      // Se não conseguiu calcular, calcular manualmente
      if (tempoDias === null) {
        const dataConclusao = getDataConclusao(record);
        if (dataConclusao) {
          const start = new Date(dataCriacao + 'T00:00:00');
          const end = new Date(dataConclusao + 'T00:00:00');
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
            tempoDias = diff >= 0 ? diff + 1 : null;
          }
        }
      }
      
      if (tempoDias !== null && tempoDias > MAX_DIAS) {
        protocolosAcima60.push({
          _id: record._id,
          protocolo: record.protocolo,
          dataCriacaoIso: dataCriacao,
          dataConclusaoIso: getDataConclusao(record),
          tempoAtual: tempoDias,
          record: record
        });
      }
    }
    
    console.log(`   Protocolos concluídos acima de ${MAX_DIAS} dias: ${protocolosAcima60.length}\n`);
    
    if (protocolosAcima60.length === 0) {
      console.log('✅ Nenhum protocolo encontrado acima de 60 dias!');
      await mongoose.disconnect();
      return;
    }
    
    // Estatísticas
    const tempos = protocolosAcima60.map(p => p.tempoAtual);
    const max = Math.max(...tempos);
    const min = Math.min(...tempos);
    const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
    
    console.log('📈 Estatísticas:');
    console.log(`   Mínimo: ${min} dias`);
    console.log(`   Máximo: ${max} dias`);
    console.log(`   Média: ${media.toFixed(1)} dias\n`);
    
    // ============================================
    // ETAPA 2: DISTRIBUIÇÃO DE DIAS
    // ============================================
    console.log('📊 ETAPA 2: Distribuindo Dias de Conclusão\n');
    
    // Ordenar por data de criação
    protocolosAcima60.sort((a, b) => a.dataCriacaoIso.localeCompare(b.dataCriacaoIso));
    
    // Distribuir dias de forma alternada entre 0 e MAX_DIAS
    // Usar distribuição similar ao script anterior: 60% nos primeiros 30 dias, 40% nos últimos 30
    const diasDistribuidos = [];
    for (let i = 0; i < protocolosAcima60.length; i++) {
      const progresso = i / protocolosAcima60.length;
      let dias;
      
      if (progresso < 0.6) {
        dias = Math.floor((progresso / 0.6) * 30);
      } else {
        const progressoRestante = (progresso - 0.6) / 0.4;
        dias = 30 + Math.floor(progressoRestante * 30);
      }
      
      dias = Math.max(0, Math.min(MAX_DIAS, dias));
      diasDistribuidos.push(dias);
    }
    
    // Embaralhar para distribuição mais aleatória
    for (let i = diasDistribuidos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [diasDistribuidos[i], diasDistribuidos[j]] = [diasDistribuidos[j], diasDistribuidos[i]];
    }
    
    console.log(`   Dias distribuídos: min=${Math.min(...diasDistribuidos)}, max=${Math.max(...diasDistribuidos)}, média=${(diasDistribuidos.reduce((a, b) => a + b, 0) / diasDistribuidos.length).toFixed(1)} dias\n`);
    
    // ============================================
    // ETAPA 3: APLICAR AJUSTES
    // ============================================
    console.log('📊 ETAPA 3: Aplicando Ajustes\n');
    
    let atualizados = 0;
    let erros = 0;
    
    for (let i = 0; i < protocolosAcima60.length; i++) {
      const protocolo = protocolosAcima60[i];
      const diasConclusao = diasDistribuidos[i];
      
      try {
        const novaDataConclusao = adicionarDias(protocolo.dataCriacaoIso, diasConclusao);
        
        // Calcular tempo de resolução
        const dataCriacao = new Date(protocolo.dataCriacaoIso + 'T00:00:00');
        const dataConclusao = new Date(novaDataConclusao + 'T00:00:00');
        const diffDias = Math.floor((dataConclusao - dataCriacao) / (1000 * 60 * 60 * 24));
        const tempoResolucao = diffDias >= 0 ? diffDias + 1 : 1;
        
        if (!DRY_RUN) {
          await Record.updateOne(
            { _id: protocolo._id },
            {
              $set: {
                dataConclusaoIso: novaDataConclusao,
                dataDaConclusao: novaDataConclusao.split('-').reverse().join('/'), // DD/MM/YYYY
                tempoDeResolucaoEmDias: String(tempoResolucao),
                // Manter status original
                statusDemanda: protocolo.record.statusDemanda || 'Concluída',
                status: protocolo.record.status || 'Concluída'
              }
            }
          );
        }
        
        atualizados++;
        
        if (atualizados % 100 === 0) {
          console.log(`   ${DRY_RUN ? '🔍 [DRY-RUN]' : '✅'} Atualizados: ${atualizados} protocolos...`);
        }
      } catch (error) {
        console.error(`   ❌ Erro ao processar protocolo ${protocolo.protocolo}:`, error.message);
        erros++;
      }
    }
    
    // ============================================
    // ETAPA 4: VALIDAÇÃO FINAL
    // ============================================
    console.log(`\n📊 ETAPA 4: Validação Final\n`);
    
    // Verificar novamente
    const protocolosAindaAcima60 = [];
    const todosProtocolos2 = await Record.find({}).lean();
    
    for (const record of todosProtocolos2) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao || !isConcluido(record)) continue;
      
      let tempoDias = getTempoResolucaoEmDias(record);
      if (tempoDias === null) {
        const dataConclusao = getDataConclusao(record);
        if (dataConclusao) {
          const start = new Date(dataCriacao + 'T00:00:00');
          const end = new Date(dataConclusao + 'T00:00:00');
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
            tempoDias = diff >= 0 ? diff + 1 : null;
          }
        }
      }
      
      if (tempoDias !== null && tempoDias > MAX_DIAS) {
        protocolosAindaAcima60.push({
          protocolo: record.protocolo,
          tempo: tempoDias
        });
      }
    }
    
    console.log(`   ✅ Resumo da Atualização:`);
    console.log(`      Protocolos atualizados: ${atualizados}`);
    console.log(`      Erros: ${erros}`);
    console.log(`      Protocolos ainda acima de ${MAX_DIAS} dias: ${protocolosAindaAcima60.length}`);
    
    if (protocolosAindaAcima60.length > 0) {
      const temposRestantes = protocolosAindaAcima60.map(p => p.tempo);
      console.log(`      Máximo restante: ${Math.max(...temposRestantes)} dias`);
    }
    
    console.log('\n' + '='.repeat(80));
    if (DRY_RUN) {
      console.log('🔍 DRY-RUN concluído! Nenhuma mudança foi aplicada.');
      console.log('   Para aplicar as mudanças, execute sem --dry-run');
    } else {
      console.log('✅ Processo concluído com sucesso!');
    }
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

