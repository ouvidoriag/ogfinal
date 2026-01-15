/**
 * Script para Gerar Datas de Conclusão Aleatórias
 * 
 * Gera datas de conclusão para protocolos fora do padrão "C..."
 * usando como referência o tempo médio de resolução dos protocolos padrão "C..."
 * 
 * Regras:
 * - Apenas protocolos que NÃO começam com "C" seguido de números
 * - Protocolos sem data de conclusão
 * - Tempo de resolução baseado na média dos protocolos "C..."
 * - Não ultrapassar 60 dias da data de criação
 * 
 * Uso: node scripts/data/gerar-datas-conclusao.js
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, normalizeDate } from '../../src/utils/formatting/dateUtils.js';
import logger from '../../src/utils/logger.js';

/**
 * Verifica se um protocolo segue o padrão "C..." (C seguido de números)
 */
function isProtocoloPadraoC(protocolo) {
  if (!protocolo || typeof protocolo !== 'string') return false;
  const trimmed = protocolo.trim().toUpperCase();
  // Padrão: C seguido de um ou mais dígitos
  return /^C\d+/.test(trimmed);
}

/**
 * Calcula o tempo médio de resolução dos protocolos padrão "C..."
 */
async function calcularTempoMedioResolucaoPadraoC() {
  console.log('📊 Calculando tempo médio de resolução dos protocolos padrão "C..."...\n');
  
  // Buscar protocolos padrão "C..." que têm tempo de resolução calculável
  const protocolosPadraoC = await Record.find({
    protocolo: { $regex: /^C\d+/i },
    $or: [
      { tempoDeResolucaoEmDias: { $exists: true, $ne: null, $ne: '' } },
      { 
        dataCriacaoIso: { $exists: true, $ne: null },
        dataConclusaoIso: { $exists: true, $ne: null }
      }
    ]
  })
  .select('protocolo tempoDeResolucaoEmDias dataCriacaoIso dataConclusaoIso dataDaCriacao dataDaConclusao')
  .lean();
  
  console.log(`   Encontrados ${protocolosPadraoC.length} protocolos padrão "C..." com dados de resolução\n`);
  
  if (protocolosPadraoC.length === 0) {
    console.log('⚠️  Nenhum protocolo padrão "C..." encontrado. Usando tempo padrão de 30 dias.\n');
    return 30;
  }
  
  const temposResolucao = [];
  
  for (const record of protocolosPadraoC) {
    let tempo = null;
    
    // Prioridade 1: campo direto tempoDeResolucaoEmDias
    if (record.tempoDeResolucaoEmDias) {
      const parsed = parseFloat(record.tempoDeResolucaoEmDias);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        tempo = parsed;
      }
    }
    
    // Prioridade 2: calcular das datas ISO
    if (!tempo) {
      const dataCriacao = getDataCriacao(record);
      const dataConclusao = record.dataConclusaoIso || normalizeDate(record.dataDaConclusao);
      
      if (dataCriacao && dataConclusao) {
        try {
          const start = new Date(dataCriacao + 'T00:00:00');
          const end = new Date(dataConclusao + 'T00:00:00');
          
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
            const diffMs = end.getTime() - start.getTime();
            const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (dias > 0 && dias <= 1000) {
              tempo = dias;
            }
          }
        } catch (error) {
          // Ignorar erros de parsing
        }
      }
    }
    
    if (tempo && tempo > 0) {
      temposResolucao.push(tempo);
    }
  }
  
  if (temposResolucao.length === 0) {
    console.log('⚠️  Nenhum tempo de resolução válido encontrado. Usando tempo padrão de 30 dias.\n');
    return 30;
  }
  
  // Calcular média
  const soma = temposResolucao.reduce((acc, t) => acc + t, 0);
  const media = Math.round(soma / temposResolucao.length);
  
  console.log(`   Tempo mínimo: ${Math.min(...temposResolucao)} dias`);
  console.log(`   Tempo máximo: ${Math.max(...temposResolucao)} dias`);
  console.log(`   Tempo médio: ${media} dias`);
  console.log(`   Total de amostras: ${temposResolucao.length}\n`);
  
  return media;
}

/**
 * Gera uma data de conclusão aleatória baseada no tempo médio
 */
