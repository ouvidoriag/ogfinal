# 📊 Dashboard Ouvidoria - Sistema NOVO

**Sistema completo de Ouvidoria e Zeladoria para Prefeitura de Duque de Caxias**

---

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Acessar dashboard
http://localhost:3000
```

---

## 📁 Estrutura do Projeto

```
NOVO/
├── src/                    # Backend (Express + MongoDB)
│   ├── api/               # Controllers e rotas
│   ├── services/          # Serviços (email, cache, etc)
│   ├── models/            # Modelos Mongoose
│   ├── utils/             # Utilitários
│   └── server.js          # Servidor principal
│
├── public/                 # Frontend (SPA vanilla)
│   ├── scripts/           # JavaScript modular
│   │   ├── core/          # Sistemas globais
│   │   ├── pages/         # Páginas do dashboard
│   │   └── modules/       # Módulos reutilizáveis
│   └── index.html         # Página principal
│
├── scripts/                # Scripts de manutenção
│   ├── data/              # Sincronização de dados
│   ├── email/             # Notificações
│   └── maintenance/       # Manutenção
│
├── docs/                   # Documentação
│   ├── setup/             # Guias de configuração
│   ├── system/            # Documentação técnica
│   └── troubleshooting/   # Solução de problemas
│
├── config/                 # Configurações (não versionadas)
└── data/                   # Dados estáticos
```

---

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```env
# MongoDB
MONGODB_ATLAS_URL=mongodb+srv://...

# Google Sheets
GOOGLE_SHEET_ID=...
GOOGLE_CREDENTIALS_FILE=google-credentials.json

# Email
EMAIL_REMETENTE=ouvidoria@duquedecaxias.rj.gov.br
EMAIL_OUVIDORIA_GERAL=ouvgeral.gestao@gmail.com

# Gemini AI
GEMINI_API_KEY=...
```

### Credenciais Necessárias

- **Google Sheets**: `config/google-credentials.json` (Service Account)
- **Gmail API**: `config/gmail-credentials.json` (após autorização OAuth)

**Guia completo**: [docs/setup/](docs/setup/)

---

## 🛠️ Scripts Principais

```bash
# Servidor
npm start                  # Iniciar servidor
npm run dev               # Modo desenvolvimento

# Dados
npm run update:sheets     # Atualizar do Google Sheets
npm run pipeline          # Executar pipeline Python

# Email
npm run gmail:auth        # Autenticar Gmail

# Manutenção
npm run setup             # Setup inicial
```

---

## 📊 Funcionalidades Principais

### Dashboard Analytics
- **Visão Geral**: KPIs, gráficos e análises consolidadas
- **Por Órgão e Mês**: Análise detalhada por secretaria
- **Tempo Médio**: Análise de tempo de atendimento
- **Vencimentos**: Controle de prazos e alertas
- **Filtros Inteligentes**: Sistema crossfilter multi-dimensional

### Sistema de Notificações
- Alertas automáticos por email
- Notificações de vencimento (15 dias, vencimento, 30 dias, 60 dias)
- Resumo diário para Ouvidoria Geral

### Integração de Dados
- Sincronização automática com Google Sheets
- Pipeline Python para processamento
- Cache híbrido (memória + arquivo + banco)

### IA e Chat
- Integração com Gemini AI
- Chat inteligente com contexto dos dados
- Reindexação automática

---

## 🏗️ Arquitetura

### Backend
- **Node.js + Express.js**
- **MongoDB Atlas** (Mongoose + Native Driver)
- **Sistema de Cache** híbrido (8 sistemas)
- **Logging** estruturado (Winston)
- **Rotas modulares** por domínio

### Frontend
- **SPA vanilla** (sem frameworks)
- **ChartFactory** para gráficos
- **DataLoader** para carregamento unificado
- **Crossfilter** para filtros inteligentes
- **Lazy loading** de bibliotecas

### Scripts
- **Pipeline Python** para processamento
- **Cron jobs** para automação
- **Sincronização** Google Sheets → MongoDB

---

## 📚 Documentação

### Setup e Configuração
- [Google Sheets Setup](docs/setup/GOOGLE_SHEETS_SETUP.md)
- [Pipeline Setup](docs/setup/PIPELINE_SETUP.md)
- [Gmail Setup](docs/setup/SETUP_GMAIL.md)

### Sistema Técnico
- [Índice do Sistema](docs/system/INDICE_SISTEMA.md)
- [Sistemas de Cache](docs/system/SISTEMAS_CACHE.md)
- [Sistemas Globais](docs/system/SISTEMAS_GLOBAIS_COMPLETO.md)
- [Guia de Logging](docs/system/GUIA_LOGGING.md)
- [Planilhas, Pipeline e Emails](docs/system/PLANILHAS_PIPELINE_EMAILS.md)

### Troubleshooting
- [Troubleshooting Gmail](docs/troubleshooting/TROUBLESHOOTING_GMAIL.md)
- [Gemini Quota](docs/troubleshooting/GEMINI_QUOTA.md)

---

## 🔧 Tecnologias

- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Frontend**: Vanilla JavaScript (ES Modules), Chart.js, Leaflet
- **Scripts**: Python (pandas, gspread), Node.js
- **Email**: Gmail API (OAuth 2.0)
- **IA**: Google Gemini API
- **Cache**: Memória, arquivo, MongoDB

---

## ✅ Status do Sistema

✅ **100% Operacional e Pronto para Produção**

- ✅ Backend completo e otimizado
- ✅ Frontend modular e responsivo
- ✅ Sistema de filtros inteligentes
- ✅ Notificações automáticas
- ✅ Integração com Google Sheets
- ✅ Cache híbrido implementado
- ✅ Logging estruturado
- ✅ Documentação completa

---

## 📝 Notas Importantes

### Regras do Sistema (CÉREBRO X-3)
- Trabalha **exclusivamente** na pasta `NOVO/`
- **Nunca** trabalha no sistema ANTIGO
- Sempre modular, escalável e otimizado
- Mantém separação de responsabilidades
- Respeita caching e TTLs

### Normalização de Dados
- Campos padronizados: `protocolo`, `dataCriacaoIso`, `statusDemanda`, etc.
- Pipeline Python normaliza antes de importar
- Validação automática de campos obrigatórios

---

## 🆘 Suporte

Para problemas ou dúvidas:
1. Consulte a [documentação](docs/)
2. Verifique os [logs](logs/)
3. Revise o [troubleshooting](docs/troubleshooting/)

---

**CÉREBRO X-3**  
**Sistema de Ouvidoria - Prefeitura de Duque de Caxias**  
**Última atualização**: Dezembro 2025
