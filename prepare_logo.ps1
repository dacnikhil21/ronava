Add-Type -AssemblyName System.Drawing

$srcPath = (Resolve-Path 'public/ronav_logo_official.png').Path
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $src.Width
$h = $src.Height

# We see the top has a thin pink line and some whitespace.
# Let's start crop from y=8 down to y=98 (total height ~ 90)
# And on the left, start around x=10, right up to x=320
$cropTop = 8
$cropBottom = 96
$cropLeft = 6
$cropRight = 330

$cropW = $cropRight - $cropLeft
$cropH = $cropBottom - $cropTop

$cropRect = New-Object System.Drawing.Rectangle($cropLeft, $cropTop, $cropW, $cropH)
$cropped = $src.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$src.Dispose()

# Make background transparent: any color with high lightness and low saturation (near grey/white)
$transparent = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
for ($y = 0; $y -lt $cropped.Height; $y++) {
    for ($x = 0; $x -lt $cropped.Width; $x++) {
        $p = $cropped.GetPixel($x, $y)
        # Background is near white/light-grey (R>225, G>228, B>232)
        if ($p.R -ge 225 -and $p.G -ge 228 -and $p.B -ge 232) {
            $cropped.SetPixel($x, $y, $transparent)
        }
    }
}

$destPath = (Resolve-Path 'public').Path + '\ronav_official_logo_horizontal.png'
$cropped.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$cropped.Dispose()
Write-Output "Saved fine-cropped logo to: $destPath"
