Add-Type -AssemblyName System.Drawing

function Make-Transparent {
    param([string]$imagePath)
    
    $fullPath = (Resolve-Path $imagePath).Path
    Write-Output "Processing: $fullPath"
    
    $src = [System.Drawing.Image]::FromFile($fullPath)
    $width = $src.Width
    $height = $src.Height
    
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($src, 0, 0, $width, $height)
    $g.Dispose()
    $src.Dispose()
    
    $transparent = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
    for ($y = 0; $y -lt $height; $y++) {
        for ($x = 0; $x -lt $width; $x++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.R -gt 220 -and $p.G -gt 220 -and $p.B -gt 220) {
                $bmp.SetPixel($x, $y, $transparent)
            }
        }
    }
    
    $tempPath = $fullPath + ".tmp.png"
    $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    
    Move-Item -Path $tempPath -Destination $fullPath -Force
    Write-Output "Done: $fullPath"
}

Make-Transparent "public\bbps_bills.png"
Make-Transparent "public\pos_gateway.png"
