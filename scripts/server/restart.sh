#!/bin/bash

# Script para reiniciar o Dashboard

set -e

echo "🔄 Reiniciando Dashboard..."

# Parar se estiver rodando
if [ -f "stop.sh" ]; then
    ./stop.sh 2>/dev/null || true
fi

# Aguardar um pouco
sleep 2

# Iniciar novamente
if [ -f "start-background.sh" ]; then
    ./start-background.sh
else
    ./start.sh
fi

