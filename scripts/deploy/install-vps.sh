#!/bin/bash
# ============================================
# Script de Instalação Automatizada em VPS
# CÉREBRO X-3 - Sistema Ouvidoria Dashboard
# ============================================
#
# Este script automatiza a instalação completa em VPS Ubuntu:
# - Verifica requisitos do sistema
# - Instala dependências
# - Configura Node.js e Python
# - Instala dependências do projeto
# - Configura permissões
# - Valida instalação
#
# Uso: bash scripts/deploy/install-vps.sh
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
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_VERSION="22"
PYTHON_MIN_VERSION="3.8"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Instalação VPS - CÉREBRO X-3                             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

# ============================================
# Função: Verificar se comando existe
# ============================================
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================
# Função: Comparar versões
# ============================================
version_ge() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$2" ]
}

# ============================================
# Passo 1: Verificar requisitos do sistema
# ============================================
echo -e "${BLUE}📋 Passo 1: Verificando requisitos do sistema...${NC}"

# Verificar Ubuntu
if [[ ! -f /etc/os-release ]]; then
    echo -e "${RED}❌ Não foi possível detectar o sistema operacional${NC}"
    exit 1
fi

source /etc/os-release
echo -e "${GREEN}  ✓ Sistema: $PRETTY_NAME${NC}"

# Verificar privilégios sudo
if ! sudo -n true 2>/dev/null; then
    echo -e "${YELLOW}  ⚠️  Este script requer privilégios sudo${NC}"
    echo -e "${YELLOW}  Digite a senha sudo quando solicitado${NC}"
    sudo -v
fi

echo ""

# ============================================
# Passo 2: Atualizar sistema
# ============================================
echo -e "${BLUE}📦 Passo 2: Atualizando sistema Ubuntu...${NC}"

sudo apt update
sudo apt upgrade -y
sudo apt install -y curl wget git build-essential software-properties-common

echo -e "${GREEN}✅ Sistema atualizado${NC}"
echo ""

# ============================================
# Passo 3: Instalar Node.js
# ============================================
echo -e "${BLUE}🟢 Passo 3: Configurando Node.js...${NC}"

if command_exists node; then
    CURRENT_NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$CURRENT_NODE_VERSION" -ge 18 ]]; then
        echo -e "${GREEN}  ✓ Node.js já instalado: $(node --version)${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Node.js versão antiga detectada: $(node --version)${NC}"
        echo -e "${YELLOW}  Instalando versão mais recente...${NC}"
    fi
else
    echo -e "${YELLOW}  Node.js não encontrado. Instalando...${NC}"
fi

# Instalar/Atualizar Node.js via nvm (recomendado)
if [[ ! -d "$HOME/.nvm" ]]; then
    echo -e "${CYAN}  Instalando nvm...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    
    # Carregar nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
else
    echo -e "${GREEN}  ✓ nvm já instalado${NC}"
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Instalar Node.js via nvm
echo -e "${CYAN}  Instalando Node.js v${NODE_VERSION}...${NC}"
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"

echo -e "${GREEN}  ✓ Node.js: $(node --version)${NC}"
echo -e "${GREEN}  ✓ npm: $(npm --version)${NC}"
echo ""

# ============================================
# Passo 4: Instalar Python
# ============================================
echo -e "${BLUE}🐍 Passo 4: Verificando Python...${NC}"

if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "${GREEN}  ✓ Python: $PYTHON_VERSION${NC}"
else
    echo -e "${YELLOW}  Instalando Python 3...${NC}"
    sudo apt install -y python3 python3-pip python3-venv
fi

echo -e "${GREEN}  ✓ pip: $(pip3 --version | cut -d' ' -f2)${NC}"
echo ""

# ============================================
# Passo 5: Instalar dependências Node.js
# ============================================
echo -e "${BLUE}📦 Passo 5: Instalando dependências Node.js...${NC}"

if [[ ! -f package.json ]]; then
    echo -e "${RED}❌ package.json não encontrado!${NC}"
    exit 1
fi

# Limpar cache npm
npm cache clean --force

# Instalar dependências
echo -e "${CYAN}  Instalando pacotes npm (isso pode levar alguns minutos)...${NC}"
npm install --production

echo -e "${GREEN}✅ Dependências Node.js instaladas${NC}"
echo ""

# ============================================
# Passo 6: Configurar ambiente Python
# ============================================
echo -e "${BLUE}🐍 Passo 6: Configurando ambiente virtual Python...${NC}"

# Criar ambiente virtual
if [[ ! -d venv ]]; then
    python3 -m venv venv
    echo -e "${GREEN}  ✓ Ambiente virtual criado${NC}"
else
    echo -e "${YELLOW}  ⚠️  Ambiente virtual já existe${NC}"
fi

# Ativar ambiente virtual
source venv/bin/activate

# Atualizar pip
pip install --upgrade pip

