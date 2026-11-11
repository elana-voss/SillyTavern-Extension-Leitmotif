[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$SillyTavernRoot = 'C:\path\to\SillyTavern'
)

$ErrorActionPreference = 'Stop'

$sourceRoot = Split-Path -Parent $PSScriptRoot
$sourceFiles = @(
    'manifest.json',
    'index.js',
    'score.mjs',
    'settings.html',
    'style.css'
)
$destination = Join-Path $SillyTavernRoot 'public\scripts\extensions\third-party\SillyTavern-Extension-Midi'

if (-not (Test-Path -LiteralPath $SillyTavernRoot -PathType Container)) {
    throw "SillyTavern root was not found: $SillyTavernRoot"
}

foreach ($file in $sourceFiles) {
    $source = Join-Path $sourceRoot $file
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Required extension file was not found: $source"
    }
}

if (-not (Test-Path -LiteralPath $destination -PathType Container)) {
    if ($PSCmdlet.ShouldProcess($destination, 'Create extension directory')) {
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
    }
}

foreach ($file in $sourceFiles) {
    $source = Join-Path $sourceRoot $file
    $target = Join-Path $destination $file
    if ($PSCmdlet.ShouldProcess($target, 'Copy extension file')) {
        Copy-Item -LiteralPath $source -Destination $target -Force
    }
}

Write-Host "Deployment target: $destination"
