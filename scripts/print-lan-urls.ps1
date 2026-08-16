# Print LAN URLs for Vivondo Vite server (used by start-game.bat).
param(
  [int]$Port = 5173
)

$ips = @()
try {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.PrefixOrigin -ne "WellKnown" -and
      $_.IPAddress -notlike "169.254.*"
    } |
    ForEach-Object { $ips += $_.IPAddress }
} catch {
  # Fallback when Get-NetIPAddress unavailable
  $ips = @(
    ipconfig |
      Select-String "IPv4" |
      ForEach-Object {
        if ($_ -match ":\s*([\d.]+)") { $Matches[1] }
      } |
      Where-Object { $_ -notlike "127.*" -and $_ -notlike "169.254.*" }
  )
}

$ips = $ips | Select-Object -Unique
if (-not $ips -or $ips.Count -eq 0) {
  Write-Host "  (未检测到局域网 IPv4，请确认已连 Wi‑Fi / 有线网)"
  exit 0
}

foreach ($ip in $ips) {
  Write-Host ("  http://{0}:{1}/" -f $ip, $Port)
}
