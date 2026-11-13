[CmdletBinding(SupportsShouldProcess = $true)]
param(
    # Path to your SillyTavern checkout. Pass it with -SillyTavernRoot or set
    # the SILLYTAVERN_ROOT environment variable once and forget about it.
    [string]$SillyTavernRoot = $env:SILLYTAVERN_ROOT
)

$ErrorActionPreference = 'Stop'

$sourceRoot = Split-Path -Parent $PSScriptRoot
$sourceFiles = @(
    'manifest.json',
    'index.js',
    'settings.html',
    'style.css'
)
# Directories that ship with the extension; samples/ is populated by
# scripts/download-samples.ps1 and is the big one (~300 MB of FluidR3 samples).
$sourceDirs = @('lib', 'samples', 'src')
$destination = Join-Path $SillyTavernRoot 'public\scripts\extensions\third-party\SillyTavern-Extension-Leitmotif'

if ([string]::IsNullOrWhiteSpace($SillyTavernRoot)) {
    throw 'Pass -SillyTavernRoot <path> or set the SILLYTAVERN_ROOT environment variable to your SillyTavern checkout.'
}

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

foreach ($dir in $sourceDirs) {
    $source = Join-Path $sourceRoot $dir
    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        Write-Warning "Skipping '$dir' (not present; run scripts\download-samples.ps1 to fetch the instrument samples)."
        continue
    }
    $target = Join-Path $destination $dir
    if ($PSCmdlet.ShouldProcess($target, "Sync directory $dir")) {
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        # Samples never change once fetched, so only copy those missing or
        # of a different size; redeploys stay fast instead of recopying 300 MB.
        foreach ($file in Get-ChildItem -LiteralPath $source -File -Recurse) {
            $relative = $file.FullName.Substring($source.Length).TrimStart('\', '/')
            $targetFile = Join-Path $target $relative
            # Code (lib/, src/) is always copied: an edit can keep a file's size.
            $needsCopy = $dir -ne 'samples' -or -not (Test-Path -LiteralPath $targetFile -PathType Leaf)
            if (-not $needsCopy) {
                $needsCopy = (Get-Item -LiteralPath $targetFile).Length -ne $file.Length
            }
            if ($needsCopy) {
                $targetDir = Split-Path -Parent $targetFile
                New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                Copy-Item -LiteralPath $file.FullName -Destination $targetFile -Force
            }
        }
    }
}

Write-Host "Deployment target: $destination"
