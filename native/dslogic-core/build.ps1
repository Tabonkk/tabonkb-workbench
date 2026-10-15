#requires -Version 5.1
<#
.SYNOPSIS
  dslogic-core repeatable build+packaging script.

.DESCRIPTION
  1) Build official kernel + glue via MSYS2/UCRT64 toolchain (gcc+cmake+ninja) -> build/
  2) Collect exe + all transitive dependency DLLs -> bin/dslogic-core/
  3) Package trimmed Python stdlib (same version as compile headers) -> bin/dslogic-core/python/
  4) Copy vendor decoders -> bin/dslogic-core/decoders/ (default <exe>/decoders)

  Bundle is self-contained: no msys64 PATH, no DSLCORE_PYTHON_HOME, no system Python.

.PARAMETER MsysRoot  MSYS2 root (default D:\msys64)
.PARAMETER Clean     wipe build/ and bin/dslogic-core/ before building
#>
param(
    [string]$MsysRoot = 'D:\msys64',
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path          # native/dslogic-core
$plugin = Split-Path -Parent (Split-Path -Parent $root)          # plugin root
$ucrt = Join-Path $MsysRoot 'ucrt64'
$out = Join-Path $root 'bin\dslogic-core'
$build = Join-Path $root 'build'

Write-Host '== dslogic-core build ==' -ForegroundColor Cyan
Write-Host "msys2 : $ucrt"
Write-Host "src   : $root"
Write-Host "out   : $out"

# ---------- 0. toolchain ----------
foreach ($t in @("$ucrt\bin\gcc.exe", "$ucrt\bin\cmake.exe", "$ucrt\bin\ninja.exe")) {
    if (-not (Test-Path $t)) { throw "missing build tool: $t" }
}
$env:PATH = "$ucrt\bin;$env:PATH"

if ($Clean) {
    if (Test-Path $build) { Remove-Item -Recurse -Force $build }
    if (Test-Path $out) { Remove-Item -Recurse -Force $out }
}
New-Item -ItemType Directory -Force -Path $build, $out | Out-Null

# ---------- 1. compile ----------
$ucrtFwd = $ucrt.Replace('\','/')
cmake -S $root -B $build -G Ninja -DCMAKE_BUILD_TYPE=Release "-DPython3_ROOT_DIR=$ucrtFwd" | Out-Host
ninja -C $build | Out-Host
$exe = Join-Path $build 'dslogic-core.exe'
if (-not (Test-Path $exe)) { throw "build failed: $exe not produced" }
Copy-Item $exe (Join-Path $out 'dslogic-core.exe') -Force

# ---------- 2. collect transitive DLL deps via objdump ----------
$systemDlls = @(
    'KERNEL32.dll','msvcrt.dll','ntdll.dll','USER32.dll','GDI32.dll','ADVAPI32.dll',
    'SHELL32.dll','ole32.dll','OLEAUT32.dll','WS2_32.dll','COMDLG32.dll','COMCTL32.dll',
    'CRYPT32.dll','SETUPAPI.dll','VERSION.dll','WINMM.dll','WINSPOOL.DRV','RPCRT4.dll',
    'SHLWAPI.dll','USP10.dll','DNSAPI.dll','IPHLPAPI.DLL','NETAPI32.dll','bcrypt.dll',
    'CFG-MGR32.dll','cfgmgr32.dll','DPAPI.dll','POWRPROF.dll','secur32.dll','IMM32.dll',
    'ucrtbase.dll'
)
$ucrtBin = Join-Path $ucrt 'bin'
$seen = @{}
$queue = New-Object System.Collections.Generic.Queue[string]
$queue.Enqueue($exe)

while ($queue.Count) {
    $f = $queue.Dequeue()
    $deps = & "$ucrtBin\objdump.exe" -p $f 2>$null | Select-String 'DLL Name:\s*(\S+)' |
            ForEach-Object { $_.Matches[0].Groups[1].Value }
    foreach ($d in $deps) {
        if ($seen.ContainsKey($d)) { continue }
        $seen[$d] = $true
        if ($systemDlls -contains $d -or $d -like 'api-ms-win-*') { continue }
        $src = Join-Path $ucrtBin $d
        if (Test-Path $src) {
            Copy-Item $src (Join-Path $out $d) -Force
            if ($d -like '*.dll') { $queue.Enqueue($src) }
        } else {
            Write-Warning "dependency not found under ucrt64/bin: $d"
        }
    }
}
$dllCount = (Get-ChildItem $out -Filter *.dll).Count
Write-Host "collected DLLs: $dllCount"

# ---------- 3. trimmed Python stdlib (same version as compile headers: ucrt64 python3.14) ----------
$pylib = Join-Path $ucrt 'lib\python3.14'
if (-not (Test-Path $pylib)) { throw "not found: $pylib" }
$pyOut = Join-Path $out 'python'
$pyLibOut = Join-Path $pyOut 'lib\python3.14'
New-Item -ItemType Directory -Force -Path $pyLibOut | Out-Null

$excludeDirs = @('test','tests','idlelib','tkinter','turtledemo','ensurepip','lib2to3',
                 'pydoc_data','unittest','site-packages','__pycache__')
$srcLen = $pylib.Length
Get-ChildItem $pylib -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($srcLen).TrimStart('\')
    $top = ($rel -split '[\/]')[0].ToLower()
    $skip = ($_.Extension -eq '.pyc') -or ($excludeDirs -contains $top) -or ($rel -match '__pycache__')
    if (-not $skip) {
        $dst = Join-Path $pyLibOut $rel
        New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
        Copy-Item $_.FullName $dst -Force
    }
}
$pyCount = (Get-ChildItem $pyLibOut -Recurse -File).Count
Write-Host "python stdlib files: $pyCount"

# ---------- 4. decoders ----------
$vd = Join-Path $plugin 'vendor\dslogic\decoders'
if (Test-Path $vd) {
    Copy-Item $vd (Join-Path $out 'decoders') -Recurse -Force
    $decCount = (Get-ChildItem (Join-Path $out 'decoders') -Recurse -Filter *.py).Count
    Write-Host "decoder .py files: $decCount"
} else {
    Write-Warning "vendor decoders missing: $vd"
}

# ---------- 5. self-contained smoke: no msys64 PATH, no DSLCORE_PYTHON_HOME ----------
Write-Host ''
Write-Host '== self-contained smoke ==' -ForegroundColor Cyan
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = Join-Path $out 'dslogic-core.exe'
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.EnvironmentVariables.Clear()
$psi.EnvironmentVariables['PATH'] = 'C:\Windows\System32;C:\Windows'
$pr = [System.Diagnostics.Process]::Start($psi)
$pr.StandardInput.WriteLine('{"id":1,"method":"ping","params":{}}')
$pr.StandardInput.Close()
$hello = $pr.StandardOutput.ReadLine()
$pong = $pr.StandardOutput.ReadLine()
$err = $pr.StandardError.ReadToEnd()
$pr.WaitForExit(60000) | Out-Null
if ($hello -match '"ready"\s*:\s*true' -and $pong -match '"pong"\s*:\s*true') {
    Write-Host 'smoke ok: hello+pong (no msys64 PATH / no DSLCORE_PYTHON_HOME)'
} else {
    Write-Warning ("smoke output: {0} | {1} | stderr: {2}" -f $hello, $pong, $err.Substring(0,[Math]::Min(400,$err.Length)))
    throw 'self-contained smoke failed'
}
Write-Host ''
Write-Host "done: $out" -ForegroundColor Green
