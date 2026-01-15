# ============================================
# Script de Preparação para Deploy em VPS (PowerShell)
# CÉREBRO X-3 - Sistema Ouvidoria Dashboard
# ============================================
# 
# Este script prepara o sistema para deploy em VPS:
# - Remove arquivos desnecessários
# - Valida estrutura essencial
# - Cria bundle comprimido otimizado
# - Gera relatório de preparação
#
# Uso: .\scripts\deploy\prepare-vps-deploy.ps1 [-DryRun]
# ============================================

param(
    [switch]$DryRun
)

# Cores para output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Variáveis
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BundleName = "ouvidoria-dashboard-$Timestamp.tar.gz"

if ($DryRun) {
    Write-ColorOutput Yellow "🔍 Modo DRY-RUN ativado - Nenhum arquivo será modificado"
}

Write-ColorOutput Cyan "╔════════════════════════════════════════════════════════════╗"
Write-ColorOutput Cyan "║  Preparação para Deploy em VPS - CÉREBRO X-3              ║"
Write-ColorOutput Cyan "╚════════════════════════════════════════════════════════════╝"
Write-Host ""

Set-Location $ProjectRoot

# ============================================
# Função: Verificar arquivos críticos
# ============================================
Write-ColorOutput Blue "📋 Verificando arquivos críticos..."

$CriticalFiles = @(
    "package.json",
    "src\server.js",
    ".env.example",
    "scripts\setup\setup.js"
)

$MissingFiles = @()

foreach ($file in $CriticalFiles) {
    if (Test-Path $file) {
        Write-ColorOutput Green "  ✓ $file"
    }
    else {
        $MissingFiles += $file
        Write-ColorOutput Red "  ✗ Faltando: $file"
    }
}

if ($MissingFiles.Count -gt 0) {
    Write-ColorOutput Red "❌ Arquivos críticos faltando! Abortando."
    exit 1
}

Write-ColorOutput Green "✅ Todos os arquivos críticos presentes"
Write-Host ""

# ============================================
# Função: Limpar arquivos desnecessários
# ============================================
Write-ColorOutput Blue "🧹 Removendo arquivos desnecessários..."

$DirsToRemove = @(
    "node_modules",
    "venv",
    "logs",
    "db-data",
    ".cache",
    ".temp",
    "tmp",
    "temp",
    "dist",
    "build",
    "coverage",
    ".nyc_output",
    "test-results",
    "_BACKUP_RAIZ"
)

$FilesToRemove = @(
    "*.log",
    "*.log.*",
    "Thumbs.db",
    "desktop.ini",
    ".DS_Store",
    "*.bak",
    "prod-bundle.zip",
    "relatorio-testes-completo.json",
    "test-results-export.json",
    "test-results.json"
)

# Remover diretórios
foreach ($dir in $DirsToRemove) {
    if (Test-Path $dir) {
        $size = (Get-ChildItem -Path $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        $sizeStr = "{0:N2} MB" -f $size
        
        if (-not $DryRun) {
            Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
            Write-ColorOutput Yellow "  🗑️  Removido: $dir ($sizeStr)"
        }
        else {
            Write-ColorOutput Yellow "  [DRY-RUN] Seria removido: $dir ($sizeStr)"
        }
    }
}

# Remover arquivos por padrão
foreach ($pattern in $FilesToRemove) {
    if (-not $DryRun) {
        Get-ChildItem -Path . -Filter $pattern -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    }
}

Write-ColorOutput Green "✅ Limpeza concluída"
Write-Host ""

# ============================================
# Função: Criar estrutura de diretórios vazios
# ============================================
Write-ColorOutput Blue "📁 Criando estrutura de diretórios vazios..."

$Dirs = @("logs", "db-data", "data")

foreach ($dir in $Dirs) {
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        New-Item -ItemType File -Path "$dir\.gitkeep" -Force | Out-Null
        Write-ColorOutput Green "  ✓ $dir"
    }
    else {
        Write-ColorOutput Yellow "  [DRY-RUN] Criaria: $dir"
    }
}

Write-Host ""

# ============================================
# Função: Criar arquivo .deployignore
# ============================================
Write-ColorOutput Blue "📝 Criando .deployignore..."

if (-not $DryRun) {
    @"
# Dependências (serão reinstaladas no servidor)
node_modules/
venv/
__pycache__/
*.pyc

# Logs
logs/
*.log
*.log.*

# Cache e dados temporários
db-data/
.cache/
.temp/
tmp/
temp/

# Arquivos de build
dist/
build/
coverage/
.nyc_output/

# Arquivos de teste
test-results/
test-results.json
test-results-export.json
relatorio-testes-completo.json
tests/

# Arquivos do sistema operacional
.DS_Store
Thumbs.db
desktop.ini
*.bak
*~

# Backups
_BACKUP_RAIZ/
*.backup
prod-bundle.zip
ouvidoria-dashboard-*.tar.gz
deploy-report-*.txt

# Git
.git/
.gitignore

# IDE
.vscode/
.idea/
*.swp
*.swo
.cursor/

# Arquivos sensíveis (transferir separadamente)
.env
google-credentials.json

# Chaves SSH
*.pem
*.key
*.pub
ogm-access
ogm-access.pub
ogm-node.pub

# Configurações locais
.nvmrc
.npmrc

# TypeScript
tsconfig.json
tsconfig.build.json

# Tailwind
tailwind.config.js
postcss.config.js

# Vitest
vitest.config.js

# Documentação de desenvolvimento
LIMPEZA_MANUAL.md
TRABALHO_CONCLUIDO.md

# Banco de dados local
BANCO/

# Scripts de desenvolvimento
scripts/test/
scripts/maintenance/mapear-sistema.js
_LEGACY/

# Arquivos específicos do Windows
*.lnk
"@
    
    Set-Content -Path ".deployignore" -Value $deployIgnoreContent
    Write-ColorOutput Green "  ✓ .deployignore criado"
}
else {
    Write-ColorOutput Yellow "  [DRY-RUN] Criaria .deployignore"
}

