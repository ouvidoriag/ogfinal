# 🧪 Scripts de Teste - Sistema Crossfilter

Scripts para testar e validar o sistema de filtros crossfilter em todas as páginas da Ouvidoria.

## 📋 Scripts Disponíveis

### 1. `test-crossfilter.js`
Script principal de testes automatizados.

**Funcionalidades:**
- ✅ Verifica se o helper está carregado
- ✅ Testa disponibilidade do crossfilterOverview
- ✅ Testa disponibilidade do chartCommunication
- ✅ Verifica gráficos com handlers de crossfilter
- ✅ Testa aplicação de filtros
- ✅ Testa limpeza de filtros
- ✅ Testa gráficos em todas as páginas

**Como usar:**
```javascript
// Executar todos os testes
testCrossfilter.runAll();

// Testar um gráfico específico
testCrossfilter.testChart('chartTema');

// Ver resultados
testCrossfilter.results();

// Mostrar resultados formatados
testCrossfilter.showResults();
```

### 2. `test-crossfilter-interactive.js`
Script de testes interativos com simulação de cliques.

**Funcionalidades:**
- 🖱️ Simula cliques em gráficos
- 🖱️ Simula clique direito (limpar filtros)
- 📊 Verifica estado atual dos filtros
- 📋 Lista todos os gráficos disponíveis
- 🧪 Executa teste completo interativo

**Como usar:**
```javascript
// Executar teste completo interativo
testCrossfilterInteractive.run();

// Simular clique em um gráfico
testCrossfilterInteractive.click('chartTema', 0, false); // índice 0, sem Ctrl
testCrossfilterInteractive.click('chartTema', 1, true);  // índice 1, com Ctrl

// Simular clique direito (limpar filtros)
testCrossfilterInteractive.rightClick('chartTema');

// Verificar estado dos filtros
testCrossfilterInteractive.checkState();

// Listar gráficos disponíveis
testCrossfilterInteractive.listCharts();
```

## 🚀 Execução Rápida

### No Console do Navegador

1. **Abrir o console** (F12)
2. **Aguardar carregamento** da página
3. **Executar testes:**

```javascript
// Testes automatizados
testCrossfilter.runAll();

// Aguardar 2-3 segundos e ver resultados
setTimeout(() => testCrossfilter.showResults(), 3000);

// Testes interativos
testCrossfilterInteractive.run();
```

### Via URL

Adicione `?test=crossfilter` à URL para auto-executar testes:

```
http://localhost:3000/?test=crossfilter
```

## 📊 Interpretação dos Resultados

### ✅ Teste Passou
- Sistema funcionando corretamente
- Nenhuma ação necessária

### ❌ Teste Falhou
- Problema detectado
- Verificar console para detalhes
- Verificar se gráfico foi renderizado

### ⚠️ Aviso
- Situação não crítica
- Pode ser comportamento esperado (ex: gráfico não renderizado ainda)

## 🔍 Exemplos de Uso

### Exemplo 1: Testar Página Específica

```javascript
// 1. Navegar para a página
// (via interface ou mudando URL)

// 2. Aguardar carregamento
setTimeout(() => {
  // 3. Testar gráficos da página
  testCrossfilter.testChart('chartTema');
  testCrossfilter.testChart('chartStatusTema');
  testCrossfilter.testChart('chartTemaMes');
}, 2000);
```

### Exemplo 2: Testar Aplicação de Filtro

```javascript
// 1. Verificar estado inicial
testCrossfilterInteractive.checkState();

// 2. Simular clique no gráfico
testCrossfilterInteractive.click('chartTema', 0, false);

// 3. Aguardar e verificar novo estado
setTimeout(() => {
  testCrossfilterInteractive.checkState();
}, 500);
```

### Exemplo 3: Testar Seleção Múltipla

```javascript
// 1. Primeiro clique (sem Ctrl)
testCrossfilterInteractive.click('chartTema', 0, false);

// 2. Segundo clique (com Ctrl) - adiciona ao filtro
setTimeout(() => {
  testCrossfilterInteractive.click('chartTema', 1, true);
  
  // 3. Verificar se ambos estão no filtro
  setTimeout(() => {
    testCrossfilterInteractive.checkState();
  }, 500);
}, 500);
```

### Exemplo 4: Testar Limpeza de Filtros

```javascript
// 1. Aplicar alguns filtros
testCrossfilterInteractive.click('chartTema', 0, false);
testCrossfilterInteractive.click('chartStatusTema', 1, false);

// 2. Verificar filtros aplicados
setTimeout(() => {
  testCrossfilterInteractive.checkState();
  
  // 3. Limpar filtros (clique direito)
  testCrossfilterInteractive.rightClick('chartTema');
  
  // 4. Verificar se foram limpos
  setTimeout(() => {
    testCrossfilterInteractive.checkState();
  }, 500);
}, 1000);
```

## 📝 Checklist de Testes

Antes de considerar o sistema completo, verificar:

- [ ] Helper `addCrossfilterToChart` está carregado
- [ ] `crossfilterOverview` funciona na página Overview
- [ ] `chartCommunication` funciona nas outras páginas
- [ ] Gráficos têm handlers de clique
- [ ] Gráficos têm cursor pointer
- [ ] Clique direito limpa filtros
- [ ] Seleção múltipla funciona (Ctrl+clique)
- [ ] Filtros são aplicados corretamente
- [ ] Filtros são limpos corretamente
- [ ] Todos os gráficos das páginas têm crossfilter

## 🐛 Troubleshooting

### Gráfico não encontrado
- **Causa:** Gráfico ainda não foi renderizado
- **Solução:** Aguardar carregamento da página ou navegar para a página específica

### Handler não funciona
- **Causa:** Helper não foi aplicado ao gráfico
- **Solução:** Verificar se `addCrossfilterToChart` foi chamado após criar o gráfico

### Filtros não são aplicados
- **Causa:** Sistema de filtros não está disponível
- **Solução:** Verificar se `crossfilterOverview` ou `chartCommunication` está carregado

## 📚 Referências

- Helper: `/scripts/utils/crossfilter-helper.js`
- Crossfilter Overview: `/scripts/core/crossfilter-overview.js`
- Chart Communication: `/scripts/core/chart-communication.js`

---

**CÉREBRO X-3**  
Data: 18/12/2025

