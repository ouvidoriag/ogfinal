#!/bin/bash

# Script para parar o Dashboard

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PID_FILE="dashboard.pid"

if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠️  Dashboard não está rodando (PID file não encontrado)${NC}"
    exit 1
fi

PID=$(cat "$PID_FILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Processo não está rodando (PID: $PID)${NC}"
    rm -f "$PID_FILE"
    exit 1
fi

echo -e "${YELLOW}🛑 Parando Dashboard (PID: $PID)...${NC}"

# Tentar parar graciosamente
kill "$PID" 2>/dev/null || true

# Aguardar até 10 segundos
for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Se ainda estiver rodando, forçar
if ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Forçando parada...${NC}"
    kill -9 "$PID" 2>/dev/null || true
    sleep 1
fi

# Remover PID file
rm -f "$PID_FILE"

if ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${RED}❌ Erro ao parar Dashboard${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Dashboard parado com sucesso${NC}"
fi

