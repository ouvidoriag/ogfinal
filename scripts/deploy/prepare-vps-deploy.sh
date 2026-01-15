#!/bin/bash
# ============================================
# Script de Preparação para Deploy em VPS
# CÉREBRO X-3 - Sistema Ouvidoria Dashboard
# ============================================
# 
# Este script prepara o sistema para deploy em VPS:
# - Remove arquivos desnecessários
# - Valida estrutura essencial
# - Cria bundle comprimido otimizado
# - Gera relatório de preparação
#
# Uso: bash scripts/deploy/prepare-vps-deploy.sh [--dry-run]
# ============================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variáveis
DRY_RUN=false
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUNDLE_NAME="ouvidoria-dashboard-${TIMESTAMP}.tar.gz"
TEMP_DIR="${PROJECT_ROOT}/temp-deploy"

# Processar argumentos
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}🔍 Modo DRY-RUN ativado - Nenhum arquivo será modificado${NC}"
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Preparação para Deploy em VPS - CÉREBRO X-3              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

# ============================================
# Função: Verificar arquivos críticos
# ============================================
check_critical_files() {
    echo -e "${BLUE}📋 Verificando arquivos críticos...${NC}"
    
    CRITICAL_FILES=(
        "package.json"
        "src/server.js"
        ".env.example"
        "scripts/setup/setup.js"
    )
    
    MISSING_FILES=()
    
    for file in "${CRITICAL_FILES[@]}"; do
        if [[ ! -f "$file" ]]; then
            MISSING_FILES+=("$file")
            echo -e "${RED}  ✗ Faltando: $file${NC}"
        else
            echo -e "${GREEN}  ✓ $file${NC}"
        fi
    done
    
    if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
        echo -e "${RED}❌ Arquivos críticos faltando! Abortando.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Todos os arquivos críticos presentes${NC}"
    echo ""
}

# ============================================
# Função: Calcular tamanho do diretório
# ============================================
get_dir_size() {
    du -sh "$1" 2>/dev/null | cut -f1 || echo "0"
}

# ============================================
# Função: Limpar arquivos desnecessários
# ============================================
clean_unnecessary_files() {
    echo -e "${BLUE}🧹 Removendo arquivos desnecessários...${NC}"
    
    DIRS_TO_REMOVE=(
        "node_modules"
        "venv"
        "logs"
        "db-data"
        ".cache"
        ".temp"
        "tmp"
        "temp"
        "dist"
        "build"
        "coverage"
        ".nyc_output"
        "test-results"
        "_BACKUP_RAIZ"
    )
    
    FILES_TO_REMOVE=(
        "*.log"
        "*.log.*"
        "Thumbs.db"
        "desktop.ini"
        ".DS_Store"
        "*.bak"
        "*~"
        "prod-bundle.zip"
        "relatorio-testes-completo.json"
        "test-results-export.json"
        "test-results.json"
    )
    
    TOTAL_FREED=0
    
    # Remover diretórios
    for dir in "${DIRS_TO_REMOVE[@]}"; do
        if [[ -d "$dir" ]]; then
            SIZE=$(get_dir_size "$dir")
            if [[ "$DRY_RUN" == false ]]; then
                rm -rf "$dir"
                echo -e "${YELLOW}  🗑️  Removido: $dir ($SIZE)${NC}"
            else
                echo -e "${YELLOW}  [DRY-RUN] Seria removido: $dir ($SIZE)${NC}"
            fi
        fi
    done
    
    # Remover arquivos por padrão
    for pattern in "${FILES_TO_REMOVE[@]}"; do
        if [[ "$DRY_RUN" == false ]]; then
            find . -name "$pattern" -type f -delete 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ Limpeza concluída${NC}"
    echo ""
}

# ============================================
# Função: Criar estrutura de diretórios vazios
# ============================================
create_empty_dirs() {
    echo -e "${BLUE}📁 Criando estrutura de diretórios vazios...${NC}"
    
    DIRS=(
        "logs"
        "db-data"
        "data"
    )
    
    for dir in "${DIRS[@]}"; do
        if [[ "$DRY_RUN" == false ]]; then
            mkdir -p "$dir"
            touch "$dir/.gitkeep"
            echo -e "${GREEN}  ✓ $dir${NC}"
        else
            echo -e "${YELLOW}  [DRY-RUN] Criaria: $dir${NC}"
        fi
    done
    
    echo ""
}

