# Servidor local mínimo para instalar e usar o SEI Analista como PWA.
# Escuta somente em localhost: nunca expõe a bancada à rede.
$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:8080/')

try {
  $listener.Start()
  Start-Process 'http://localhost:8080/'
  Write-Host ''
  Write-Host 'SEI Analista disponível em http://localhost:8080/' -ForegroundColor Green
  Write-Host 'Mantenha esta janela aberta enquanto estiver usando o aplicativo.' -ForegroundColor Yellow
  Write-Host 'Para encerrar, pressione Ctrl+C.' -ForegroundColor Yellow

  $contentTypes = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.webmanifest' = 'application/manifest+json; charset=utf-8'; '.svg' = 'image/svg+xml' }
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }
    $filePath = [IO.Path]::GetFullPath((Join-Path $rootPath $relativePath))
    if (-not $filePath.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }
    $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = $contentTypes[$extension]
    if (-not $contentType) { $contentType = 'application/octet-stream' }
    $context.Response.ContentType = $contentType
    $bytes = [IO.File]::ReadAllBytes($filePath)
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
