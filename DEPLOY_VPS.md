# 🚀 Guia Rápido de Deploy para VPS

**CÉREBRO X-3**

---

## 📦 Preparação do Projeto (Windows)

### 1. Limpar Arquivos Pesados

Execute o script de limpeza:

```powershell
# No PowerShell (como Administrador)
cd C:\Users\501379.PMDC\Desktop\DRIVE\Dashboard
.\scripts\deploy\limpar-para-vps.ps1
```

Isso vai remover:
- ✅ `node_modules/` (~500 MB)
- ✅ `venv/` (ambiente Python)
- ✅ Logs e cache
- ✅ Arquivos temporários

**Tamanho final:** ~50-100 MB (ao invés de 500+ MB)

### 2. Comprimir o Projeto

**Opção A: Usando 7-Zip (Recomendado)**

```powershell
# Instalar 7-Zip se não tiver
# Download: https://www.7-zip.org/

# Comprimir (excluindo arquivos desnecessários)
7z a -ttar dashboard.tar src/ public/ scripts/ data/ config/ *.json *.md .env.example
7z a -tgzip dashboard.tar.gz dashboard.tar
```

**Opção B: Usando PowerShell (Nativo)**

```powershell
# Comprimir pasta inteira
Compress-Archive -Path . -DestinationPath dashboard.zip -CompressionLevel Optimal
```

**Opção C: Usando WSL (se tiver)**

```bash
tar -czf dashboard.tar.gz \
  --exclude='node_modules' \
  --exclude='venv' \
  --exclude='logs' \
  --exclude='db-data' \
  --exclude='.git' \
  .
```

---

## 🌐 Transferência para VPS

### Opção 1: SCP (Recomendado)

```powershell
# No PowerShell
scp dashboard.tar.gz usuario@IP-DO-SERVIDOR:/var/www/
```

### Opção 2: SFTP (FileZilla, WinSCP)

1. Abrir FileZilla/WinSCP
2. Conectar ao servidor (IP, usuário, senha/chave)
3. Navegar para `/var/www/`
4. Fazer upload de `dashboard.tar.gz`

### Opção 3: Git (se tiver repositório)

```bash
# No servidor
cd /var/www/
git clone <URL_DO_REPOSITORIO> ouvidoria-dashboard
```

---

## 🖥️ Instalação no Servidor VPS

### 1. Conectar ao Servidor

```powershell
# No PowerShell
ssh usuario@IP-DO-SERVIDOR
```

### 2. Descompactar Projeto

```bash
cd /var/www/
tar -xzf dashboard.tar.gz
cd ouvidoria-dashboard/  # ou o nome da pasta criada
```

### 3. Instalar Dependências

```bash
# Node.js
npm install

# Python (se necessário)
python3 -m venv venv
source venv/bin/activate
pip install google-auth google-auth-oauthlib gspread pandas openpyxl python-dotenv
```

### 4. Configurar Variáveis de Ambiente

```bash
# Copiar .env.example para .env
cp .env.example .env

# Editar .env
nano .env
```

**Configurar:**
- `PORT=3000`
- `NODE_ENV=production`
- `MONGODB_ATLAS_URL=<sua-url>`
- `GOOGLE_SHEET_ID=<seu-id>`
- `GEMINI_API_KEY=<sua-chave>`

### 5. Adicionar Credenciais Google

```bash
# Criar arquivo google-credentials.json
nano google-credentials.json
# Colar o conteúdo do JSON de credenciais
# Salvar: Ctrl+O, Enter, Ctrl+X

# Ajustar permissões
chmod 600 google-credentials.json
chmod 600 .env
```

### 6. Iniciar Aplicação

**Com PM2 (Produção):**

```bash
# Instalar PM2
sudo npm install -g pm2

# Iniciar aplicação
pm2 start src/server.js --name ouvidoria-dashboard

# Configurar para iniciar no boot
pm2 startup systemd
pm2 save

# Ver status
pm2 status
pm2 logs ouvidoria-dashboard
```

**Teste Direto:**

```bash
# Apenas para testar
npm start
```

---

## ✅ Verificação

### 1. Testar Aplicação

```bash
# Verificar se está rodando
curl http://localhost:3000/api/health

# Ver logs
pm2 logs ouvidoria-dashboard
```

### 2. Configurar Nginx (Opcional)

```bash
sudo apt install nginx

# Criar configuração
sudo nano /etc/nginx/sites-available/ouvidoria-dashboard
```

**Conteúdo:**

```nginx
server {
    listen 80;
    server_name SEU-DOMINIO.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Ativar:**

```bash
sudo ln -s /etc/nginx/sites-available/ouvidoria-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Configurar Firewall

```bash
# Permitir porta 3000 (se não usar Nginx)
sudo ufw allow 3000/tcp

# Ou permitir Nginx
sudo ufw allow 'Nginx Full'

# Verificar
sudo ufw status
```

---

## 📊 Checklist de Deploy

- [ ] Projeto limpo (node_modules removido)
- [ ] Projeto compactado
- [ ] Transferido para VPS
- [ ] Descompactado no servidor
- [ ] Node.js instalado (v22.x)
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` configurado
- [ ] Arquivo `google-credentials.json` adicionado
- [ ] Permissões ajustadas
- [ ] PM2 instalado e configurado
- [ ] Aplicação iniciada
- [ ] Nginx configurado (opcional)
- [ ] Firewall configurado
- [ ] Aplicação acessível

---

## 🔧 Comandos Úteis

```bash
# Ver status
pm2 status

# Ver logs
pm2 logs ouvidoria-dashboard

# Reiniciar
pm2 restart ouvidoria-dashboard

# Parar
pm2 stop ouvidoria-dashboard

# Monitorar recursos
pm2 monit

# Atualizar aplicação
cd /var/www/ouvidoria-dashboard
git pull  # se usar Git
npm install
pm2 restart ouvidoria-dashboard
```

---

## 📞 Suporte

**Documentação completa:** `INSTALACAO_UBUNTU.md`

**CÉREBRO X-3 - Sistema pronto para deploy!**
