/**
 * Gerador Automático de Documentação da API
 * 
 * Analisa todos os módulos de rotas e gera documentação completa
 * em múltiplos formatos (Markdown, JSON, Swagger/OpenAPI)
 * 
 * Uso:
 *   node scripts/generate-api-docs.js
 *   node scripts/generate-api-docs.js --format json
 *   node scripts/generate-api-docs.js --format swagger
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Analisar arquivo de rotas e extrair endpoints
 */
function analyzeRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const endpoints = [];
  
  // Extrair rotas usando regex
  const routePatterns = [
    /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g,
    /router\.use\(['"]([^'"]+)['"]/g
  ];
  
  routePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const method = match[1]?.toUpperCase() || 'USE';
      const path = match[2] || match[1];
      
      if (path && !path.startsWith('/')) {
        continue; // Ignorar paths relativos
      }
      
      endpoints.push({
        method,
        path: path || '/',
        file: path.basename(filePath)
      });
    }
  });
  
  return endpoints;
}

/**
 * Gerar documentação em Markdown
 */
function generateMarkdown(routes) {
  let md = '# 📚 Documentação Automática da API\n\n';
  md += `**Gerado em**: ${new Date().toLocaleString('pt-BR')}\n\n`;
  md += `**Total de Endpoints**: ${routes.length}\n\n`;
  md += '---\n\n';
  
  // Agrupar por módulo
  const byModule = {};
  routes.forEach(route => {
    if (!byModule[route.module]) {
      byModule[route.module] = [];
    }
    byModule[route.module].push(route);
  });
  
  Object.keys(byModule).sort().forEach(module => {
    md += `## 📦 ${module.toUpperCase()}\n\n`;
    md += `**Arquivo**: \`${byModule[module][0].file}\`\n\n`;
    md += '| Método | Endpoint | Descrição |\n';
    md += '|--------|----------|-----------|\n';
    
    byModule[module].forEach(route => {
      md += `| ${route.method} | \`${route.path}\` | - |\n`;
    });
    
    md += '\n';
  });
  
  return md;
}

/**
 * Gerar documentação em JSON
 */
function generateJSON(routes) {
  const byModule = {};
  routes.forEach(route => {
    if (!byModule[route.module]) {
      byModule[route.module] = {
        file: route.file,
        endpoints: []
      };
    }
    byModule[route.module].endpoints.push({
      method: route.method,
      path: route.path
    });
  });
  
  return JSON.stringify({
    generated: new Date().toISOString(),
    total: routes.length,
    modules: byModule
  }, null, 2);
}

/**
 * Gerar documentação Swagger/OpenAPI
 */
function generateSwagger(routes) {
  const swagger = {
    openapi: '3.0.0',
    info: {
      title: 'Dashboard Ouvidoria API',
      version: '3.0.0',
      description: 'API completa do Dashboard de Ouvidoria - Documentação gerada automaticamente'
    },
    servers: [
      {
        url: '/api',
        description: 'Servidor Principal'
      }
    ],
    paths: {}
  };
  
  routes.forEach(route => {
    const path = route.path.replace(/^\/api/, '') || '/';
    if (!swagger.paths[path]) {
      swagger.paths[path] = {};
    }
    
    const method = route.method.toLowerCase();
    if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
      swagger.paths[path][method] = {
        summary: `${method.toUpperCase()} ${path}`,
        tags: [route.module],
        responses: {
          '200': {
            description: 'Sucesso'
          }
        }
      };
    }
  });
  
  return JSON.stringify(swagger, null, 2);
}

/**
 * Função principal
 */
async function main() {
  const format = process.argv.includes('--format') 
    ? process.argv[process.argv.indexOf('--format') + 1] 
    : 'markdown';
  
  console.log('🔍 Analisando módulos de rotas...\n');
  
  // Encontrar todos os arquivos de rotas
  const routesDir = path.join(projectRoot, 'src/api/routes');
  const files = await readdir(routesDir);
  const routeFiles = files
    .filter(file => file.endsWith('.js') && file !== 'index.js')
    .map(file => path.join(routesDir, file));
  
  const allRoutes = [];
  
  routeFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const moduleName = path.basename(file, '.js');
    const endpoints = analyzeRouteFile(filePath);
    
    endpoints.forEach(endpoint => {
      allRoutes.push({
        ...endpoint,
        module: moduleName
      });
    });
    
    console.log(`  ✅ ${moduleName}: ${endpoints.length} rotas encontradas`);
  });
  
  console.log(`\n📊 Total: ${allRoutes.length} endpoints encontrados\n`);
  
  // Gerar documentação
  let output;
  let extension;
  
  switch (format) {
    case 'json':
      output = generateJSON(allRoutes);
      extension = 'json';
      break;
    case 'swagger':
      output = generateSwagger(allRoutes);
      extension = 'json';
      break;
    default:
      output = generateMarkdown(allRoutes);
      extension = 'md';
  }
  
  // Salvar arquivo
  const outputPath = path.join(projectRoot, `API_DOCS.${extension}`);
  fs.writeFileSync(outputPath, output, 'utf-8');
  
  console.log(`✅ Documentação gerada: ${outputPath}`);
  console.log(`📄 Formato: ${format.toUpperCase()}`);
  console.log(`📊 Endpoints documentados: ${allRoutes.length}`);
}

main().catch(console.error);

