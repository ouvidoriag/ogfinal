/**
 * Script para Remover Duplicatas por Variações de Protocolo
 * 
 * Remove registros duplicados que têm protocolos com variações (espaços, quebras de linha)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

/**
 * Normaliza protocolo para comparação
 */
function normalizeProtocolo(protocolo) {
  if (!protocolo) return null;
  return String(protocolo).trim().replace(/\s+/g, '') || null;
}

async function removerDuplicatasVariacoes() {
  console.log('🔍 Procurando e removendo duplicatas por variações de protocolo...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar todos os registros com protocolo
    const todosRegistros = await Record.find({ protocolo: { $ne: null, $ne: '' } })
      .select('_id protocolo createdAt updatedAt')
      .lean();
    
    console.log(`📊 Total de registros com protocolo: ${todosRegistros.length}\n`);
    
    // Agrupar por protocolo normalizado
    const protocolosNormalizados = new Map();
    
    todosRegistros.forEach(r => {
      const protocolo = String(r.protocolo);
      const normalizado = normalizeProtocolo(protocolo);
      
      if (!normalizado) return;
      
      if (!protocolosNormalizados.has(normalizado)) {
        protocolosNormalizados.set(normalizado, []);
      }
      
      protocolosNormalizados.get(normalizado).push({
        _id: r._id,
        protocolo: protocolo,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      });
    });
    
    // Encontrar duplicatas (protocolos normalizados com múltiplas variações)
    const duplicatas = [];
    
    protocolosNormalizados.forEach((variacoes, normalizado) => {
      if (variacoes.length > 1) {
        duplicatas.push({
          normalizado,
          variacoes
        });
      }
    });
    
    if (duplicatas.length === 0) {
      console.log('✅ Nenhuma duplicata por variação encontrada!\n');
      await mongoose.disconnect();
      return;
    }
    
    console.log(`🚨 ENCONTRADAS ${duplicatas.length} DUPLICATAS POR VARIAÇÃO:\n`);
    
    let totalRemovidos = 0;
    
    for (const dup of duplicatas) {
      console.log(`📋 Protocolo normalizado: ${dup.normalizado}`);
      console.log(`   Variações encontradas: ${dup.variacoes.length}`);
      dup.variacoes.forEach((v, idx) => {
        console.log(`      ${idx + 1}. ID: ${v._id}`);
        console.log(`         Protocolo original: "${v.protocolo}"`);
        console.log(`         Criado em: ${v.createdAt || 'N/A'}`);
        console.log(`         Atualizado em: ${v.updatedAt || 'N/A'}\n`);
      });
      
      // Ordenar por data (mais recente primeiro)
      const ordenados = [...dup.variacoes].sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt || new Date(0);
        const dateB = b.updatedAt || b.createdAt || new Date(0);
        return dateB - dateA;
      });
      
      // Manter o primeiro (mais recente) e remover os demais
      const manter = ordenados[0];
      const remover = ordenados.slice(1);
      
      console.log(`   ✅ Mantendo: ID ${manter._id} (mais recente)`);
      console.log(`   ❌ Removendo: ${remover.length} registro(s)\n`);
      
      // Remover duplicatas
      const idsParaRemover = remover.map(r => r._id);
      const resultado = await Record.deleteMany({ _id: { $in: idsParaRemover } });
      
      totalRemovidos += resultado.deletedCount;
      console.log(`   🗑️  ${resultado.deletedCount} registro(s) removido(s)\n`);
    }
    
    // Verificar total final
    const totalFinal = await Record.countDocuments();
    const totalComProtocolo = await Record.countDocuments({ protocolo: { $ne: null, $ne: '' } });
    
    console.log('='.repeat(60));
    console.log('📊 RESUMO');
    console.log('='.repeat(60));
    console.log(`   Duplicatas encontradas: ${duplicatas.length}`);
    console.log(`   Registros removidos: ${totalRemovidos}`);
    console.log(`   Total de registros antes: ${todosRegistros.length}`);
    console.log(`   Total de registros após: ${totalComProtocolo}`);
    console.log(`   Total geral no banco: ${totalFinal}`);
    console.log('='.repeat(60) + '\n');
    
    // Verificar se ainda há duplicatas (buscar manualmente)
    const todosRegistrosFinais = await Record.find({ protocolo: { $ne: null, $ne: '' } })
      .select('_id protocolo')
      .lean();
    
    const protocolosNormalizadosFinais = new Map();
    todosRegistrosFinais.forEach(r => {
      const normalizado = normalizeProtocolo(r.protocolo);
      if (normalizado) {
        if (!protocolosNormalizadosFinais.has(normalizado)) {
          protocolosNormalizadosFinais.set(normalizado, []);
        }
        protocolosNormalizadosFinais.get(normalizado).push(r._id);
      }
    });
    
    const duplicatasRestantes = [];
    protocolosNormalizadosFinais.forEach((ids, normalizado) => {
      if (ids.length > 1) {
        duplicatasRestantes.push({ normalizado, ids, count: ids.length });
      }
    });
    
    if (duplicatasRestantes.length > 0) {
      console.log(`⚠️  Ainda existem ${duplicatasRestantes.length} protocolos duplicados após normalização!\n`);
    } else {
      console.log('✅ Nenhuma duplicata restante!\n');
    }
    
    await mongoose.disconnect();
    console.log('✅ Script finalizado!\n');
    
  } catch (error) {
    console.error('❌ Erro ao remover duplicatas:', error);
    process.exit(1);
  }
}

removerDuplicatasVariacoes();

