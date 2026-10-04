<#
.SYNOPSIS
    Starts the ALIGN dev stack — FastAPI backend (port 8000) + Vite frontend — with one command.

.DESCRIPTION
    By default each server runs in its own PowerShell window so their reload logs stay
    separate and you can Ctrl+C either one independently. Pass -Same to run both in the
    current terminal with interleaved output instead.

.EXAMPLE
    .\dev.ps1
    .\dev.ps1 -Same
#>
[CmdletBinding()]
param(
    # Run both servers in this one terminal (interleaved output) instead of two windows.
    [switch]$Same
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# Invoke the environment's Python directly: console launchers and activation scripts
# can retain absolute paths to the old location after the repository is moved.
$backend = "cd '$root\backend'; & '.\.venv\Scripts\python.exe' -m uvicorn main:app --reload --port 8000"
$frontend = "cd '$root\frontend'; npm run dev"

if ($Same) {
    # One window: launch the backend as a background job, run the frontend in the foreground.
    Write-Host 'Starting backend + frontend in this terminal (Ctrl+C to stop)...' -ForegroundColor Cyan
    $job = Start-Job -ScriptBlock { param($cmd) powershell -NoProfile -Command $cmd } -ArgumentList $backend
    try {
        Invoke-Expression $frontend
    }
    finally {
        Stop-Job $job -ErrorAction SilentlyContinue
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    }
}
else {
    # Two windows: one per server.
    Write-Host 'Launching backend (:8000) and frontend (:5173) in separate windows...' -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @('-NoExit', '-Command', $backend)
    Start-Process powershell -ArgumentList @('-NoExit', '-Command', $frontend)
}
