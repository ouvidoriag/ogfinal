/**
 * Script para Procurar Duplicatas Restantes
 * 
 * Encontra protocolos duplicados no banco de dados
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function procurarDuplicatas() {
  console.log('🔍 Procurando duplicatas restantes...\n');
  
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
      
      // Verificar total de registros
      const total = await Record.countDocuments();
      const totalComProtocolo = await Record.countDocuments({ protocolo: { $ne: null, $ne: '' } });
      const totalSemProtocolo = await Record.countDocuments({ 
        $or: [
          { protocolo: null },
          { protocolo: '' },
          { protocolo: { $exists: false } }
        ]
      });
      
      console.log('📊 Estatísticas:');
      console.log(`   Total de registros: ${total}`);
      console.log(`   Com protocolo: ${totalComProtocolo}`);
      console.log(`   Sem protocolo: ${totalSemProtocolo}\n`);
      
      await mongoose.disconnect();
      return;
    }
    
    console.log(`🚨 ENCONTRADAS ${duplicatas.length} DUPLICATAS:\n`);
    
    // Mostrar detalhes de cada duplicata
    for (const dup of duplicatas) {
      console.log(`📋 Protocolo: ${dup._id}`);
      console.log(`   Quantidade: ${dup.count} registros`);
      console.log(`   IDs: ${dup.ids.join(', ')}`);
      
      // Buscar registros completos para mostrar mais detalhes
      const registros = await Record.find({ _id: { $in: dup.ids } })
        .sort({ createdAt: -1, updatedAt: -1 })
        .lean();
      
      console.log(`   Detalhes dos registros:`);
      registros.forEach((r, idx) => {
        console.log(`      ${idx + 1}. ID: ${r._id}`);
        console.log(`         Criado em: ${r.createdAt || 'N/A'}`);
        console.log(`         Atualizado em: ${r.updatedAt || 'N/A'}`);
        console.log(`         Data Criação: ${r.dataCriacaoIso || r.dataDaCriacao || 'N/A'}`);
        console.log(`         Status: ${r.statusDemanda || r.status || 'N/A'}`);
        console.log('');
      });
    }
    
    // Calcular total a remover
    const totalParaRemover = duplicatas.reduce((sum, dup) => sum + (dup.count - 1), 0);
    console.log(`\n📊 Total de registros duplicados a remover: ${totalParaRemover}\n`);
    
    // Verificar total de registros
    const totalAntes = await Record.countDocuments();
    console.log(`📊 Total de registros antes: ${totalAntes}`);
    console.log(`📊 Total esperado após remoção: ${totalAntes - totalParaRemover}\n`);
    
    await mongoose.disconnect();
    console.log('✅ Análise concluída!\n');
    
  } catch (error) {
    console.error('❌ Erro ao procurar duplicatas:', error);
    process.exit(1);
  }
}

procurarDuplicatas();

