#!/bin/bash

# Script para verificar status do Dashboard

PID_FILE="dashboard.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "❌ Dashboard não está rodando"
    exit 1
fi

PID=$(cat "$PID_FILE")

if ps -p "$PID" > /dev/null 2>&1; then
    echo "✅ Dashboard está rodando"
    echo "   PID: $PID"
    
    # Mostrar informações do processo
    echo ""
    echo "📊 Informações do processo:"
    ps -p "$PID" -o pid,ppid,cmd,%mem,%cpu,etime
    
    # Mostrar últimas linhas do log
    if [ -f "dashboard.log" ]; then
        echo ""
        echo "📝 Últimas linhas do log:"
        tail -n 5 dashboard.log
    fi
else
    echo "❌ Dashboard não está rodando (PID file existe mas processo não encontrado)"
    rm -f "$PID_FILE"
    exit 1
fi

