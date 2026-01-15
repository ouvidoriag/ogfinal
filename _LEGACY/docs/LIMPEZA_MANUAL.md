# 🧹 Limpeza Manual para Deploy VPS

**Execute estes comandos no PowerShell:**

```powershell
# 1. Navegar para o projeto
cd C:\Users\501379.PMDC\Desktop\DRIVE\Dashboard

# 2. Remover node_modules (MAIS IMPORTANTE - ~500 MB)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# 3. Remover ambiente Python
Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue

# 4. Limpar logs
Remove-Item logs\*.log* -Force -ErrorAction SilentlyContinue

# 5. Limpar cache
Remove-Item -Recurse -Force db-data\* -ErrorAction SilentlyContinue

# 6. Ver tamanho final
Get-ChildItem -Recurse | Measure-Object -Property Length -Sum | Select-Object @{Name="Size(MB)";Expression={[math]::Round($_.Sum / 1MB, 2)}}
```

---

## 📦 Comprimir Projeto

**Opção 1: Usando Windows Explorer**
1. Clicar com botão direito na pasta `Dashboard`
2. Enviar para → Pasta compactada
3. Renomear para `dashboard.zip`

**Opção 2: Usando PowerShell**
```powershell
Compress-Archive -Path C:\Users\501379.PMDC\Desktop\DRIVE\Dashboard -DestinationPath C:\Users\501379.PMDC\Desktop\dashboard.zip -Force
```

---

## 📤 Transferir para VPS

**Opção 1: WinSCP (Recomendado)**
1. Baixar WinSCP: https://winscp.net/
2. Conectar ao servidor
3. Fazer upload de `dashboard.zip` para `/var/www/`

**Opção 2: FileZilla**
1. Baixar FileZilla: https://filezilla-project.org/
2. Conectar via SFTP
3. Fazer upload

---

## 🖥️ No Servidor VPS

```bash
# Descompactar
cd /var/www/
unzip dashboard.zip
cd Dashboard/

# Instalar dependências
npm install

# Configurar .env
nano .env
# (Configurar variáveis)

# Iniciar com PM2
sudo npm install -g pm2
pm2 start src/server.js --name ouvidoria-dashboard
pm2 save
pm2 startup
```

---

**Tamanho após limpeza:** ~50-100 MB  
**Tamanho antes:** ~500+ MB

✅ **Pronto para deploy!**
