# 🏛️ Sistema Integrado de Ouvidoria & Gestão Inteligente
### Prefeitura de Duque de Caxias - RJ

![Status](https://img.shields.io/badge/Status-Produção-green?style=for-the-badge)
![Version](https://img.shields.io/badge/Versão-2.5.0-blue?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

---

## 📖 Sobre o Projeto
Este é o sistema central de inteligência de dados da **Ouvidoria Geral**, projetado para monitorar, analisar e gerenciar demandas de **Saúde (APS e Especializada)**, **Zeladoria** e **Serviços Públicos**. 

O sistema atua como um **hub centralizador**, conectando dados de planilhas operacionais (Google Sheets), entradas manuais e pipelines automatizados em um **Dashboard Analítico em Tempo Real**.

### 🔥 Diferenciais
- **Pipeline Híbrido de Dados:** Sincronização bidirecional entre MongoDB Atlas e Google Sheets.
- **Arquitetura Resiliente:** Preparado para ambientes VPS (PM2/Nginx) e Serverless (Render).
- **Inteligência Geográfica:** Mapeamento de unidades de saúde e demandas por distrito.
- **Otimização Extrema:** Cache em camadas (Memória, Disco, Banco) e tratamento de milhões de registros com performance.

---

## 🛠️ Stack Tecnológica

### Backend (Core)
- **Node.js & Express:** Arquitetura RESTful modular.
- **MongoDB Atlas:**
  - *Mongoose:* Schemas, validação e regras de negócio.
  - *Native Driver:* Pipelines de agregação (`$lookup`, `$facet`) para performance máxima em relatórios.
- **Segurança:** Helmet, Rate-Limiting, CORS configurável, Sanitização de inputs.
- **Sessão:** `connect-mongo` para persistência robusta em cluster.

### Frontend (Dashboard)
- **Vanilla JS Modular:** SPA leve sem framework pesado, focado em velocidade.
- **Chart.js:** Visualização de dados dinâmica.
- **Leaflet:** Mapas interativos de cobertura de saúde.

### Infraestrutura & DevOps
- **PM2:** Gerenciamento de processos em cluster mode.
- **Docker Ready:** Scripts compatíveis com containerização.
- **CI/CD Scripts:** Automação completa de deploy (`scripts/deploy/`).

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- Conta MongoDB Atlas
- Google Cloud Service Account (para acesso às planilhas)

### 1. Clonar e Instalar
```bash
git clone https://github.com/ouvidoriag/ogfinal.git
cd ogfinal
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz baseado no `.env.example`:

```env
NODE_ENV=development
PORT=3000

# Banco de Dados
MONGODB_ATLAS_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/dashboard

# Google Sheets Integration
GOOGLE_SHEET_ID=1SCifd4v8D54qihNbwFW2jhHlpR2YtIZVZo81u4qYhV4
GOOGLE_CREDENTIALS_JSON={"type": "service_account", ...} # Conteúdo Minificado

# Segurança
SESSION_SECRET=sua_chave_super_secreta_aqui
ENABLE_CHANGE_STREAM=true # false para ambientes sem VPC (ex: Render)
```

### 3. Executar
```bash
# Modo Desenvolvimento (com auto-reload)
npm run dev

# Modo Produção
npm start
```

---

## 📡 Endpoints Importantes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/dashboard-data` | Payload principal do dashboard (otimizado com cache) |
| `GET` | `/api/unidades-saude` | Lista consolidada APS + Especializada |
| `POST` | `/api/config/pipeline/execute` | Força a sincronização Google Sheets -> Mongo |
| `GET` | `/health` | Status do sistema e conexões |

---

## 📦 Deploy em Produção (VPS)

O projeto inclui uma **suíte completa de scripts de automação** para deploy em VPS Ubuntu/Debian.

📜 **[Leia o Guia Completo de Deploy (DEPLOY_VPS_COMPLETO.md)](./DEPLOY_VPS_COMPLETO.md)**

### Resumo Rápido
1. **Preparar (Windows/Local):**
   ```powershell
   ./scripts/deploy/prepare-vps-deploy.ps1
   ```
   *Gera um bundle otimizado `dashboard-deploy.tar.gz` sem lixo.*

2. **Instalar (VPS):**
   ```bash
   # No servidor
   ./scripts/deploy/install-vps.sh
   ./scripts/deploy/start-production.sh
   ```

---

## 🔄 Pipeline de Dados (Sincronização)

O sistema possui um motor de ingestão de dados localizado em `src/services/dataProcessor.js` e scripts auxiliares em `scripts/data/`.

1. **Ingestão:** Leitura da planilha Google Sheets "Tratada".
2. **Normalização:** Padronização de nomes de bairros, secretarias e status.
3. **Upsert:** Atualização inteligente no MongoDB (evita duplicatas).
4. **Cache Busting:** Invalidação automática dos caches do dashboard.

---

## 📂 Estrutura de Pastas

```
/
├── BANCO/               # Backups e metadados JSON (APS 2025, etc)
├── config/              # Configurações de Nginx e Systemd
├── public/              # Assets estáticos e scripts Frontend
├── scripts/             
│   ├── deploy/          # Scripts de automação VPS
│   ├── maintenance/     # Backups, imports e verificações
│   └── monitoring/      # Health checks
├── src/                 # Código Fonte Backend
│   ├── api/             # Controllers e Rotas
│   ├── models/          # Schemas Mongoose
│   ├── services/        # Lógica de Negócio
│   └── utils/           # Helpers e Cache
└── _LEGACY/             # Arquivos arquivados (limpeza)
```

---

## 📝 Licença
© 2024-2026 Ouvidoria Geral - PMDC. Todos os direitos reservados.
Desenvolvido com arquitetura **CÉREBRO X-3**.
