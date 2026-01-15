/**
 * Script para Buscar Protocolo por Tipo (Busca Ampla)
 * 
 * Busca registros com tipo específico em todos os campos possíveis
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function buscarProtocoloPorTipoAmplo() {
  console.log('🔍 Buscando protocolo por tipo (busca ampla)...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar por partes do tipo
    const termos = ['NA', 'Demanda encerrada', 'arquivamento', 'Urbanismo'];
    
    console.log(`📋 Buscando termos: ${termos.join(', ')}\n`);
    
    // Buscar em todos os campos possíveis
    const registros = await Record.find({
      $or: [
        // Busca exata
        { tipoDeManifestacao: /NA.*Demanda encerrada.*arquivamento.*Urbanismo/i },
        { tema: /NA.*Demanda encerrada.*arquivamento.*Urbanismo/i },
        { assunto: /NA.*Demanda encerrada.*arquivamento.*Urbanismo/i },
        // Busca por partes
        { tipoDeManifestacao: /NA.*Urbanismo/i },
        { tema: /NA.*Urbanismo/i },
        { assunto: /NA.*Urbanismo/i },
        { tipoDeManifestacao: /Demanda encerrada.*arquivamento/i },
        { tema: /Demanda encerrada.*arquivamento/i },
        { assunto: /Demanda encerrada.*arquivamento/i },
        // Busca individual
        { tipoDeManifestacao: /^NA/i },
        { tema: /^NA/i },
        { assunto: /^NA/i }
      ]
    })
    .select('protocolo tipoDeManifestacao tema assunto data dataCriacaoIso statusDemanda orgaos')
    .limit(100)
    .lean();
    
    if (registros.length === 0) {
      console.log('❌ Nenhum registro encontrado.\n');
      
      // Buscar todos os valores únicos de tipoDeManifestacao que contêm "NA" ou "Urbanismo"
      console.log('🔍 Buscando valores únicos de tipoDeManifestacao...\n');
      
      const tiposUnicos = await Record.distinct('tipoDeManifestacao', {
        $or: [
          { tipoDeManifestacao: /NA/i },
          { tipoDeManifestacao: /Urbanismo/i },
          { tipoDeManifestacao: /arquivamento/i }
        ]
      });
      
      if (tiposUnicos.length > 0) {
        console.log(`📋 Encontrados ${tiposUnicos.length} tipos únicos relacionados:\n`);
        tiposUnicos.slice(0, 20).forEach((tipo, idx) => {
          console.log(`   ${idx + 1}. ${tipo || '(vazio)'}`);
        });
        if (tiposUnicos.length > 20) {
          console.log(`   ... e mais ${tiposUnicos.length - 20} tipos\n`);
        }
      }
      
      await mongoose.disconnect();
      return;
    }
    
    console.log(`✅ Encontrados ${registros.length} registro(s):\n`);
    
    // Filtrar os que mais se parecem com o tipo buscado
    const registrosFiltrados = registros.filter(r => {
      const tipo = (r.tipoDeManifestacao || r.tema || r.assunto || '').toLowerCase();
      return tipo.includes('na') && tipo.includes('urbanismo') && 
             (tipo.includes('demanda') || tipo.includes('encerrada') || tipo.includes('arquivamento'));
    });
    
    if (registrosFiltrados.length > 0) {
      console.log(`📋 ${registrosFiltrados.length} registro(s) mais relevantes:\n`);
      
      registrosFiltrados.forEach((r, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || '(sem protocolo)'}`);
        console.log(`      Tipo: ${r.tipoDeManifestacao || r.tema || r.assunto || 'N/A'}`);
        console.log(`      Data: ${r.dataCriacaoIso || 'N/A'}`);
        console.log(`      Status: ${r.statusDemanda || 'N/A'}`);
        console.log(`      Órgãos: ${r.orgaos || 'N/A'}`);
        if (r.data) {
          const tipoData = r.data.tipo || r.data.Tipo || r.data.tipoDeManifestacao || r.data['Tipo de Manifestação'];
          if (tipoData) {
            console.log(`      Tipo (data): ${tipoData}`);
          }
        }
        console.log('');
      });
      
      // Mostrar apenas os protocolos
      console.log('='.repeat(60));
      console.log('📋 PROTOCOLOS ENCONTRADOS:');
      console.log('='.repeat(60));
      const protocolos = registrosFiltrados
        .map(r => r.protocolo)
        .filter(p => p)
        .join(', ');
      
      if (protocolos) {
        console.log(protocolos);
      } else {
        console.log('(Nenhum protocolo encontrado)');
      }
      console.log('='.repeat(60) + '\n');
    } else {
      console.log('⚠️  Nenhum registro encontrado que corresponda exatamente ao tipo buscado.\n');
      console.log('📋 Mostrando todos os registros encontrados:\n');
      
      registros.slice(0, 20).forEach((r, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || '(sem protocolo)'}`);
        console.log(`      Tipo: ${r.tipoDeManifestacao || r.tema || r.assunto || 'N/A'}`);
        console.log(`      Data: ${r.dataCriacaoIso || 'N/A'}`);
        console.log('');
      });
      
      if (registros.length > 20) {
        console.log(`   ... e mais ${registros.length - 20} registros\n`);
      }
    }
    
    await mongoose.disconnect();
    console.log('✅ Busca concluída!\n');
    
  } catch (error) {
    console.error('❌ Erro ao buscar:', error);
    process.exit(1);
  }
}

buscarProtocoloPorTipoAmplo();

