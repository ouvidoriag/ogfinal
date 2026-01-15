#!/bin/bash
# Script de Limpeza para Deploy em VPS
# Remove arquivos pesados e desnecessários
# CÉREBRO X-3

echo "🧹 Iniciando limpeza do sistema para deploy..."

# Navegar para o diretório do projeto
cd "$(dirname "$0")/.." || exit

# Remover node_modules (será reinstalado no servidor)
echo "📦 Removendo node_modules..."
rm -rf node_modules/

# Remover ambiente virtual Python (será recriado no servidor)
echo "🐍 Removendo ambiente virtual Python..."
rm -rf venv/

# Remover logs
echo "📝 Removendo logs..."
rm -rf logs/*.log
rm -rf logs/*.log.*

# Remover cache do banco
echo "💾 Removendo cache do banco..."
rm -rf db-data/*

# Remover arquivos temporários
echo "🗑️  Removendo arquivos temporários..."
rm -rf .cache/
rm -rf .temp/
rm -rf tmp/
rm -rf temp/

# Remover arquivos de build (se existirem)
echo "🔨 Removendo arquivos de build..."
rm -rf dist/
rm -rf build/

# Remover coverage e testes
echo "🧪 Removendo arquivos de teste..."
rm -rf coverage/
rm -rf .nyc_output/

# Remover arquivos do sistema operacional
echo "💻 Removendo arquivos do sistema..."
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete
find . -name "desktop.ini" -type f -delete

# Remover arquivos de backup
echo "💾 Removendo backups..."
find . -name "*.bak" -type f -delete
find . -name "*~" -type f -delete

# Limpar npm cache
echo "🧹 Limpando cache npm..."
npm cache clean --force 2>/dev/null || true

echo ""
echo "✅ Limpeza concluída!"
echo ""
echo "📊 Tamanho atual do projeto:"
du -sh . 2>/dev/null || echo "Não foi possível calcular o tamanho"
echo ""
echo "📋 Próximos passos:"
echo "1. Comprimir o projeto: tar -czf dashboard.tar.gz ."
echo "2. Transferir para VPS: scp dashboard.tar.gz usuario@servidor:/var/www/"
echo "3. No servidor: tar -xzf dashboard.tar.gz"
echo "4. Instalar dependências: npm install"
echo "5. Configurar .env e google-credentials.json"
echo "6. Iniciar com PM2: pm2 start src/server.js --name ouvidoria-dashboard"
