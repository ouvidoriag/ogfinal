#!/bin/bash
# ============================================
# Script de Health Check
# CÉREBRO X-3 - Sistema Ouvidoria Dashboard
# ============================================
#
# Verifica saúde do sistema:
# - Conexão MongoDB
# - Endpoints críticos
# - Uso de recursos
# - Processos PM2
#
# Uso: bash scripts/monitoring/health-check.sh
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variáveis
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT=${PORT:-3000}
HEALTH_STATUS=0

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Health Check - CÉREBRO X-3                               ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

# ============================================
# 1. Verificar PM2
# ============================================
echo -e "${BLUE}📊 1. Verificando PM2...${NC}"

if command -v pm2 >/dev/null 2>&1; then
    if pm2 list | grep -q "ouvidoria-dashboard"; then
        STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="ouvidoria-dashboard") | .pm2_env.status')
        if [[ "$STATUS" == "online" ]]; then
            echo -e "${GREEN}  ✓ PM2: Aplicação online${NC}"
        else
            echo -e "${RED}  ✗ PM2: Aplicação $STATUS${NC}"
            HEALTH_STATUS=1
        fi
    else
        echo -e "${RED}  ✗ PM2: Aplicação não encontrada${NC}"
        HEALTH_STATUS=1
    fi
else
    echo -e "${YELLOW}  ⚠️  PM2 não instalado${NC}"
fi

echo ""

# ============================================
# 2. Verificar endpoint /health
# ============================================
echo -e "${BLUE}🏥 2. Verificando endpoint /health...${NC}"

HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null || echo "000")

if [[ "$HEALTH_RESPONSE" == "200" ]]; then
    echo -e "${GREEN}  ✓ Health endpoint: OK (200)${NC}"
else
    echo -e "${RED}  ✗ Health endpoint: FALHOU ($HEALTH_RESPONSE)${NC}"
    HEALTH_STATUS=1
fi

echo ""

# ============================================
# 3. Verificar endpoints críticos
# ============================================
echo -e "${BLUE}🔍 3. Verificando endpoints críticos...${NC}"

ENDPOINTS=(
    "/api/records/count"
    "/api/bairros"
    "/api/secretarias"
)

for endpoint in "${ENDPOINTS[@]}"; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$endpoint" 2>/dev/null || echo "000")
    
    if [[ "$RESPONSE" == "200" ]]; then
        echo -e "${GREEN}  ✓ $endpoint: OK${NC}"
    else
        echo -e "${RED}  ✗ $endpoint: FALHOU ($RESPONSE)${NC}"
        HEALTH_STATUS=1
    fi
done

echo ""

# ============================================
# 4. Verificar uso de memória
# ============================================
echo -e "${BLUE}💾 4. Verificando uso de memória...${NC}"

TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
USED_MEM=$(free -m | awk 'NR==2{print $3}')
MEM_PERCENT=$((USED_MEM * 100 / TOTAL_MEM))

echo -e "${CYAN}  Total: ${TOTAL_MEM}MB${NC}"
echo -e "${CYAN}  Usado: ${USED_MEM}MB (${MEM_PERCENT}%)${NC}"

if [[ $MEM_PERCENT -gt 90 ]]; then
    echo -e "${RED}  ✗ Memória crítica (>90%)${NC}"
    HEALTH_STATUS=1
elif [[ $MEM_PERCENT -gt 80 ]]; then
    echo -e "${YELLOW}  ⚠️  Memória alta (>80%)${NC}"
else
    echo -e "${GREEN}  ✓ Memória OK${NC}"
fi

echo ""

# ============================================
# 5. Verificar uso de disco
# ============================================
echo -e "${BLUE}💿 5. Verificando uso de disco...${NC}"

DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')

echo -e "${CYAN}  Uso do disco: ${DISK_USAGE}%${NC}"

if [[ $DISK_USAGE -gt 90 ]]; then
    echo -e "${RED}  ✗ Disco crítico (>90%)${NC}"
    HEALTH_STATUS=1
elif [[ $DISK_USAGE -gt 80 ]]; then
    echo -e "${YELLOW}  ⚠️  Disco alto (>80%)${NC}"
else
    echo -e "${GREEN}  ✓ Disco OK${NC}"
fi

echo ""

# ============================================
# 6. Verificar logs de erro recentes
# ============================================
echo -e "${BLUE}📝 6. Verificando logs de erro...${NC}"

if [[ -f logs/error.log ]]; then
    ERROR_COUNT=$(tail -n 100 logs/error.log 2>/dev/null | grep -c "error" || echo "0")
    
    if [[ $ERROR_COUNT -gt 10 ]]; then
        echo -e "${YELLOW}  ⚠️  $ERROR_COUNT erros nas últimas 100 linhas${NC}"
    else
        echo -e "${GREEN}  ✓ Poucos erros recentes ($ERROR_COUNT)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠️  Arquivo de log não encontrado${NC}"
fi

echo ""

# ============================================
# 7. Verificar conexão MongoDB
# ============================================
echo -e "${BLUE}🗄️  7. Verificando conexão MongoDB...${NC}"

if [[ -f .env ]]; then
    export $(grep -v '^#' .env | xargs)
    
    if [[ -n "$MONGODB_ATLAS_URL" ]]; then
        # Testar conexão via script Node.js
        MONGO_TEST=$(node -e "
            const mongoose = require('mongoose');
            mongoose.connect('$MONGODB_ATLAS_URL', { serverSelectionTimeoutMS: 5000 })
                .then(() => { console.log('OK'); process.exit(0); })
                .catch(() => { console.log('FAIL'); process.exit(1); });
        " 2>/dev/null || echo "FAIL")
        
        if [[ "$MONGO_TEST" == "OK" ]]; then
            echo -e "${GREEN}  ✓ MongoDB: Conectado${NC}"
        else
            echo -e "${RED}  ✗ MongoDB: Falha na conexão${NC}"
            HEALTH_STATUS=1
        fi
    else
        echo -e "${YELLOW}  ⚠️  MONGODB_ATLAS_URL não configurado${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠️  Arquivo .env não encontrado${NC}"
fi

echo ""

# ============================================
# Resultado final
# ============================================
if [[ $HEALTH_STATUS -eq 0 ]]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Sistema saudável - Todos os checks passaram            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ Sistema com problemas - Verifique os erros acima       ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
