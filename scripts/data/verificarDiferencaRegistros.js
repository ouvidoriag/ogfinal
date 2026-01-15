/**
 * Script para Verificar Diferença de Registros
 * 
 * Verifica por que há 17.603 registros quando deveria haver 17.601
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function verificarDiferenca() {
  console.log('🔍 Verificando diferença de registros...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Contagens gerais
    const total = await Record.countDocuments();
    const comProtocolo = await Record.countDocuments({ protocolo: { $ne: null, $ne: '' } });
    const semProtocolo = await Record.countDocuments({ 
      $or: [
        { protocolo: null },
        { protocolo: '' },
        { protocolo: { $exists: false } }
      ]
    });
    
    console.log('📊 Contagens Gerais:');
    console.log(`   Total de registros: ${total}`);
    console.log(`   Com protocolo: ${comProtocolo}`);
    console.log(`   Sem protocolo: ${semProtocolo}`);
    console.log(`   Diferença: ${total - (comProtocolo + semProtocolo)}\n`);
    
    // Verificar duplicatas por protocolo (incluindo null/vazio)
    const duplicatasProtocolo = await Record.aggregate([
      {
        $group: {
          _id: '$protocolo',
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    if (duplicatasProtocolo.length > 0) {
      console.log(`🚨 ENCONTRADAS ${duplicatasProtocolo.length} DUPLICATAS (incluindo null/vazio):\n`);
      
      for (const dup of duplicatasProtocolo) {
        const protocoloStr = dup._id === null ? 'null' : (dup._id === '' ? '(vazio)' : dup._id);
        console.log(`   Protocolo: ${protocoloStr}`);
        console.log(`   Quantidade: ${dup.count} registros`);
        console.log(`   IDs: ${dup.ids.slice(0, 5).join(', ')}${dup.ids.length > 5 ? '...' : ''}\n`);
      }
    } else {
      console.log('✅ Nenhuma duplicata por protocolo encontrada\n');
    }
    
    // Verificar duplicatas exatas (mesmo protocolo, mesmo conteúdo)
    console.log('🔍 Verificando duplicatas exatas (mesmo protocolo)...\n');
    
    const duplicatasExatas = await Record.aggregate([
      {
        $match: { 
          protocolo: { $ne: null, $ne: '' } 
        }
      },
      {
        $group: {
          _id: {
            protocolo: '$protocolo',
            dataCriacaoIso: '$dataCriacaoIso',
            statusDemanda: '$statusDemanda'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    if (duplicatasExatas.length > 0) {
      console.log(`🚨 ENCONTRADAS ${duplicatasExatas.length} DUPLICATAS EXATAS:\n`);
      duplicatasExatas.forEach((dup, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${dup._id.protocolo}`);
        console.log(`      Data: ${dup._id.dataCriacaoIso || 'N/A'}`);
        console.log(`      Status: ${dup._id.statusDemanda || 'N/A'}`);
        console.log(`      Quantidade: ${dup.count} registros`);
        console.log(`      IDs: ${dup.ids.join(', ')}\n`);
      });
    } else {
      console.log('✅ Nenhuma duplicata exata encontrada\n');
    }
    
    // Verificar registros mais recentes (últimos 10)
    console.log('📋 Últimos 10 registros inseridos:\n');
    const recentes = await Record.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id protocolo createdAt dataCriacaoIso')
      .lean();
    
    recentes.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ID: ${r._id}`);
      console.log(`      Protocolo: ${r.protocolo || '(vazio/null)'}`);
      console.log(`      Criado em: ${r.createdAt || 'N/A'}`);
      console.log(`      Data Criação: ${r.dataCriacaoIso || 'N/A'}\n`);
    });
    
    // Verificar se há registros com protocolos muito similares (diferença de espaços)
    console.log('🔍 Verificando protocolos similares (possíveis variações)...\n');
    
    const todosProtocolos = await Record.find({ protocolo: { $ne: null, $ne: '' } })
      .select('protocolo')
      .lean();
    
    const protocolosNormalizados = new Map();
    const protocolosComVariacoes = [];
    
    todosProtocolos.forEach(r => {
      const protocolo = String(r.protocolo);
      const normalizado = protocolo.trim().replace(/\s+/g, '');
      
      if (!protocolosNormalizados.has(normalizado)) {
        protocolosNormalizados.set(normalizado, []);
      }
      
      const variacoes = protocolosNormalizados.get(normalizado);
      if (!variacoes.includes(protocolo)) {
        variacoes.push(protocolo);
      }
      
      if (variacoes.length > 1) {
        protocolosComVariacoes.push({
          normalizado,
          variacoes
        });
      }
    });
    
    if (protocolosComVariacoes.length > 0) {
      console.log(`🚨 ENCONTRADAS ${protocolosComVariacoes.length} VARIAÇÕES DE PROTOCOLO:\n`);
      protocolosComVariacoes.slice(0, 10).forEach((v, idx) => {
        console.log(`   ${idx + 1}. Protocolo normalizado: ${v.normalizado}`);
        console.log(`      Variações: ${v.variacoes.join(', ')}\n`);
      });
    } else {
      console.log('✅ Nenhuma variação de protocolo encontrada\n');
    }
    
    // Resumo final
    console.log('='.repeat(60));
    console.log('📊 RESUMO');
    console.log('='.repeat(60));
    console.log(`   Total de registros: ${total}`);
    console.log(`   Esperado: 17.601`);
    console.log(`   Diferença: ${total - 17601} registros a mais`);
    console.log(`   Duplicatas por protocolo: ${duplicatasProtocolo.length}`);
    console.log(`   Duplicatas exatas: ${duplicatasExatas.length}`);
    console.log(`   Variações de protocolo: ${protocolosComVariacoes.length}`);
    console.log('='.repeat(60) + '\n');
    
    await mongoose.disconnect();
    console.log('✅ Verificação concluída!\n');
    
  } catch (error) {
    console.error('❌ Erro ao verificar:', error);
    process.exit(1);
  }
}

verificarDiferenca();

