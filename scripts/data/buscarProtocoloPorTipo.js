/**
 * Script para Buscar Protocolo por Tipo
 * 
 * Busca registros com tipo específico e retorna os protocolos
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function buscarProtocoloPorTipo() {
  console.log('🔍 Buscando protocolo por tipo...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar por tipo exato
    const tipoBusca = 'NA  - Demanda encerrada (arquivamento) - Urbanismo';
    
    console.log(`📋 Buscando: "${tipoBusca}"\n`);
    
    // Função para escapar regex
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Tentar diferentes campos onde o tipo pode estar
    const registros = await Record.find({
      $or: [
        { tipoDeManifestacao: tipoBusca },
        { tipoDeManifestacao: { $regex: escapeRegex(tipoBusca), $options: 'i' } },
        { tema: tipoBusca },
        { tema: { $regex: escapeRegex(tipoBusca), $options: 'i' } },
        { assunto: tipoBusca },
        { assunto: { $regex: escapeRegex(tipoBusca), $options: 'i' } },
        { 'data.tipo': tipoBusca },
        { 'data.Tipo': tipoBusca },
        { 'data.tipoDeManifestacao': tipoBusca },
        { 'data.Tipo de Manifestação': tipoBusca }
      ]
    })
    .select('protocolo tipoDeManifestacao tema assunto data dataCriacaoIso statusDemanda')
    .lean();
    
    if (registros.length === 0) {
      console.log('⚠️  Nenhum registro encontrado com o tipo exato.\n');
      console.log('🔍 Buscando variações...\n');
      
      // Buscar por partes do tipo
      const partes = tipoBusca.split(' - ');
      const buscaVariacoes = await Record.find({
        $or: [
          { tipoDeManifestacao: { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { tipoDeManifestacao: { $regex: 'NA.*Urbanismo', $options: 'i' } },
          { tipoDeManifestacao: { $regex: 'Demanda encerrada.*arquivamento', $options: 'i' } },
          { tema: { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { tema: { $regex: 'NA.*Urbanismo', $options: 'i' } },
          { assunto: { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { assunto: { $regex: 'NA.*Urbanismo', $options: 'i' } }
        ]
      })
      .select('protocolo tipoDeManifestacao tema assunto data dataCriacaoIso statusDemanda')
      .limit(50)
      .lean();
      
      if (buscaVariacoes.length === 0) {
        console.log('❌ Nenhum registro encontrado mesmo com variações.\n');
        await mongoose.disconnect();
        return;
      }
      
      console.log(`✅ Encontrados ${buscaVariacoes.length} registros com variações:\n`);
      
      buscaVariacoes.forEach((r, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || '(sem protocolo)'}`);
        console.log(`      Tipo: ${r.tipoDeManifestacao || r.tema || r.assunto || 'N/A'}`);
        console.log(`      Data: ${r.dataCriacaoIso || 'N/A'}`);
        console.log(`      Status: ${r.statusDemanda || 'N/A'}`);
        if (r.data && (r.data.tipo || r.data.Tipo)) {
          console.log(`      Tipo (data): ${r.data.tipo || r.data.Tipo}`);
        }
        console.log('');
      });
      
      await mongoose.disconnect();
      return;
    }
    
    console.log(`✅ Encontrados ${registros.length} registro(s):\n`);
    
    registros.forEach((r, idx) => {
      console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || '(sem protocolo)'}`);
      console.log(`      Tipo: ${r.tipoDeManifestacao || r.tema || r.assunto || 'N/A'}`);
      console.log(`      Data: ${r.dataCriacaoIso || 'N/A'}`);
      console.log(`      Status: ${r.statusDemanda || 'N/A'}`);
      if (r.data && (r.data.tipo || r.data.Tipo)) {
        console.log(`      Tipo (data): ${r.data.tipo || r.data.Tipo}`);
      }
      console.log('');
    });
    
    // Mostrar apenas os protocolos
    console.log('='.repeat(60));
    console.log('📋 PROTOCOLOS ENCONTRADOS:');
    console.log('='.repeat(60));
    const protocolos = registros
      .map(r => r.protocolo)
      .filter(p => p)
      .join(', ');
    
    if (protocolos) {
      console.log(protocolos);
    } else {
      console.log('(Nenhum protocolo encontrado)');
    }
    console.log('='.repeat(60) + '\n');
    
    await mongoose.disconnect();
    console.log('✅ Busca concluída!\n');
    
  } catch (error) {
    console.error('❌ Erro ao buscar:', error);
    process.exit(1);
  }
}

buscarProtocoloPorTipo();

