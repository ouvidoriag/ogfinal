/**
 * Categorizador de Tipos de Informação E-SIC
 * 
 * Categoriza tipos de pedidos de informação com base nos assuntos
 * (especificacaoInformacao e detalhesSolicitacao)
 * 
 * CÉREBRO X-3
 */

import { normalizeToLowercase } from './formatting/normalizeLowercase.js';

/**
 * Palavras-chave por categoria para identificação de tipos de informação
 */
const CATEGORIAS_KEYWORDS = {
  'Administrativa': [
    'processo', 'protocolo', 'procedimento', 'tramitacao', 'andamento',
    'licenca', 'autorizacao', 'alvará', 'concessao', 'permissao',
    'secretaria', 'orgao', 'departamento', 'setor', 'divisao',
    'competencia', 'atribuicao', 'responsabilidade', 'jurisdicao'
  ],
  'Financeira': [
    'pagamento', 'pagamentos', 'remuneracao', 'salario', 'vencimento',
    'valor', 'montante', 'custo', 'despesa', 'receita', 'orcamento',
    'contrato', 'empenho', 'liquidacao', 'concessao', 'auxilio',
    'beneficio', 'bolsa', 'subsidio', 'aposentadoria', 'pensao',
    'tributo', 'imposto', 'taxa', 'multa', 'debito', 'credito'
  ],
  'Educacional': [
    'educacao', 'escola', 'escolar', 'ensino', 'aprendizado',
    'matricula', 'cursar', 'curso', 'disciplina', 'nota', 'avaliacao',
    'professor', 'professora', 'docente', 'aluno', 'estudante',
    'merenda', 'transporte escolar', 'unidade escolar', 'creche'
  ],
  'Saúde': [
    'saude', 'hospital', 'posto', 'unidade basica', 'ubs', 'unidade saude',
    'medico', 'medica', 'medicina', 'consulta', 'exame', 'tratamento',
    'medicamento', 'remedio', 'remedios', 'farmacia', 'receita',
    'agendamento', 'atendimento', 'prontuario', 'historico medico',
    'vacina', 'vacinacao', 'epidemiologia'
  ],
  'Infraestrutura': [
    'infraestrutura', 'obra', 'construcao', 'reforma', 'manutencao',
    'via', 'rua', 'avenida', 'estrada', 'pavimentacao', 'asfalto',
    'iluminacao', 'lampada', 'poste', 'energia', 'eletrica',
    'agua', 'agua potavel', 'esgoto', 'saneamento', 'drenagem',
    'ponte', 'viaduto', 'calçada', 'calcada', 'bueiro', 'vala'
  ],
  'Segurança Pública': [
    'seguranca', 'segurança publica', 'policia', 'policial',
    'bombeiro', 'defesa civil', 'vigilancia', 'monitoramento',
    'ocorrencia', 'boletim', 'denuncia', 'crime', 'delito',
    'viatura', 'patrulha', 'ronda', 'seguranca publica'
  ],
  'Meio Ambiente': [
    'meio ambiente', 'ambiental', 'natureza', 'verde', 'parque',
    'reserva', 'preservacao', 'conservacao', 'protecao ambiental',
    'poluicao', 'contaminacao', 'coleta seletiva', 'reciclagem',
    'lixo', 'residuo', 'descarte', 'sustentabilidade'
  ],
  'Transporte': [
    'transporte', 'transporte publico', 'onibus', 'ônibus', 'viacao',
    'linha', 'itinerario', 'rota', 'terminal', 'parada',
    'mobilidade', 'transito', 'transito', 'sinalizacao',
    'ciclovia', 'ciclo faixa', 'bike', 'bicicleta'
  ],
  'Social': [
    'assistencia social', 'social', 'programa social', 'beneficio social',
    'bolsa familia', 'cadastro unico', 'cadunico', 'cras', 'creas',
    'crianca', 'adolescente', 'idoso', 'pessoa idosa', 'deficiente',
    'pcd', 'vulnerabilidade', 'protecao social', 'inclusao'
  ],
  'Jurídica': [
    'juridico', 'legal', 'lei', 'norma', 'legislacao', 'legislativo',
    'processo judicial', 'acao', 'processo', 'autos', 'sentenca',
    'recurso', 'decisao', 'mandado', 'intimacao', 'citacao',
    'advogado', 'defensoria', 'procuradoria', 'justica'
  ],
  'Trabalhista': [
    'trabalho', 'trabalhista', 'emprego', 'emprego publico',
    'concurso', 'concurso publico', 'edital', 'inscricao',
    'cargo', 'funcao', 'vaga', 'selecao', 'processo seletivo',
    'clt', 'consolidacao', 'fgts', 'inss', 'contribuicao previdenciaria'
  ],
  'Habitacional': [
    'habitacao', 'moradia', 'casa', 'apartamento', 'residencia',
    'lote', 'terreno', 'construcao', 'reforma', 'financiamento',
    'habite-se', 'iptu', 'iptu', 'registro imovel', 'escritura',
    'programa habitacional', 'mcmv', 'minha casa minha vida'
  ]
};

/**
 * Normalizar texto para análise
 */
