#!/bin/bash

# Script de inicialização do Dashboard de Ouvidoria
# Para rodar em Linux

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏛️  Dashboard de Ouvidoria - Duque de Caxias${NC}"
echo -e "${BLUE}=============================================${NC}\n"

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não está instalado!${NC}"
    echo -e "${YELLOW}Instale Node.js 18+ em: https://nodejs.org/${NC}"
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js versão 18+ é necessária! Versão atual: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) encontrado${NC}"

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não está instalado!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm $(npm -v) encontrado${NC}\n"

# Verificar se .env existe
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado!${NC}"
    echo -e "${YELLOW}Criando .env a partir do exemplo...${NC}"
    
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Configure as variáveis de ambiente no arquivo .env${NC}"
    else
        echo -e "${RED}❌ Arquivo .env.example não encontrado!${NC}"
        echo -e "${YELLOW}Crie um arquivo .env com as seguintes variáveis:${NC}"
        echo "  - MONGODB_ATLAS_URL"
        echo "  - PORT (opcional, padrão: 3000)"
        echo "  - GEMINI_API_KEY (opcional)"
        exit 1
    fi
fi

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependências...${NC}"
    npm install
    echo -e "${GREEN}✅ Dependências instaladas${NC}\n"
fi

# Verificar se Prisma está configurado
if [ ! -d "node_modules/.prisma" ]; then
    echo -e "${YELLOW}🔧 Gerando cliente Prisma...${NC}"
    npm run prisma:generate
    echo -e "${GREEN}✅ Cliente Prisma gerado${NC}\n"
fi

# Porta padrão
PORT=${PORT:-3000}

echo -e "${BLUE}🚀 Iniciando servidor na porta ${PORT}...${NC}\n"

# Iniciar servidor
npm start

