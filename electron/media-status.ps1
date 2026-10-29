$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Length -eq 1 -and $_.GetParameters().Length -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  $task = $asTask.MakeGenericMethod($managerType).Invoke($null, @($managerType::RequestAsync()))
  if (-not $task.Wait(10000)) { throw 'Media session timeout' }
  $manager = $task.Result
  while ($true) {
    $playing = $false
    foreach ($session in $manager.GetSessions()) {
      if ($session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') { $playing = $true; break }
    }
    @{available=$true; playing=$playing} | ConvertTo-Json -Compress
    Start-Sleep -Seconds 2
  }
} catch {
  '{"available":false,"playing":false}'
  exit 1
}
