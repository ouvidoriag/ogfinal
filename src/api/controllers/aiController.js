/**
 * Controller de IA
 * /api/ai/insights
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import { getMes } from '../../utils/formatting/dateUtils.js';
import { getCurrentGeminiKey, rotateToNextKey, hasGeminiKeys, isCurrentKeyInCooldown, markCurrentKeyInCooldown, hasAvailableKey } from '../../utils/geminiHelper.js';
import Record from '../../models/Record.model.js';

/**
 * Detecta padrões e anomalias nos dados
 */
async function detectPatternsAndAnomalies(servidor, unidadeCadastro) {
  const filter = {};
  if (servidor) filter.servidor = servidor;
  if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

  // Buscar dados dos últimos 3 meses para comparação
  const hoje = new Date();
  const tresMesesAtras = new Date(hoje);
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  filter.dataDaCriacao = { $ne: null };

  // Buscar registros e agrupar por mês manualmente
  const registros = await Record.find(filter)
    .select('dataCriacaoIso dataDaCriacao')
    .limit(20000)
    .lean();

  // Agrupar por mês usando a função getMes
  const porMes = new Map();
  registros.forEach(r => {
    const mes = getMes(r);
    if (mes) {
      porMes.set(mes, (porMes.get(mes) || 0) + 1);
    }
  });

  const meses = Array.from(porMes.entries()).sort();
  const anomalias = [];

  // Detectar aumentos anormais (mais de 30% de aumento)
  if (meses.length >= 2) {
    const ultimoMes = meses[meses.length - 1];
    const penultimoMes = meses[meses.length - 2];
    const aumento = penultimoMes[1] > 0
      ? ((ultimoMes[1] - penultimoMes[1]) / penultimoMes[1]) * 100
      : (ultimoMes[1] > 0 ? 100 : 0);

    if (aumento > 30) {
      anomalias.push({
        tipo: 'aumento_anormal',
        mes: ultimoMes[0],
        valor: ultimoMes[1],
        aumento: aumento.toFixed(1),
        mensagem: `Aumento anormal de ${aumento.toFixed(1)}% em ${ultimoMes[0]}`
      });
    }
  }

  // Executar agregações em paralelo
  const [porSecretaria, porAssunto, porUnidade] = await Promise.all([
    Record.aggregate([
      { $match: { ...filter, orgaos: { $ne: null } } },
      { $group: { _id: '$orgaos', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    Record.aggregate([
      { $match: { ...filter, assunto: { $ne: null } } },
      { $group: { _id: '$assunto', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    Record.aggregate([
      { $match: { ...filter, unidadeCadastro: { $ne: null } } },
      { $group: { _id: '$unidadeCadastro', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  return {
    anomalias,
    topSecretarias: porSecretaria.map(s => ({ nome: s._id, count: s.count })),
    topAssuntos: porAssunto.map(a => ({ nome: a._id, count: a.count })),
    topUnidades: porUnidade.map(u => ({ nome: u._id, count: u.count })),
    tendenciaMensal: meses.map(([mes, count]) => ({ mes, count }))
  };
}

/**
 * GET /api/ai/insights
 * Gera insights com IA
 */
export async function getInsights(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const cacheKey = servidor ? `aiInsights:servidor:${servidor}:v1` :
    unidadeCadastro ? `aiInsights:uac:${unidadeCadastro}:v1` :
      'aiInsights:v1';

  // Cache de 5 horas para insights (dados base mudam a cada ~5h)
  return withCache(cacheKey, 18000, res, async () => {
    try {
      // Detectar padrões e anomalias
      const patterns = await detectPatternsAndAnomalies(servidor, unidadeCadastro);

      // Se não houver chave Gemini, retornar insights básicos
      if (!hasGeminiKeys()) {
        const insights = [];

        if (patterns.anomalias.length > 0) {
          patterns.anomalias.forEach(a => {
            insights.push({
              tipo: 'anomalia',
              insight: a.mensagem,
              recomendacao: 'Revisar causas do aumento e implementar medidas preventivas.',
              severidade: 'alta'
            });
          });
        }

        if (patterns.topSecretarias.length > 0) {
          insights.push({
            tipo: 'volume',
            insight: `Maior volume: ${patterns.topSecretarias[0].nome} com ${patterns.topSecretarias[0].count.toLocaleString('pt-BR')} manifestações.`,
            recomendacao: 'Monitorar de perto e garantir recursos adequados.',
            severidade: 'media'
          });
        }

        return { insights, patterns };
      }

      // Verificar se há chaves disponíveis (não em cooldown)
      if (!hasAvailableKey()) {
        console.log('⚠️ Todas as chaves em cooldown (quota excedida) - usando fallback');
        // Fallback para insights básicos
        const insights = [];
        if (patterns.anomalias.length > 0) {
          patterns.anomalias.forEach(a => {
            insights.push({
              tipo: 'anomalia',
              insight: a.mensagem,
              recomendacao: 'Revisar causas do aumento e implementar medidas preventivas.',
              severidade: 'alta'
            });
          });
        }
        if (patterns.topSecretarias.length > 0) {
          insights.push({
            tipo: 'volume',
            insight: `Maior volume: ${patterns.topSecretarias[0].nome} com ${patterns.topSecretarias[0].count.toLocaleString('pt-BR')} manifestações.`,
            recomendacao: 'Monitorar de perto e garantir recursos adequados.',
            severidade: 'media'
          });
        }
        return { insights, patterns, geradoPorIA: false, motivo: 'quota_excedida' };
      }

      // Gerar insights com IA
      const GEMINI_API_KEY = getCurrentGeminiKey();

      if (!GEMINI_API_KEY) {
        // Não mencionar modelo quando IA está desativada
        // Fallback para insights básicos
        const insights = [];
        if (patterns.anomalias.length > 0) {
          patterns.anomalias.forEach(a => {
            insights.push({
              tipo: 'anomalia',
              insight: a.mensagem,
              recomendacao: 'Revisar causas do aumento e implementar medidas preventivas.',
              severidade: 'alta'
            });
          });
        }
        if (patterns.topSecretarias.length > 0) {
          insights.push({
            tipo: 'volume',
            insight: `Maior volume: ${patterns.topSecretarias[0].nome} com ${patterns.topSecretarias[0].count.toLocaleString('pt-BR')} manifestações.`,
            recomendacao: 'Monitorar de perto e garantir recursos adequados.',
            severidade: 'media'
          });
        }
        return { insights, patterns, geradoPorIA: false };
      }

      console.log('🤖 Gerando insights com IA...');

      const dadosTexto = `
ANÁLISE DE DADOS DA OUVIDORIA DE DUQUE DE CAXIAS

TENDÊNCIA MENSAL:
${patterns.tendenciaMensal.map(t => `- ${t.mes}: ${t.count.toLocaleString('pt-BR')} manifestações`).join('\n')}

TOP 5 SECRETARIAS/ÓRGÃOS:
${patterns.topSecretarias.slice(0, 5).map((s, i) => `${i + 1}. ${s.nome}: ${s.count.toLocaleString('pt-BR')} manifestações`).join('\n')}

TOP 5 ASSUNTOS:
${patterns.topAssuntos.slice(0, 5).map((a, i) => `${i + 1}. ${a.nome}: ${a.count.toLocaleString('pt-BR')} manifestações`).join('\n')}

TOP 5 UNIDADES DE CADASTRO:
${patterns.topUnidades.slice(0, 5).map((u, i) => `${i + 1}. ${u.nome}: ${u.count.toLocaleString('pt-BR')} manifestações`).join('\n')}

${patterns.anomalias.length > 0 ? `\nANOMALIAS DETECTADAS:\n${patterns.anomalias.map(a => `- ${a.mensagem}`).join('\n')}` : ''}
      `.trim();

      const systemPrompt = `Você é um analista especializado em dados de ouvidoria municipal. 
Analise os dados fornecidos e gere insights acionáveis em português brasileiro.
Seja objetivo, use números reais e forneça recomendações práticas.`;

      const userPrompt = `${dadosTexto}

Gere 3-5 insights principais baseados nestes dados. Para cada insight:
1. Identifique padrões, tendências ou anomalias importantes
2. Explique o que isso significa em linguagem clara
3. Forneça uma recomendação acionável

Formato JSON:
{
  "insights": [
    {
      "tipo": "anomalia|tendencia|volume|tempo",
      "insight": "Descrição clara do que foi detectado (ex: 'A Secretaria de Saúde teve aumento de 32% em manifestações no último mês')",
      "recomendacao": "Ação sugerida (ex: 'Revisar fluxo de triagem e reforçar equipe médica no local')",
      "severidade": "alta|media|baixa"
    }
  ]
}

Retorne APENAS o JSON, sem markdown, sem explicações adicionais.`;

      try {
        // Verificar se a chave atual está em cooldown e rotacionar se necessário
        if (isCurrentKeyInCooldown()) {
          console.log('⏳ Chave atual em cooldown, tentando rotacionar...');
          if (!rotateToNextKey() || !hasAvailableKey()) {
            console.log('⚠️ Todas as chaves em cooldown - usando fallback');
            throw new Error('Todas as chaves em cooldown (quota excedida)');
          }
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getCurrentGeminiKey()}`;

        const payload = {
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          },
          contents: [
            { role: 'user', parts: [{ text: userPrompt }] }
          ]
        };

        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => '');
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }

          // Tratar erro 429 (quota excedida) especificamente
          if (resp.status === 429) {
            console.warn(`⚠️ Quota excedida (429) na chave atual`);

            // Tentar extrair tempo de retry do erro
            let retryAfterSeconds = 60; // Padrão: 60 segundos
            try {
              const retryInfo = errorData.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
              if (retryInfo?.retryDelay) {
                // RetryDelay pode vir como "43s" ou como segundos
                const delay = retryInfo.retryDelay;
                if (typeof delay === 'string' && delay.endsWith('s')) {
                  retryAfterSeconds = parseInt(delay.replace('s', ''), 10) || 60;
                } else if (typeof delay === 'number') {
                  retryAfterSeconds = delay;
                }
              }
            } catch (e) {
              // Ignorar erro ao extrair retry delay
            }

            // Marcar chave atual como em cooldown
            markCurrentKeyInCooldown(retryAfterSeconds);

            // Tentar rotacionar para próxima chave
            if (rotateToNextKey() && hasAvailableKey()) {
              console.log(`🔄 Tentando com próxima chave...`);
              // Não fazer retry aqui - deixar o catch fazer o fallback
              throw new Error('Quota excedida - chave rotacionada');
            } else {
              console.log('⚠️ Todas as chaves com quota excedida - usando fallback');
              throw new Error('Todas as chaves com quota excedida');
            }
          }

          console.error(`❌ Erro na API de IA ${resp.status}:`, errorText.substring(0, 200));
          throw new Error(`Erro na API de IA: ${resp.status} - ${errorText.substring(0, 200)}`);
        }

        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        console.log('✅ Resposta recebida da IA para insights');

        // Tentar extrair JSON mesmo se vier com markdown
        let jsonStr = text.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }

        let aiInsights;
        try {
          aiInsights = JSON.parse(jsonStr);
        } catch (parseError) {
          console.error('❌ Erro ao fazer parse do JSON da IA:', parseError);
          throw new Error('Resposta da IA não é um JSON válido');
        }

        console.log(`✅ ${aiInsights.insights?.length || 0} insights gerados pela IA`);

        return {
          insights: aiInsights.insights || [],
          patterns,
          geradoPorIA: true
        };
      } catch (geminiError) {
        // Se o erro já foi tratado (quota excedida), não fazer nada aqui
        // O erro será capturado e o fallback será retornado
        if (geminiError.message?.includes('quota excedida') || geminiError.message?.includes('cooldown')) {
          // Já foi tratado acima, apenas logar
          console.log('⚠️ Usando fallback devido a quota excedida');
        } else {
          console.error('❌ Erro ao chamar IA para insights:', geminiError);
          // Para outros erros, tentar rotacionar chave
          rotateToNextKey();
        }

        // Fallback para insights básicos
        const insights = [];
        if (patterns.anomalias.length > 0) {
          patterns.anomalias.forEach(a => {
            insights.push({
              tipo: 'anomalia',
              insight: a.mensagem,
              recomendacao: 'Revisar causas do aumento e implementar medidas preventivas.',
              severidade: 'alta'
            });
          });
        }
        if (patterns.topSecretarias.length > 0) {
          insights.push({
            tipo: 'volume',
            insight: `Maior volume: ${patterns.topSecretarias[0].nome} com ${patterns.topSecretarias[0].count.toLocaleString('pt-BR')} manifestações.`,
            recomendacao: 'Monitorar de perto e garantir recursos adequados.',
            severidade: 'media'
          });
        }
        return { insights, patterns, geradoPorIA: false, motivo: geminiError.message?.includes('quota') ? 'quota_excedida' : 'erro_ia' };
      }
    } catch (error) {
      console.error('❌ Erro ao gerar insights:', error);
      return { insights: [], patterns: {}, geradoPorIA: false, erro: error.message };
    }
  }, null, 60000); // Timeout de 60s para endpoint de IA (prisma removido)
}