# ============================================
# Função: Criar arquivo .deployignore
# ============================================
create_deployignore() {
    echo -e "${BLUE}📝 Criando .deployignore...${NC}"
    
    if [[ "$DRY_RUN" == false ]]; then
        cat > .deployignore << 'EOF'
# Dependências (serão reinstaladas no servidor)
node_modules/
venv/
__pycache__/

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

# Git
.git/
.gitignore

# IDE
.vscode/
.idea/
*.swp
*.swo

# Arquivos sensíveis (transferir separadamente)
.env
google-credentials.json

# Chaves SSH
*.pem
*.key
ogm-access
ogm-access.pub
ogm-node.pub
EOF
        echo -e "${GREEN}  ✓ .deployignore criado${NC}"
    else
        echo -e "${YELLOW}  [DRY-RUN] Criaria .deployignore${NC}"
    fi
    
    echo ""
}

# ============================================
# Função: Criar bundle comprimido
# ============================================
create_bundle() {
    echo -e "${BLUE}📦 Criando bundle comprimido...${NC}"
    
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}  [DRY-RUN] Criaria: $BUNDLE_NAME${NC}"
        echo ""
        return
    fi
    
    # Criar diretório temporário
    mkdir -p "$TEMP_DIR"
    
    # Copiar arquivos excluindo os do .deployignore
    echo -e "${CYAN}  Copiando arquivos...${NC}"
    rsync -av \
        --exclude-from=.deployignore \
        --exclude=temp-deploy \
        . "$TEMP_DIR/" \
        | grep -v "/$" | wc -l | xargs echo "  Arquivos copiados:"
    
    # Criar tarball
    echo -e "${CYAN}  Comprimindo...${NC}"
    tar -czf "$BUNDLE_NAME" -C "$TEMP_DIR" .
    
    # Limpar diretório temporário
    rm -rf "$TEMP_DIR"
    
    # Calcular tamanho e checksum
    BUNDLE_SIZE=$(du -h "$BUNDLE_NAME" | cut -f1)
    BUNDLE_MD5=$(md5sum "$BUNDLE_NAME" | cut -d' ' -f1)
    
    echo -e "${GREEN}  ✓ Bundle criado: $BUNDLE_NAME${NC}"
    echo -e "${GREEN}  ✓ Tamanho: $BUNDLE_SIZE${NC}"
    echo -e "${GREEN}  ✓ MD5: $BUNDLE_MD5${NC}"
    echo ""
}

# ============================================
# Função: Gerar relatório
# ============================================
generate_report() {
    echo -e "${BLUE}📊 Gerando relatório de preparação...${NC}"
    
    REPORT_FILE="deploy-report-${TIMESTAMP}.txt"
    
    if [[ "$DRY_RUN" == false ]]; then
        cat > "$REPORT_FILE" << EOF
╔════════════════════════════════════════════════════════════╗
║  Relatório de Preparação para Deploy - CÉREBRO X-3        ║
╚════════════════════════════════════════════════════════════╝

Data/Hora: $(date)
Bundle: $BUNDLE_NAME
Tamanho: $BUNDLE_SIZE
MD5: $BUNDLE_MD5

PRÓXIMOS PASSOS:
================

1. Transferir bundle para VPS:
   scp $BUNDLE_NAME user@vps-ip:/tmp/

2. Transferir arquivos sensíveis (SEPARADAMENTE):
   scp .env user@vps-ip:/var/www/ouvidoria-dashboard/
   scp google-credentials.json user@vps-ip:/var/www/ouvidoria-dashboard/

3. No VPS, extrair bundle:
   cd /var/www/ouvidoria-dashboard
   tar -xzf /tmp/$BUNDLE_NAME

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
EOF
        
        echo -e "${GREEN}  ✓ Relatório salvo: $REPORT_FILE${NC}"
        echo ""
        cat "$REPORT_FILE"
    else
        echo -e "${YELLOW}  [DRY-RUN] Relatório seria gerado${NC}"
    fi
}

# ============================================
# EXECUÇÃO PRINCIPAL
# ============================================

check_critical_files
clean_unnecessary_files
create_empty_dirs
create_deployignore
create_bundle
generate_report

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Preparação concluída com sucesso!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ "$DRY_RUN" == false ]]; then
    echo -e "${CYAN}📦 Bundle pronto: ${YELLOW}$BUNDLE_NAME${NC}"
    echo -e "${CYAN}📊 Relatório: ${YELLOW}deploy-report-${TIMESTAMP}.txt${NC}"
fi

exit 0
