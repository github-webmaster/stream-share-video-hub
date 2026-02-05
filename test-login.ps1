$body = @{
    email = "admin@maggew.com"
    password = "admin@maggew.com"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8081/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing
    
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "LOGIN SUCCESSFUL!" -ForegroundColor Green
    Write-Host "Email: $($data.user.email)"
    Write-Host "User ID: $($data.user.id)"
    Write-Host "Roles: $($data.roles -join ', ')"
    Write-Host "Token preview: $($data.token.Substring(0, 40))..."
}
catch {
    Write-Host "LOGIN FAILED!" -ForegroundColor Red
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $errorBody = $reader.ReadToEnd()
    Write-Host "Error: $errorBody"
}
