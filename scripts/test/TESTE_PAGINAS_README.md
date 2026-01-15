# 🧪 Script de Teste de Páginas e Gráficos

Este script testa automaticamente todas as páginas do dashboard e verifica se os gráficos são renderizados corretamente.

## 📋 Páginas Testadas

### Ouvidoria
- Home
- Visão Geral (Overview)
- Por Órgão e Mês
- Tempo Médio
- Por Tema
- Por Assunto
- Por Cadastrante
- Reclamações e Denúncias
- Projeção 2026
- Secretarias
- Secretarias e Distritos
- Tipos
- Status
- Categoria
- Setor
- Responsáveis
- Canais
- Prioridades
- Bairro
- UAC
- Unidades de Saúde

### Zeladoria
- Home Zeladoria
- Visão Geral
- Por Status
- Por Categoria
- Por Departamento
- Por Bairro
- Por Responsável
- Por Canal
- Tempo de Resolução
- Análise Mensal
- Análise Geográfica

## 🚀 Como Usar

### Método 1: Interface Web (Recomendado)

1. Inicie o servidor:
```bash
npm start
```

2. Abra no navegador:
```
http://localhost:3000/test-pages.html
```

3. Clique em "▶️ Executar Todos os Testes" ou escolha testar apenas Ouvidoria ou Zeladoria

4. Aguarde os testes serem executados e visualize o relatório

### Método 2: Console do Navegador

1. Abra o dashboard principal:
```
http://localhost:3000
```

2. Abra o console do navegador (F12)

3. Execute o script:
```javascript
// Carregar o script
const script = document.createElement('script');
script.src = '/scripts/test-all-pages.js';
document.head.appendChild(script);

// Aguardar carregamento e executar
script.onload = () => {
  window.testAllPages.runAllTests().then(results => {
    console.log('Resultados:', results);
  });
};
```

Ou use a função diretamente se o script já estiver carregado:
```javascript
window.testAllPages.runAllTests({
  skipOuvidoria: false,
  skipZeladoria: false,
  skipUnits: false,
  delayBetweenPages: 1000
}).then(results => {
  console.log('✅ Testes concluídos!', results);
});
```

### Método 3: Testar Página Específica

```javascript
// Testar apenas uma página
window.testAllPages.testPage('main', 'ouvidoria').then(result => {
  console.log('Resultado:', result);
});

// Verificar gráficos em uma página
const charts = window.testAllPages.findChartsInPage('main');
console.log('Gráficos encontrados:', charts);
```

## 📊 O que o Script Verifica

1. **Carregamento de Páginas**
   - Se a página é carregada corretamente
   - Se a página fica visível após o carregamento
   - Tempo de carregamento

2. **Gráficos**
   - Se os elementos `<canvas>` existem
   - Se as instâncias de gráficos (Chart.js) são criadas
   - Se os gráficos têm dados
   - Se os gráficos estão visíveis

3. **Erros**
   - Captura erros JavaScript
   - Verifica erros de carregamento
   - Registra problemas de renderização

## 📈 Relatório

O script gera um relatório completo com:

- **Resumo**: Total de páginas testadas, passou/falhou, taxa de sucesso
- **Gráficos**: Quantidade de gráficos encontrados e com problemas
- **Detalhes**: Lista de páginas que falharam e por quê
- **Tempo**: Tempo total de execução

### Exemplo de Relatório

```
📊 RELATÓRIO DE TESTES
================================================================================

⏱️  Tempo total: 45.32s

✅ Páginas passaram: 28
❌ Páginas falharam: 2
⏭️  Páginas puladas: 0
📈 Taxa de sucesso: 93.33%

📊 Gráficos encontrados: 156
⚠️  Gráficos com problemas: 3

❌ PÁGINAS QUE FALHARAM:
  - projecao-2026 (ouvidoria)
    Erro: Timeout ao carregar dados
  - zeladoria-geografica (zeladoria)
    ⚠️ Gráfico mapChart sem instância
```

## ⚙️ Opções de Configuração

```javascript
await window.testAllPages.runAllTests({
  skipOuvidoria: false,      // Pular páginas da Ouvidoria
  skipZeladoria: false,      // Pular páginas da Zeladoria
  skipUnits: false,          // Pular páginas de unidades de saúde
  delayBetweenPages: 1000    // Delay entre páginas (ms)
});
```

## 🔍 Funções Disponíveis

### `runAllTests(options)`
Executa todos os testes e retorna um objeto com resultados detalhados.

### `testPage(pageId, section)`
Testa uma página específica.

**Parâmetros:**
- `pageId`: ID da página (ex: 'main', 'orgao-mes')
- `section`: 'ouvidoria' ou 'zeladoria'

**Retorna:** Objeto com resultado do teste

### `findChartsInPage(pageId)`
Encontra todos os gráficos em uma página.

**Retorna:** Array de objetos com informações dos gráficos

### `generateReport()`
Gera e exibe o relatório no console.

## 🐛 Troubleshooting

### Script não carrega
- Verifique se o servidor está rodando
- Verifique se o arquivo `/scripts/test-all-pages.js` existe
- Abra o console do navegador para ver erros

### Páginas não carregam
- Verifique se o servidor está respondendo
- Verifique se há erros no console
- Aumente o `delayBetweenPages` se necessário

### Gráficos não são encontrados
- Algumas páginas podem não ter gráficos (isso é normal)
- Verifique se Chart.js está carregado
- Verifique se os elementos canvas existem no HTML

## 📝 Notas

- O script aguarda automaticamente o carregamento de cada página
- Gráficos são verificados após um delay para garantir renderização
- Erros são capturados e reportados no relatório final
- O script pode ser interrompido a qualquer momento (Ctrl+C no console)

## 🔄 Atualizações

Para adicionar novas páginas ao teste, edite o array `ALL_PAGES` em `test-all-pages.js`:

```javascript
const ALL_PAGES = {
  ouvidoria: [
    // ... páginas existentes
    'nova-pagina'  // Adicione aqui
  ],
  zeladoria: [
    // ... páginas existentes
  ]
};
```

