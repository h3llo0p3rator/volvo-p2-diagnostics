$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$bin = Join-Path $here 'bin'
New-Item -ItemType Directory -Force -Path $bin | Out-Null
$csc = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
& $csc /nologo /platform:x86 /out:"$bin\J2534Helper.exe" /r:System.Web.Extensions.dll "$here\J2534Helper.cs"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$gcc = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter 'i686-w64-mingw32-gcc.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $gcc) { $gcc = Get-Command 'i686-w64-mingw32-gcc.exe' -ErrorAction SilentlyContinue }
if (-not $gcc) { throw '32-bit MinGW gcc was not found. Install LLVM MinGW and rerun this script.' }
& $gcc.FullName -shared -static-libgcc -o "$bin\mock_passthru.dll" "$here\mock_passthru.c" "$here\mock_passthru.def" "-Wl,--kill-at"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "built $bin"
