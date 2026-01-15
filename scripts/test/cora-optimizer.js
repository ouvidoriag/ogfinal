/**
 * Otimizador Automático da CORA
 * Analisa respostas da Gemini e gera melhorias automáticas
 * 
 * CÉREBRO X-3
 * Data: 12/12/2025
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Carregar resultados da análise
 */
function carregarResultados() {
  const resultadosPath = join(process.cwd(), 'NOVO', 'scripts', 'test', 'cora-analysis-results.json');
  
  if (!existsSync(resultadosPath)) {
    console.error('❌ Arquivo de resultados não encontrado. Execute cora-gemini-analysis.js primeiro.');
    return null;
  }
  
  return JSON.parse(readFileSync(resultadosPath, 'utf8'));
}

/**
 * Analisar padrões nas respostas
 */
function analisarPadroes(resultados) {
  const padroes = {
    pontosFortes: [],
    pontosFracos: [],
    melhorias: []
  };
  
  // Analisar qualidade
  const qualidadeMedia = resultados.qualidadeMedia;
  if (qualidadeMedia >= 80) {
    padroes.pontosFortes.push('Qualidade geral excelente');
  } else if (qualidadeMedia < 60) {
    padroes.pontosFracos.push('Qualidade abaixo do esperado');
    padroes.melhorias.push('Melhorar prompt system para gerar respostas mais completas');
  }
  
  // Analisar tom
  if (resultados.tomMaisComum === 'formal') {
    padroes.pontosFracos.push('Tom muito formal');
    padroes.melhorias.push('Adicionar mais variações de linguagem conversacional no prompt');
  } else if (resultados.tomMaisComum === 'humano' || resultados.tomMaisComum === 'empatico') {
    padroes.pontosFortes.push('Tom humano e empático');
  }
  
  // Analisar comprimento
  if (resultados.comprimentoMedio < 200) {
    padroes.pontosFracos.push('Respostas muito curtas');
    padroes.melhorias.push('Incentivar respostas mais detalhadas no prompt');
  } else if (resultados.comprimentoMedio > 2000) {
    padroes.pontosFracos.push('Respostas muito longas');
    padroes.melhorias.push('Balancear detalhamento com concisão');
  }
  
  // Analisar uso de emojis
  const comEmojis = resultados.resultados.filter(r => r.temEmojis).length;
  const percentualEmojis = (comEmojis / resultados.resultados.length) * 100;
  if (percentualEmojis < 30) {
    padroes.melhorias.push('Incentivar uso de emojis relevantes nas respostas');
  }
  
  // Analisar proatividade
  const comPerguntas = resultados.resultados.filter(r => r.temPergunta).length;
  const percentualPerguntas = (comPerguntas / resultados.resultados.length) * 100;
  if (percentualPerguntas < 40) {
    padroes.melhorias.push('Aumentar proatividade - fazer mais perguntas de follow-up');
  }
  
  // Analisar estrutura
  const comListas = resultados.resultados.filter(r => r.estrutura.temLista).length;
  const percentualListas = (comListas / resultados.resultados.length) * 100;
  if (percentualListas < 50) {
    padroes.melhorias.push('Usar mais listas e formatação para melhorar legibilidade');
  }
  
  return padroes;
}

/**
 * Gerar melhorias no prompt system
 */
function gerarMelhoriasPrompt(padroes) {
  const melhorias = [];
  
  if (padroes.pontosFracos.includes('Tom muito formal')) {
    melhorias.push({
      tipo: 'prompt',
      local: 'buildHumanizedSystemPrompt',
      sugestao: 'Adicionar mais exemplos de linguagem conversacional e variações de abertura'
    });
  }
  
  if (padroes.melhorias.some(m => m.includes('emoji'))) {
    melhorias.push({
      tipo: 'prompt',
      local: 'buildHumanizedSystemPrompt',
      sugestao: 'Incentivar explicitamente uso de emojis quando apropriado (máximo 2-3 por resposta)'
    });
  }
  
  if (padroes.melhorias.some(m => m.includes('proatividade'))) {
    melhorias.push({
      tipo: 'prompt',
      local: 'buildHumanizedSystemPrompt',
      sugestao: 'Sempre fazer pelo menos uma pergunta de follow-up ao final da resposta'
    });
  }
  
  if (padroes.melhorias.some(m => m.includes('lista'))) {
    melhorias.push({
      tipo: 'prompt',
      local: 'buildHumanizedSystemPrompt',
      sugestao: 'Usar listas numeradas ou com bullets quando apresentar múltiplos itens'
    });
  }
  
  return melhorias;
}

