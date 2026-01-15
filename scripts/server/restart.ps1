# Script para reiniciar o Dashboard no Windows

Write-Host "🔄 Reiniciando Dashboard..." -ForegroundColor Blue

# Parar processos Node.js relacionados ao dashboard
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⏹️  Parando processos Node.js existentes..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Verificar se há arquivo PID
$pidFile = Join-Path $PSScriptRoot "dashboard.pid"
if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# Aguardar um pouco
Start-Sleep -Seconds 1

# Iniciar novamente
Write-Host "🚀 Iniciando Dashboard..." -ForegroundColor Green
Set-Location $PSScriptRoot

# Iniciar em background
$job = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    npm start
}

# Salvar PID do job
$job.Id | Out-File -FilePath $pidFile -Encoding utf8

Write-Host "✅ Dashboard reiniciado!" -ForegroundColor Green
Write-Host "   Job ID: $($job.Id)" -ForegroundColor Cyan
Write-Host "   Para ver status: Get-Job" -ForegroundColor Yellow
Write-Host "   Para parar: Stop-Job -Id $($job.Id)" -ForegroundColor Yellow
Write-Host "   Para ver logs: Receive-Job -Id $($job.Id)" -ForegroundColor Yellow

