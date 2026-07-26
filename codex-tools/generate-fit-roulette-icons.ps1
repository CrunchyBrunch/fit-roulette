param(
  [string]$SourcePath = (Join-Path $PSScriptRoot "..\icons\icon-main.png")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
$iconDirectory = Split-Path -Parent $resolvedSource
$targets = [ordered]@{
  "icon-180.png" = 180
  "icon-192.png" = 192
  "icon-512.png" = 512
  "favicon-32.png" = 32
}

$source = [System.Drawing.Image]::FromFile($resolvedSource)
try {
  if ($source.RawFormat.Guid -ne [System.Drawing.Imaging.ImageFormat]::Png.Guid) {
    throw "Source icon must be a PNG."
  }
  if ($source.Width -ne $source.Height) {
    throw "Source icon must be square. Found $($source.Width)x$($source.Height)."
  }

  foreach ($entry in $targets.GetEnumerator()) {
    $size = [int]$entry.Value
    $destination = Join-Path $iconDirectory $entry.Key
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $bitmap.SetResolution(96, 96)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $size, $size)
      } finally {
        $graphics.Dispose()
      }
      $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  }
} finally {
  $source.Dispose()
}

Write-Output "Generated $($targets.Count) icon assets from $resolvedSource."
