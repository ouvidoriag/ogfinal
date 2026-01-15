#!/bin/bash
# ============================================
# Script de Backup Automático
# CÉREBRO X-3 - Sistema Ouvidoria Dashboard
# ============================================
#
# Realiza backup de:
# - Arquivos de configuração
# - Dados locais
# - Scripts customizados
#
# Uso: bash scripts/maintenance/backup.sh
# Cron: 0 2 * * * /var/www/ouvidoria-dashboard/scripts/maintenance/backup.sh
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
PROJECT_ROOT="/var/www/ouvidoria-dashboard"
BACKUP_DIR="/var/backups/ouvidoria-dashboard"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${TIMESTAMP}.tar.gz"
RETENTION_DAYS=7

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Backup Automático - CÉREBRO X-3                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. Criar diretório de backup
# ============================================
echo -e "${BLUE}📁 1. Preparando diretório de backup...${NC}"

mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}  ✓ Diretório: $BACKUP_DIR${NC}"
echo ""

# ============================================
# 2. Criar backup
# ============================================
echo -e "${BLUE}📦 2. Criando backup...${NC}"

cd "$PROJECT_ROOT"

# Arquivos e diretórios para backup
tar -czf "$BACKUP_DIR/$BACKUP_NAME" \
    --exclude='node_modules' \
    --exclude='venv' \
    --exclude='logs' \
    --exclude='db-data' \
    --exclude='.git' \
    --exclude='*.log' \
    .env \
    google-credentials.json \
    package.json \
    package-lock.json \
    ecosystem.config.js \
    src/ \
    public/ \
    scripts/ \
    data/ \
    config/ \
    2>/dev/null || true

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)

echo -e "${GREEN}  ✓ Backup criado: $BACKUP_NAME${NC}"
echo -e "${GREEN}  ✓ Tamanho: $BACKUP_SIZE${NC}"
echo ""

# ============================================
# 3. Limpar backups antigos
# ============================================
echo -e "${BLUE}🗑️  3. Limpando backups antigos (>${RETENTION_DAYS} dias)...${NC}"

DELETED_COUNT=$(find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)

if [[ $DELETED_COUNT -gt 0 ]]; then
    echo -e "${YELLOW}  ⚠️  $DELETED_COUNT backup(s) antigo(s) removido(s)${NC}"
else
    echo -e "${GREEN}  ✓ Nenhum backup antigo para remover${NC}"
fi

echo ""

# ============================================
# 4. Listar backups existentes
# ============================================
echo -e "${BLUE}📋 4. Backups disponíveis:${NC}"

ls -lh "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

echo ""

# ============================================
# Resultado final
# ============================================
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Backup concluído com sucesso!                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📦 Backup: ${YELLOW}$BACKUP_DIR/$BACKUP_NAME${NC}"
echo -e "${CYAN}📊 Tamanho: ${YELLOW}$BACKUP_SIZE${NC}"
echo ""

exit 0
