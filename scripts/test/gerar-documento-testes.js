/**
 * 📄 GERADOR DE DOCUMENTO COMPLETO DE TESTES
 * 
 * Este script gera um documento Markdown completo explicando
 * todos os testes, verificações e resultados do sistema.
 * 
 * CÉREBRO X-3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.join(__dirname, '../..');

/**
 * Carregar resultados dos testes
 */
function carregarResultados() {
  const relatorioPath = path.join(BASE_DIR, 'relatorio-testes-completo.json');
  if (fs.existsSync(relatorioPath)) {
    return JSON.parse(fs.readFileSync(relatorioPath, 'utf-8'));
  }
  
  // Tentar carregar do export
  const exportPath = path.join(BASE_DIR, 'test-results-export.json');
  if (fs.existsSync(exportPath)) {
    return JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
  }
  
  return null;
}

/**
 * Formatar data
 */
function formatarData(data) {
  return new Date(data).toLocaleString('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'medium'
  });
}

/**
 * Calcular estatísticas
 */
function calcularEstatisticas(resultados) {
  let total = 0;
  let passou = 0;
  let falhou = 0;
  let pulou = 0;
  
  for (const categoria in resultados.categorias) {
    const cat = resultados.categorias[categoria];
    total += cat.total;
    passou += cat.passou;
    falhou += cat.falhou;
    pulou += cat.pulou;
  }
  
  const taxaSucesso = total > 0 ? ((passou / total) * 100).toFixed(2) : 0;
  const duracao = resultados.fim && resultados.inicio 
    ? ((new Date(resultados.fim) - new Date(resultados.inicio)) / 1000 / 60).toFixed(2)
    : 'N/A';
  
  return { total, passou, falhou, pulou, taxaSucesso, duracao };
}

/**
 * Gerar seção de categoria
 */
function gerarSecaoCategoria(nome, dados) {
  if (dados.total === 0) return '';
  
  const taxa = ((dados.passou / dados.total) * 100).toFixed(1);
  let secao = `\n### ${nome.charAt(0).toUpperCase() + nome.slice(1)}\n\n`;
  secao += `**Estatísticas:**\n`;
  secao += `- Total de Testes: ${dados.total}\n`;
  secao += `- ✅ Passou: ${dados.passou}\n`;
  secao += `- ❌ Falhou: ${dados.falhou}\n`;
  secao += `- ⏭️  Pulou: ${dados.pulou}\n`;
  secao += `- 📈 Taxa de Sucesso: ${taxa}%\n\n`;
  
  if (dados.detalhes && dados.detalhes.length > 0) {
    secao += `**Detalhes dos Testes:**\n\n`;
    
    // Agrupar por status
    const passou = dados.detalhes.filter(d => d.status === 'PASSOU');
    const falhou = dados.detalhes.filter(d => d.status === 'FALHOU');
    const pulou = dados.detalhes.filter(d => d.status === 'PULOU');
    
    if (passou.length > 0) {
      secao += `#### ✅ Testes que Passaram (${passou.length})\n\n`;
      passou.slice(0, 10).forEach(teste => {
        secao += `- **${teste.teste}**\n`;
        if (teste.timestamp) {
          secao += `  - Executado em: ${formatarData(teste.timestamp)}\n`;
        }
      });
      if (passou.length > 10) {
        secao += `\n*... e mais ${passou.length - 10} testes que passaram*\n`;
      }
      secao += `\n`;
    }
    
    if (falhou.length > 0) {
      secao += `#### ❌ Testes que Falharam (${falhou.length})\n\n`;
      falhou.slice(0, 10).forEach(teste => {
        secao += `- **${teste.teste}**\n`;
        if (teste.erro) {
          secao += `  - Erro: ${teste.erro.substring(0, 200)}...\n`;
        }
        if (teste.output) {
          secao += `  - Output: ${teste.output.substring(0, 150)}...\n`;
        }
      });
      if (falhou.length > 10) {
        secao += `\n*... e mais ${falhou.length - 10} testes que falharam*\n`;
      }
      secao += `\n`;
    }
    
    if (pulou.length > 0) {
      secao += `#### ⏭️  Testes Pulados (${pulou.length})\n\n`;
      pulou.slice(0, 5).forEach(teste => {
        secao += `- **${teste.teste}**\n`;
        if (teste.erro) {
          secao += `  - Motivo: ${teste.erro.substring(0, 150)}...\n`;
        }
      });
      if (pulou.length > 5) {
        secao += `\n*... e mais ${pulou.length - 5} testes pulados*\n`;
      }
      secao += `\n`;
    }
  }
  
  return secao;
}