function gerarDataConclusao(dataCriacao, tempoMedio) {
  if (!dataCriacao) return null;
  
  try {
    const dataCriacaoDate = new Date(dataCriacao + 'T00:00:00');
    if (isNaN(dataCriacaoDate.getTime())) return null;
    
    // Gerar tempo aleatório entre 70% e 100% do tempo médio
    // Mas nunca ultrapassar 60 dias
    const variacaoMin = Math.max(1, Math.floor(tempoMedio * 0.7));
    const variacaoMax = Math.min(60, Math.floor(tempoMedio * 1.0));
    
    // Se o tempo médio for maior que 60, usar 60 como máximo
    const tempoMaximo = Math.min(60, variacaoMax);
    const tempoMinimo = Math.min(tempoMaximo, variacaoMin);
    
    // Gerar número aleatório entre tempoMinimo e tempoMaximo
    const tempoAleatorio = Math.floor(Math.random() * (tempoMaximo - tempoMinimo + 1)) + tempoMinimo;
    
    // Adicionar dias à data de criação
    const dataConclusao = new Date(dataCriacaoDate);
    dataConclusao.setDate(dataConclusao.getDate() + tempoAleatorio);
    
    // Formatar como YYYY-MM-DD
    const ano = dataConclusao.getFullYear();
    const mes = String(dataConclusao.getMonth() + 1).padStart(2, '0');
    const dia = String(dataConclusao.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
  } catch (error) {
    logger.error('Erro ao gerar data de conclusão', { error: error.message, dataCriacao });
    return null;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando geração de datas de conclusão aleatórias...\n');
  console.log('='.repeat(80));
  
  try {
    // Conectar ao MongoDB
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // 1. Calcular tempo médio de resolução dos protocolos padrão "C..."
    const tempoMedio = await calcularTempoMedioResolucaoPadraoC();
    console.log(`📊 Tempo médio de resolução usado: ${tempoMedio} dias\n`);
    
    // 2. Buscar protocolos fora do padrão "C..." sem data de conclusão
    console.log('🔍 Buscando protocolos fora do padrão "C..." sem data de conclusão...\n');
    
    const protocolosSemConclusao = await Record.find({
      protocolo: { 
        $exists: true, 
        $ne: null, 
        $ne: '',
        $not: /^C\d+/i  // NÃO começa com C seguido de números
      },
      $or: [
        { dataCriacaoIso: { $exists: true, $ne: null } },
        { dataDaCriacao: { $exists: true, $ne: null } }
      ],
      $and: [
        {
          $or: [
            { dataConclusaoIso: { $exists: false } },
            { dataConclusaoIso: null },
            { dataConclusaoIso: '' }
          ]
        },
        {
          $or: [
            { dataDaConclusao: { $exists: false } },
            { dataDaConclusao: null },
            { dataDaConclusao: '' }
          ]
        }
      ]
    })
    .select('_id protocolo dataCriacaoIso dataDaCriacao')
    .lean();
    
    console.log(`   Encontrados ${protocolosSemConclusao.length} protocolos sem data de conclusão\n`);
    
    if (protocolosSemConclusao.length === 0) {
      console.log('✅ Nenhum protocolo para processar. Finalizando.\n');
      await closeDatabase();
      return;
    }
    
    // 3. Gerar e atualizar datas de conclusão
    console.log('🔄 Gerando datas de conclusão...\n');
    
    let atualizados = 0;
    let erros = 0;
    const batchSize = 100;
    
    for (let i = 0; i < protocolosSemConclusao.length; i += batchSize) {
      const batch = protocolosSemConclusao.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          const dataCriacao = getDataCriacao(record);
          if (!dataCriacao) {
            console.log(`   ⚠️  Protocolo ${record.protocolo}: sem data de criação, pulando...`);
            continue;
          }
          
          // Verificar se já não ultrapassou 60 dias
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const dataCriacaoDate = new Date(dataCriacao + 'T00:00:00');
          const diffDias = Math.floor((hoje - dataCriacaoDate) / (1000 * 60 * 60 * 24));
          
          if (diffDias > 60) {
            console.log(`   ⚠️  Protocolo ${record.protocolo}: já passou ${diffDias} dias, pulando...`);
            continue;
          }
          
          // Gerar data de conclusão
          const dataConclusao = gerarDataConclusao(dataCriacao, tempoMedio);
          
          if (!dataConclusao) {
            console.log(`   ⚠️  Protocolo ${record.protocolo}: erro ao gerar data, pulando...`);
            erros++;
            continue;
          }
          
          // Atualizar no banco
          await Record.updateOne(
            { _id: record._id },
            { 
              $set: { 
                dataConclusaoIso: dataConclusao,
                dataDaConclusao: dataConclusao.split('-').reverse().join('/') // Formato DD/MM/YYYY
              }
            }
          );
          
          atualizados++;
          
          if (atualizados % 50 === 0) {
            console.log(`   ✅ ${atualizados} protocolos atualizados...`);
          }
        } catch (error) {
          logger.error('Erro ao processar protocolo', { 
            protocolo: record.protocolo, 
            error: error.message 
          });
          erros++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO');
    console.log('='.repeat(80));
    console.log(`   Total de protocolos processados: ${protocolosSemConclusao.length}`);
    console.log(`   ✅ Atualizados com sucesso: ${atualizados}`);
    console.log(`   ❌ Erros: ${erros}`);
    console.log(`   📊 Tempo médio usado: ${tempoMedio} dias`);
    console.log('='.repeat(80) + '\n');
    
    await closeDatabase();
    console.log('✅ Processo concluído com sucesso!\n');
    
  } catch (error) {
    logger.error('Erro no script de geração de datas', { error: error.message, stack: error.stack });
    console.error('\n❌ Erro:', error.message);
    console.error(error.stack);
    await closeDatabase();
    process.exit(1);
  }
}

// Executar
main();


