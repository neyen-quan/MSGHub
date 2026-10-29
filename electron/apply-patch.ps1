param(
  [Parameter(Mandatory=$true)][string]$InstallRoot,
  [Parameter(Mandatory=$true)][string]$PatchFile,
  [Parameter(Mandatory=$true)][string]$BackupRoot,
  [Parameter(Mandatory=$true)][int]$ParentPid
)

$ErrorActionPreference = 'Stop'
$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
$PatchFile = [IO.Path]::GetFullPath($PatchFile)
$startBat = Join-Path $InstallRoot 'INICIAR-WORKHUB.bat'
$BackupRoot = [IO.Path]::GetFullPath($BackupRoot)
$logFile = Join-Path $BackupRoot 'last-update.log'
$backupDir = Join-Path $BackupRoot (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
$stage = Join-Path $env:TEMP ('workhub-patch-' + [guid]::NewGuid().ToString('N'))
$changed = New-Object System.Collections.Generic.List[string]
$backedUp = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$zip = $null
$failure = $null

try {
  New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
  Set-Content -LiteralPath $logFile -Value ("INICIADO " + (Get-Date -Format o) + "`r`nProyecto: $InstallRoot`r`nParche: $PatchFile") -Encoding UTF8
  while (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 250 }
  if (-not (Test-Path -LiteralPath $startBat -PathType Leaf)) { throw 'No encuentro INICIAR-WORKHUB.bat en la carpeta del proyecto.' }
  New-Item -ItemType Directory -Force -Path $BackupRoot, $backupDir, $stage | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($PatchFile)
  if ($zip.Entries.Count -lt 1 -or $zip.Entries.Count -gt 200) { throw 'El parche tiene una cantidad de archivos no válida.' }
  $totalSize = 0L
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName.Replace('\','/')
    if ([string]::IsNullOrWhiteSpace($name) -or $name.StartsWith('/') -or $name -match '^[A-Za-z]:' -or ($name -split '/') -contains '..') { throw 'El ZIP contiene una ruta no válida.' }
    $parts = $name.TrimEnd('/').Split('/')
    $rootName = $parts[0]
    $allowed = ($rootName -in @('electron','src','scripts')) -or ($parts.Count -eq 1 -and $rootName -in @('package.json','package-lock.json','INICIAR-WORKHUB.bat','LEEME.txt','PATCH-INSTRUCCIONES.txt'))
    if (-not $allowed) { throw ("El parche intenta modificar una ubicación no permitida: " + $name) }
    if (-not $name.EndsWith('/')) {
      $totalSize += $entry.Length
      if ($totalSize -gt 50MB) { throw 'El contenido extraído supera los 50 MB.' }
    }
  }
  if ($totalSize -lt 1) { throw 'El ZIP no contiene archivos para actualizar.' }
  [IO.Compression.ZipFile]::ExtractToDirectory($PatchFile, $stage)
  $stageRoot = [IO.Path]::GetFullPath($stage).TrimEnd('\') + '\'
  $packageChanged = $false
  Get-ChildItem -LiteralPath $stage -File -Recurse | ForEach-Object {
    $source = [IO.Path]::GetFullPath($_.FullName)
    if (-not $source.StartsWith($stageRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'El ZIP contiene una ruta de extracción no válida.' }
    $relative = $source.Substring($stageRoot.Length)
    $destination = [IO.Path]::GetFullPath((Join-Path $InstallRoot $relative))
    $installPrefix = $InstallRoot.TrimEnd('\') + '\'
    if (-not $destination.StartsWith($installPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'El ZIP intenta salir de la carpeta de Workhub.' }
    $backup = Join-Path $backupDir $relative
    if (Test-Path -LiteralPath $destination -PathType Leaf) {
      $backupParent = Split-Path -Parent $backup
      New-Item -ItemType Directory -Force -Path $backupParent | Out-Null
      Copy-Item -LiteralPath $destination -Destination $backup -Force
      [void]$backedUp.Add($relative)
    }
    $parent = Split-Path -Parent $destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $changed.Add($relative)
    Copy-Item -LiteralPath $source -Destination $destination -Force
    if ($relative -ieq 'package.json' -or $relative -ieq 'package-lock.json') { $packageChanged = $true }
  }
  if ($packageChanged) {
    Push-Location $InstallRoot
    try { & npm.cmd install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm install no pudo completar las dependencias.' } }
    finally { Pop-Location }
  }
  Set-Content -LiteralPath $logFile -Value ("OK " + (Get-Date -Format o) + "`r`nParche: $PatchFile`r`nRespaldo: $backupDir`r`nArchivos: " + ($changed -join ', ')) -Encoding UTF8
} catch {
  $failure = $_.Exception.Message
  foreach ($relative in $changed) {
    try {
      $destination = Join-Path $InstallRoot $relative
      if ($backedUp.Contains($relative)) { Copy-Item -LiteralPath (Join-Path $backupDir $relative) -Destination $destination -Force }
      elseif (Test-Path -LiteralPath $destination -PathType Leaf) { Remove-Item -LiteralPath $destination -Force }
    } catch { $failure += "`r`nNo se pudo restaurar $relative : $($_.Exception.Message)" }
  }
  New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
  Set-Content -LiteralPath $logFile -Value ("ERROR " + (Get-Date -Format o) + "`r`n$failure") -Encoding UTF8
} finally {
  if ($zip) { $zip.Dispose() }
  if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
}

if (Test-Path -LiteralPath $startBat) {
  Start-Sleep -Seconds 3
  try {
    Start-Process -FilePath $startBat -WorkingDirectory $InstallRoot -WindowStyle Normal
    if (-not $failure) { Add-Content -LiteralPath $logFile -Value ("`r`nREINICIO INICIADO " + (Get-Date -Format o)) -Encoding UTF8 }
  } catch {
    $failure = "El parche se aplicó, pero no pude volver a abrir Workhub: $($_.Exception.Message)"
    Add-Content -LiteralPath $logFile -Value ("`r`nERROR DE REINICIO " + $failure) -Encoding UTF8
  }
}
if ($failure) {
  try { (New-Object -ComObject WScript.Shell).Popup("No se pudo aplicar el parche. Se intentó restaurar los archivos anteriores.`n`n$failure`n`nDetalle: $logFile", 0, 'Workhub — actualización fallida', 16) | Out-Null } catch {}
}
