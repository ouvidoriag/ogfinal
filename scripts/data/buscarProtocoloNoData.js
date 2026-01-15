/**
 * Script para Buscar Protocolo no Campo Data (JSON Completo)
 * 
 * Busca no campo data que contém o JSON completo da planilha
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function buscarProtocoloNoData() {
  console.log('🔍 Buscando protocolo no campo data (JSON completo)...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    const tipoBusca = 'NA  - Demanda encerrada (arquivamento) - Urbanismo';
    
    console.log(`📋 Buscando: "${tipoBusca}"\n`);
    
    // Buscar no campo data usando $where (mais lento, mas busca em todo o JSON)
    // Ou buscar em campos específicos do data
    const registros = await Record.find({
      $or: [
        { 'data.Tipo': tipoBusca },
        { 'data.tipo': tipoBusca },
        { 'data.Tipo de Manifestação': tipoBusca },
        { 'data.tipoDeManifestacao': tipoBusca },
        { 'data.Tema': tipoBusca },
        { 'data.tema': tipoBusca },
        { 'data.Assunto': tipoBusca },
        { 'data.assunto': tipoBusca }
      ]
    })
    .select('protocolo tipoDeManifestacao tema assunto data dataCriacaoIso statusDemanda orgaos')
    .limit(50)
    .lean();
    
    if (registros.length === 0) {
      console.log('⚠️  Nenhum registro encontrado com busca exata.\n');
      console.log('🔍 Buscando por partes do texto...\n');
      
      // Buscar usando regex em campos do data
      const registrosRegex = await Record.find({
        $or: [
          { 'data.Tipo': { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { 'data.tipo': { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { 'data.Tipo de Manifestação': { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { 'data.tipoDeManifestacao': { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { 'data.Tema': { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { 'data.tema': { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { 'data.Assunto': { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } },
          { 'data.assunto': { $regex: 'NA.*Demanda encerrada.*arquivamento.*Urbanismo', $options: 'i' } }
        ]
      })
      .select('protocolo tipoDeManifestacao tema assunto data dataCriacaoIso statusDemanda orgaos')
      .limit(50)
      .lean();
      
      if (registrosRegex.length === 0) {
        console.log('❌ Nenhum registro encontrado mesmo com regex.\n');
        console.log('🔍 Buscando qualquer campo que contenha o texto completo...\n');
        
        // Busca mais ampla - qualquer campo que contenha partes do texto
        const registrosAmplo = await Record.find({
          $or: [
            { tipoDeManifestacao: { $regex: 'NA.*Urbanismo', $options: 'i' } },
            { tema: { $regex: 'NA.*Urbanismo', $options: 'i' } },
            { assunto: { $regex: 'NA.*Urbanismo', $options: 'i' } },
            { orgaos: { $regex: 'Urbanismo', $options: 'i' } }
          ]
        })
        .select('protocolo tipoDeManifestacao tema assunto data dataCriacaoIso statusDemanda orgaos')
        .limit(20)
        .lean();
        
        if (registrosAmplo.length > 0) {
          console.log(`📋 Encontrados ${registrosAmplo.length} registros relacionados:\n`);
          registrosAmplo.forEach((r, idx) => {
            console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || '(sem protocolo)'}`);
            console.log(`      Tipo: ${r.tipoDeManifestacao || 'N/A'}`);
            console.log(`      Tema: ${r.tema || 'N/A'}`);
            console.log(`      Assunto: ${r.assunto || 'N/A'}`);
            console.log(`      Órgãos: ${r.orgaos || 'N/A'}`);
            if (r.data) {
              const tipoData = r.data.Tipo || r.data.tipo || r.data['Tipo de Manifestação'] || r.data.tipoDeManifestacao;
              if (tipoData) {
                console.log(`      Tipo (data): ${tipoData}`);
              }
            }
            console.log('');
          });
        } else {
          console.log('❌ Nenhum registro encontrado.\n');
        }
        
        await mongoose.disconnect();
        return;
      }
      
      console.log(`✅ Encontrados ${registrosRegex.length} registro(s) com regex:\n`);
      registros = registrosRegex;
    }
    
    console.log(`✅ Encontrados ${registros.length} registro(s):\n`);
    
    registros.forEach((r, idx) => {
      console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || '(sem protocolo)'}`);
      console.log(`      Tipo: ${r.tipoDeManifestacao || 'N/A'}`);
      console.log(`      Tema: ${r.tema || 'N/A'}`);
      console.log(`      Assunto: ${r.assunto || 'N/A'}`);
      console.log(`      Data: ${r.dataCriacaoIso || 'N/A'}`);
      console.log(`      Status: ${r.statusDemanda || 'N/A'}`);
      console.log(`      Órgãos: ${r.orgaos || 'N/A'}`);
      
      if (r.data) {
        console.log(`      Campos no data:`);
        if (r.data.Tipo) console.log(`         Tipo: ${r.data.Tipo}`);
        if (r.data.tipo) console.log(`         tipo: ${r.data.tipo}`);
        if (r.data['Tipo de Manifestação']) console.log(`         Tipo de Manifestação: ${r.data['Tipo de Manifestação']}`);
        if (r.data.Tema) console.log(`         Tema: ${r.data.Tema}`);
        if (r.data.tema) console.log(`         tema: ${r.data.tema}`);
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

buscarProtocoloNoData();

