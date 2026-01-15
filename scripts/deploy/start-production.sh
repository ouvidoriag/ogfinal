#!/bin/bash
# ============================================
# Script de Inicialização em Produção
# CÉREBRO X-3 - Sistema Ouvidoria Dashboard
# ============================================
#
# Este script inicializa o sistema em produção:
# - Valida variáveis de ambiente
# - Executa setup inicial
# - Inicia aplicação com PM2
# - Configura auto-start
# - Executa health check
#
# Uso: bash scripts/deploy/start-production.sh
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
APP_NAME="ouvidoria-dashboard"
NODE_ENV="production"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Inicialização em Produção - CÉREBRO X-3                  ║${NC}"
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
# Passo 1: Verificar PM2
# ============================================
echo -e "${BLUE}📋 Passo 1: Verificando PM2...${NC}"

if ! command_exists pm2; then
    echo -e "${RED}❌ PM2 não encontrado!${NC}"
    echo -e "${YELLOW}Instale com: npm install -g pm2${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ PM2: $(pm2 --version)${NC}"
echo ""

# ============================================
# Passo 2: Validar arquivos essenciais
# ============================================
echo -e "${BLUE}📋 Passo 2: Validando arquivos essenciais...${NC}"

REQUIRED_FILES=(
    "package.json"
    "src/server.js"
    ".env"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        MISSING_FILES+=("$file")
        echo -e "${RED}  ✗ Faltando: $file${NC}"
    else
        echo -e "${GREEN}  ✓ $file${NC}"
    fi
done

if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
    echo -e "${RED}❌ Arquivos essenciais faltando!${NC}"
    exit 1
fi

echo ""

# ============================================
# Passo 3: Validar variáveis de ambiente
# ============================================
echo -e "${BLUE}🔐 Passo 3: Validando variáveis de ambiente...${NC}"

# Carregar .env
if [[ -f .env ]]; then
    export $(grep -v '^#' .env | xargs)
fi

REQUIRED_VARS=(
    "MONGODB_ATLAS_URL"
    "DATABASE_URL"
    "PORT"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        MISSING_VARS+=("$var")
        echo -e "${RED}  ✗ Faltando: $var${NC}"
    else
        echo -e "${GREEN}  ✓ $var${NC}"
    fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    echo -e "${RED}❌ Variáveis de ambiente obrigatórias faltando!${NC}"
    echo -e "${YELLOW}Configure o arquivo .env antes de continuar.${NC}"
    exit 1
fi

# Verificar variáveis opcionais mas importantes
OPTIONAL_VARS=(
    "GOOGLE_SHEET_ID"
    "GEMINI_API_KEY"
    "EMAIL_REMETENTE"
)

for var in "${OPTIONAL_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo -e "${YELLOW}  ⚠️  Opcional não configurado: $var${NC}"
    else
        echo -e "${GREEN}  ✓ $var${NC}"
    fi
done

echo ""

# ============================================
# Passo 4: Parar instâncias existentes
# ============================================
echo -e "${BLUE}🛑 Passo 4: Parando instâncias existentes...${NC}"

if pm2 list | grep -q "$APP_NAME"; then
    pm2 delete "$APP_NAME" 2>/dev/null || true
    echo -e "${YELLOW}  ⚠️  Instância anterior removida${NC}"
else
    echo -e "${GREEN}  ✓ Nenhuma instância anterior encontrada${NC}"
fi

echo ""

# ============================================
# Passo 5: Executar setup inicial
# ============================================
echo -e "${BLUE}🔧 Passo 5: Executando setup inicial...${NC}"

if [[ -f scripts/setup/setup.js ]]; then
    node scripts/setup/setup.js
    echo -e "${GREEN}  ✓ Setup concluído${NC}"
else
    echo -e "${YELLOW}  ⚠️  Script de setup não encontrado${NC}"
fi

echo ""

# ============================================
# Passo 6: Iniciar aplicação com PM2
# ============================================
echo -e "${BLUE}🚀 Passo 6: Iniciando aplicação com PM2...${NC}"

# Verificar se existe ecosystem.config.js
if [[ -f ecosystem.config.js ]]; then
    echo -e "${CYAN}  Usando ecosystem.config.js...${NC}"
    pm2 start ecosystem.config.js
else
    echo -e "${CYAN}  Iniciando diretamente...${NC}"
    pm2 start src/server.js \
        --name "$APP_NAME" \
        --instances 2 \
        --exec-mode cluster \
        --max-memory-restart 1G \
        --node-args="--max-old-space-size=2048" \
        --env production
fi

echo -e "${GREEN}  ✓ Aplicação iniciada${NC}"
echo ""

# ============================================
# Passo 7: Configurar auto-start
# ============================================
echo -e "${BLUE}⚙️  Passo 7: Configurando auto-start...${NC}"

# Salvar configuração PM2
pm2 save

# Configurar startup script (se ainda não configurado)
if ! systemctl is-enabled pm2-$USER.service >/dev/null 2>&1; then
    echo -e "${CYAN}  Configurando PM2 startup...${NC}"
    pm2 startup systemd -u "$USER" --hp "$HOME" | grep "sudo" | bash || true
    echo -e "${GREEN}  ✓ Auto-start configurado${NC}"
else
    echo -e "${GREEN}  ✓ Auto-start já configurado${NC}"
fi

echo ""

# ============================================
# Passo 8: Aguardar inicialização
# ============================================
echo -e "${BLUE}⏳ Passo 8: Aguardando inicialização...${NC}"

sleep 5

echo ""

# ============================================
# Passo 9: Verificar status
# ============================================
echo -e "${BLUE}📊 Passo 9: Verificando status...${NC}"

pm2 status

echo ""

# ============================================
# Passo 10: Health check
# ============================================
echo -e "${BLUE}🏥 Passo 10: Executando health check...${NC}"

PORT=${PORT:-3000}
MAX_RETRIES=10
RETRY_COUNT=0

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
    if curl -f -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Health check passou!${NC}"
        HEALTH_RESPONSE=$(curl -s "http://localhost:$PORT/health")
        echo -e "${CYAN}  Resposta: $HEALTH_RESPONSE${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; then
            echo -e "${YELLOW}  ⏳ Tentativa $RETRY_COUNT/$MAX_RETRIES - Aguardando...${NC}"
            sleep 2
        else
            echo -e "${RED}  ✗ Health check falhou após $MAX_RETRIES tentativas${NC}"
            echo -e "${YELLOW}  Verifique os logs: pm2 logs $APP_NAME${NC}"
        fi
    fi
done

echo ""

# ============================================
# Passo 11: Exibir informações
# ============================================
echo -e "${BLUE}📋 Passo 11: Informações do sistema...${NC}"

echo -e "${CYAN}  Nome da aplicação: ${YELLOW}$APP_NAME${NC}"
echo -e "${CYAN}  Porta: ${YELLOW}$PORT${NC}"
echo -e "${CYAN}  Ambiente: ${YELLOW}$NODE_ENV${NC}"
echo -e "${CYAN}  Diretório: ${YELLOW}$PROJECT_ROOT${NC}"

echo ""

# ============================================
# Resultado final
# ============================================
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Sistema iniciado com sucesso!                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}📋 COMANDOS ÚTEIS:${NC}"
echo -e "${YELLOW}  pm2 status                    ${NC}# Ver status"
echo -e "${YELLOW}  pm2 logs $APP_NAME            ${NC}# Ver logs"
echo -e "${YELLOW}  pm2 monit                     ${NC}# Monitorar recursos"
echo -e "${YELLOW}  pm2 restart $APP_NAME         ${NC}# Reiniciar"
echo -e "${YELLOW}  pm2 stop $APP_NAME            ${NC}# Parar"
echo -e "${YELLOW}  pm2 delete $APP_NAME          ${NC}# Remover"
echo ""

echo -e "${CYAN}🌐 ACESSAR SISTEMA:${NC}"
echo -e "${YELLOW}  http://localhost:$PORT${NC}"
echo -e "${YELLOW}  http://localhost:$PORT/dashboard${NC}"
echo ""

echo -e "${CYAN}📊 MONITORAMENTO:${NC}"
echo -e "${YELLOW}  pm2 logs $APP_NAME --lines 100${NC}"
echo ""

exit 0
