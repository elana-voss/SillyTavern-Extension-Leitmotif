[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# The instrument list has a single source of truth: score.mjs. Ask Node for it.
$sourceRoot = Split-Path -Parent $PSScriptRoot
$scoreModule = Join-Path $sourceRoot 'score.mjs'
if (-not (Test-Path -LiteralPath $scoreModule -PathType Leaf)) {
    throw "score.mjs was not found: $scoreModule"
}

Push-Location $sourceRoot
try {
    $names = @(& node --input-type=module -e "import { INSTRUMENTS } from './score.mjs'; for (const name of Object.keys(INSTRUMENTS)) console.log(name);")
} finally {
    Pop-Location
}

if ($LASTEXITCODE -ne 0 -or $names.Count -lt 120) {
    throw 'Could not read the instrument list from score.mjs. Is Node.js on PATH?'
}

$samplesDir = Join-Path $sourceRoot 'samples'
New-Item -ItemType Directory -Path $samplesDir -Force | Out-Null

$downloaded = 0
$skipped = 0
foreach ($name in $names) {
    if ($name -notmatch '^[a-z0-9_]+$') {
        throw "Unexpected instrument name in score.mjs: $name"
    }
    $file = Join-Path $samplesDir "$name-mp3.js"
    if ((Test-Path -LiteralPath $file -PathType Leaf) -and -not $Force) {
        $skipped += 1
        continue
    }
    Write-Host "Downloading $name-mp3.js ..."
    # Download to a temporary name and move into place only on success, so a
    # dropped connection can never leave a partial file that looks complete.
    $tempFile = "$file.tmp"
    try {
        Invoke-WebRequest -Uri "$BaseUrl/$name-mp3.js" -OutFile $tempFile -TimeoutSec 120 -MaximumRetryCount 3 -RetryIntervalSec 2
        Move-Item -LiteralPath $tempFile -Destination $file -Force
    } finally {
        if (Test-Path -LiteralPath $tempFile -PathType Leaf) {
            Remove-Item -LiteralPath $tempFile -Force
        }
    }
    $downloaded += 1
}

Write-Host "Samples ready in $samplesDir (downloaded $downloaded, already present $skipped, of $($names.Count))."