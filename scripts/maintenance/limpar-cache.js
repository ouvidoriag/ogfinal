/**
 * Script: Limpar Cache do Sistema
 * 
 * Limpa todo o cache do sistema para forçar atualização dos dados
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import AggregationCache from '../../src/models/AggregationCache.model.js';

async function main() {
  console.log('🧹 Limpando Cache do Sistema\n');
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    // Limpar todo o cache
    const result = await AggregationCache.deleteMany({});
    const count = result.deletedCount || 0;
    
    console.log(`✅ Cache limpo com sucesso!`);
    console.log(`   Entradas removidas: ${count}\n`);
    
    console.log('💡 O cache será reconstruído automaticamente na próxima requisição.');
    console.log('   Os dados agora refletirão os valores atualizados do banco.\n');
    
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


