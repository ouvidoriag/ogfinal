# 🚀 Guia Completo de Instalação - Ubuntu Server/VM

**Sistema:** Ouvidoria Dashboard - Duque de Caxias  
**Versão:** 3.0.0  
**Data:** 2026-01-15  
**CÉREBRO X-3**

---

## 📋 Índice

1. [Requisitos do Sistema](#requisitos-do-sistema)
2. [Versões e Dependências](#versões-e-dependências)
3. [Instalação Passo a Passo](#instalação-passo-a-passo)
4. [Configuração do Ambiente](#configuração-do-ambiente)
5. [Deploy e Inicialização](#deploy-e-inicialização)
6. [Verificação e Testes](#verificação-e-testes)
7. [Manutenção e Monitoramento](#manutenção-e-monitoramento)
8. [Troubleshooting](#troubleshooting)

---

## 📊 Requisitos do Sistema

### Hardware Mínimo
- **CPU:** 2 cores (4 cores recomendado)
- **RAM:** 4 GB (8 GB recomendado)
- **Disco:** 20 GB livres (SSD recomendado)
- **Rede:** Conexão estável com internet

### Software Base
- **OS:** Ubuntu Server 20.04 LTS ou superior (22.04 LTS recomendado)
- **Acesso:** SSH habilitado
- **Usuário:** Com privilégios sudo

---

## 🔧 Versões e Dependências

### Stack Principal

| Componente | Versão | Obrigatório |
|------------|--------|-------------|
| **Node.js** | v22.21.0 (ou >= 18.0.0) | ✅ Sim |
| **npm** | 10.9.4 (ou >= 9.0.0) | ✅ Sim |
| **Python** | 3.8+ | ✅ Sim |
| **MongoDB Atlas** | Cloud (conexão remota) | ✅ Sim |
| **Git** | Latest | ✅ Sim |

### Dependências Node.js (package.json)

**Principais:**
```json
{
  "express": "^4.19.2",
  "mongoose": "^9.0.0",
  "mongodb": "^6.3.0",
  "dotenv": "^17.0.3",
  "node-cron": "^3.0.3",
  "winston": "^3.11.0",
  "googleapis": "^144.0.0",
  "xlsx": "^0.18.5",
  "@google/generative-ai": "^0.21.0"
}
```

**Total de dependências:** 50+ pacotes

### Dependências Python (Pipeline)

```txt
google-auth==2.23.0
google-auth-oauthlib==1.1.0
google-auth-httplib2==0.1.1
gspread==5.11.3
pandas==2.1.1
openpyxl==3.1.2
python-dotenv==1.0.0
```

---

## 🛠️ Instalação Passo a Passo

### Passo 1: Atualizar Sistema Ubuntu

```bash
# Atualizar repositórios
sudo apt update && sudo apt upgrade -y

# Instalar utilitários essenciais
sudo apt install -y curl wget git build-essential software-properties-common
```

### Passo 2: Instalar Node.js v22.x

```bash
# Adicionar repositório NodeSource para Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Instalar Node.js e npm
sudo apt install -y nodejs

# Verificar instalação
node --version  # Deve mostrar v22.x.x
npm --version   # Deve mostrar 10.x.x
```

**Alternativa (usando nvm - recomendado):**

```bash
# Instalar nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Recarregar shell
source ~/.bashrc

# Instalar Node.js 22
nvm install 22
nvm use 22
nvm alias default 22

# Verificar
node --version
npm --version
```

### Passo 3: Instalar Python 3 e pip

```bash
# Instalar Python 3 (geralmente já vem no Ubuntu)
sudo apt install -y python3 python3-pip python3-venv

# Verificar instalação
python3 --version  # Deve mostrar 3.8+
pip3 --version
```

### Passo 4: Instalar Git

```bash
# Instalar Git
sudo apt install -y git

# Configurar Git (opcional)
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

# Verificar
git --version
```

### Passo 5: Criar Estrutura de Diretórios

```bash
# Criar diretório para aplicação
sudo mkdir -p /var/www/ouvidoria-dashboard
sudo chown -R $USER:$USER /var/www/ouvidoria-dashboard

# Navegar para o diretório
cd /var/www/ouvidoria-dashboard
```

### Passo 6: Clonar/Transferir Projeto

**Opção A: Via Git (se tiver repositório)**

```bash
git clone <URL_DO_REPOSITORIO> .
```

**Opção B: Via SCP/SFTP (transferir do Windows)**

```bash
# No Windows (PowerShell), transferir para Ubuntu:
scp -r "C:\Users\501379.PMDC\Desktop\DRIVE\Dashboard\*" usuario@ip-ubuntu:/var/www/ouvidoria-dashboard/
```

**Opção C: Via rsync (recomendado)**

```bash
# No Ubuntu, puxar do Windows (se tiver SSH no Windows):
rsync -avz --progress usuario@ip-windows:/c/Users/501379.PMDC/Desktop/DRIVE/Dashboard/ /var/www/ouvidoria-dashboard/
```

### Passo 7: Instalar Dependências Node.js

```bash
cd /var/www/ouvidoria-dashboard

# Limpar cache npm (opcional)
npm cache clean --force

# Instalar dependências
npm install

# Verificar instalação
npm list --depth=0
```

**Tempo estimado:** 3-5 minutos

### Passo 8: Configurar Python Virtual Environment

```bash
# Criar ambiente virtual Python
python3 -m venv venv

# Ativar ambiente virtual
source venv/bin/activate

# Instalar dependências Python
pip install --upgrade pip
pip install google-auth google-auth-oauthlib google-auth-httplib2 gspread pandas openpyxl python-dotenv

# Verificar instalação
pip list

# Desativar ambiente (quando necessário)
deactivate
```

### Passo 9: Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env
nano .env
```

**Conteúdo do arquivo `.env`:**

```env
# ============================================
# SERVIDOR
# ============================================
PORT=3000
NODE_ENV=production

# ============================================
# MONGODB ATLAS
# ============================================
MONGODB_ATLAS_URL=mongodb+srv://ouvidoriadb:f7tgqnD46RV3lVg3@colabouvidoria.gk8g0dq.mongodb.net/ouvidoria?retryWrites=true&w=majority
DATABASE_URL=mongodb+srv://ouvidoriadb:f7tgqnD46RV3lVg3@colabouvidoria.gk8g0dq.mongodb.net/ouvidoria?retryWrites=true&w=majority

# ============================================
# GOOGLE SHEETS API
# ============================================
GOOGLE_SHEET_ID=1SCifd4v8D54qihNbwFW2jhHlpR2YtIZVZo81u4qYhV4
GOOGLE_SHEET_RANGE=Dados!A1:Z1000
GOOGLE_FOLDER_BRUTA=1qXj9eGauvOREKVgRPOfKjRlLSKhefXI5
GOOGLE_CREDENTIALS_FILE=google-credentials.json

# ============================================
# GEMINI AI (múltiplas chaves para rotação)
# ============================================
GEMINI_API_KEY=AIzaSyBhJbRkQ17KwkJxEd33EnvJsAfpA7M6bVg
GEMINI_API_KEY_2=AIzaSyBhJbRkQ17KwkJxEd33EnvJsAfpA7M6bVg
GEMINI_API_KEY_3=AIzaSyBhJbRkQ17KwkJxEd33EnvJsAfpA7M6bVg
GEMINI_API_KEY_4=AIzaSyBhJbRkQ17KwkJxEd33EnvJsAfpA7M6bVg
GEMINI_API_KEY_5=AIzaSyBhJbRkQ17KwkJxEd33EnvJsAfpA7M6bVg

# ============================================
# EMAIL (Gmail SMTP)
# ============================================
EMAIL_REMETENTE=ouvidoria@duquedecaxias.rj.gov.br
NOME_REMETENTE=Ouvidoria Geral de Duque de Caxias
EMAIL_PADRAO_SECRETARIAS=ouvidoria@duquedecaxias.rj.gov.br
EMAIL_OUVIDORIA_GERAL=ouvgeral.gestao@gmail.com

# ============================================
# PIPELINE PYTHON
# ============================================
SKIP_PYTHON=false

# ============================================
# EXCEL (legado - não usado)
# ============================================
EXCEL_FILE=data/planilha.xlsx
```

**Salvar:** `Ctrl+O`, `Enter`, `Ctrl+X`

### Passo 10: Transferir Arquivo de Credenciais Google

```bash
# Criar arquivo google-credentials.json
nano google-credentials.json
```

**Colar o conteúdo do arquivo de credenciais** (Service Account JSON)

**Salvar:** `Ctrl+O`, `Enter`, `Ctrl+X`

**Ajustar permissões:**

```bash
chmod 600 google-credentials.json
chmod 600 .env
```

### Passo 11: Executar Setup Inicial

```bash
# Executar script de setup
npm run setup

# Verificar se criou estruturas necessárias
ls -la data/
ls -la logs/
ls -la db-data/
```

---

## 🚀 Deploy e Inicialização

### Opção 1: Execução Direta (Desenvolvimento/Teste)

```bash
# Iniciar servidor
npm start

# Ou em modo desenvolvimento
npm run dev
```

**Acessar:** `http://IP-DO-SERVIDOR:3000`

### Opção 2: PM2 (Produção - Recomendado)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar aplicação com PM2
pm2 start src/server.js --name ouvidoria-dashboard

# Configurar PM2 para iniciar no boot
pm2 startup systemd
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

# Salvar configuração
pm2 save

# Verificar status
pm2 status
pm2 logs ouvidoria-dashboard

# Monitoramento
pm2 monit
```

**Comandos úteis PM2:**

```bash
pm2 restart ouvidoria-dashboard  # Reiniciar
pm2 stop ouvidoria-dashboard     # Parar
pm2 delete ouvidoria-dashboard   # Remover
pm2 logs ouvidoria-dashboard     # Ver logs
pm2 flush                        # Limpar logs
```

### Opção 3: Systemd Service (Alternativa)

```bash
# Criar arquivo de serviço
sudo nano /etc/systemd/system/ouvidoria-dashboard.service
```

**Conteúdo:**

```ini
[Unit]
Description=Ouvidoria Dashboard
After=network.target

[Service]
Type=simple
User=seu-usuario
WorkingDirectory=/var/www/ouvidoria-dashboard
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ouvidoria-dashboard
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Ativar serviço:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable ouvidoria-dashboard
sudo systemctl start ouvidoria-dashboard
sudo systemctl status ouvidoria-dashboard

# Ver logs
sudo journalctl -u ouvidoria-dashboard -f
```

### Configurar Nginx como Proxy Reverso (Recomendado)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Criar configuração
sudo nano /etc/nginx/sites-available/ouvidoria-dashboard
```

**Conteúdo:**

```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;  # ou IP do servidor

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Aumentar timeout para operações longas
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;
}
```

**Ativar configuração:**

```bash
sudo ln -s /etc/nginx/sites-available/ouvidoria-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Acessar:** `http://seu-dominio.com.br` ou `http://IP-DO-SERVIDOR`

### Configurar SSL com Let's Encrypt (Opcional)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seu-dominio.com.br

# Renovação automática (já configurado)
sudo certbot renew --dry-run
```

---

## ✅ Verificação e Testes

### 1. Verificar Conexão MongoDB

```bash
# Executar script de teste
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_ATLAS_URL || 'mongodb+srv://ouvidoriadb:f7tgqnD46RV3lVg3@colabouvidoria.gk8g0dq.mongodb.net/ouvidoria')
  .then(() => { console.log('✅ MongoDB conectado'); process.exit(0); })
  .catch(err => { console.error('❌ Erro:', err); process.exit(1); });
"
```

### 2. Verificar Collections

```bash
# Executar validação
node scripts/database/validar_sistema.js
```

### 3. Testar Endpoints

```bash
# Testar API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/records/count
curl http://localhost:3000/api/bairros
```

### 4. Verificar Logs

```bash
# Ver logs da aplicação
tail -f logs/combined.log
tail -f logs/error.log

# Se usando PM2
pm2 logs ouvidoria-dashboard

# Se usando systemd
sudo journalctl -u ouvidoria-dashboard -f
```

### 5. Testar Dashboard

Acessar no navegador:
- `http://IP-DO-SERVIDOR:3000/dashboard`
- `http://IP-DO-SERVIDOR:3000/dashboard/por-orgao`
- `http://IP-DO-SERVIDOR:3000/dashboard/unidades-saude`

---

## 🔧 Manutenção e Monitoramento

### Backup Automático

```bash
# Criar script de backup
nano /var/www/ouvidoria-dashboard/scripts/backup.sh
```

**Conteúdo:**

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/ouvidoria-dashboard"
mkdir -p $BACKUP_DIR

# Backup de arquivos
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/ouvidoria-dashboard \
  --exclude='node_modules' \
  --exclude='venv' \
  --exclude='logs' \
  --exclude='db-data'

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "files_*.tar.gz" -mtime +7 -delete

echo "✅ Backup concluído: files_$DATE.tar.gz"
```

**Tornar executável e agendar:**

```bash
chmod +x /var/www/ouvidoria-dashboard/scripts/backup.sh

# Adicionar ao crontab (backup diário às 2h)
crontab -e
# Adicionar linha:
0 2 * * * /var/www/ouvidoria-dashboard/scripts/backup.sh >> /var/log/ouvidoria-backup.log 2>&1
```

### Monitoramento de Recursos

```bash
# Instalar htop
sudo apt install -y htop

# Monitorar recursos
htop

# Ver uso de disco
df -h

# Ver uso de memória
free -h

# Ver processos Node
ps aux | grep node
```

### Atualização do Sistema

```bash
cd /var/www/ouvidoria-dashboard

# Fazer backup antes
./scripts/backup.sh

# Atualizar código (se usando Git)
git pull origin main

# Atualizar dependências
npm install

# Reiniciar aplicação
pm2 restart ouvidoria-dashboard
# ou
sudo systemctl restart ouvidoria-dashboard
```

---

## 🐛 Troubleshooting

### Problema: Porta 3000 já em uso

```bash
# Verificar processo usando porta 3000
sudo lsof -i :3000

# Matar processo
sudo kill -9 <PID>

# Ou mudar porta no .env
PORT=3001
```

### Problema: Erro de conexão MongoDB

```bash
# Verificar conectividade
ping colabouvidoria.gk8g0dq.mongodb.net

# Verificar DNS
nslookup colabouvidoria.gk8g0dq.mongodb.net

# Verificar firewall
sudo ufw status
sudo ufw allow 3000/tcp
```

### Problema: Permissões de arquivo

```bash
# Ajustar permissões
sudo chown -R $USER:$USER /var/www/ouvidoria-dashboard
chmod -R 755 /var/www/ouvidoria-dashboard
chmod 600 .env
chmod 600 google-credentials.json
```

### Problema: Memória insuficiente

```bash
# Aumentar swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Tornar permanente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Problema: Node.js travando

```bash
# Aumentar limite de memória Node
# Editar PM2 ecosystem
pm2 delete ouvidoria-dashboard
pm2 start src/server.js --name ouvidoria-dashboard --node-args="--max-old-space-size=2048"
pm2 save
```

---

## 📚 Comandos Úteis de Referência

### NPM Scripts Disponíveis

```bash
npm start                    # Iniciar servidor
npm run dev                  # Modo desenvolvimento
npm run setup                # Setup inicial
npm run update:sheets        # Atualizar dados do Google Sheets
npm run pipeline             # Executar pipeline Python
npm run test:completo        # Testes completos
npm run map:system           # Mapear sistema
```

### Estrutura de Diretórios

```
/var/www/ouvidoria-dashboard/
├── src/                    # Código fonte backend
│   ├── server.js          # Entrada principal
│   ├── api/               # Controllers e rotas
│   ├── models/            # Schemas Mongoose
│   ├── services/          # Lógica de negócio
│   └── utils/             # Utilitários
├── public/                # Frontend (SPA)
│   ├── scripts/           # JavaScript modular
│   ├── styles/            # CSS
│   └── pages/             # HTML
├── scripts/               # Scripts de manutenção
│   ├── database/          # Scripts de banco
│   ├── data/              # Scripts de dados
│   └── setup/             # Scripts de setup
├── data/                  # Dados normalizados
├── logs/                  # Logs da aplicação
├── db-data/               # Cache local
├── .env                   # Variáveis de ambiente
├── google-credentials.json # Credenciais Google
└── package.json           # Dependências
```

---

## ✅ Checklist de Instalação

- [ ] Ubuntu atualizado
- [ ] Node.js 22.x instalado
- [ ] npm 10.x instalado
- [ ] Python 3.8+ instalado
- [ ] Git instalado
- [ ] Projeto transferido para `/var/www/ouvidoria-dashboard`
- [ ] Dependências Node instaladas (`npm install`)
- [ ] Ambiente virtual Python criado
- [ ] Dependências Python instaladas
- [ ] Arquivo `.env` configurado
- [ ] Arquivo `google-credentials.json` transferido
- [ ] Permissões ajustadas
- [ ] Setup inicial executado (`npm run setup`)
- [ ] PM2 instalado e configurado
- [ ] Nginx instalado e configurado (opcional)
- [ ] SSL configurado (opcional)
- [ ] Firewall configurado
- [ ] Backup automático configurado
- [ ] Aplicação iniciada e funcionando
- [ ] Testes executados com sucesso
- [ ] Dashboard acessível

---

## 📞 Suporte

**Documentação adicional:**
- `README.md` - Visão geral do projeto
- `data/normalized/RESUMO_FINAL.md` - Resumo da refatoração
- `docs/` - Documentação técnica

**CÉREBRO X-3 - Sistema pronto para produção em Ubuntu.**
