/**
 * Helper de Processamento de Linguagem Natural (NLP)
 * Sistema avançado de análise de texto, palavras-chave, intenções e entidades
 * 
 * REFATORAÇÃO: Sistema de NLP para CORA
 * Data: 12/12/2025
 * CÉREBRO X-3
 * 
 * VERSÃO MELHORADA:
 * - Detecção de secretarias e bairros reais
 * - Sinônimos expandidos (15+ secretarias, 100+ bairros)
 * - Intenções múltiplas e complexas
 * - Prompt system adaptativo
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Cache de dados de secretarias e bairros
let SECRETARIAS_DATA = null;
let BAIRROS_DATA = null;
let SECRETARIAS_NOMES = [];
let BAIRROS_NOMES = [];

/**
 * Carregar dados de secretarias e bairros (lazy loading)
 */
function carregarDadosGeograficos() {
  if (SECRETARIAS_DATA !== null) return; // Já carregado
  
  try {
    const secretariasPath = join(process.cwd(), 'data', 'secretarias-distritos.json');
    
    if (existsSync(secretariasPath)) {
      SECRETARIAS_DATA = JSON.parse(readFileSync(secretariasPath, 'utf8'));
      
      // Extrair nomes de secretarias
      if (SECRETARIAS_DATA.secretarias) {
        SECRETARIAS_NOMES = SECRETARIAS_DATA.secretarias.map(s => s.name);
        // Adicionar variações (sem "Secretaria Municipal de")
        SECRETARIAS_DATA.secretarias.forEach(s => {
          const nomeSimples = s.name.replace(/^Secretaria Municipal de /i, '');
          if (!SECRETARIAS_NOMES.includes(nomeSimples)) {
            SECRETARIAS_NOMES.push(nomeSimples);
          }
        });
      }
      
      // Extrair todos os bairros
      BAIRROS_DATA = [];
      BAIRROS_NOMES = [];
      if (SECRETARIAS_DATA.distritos) {
        Object.values(SECRETARIAS_DATA.distritos).forEach(distrito => {
          if (distrito.bairros) {
            BAIRROS_DATA.push(...distrito.bairros);
            BAIRROS_NOMES.push(...distrito.bairros.map(b => normalizarTexto(b)));
          }
        });
      }
    }
  } catch (e) {
    // Se não conseguir carregar, usar dados padrão
    console.warn('⚠️ Não foi possível carregar dados de secretarias/bairros:', e.message);
  }
}

/**
 * Mapeamento de sinônimos e variações (EXPANDIDO)
 */
const SINONIMOS = {
  // Temas/Secretarias (EXPANDIDO com dados reais)
  saude: ['saúde', 'saude', 'hospital', 'posto', 'médico', 'medico', 'medicina', 'unidade básica', 'ubs', 'upa', 'clínica', 'clinica', 'vacinação', 'vacinacao', 'farmácia', 'farmacia'],
  educacao: ['educação', 'educacao', 'escola', 'ensino', 'professor', 'aluno', 'matrícula', 'matricula', 'merenda', 'transporte escolar'],
  zeladoria: ['zeladoria', 'limpeza', 'coleta', 'lixo', 'resíduo', 'residuo', 'limpeza urbana', 'varrição', 'varricao', 'catação', 'catacao'],
  transporte: ['transporte', 'ônibus', 'onibus', 'passagem', 'tarifa', 'linha', 'sinalização', 'sinalizacao', 'semáforo', 'semaforo', 'trânsito', 'transito'],
  obras: ['obra', 'infraestrutura', 'pavimentação', 'pavimentacao', 'asfalto', 'calçada', 'calcada', 'serviços públicos', 'servicos publicos'],
  assistencia: ['assistência', 'assistencia', 'social', 'bolsa família', 'bolsa familia', 'auxílio', 'auxilio', 'cesta básica', 'cesta basica'],
  fazenda: ['fazenda', 'iptu', 'iss', 'imposto', 'taxa', 'nota fiscal', 'tributo'],
  meioAmbiente: ['meio ambiente', 'meioambiente', 'ambiental', 'licenciamento', 'fiscalização', 'fiscalizacao', 'parque'],
  desenvolvimento: ['desenvolvimento', 'econômico', 'economico', 'alvará', 'alvara', 'licença comercial', 'licenca comercial', 'microcrédito', 'microcredito'],
  cultura: ['cultura', 'turismo', 'evento', 'biblioteca', 'ponto turístico', 'ponto turistico'],
  esporte: ['esporte', 'lazer', 'quadra', 'piscina', 'atividade física', 'atividade fisica', 'competição', 'competicao'],
  habitacao: ['habitação', 'habitacao', 'moradia', 'casa', 'minha casa minha vida', 'regularização', 'regularizacao', 'reforma'],
  agricultura: ['agricultura', 'rural', 'semente', 'fertilizante', 'feira agrícola', 'feira agricola'],
  seguranca: ['segurança', 'seguranca', 'guarda municipal', 'câmera', 'camera', 'patrulhamento', 'emergência', 'emergencia'],
  planejamento: ['planejamento', 'plano diretor', 'zoneamento', 'licença urbanística', 'licenca urbanistica', 'projeto'],
  administracao: ['administração', 'administracao', 'recursos humanos', 'compra', 'contrato', 'licitação', 'licitacao'],
  
  // Secretarias específicas (nomes completos)
  secretariaEducacao: ['secretaria de educação', 'secretaria de educacao', 'smed', 'educação municipal', 'educacao municipal'],
  secretariaSaude: ['secretaria de saúde', 'secretaria de saude', 'sms', 'saúde municipal', 'saude municipal'],
  secretariaObras: ['secretaria de obras', 'secretaria obras e serviços públicos', 'secretaria obras e servicos publicos'],
  secretariaAssistencia: ['secretaria de assistência', 'secretaria de assistencia', 'secretaria assistência social', 'secretaria assistencia social'],
  secretariaFazenda: ['secretaria de fazenda', 'secretaria fazenda'],
  secretariaMeioAmbiente: ['secretaria de meio ambiente', 'secretaria meio ambiente'],
  secretariaDesenvolvimento: ['secretaria de desenvolvimento', 'secretaria desenvolvimento econômico', 'secretaria desenvolvimento economico'],
  secretariaCultura: ['secretaria de cultura', 'secretaria cultura e turismo'],
  secretariaEsporte: ['secretaria de esporte', 'secretaria esporte e lazer'],
  secretariaHabitacao: ['secretaria de habitação', 'secretaria de habitacao'],
  secretariaTransporte: ['secretaria de transporte', 'secretaria transporte'],
  secretariaAgricultura: ['secretaria de agricultura', 'secretaria agricultura'],
  secretariaSeguranca: ['secretaria de segurança', 'secretaria de seguranca'],
  secretariaPlanejamento: ['secretaria de planejamento', 'secretaria planejamento'],
  secretariaAdministracao: ['secretaria de administração', 'secretaria de administracao'],
  
  // Status
  concluido: ['concluído', 'concluido', 'resolvido', 'finalizado', 'encerrado', 'atendido'],
  emAndamento: ['em andamento', 'andamento', 'processando', 'pendente', 'em análise', 'analise'],
  aberto: ['aberto', 'novo', 'recebido', 'cadastrado'],
  vencido: ['vencido', 'atrasado', 'excedido', 'fora do prazo', 'prazo expirado'],
  
  // Tipos
  reclamacao: ['reclamação', 'reclamacao', 'denúncia', 'denuncia', 'problema', 'erro'],
  elogio: ['elogio', 'parabéns', 'parabens', 'agradecimento', 'gratidão', 'gratidao'],
  sugestao: ['sugestão', 'sugestao', 'proposta', 'ideia', 'melhoria'],
  
  // Períodos
  hoje: ['hoje', 'no dia de hoje'],
  ontem: ['ontem', 'no dia anterior'],
  semana: ['semana', 'semanal'],
  mes: ['mês', 'mes', 'mensal', 'mensalmente'],
  ano: ['ano', 'anual', 'anualmente'],
  ultimaSemana: ['última semana', 'ultima semana', 'semana passada', 'na semana anterior'],
  esteMes: ['este mês', 'este mes', 'no mês atual', 'mes atual', 'mês corrente', 'mes corrente'],
  mesAnterior: ['mês anterior', 'mes anterior', 'último mês', 'ultimo mes', 'mês passado', 'mes passado'],
  anoAnterior: ['ano anterior', 'ano passado', 'último ano', 'ultimo ano', 'ano corrente'],
  
  // Intenções (EXPANDIDO)
  contar: ['quantos', 'quantas', 'qual o total', 'qual a quantidade', 'soma', 'contagem', 'total', 'há', 'ha', 'existem', 'tem', 'temos', 'têm', 'ten'],
  comparar: ['comparar', 'versus', 'vs', 'diferença', 'diferenca', 'comparação', 'comparacao', 'entre', 'comparado', 'comparado com', 'em relação', 'em relacao', 'relação', 'relacao'],
  ranking: ['top', 'ranking', 'mais', 'maior', 'menor', 'melhor', 'pior', 'principais', 'maiores', 'menores', 'melhores', 'piores', 'primeiros', 'últimos', 'ultimos', 'listar', 'mostrar os'],
  tempo: ['tempo', 'prazo', 'duração', 'duracao', 'sla', 'demora', 'rapidez', 'rápido', 'rapido', 'lento', 'velocidade', 'quanto tempo', 'quanto demora', 'prazo médio', 'prazo medio', 'tempo médio', 'tempo medio', 'tempo de resolução', 'tempo de resolucao', 'tempo de atendimento'],
  media: ['média', 'media', 'mediana', 'moda', 'médio', 'medio', 'média de', 'media de', 'tempo médio', 'tempo medio', 'valor médio', 'valor medio'],
  percentual: ['percentual', 'porcentagem', 'por cento', '%', 'proporção', 'proporcao', 'percentagem', 'percent', 'porcentual de', 'distribuição percentual', 'distribuicao percentual'],
  tendencia: ['tendência', 'tendencia', 'evolução', 'evolucao', 'crescimento', 'queda', 'aumento', 'diminuição', 'diminuicao', 'tendência de', 'tendencia de', 'como está evoluindo', 'como esta evoluindo', 'está aumentando', 'esta aumentando', 'está diminuindo', 'esta diminuindo', 'gráfico', 'grafico', 'série temporal', 'serie temporal'],
  distribuicao: ['distribuição', 'distribuicao', 'divisão', 'divisao', 'separação', 'separacao', 'como está distribuído', 'como esta distribuido', 'distribuição por', 'distribuicao por', 'divisão por', 'divisao por'],
  detalhar: ['detalhar', 'detalhes', 'mais informações', 'mais informacoes', 'explicar', 'como funciona', 'o que é', 'o que e', 'entender melhor', 'entender'],
  listar: ['listar', 'mostrar', 'exibir', 'quais são', 'quais sao', 'quais os', 'quais as', 'enumere', 'liste'],
  buscar: ['buscar', 'encontrar', 'localizar', 'procurar', 'achar', 'pesquisar'],
  agrupar: ['agrupar', 'agrupamento', 'por', 'separado por', 'organizado por', 'organizado por'],
  
  // Localização
  bairro: ['bairro', 'localização', 'localizacao', 'região', 'regiao', 'zona', 'área', 'area', 'distrito'],
  endereco: ['endereço', 'endereco', 'rua', 'avenida', 'logradouro', 'local'],
};

/**
 * Normalizar texto para comparação
 */
export function normalizarTexto(texto) {
  if (!texto) return '';
  
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

/**
 * Detectar sinônimos em texto
 */
export function detectarSinonimos(texto, categoria) {
  const textoNormalizado = normalizarTexto(texto);
  const sinonimos = SINONIMOS[categoria] || [];
  
  for (const sinonimo of sinonimos) {
    const sinonimoNormalizado = normalizarTexto(sinonimo);
    if (textoNormalizado.includes(sinonimoNormalizado)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extrair entidades do texto (secretarias, temas, bairros, etc.)
 */
export function extrairEntidades(texto) {
  const textoNormalizado = normalizarTexto(texto);
  const entidades = {
    temas: [],
    secretarias: [],
    bairros: [],
    status: [],
    tipos: [],
    periodos: [],
    intencoes: []
  };
  
  // Carregar dados geográficos se necessário
  carregarDadosGeograficos();
  
  // Detectar temas/secretarias genéricos
  Object.keys(SINONIMOS).forEach(chave => {
    if (['saude', 'educacao', 'zeladoria', 'transporte', 'obras', 'iluminacao', 'esgoto', 'agua', 
         'assistencia', 'fazenda', 'meioAmbiente', 'desenvolvimento', 'cultura', 'esporte', 
         'habitacao', 'agricultura', 'seguranca', 'planejamento', 'administracao'].includes(chave)) {
      if (detectarSinonimos(textoNormalizado, chave)) {
        entidades.temas.push(chave);
      }
    }
  });
  
  // Detectar secretarias específicas por nome
  if (SECRETARIAS_NOMES.length > 0) {
    SECRETARIAS_NOMES.forEach(nomeSecretaria => {
      const nomeNormalizado = normalizarTexto(nomeSecretaria);
      if (textoNormalizado.includes(nomeNormalizado)) {
        entidades.secretarias.push(nomeSecretaria);
      }
    });
  }
  
  // Detectar bairros específicos
  if (BAIRROS_NOMES.length > 0) {
    BAIRROS_NOMES.forEach((bairroNormalizado, index) => {
      if (textoNormalizado.includes(bairroNormalizado)) {
        entidades.bairros.push(BAIRROS_DATA[index]);
      }
    });
  }
  
  // Detectar status
  if (detectarSinonimos(textoNormalizado, 'concluido')) entidades.status.push('concluído');
  if (detectarSinonimos(textoNormalizado, 'emAndamento')) entidades.status.push('em andamento');
  if (detectarSinonimos(textoNormalizado, 'aberto')) entidades.status.push('aberto');
  if (detectarSinonimos(textoNormalizado, 'vencido')) entidades.status.push('vencido');
  
  // Detectar tipos
  if (detectarSinonimos(textoNormalizado, 'reclamacao')) entidades.tipos.push('reclamação');
  if (detectarSinonimos(textoNormalizado, 'elogio')) entidades.tipos.push('elogio');
  if (detectarSinonimos(textoNormalizado, 'sugestao')) entidades.tipos.push('sugestão');
  
  // Detectar intenções (todas as novas)
  const intencoesMap = {
    'contar': 'contar',
    'comparar': 'comparar',
    'ranking': 'ranking',
    'tempo': 'tempo',
    'media': 'média',
    'percentual': 'percentual',
    'tendencia': 'tendência',
    'distribuicao': 'distribuição',
    'detalhar': 'detalhar',
    'listar': 'listar',
    'buscar': 'buscar',
    'agrupar': 'agrupar'
  };
  
  Object.keys(intencoesMap).forEach(chave => {
    if (detectarSinonimos(textoNormalizado, chave)) {
      entidades.intencoes.push(intencoesMap[chave]);
    }
  });
  
  return entidades;
}

/**
 * Detectar período mencionado (versão avançada)
 */
export function detectarPeriodoAvancado(texto) {
  const textoNormalizado = normalizarTexto(texto);
  const hoje = new Date();
  const resultado = {
    tipo: 'relativo', // 'especifico', 'relativo'
    meses: 6,
    startDate: null,
    endDate: null,
    descricao: ''
  };
  
  // Detectar datas específicas
  // Formato: DD/MM/YYYY ou DD-MM-YYYY
  const dataEspecifica = textoNormalizado.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dataEspecifica) {
    const [, dia, mes, ano] = dataEspecifica;
    resultado.tipo = 'especifico';
    resultado.startDate = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    resultado.endDate = resultado.startDate;
    resultado.descricao = `${dia}/${mes}/${ano}`;
    return resultado;
  }
  
  // Detectar "hoje"
  if (detectarSinonimos(textoNormalizado, 'hoje')) {
    const hojeStr = hoje.toISOString().split('T')[0];
    resultado.tipo = 'especifico';
    resultado.startDate = hojeStr;
    resultado.endDate = hojeStr;
    resultado.meses = 0;
    resultado.descricao = 'hoje';
    return resultado;
  }
  
  // Detectar "ontem"
  if (detectarSinonimos(textoNormalizado, 'ontem')) {
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split('T')[0];
    resultado.tipo = 'especifico';
    resultado.startDate = ontemStr;
    resultado.endDate = ontemStr;
    resultado.meses = 0;
    resultado.descricao = 'ontem';
    return resultado;
  }
  
  // Detectar "última semana"
  if (detectarSinonimos(textoNormalizado, 'ultimaSemana')) {
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - 7);
    const fimSemana = new Date(hoje);
    resultado.tipo = 'especifico';
    resultado.startDate = inicioSemana.toISOString().split('T')[0];
    resultado.endDate = fimSemana.toISOString().split('T')[0];
    resultado.meses = 0;
    resultado.descricao = 'última semana';
    return resultado;
  }
  
  // Detectar "este mês"
  if (detectarSinonimos(textoNormalizado, 'esteMes')) {
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    resultado.tipo = 'especifico';
    resultado.startDate = inicioMes.toISOString().split('T')[0];
    resultado.endDate = fimMes.toISOString().split('T')[0];
    resultado.meses = 1;
    resultado.descricao = 'este mês';
    return resultado;
  }
  
  // Detectar "mês anterior"
  if (detectarSinonimos(textoNormalizado, 'mesAnterior')) {
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    resultado.tipo = 'especifico';
    resultado.startDate = mesAnterior.toISOString().split('T')[0];
    resultado.endDate = fimMesAnterior.toISOString().split('T')[0];
    resultado.meses = 1;
    resultado.descricao = 'mês anterior';
    return resultado;
  }
  
  // Detectar meses específicos por nome
  const mesesMap = {
    'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6,
    'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
  };
  
  for (const [mesNome, mesNum] of Object.entries(mesesMap)) {
    if (textoNormalizado.includes(mesNome)) {
      // Tentar detectar ano
      const anoMatch = textoNormalizado.match(/(\d{4})/);
      const ano = anoMatch ? parseInt(anoMatch[1]) : hoje.getFullYear();
      
      const inicioMes = new Date(ano, mesNum - 1, 1);
      const fimMes = new Date(ano, mesNum, 0);
      resultado.tipo = 'especifico';
      resultado.startDate = inicioMes.toISOString().split('T')[0];
      resultado.endDate = fimMes.toISOString().split('T')[0];
      resultado.meses = 1;
      resultado.descricao = `${mesNome} de ${ano}`;
      return resultado;
    }
  }
  
  // Detectar quantidade de dias
  const diasMatch = textoNormalizado.match(/(\d+)\s*(dias?|dia)/);
  if (diasMatch) {
    const dias = parseInt(diasMatch[1]);
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - dias);
    resultado.tipo = 'especifico';
    resultado.startDate = inicio.toISOString().split('T')[0];
    resultado.endDate = hoje.toISOString().split('T')[0];
    resultado.meses = Math.ceil(dias / 30);
    resultado.descricao = `últimos ${dias} dias`;
    return resultado;
  }
  
  // Detectar quantidade de meses
  const mesesMatch = textoNormalizado.match(/(\d+)\s*(meses?|mês|m)/);
  if (mesesMatch) {
    const meses = parseInt(mesesMatch[1]);
    const inicio = new Date(hoje);
    inicio.setMonth(hoje.getMonth() - meses);
    resultado.tipo = 'especifico';
    resultado.startDate = inicio.toISOString().split('T')[0];
    resultado.endDate = hoje.toISOString().split('T')[0];
    resultado.meses = meses;
    resultado.descricao = `últimos ${meses} meses`;
    return resultado;
  }
  
  // Detectar ano específico
  const anoMatch = textoNormalizado.match(/(\d{4})/);
  if (anoMatch) {
    const ano = parseInt(anoMatch[1]);
    resultado.tipo = 'especifico';
    resultado.startDate = `${ano}-01-01`;
    resultado.endDate = `${ano}-12-31`;
    resultado.meses = 12;
    resultado.descricao = `ano ${ano}`;
    return resultado;
  }
  
  // Detectar "último ano"
  if (textoNormalizado.includes('ultimo ano') || textoNormalizado.includes('último ano') || textoNormalizado.includes('ano passado')) {
    const anoAnterior = hoje.getFullYear() - 1;
    resultado.tipo = 'especifico';
    resultado.startDate = `${anoAnterior}-01-01`;
    resultado.endDate = `${anoAnterior}-12-31`;
    resultado.meses = 12;
    resultado.descricao = `ano ${anoAnterior}`;
    return resultado;
  }
  
  // Padrão: últimos 6 meses
  return resultado;
}

/**
 * Detectar intenção principal da pergunta
 */
export function detectarIntencao(texto) {
  const textoNormalizado = normalizarTexto(texto);
  const entidades = extrairEntidades(texto);
  
  // Detectar múltiplas intenções (perguntas complexas)
  const intencoesDetectadas = entidades.intencoes || [];
  
  // 1. Comparação (alta prioridade)
  if (intencoesDetectadas.includes('comparar') || 
      textoNormalizado.match(/(compar|versus|vs|diferença|diferenca|entre)/)) {
    return {
      tipo: 'comparar',
      confianca: 0.95,
      detalhes: entidades,
      secundarias: intencoesDetectadas.filter(i => i !== 'comparar')
    };
  }
  
  // 2. Tendência/Evolução (alta prioridade)
  if (intencoesDetectadas.includes('tendência') || 
      textoNormalizado.match(/(tendência|tendencia|evolução|evolucao|crescimento|queda|aumento|diminuição|diminuicao|gráfico|grafico|série temporal|serie temporal)/)) {
    return {
      tipo: 'tendencia',
      confianca: 0.9,
      detalhes: entidades,
      secundarias: intencoesDetectadas.filter(i => i !== 'tendência')
    };
  }
  
  // 3. Ranking/Top (alta prioridade)
  if (intencoesDetectadas.includes('ranking') || 
      textoNormalizado.match(/(top|ranking|mais|maior|menor|melhor|pior|principais|primeiros|últimos|ultimos)/)) {
    const numero = extrairNumero(texto);
    return {
      tipo: 'ranking',
      confianca: 0.9,
      detalhes: entidades,
      numero: numero,
      secundarias: intencoesDetectadas.filter(i => i !== 'ranking')
    };
  }
  
  // 4. Tempo/Prazo (alta prioridade)
  if (intencoesDetectadas.includes('tempo') || 
      textoNormalizado.match(/(tempo|prazo|duração|duracao|sla|demora|quanto tempo|quanto demora|tempo médio|tempo medio)/)) {
    return {
      tipo: 'tempo',
      confianca: 0.85,
      detalhes: entidades,
      secundarias: intencoesDetectadas.filter(i => i !== 'tempo')
    };
  }
  
  // 5. Média (média prioridade)
  if (intencoesDetectadas.includes('média') || 
      textoNormalizado.match(/(média|media|mediana|moda|médio|medio)/)) {
    return {
      tipo: 'media',
      confianca: 0.85,
      detalhes: entidades,
      secundarias: intencoesDetectadas.filter(i => i !== 'média')
    };
  }
  
  // 6. Distribuição/Percentual (média prioridade)
  if (intencoesDetectadas.includes('percentual') || 
      intencoesDetectadas.includes('distribuição') ||
      textoNormalizado.match(/(percentual|porcentagem|por cento|%|proporção|proporcao|distribuição|distribuicao)/)) {
    return {
      tipo: 'distribuicao',
      confianca: 0.8,
      detalhes: entidades,
      secundarias: intencoesDetectadas.filter(i => !['percentual', 'distribuição'].includes(i))
    };
  }
  
  // 7. Contar/Total (alta prioridade se mencionado explicitamente)
  if (intencoesDetectadas.includes('contar') || 
      textoNormalizado.match(/(quant[ao]s?|qual o total|qual a quantidade|soma|contagem|total|há|ha|existem|tem|temos)/)) {
    return {
      tipo: 'contar',
      confianca: 0.9,
      detalhes: entidades,
      secundarias: intencoesDetectadas.filter(i => i !== 'contar')
    };
  }
  
  // 8. Listar/Detalhar (baixa prioridade)
  if (intencoesDetectadas.includes('listar') || intencoesDetectadas.includes('detalhar')) {
    return {
      tipo: intencoesDetectadas.includes('listar') ? 'listar' : 'detalhar',
      confianca: 0.7,
      detalhes: entidades,
      secundarias: intencoesDetectadas.filter(i => !['listar', 'detalhar'].includes(i))
    };
  }
  
  // Intenção padrão: informação geral
  return {
    tipo: 'informacao',
    confianca: 0.5,
    detalhes: entidades,
    secundarias: intencoesDetectadas
  };
}

/**
 * Extrair número de uma pergunta (ex: "top 5", "10 bairros")
 */
export function extrairNumero(texto) {
  const match = texto.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extrair palavras-chave relevantes do texto
 */
export function extrairPalavrasChave(texto, contextoHistorico = '') {
  const textoCompleto = normalizarTexto(contextoHistorico + ' ' + texto);
  const entidades = extrairEntidades(textoCompleto);
  const periodo = detectarPeriodoAvancado(textoCompleto);
  const intencao = detectarIntencao(textoCompleto);
  const numero = extrairNumero(textoCompleto);
  
  return {
    entidades,
    periodo,
    intencao,
    numero,
    textoOriginal: texto,
    textoNormalizado: textoCompleto
  };
}

/**
 * Melhorar busca de dados baseada em palavras-chave
 */
export function gerarFiltrosMongo(palavrasChave) {
  const filtros = {};
  
  // Filtrar por tema/secretaria
  if (palavrasChave.entidades.temas.length > 0) {
    // Mapear temas para campos do banco
    const tema = palavrasChave.entidades.temas[0];
    if (tema === 'saude') {
      filtros.$or = [
        { tema: { $regex: 'saúde|saude', $options: 'i' } },
        { orgaos: { $regex: 'saúde|saude', $options: 'i' } }
      ];
    } else if (tema === 'educacao') {
      filtros.$or = [
        { tema: { $regex: 'educação|educacao', $options: 'i' } },
        { orgaos: { $regex: 'educação|educacao', $options: 'i' } }
      ];
    }
    // Adicionar mais mapeamentos conforme necessário
  }
  
  // Filtrar por status
  if (palavrasChave.entidades.status.length > 0) {
    filtros.status = { $in: palavrasChave.entidades.status };
  }
  
  // Filtrar por tipo
  if (palavrasChave.entidades.tipos.length > 0) {
    filtros.tipoDeManifestacao = { $in: palavrasChave.entidades.tipos };
  }
  
  // Filtrar por período
  if (palavrasChave.periodo.startDate && palavrasChave.periodo.endDate) {
    filtros.dataCriacaoIso = {
      $gte: palavrasChave.periodo.startDate,
      $lte: palavrasChave.periodo.endDate
    };
  }
  
  return filtros;
}

export default {
  normalizarTexto,
  detectarSinonimos,
  extrairEntidades,
  detectarPeriodoAvancado,
  detectarIntencao,
  extrairNumero,
  extrairPalavrasChave,
  gerarFiltrosMongo
};

