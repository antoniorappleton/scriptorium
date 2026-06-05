# Usage: create a .env file in repo root with SERVICE_ROLE_KEY and PROJECT_URL
# Example .env:
# SERVICE_ROLE_KEY=eyJ... (do NOT commit)
# PROJECT_URL=https://pllmyptwuvxryxfeufcm.supabase.co
# Then run: powershell -ExecutionPolicy Bypass -File .\scripts\create_users.ps1

# Load .env
$envFile = Join-Path $PSScriptRoot '..\.env'
if (-Not (Test-Path $envFile)) {
  Write-Error ".env file not found at $envFile. Create it with SERVICE_ROLE_KEY and PROJECT_URL and try again."
  exit 1
}
Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*#") { return }
  if ($_ -match "^(\w+)=(.*)$") {
    $name = $matches[1]
    $val = $matches[2]
    $val = $val.Trim('"')
    [System.Environment]::SetEnvironmentVariable($name, $val, 'Process')
  }
}

$serviceKey = $env:SERVICE_ROLE_KEY
$projectUrl = $env:PROJECT_URL
if (-not $serviceKey -or -not $projectUrl) {
  Write-Error "SERVICE_ROLE_KEY or PROJECT_URL not set in .env"
  exit 1
}

Function Invoke-JsonCurl($method, $url, $body) {
  $headers = @{
    "apikey" = $serviceKey
    "Authorization" = "Bearer $serviceKey"
    "Content-Type" = "application/json"
  }
  $json = $null
  if ($body) { $json = $body | ConvertTo-Json -Compress }
  Write-Host "-> $method $url"
  $resp = Invoke-RestMethod -Method $method -Uri $url -Headers $headers -Body $json -ErrorAction Stop
  return $resp
}

# Create or update users
$users = @(
  @{ email = 'scriptorium@colegio-ramalhao.com'; password = 'ChangeMe123!'; role = 'user'; nome = 'Scriptorium' },
  @{ email = 'antonio.appleton@colegio-ramalhao.com'; password = 'ChangeMe123!'; role = 'admin'; nome = 'Antonio Appleton' }
)

foreach ($u in $users) {
  try {
    # Create via Admin API (if user exists, this may fail; ignore)
    $body = @{email = $u.email; password = $u.password; email_confirm = $true}
    Invoke-JsonCurl -method POST -url "$projectUrl/auth/v1/admin/users" -body $body | Out-Null
    Write-Host "Created user $($u.email)"
  } catch {
    Write-Warning "Could not create user $($u.email): $($_.Exception.Message) - continuing"
  }

  try {
    # Insert into professores table (upsert-like behaviour: try delete then insert)
    $prof = @{ nome = $u.nome; email = $u.email; role = $u.role; criado_em = (Get-Date).ToString('s') }
    $headers = @{
      "apikey" = $serviceKey
      "Authorization" = "Bearer $serviceKey"
      "Content-Type" = "application/json"
      "Prefer" = "return=representation"
    }
    $url = "$projectUrl/rest/v1/professores"
    $bodyProf = @($prof) | ConvertTo-Json -Compress
    Invoke-RestMethod -Method POST -Uri $url -Headers $headers -Body $bodyProf -ErrorAction Stop | Out-Null
    Write-Host "Inserted/provisioned professor row for $($u.email)"
  } catch {
    Write-Warning "Could not insert professor row for $($u.email): $($_.Exception.Message)"
  }
}
Write-Host 'Done. Please verify users in Supabase Dashboard > Authentication > Users and that professor rows exist in Table Editor or via REST.'