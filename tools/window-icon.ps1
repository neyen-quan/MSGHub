param([long]$WindowHandle,[string]$ResourcePath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MSGHubIconProbe {
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd,uint msg,IntPtr wp,IntPtr lp);
}
'@
if($ResourcePath){
 if([IO.Path]::GetExtension($ResourcePath) -eq '.ico'){$sourceIcon=[System.Drawing.Icon]::new($ResourcePath,32,32)}
 else{$sourceIcon=[System.Drawing.Icon]::ExtractAssociatedIcon($ResourcePath)}
 if(!$sourceIcon){throw 'Missing shell icon resource'}
 $bitmap=$sourceIcon.ToBitmap()
}else{
$hwnd=[IntPtr]::new($WindowHandle)
$icon=[IntPtr]::Zero
foreach($kind in @(2,0,1)){
 $icon=[MSGHubIconProbe]::SendMessage($hwnd,0x007F,[IntPtr]::new($kind),[IntPtr]::Zero)
 if($icon -ne [IntPtr]::Zero){break}
}
if($icon -eq [IntPtr]::Zero){throw 'Window has no native icon'}
$bitmap=[System.Drawing.Icon]::FromHandle($icon).ToBitmap()
}
try{
 $green=0
 for($y=0;$y -lt $bitmap.Height;$y++){for($x=0;$x -lt $bitmap.Width;$x++){$c=$bitmap.GetPixel($x,$y);if($c.A -gt 100 -and $c.G -gt 100 -and $c.G -gt ($c.R * 1.15) -and $c.G -gt ($c.B * 1.15)){$green++}}}
 @{width=$bitmap.Width;height=$bitmap.Height;greenPixels=$green}|ConvertTo-Json -Compress
}finally{$bitmap.Dispose();if($sourceIcon){$sourceIcon.Dispose()}}
