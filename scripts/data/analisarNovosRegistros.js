/**
 * Script para Analisar Novos Registros Inseridos
 * Identifica quais são os novos registros e por que foram inseridos
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function analisarNovosRegistros() {
  console.log('🔍 Analisando novos registros inseridos...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Buscar registros ordenados por data de criação (mais recentes primeiro)
    const registrosRecentes = await Record.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    console.log(`📊 Analisando os ${registrosRecentes.length} registros mais recentes...\n`);
    
    // Buscar todos os protocolos no banco
    const todosProtocolos = await Record.find({ protocolo: { $ne: null } })
      .select('protocolo')
      .lean();
    
    const protocolosSet = new Set(todosProtocolos.map(r => String(r.protocolo)));
    console.log(`📋 Total de protocolos únicos no banco: ${protocolosSet.size}\n`);
    
    // Analisar os registros mais recentes
    const novosRegistros = [];
    const possiveisDuplicatas = [];
    
    for (const registro of registrosRecentes) {
      const protocolo = String(registro.protocolo || '');
      
      if (!protocolo) {
        novosRegistros.push({
          ...registro,
          motivo: 'Sem protocolo'
        });
        continue;
      }
      
      // Verificar se há outros registros com o mesmo protocolo
      const registrosComMesmoProtocolo = await Record.find({ 
        protocolo: protocolo,
        _id: { $ne: registro._id }
      }).lean();
      
      if (registrosComMesmoProtocolo.length > 0) {
        possiveisDuplicatas.push({
          protocolo,
          registroAtual: {
            id: registro._id,
            dataCriacao: registro.dataCriacaoIso || registro.dataDaCriacao,
            createdAt: registro.createdAt
          },
          outrosRegistros: registrosComMesmoProtocolo.map(r => ({
            id: r._id,
            dataCriacao: r.dataCriacaoIso || r.dataDaCriacao,
            createdAt: r.createdAt
          }))
        });
      } else {
        novosRegistros.push({
          protocolo,
          dataCriacao: registro.dataCriacaoIso || registro.dataDaCriacao,
          createdAt: registro.createdAt,
          motivo: 'Protocolo único (não existe no banco)'
        });
      }
    }
    
    // Mostrar resultados
    console.log('='.repeat(60));
    console.log('📊 ANÁLISE DE NOVOS REGISTROS');
    console.log('='.repeat(60) + '\n');
    
    if (novosRegistros.length > 0) {
      console.log(`✅ ${novosRegistros.length} registros são realmente novos (protocolos únicos):\n`);
      novosRegistros.slice(0, 20).forEach((r, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${r.protocolo || 'N/A'}`);
        console.log(`      Data Criação: ${r.dataCriacao || 'N/A'}`);
        console.log(`      Criado em: ${r.createdAt || 'N/A'}`);
        console.log(`      Motivo: ${r.motivo}\n`);
      });
      
      if (novosRegistros.length > 20) {
        console.log(`   ... e mais ${novosRegistros.length - 20} registros\n`);
      }
    }
    
    if (possiveisDuplicatas.length > 0) {
      console.log(`\n⚠️  ${possiveisDuplicatas.length} possíveis duplicatas encontradas:\n`);
      possiveisDuplicatas.slice(0, 10).forEach((dup, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${dup.protocolo}`);
        console.log(`      Registro atual: ${dup.registroAtual.id}`);
        console.log(`      Outros registros com mesmo protocolo: ${dup.outrosRegistros.length}`);
        dup.outrosRegistros.forEach((outro, i) => {
          console.log(`         ${i + 1}. ID: ${outro.id}, Data: ${outro.dataCriacao || 'N/A'}`);
        });
        console.log('');
      });
      
      if (possiveisDuplicatas.length > 10) {
        console.log(`   ... e mais ${possiveisDuplicatas.length - 10} possíveis duplicatas\n`);
      }
    }
    
    // Estatísticas gerais
    console.log('='.repeat(60));
    console.log('📊 ESTATÍSTICAS:');
    console.log('='.repeat(60));
    console.log(`   Total de registros no banco: ${await Record.countDocuments()}`);
    console.log(`   Protocolos únicos: ${protocolosSet.size}`);
    console.log(`   Registros realmente novos: ${novosRegistros.length}`);
    console.log(`   Possíveis duplicatas: ${possiveisDuplicatas.length}`);
    console.log('='.repeat(60) + '\n');
    
    // Verificar se há registros sem protocolo
    const semProtocolo = await Record.countDocuments({ 
      $or: [
        { protocolo: null },
        { protocolo: '' },
        { protocolo: { $exists: false } }
      ]
    });
    
    if (semProtocolo > 0) {
      console.log(`⚠️  ATENÇÃO: ${semProtocolo} registros sem protocolo no banco\n`);
    }
    
    // Verificar duplicatas exatas de protocolo
    const duplicatasExatas = await Record.aggregate([
      {
        $match: { protocolo: { $ne: null, $ne: '' } }
      },
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
      },
      {
        $limit: 20
      }
    ]);
    
    if (duplicatasExatas.length > 0) {
      console.log(`\n🚨 DUPLICATAS EXATAS DE PROTOCOLO ENCONTRADAS:\n`);
      duplicatasExatas.forEach((dup, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${dup._id}`);
        console.log(`      Quantidade: ${dup.count} registros`);
        console.log(`      IDs: ${dup.ids.slice(0, 3).join(', ')}${dup.ids.length > 3 ? '...' : ''}\n`);
      });
    }
    
    await mongoose.disconnect();
    console.log('✅ Análise concluída!\n');
    
  } catch (error) {
    console.error('❌ Erro ao analisar:', error);
    process.exit(1);
  }
}

analisarNovosRegistros();

