/**
 * Script para limpar duplicatas do banco de dados
 * Mantém apenas o registro mais recente de cada protocolo duplicado
 * 
 * Uso: node scripts/maintenance/limparDuplicatas.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function main() {
  console.log('🧹 Limpando duplicatas do banco de dados...\n');
  
  try {
    // Conectar ao MongoDB
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // 1. Encontrar todas as duplicatas
    console.log('🔍 Buscando protocolos duplicados...');
    const duplicatas = await Record.aggregate([
      {
        $match: {
          protocolo: { $ne: null, $exists: true }
        }
      },
      {
        $group: {
          _id: '$protocolo',
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          createdAt: { $push: '$createdAt' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    if (duplicatas.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada!\n');
      return;
    }
    
    console.log(`⚠️  Encontradas ${duplicatas.length} duplicatas\n`);
    
    // 2. Para cada duplicata, manter apenas o mais recente
    let totalRemovidos = 0;
    let totalProcessados = 0;
    
    console.log('🗑️  Removendo duplicatas (mantendo apenas o mais recente)...\n');
    
    for (const dup of duplicatas) {
      const protocolo = dup._id;
      const ids = dup.ids;
      const createdAts = dup.createdAt;
      
      // Encontrar o índice do registro mais recente
      let indiceMaisRecente = 0;
      let dataMaisRecente = createdAts[0] || new Date(0);
      
      for (let i = 1; i < createdAts.length; i++) {
        const data = createdAts[i] || new Date(0);
        if (data > dataMaisRecente) {
          dataMaisRecente = data;
          indiceMaisRecente = i;
        }
      }
      
      // Remover todos exceto o mais recente
      const idsParaRemover = ids.filter((_, index) => index !== indiceMaisRecente);
      
      if (idsParaRemover.length > 0) {
        const resultado = await Record.deleteMany({
          _id: { $in: idsParaRemover }
        });
        
        totalRemovidos += resultado.deletedCount;
        totalProcessados++;
        
        if (totalProcessados % 50 === 0) {
          console.log(`   Processados: ${totalProcessados}/${duplicatas.length} - ${totalRemovidos} removidos`);
        }
      }
    }
    
    console.log(`\n✅ Limpeza concluída!`);
    console.log(`📊 Estatísticas:`);
    console.log(`   - Protocolos duplicados processados: ${totalProcessados}`);
    console.log(`   - Registros removidos: ${totalRemovidos}`);
    
    // 3. Verificar resultado final
    const totalFinal = await Record.countDocuments();
    const duplicatasRestantes = await Record.aggregate([
      {
        $match: {
          protocolo: { $ne: null, $exists: true }
        }
      },
      {
        $group: {
          _id: '$protocolo',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    console.log(`   - Total de registros após limpeza: ${totalFinal}`);
    console.log(`   - Duplicatas restantes: ${duplicatasRestantes.length}`);
    
    if (duplicatasRestantes.length > 0) {
      console.log(`\n⚠️  Ainda existem ${duplicatasRestantes.length} duplicatas. Execute o script novamente.`);
    } else {
      console.log(`\n✅ Nenhuma duplicata restante!`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

main()
  .then(() => {
    console.log('\n🎉 Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });



