/**
 * Mapeamento Global de Campos
 * Centraliza o mapeamento de campos para evitar duplicação
 * Usado por todos os endpoints de agregação
 */

/**
 * Mapeamento de campos da API para colunas normalizadas do banco
 */
export const FIELD_MAP = {
  // Campos principais
  'Status': 'status',
  'Tipo': 'tipoDeManifestacao',
  'Tema': 'tema',
  'Categoria': 'tema',
  'Assunto': 'assunto',
  'Secretaria': 'orgaos',
  'Orgaos': 'orgaos',
  'Orgao': 'orgaos', // Alias adicional
  'UnidadeCadastro': 'unidadeCadastro',
  'Unidade': 'unidadeCadastro', // Alias para compatibilidade
  'Setor': 'unidadeCadastro',
  'Bairro': 'endereco',
  'Canal': 'canal',
  'Prioridade': 'prioridade',
  'Responsavel': 'responsavel',
  'Servidor': 'servidor',
  'UAC': 'unidadeCadastro',
  'StatusDemanda': 'statusDemanda',
  'Data': 'dataDaCriacao',
  'UnidadeSaude': 'unidadeSaude',
  'unidadesaude': 'unidadeSaude', // Variante minúscula sem underscore

  // Aliases para compatibilidade
  'TipoManifestacao': 'tipoDeManifestacao',

  // Nomes exatos da planilha (snake_case)
  'protocolo': 'protocolo',
  'data_da_criacao': 'dataDaCriacao',
  'status_demanda': 'statusDemanda',
  'prazo_restante': 'prazoRestante',
  'data_da_conclusao': 'dataDaConclusao',
  'tempo_de_resolucao_em_dias': 'tempoDeResolucaoEmDias',
  'prioridade': 'prioridade',
  'tipo_de_manifestacao': 'tipoDeManifestacao',
  'tema': 'tema',
  'assunto': 'assunto',
  'canal': 'canal',
  'endereco': 'endereco',
  'unidade_cadastro': 'unidadeCadastro',
  'unidade_saude': 'unidadeSaude',
  'status': 'status',
  'servidor': 'servidor',
  'responsavel': 'responsavel',
  'verificado': 'verificado',
  'orgaos': 'orgaos'
};

/**
 * Obter coluna normalizada do banco para um campo da API
 */
export function getNormalizedField(field) {
  if (!field) return null;

  // Tentar encontrar no mapa exato
  if (FIELD_MAP[field]) {
    return FIELD_MAP[field];
  }

  // Tentar lowercase
  const lowerField = field.toLowerCase();
  if (FIELD_MAP[lowerField]) {
    return FIELD_MAP[lowerField];
  }

  // Tentar camelCase (primeira letra maiúscula)
  const camelField = lowerField.charAt(0).toUpperCase() + lowerField.slice(1);
  if (FIELD_MAP[camelField]) {
    return FIELD_MAP[camelField];
  }

  // Se não encontrou, retornar o campo original (pode ser que já esteja normalizado)
  // Mas verificar se é um campo válido do Schema
  const validFields = [
    'protocolo', 'dataDaCriacao', 'statusDemanda', 'prazoRestante',
    'dataDaConclusao', 'tempoDeResolucaoEmDias', 'prioridade',
    'tipoDeManifestacao', 'tema', 'assunto', 'canal', 'endereco',
    'unidadeCadastro', 'unidadeSaude', 'status', 'servidor',
    'responsavel', 'verificado', 'orgaos', 'dataCriacaoIso', 'dataConclusaoIso'
  ];

  // Se o campo já está em camelCase e existe no Schema, retornar como está
  if (validFields.includes(field)) {
    return field;
  }

  // Caso contrário, tentar converter para camelCase
  // Ex: unidadesaude -> unidadeSaude
  if (lowerField.includes('unidade') && lowerField.includes('saude')) {
    return 'unidadeSaude';
  }

  // Fallback: retornar lowercase
  return lowerField;
}

/**
 * Verificar se um campo está normalizado no banco
 */
export function isNormalizedField(field) {
  const normalized = getNormalizedField(field);
  // Lista de campos que existem no Schema
  const validFields = [
    'protocolo', 'dataDaCriacao', 'statusDemanda', 'prazoRestante',
    'dataDaConclusao', 'tempoDeResolucaoEmDias', 'prioridade',
    'tipoDeManifestacao', 'tema', 'assunto', 'canal', 'endereco',
    'unidadeCadastro', 'unidadeSaude', 'status', 'servidor',
    'responsavel', 'verificado', 'orgaos', 'dataCriacaoIso', 'dataConclusaoIso'
  ];

  return validFields.includes(normalized);
}

