$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\god\underground\UNDERGROUND-runs'
$out = 'apps/mobile/assets/runs'
New-Item -ItemType Directory -Force $out | Out-Null
$items = @(
  @('nvidia-campus','NVIDIA Headquarters.jpg'),
  @('skyline-ridge','SkylineBoulevardFromAir.jpg'),
  @('coast-halfmoon','Aerial view of Devil''s Slide on the California Coast.jpg'),
  @('pescadero-coast','Ca-1 somewhere near Pescadero, Pomponio and San Gregorio State Beaches.JPG'),
  @('silverado-trail','Napa Valley Silverado Trail.jpg'),
  @('17-mile-drive','17 Mile Drive at Pebble Beach.jpg')
)
foreach ($item in $items) {
  $slug = $item[0]
  $filename = $item[1]
  $escaped = [uri]::EscapeDataString($filename.Replace(' ','_'))
  $url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' + $escaped + '?width=1200'
  $temp = Join-Path $out ($slug+'.source')
  $dest = Join-Path $out ($slug+'.jpg')
  try {
    Invoke-WebRequest -Uri $url -OutFile $temp -MaximumRedirection 10 -TimeoutSec 30 -UseBasicParsing
    node -e "const sharp=require('sharp');sharp(process.argv[1]).rotate().resize(1200,675,{fit:'cover',position:'attention'}).jpeg({quality:84}).toFile(process.argv[2]).then(x=>console.log('OK '+process.argv[2]+' '+x.size)).catch(e=>{console.error(e.message);process.exit(1)})" $temp $dest
    if ($LASTEXITCODE -ne 0) { throw 'image resize failed' }
  } catch {
    Write-Output ('FAIL '+$slug+': '+$_.Exception.Message)
  } finally {
    Remove-Item $temp -ErrorAction SilentlyContinue
  }
}
