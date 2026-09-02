# Root DepthWizard Development Launcher
$innerScript = Join-Path $PSScriptRoot "sih-2026\run_dev.ps1"
if (Test-Path $innerScript) {
    & $innerScript
} else {
    Write-Error "Could not locate sih-2026\run_dev.ps1"
}
