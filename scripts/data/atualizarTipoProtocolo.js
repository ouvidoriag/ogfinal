/**
 * Script para Atualizar Tipo de um Protocolo
 * 
 * Atualiza o tipo de manifestação de um protocolo específico
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function atualizarTipoProtocolo() {
  console.log('🔧 Atualizando tipo do protocolo...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    const protocolo = 'C471984049832516925';
    const novoTipo = 'Denúncia';
    
    console.log(`📋 Protocolo: ${protocolo}`);
    console.log(`📝 Novo tipo: ${novoTipo}\n`);
    
    // Buscar o registro atual
    const registro = await Record.findOne({ protocolo: protocolo }).lean();
    
    if (!registro) {
      console.log('❌ Protocolo não encontrado!\n');
      await mongoose.disconnect();
      return;
    }
    
    console.log('📊 Registro atual:');
    console.log(`   Tipo atual: ${registro.tipoDeManifestacao || 'N/A'}`);
    console.log(`   Tema: ${registro.tema || 'N/A'}`);
    console.log(`   Assunto: ${registro.assunto || 'N/A'}`);
    console.log(`   Status: ${registro.statusDemanda || 'N/A'}`);
    console.log(`   Órgãos: ${registro.orgaos || 'N/A'}\n`);
    
    // Atualizar o tipo
    const resultado = await Record.findOneAndUpdate(
      { protocolo: protocolo },
      { 
        $set: { 
          tipoDeManifestacao: novoTipo,
          // Também atualizar no campo data se existir
          'data.Tipo': novoTipo,
          'data.tipo': novoTipo,
          'data.tipoDeManifestacao': novoTipo,
          'data.Tipo de Manifestação': novoTipo
        }
      },
      { new: true }
    );
    
    if (!resultado) {
      console.log('❌ Erro ao atualizar o registro!\n');
      await mongoose.disconnect();
      return;
    }
    
    console.log('✅ Registro atualizado com sucesso!\n');
    console.log('📊 Registro após atualização:');
    console.log(`   Protocolo: ${resultado.protocolo}`);
    console.log(`   Tipo: ${resultado.tipoDeManifestacao || 'N/A'}`);
    console.log(`   Tema: ${resultado.tema || 'N/A'}`);
    console.log(`   Assunto: ${resultado.assunto || 'N/A'}`);
    console.log(`   Status: ${resultado.statusDemanda || 'N/A'}`);
    console.log(`   Órgãos: ${resultado.orgaos || 'N/A'}\n`);
    
    // Verificar se o campo data foi atualizado
    if (resultado.data) {
      console.log('📋 Campos no data atualizados:');
      if (resultado.data.Tipo) console.log(`   Tipo: ${resultado.data.Tipo}`);
      if (resultado.data.tipo) console.log(`   tipo: ${resultado.data.tipo}`);
      if (resultado.data.tipoDeManifestacao) console.log(`   tipoDeManifestacao: ${resultado.data.tipoDeManifestacao}`);
      console.log('');
    }
    
    await mongoose.disconnect();
    console.log('✅ Atualização concluída!\n');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar:', error);
    process.exit(1);
  }
}

atualizarTipoProtocolo();

