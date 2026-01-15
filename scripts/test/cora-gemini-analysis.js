/**
 * Script de Análise e Otimização da CORA
 * Simula 30 perguntas à Gemini API e analisa respostas para otimizar
 * 
 * CÉREBRO X-3
 * Data: 12/12/2025
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

// Carregar variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
config({ path: envPath });

// Importar helpers após carregar .env
const geminiHelper = await import('../../src/utils/geminiHelper.js');
const loggerModule = await import('../../src/utils/logger.js');

const { getCurrentGeminiKey, hasGeminiKeys, getGeminiKeysCount } = geminiHelper;
const { logger } = loggerModule;

// 30 perguntas variadas para testar
const PERGUNTAS_TESTE = [
  // Perguntas básicas
  'Quantas manifestações temos?',
  'Qual o total de ocorrências?',
  'Quantos protocolos estão abertos?',
  
  // Perguntas de ranking
  'Quais os top 5 temas mais frequentes?',
  'Quais as top 3 secretarias com mais demandas?',
  'Quais os top 10 bairros com mais ocorrências?',
  
  // Perguntas de comparação
  'Como está este mês comparado ao mês anterior?',
  'Qual a diferença entre saúde e educação?',
  'Compare os últimos 3 meses',
  
  // Perguntas de tempo
  'Qual o tempo médio de resolução?',
  'Quantos protocolos estão vencidos?',
  'Qual o prazo médio por secretaria?',
  
  // Perguntas de distribuição
  'Como está a distribuição por status?',
  'Qual a distribuição percentual por tema?',
  'Como estão distribuídas as ocorrências por bairro?',
  
  // Perguntas complexas
  'Quantas reclamações sobre saúde tivemos em janeiro?',
  'Qual o bairro com mais problemas de zeladoria?',
  'Quais secretarias têm mais protocolos vencidos?',
  
  // Perguntas de tendência
  'Como está a evolução dos últimos 6 meses?',
  'Está aumentando ou diminuindo?',
  'Qual a tendência de crescimento?',
  
  // Perguntas específicas
  'Quantas manifestações sobre educação temos?',
  'Qual o tempo médio de resolução de reclamações?',
  'Quantos elogios recebemos?',
  
  // Perguntas de análise
  'O que os dados mostram sobre saúde?',
  'Quais os principais problemas identificados?',
  'Onde devemos focar mais atenção?',
  
  // Perguntas de contexto
  'Me mostre um resumo geral',
  'Dê-me uma visão geral dos dados',
  'O que você pode me dizer sobre os dados?',
  
  // Perguntas de follow-up
  'E sobre zeladoria?',
  'E os protocolos vencidos?',
  'Pode detalhar mais?'
];

/**
 * Fazer pergunta à Gemini API
 */
async function perguntarGemini(pergunta, dadosFormatados, systemPrompt) {
  if (!hasGeminiKeys()) {
    throw new Error('Chaves Gemini não configuradas');
  }
  
  const GEMINI_API_KEY = getCurrentGeminiKey();
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" }
    ],
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 4096,
      topP: 0.95,
      topK: 40
    },
    contents: [
      { 
        role: 'user', 
        parts: [{ 
          text: `=== DADOS DO BANCO DE DADOS ===\n\n${dadosFormatados}\n\n=== PERGUNTA DO USUÁRIO ===\n\n${pergunta}\n\nPor favor, responda de forma natural, humana e empática, como uma colega de trabalho experiente.` 
        }] 
      }
    ]
  };
  
  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!resp.ok) {
      throw new Error(`Erro ${resp.status}: ${await resp.text()}`);
    }
    
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Analisar resposta da Gemini
 */
