/**
 * Script para Remover Duplicatas de Protocolos
 * Remove registros duplicados mantendo apenas o mais recente
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function removerDuplicatas() {
  console.log('🔍 Procurando duplicatas de protocolos...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Encontrar todos os protocolos duplicados
    const duplicatas = await Record.aggregate([
      {
        $match: { 
          protocolo: { $ne: null, $ne: '' } 
        }
      },
      {
        $group: {
          _id: '$protocolo',
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          createdAt: { $push: '$createdAt' },
          updatedAt: { $push: '$updatedAt' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    if (duplicatas.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada!\n');
      await mongoose.disconnect();
      return;
    }
    
    console.log(`🚨 Encontradas ${duplicatas.length} duplicatas de protocolos\n`);
    console.log('📊 Exemplos de duplicatas:');
    duplicatas.slice(0, 10).forEach((dup, idx) => {
      console.log(`   ${idx + 1}. Protocolo: ${dup._id}`);
      console.log(`      Quantidade: ${dup.count} registros`);
      console.log(`      IDs: ${dup.ids.join(', ')}\n`);
    });
    
    if (duplicatas.length > 10) {
      console.log(`   ... e mais ${duplicatas.length - 10} duplicatas\n`);
    }
    
    // Calcular total de registros a remover
    const totalParaRemover = duplicatas.reduce((sum, dup) => sum + (dup.count - 1), 0);
    console.log(`\n📊 Total de registros duplicados a remover: ${totalParaRemover}\n`);
    
    // Confirmar ação
    console.log('⚠️  ATENÇÃO: Este script irá remover registros duplicados!');
    console.log('   Para cada protocolo duplicado, será mantido o registro mais recente.');
    console.log('   Os registros mais antigos serão removidos.\n');
    
    // Processar duplicatas
    let removidos = 0;
    let mantidos = 0;
    
    console.log('🔄 Removendo duplicatas...\n');
    
    for (const dup of duplicatas) {
      const protocolo = dup._id;
      const ids = dup.ids;
      const createdAt = dup.createdAt;
      
      // Buscar todos os registros com este protocolo
      const registros = await Record.find({ _id: { $in: ids } })
        .sort({ createdAt: -1, updatedAt: -1 })
        .lean();
      
      if (registros.length <= 1) continue;
      
      // Manter o primeiro (mais recente) e remover os demais
      const manter = registros[0];
      const remover = registros.slice(1);
      
      // Remover os duplicados
      const idsParaRemover = remover.map(r => r._id);
      const resultado = await Record.deleteMany({ _id: { $in: idsParaRemover } });
      
      removidos += resultado.deletedCount;
      mantidos += 1;
      
      if (mantidos % 50 === 0) {
        console.log(`   Processados: ${mantidos}/${duplicatas.length} protocolos, ${removidos} registros removidos`);
      }
    }
    
    console.log('\n✅ Remoção de duplicatas concluída!');
    console.log(`📊 Estatísticas:`);
    console.log(`   Protocolos processados: ${duplicatas.length}`);
    console.log(`   Registros mantidos: ${mantidos}`);
    console.log(`   Registros removidos: ${removidos}`);
    
    // Verificar se ainda há duplicatas
    const duplicatasRestantes = await Record.aggregate([
      {
        $match: { 
          protocolo: { $ne: null, $ne: '' } 
        }
      },
      {
        $group: {
          _id: '$protocolo',
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    if (duplicatasRestantes.length > 0) {
      console.log(`\n⚠️  Ainda existem ${duplicatasRestantes.length} protocolos duplicados!`);
      console.log('   Execute o script novamente se necessário.\n');
    } else {
      console.log('\n✅ Nenhuma duplicata restante!\n');
    }
    
    // Contar registros finais
    const totalFinal = await Record.countDocuments();
    console.log(`📊 Total de registros no banco: ${totalFinal}\n`);
    
    await mongoose.disconnect();
    console.log('✅ Script finalizado!\n');
    
  } catch (error) {
    console.error('❌ Erro ao remover duplicatas:', error);
    process.exit(1);
  }
}

removerDuplicatas();