# Instalar dependências Python
echo -e "${CYAN}  Instalando pacotes Python...${NC}"
pip install google-auth google-auth-oauthlib google-auth-httplib2 gspread pandas openpyxl python-dotenv

# Desativar ambiente virtual
deactivate

echo -e "${GREEN}✅ Ambiente Python configurado${NC}"
echo ""

# ============================================
# Passo 7: Criar estrutura de diretórios
# ============================================
echo -e "${BLUE}📁 Passo 7: Criando estrutura de diretórios...${NC}"

DIRS=(
    "logs"
    "db-data"
    "data"
)

for dir in "${DIRS[@]}"; do
    mkdir -p "$dir"
    echo -e "${GREEN}  ✓ $dir${NC}"
done

echo ""

# ============================================
# Passo 8: Configurar permissões
# ============================================
echo -e "${BLUE}🔒 Passo 8: Configurando permissões...${NC}"

# Ajustar permissões de diretórios
chmod -R 755 "$PROJECT_ROOT"

# Permissões especiais para arquivos sensíveis (se existirem)
if [[ -f .env ]]; then
    chmod 600 .env
    echo -e "${GREEN}  ✓ .env (600)${NC}"
fi

if [[ -f google-credentials.json ]]; then
    chmod 600 google-credentials.json
    echo -e "${GREEN}  ✓ google-credentials.json (600)${NC}"
fi

# Tornar scripts executáveis
find scripts -type f -name "*.sh" -exec chmod +x {} \;
echo -e "${GREEN}  ✓ Scripts executáveis${NC}"

echo ""

# ============================================
# Passo 9: Instalar PM2 globalmente
# ============================================
echo -e "${BLUE}⚙️  Passo 9: Instalando PM2...${NC}"

if ! command_exists pm2; then
    npm install -g pm2
    echo -e "${GREEN}  ✓ PM2 instalado: $(pm2 --version)${NC}"
else
    echo -e "${GREEN}  ✓ PM2 já instalado: $(pm2 --version)${NC}"
fi

echo ""

# ============================================
# Passo 10: Executar setup inicial
# ============================================
echo -e "${BLUE}🔧 Passo 10: Executando setup inicial...${NC}"

if [[ -f scripts/setup/setup.js ]]; then
    node scripts/setup/setup.js
    echo -e "${GREEN}✅ Setup inicial concluído${NC}"
else
    echo -e "${YELLOW}  ⚠️  Script de setup não encontrado, pulando...${NC}"
fi

echo ""

# ============================================
# Passo 11: Validar instalação
# ============================================
echo -e "${BLUE}✅ Passo 11: Validando instalação...${NC}"

VALIDATION_PASSED=true

# Verificar Node.js
if ! command_exists node; then
    echo -e "${RED}  ✗ Node.js não encontrado${NC}"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}  ✓ Node.js: $(node --version)${NC}"
fi

# Verificar npm
if ! command_exists npm; then
    echo -e "${RED}  ✗ npm não encontrado${NC}"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}  ✓ npm: $(npm --version)${NC}"
fi

# Verificar Python
if ! command_exists python3; then
    echo -e "${RED}  ✗ Python não encontrado${NC}"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}  ✓ Python: $(python3 --version)${NC}"
fi

# Verificar PM2
if ! command_exists pm2; then
    echo -e "${RED}  ✗ PM2 não encontrado${NC}"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}  ✓ PM2: $(pm2 --version)${NC}"
fi

# Verificar node_modules
if [[ ! -d node_modules ]]; then
    echo -e "${RED}  ✗ node_modules não encontrado${NC}"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}  ✓ node_modules instalado${NC}"
fi

# Verificar venv
if [[ ! -d venv ]]; then
    echo -e "${RED}  ✗ venv não encontrado${NC}"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}  ✓ venv configurado${NC}"
fi

# Verificar arquivos críticos
if [[ ! -f .env ]]; then
    echo -e "${YELLOW}  ⚠️  .env não encontrado (configure antes de iniciar)${NC}"
fi

if [[ ! -f google-credentials.json ]]; then
    echo -e "${YELLOW}  ⚠️  google-credentials.json não encontrado (configure antes de iniciar)${NC}"
fi

echo ""

# ============================================
# Resultado final
# ============================================
if [[ "$VALIDATION_PASSED" == true ]]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Instalação concluída com sucesso!                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📋 PRÓXIMOS PASSOS:${NC}"
    echo -e "${YELLOW}1. Configurar arquivo .env com credenciais de produção${NC}"
    echo -e "${YELLOW}2. Transferir google-credentials.json${NC}"
    echo -e "${YELLOW}3. Executar: bash scripts/deploy/start-production.sh${NC}"
    echo ""
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ Instalação concluída com erros                         ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Verifique os erros acima e tente novamente.${NC}"
    exit 1
fi

exit 0
