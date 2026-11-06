[CmdletBinding()]
param([ValidateSet('Railway', 'Vercel')][string]$Platform = 'Railway')

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stage = Join-Path $root ('tmp/hosted-' + [guid]::NewGuid().ToString('N'))
$files = @('package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json')
if ($Platform -eq 'Railway') {
  $files += @('Dockerfile', '.dockerignore', 'scripts/start-hosted.mjs', 'scripts/create-account.ts')
}

foreach ($tree in @('src', 'public')) {
  $source = Join-Path $root $tree
  if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw "Unexpected link at $tree"
  }
  $queue = [System.Collections.Generic.Queue[string]]::new()
  $queue.Enqueue($source)
  while ($queue.Count -gt 0) {
    foreach ($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force) {
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "Unexpected link in $tree"
      }
      if ($entry.PSIsContainer) { $queue.Enqueue($entry.FullName); continue }
      if ($entry.Extension -notin @('.ts', '.tsx', '.css', '.svg', '.ico')) {
        throw "Unexpected file type in deployment source: $($entry.Name)"
      }
      $files += $entry.FullName.Substring($root.Length + 1)
    }
  }
}

foreach ($file in $files) {
  $source = Join-Path $root $file
  if ((Get-Item -LiteralPath $source -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw "Unexpected link: $file"
  }
  $target = Join-Path $stage $file
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target
}
if ($Platform -eq 'Vercel') {
  Set-Content -LiteralPath (Join-Path $stage 'vercel.json') -Value '{"framework":"nextjs","regions":["sin1"]}' -Encoding ascii
}
Write-Output $stage