function normalizarTexto(texto) {
  if (!texto || typeof texto !== 'string') {
    return '';
  }

  return normalizeToLowercase(texto) || '';
}

/**
 * Calcular pontuação de categoria para um texto
 */
function calcularPontuacao(texto, keywords) {
  if (!texto) return 0;

  const textoNormalizado = normalizarTexto(texto);
  if (!textoNormalizado) return 0;

  let pontuacao = 0;

  for (const keyword of keywords) {
    const keywordNormalizado = normalizarTexto(keyword);

    // Contagem exata de palavras
    if (textoNormalizado.includes(keywordNormalizado)) {
      // Palavra completa (não apenas parte de outra palavra)
      const regex = new RegExp(`\\b${keywordNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = textoNormalizado.match(regex);
      if (matches) {
        pontuacao += matches.length;
      }
    }
  }

  return pontuacao;
}

/**
 * Categorizar um tipo de informação baseado nos assuntos
 */
export function categorizarTipoInformacao(especificacaoInformacao, detalhesSolicitacao) {
  const textoCompleto = `${especificacaoInformacao || ''} ${detalhesSolicitacao || ''}`;

  if (!textoCompleto.trim()) {
    return {
      categoria: 'Não Categorizado',
      pontuacao: 0,
      confianca: 0
    };
  }

  let melhorCategoria = 'Não Categorizado';
  let maiorPontuacao = 0;

  // Calcular pontuação para cada categoria
  for (const [categoria, keywords] of Object.entries(CATEGORIAS_KEYWORDS)) {
    const pontuacao = calcularPontuacao(textoCompleto, keywords);

    if (pontuacao > maiorPontuacao) {
      maiorPontuacao = pontuacao;
      melhorCategoria = categoria;
    }
  }

  // Calcular confiança (baseado na pontuação e no número de palavras no texto)
  const palavrasNoTexto = textoCompleto.split(/\s+/).filter(p => p.length > 2).length;
  const confianca = palavrasNoTexto > 0
    ? Math.min(1.0, maiorPontuacao / Math.max(1, palavrasNoTexto / 3))
    : 0;

  return {
    categoria: melhorCategoria,
    pontuacao: maiorPontuacao,
    confianca: Math.round(confianca * 100) / 100
  };
}

/**
 * Categorizar múltiplos registros e agrupar por tipoInformacao
 */
export async function categorizarTiposPorAssunto(registros) {
  const categorizacoes = new Map();

  for (const registro of registros) {
    const tipoInformacao = registro.tipoInformacao || 'Não informado';
    const especificacao = registro.especificacaoInformacao || '';
    const detalhes = registro.detalhesSolicitacao || '';

    const categorizacao = categorizarTipoInformacao(especificacao, detalhes);

    if (!categorizacoes.has(tipoInformacao)) {
      categorizacoes.set(tipoInformacao, {
        tipoInformacao,
        categorias: new Map(),
        totalRegistros: 0,
        exemplos: []
      });
    }

    const info = categorizacoes.get(tipoInformacao);
    info.totalRegistros++;

    // Agrupar por categoria
    const categoria = categorizacao.categoria;
    if (!info.categorias.has(categoria)) {
      info.categorias.set(categoria, {
        categoria,
        count: 0,
        pontuacaoMedia: 0,
        confiancaMedia: 0
      });
    }

    const catInfo = info.categorias.get(categoria);
    catInfo.count++;
    catInfo.pontuacaoMedia = (catInfo.pontuacaoMedia * (catInfo.count - 1) + categorizacao.pontuacao) / catInfo.count;
    catInfo.confiancaMedia = (catInfo.confiancaMedia * (catInfo.count - 1) + categorizacao.confianca) / catInfo.count;

    // Armazenar exemplo (máximo 3 por tipo)
    if (info.exemplos.length < 3 && (especificacao || detalhes)) {
      info.exemplos.push({
        especificacao: especificacao.substring(0, 150),
        detalhes: detalhes.substring(0, 150),
        categoria: categoria
      });
    }
  }

  // Converter para array formatado
  const resultado = [];
  for (const [tipoInformacao, info] of categorizacoes.entries()) {
    const categoriasArray = Array.from(info.categorias.values())
      .map(cat => ({
        ...cat,
        pontuacaoMedia: Math.round(cat.pontuacaoMedia * 100) / 100,
        confiancaMedia: Math.round(cat.confiancaMedia * 100) / 100,
        percentual: Math.round((cat.count / info.totalRegistros) * 100 * 100) / 100
      }))
      .sort((a, b) => b.count - a.count);

    resultado.push({
      tipoInformacao,
      totalRegistros: info.totalRegistros,
      categorias: categoriasArray,
      categoriaPrincipal: categoriasArray[0]?.categoria || 'Não Categorizado',
      exemplos: info.exemplos
    });
  }

  return resultado.sort((a, b) => b.totalRegistros - a.totalRegistros);
}

/**
 * Obter todas as categorias disponíveis
 */
export function obterCategoriasDisponiveis() {
  return Object.keys(CATEGORIAS_KEYWORDS);
}

/**
 * Obter palavras-chave de uma categoria
 */
export function obterKeywordsCategoria(categoria) {
  return CATEGORIAS_KEYWORDS[categoria] || [];
}




