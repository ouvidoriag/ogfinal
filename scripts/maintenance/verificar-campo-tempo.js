/**
 * Script de Verificação: Campo tempoDeResolucaoEmDias
 * 
 * Verifica protocolos de jan-mai 2025 com campo tempoDeResolucaoEmDias > 60
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao } from '../../src/utils/formatting/dateUtils.js';

const MESES_ALVO = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
const MAX_DIAS = 60;

async function main() {
  console.log('🔍 Verificando Campo tempoDeResolucaoEmDias - Jan-Mai 2025\n');
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
    
    // Processar e verificar campo tempoDeResolucaoEmDias
    const protocolosComTempo = todosProtocolos
      .map(record => {
        const dataCriacao = getDataCriacao(record);
        
        if (!dataCriacao) return null;
        
        const mes = dataCriacao.slice(0, 7);
        if (!MESES_ALVO.includes(mes)) return null;
        
        // Verificar campo tempoDeResolucaoEmDias
        let tempoCampo = null;
        if (record.tempoDeResolucaoEmDias) {
          const parsed = parseFloat(record.tempoDeResolucaoEmDias);
          if (!isNaN(parsed)) {
            tempoCampo = parsed;
          }
        }
        
        return {
          _id: record._id,
          protocolo: record.protocolo,
          dataCriacaoIso: dataCriacao,
          dataConclusaoIso: record.dataConclusaoIso,
          tempoDeResolucaoEmDias: record.tempoDeResolucaoEmDias,
          tempoCampo: tempoCampo,
          record: record
        };
      })
      .filter(p => p !== null);
    
    console.log(`Protocolos processados: ${protocolosComTempo.length}\n`);
    
    // Protocolos com campo > 60
    const acimaDe60 = protocolosComTempo.filter(p => p.tempoCampo !== null && p.tempoCampo > MAX_DIAS);
    console.log(`⚠️  Protocolos com campo tempoDeResolucaoEmDias > ${MAX_DIAS}: ${acimaDe60.length}\n`);
    
    if (acimaDe60.length > 0) {
      console.log('📋 Protocolos acima de 60 dias (ordenados por tempo):');
      acimaDe60
        .sort((a, b) => (b.tempoCampo || 0) - (a.tempoCampo || 0))
        .slice(0, 30)
        .forEach((p, i) => {
          console.log(`   ${i + 1}. Protocolo: ${p.protocolo || 'N/A'}`);
          console.log(`      Criação: ${p.dataCriacaoIso}`);
          console.log(`      Conclusão: ${p.dataConclusaoIso || 'N/A'}`);
          console.log(`      Campo tempoDeResolucaoEmDias: ${p.tempoDeResolucaoEmDias} (${p.tempoCampo} dias)\n`);
        });
      
      // Estatísticas
      const tempos = acimaDe60.map(p => p.tempoCampo).filter(t => t !== null);
      const max = Math.max(...tempos);
      const min = Math.min(...tempos);
      const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
      
      console.log('\n📊 Estatísticas dos protocolos acima de 60 dias:');
      console.log(`   Mínimo: ${min} dias`);
      console.log(`   Máximo: ${max} dias`);
      console.log(`   Média: ${media.toFixed(1)} dias\n`);
    }
    
    // Estatísticas gerais do campo
    const temposGerais = protocolosComTempo
      .map(p => p.tempoCampo)
      .filter(t => t !== null);
    
    if (temposGerais.length > 0) {
      const maxGeral = Math.max(...temposGerais);
      const minGeral = Math.min(...temposGerais);
      const mediaGeral = temposGerais.reduce((a, b) => a + b, 0) / temposGerais.length;
      
      console.log('📊 Estatísticas Gerais do Campo tempoDeResolucaoEmDias:');
      console.log(`   Mínimo: ${minGeral} dias`);
      console.log(`   Máximo: ${maxGeral} dias`);
      console.log(`   Média: ${mediaGeral.toFixed(1)} dias`);
      console.log(`   Total com campo preenchido: ${temposGerais.length}\n`);
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

