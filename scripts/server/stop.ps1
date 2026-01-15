# Script para parar o Dashboard no Windows

Write-Host "Parando Dashboard..." -ForegroundColor Yellow

# Parar processos Node.js
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "   Parando $($nodeProcesses.Count) processo(s) Node.js..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "Processos parados!" -ForegroundColor Green
} else {
    Write-Host "Nenhum processo Node.js encontrado." -ForegroundColor Cyan
}

# Remover arquivo PID se existir
$pidFile = Join-Path $PSScriptRoot "dashboard.pid"
if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Arquivo PID removido." -ForegroundColor Green
}

# Parar jobs do PowerShell se houver
$jobs = Get-Job -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Running' }
if ($jobs) {
    Write-Host "   Parando $($jobs.Count) job(s) do PowerShell..." -ForegroundColor Yellow
    $jobs | Stop-Job -ErrorAction SilentlyContinue
    $jobs | Remove-Job -ErrorAction SilentlyContinue
    Write-Host "Jobs parados!" -ForegroundColor Green
}

Write-Host "Dashboard parado!" -ForegroundColor Green
