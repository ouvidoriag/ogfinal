# 🚀 Guia Completo de Deploy em VPS - Sistema Ouvidoria Dashboard

**CÉREBRO X-3** | Versão 3.0.0 | Atualizado: 2026-01-15

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Preparação do Sistema (Windows)](#preparação-do-sistema-windows)
4. [Transferência para VPS](#transferência-para-vps)
5. [Instalação no VPS](#instalação-no-vps)
6. [Configuração de Produção](#configuração-de-produção)
7. [Nginx e SSL](#nginx-e-ssl)
8. [Inicialização e Monitoramento](#inicialização-e-monitoramento)
9. [Manutenção](#manutenção)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

Este guia descreve o processo completo de deploy do Sistema Ouvidoria Dashboard em um VPS Ubuntu. O sistema utiliza:

- **Backend**: Node.js 22.x + Express.js
- **Banco de Dados**: MongoDB Atlas (cloud)
- **Frontend**: SPA modular (vanilla JS)
- **Gerenciador de Processos**: PM2 (cluster mode)
- **Proxy Reverso**: Nginx
- **SSL**: Let's Encrypt
- **Monitoramento**: PM2 + scripts customizados

---

## 📦 Pré-requisitos

### VPS Requirements

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 4 GB | 8 GB |
| **Disco** | 20 GB | 40 GB (SSD) |
| **OS** | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |
| **Rede** | 100 Mbps | 1 Gbps |

### Software Requirements

- **Node.js**: >= 18.0.0 (recomendado 22.x)
- **npm**: >= 9.0.0
- **Python**: >= 3.8
- **Git**: Latest
- **PM2**: Latest (instalado globalmente)
- **Nginx**: Latest (opcional mas recomendado)

### Credenciais Necessárias

- ✅ MongoDB Atlas connection string
- ✅ Google Service Account credentials (JSON)
- ✅ Gemini API keys
- ✅ Email credentials (Gmail SMTP)
- ✅ Acesso SSH ao VPS

---

## 🛠️ Preparação do Sistema (Windows)

### Passo 1: Limpar e Preparar Bundle

Execute o script de preparação:

```bash
bash scripts/deploy/prepare-vps-deploy.sh
```

**O que o script faz:**
- ✅ Remove `node_modules`, `venv`, logs, cache
- ✅ Valida arquivos críticos
- ✅ Cria bundle comprimido otimizado
- ✅ Gera relatório de preparação
- ✅ Calcula checksum MD5

**Resultado esperado:**
```
✅ Preparação concluída com sucesso!
📦 Bundle pronto: ouvidoria-dashboard-YYYYMMDD_HHMMSS.tar.gz
📊 Relatório: deploy-report-YYYYMMDD_HHMMSS.txt
```

### Passo 2: Verificar Bundle

Verifique o conteúdo do relatório gerado:

```bash
cat deploy-report-*.txt
```

---

## 📤 Transferência para VPS

### Opção 1: SCP (Recomendado)

```bash
# Transferir bundle
scp ouvidoria-dashboard-*.tar.gz user@vps-ip:/tmp/

# Transferir arquivos sensíveis SEPARADAMENTE
scp .env user@vps-ip:/tmp/env-backup
scp google-credentials.json user@vps-ip:/tmp/google-creds-backup
```

### Opção 2: SFTP

```bash
sftp user@vps-ip
put ouvidoria-dashboard-*.tar.gz /tmp/
put .env /tmp/env-backup
put google-credentials.json /tmp/google-creds-backup
exit
```

### Opção 3: rsync (Mais Eficiente)

```bash
rsync -avz --progress \
  ouvidoria-dashboard-*.tar.gz \
  user@vps-ip:/tmp/
```

---

## 🖥️ Instalação no VPS

### Passo 1: Conectar ao VPS

```bash
ssh user@vps-ip
```

### Passo 2: Criar Estrutura de Diretórios

```bash
sudo mkdir -p /var/www/ouvidoria-dashboard
sudo chown -R $USER:$USER /var/www/ouvidoria-dashboard
cd /var/www/ouvidoria-dashboard
```

### Passo 3: Extrair Bundle

```bash
tar -xzf /tmp/ouvidoria-dashboard-*.tar.gz -C /var/www/ouvidoria-dashboard
```

### Passo 4: Restaurar Arquivos Sensíveis

```bash
cp /tmp/env-backup .env
cp /tmp/google-creds-backup google-credentials.json
chmod 600 .env
chmod 600 google-credentials.json
```

### Passo 5: Executar Instalação Automatizada

```bash
bash scripts/deploy/install-vps.sh
```

**O que o script faz:**
- ✅ Verifica requisitos do sistema
- ✅ Atualiza Ubuntu
- ✅ Instala Node.js 22.x via nvm
- ✅ Instala Python 3 e pip
- ✅ Instala dependências npm
- ✅ Configura ambiente virtual Python
- ✅ Cria estrutura de diretórios
- ✅ Configura permissões
- ✅ Instala PM2 globalmente
- ✅ Executa setup inicial
- ✅ Valida instalação

**Tempo estimado:** 10-15 minutos

---

## ⚙️ Configuração de Produção

### Passo 1: Configurar Variáveis de Ambiente

Edite o arquivo `.env`:

```bash
nano .env
```

**Variáveis obrigatórias:**

```env
# Servidor
PORT=3000
NODE_ENV=production

# MongoDB Atlas
MONGODB_ATLAS_URL=mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority

# Google Sheets
GOOGLE_SHEET_ID=seu-sheet-id
GOOGLE_SHEET_RANGE=Dados!A1:Z1000
GOOGLE_FOLDER_BRUTA=seu-folder-id
GOOGLE_CREDENTIALS_FILE=google-credentials.json

# Gemini AI
GEMINI_API_KEY=sua-chave-1
GEMINI_API_KEY_2=sua-chave-2
GEMINI_API_KEY_3=sua-chave-3

# Novas variáveis de ambiente
- `MONGODB_ATLAS_URL=<sua-url>`
- `GOOGLE_SHEET_ID=<seu-id>`
- `GEMINI_API_KEY=<sua-chave>`
- `GOOGLE_CREDENTIALS_JSON=<conteudo-do-json-minificado>` (Obrigatório em Produção/Render)
- `ENABLE_CHANGE_STREAM=false` (Recomendado 'false' no Render/VPS sem VPC)

# Email
EMAIL_REMETENTE=ouvidoria@dominio.com.br
NOME_REMETENTE=Ouvidoria Geral
EMAIL_OUVIDORIA_GERAL=email@gmail.com
```

### Passo 2: Validar Configuração

```bash
# Testar conexão MongoDB
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_ATLAS_URL)
  .then(() => { console.log('✅ MongoDB OK'); process.exit(0); })
  .catch(err => { console.error('❌ Erro:', err.message); process.exit(1); });
"
```

---

## 🌐 Nginx e SSL

### Passo 1: Instalar Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### Passo 2: Configurar Nginx

```bash
# Copiar configuração
sudo cp config/nginx/ouvidoria-dashboard.conf /etc/nginx/sites-available/ouvidoria-dashboard

# Editar domínio
sudo nano /etc/nginx/sites-available/ouvidoria-dashboard
# Substituir "seu-dominio.com.br" pelo domínio real

# Criar symlink
sudo ln -s /etc/nginx/sites-available/ouvidoria-dashboard /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

### Passo 3: Configurar SSL com Let's Encrypt

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br

# Renovação automática (já configurado)
sudo certbot renew --dry-run
```

### Passo 4: Configurar Firewall

```bash
# Permitir SSH, HTTP e HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Ativar firewall
sudo ufw enable

# Verificar status
sudo ufw status
```

---

## 🚀 Inicialização e Monitoramento

### Passo 1: Iniciar Sistema

```bash
bash scripts/deploy/start-production.sh
```

**O que o script faz:**
- ✅ Valida PM2
- ✅ Valida arquivos essenciais
- ✅ Valida variáveis de ambiente
- ✅ Para instâncias anteriores
- ✅ Executa setup inicial
- ✅ Inicia aplicação com PM2 (cluster mode)
- ✅ Configura auto-start
- ✅ Executa health check

### Passo 2: Verificar Status

```bash
# Status PM2
pm2 status

# Logs em tempo real
pm2 logs ouvidoria-dashboard

# Monitoramento de recursos
pm2 monit
```

### Passo 3: Health Check

```bash
# Executar health check completo
bash scripts/monitoring/health-check.sh
```

**Verifica:**
- ✅ Status PM2
- ✅ Endpoint `/health`
- ✅ Endpoints críticos da API
- ✅ Uso de memória
- ✅ Uso de disco
- ✅ Logs de erro
- ✅ Conexão MongoDB

### Passo 4: Acessar Sistema

```bash
# Via IP (sem Nginx)
http://vps-ip:3000

# Via domínio (com Nginx)
https://seu-dominio.com.br
```

---

## 🔧 Manutenção

### Backup Automático

Configurar cron para backup diário:

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup às 2h da manhã)
0 2 * * * /var/www/ouvidoria-dashboard/scripts/maintenance/backup.sh >> /var/log/ouvidoria-backup.log 2>&1
```

### Atualização do Sistema

```bash
cd /var/www/ouvidoria-dashboard

# Fazer backup antes
bash scripts/maintenance/backup.sh

# Atualizar código (se usando Git)
git pull origin main

# Atualizar dependências
npm install

# Reiniciar aplicação
pm2 restart ouvidoria-dashboard
```

### Rotação de Logs

```bash
# Limpar logs PM2
pm2 flush

# Limpar logs da aplicação
find logs/ -name "*.log" -mtime +7 -delete
```

### Monitoramento Contínuo

```bash
# Ver logs em tempo real
pm2 logs ouvidoria-dashboard --lines 100

# Monitorar recursos
htop

# Ver uso de disco
df -h

# Ver uso de memória
free -h
```

---

## 🐛 Troubleshooting

### Problema: Aplicação não inicia

**Diagnóstico:**
```bash
pm2 logs ouvidoria-dashboard --err
```

**Soluções:**
1. Verificar variáveis de ambiente: `cat .env`
2. Verificar conexão MongoDB
3. Verificar permissões: `ls -la .env google-credentials.json`
4. Verificar porta em uso: `sudo lsof -i :3000`

### Problema: Erro de conexão MongoDB

**Diagnóstico:**
```bash
# Testar DNS
nslookup cluster.mongodb.net

# Testar conectividade
ping cluster.mongodb.net
```

**Soluções:**
1. Verificar IP na whitelist do MongoDB Atlas
2. Verificar firewall: `sudo ufw status`
3. Verificar credenciais no `.env`

### Problema: Nginx 502 Bad Gateway

**Diagnóstico:**
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/ouvidoria-error.log
```

**Soluções:**
1. Verificar se aplicação está rodando: `pm2 status`
2. Verificar porta no Nginx config
3. Reiniciar Nginx: `sudo systemctl restart nginx`

### Problema: Memória insuficiente

**Diagnóstico:**
```bash
free -h
pm2 monit
```

**Soluções:**
1. Aumentar swap:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

2. Reduzir instâncias PM2:
```bash
pm2 scale ouvidoria-dashboard 2
```

### Problema: SSL não funciona

**Diagnóstico:**
```bash
sudo certbot certificates
```

**Soluções:**
1. Renovar certificado: `sudo certbot renew`
2. Verificar configuração Nginx
3. Verificar DNS apontando para VPS

---

## 📊 Comandos Úteis

### PM2

```bash
pm2 start ecosystem.config.js       # Iniciar com config
pm2 restart ouvidoria-dashboard     # Reiniciar
pm2 stop ouvidoria-dashboard        # Parar
pm2 delete ouvidoria-dashboard      # Remover
pm2 logs ouvidoria-dashboard        # Ver logs
pm2 monit                           # Monitorar
pm2 save                            # Salvar configuração
pm2 startup                         # Configurar auto-start
```

### Nginx

```bash
sudo nginx -t                       # Testar configuração
sudo systemctl restart nginx        # Reiniciar
sudo systemctl status nginx         # Ver status
sudo tail -f /var/log/nginx/access.log  # Ver logs
```

### Sistema

```bash
htop                                # Monitor de processos
df -h                               # Uso de disco
free -h                             # Uso de memória
netstat -tulpn                      # Portas em uso
journalctl -u nginx -f              # Logs do Nginx
```

---

## ✅ Checklist de Deploy

- [ ] Bundle preparado e transferido
- [ ] VPS configurado (Ubuntu, SSH)
- [ ] Arquivos sensíveis transferidos separadamente
- [ ] Bundle extraído em `/var/www/ouvidoria-dashboard`
- [ ] Script de instalação executado com sucesso
- [ ] Arquivo `.env` configurado
- [ ] `google-credentials.json` presente e com permissões 600
- [ ] Conexão MongoDB validada
- [ ] PM2 instalado e aplicação iniciada
- [ ] PM2 auto-start configurado
- [ ] Nginx instalado e configurado
- [ ] SSL configurado (Let's Encrypt)
- [ ] Firewall configurado
- [ ] Health check passou
- [ ] Dashboard acessível via domínio
- [ ] Backup automático configurado
- [ ] Monitoramento ativo

---

## 📞 Suporte

**Documentação adicional:**
- [`INSTALACAO_UBUNTU.md`](file:///c:/Users/501379.PMDC/Desktop/DRIVE/Dashboard/INSTALACAO_UBUNTU.md) - Guia detalhado de instalação
- [`README.md`](file:///c:/Users/501379.PMDC/Desktop/DRIVE/Dashboard/README.md) - Visão geral do projeto
- [`implementation_plan.md`](file:///C:/Users/501379.PMDC/.gemini/antigravity/brain/2b617140-4846-4a16-8ecd-07f282452f88/implementation_plan.md) - Plano de implementação

**Scripts úteis:**
- `scripts/deploy/prepare-vps-deploy.sh` - Preparar bundle
- `scripts/deploy/install-vps.sh` - Instalação automatizada
- `scripts/deploy/start-production.sh` - Iniciar produção
- `scripts/monitoring/health-check.sh` - Verificar saúde do sistema
- `scripts/maintenance/backup.sh` - Backup automático

---

**CÉREBRO X-3 - Sistema pronto para produção em VPS Ubuntu**

Versão 3.0.0 | Deploy Automatizado | Segurança e Performance Otimizadas
