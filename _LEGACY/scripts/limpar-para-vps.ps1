# Script de Limpeza para Deploy em VPS (Windows PowerShell)
# Remove arquivos pesados e desnecessários
# CÉREBRO X-3

Write-Host "🧹 Iniciando limpeza do sistema para deploy..." -ForegroundColor Cyan

# Navegar para o diretório do projeto
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Remover node_modules (será reinstalado no servidor)
Write-Host "📦 Removendo node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
}

# Remover ambiente virtual Python (será recriado no servidor)
Write-Host "🐍 Removendo ambiente virtual Python..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Remove-Item -Recurse -Force "venv"
}

# Remover logs
Write-Host "📝 Removendo logs..." -ForegroundColor Yellow
if (Test-Path "logs") {
    Get-ChildItem -Path "logs" -Filter "*.log*" | Remove-Item -Force
}

# Remover cache do banco
Write-Host "💾 Removendo cache do banco..." -ForegroundColor Yellow
if (Test-Path "db-data") {
    Get-ChildItem -Path "db-data" -Recurse | Remove-Item -Force -Recurse
}

# Remover arquivos temporários
Write-Host "🗑️  Removendo arquivos temporários..." -ForegroundColor Yellow
@(".cache", ".temp", "tmp", "temp") | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item -Recurse -Force $_
    }
}

# Remover arquivos de build
Write-Host "🔨 Removendo arquivos de build..." -ForegroundColor Yellow
@("dist", "build") | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item -Recurse -Force $_
    }
}

# Remover coverage e testes
Write-Host "🧪 Removendo arquivos de teste..." -ForegroundColor Yellow
@("coverage", ".nyc_output") | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item -Recurse -Force $_
    }
}

# Remover arquivos do sistema operacional
Write-Host "💻 Removendo arquivos do sistema..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Force -Filter "Thumbs.db" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Force -Filter "desktop.ini" -ErrorAction SilentlyContinue | Remove-Item -Force

# Remover arquivos de backup
Write-Host "💾 Removendo backups..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "*.bak" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*~" -ErrorAction SilentlyContinue | Remove-Item -Force

# Limpar npm cache
Write-Host "🧹 Limpando cache npm..." -ForegroundColor Yellow
npm cache clean --force 2>$null

Write-Host ""
Write-Host "✅ Limpeza concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Tamanho atual do projeto:" -ForegroundColor Cyan
$size = (Get-ChildItem -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ("{0:N2} MB" -f $size) -ForegroundColor White
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Comprimir o projeto (use 7-Zip ou WinRAR)"
Write-Host "2. Transferir para VPS via SCP ou FTP"
Write-Host "3. No servidor: tar -xzf dashboard.tar.gz"
Write-Host "4. Instalar dependências: npm install"
Write-Host "5. Configurar .env e google-credentials.json"
Write-Host "6. Iniciar com PM2: pm2 start src/server.js --name ouvidoria-dashboard"