function analisarResposta(resposta, pergunta) {
  const analise = {
    pergunta: pergunta,
    resposta: resposta,
    comprimento: resposta?.length || 0,
    temNumeros: /[\d.,]+/.test(resposta || ''),
    temEmojis: /[\u{1F300}-\u{1F9FF}]/u.test(resposta || ''),
    temMarkdown: /(\*\*|#|\[|\])/.test(resposta || ''),
    temPergunta: /[?]/.test(resposta || ''),
    tom: detectarTom(resposta || ''),
    estrutura: analisarEstrutura(resposta || ''),
    qualidade: 0
  };
  
  // Calcular qualidade (0-100)
  let qualidade = 50; // Base
  
  if (analise.comprimento > 100 && analise.comprimento < 2000) qualidade += 10; // Tamanho adequado
  if (analise.temNumeros) qualidade += 15; // Tem dados
  if (analise.temMarkdown) qualidade += 10; // Bem formatado
  if (analise.temPergunta) qualidade += 5; // Proativo
  if (analise.tom === 'humano' || analise.tom === 'empatico') qualidade += 10; // Tom adequado
  if (analise.estrutura.temLista) qualidade += 5; // Organizado
  if (analise.estrutura.temTitulos) qualidade += 5; // Estruturado
  
  analise.qualidade = Math.min(100, qualidade);
  
  return analise;
}

/**
 * Detectar tom da resposta
 */
function detectarTom(resposta) {
  const respLower = resposta.toLowerCase();
  
  if (respLower.match(/(olá|oi|olha|veja|interessante|que legal)/)) return 'humano';
  if (respLower.match(/(preocupante|atenção|alerta|importante)/)) return 'empatico';
  if (respLower.match(/(baseado|de acordo|conforme|segundo)/)) return 'formal';
  if (respLower.match(/(pode|quer|posso|sugiro)/)) return 'proativo';
  
  return 'neutro';
}

/**
 * Analisar estrutura da resposta
 */
function analisarEstrutura(resposta) {
  return {
    temLista: /^[\s]*[-*•]\s/m.test(resposta) || /^\d+\.\s/m.test(resposta),
    temTitulos: /^#+\s/m.test(resposta) || /\*\*[^*]+\*\*/m.test(resposta),
    temTabela: /\|.*\|/m.test(resposta),
    temParagrafos: resposta.split('\n\n').length > 2,
    temDestaques: /\*\*[^*]+\*\*/g.test(resposta)
  };
}

/**
 * Gerar dados de teste
 */
function gerarDadosTeste() {
  return `📊 **DADOS REAIS DO BANCO DE DADOS**

**Total de manifestações: 12.345**

**Distribuição por Status:**
1. Concluído: 8.000 (64.8%)
2. Em Andamento: 3.000 (24.3%)
3. Aberto: 1.345 (10.9%)

**Top Secretarias/Órgãos:**
1. Secretaria de Saúde: 2.500 (20.3%)
2. Secretaria de Educação: 1.800 (14.6%)
3. Secretaria de Obras: 1.200 (9.7%)
4. Secretaria de Zeladoria: 1.000 (8.1%)
5. Secretaria de Assistência Social: 800 (6.5%)

**Top Temas:**
1. Saúde: 2.500 (20.3%)
2. Educação: 1.800 (14.6%)
3. Zeladoria: 1.000 (8.1%)
4. Obras: 1.200 (9.7%)
5. Assistência Social: 800 (6.5%)

**Tempo Médio de Resolução:**
- Média: 45.2 dias
- Mínimo: 1 dia
- Máximo: 180 dias

**Protocolos Vencidos:**
- Vencidos: 150 (1.2%)
- Próximos do vencimento (15 dias): 300 (2.4%)`;
}

/**
 * Executar análise completa
 */
async function executarAnalise() {
  console.log('\n=== 🚀 ANÁLISE E OTIMIZAÇÃO DA CORA ===\n');
  console.log(`Testando ${PERGUNTAS_TESTE.length} perguntas...\n`);
  
  // Aguardar um pouco para garantir que .env foi carregado
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const temChaves = hasGeminiKeys();
  const numChaves = getGeminiKeysCount();
  
  console.log(`🔑 Chaves Gemini: ${temChaves ? `${numChaves} configurada(s)` : 'Não configuradas'}\n`);
  
  if (!temChaves) {
    console.error('❌ Chaves Gemini não configuradas!');
    console.log('💡 Verifique se GEMINI_API_KEY está no arquivo .env');
    return;
  }
  
  const dadosTeste = gerarDadosTeste();
  const systemPrompt = `Você é a CORA, uma assistente virtual especialista em análises de dados da Prefeitura de Duque de Caxias.
Seja natural, humana, empática e conversacional. Use os dados fornecidos para responder.`;
  
  const resultados = [];
  let sucesso = 0;
  let falhas = 0;
  
  for (let i = 0; i < PERGUNTAS_TESTE.length; i++) {
    const pergunta = PERGUNTAS_TESTE[i];
    console.log(`[${i + 1}/${PERGUNTAS_TESTE.length}] Testando: "${pergunta.substring(0, 50)}..."`);
    
          try {
            const resposta = await perguntarGemini(pergunta, dadosTeste, systemPrompt);
            
            if (resposta) {
              const analise = analisarResposta(resposta, pergunta);
              resultados.push(analise);
              sucesso++;
              
              console.log(`  ✅ Qualidade: ${analise.qualidade}/100 | Tom: ${analise.tom} | Comprimento: ${analise.comprimento} chars`);
            } else {
              falhas++;
              console.log(`  ❌ Sem resposta`);
            }
            
            // Delay maior para não exceder rate limit (free tier: 5 req/min por chave)
            // Com 4 chaves, podemos fazer até 20 req/min, mas vamos ser conservadores
            // Delay de 4 segundos = 15 req/min por chave (seguro)
            await new Promise(resolve => setTimeout(resolve, 4000));
          } catch (error) {
            falhas++;
            const errorMsg = error.message || '';
            
            // Detectar rate limit e aguardar
            if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('503')) {
              console.log(`  ⏳ Rate limit detectado - aguardando 30s antes de continuar...`);
              await new Promise(resolve => setTimeout(resolve, 30000)); // Aguardar 30s
              
              // Tentar rotacionar chave
              if (getGeminiKeysCount() > 1) {
                rotateToNextKey();
                console.log(`  🔄 Rotacionando para próxima chave...`);
              }
            } else {
              console.log(`  ❌ Erro: ${errorMsg.substring(0, 100)}`);
            }
          }
  }
  
  console.log(`\n=== 📊 RESULTADOS DA ANÁLISE ===\n`);
  console.log(`Sucesso: ${sucesso}/${PERGUNTAS_TESTE.length}`);
  console.log(`Falhas: ${falhas}/${PERGUNTAS_TESTE.length}`);
  
  // Análise agregada
  const qualidadeMedia = resultados.reduce((acc, r) => acc + r.qualidade, 0) / resultados.length;
  const comprimentoMedio = resultados.reduce((acc, r) => acc + r.comprimento, 0) / resultados.length;
  const tomMaisComum = contarToms(resultados);
  
  console.log(`\nQualidade Média: ${qualidadeMedia.toFixed(1)}/100`);
  console.log(`Comprimento Médio: ${comprimentoMedio.toFixed(0)} caracteres`);
  console.log(`Tom Mais Comum: ${tomMaisComum}`);
  
  // Gerar recomendações
  const recomendacoes = gerarRecomendacoes(resultados);
  console.log(`\n=== 💡 RECOMENDAÇÕES DE OTIMIZAÇÃO ===\n`);
  recomendacoes.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });
  
  // Salvar resultados
  const fs = await import('fs');
  const path = await import('path');
  const resultadosPath = path.join(__dirname, 'cora-analysis-results.json');
  
  fs.writeFileSync(resultadosPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: PERGUNTAS_TESTE.length,
    sucesso,
    falhas,
    qualidadeMedia,
    comprimentoMedio,
    tomMaisComum,
    resultados,
    recomendacoes
  }, null, 2));
  
  console.log(`\n✅ Resultados salvos em: ${resultadosPath}`);
  console.log('\n=== ✅ ANÁLISE CONCLUÍDA ===\n');
  
  return { resultados, recomendacoes, qualidadeMedia };
}

