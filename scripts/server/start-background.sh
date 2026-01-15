#!/bin/bash

# Script para rodar o Dashboard em background (Linux)
# Usa nohup para manter o processo rodando mesmo após fechar o terminal

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🏛️  Iniciando Dashboard em background...${NC}\n"

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Nome do arquivo de log
LOG_FILE="dashboard.log"
PID_FILE="dashboard.pid"

# Verificar se já está rodando
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Dashboard já está rodando (PID: $OLD_PID)${NC}"
        echo -e "${YELLOW}Para parar, execute: ./stop.sh${NC}"
        exit 1
    else
        # PID file existe mas processo não está rodando
        rm -f "$PID_FILE"
    fi
fi

# Iniciar em background
nohup npm start > "$LOG_FILE" 2>&1 &
PID=$!

# Salvar PID
echo $PID > "$PID_FILE"

echo -e "${GREEN}✅ Dashboard iniciado em background${NC}"
echo -e "${GREEN}   PID: $PID${NC}"
echo -e "${GREEN}   Log: $LOG_FILE${NC}"
echo -e "${GREEN}   Acesse: http://localhost:${PORT:-3000}${NC}\n"
echo -e "${YELLOW}Para parar, execute: ./stop.sh${NC}"
echo -e "${YELLOW}Para ver logs: tail -f $LOG_FILE${NC}"

