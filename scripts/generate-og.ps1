param(
    [string]$SourceImage = "..\1.png",
    [string]$Output = "..\assets\og-image.png",
    [string]$Title = "Генератор тартана",
    [string]$Line1 = "Создавайте аутентичные шотландские узоры",
    [string]$Line2 = "по нотации и скачивайте обои",
    [string]$Url = "tartan.guilliman.ru"
)

if (!(Test-Path $SourceImage)) {
    Write-Error "Source image not found: $SourceImage"
    exit 1
}

$resolvedSource = Resolve-Path $SourceImage
$resolvedOut = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Output)

magick $resolvedSource -resize 1200x630^ -gravity center -extent 1200x630 `
    -fill "rgba(0,0,0,0.55)" -draw "rectangle 0,0 1200,630" `
    -font "Arial-Bold" -fill white -gravity north -pointsize 82 -annotate +0+140 $Title `
    -font "Arial" -fill "#dddddd" -gravity north -pointsize 34 -annotate +0+310 $Line1 `
    -font "Arial" -fill "#dddddd" -gravity north -pointsize 34 -annotate +0+350 $Line2 `
    -font "Arial" -fill "#999999" -gravity south -pointsize 30 -annotate +0+40 $Url `
    $resolvedOut

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $resolvedOut).Length
    Write-Output "OK: $resolvedOut ($([math]::Round($size/1KB)) KB)"
} else {
    Write-Error "Failed to generate OG image"
}