/**
 * Contar distribuição de tons
 */
function contarToms(resultados) {
  const toms = {};
  resultados.forEach(r => {
    toms[r.tom] = (toms[r.tom] || 0) + 1;
  });
  
  return Object.entries(toms)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutro';
}

/**
 * Gerar recomendações baseadas na análise
 */
function gerarRecomendacoes(resultados) {
  const recomendacoes = [];
  
  // Analisar qualidade média
  const qualidadeMedia = resultados.reduce((acc, r) => acc + r.qualidade, 0) / resultados.length;
  if (qualidadeMedia < 70) {
    recomendacoes.push('Melhorar qualidade geral das respostas - adicionar mais contexto e formatação');
  }
  
  // Analisar comprimento
  const comprimentoMedio = resultados.reduce((acc, r) => acc + r.comprimento, 0) / resultados.length;
  if (comprimentoMedio < 200) {
    recomendacoes.push('Respostas muito curtas - adicionar mais detalhes e análises');
  } else if (comprimentoMedio > 1500) {
    recomendacoes.push('Respostas muito longas - tornar mais concisas sem perder informação');
  }
  
  // Analisar uso de emojis
  const comEmojis = resultados.filter(r => r.temEmojis).length;
  const percentualEmojis = (comEmojis / resultados.length) * 100;
  if (percentualEmojis < 30) {
    recomendacoes.push('Aumentar uso de emojis para tornar respostas mais humanas e visuais');
  }
  
  // Analisar proatividade
  const comPerguntas = resultados.filter(r => r.temPergunta).length;
  const percentualPerguntas = (comPerguntas / resultados.length) * 100;
  if (percentualPerguntas < 40) {
    recomendacoes.push('Aumentar proatividade - fazer mais perguntas de follow-up');
  }
  
  // Analisar tom
  const tomMaisComum = contarToms(resultados);
  if (tomMaisComum === 'formal') {
    recomendacoes.push('Tom muito formal - tornar mais conversacional e humano');
  }
  
  // Analisar estrutura
  const comListas = resultados.filter(r => r.estrutura.temLista).length;
  const percentualListas = (comListas / resultados.length) * 100;
  if (percentualListas < 50) {
    recomendacoes.push('Usar mais listas e formatação para melhorar legibilidade');
  }
  
  // Analisar markdown
  const comMarkdown = resultados.filter(r => r.temMarkdown).length;
  const percentualMarkdown = (comMarkdown / resultados.length) * 100;
  if (percentualMarkdown < 80) {
    recomendacoes.push('Aumentar uso de markdown para destacar informações importantes');
  }
  
  return recomendacoes;
}

// Executar se chamado diretamente
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule || process.argv[1]?.includes('cora-gemini-analysis')) {
  executarAnalise().catch(console.error);
}

export { executarAnalise, analisarResposta, gerarRecomendacoes };

