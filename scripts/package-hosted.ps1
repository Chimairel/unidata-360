[CmdletBinding()]
param(
  [ValidateSet('Railway', 'Vercel')][string]$Platform = 'Railway',
  [string]$RailwayApiOrigin
)

$ErrorActionPreference = 'Stop'
if ($RailwayApiOrigin) {
  $origin = [uri]$RailwayApiOrigin
  if ($Platform -ne 'Vercel' -or !$origin.IsAbsoluteUri -or $origin.Scheme -ne 'https' -or
      !$origin.Host.EndsWith('.up.railway.app') -or $RailwayApiOrigin -cne "https://$($origin.Host)") {
    throw 'Use -RailwayApiOrigin with -Platform Vercel and the exact Railway HTTPS origin.'
  }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stage = Join-Path $root ('tmp/hosted-' + [guid]::NewGuid().ToString('N'))
$files = @('package.json', 'package-lock.json', 'tsconfig.json', 'frontend/package.json', 'backend/package.json')
if ($Platform -eq 'Railway') {
  $files += @('Dockerfile', '.dockerignore', 'scripts/start-hosted.mjs', 'scripts/create-account.ts')
}

$trees = @('shared')
if ($Platform -eq 'Railway') { $trees += 'backend' } else { $trees += 'frontend' }
foreach ($tree in $trees) {
  $source = Join-Path $root $tree
  if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw "Unexpected link at $tree"
  }
  $queue = [System.Collections.Generic.Queue[string]]::new()
  $queue.Enqueue($source)
  while ($queue.Count -gt 0) {
    foreach ($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force) {
      if (!$entry.PSIsContainer -and $entry.Name -like '.env*') { continue }
      if ($entry.Name -in @('.next', '.local-email', 'node_modules', 'next-env.d.ts', 'AGENTS.md') -or $entry.Extension -eq '.tsbuildinfo') { continue }
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "Unexpected link in $tree"
      }
      $relativePath = $entry.FullName.Substring($root.Length + 1).Replace('\', '/')
      if ($entry.PSIsContainer) { $queue.Enqueue($entry.FullName); continue }
      if ($entry.Extension -notin @('.ts', '.tsx', '.css', '.svg', '.ico') -and $entry.Name -notin @('package.json', 'tsconfig.json')) {
        throw "Unexpected file type in deployment source: $($entry.Name)"
      }
      $files += $relativePath
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
  if (!$RailwayApiOrigin) { throw 'Supply the Railway backend origin with -RailwayApiOrigin.' }
  # The CLI uploads this directory as a standalone Next.js frontend.
  Copy-Item -LiteralPath (Join-Path $stage 'frontend/app') -Destination (Join-Path $stage 'app') -Recurse
  Copy-Item -LiteralPath (Join-Path $stage 'frontend/public') -Destination (Join-Path $stage 'public') -Recurse
  $nextConfig = Get-Content -LiteralPath (Join-Path $stage 'frontend/next.config.ts') -Raw
  $nextConfig = $nextConfig.Replace('path.resolve(__dirname, "..")', 'path.resolve(__dirname)')
  $nextConfig = $nextConfig.Replace('process.env.BACKEND_URL || "http://localhost:3006"', ($RailwayApiOrigin | ConvertTo-Json -Compress))
  Set-Content -LiteralPath (Join-Path $stage 'next.config.ts') -Value $nextConfig -Encoding utf8
  $config = @{ framework = 'nextjs'; regions = @('sin1'); buildCommand = 'next build' }
  if ($RailwayApiOrigin) {
    $apiRoute = '/api/:path*'
    $config.rewrites = @(@{ source = $apiRoute; destination = $RailwayApiOrigin + $apiRoute })
    $config.headers = @(@{
      source = $apiRoute
      headers = @(@{ key = 'x-vercel-enable-rewrite-caching'; value = '0' })
    })
  }
  Set-Content -LiteralPath (Join-Path $stage 'vercel.json') -Value ($config | ConvertTo-Json -Depth 6) -Encoding ascii
}
Write-Output $stage