Write-Host ""

# ============================================
# Função: Criar bundle comprimido
# ============================================
Write-ColorOutput Blue "📦 Criando bundle comprimido..."

if ($DryRun) {
    Write-ColorOutput Yellow "  [DRY-RUN] Criaria: $BundleName"
    Write-Host ""
}
else {
    # Verificar se tar está disponível (Windows 10+)
    if (Get-Command tar -ErrorAction SilentlyContinue) {
        Write-ColorOutput Cyan "  Criando bundle com tar..."
        
        # Criar lista de exclusões
        $excludeArgs = @()
        if (Test-Path ".deployignore") {
            Get-Content ".deployignore" | Where-Object { $_ -match '\S' -and $_ -notmatch '^#' } | ForEach-Object {
                $excludeArgs += "--exclude=$($_.Trim())"
            }
        }
        
        # Criar tarball
        $tarArgs = @("-czf", $BundleName) + $excludeArgs + @(".")
        & tar @tarArgs
        
        if (Test-Path $BundleName) {
            $bundleSize = (Get-Item $BundleName).Length / 1MB
            $bundleSizeStr = "{0:N2} MB" -f $bundleSize
            
            # Calcular MD5
            $md5 = (Get-FileHash -Path $BundleName -Algorithm MD5).Hash
            
            Write-ColorOutput Green "  ✓ Bundle criado: $BundleName"
            Write-ColorOutput Green "  ✓ Tamanho: $bundleSizeStr"
            Write-ColorOutput Green "  ✓ MD5: $md5"
        }
        else {
            Write-ColorOutput Red "  ✗ Erro ao criar bundle"
        }
    }
    else {
        Write-ColorOutput Yellow "  ⚠️  tar não disponível. Criando arquivo ZIP..."
        
        # Criar ZIP como alternativa
        $zipName = "ouvidoria-dashboard-$Timestamp.zip"
        Compress-Archive -Path * -DestinationPath $zipName -Force
        
        $zipSize = (Get-Item $zipName).Length / 1MB
        $zipSizeStr = "{0:N2} MB" -f $zipSize
        
        Write-ColorOutput Green "  ✓ ZIP criado: $zipName"
        Write-ColorOutput Green "  ✓ Tamanho: $zipSizeStr"
    }
    
    Write-Host ""
}

# ============================================
# Função: Gerar relatório
# ============================================
Write-ColorOutput Blue "📊 Gerando relatório de preparação..."

$ReportFile = "deploy-report-$Timestamp.txt"

if (-not $DryRun) {
    @"
╔════════════════════════════════════════════════════════════╗
║  Relatório de Preparação para Deploy - CÉREBRO X-3        ║
╚════════════════════════════════════════════════════════════╝

Data/Hora: $(Get-Date)
Bundle: $BundleName

PRÓXIMOS PASSOS:
================

1. Transferir bundle para VPS:
   scp $BundleName user@vps-ip:/tmp/

2. Transferir arquivos sensíveis (SEPARADAMENTE):
   scp .env user@vps-ip:/tmp/env-backup
   scp google-credentials.json user@vps-ip:/tmp/google-creds-backup

3. No VPS, extrair bundle:
   cd /var/www/ouvidoria-dashboard
   tar -xzf /tmp/$BundleName

4. Executar instalação:
   bash scripts/deploy/install-vps.sh

5. Configurar variáveis de ambiente:
   nano .env
   (Ajustar valores de produção)

6. Iniciar sistema:
   bash scripts/deploy/start-production.sh

ARQUIVOS ESSENCIAIS INCLUÍDOS:
===============================
✓ src/ (backend completo)
✓ public/ (frontend SPA)
✓ scripts/ (automação)
✓ package.json
✓ .env.example (template)

ARQUIVOS NÃO INCLUÍDOS (transferir separadamente):
===================================================
✗ .env (credenciais reais)
✗ google-credentials.json (service account)
✗ node_modules (será reinstalado)
✗ venv (será recriado)

╔════════════════════════════════════════════════════════════╗
║  Sistema pronto para deploy em VPS Ubuntu                 ║
╚════════════════════════════════════════════════════════════╝
"@
    
    Set-Content -Path $ReportFile -Value $reportContent
    Write-ColorOutput Green "  ✓ Relatório salvo: $ReportFile"
    Write-Host ""
    Get-Content $ReportFile
}
else {
    Write-ColorOutput Yellow "  [DRY-RUN] Relatório seria gerado"
}

Write-Host ""
Write-ColorOutput Green "╔════════════════════════════════════════════════════════════╗"
Write-ColorOutput Green "║  ✅ Preparação concluída com sucesso!                      ║"
Write-ColorOutput Green "╚════════════════════════════════════════════════════════════╝"
Write-Host ""

if (-not $DryRun) {
    if (Test-Path $BundleName) {
        Write-ColorOutput Cyan "📦 Bundle pronto: " -NoNewline
        Write-ColorOutput Yellow $BundleName
    }
    Write-ColorOutput Cyan "📊 Relatório: " -NoNewline
    Write-ColorOutput Yellow $ReportFile
}

exit 0
