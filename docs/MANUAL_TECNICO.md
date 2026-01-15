# 📘 Manual Técnico do Sistema (Versão 3.0)

Este documento descreve a arquitetura, processos de build, inicialização e infraestrutura do Dashboard da Ouvidoria Geral.

---

## 1. 🏗️ Estrutura do Projeto
O sistema foi refatorado para operar diretamente na **Raiz**, eliminando a antiga pasta `NOVO`.

| Pasta | Descrição |
|-------|-----------|
| `src/` | Código fonte do Backend (Node.js/Express). |
| `public/` | Frontend (SPA, HTML, CSS, Scripts). |
| `scripts/` | Ferramentas de automação, build, ETL e testes. |
| `config/` | Configurações do servidor e banco de dados. |
| `docs/` | Documentação técnica. |

---

## 2. 🚀 Inicialização Inteligente (`npm start`)
O comando `npm start` foi transformado em uma ferramenta de automação completa via `prestart` hook (`scripts/setup/setup.js`).

### O que acontece quando você roda `npm start`:
1.  **Verificação de Dependências**:
    *   O sistema checa se a pasta `node_modules` existe.
    *   **Se não existir**: Executa `npm install` automaticamente antes de subir o servidor.
2.  **Verificação de Variáveis**:
    *   Confirma se `MONGODB_ATLAS_URL` está definida. Em produção, falha se não estiver.
3.  **Verificação Docker**:
    *   Verifica se o Docker está instalado e rodando.
    *   Exibe um aviso amigável com link de download caso não detecte, mas **continua a execução** em modo nativo.
4.  **Servidor**:
    *   Inicia o `src/server.js` na porta 3000 (padrão).

---

## 3. 📦 Sistema de Build e Deploy

### A. Build Padrão (`npm run build`)
Executa a compilação de assets estáticos:
*   **TypeScript**: Se houver arquivos `.ts`, compila usando `tsconfig.build.json`.
*   **TailwindCSS**: Compila `public/styles/tailwind.css` → `public/styles/tailwind.min.css` (versão otimizada/minificada).

### B. Build para Produção/FTP (`node scripts/build/prepare-prod-bundle.js`)
Cria um arquivo `prod-bundle.zip` pronto para upload manual (FTP/cPanel).
*   **Inclui**: `src`, `public` (compilado), `config`, `scripts`, `package.json`.
*   **Exclui**: `tests`, arquivos de dev, git e logs.

---

## 4. 🐳 Infraestrutura Docker
O projeto é "Cloud Native" ready.

### Arquivos
*   `Dockerfile`: Build Multi-stage otimizado.
    *   Stage 1: Instala dependências de dev, compila assets.
    *   Stage 2: Copia apenas o necessário para produção (Alpine Linux leve).
*   `docker-compose.yml`: Orquestração para rodar o serviço.
    *   Mapeia porta 3000.
    *   Gerencia volumes e rede.

### Status Atual (Windows)
*   Os arquivos de configuração Docker estão **100% funcionais**.
*   **Limitação**: O Docker Desktop precisa de virtualização ativada na BIOS. Se a virtualização estiver desligada, o sistema roda perfeitamente em modo nativo (`npm start`).

---

## 5. 🔌 APIs e Rotas
O backend (`src/server.js`) carrega as rotas de forma modular em `src/api/routes/index.js`.

### Principais Módulos:
*   `/api/auth`: Autenticação.
*   `/api/aggregate`: Agregações complexas do MongoDB.
*   `/api/stats`: Estatísticas e métricas para cards.
*   `/api/ai`: Integração com Gemini.
*   `/api/zeladoria`: Dados específicos de Zeladoria.
*   `/api/notifications`: Sistema de e-mails automáticos.

### Segurança
*   Middleware `requireRole` protege rotas sensíveis.
*   Logs centralizados via `Winston`.
