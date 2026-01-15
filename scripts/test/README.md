# Scripts de Teste - APIs, KPIs e Filtros

Este diretório contém scripts de teste completos para validar 100% das funcionalidades do sistema.

## 📋 Scripts Disponíveis

### 1. `test-all-apis.js` - Teste Completo de Todas as APIs

Testa todas as APIs principais do sistema:
- ✅ Conectividade do servidor
- ✅ GET /api/dashboard-data
- ✅ GET /api/summary
- ✅ POST /api/filter/aggregated (sem filtros)
- ✅ POST /api/filter/aggregated (com filtros)
- ✅ POST /api/filter
- ✅ GET /api/records
- ✅ Performance e comparações

**Execução:**
```bash
npm run test:apis
# ou
node scripts/test/test-all-apis.js
```

**Variáveis de ambiente:**
```bash
API_URL=http://localhost:3000 node scripts/test/test-all-apis.js
```

---

### 2. `test-kpis.js` - Teste Específico de KPIs

Testa todos os KPIs e métricas:
- ✅ Total de manifestações
- ✅ Últimos 7 e 30 dias
- ✅ Agregações por status, tema, órgão, tipo, canal, prioridade
- ✅ Dados mensais e diários
- ✅ Consistência entre endpoints

**Execução:**
```bash
npm run test:kpis
# ou
node scripts/test/test-kpis.js
```

---

### 3. `test-filters.js` - Teste de Filtros Crossfilter

Testa todos os tipos de filtros:
- ✅ Filtros simples (Status, Canal, Tipo, etc.)
- ✅ Filtros múltiplos simultâneos
- ✅ Filtros com operadores diferentes (eq, contains)
- ✅ Comparação entre /api/filter e /api/filter/aggregated
- ✅ Validação de estrutura de dados

**Execução:**
```bash
npm run test:filters
# ou
node scripts/test/test-filters.js
```

---

### 4. Executar Todos os Testes

Para executar todos os testes em sequência:

```bash
npm run test:all-endpoints
```

Isso executará:
1. `test-all-apis.js`
2. `test-kpis.js`
3. `test-filters.js`

---

## 🔧 Requisitos

### Dependências

Os scripts usam `node-fetch` para fazer requisições HTTP. Certifique-se de que está instalado:

```bash
npm install node-fetch
```

### Servidor

O servidor deve estar rodando antes de executar os testes:

```bash
npm start
# ou
npm run dev
```

---

## 📊 Saída dos Testes

Os testes exibem:
- ✅ **Verde**: Teste passou
- ❌ **Vermelho**: Teste falhou
- ⚠️ **Amarelo**: Aviso (teste passou mas com ressalvas)
- ⏱️ Tempo de execução de cada teste
- 📊 Resumo final com estatísticas

### Exemplo de Saída

```
╔════════════════════════════════════════════════════════════╗
║  TESTE COMPLETO - APIs, KPIs e FILTROS                    ║
╚════════════════════════════════════════════════════════════╝

Base URL: http://localhost:3000

▶ Conectividade do servidor
✓ PASSED Servidor respondendo
  ⏱️  45ms

▶ GET /api/dashboard-data - Estrutura completa
✓ PASSED Total: 15266, Status: 8
  ⏱️  234ms

...

╔════════════════════════════════════════════════════════════╗
║  RESUMO DOS TESTES                                         ║
╚════════════════════════════════════════════════════════════╝

Total de testes: 10
✓ Passou: 10
✗ Falhou: 0
⏱️  Tempo total: 1234ms

✅ Todos os testes passaram!
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module 'node-fetch'"

**Solução:**
```bash
npm install node-fetch
```

### Erro: "Network Error" ou "ECONNREFUSED"

**Solução:**
1. Verifique se o servidor está rodando
2. Verifique se a URL está correta (variável `API_URL`)
3. Verifique se a porta está correta (padrão: 3000)

### Erro: "Timeout"

**Solução:**
- Aumente o timeout no script (variável `TEST_TIMEOUT`)
- Verifique a performance do servidor
- Verifique se há queries lentas no banco

### Testes falhando com "HTTP 500"

**Solução:**
1. Verifique os logs do servidor
2. Verifique a conexão com o banco de dados
3. Verifique se há dados no banco

---

## 📝 Estrutura dos Testes

Cada script segue a mesma estrutura:

1. **Setup**: Configuração inicial (URL, cores, etc.)
2. **Funções auxiliares**: `makeRequest()`, validadores, etc.
3. **Testes**: Array de funções de teste
4. **Execução**: Loop que executa todos os testes
5. **Resumo**: Estatísticas finais

---

## 🔍 Validações Realizadas

### Estrutura de Dados

Todos os testes validam:
- ✅ Presença de campos obrigatórios
- ✅ Tipos corretos (number, array, object)
- ✅ Estrutura de arrays de agregação
- ✅ Consistência entre endpoints

### Funcionalidade

- ✅ Filtros aplicados corretamente
- ✅ Agregações corretas
- ✅ Performance aceitável
- ✅ Tratamento de erros

---

## 📈 Melhorias Futuras

- [ ] Testes de carga (stress testing)
- [ ] Testes de integração com banco real
- [ ] Testes de regressão automatizados
- [ ] Coverage de código
- [ ] Testes de segurança

---

**Última atualização:** 2025-01-XX  
**Versão:** 1.0

