/**
 * Script para Buscar Protocolos com NA e Arquivamento
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function buscarNAArquivamento() {
  console.log('🔍 Buscando protocolos com NA e arquivamento...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar por "NA" e "arquivamento" juntos
    const registros = await Record.find({
      $or: [
        { tipoDeManifestacao: /NA.*arquivamento/i },
        { tema: /NA.*arquivamento/i },
        { assunto: /NA.*arquivamento/i },
        { 'data.Tipo': /NA.*arquivamento/i },
        { 'data.tipo': /NA.*arquivamento/i },
        { 'data.Tipo de Manifestação': /NA.*arquivamento/i }
      ]
    })
    .select('protocolo tipoDeManifestacao tema assunto data dataCriacaoIso statusDemanda orgaos')
    .lean();
    
    if (registros.length === 0) {
      console.log('❌ Nenhum registro encontrado com NA e arquivamento.\n');
      
      // Buscar apenas por "NA" e verificar o campo data completo
      console.log('🔍 Buscando registros com "NA" no tipo...\n');
      
      const registrosNA = await Record.find({
        $or: [
          { tipoDeManifestacao: /^NA/i },
          { tema: /^NA/i },
          { assunto: /^NA/i }
        ]
      })
      .select('protocolo tipoDeManifestacao tema assunto data dataCriacaoIso statusDemanda orgaos')
      .limit(50)
      .lean();
      
      if (registrosNA.length > 0) {
        console.log(`📋 Encontrados ${registrosNA.length} registros com "NA":\n`);
        
        // Filtrar os que têm "arquivamento" ou "encerrada" no data
        const comArquivamento = registrosNA.filter(r => {
          const dataStr = JSON.stringify(r.data || {}).toLowerCase();
          return dataStr.includes('arquivamento') || dataStr.includes('encerrada');
        });
        
        if (comArquivamento.length > 0) {
          console.log(`✅ ${comArquivamento.length} registro(s) com arquivamento/encerrada:\n`);
          comArquivamento.forEach((r, idx) => {
            console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || '(sem protocolo)'}`);
            console.log(`      Tipo: ${r.tipoDeManifestacao || 'N/A'}`);
            console.log(`      Tema: ${r.tema || 'N/A'}`);
            console.log(`      Assunto: ${r.assunto || 'N/A'}`);
            if (r.data) {
              const tipoData = r.data.Tipo || r.data.tipo || r.data['Tipo de Manifestação'];
              if (tipoData) {
                console.log(`      Tipo (data): ${tipoData}`);
              }
            }
            console.log('');
          });
          
          // Mostrar protocolos
          console.log('='.repeat(60));
          console.log('📋 PROTOCOLOS:');
          console.log('='.repeat(60));
          console.log(comArquivamento.map(r => r.protocolo).filter(p => p).join(', '));
          console.log('='.repeat(60) + '\n');
        } else {
          console.log('⚠️  Nenhum registro com arquivamento encontrado.\n');
          console.log('📋 Mostrando primeiros registros com "NA":\n');
          registrosNA.slice(0, 10).forEach((r, idx) => {
            console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || '(sem protocolo)'}`);
            console.log(`      Tipo: ${r.tipoDeManifestacao || 'N/A'}`);
            if (r.data && r.data.Tipo) {
              console.log(`      Tipo (data): ${r.data.Tipo}`);
            }
            console.log('');
          });
        }
      }
      
      await mongoose.disconnect();
      return;
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
        const tipoData = r.data.Tipo || r.data.tipo || r.data['Tipo de Manifestação'];
        if (tipoData) {
          console.log(`      Tipo (data): ${tipoData}`);
        }
      }
      console.log('');
    });
    
    // Mostrar protocolos
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

buscarNAArquivamento();

