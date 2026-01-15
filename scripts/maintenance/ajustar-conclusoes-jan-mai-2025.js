/**
 * Script de Ajuste: Protocolos Jan-Mai 2025
 * 
 * Objetivo:
 * 1. Analisa todos os protocolos de janeiro a maio de 2025
 * 2. Calcula a taxa de conclusão atual
 * 3. Ajusta as datas de conclusão distribuindo de forma alternada entre 0-60 dias
 *    a partir da data de criação, mantendo o total de concluídos
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { getDataCriacao, getDataConclusao, isConcluido, normalizeDate } from '../../src/utils/formatting/dateUtils.js';

// ============================================
// CONFIGURAÇÃO
// ============================================

const MESES_ALVO = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05'];
const MAX_DIAS_CONCLUSAO = 60; // Máximo de dias para conclusão

// Modo dry-run (simulação): se true, não aplica mudanças no banco
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Adiciona dias a uma data ISO
 */
function adicionarDias(dataIso, dias) {
  const data = new Date(dataIso + 'T00:00:00');
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Calcula a distribuição de dias de conclusão
 * Distribui de forma alternada entre 0 e MAX_DIAS_CONCLUSAO
 */
function distribuirDiasConclusao(totalProtocolos, taxaConclusao) {
  const totalConcluidos = Math.round(totalProtocolos * taxaConclusao);
  const diasDistribuidos = [];
  
  // Distribuir de forma alternada entre 0 e MAX_DIAS_CONCLUSAO
  for (let i = 0; i < totalConcluidos; i++) {
    // Usar uma distribuição mais realista: mais protocolos nos primeiros 30 dias
    // e menos nos últimos 30 dias
    const progresso = i / totalConcluidos; // 0 a 1
    
    // Distribuição: 60% nos primeiros 30 dias, 40% nos últimos 30 dias
    let dias;
    if (progresso < 0.6) {
      // Primeiros 60%: distribuir entre 0-30 dias
      dias = Math.floor((progresso / 0.6) * 30);
    } else {
      // Últimos 40%: distribuir entre 30-60 dias
      const progressoRestante = (progresso - 0.6) / 0.4;
      dias = 30 + Math.floor(progressoRestante * 30);
    }
    
    // Garantir que está entre 0 e MAX_DIAS_CONCLUSAO
    dias = Math.max(0, Math.min(MAX_DIAS_CONCLUSAO, dias));
    diasDistribuidos.push(dias);
  }
  
  // Embaralhar para distribuição mais aleatória
  for (let i = diasDistribuidos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [diasDistribuidos[i], diasDistribuidos[j]] = [diasDistribuidos[j], diasDistribuidos[i]];
  }
  
  return diasDistribuidos;
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

async function main() {
  console.log('🚀 CÉREBRO X-3: Ajuste de Conclusões Jan-Mai 2025\n');
  if (DRY_RUN) {
    console.log('⚠️  MODO DRY-RUN ATIVADO: Nenhuma mudança será aplicada no banco de dados\n');
  }
  console.log('='.repeat(80));
  
  try {
    // Conectar ao MongoDB
    console.log('\n📡 Conectando ao MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB Atlas\n');
    
    // ============================================
    // ETAPA 1: ANÁLISE INICIAL
    // ============================================
    console.log('📊 ETAPA 1: Análise Inicial dos Protocolos\n');
    
    // Buscar todos os protocolos de jan-mai 2025
    // Criar filtro $or com todas as condições
    const filtroCompleto = {
      $or: [
        // Buscar por dataCriacaoIso
        ...MESES_ALVO.map(mes => ({
          dataCriacaoIso: { $regex: `^${mes}`, $options: 'i' }
        })),
        // Buscar por dataDaCriacao caso dataCriacaoIso não exista
        ...MESES_ALVO.map(mes => ({
          dataDaCriacao: { $regex: `^${mes}`, $options: 'i' }
        }))
      ]
    };
    
    const todosProtocolos = await Record.find(filtroCompleto).lean();
    console.log(`   Total de protocolos encontrados: ${todosProtocolos.length}`);
    
    // Processar protocolos e normalizar datas
    const protocolosProcessados = todosProtocolos
      .map(record => {
        const dataCriacao = getDataCriacao(record);
        const dataConclusao = getDataConclusao(record);
        const concluido = isConcluido(record);
        
        if (!dataCriacao) return null;
        
        // Verificar se está no período alvo
        const mes = dataCriacao.slice(0, 7); // YYYY-MM
        if (!MESES_ALVO.includes(mes)) return null;
        
        return {
          _id: record._id,
          protocolo: record.protocolo,
          dataCriacaoIso: dataCriacao,
          dataConclusaoIso: dataConclusao,
          concluido: concluido,
          record: record
        };
      })
      .filter(p => p !== null);
    
    console.log(`   Protocolos válidos no período: ${protocolosProcessados.length}`);
    
    // Calcular estatísticas
    const totalProtocolos = protocolosProcessados.length;
    const totalConcluidos = protocolosProcessados.filter(p => p.concluido).length;
    const totalNaoConcluidos = totalProtocolos - totalConcluidos;
    const taxaConclusao = totalProtocolos > 0 ? totalConcluidos / totalProtocolos : 0;
    
    console.log(`\n   📈 Estatísticas:`);
    console.log(`      Total de protocolos: ${totalProtocolos}`);
    console.log(`      Protocolos concluídos: ${totalConcluidos}`);
    console.log(`      Protocolos não concluídos: ${totalNaoConcluidos}`);
    console.log(`      Taxa de conclusão: ${(taxaConclusao * 100).toFixed(2)}%`);
    
    // Estatísticas por mês
    console.log(`\n   📅 Estatísticas por Mês:`);
    for (const mes of MESES_ALVO) {
      const protocolosMes = protocolosProcessados.filter(p => p.dataCriacaoIso.startsWith(mes));
      const concluidosMes = protocolosMes.filter(p => p.concluido).length;
      const taxaMes = protocolosMes.length > 0 ? (concluidosMes / protocolosMes.length) * 100 : 0;
      console.log(`      ${mes}: ${protocolosMes.length} protocolos, ${concluidosMes} concluídos (${taxaMes.toFixed(2)}%)`);
    }
    
    // ============================================
    // ETAPA 2: DISTRIBUIÇÃO DE DIAS
    // ============================================
    console.log(`\n\n📊 ETAPA 2: Distribuição de Dias de Conclusão\n`);
    
    // IMPORTANTE: Manter exatamente o número de protocolos concluídos que já existem
    // Ordenar protocolos por data de criação
    protocolosProcessados.sort((a, b) => {
      return a.dataCriacaoIso.localeCompare(b.dataCriacaoIso);
    });
    
    // Separar protocolos já concluídos e não concluídos
    const protocolosConcluidos = protocolosProcessados.filter(p => p.concluido);
    const protocolosNaoConcluidos = protocolosProcessados.filter(p => !p.concluido);
    
    console.log(`   Protocolos já concluídos: ${protocolosConcluidos.length}`);
    console.log(`   Protocolos não concluídos: ${protocolosNaoConcluidos.length}`);
    
    // Gerar distribuição de dias apenas para os protocolos que devem estar concluídos
    // Usar exatamente o número de protocolos já concluídos
    const diasDistribuidos = distribuirDiasConclusao(protocolosConcluidos.length, 1.0);
    console.log(`   Dias distribuídos: ${diasDistribuidos.length} protocolos`);
    console.log(`   Distribuição: min=${Math.min(...diasDistribuidos)}, max=${Math.max(...diasDistribuidos)}, média=${(diasDistribuidos.reduce((a, b) => a + b, 0) / diasDistribuidos.length).toFixed(1)} dias`);
    
    // ============================================
    // ETAPA 3: APLICAR AJUSTES
    // ============================================
    console.log(`\n\n📊 ETAPA 3: Aplicando Ajustes\n`);
    
    let indiceDias = 0;
    let atualizados = 0;
    let mantidos = 0;
    let erros = 0;
    
    // Primeiro: atualizar protocolos já concluídos com novas datas
    for (const protocolo of protocolosConcluidos) {
      try {
        const diasConclusao = diasDistribuidos[indiceDias];
        const novaDataConclusao = adicionarDias(protocolo.dataCriacaoIso, diasConclusao);
        
        // Calcular tempo de resolução (diferença em dias + 1, conforme padrão do sistema)
        const dataCriacao = new Date(protocolo.dataCriacaoIso + 'T00:00:00');
        const dataConclusao = new Date(novaDataConclusao + 'T00:00:00');
        const diffDias = Math.floor((dataConclusao - dataCriacao) / (1000 * 60 * 60 * 24));
        const tempoResolucao = diffDias >= 0 ? diffDias + 1 : 1; // +1 conforme padrão do sistema
        
        // Verificar se precisa atualizar
        const precisaAtualizar = 
          !protocolo.dataConclusaoIso || 
          protocolo.dataConclusaoIso !== novaDataConclusao;
        
        if (precisaAtualizar) {
          if (!DRY_RUN) {
            // Atualizar no banco
            await Record.updateOne(
              { _id: protocolo._id },
              {
                $set: {
                  dataConclusaoIso: novaDataConclusao,
                  dataDaConclusao: novaDataConclusao.split('-').reverse().join('/'), // DD/MM/YYYY
                  tempoDeResolucaoEmDias: String(tempoResolucao),
                  // Manter status original se existir, senão usar 'Concluída'
                  statusDemanda: protocolo.record.statusDemanda || 'Concluída',
                  status: protocolo.record.status || 'Concluída'
                }
              }
            );
          }
          
          atualizados++;
          
          if (atualizados % 100 === 0) {
            console.log(`   ${DRY_RUN ? '🔍 [DRY-RUN]' : '✅'} Atualizados: ${atualizados} protocolos...`);
          }
        } else {
          mantidos++;
        }
        
        indiceDias++;
      } catch (error) {
        console.error(`   ❌ Erro ao processar protocolo ${protocolo.protocolo}:`, error.message);
        erros++;
      }
    }
    
    // Segundo: garantir que protocolos não concluídos não tenham data de conclusão
    for (const protocolo of protocolosNaoConcluidos) {
      try {
        // Se tem data de conclusão, remover
        if (protocolo.dataConclusaoIso) {
          if (!DRY_RUN) {
            await Record.updateOne(
              { _id: protocolo._id },
              {
                $unset: {
                  dataConclusaoIso: '',
                  dataDaConclusao: '',
                  tempoDeResolucaoEmDias: ''
                },
                $set: {
                  // Manter status original se não for concluído
                  statusDemanda: protocolo.record.statusDemanda || 'Em Andamento',
                  status: protocolo.record.status || 'Em Andamento'
                }
              }
            );
          }
          
          atualizados++;
        } else {
          mantidos++;
        }
      } catch (error) {
        console.error(`   ❌ Erro ao processar protocolo ${protocolo.protocolo}:`, error.message);
        erros++;
      }
    }
    
    // ============================================
    // ETAPA 4: VALIDAÇÃO FINAL
    // ============================================
    console.log(`\n\n📊 ETAPA 4: Validação Final\n`);
    
    // Buscar protocolos atualizados
    const protocolosAtualizados = await Record.find(filtroCompleto).lean();
    
    const totalFinal = protocolosAtualizados.length;
    const concluidosFinal = protocolosAtualizados.filter(r => isConcluido(r)).length;
    const taxaFinal = totalFinal > 0 ? (concluidosFinal / totalFinal) * 100 : 0;
    
    console.log(`   ✅ Resumo da Atualização:`);
    console.log(`      Protocolos atualizados: ${atualizados}`);
    console.log(`      Protocolos mantidos: ${mantidos}`);
    console.log(`      Erros: ${erros}`);
    console.log(`\n   📈 Estatísticas Finais:`);
    console.log(`      Total de protocolos: ${totalFinal}`);
    console.log(`      Protocolos concluídos: ${concluidosFinal}`);
    console.log(`      Taxa de conclusão: ${taxaFinal.toFixed(2)}%`);
    
    // Estatísticas por mês (final)
    console.log(`\n   📅 Estatísticas Finais por Mês:`);
    for (const mes of MESES_ALVO) {
      const protocolosMes = protocolosAtualizados
        .map(r => {
          const dataCriacao = getDataCriacao(r);
          return dataCriacao && dataCriacao.startsWith(mes) ? r : null;
        })
        .filter(r => r !== null);
      
      const concluidosMes = protocolosMes.filter(r => isConcluido(r)).length;
      const taxaMes = protocolosMes.length > 0 ? (concluidosMes / protocolosMes.length) * 100 : 0;
      console.log(`      ${mes}: ${protocolosMes.length} protocolos, ${concluidosMes} concluídos (${taxaMes.toFixed(2)}%)`);
    }
    
    console.log(`\n${'='.repeat(80)}`);
    if (DRY_RUN) {
      console.log('🔍 DRY-RUN concluído! Nenhuma mudança foi aplicada.');
      console.log('   Para aplicar as mudanças, execute sem --dry-run');
    } else {
      console.log('✅ Processo concluído com sucesso!');
    }
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Erro durante o processo:', error);
    throw error;
  } finally {
    // Fechar conexão
    await mongoose.disconnect();
    console.log('\n📡 Desconectado do MongoDB Atlas');
  }
}

// Executar
main().catch(console.error);