/**
 * Gerar documento completo
 */
function gerarDocumento(resultados) {
  const stats = calcularEstatisticas(resultados);
  
  let doc = `# 📊 RELATÓRIO COMPLETO DE TESTES E VERIFICAÇÕES DO SISTEMA

**Sistema:** Dashboard da Ouvidoria Geral de Duque de Caxias  
**Data de Execução:** ${formatarData(resultados.inicio)}  
**Duração Total:** ${stats.duracao} minutos  
**Versão:** 3.0.0  
**Gerado por:** CÉREBRO X-3

---

## 📈 RESUMO EXECUTIVO

Este documento apresenta um relatório completo de todos os testes, verificações e validações executados no sistema.

### Estatísticas Gerais

- **Total de Testes Executados:** ${stats.total}
- **✅ Testes que Passaram:** ${stats.passou}
- **❌ Testes que Falharam:** ${stats.falhou}
- **⏭️  Testes Pulados:** ${stats.pulou}
- **📈 Taxa de Sucesso Geral:** ${stats.taxaSucesso}%

### Status Geral

`;

  if (stats.taxaSucesso >= 90) {
    doc += `🟢 **EXCELENTE** - Sistema está funcionando corretamente com alta taxa de sucesso.\n\n`;
  } else if (stats.taxaSucesso >= 70) {
    doc += `🟡 **BOM** - Sistema está funcionando, mas há alguns pontos que precisam de atenção.\n\n`;
  } else if (stats.taxaSucesso >= 50) {
    doc += `🟠 **ATENÇÃO** - Sistema tem problemas que precisam ser corrigidos.\n\n`;
  } else {
    doc += `🔴 **CRÍTICO** - Sistema tem muitos problemas que precisam ser corrigidos urgentemente.\n\n`;
  }

  doc += `---

## 📋 CATEGORIAS DE TESTES

Este relatório está organizado por categorias de testes para facilitar a análise:

`;

  // Lista de categorias com descrições
  const categoriasDesc = {
    sintaxe: 'Validação de Sintaxe JavaScript - Verifica se todos os arquivos JavaScript têm sintaxe válida',
    apis: 'Testes de APIs - Testa todos os endpoints da API REST do sistema',
    kpis: 'Testes de KPIs - Valida cálculos de métricas e indicadores-chave',
    filtros: 'Testes de Filtros - Verifica funcionamento do sistema de filtros crossfilter',
    paginas: 'Testes de Páginas - Valida renderização e funcionamento das páginas do dashboard',
    integracao: 'Testes de Integração - Verifica integração entre componentes do sistema',
    dados: 'Verificações de Dados - Valida integridade e consistência dos dados',
    manutencao: 'Verificações de Manutenção - Scripts de verificação e manutenção do sistema',
    conexoes: 'Testes de Conexões - Valida conexões com serviços externos (MongoDB, Google Sheets, Gemini)',
    emails: 'Verificações de Email - Valida sistema de notificações por email'
  };

  for (const [cat, desc] of Object.entries(categoriasDesc)) {
    const dados = resultados.categorias[cat];
    if (dados.total > 0) {
      const taxa = ((dados.passou / dados.total) * 100).toFixed(1);
      doc += `- **${cat.toUpperCase()}**: ${desc} (Taxa: ${taxa}%)\n`;
    }
  }

  doc += `\n---

## 🔍 DETALHAMENTO POR CATEGORIA

`;

  // Gerar seções detalhadas
  for (const [cat, desc] of Object.entries(categoriasDesc)) {
    const dados = resultados.categorias[cat];
    if (dados.total > 0) {
      doc += gerarSecaoCategoria(desc, dados);
      doc += `\n---\n`;
    }
  }

  doc += `\n## 📝 OBSERVAÇÕES IMPORTANTES

`;

  // Adicionar observações baseadas nos resultados
  if (resultados.categorias.apis.pulou > 0) {
    doc += `### ⚠️ Testes de API Pulados\n\n`;
    doc += `Alguns testes de API foram pulados porque o servidor não estava rodando durante a execução.\n`;
    doc += `Para executar esses testes, inicie o servidor com \`npm start\` antes de rodar os testes.\n\n`;
  }

  if (resultados.categorias.conexoes.falhou > 0) {
    doc += `### ⚠️ Problemas de Conexão\n\n`;
    doc += `Alguns testes de conexão falharam. Isso pode indicar:\n`;
    doc += `- Problemas de configuração (credenciais, variáveis de ambiente)\n`;
    doc += `- Serviços externos indisponíveis\n`;
    doc += `- Problemas de rede\n\n`;
  }

  if (resultados.categorias.dados.falhou > 0) {
    doc += `### ⚠️ Problemas de Dados\n\n`;
    doc += `Algumas verificações de dados falharam. Recomenda-se:\n`;
    doc += `- Revisar a integridade dos dados no banco\n`;
    doc += `- Verificar normalizações e validações\n`;
    doc += `- Executar scripts de manutenção se necessário\n\n`;
  }

  doc += `\n## 🚀 PRÓXIMOS PASSOS

### Para Melhorar a Taxa de Sucesso:

`;

  if (resultados.categorias.apis.pulou > 0) {
    doc += `1. **Iniciar Servidor**: Execute \`npm start\` antes de rodar os testes para validar APIs\n`;
  }

  if (resultados.categorias.conexoes.falhou > 0) {
    doc += `2. **Configurar Conexões**: Verifique e configure credenciais para serviços externos\n`;
  }

  if (resultados.categorias.dados.falhou > 0) {
    doc += `3. **Corrigir Dados**: Execute scripts de manutenção para corrigir problemas de dados\n`;
  }

  doc += `4. **Reexecutar Testes**: Após correções, reexecute os testes para validar\n`;
  doc += `5. **Monitorar Continuamente**: Execute testes regularmente para garantir qualidade\n`;

  doc += `\n---

## 📚 INFORMAÇÕES TÉCNICAS

### Como Executar os Testes

\`\`\`bash
# Executar todos os testes
node scripts/test/test-tudo-executar.js

# Executar testes específicos
npm run test:apis      # Testes de API
npm run test:kpis      # Testes de KPIs
npm run test:filters   # Testes de Filtros
npm run test:pages     # Testes de Páginas
npm run test:completo  # Teste completo do sistema
\`\`\`

### Estrutura de Testes

- \`scripts/test/\` - Scripts de teste principais
- \`scripts/maintenance/\` - Scripts de verificação e manutenção
- \`relatorio-testes-completo.json\` - Resultados em JSON
- Este documento - Relatório completo em Markdown

---

## 📅 HISTÓRICO

- **${formatarData(resultados.inicio)}**: Execução completa de todos os testes
- **Duração**: ${stats.duracao} minutos
- **Taxa de Sucesso**: ${stats.taxaSucesso}%

---

**Documento gerado automaticamente pelo CÉREBRO X-3**  
**Sistema de Ouvidoria Geral de Duque de Caxias - Versão 3.0.0**
`;

  return doc;
}

/**
 * Função principal
 */
function main() {
  console.log('📄 Gerando documento completo de testes...\n');
  
  const resultados = carregarResultados();
  
  if (!resultados) {
    console.error('❌ Erro: Não foi possível carregar os resultados dos testes.');
    console.error('   Execute primeiro: node scripts/test/test-tudo-executar.js');
    process.exit(1);
  }
  
  const documento = gerarDocumento(resultados);
  
  const docPath = path.join(BASE_DIR, 'RELATORIO_TESTES_COMPLETO.md');
  fs.writeFileSync(docPath, documento, 'utf-8');
  
  console.log(`✅ Documento gerado com sucesso!`);
  console.log(`📄 Localização: ${docPath}`);
  console.log(`\n📊 Estatísticas:`);
  
  const stats = calcularEstatisticas(resultados);
  console.log(`   - Total: ${stats.total}`);
  console.log(`   - Passou: ${stats.passou}`);
  console.log(`   - Falhou: ${stats.falhou}`);
  console.log(`   - Taxa de Sucesso: ${stats.taxaSucesso}%`);
}

main();