/**
 * Gerar otimizações no código
 */
function gerarOtimizacoesCodigo(padroes) {
  const otimizacoes = [];
  
  // Otimizações baseadas nos padrões identificados
  if (padroes.pontosFracos.includes('Qualidade abaixo do esperado')) {
    otimizacoes.push({
      arquivo: 'chatController.js',
      funcao: 'buildHumanizedSystemPrompt',
      melhoria: 'Adicionar instruções mais específicas sobre qualidade e completude das respostas'
    });
  }
  
  if (padroes.melhorias.some(m => m.includes('detalhado'))) {
    otimizacoes.push({
      arquivo: 'chatController.js',
      funcao: 'formatDataForGeminiSuperInteligente',
      melhoria: 'Incluir mais contexto e dados relevantes na formatação'
    });
  }
  
  return otimizacoes;
}

/**
 * Gerar relatório de otimização
 */
function gerarRelatorio(resultados, padroes, melhorias, otimizacoes) {
  const relatorio = {
    timestamp: new Date().toISOString(),
    resumo: {
      totalPerguntas: resultados.total,
      sucesso: resultados.sucesso,
      qualidadeMedia: resultados.qualidadeMedia.toFixed(1),
      comprimentoMedio: resultados.comprimentoMedio.toFixed(0),
      tomMaisComum: resultados.tomMaisComum
    },
    pontosFortes: padroes.pontosFortes,
    pontosFracos: padroes.pontosFracos,
    melhoriasSugeridas: padroes.melhorias,
    melhoriasPrompt: melhorias,
    otimizacoesCodigo: otimizacoes,
    acoesPrioritarias: [
      ...padroes.melhorias.slice(0, 3),
      ...melhorias.map(m => m.sugestao).slice(0, 2)
    ]
  };
  
  return relatorio;
}

/**
 * Executar otimização
 */
function executarOtimizacao() {
  console.log('\n=== 🔧 OTIMIZADOR AUTOMÁTICO DA CORA ===\n');
  
  const resultados = carregarResultados();
  if (!resultados) {
    return;
  }
  
  console.log('📊 Analisando resultados...\n');
  
  const padroes = analisarPadroes(resultados);
  const melhorias = gerarMelhoriasPrompt(padroes);
  const otimizacoes = gerarOtimizacoesCodigo(padroes);
  const relatorio = gerarRelatorio(resultados, padroes, melhorias, otimizacoes);
  
  // Exibir relatório
  console.log('=== 📈 ANÁLISE DE PADRÕES ===\n');
  console.log('✅ Pontos Fortes:');
  padroes.pontosFortes.forEach(p => console.log(`   - ${p}`));
  
  console.log('\n⚠️ Pontos Fracos:');
  padroes.pontosFracos.forEach(p => console.log(`   - ${p}`));
  
  console.log('\n💡 Melhorias Sugeridas:');
  padroes.melhorias.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));
  
  console.log('\n=== 🎯 AÇÕES PRIORITÁRIAS ===\n');
  relatorio.acoesPrioritarias.forEach((a, i) => {
    console.log(`${i + 1}. ${a}`);
  });
  
  // Salvar relatório
  const relatorioPath = join(process.cwd(), 'NOVO', 'scripts', 'test', 'cora-optimization-report.json');
  writeFileSync(relatorioPath, JSON.stringify(relatorio, null, 2));
  
  console.log(`\n✅ Relatório salvo em: ${relatorioPath}`);
  console.log('\n=== ✅ OTIMIZAÇÃO CONCLUÍDA ===\n');
  
  return relatorio;
}

// Executar se chamado diretamente
if (process.argv[1]?.includes('cora-optimizer')) {
  executarOtimizacao();
}

export { executarOtimizacao, analisarPadroes, gerarMelhoriasPrompt };

