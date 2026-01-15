@echo off
echo ========================================
echo   Corrigir Erro de Permissao Prisma
echo ========================================
echo.

echo 1. Fechando processos Node.js...
taskkill /F /IM node.exe 2>nul
if %errorlevel% == 0 (
    echo    Processos Node.js fechados.
) else (
    echo    Nenhum processo Node.js encontrado.
)
echo.

echo 2. Aguardando 3 segundos...
timeout /t 3 /nobreak >nul
echo.

echo 3. Gerando Prisma Client...
cd /d "%~dp0.."
call npx prisma generate

if %errorlevel% == 0 (
    echo.
    echo ========================================
    echo   Prisma Client gerado com sucesso!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   Erro ao gerar Prisma Client
    echo ========================================
    echo.
    echo Tente:
    echo   1. Executar este script como Administrador
    echo   2. Desabilitar temporariamente o antivirus
    echo   3. Verificar se a pasta node_modules nao esta bloqueada
    echo.
)

pause

