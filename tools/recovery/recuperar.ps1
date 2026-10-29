param([string]$Root,[switch]$NoDialogs,[switch]$NoLaunch)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Management
function Hash-File([string]$File){$h=[Security.Cryptography.SHA256]::Create();try{([BitConverter]::ToString($h.ComputeHash([IO.File]::ReadAllBytes($File)))).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}}
function Read-Json([string]$File){[IO.File]::ReadAllText($File)|ConvertFrom-Json}
function Write-Atomic([string]$Source,[string]$Destination){
 $temporary=$Destination+'.'+[Guid]::NewGuid().ToString()+'.tmp'
 try{
  [IO.File]::Copy($Source,$temporary,$false)
  $until=[DateTime]::UtcNow.AddSeconds(60)
  while($true){try{[IO.File]::Replace($temporary,$Destination,[NullString]::Value);break}catch{
   $cause=$_.Exception;while($cause.InnerException){$cause=$cause.InnerException}
   if(($cause -isnot [IO.IOException] -and $cause -isnot [UnauthorizedAccessException]) -or [DateTime]::UtcNow -ge $until){throw}
   Start-Sleep -Milliseconds 200
  }}
 }finally{if([IO.File]::Exists($temporary)){[IO.File]::Delete($temporary)}}
}
function Restore-MSGHub([string]$Folder){
 $Folder=[IO.Path]::GetFullPath($Folder).TrimEnd('\')
 $updates=Join-Path $Folder '.msghub-updates'
 if(Test-Path -LiteralPath (Join-Path $updates 'active.json')){throw 'Hay una instalacion pendiente. Se conservaron todos los archivos sin cambios.'}
 $package=Read-Json (Join-Path $Folder 'package.json')
 $main=Join-Path $Folder 'electron\main.cjs'
 if($package.name -ne 'msg-hub-desktop' -or $package.version -ne '1.7.0' -or [IO.File]::ReadAllText($main).Trim() -ne "require('./transition/wizard.cjs');"){
  throw 'Esta herramienta corresponde solamente a la transicion detenida en 1.7.0. Se conservo tu instalacion sin cambios.'
 }
 $found=$null
 foreach($directory in Get-ChildItem -LiteralPath $updates -Directory|Sort-Object LastWriteTime -Descending){
  if($directory.Name -notmatch '^[a-f0-9-]{36}$'){continue}
  $journalFile=Join-Path $directory.FullName 'journal.json'
  if(!(Test-Path -LiteralPath $journalFile)){continue}
  $journal=Read-Json $journalFile
  if($journal.state -ne 'complete' -or $journal.to -ne '1.7.0' -or $journal.from -notin @('1.6.0','1.6.1')){continue}
  $backup=Join-Path $directory.FullName 'backup'
  $old=Read-Json (Join-Path $backup 'package.json')
  $oldMain=Join-Path $backup 'electron\main.cjs'
  if($old.name -ne 'msg-hub-desktop' -or $old.version -ne $journal.from -or $old.main -ne 'electron/main.cjs' -or !(Test-Path -LiteralPath $oldMain)){continue}
  if(![IO.File]::ReadAllText($oldMain).Contains('agency.neyen.msghub')){continue}
  foreach($name in @('package.json','electron/main.cjs')){
   $entry=@($journal.entries|Where-Object {$_.path -eq $name})
   if($entry.Count -ne 1 -or !$entry[0].existed -or (Hash-File (Join-Path $Folder $name)) -ne $entry[0].sha256){throw 'Los archivos actuales no coinciden con esta transicion. No se modificaron.'}
  }
  $found=@{Backup=$backup;Version=$old.version};break
 }
 if(!$found){throw 'No se encontro un respaldo compatible. No se modifico el programa.'}
 if(!$NoDialogs){
  $choice=[Windows.Forms.MessageBox]::Show("Se restauraran solamente electron\main.cjs y package.json desde tu respaldo local. Se cerraran los procesos de MSG Hub de esta carpeta. Se conservan las sesiones, notas, tareas, preferencias y reloj.`n`nCarpeta: $Folder`nVersion a recuperar: $($found.Version)",'Recuperar MSG Hub',[Windows.Forms.MessageBoxButtons]::OKCancel,[Windows.Forms.MessageBoxIcon]::Question)
  if($choice -ne [Windows.Forms.DialogResult]::OK){return $null}
 }
 # Match only this installation's executable paths. Never stop all Electron apps.
 $images=@('MSGHub.exe','runtime\MSGHub.exe','runtime\MSGHubEngine.exe','node_modules\electron\dist\electron.exe')|ForEach-Object {(Join-Path $Folder $_).ToLowerInvariant()}
 $search=[Management.ManagementObjectSearcher]::new('SELECT ExecutablePath,ProcessId FROM Win32_Process')
 try{foreach($process in $search.Get()){if($process.ExecutablePath -and $images -contains $process.ExecutablePath.ToLowerInvariant()){try{[Diagnostics.Process]::GetProcessById([int]$process.ProcessId).Kill()}catch{}}}}finally{$search.Dispose()}
 Start-Sleep -Milliseconds 500
 if(Test-Path -LiteralPath (Join-Path $updates 'active.json')){throw 'Se inicio otra actualizacion. Se conservaron los archivos sin cambios.'}
 $checkpoint=Join-Path $updates ('recovery-'+[Guid]::NewGuid().ToString())
 [IO.Directory]::CreateDirectory((Join-Path $checkpoint 'electron'))|Out-Null
 foreach($name in @('package.json','electron/main.cjs')){[IO.File]::Copy((Join-Path $Folder $name),(Join-Path $checkpoint $name),$false)}
 try{
  foreach($name in @('electron/main.cjs','package.json')){Write-Atomic (Join-Path $found.Backup $name) (Join-Path $Folder $name)}
 }catch{
  foreach($name in @('electron/main.cjs','package.json')){Write-Atomic (Join-Path $checkpoint $name) (Join-Path $Folder $name)}
  throw
 }
 $result=Join-Path $updates 'result.json';if(Test-Path -LiteralPath $result){[IO.File]::Move($result,(Join-Path $checkpoint 'previous-result.json'))}
 $receipt=@{ok=$true;version=$found.Version;root=$Folder;restored=@('electron/main.cjs','package.json');backup=$checkpoint}
 [IO.File]::WriteAllText((Join-Path $checkpoint 'recovery.json'),($receipt|ConvertTo-Json -Depth 5))
 return $receipt
}
try{
 if(!$Root){
  $pick=New-Object Windows.Forms.OpenFileDialog;$pick.Title='Selecciona el MSGHub.exe que dejo de abrir';$pick.Filter='MSGHub.exe|MSGHub.exe';$pick.CheckFileExists=$true
  if($pick.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){exit 0}
  $Root=[IO.Path]::GetDirectoryName($pick.FileName)
 }
 $receipt=Restore-MSGHub $Root
 if(!$receipt){exit 0}
 if(!$NoLaunch){Start-Process -FilePath (Join-Path $receipt.root 'MSGHub.exe') -WorkingDirectory $receipt.root}
 if(!$NoDialogs){[Windows.Forms.MessageBox]::Show("Se recupero MSG Hub $($receipt.version). Conserva la carpeta completa y sus respaldos. Cuando abra, podes instalar el nuevo ZIP de transicion corregido desde Actualizar.",'MSG Hub recuperado')|Out-Null}
 $receipt|ConvertTo-Json -Depth 5
}catch{
 if(!$NoDialogs){[Windows.Forms.MessageBox]::Show($_.Exception.Message,'No se completo la recuperacion',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error)|Out-Null}
 Write-Error $_;exit 1
}
