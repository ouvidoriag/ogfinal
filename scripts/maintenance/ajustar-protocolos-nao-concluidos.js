/**
 * Script de Ajuste: Protocolos NÃO Concluídos acima de 60 dias
 * 
 * Ajusta protocolos NÃO concluídos que têm campo tempoDeResolucaoEmDias > 60
 * Limpa o campo ou ajusta para refletir o tempo desde a criação até hoje (limitado a 60)
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, isConcluido, getTempoResolucaoEmDias } from '../../src/utils/formatting/dateUtils.js';

const MAX_DIAS = 60;
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

async function main() {
  console.log('🚀 CÉREBRO X-3: Ajuste de Protocolos NÃO Concluídos acima de 60 dias\n');
  if (DRY_RUN) {
    console.log('⚠️  MODO DRY-RUN ATIVADO: Nenhuma mudança será aplicada no banco de dados\n');
  }
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    // ============================================
    // ETAPA 1: BUSCAR PROTOCOLOS NÃO CONCLUÍDOS ACIMA DE 60 DIAS
    // ============================================
    console.log('📊 ETAPA 1: Buscando Protocolos NÃO Concluídos acima de 60 dias\n');
    
    const todosProtocolos = await Record.find({}).lean();
    console.log(`   Total de protocolos no banco: ${todosProtocolos.length}`);
    
    // Processar e identificar protocolos não concluídos acima de 60 dias
    const protocolosAcima60 = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    for (const record of todosProtocolos) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;
      
      // Só ajustar protocolos NÃO concluídos
      if (isConcluido(record)) continue;
      
      // Verificar campo tempoDeResolucaoEmDias
      let tempoCampo = null;
      if (record.tempoDeResolucaoEmDias) {
        const parsed = parseFloat(record.tempoDeResolucaoEmDias);
        if (!isNaN(parsed)) {
          tempoCampo = parsed;
        }
      }
      
      // Calcular tempo desde criação até hoje
      const start = new Date(dataCriacao + 'T00:00:00');
      const diffDias = Math.floor((hoje - start) / (1000 * 60 * 60 * 24));
      const tempoDesdeCriacao = diffDias >= 0 ? diffDias + 1 : 0;
      
      // Se o campo tem valor > 60 OU o tempo desde criação > 60, precisa ajustar
      if (tempoCampo !== null && tempoCampo > MAX_DIAS) {
        protocolosAcima60.push({
          _id: record._id,
          protocolo: record.protocolo,
          dataCriacaoIso: dataCriacao,
          tempoCampo: tempoCampo,
          tempoDesdeCriacao: tempoDesdeCriacao,
          record: record
        });
      } else if (tempoDesdeCriacao > MAX_DIAS && tempoCampo !== null && tempoCampo > MAX_DIAS) {
        protocolosAcima60.push({
          _id: record._id,
          protocolo: record.protocolo,
          dataCriacaoIso: dataCriacao,
          tempoCampo: tempoCampo,
          tempoDesdeCriacao: tempoDesdeCriacao,
          record: record
        });
      }
    }
    
    console.log(`   Protocolos não concluídos acima de ${MAX_DIAS} dias: ${protocolosAcima60.length}\n`);
    
    if (protocolosAcima60.length === 0) {
      console.log('✅ Nenhum protocolo encontrado acima de 60 dias!');
      await mongoose.disconnect();
      return;
    }
    
    // Estatísticas
    const tempos = protocolosAcima60.map(p => p.tempoCampo || p.tempoDesdeCriacao);
    const max = Math.max(...tempos);
    const min = Math.min(...tempos);
    const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
    
    console.log('📈 Estatísticas:');
    console.log(`   Mínimo: ${min} dias`);
    console.log(`   Máximo: ${max} dias`);
    console.log(`   Média: ${media.toFixed(1)} dias\n`);
    
    // ============================================
    // ETAPA 2: APLICAR AJUSTES
    // ============================================
    console.log('📊 ETAPA 2: Aplicando Ajustes\n');
    console.log('   Estratégia: Limpar campo tempoDeResolucaoEmDias para protocolos não concluídos\n');
    
    let atualizados = 0;
    let erros = 0;
    
    for (const protocolo of protocolosAcima60) {
      try {
        // Para protocolos não concluídos, vamos limpar o campo tempoDeResolucaoEmDias
        // pois ele só deve ser preenchido quando o protocolo é concluído
        if (!DRY_RUN) {
          await Record.updateOne(
            { _id: protocolo._id },
            {
              $unset: {
                tempoDeResolucaoEmDias: ''
              }
            }
          );
        }
        
        atualizados++;
        
        if (atualizados % 50 === 0) {
          console.log(`   ${DRY_RUN ? '🔍 [DRY-RUN]' : '✅'} Atualizados: ${atualizados} protocolos...`);
        }
      } catch (error) {
        console.error(`   ❌ Erro ao processar protocolo ${protocolo.protocolo}:`, error.message);
        erros++;
      }
    }
    
    // ============================================
    // ETAPA 3: VALIDAÇÃO FINAL
    // ============================================
    console.log(`\n📊 ETAPA 3: Validação Final\n`);
    
    // Verificar novamente
    const protocolosAindaAcima60 = [];
    const todosProtocolos2 = await Record.find({}).lean();
    
    for (const record of todosProtocolos2) {
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao || isConcluido(record)) continue;
      
      if (record.tempoDeResolucaoEmDias) {
        const parsed = parseFloat(record.tempoDeResolucaoEmDias);
        if (!isNaN(parsed) && parsed > MAX_DIAS) {
          protocolosAindaAcima60.push({
            protocolo: record.protocolo,
            tempo: parsed
          });
        }
      }
    }
    
    console.log(`   ✅ Resumo da Atualização:`);
    console.log(`      Protocolos atualizados: ${atualizados}`);
    console.log(`      Erros: ${erros}`);
    console.log(`      Protocolos ainda com campo > ${MAX_DIAS} dias: ${protocolosAindaAcima60.length}`);
    
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

