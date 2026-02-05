# Test Chunked Upload Implementation
# This script tests the chunked upload endpoints

param(
    [string]$ApiUrl = "http://localhost:8081",
    [string]$Email = "test@example.com",
    [string]$Password = "testpassword123",
    [Parameter(Mandatory=$false)]
    [string]$TestFile
)

Write-Host "=== Chunked Upload Test Script ===" -ForegroundColor Cyan
Write-Host ""

# Function to create a test video file
function New-TestVideoFile {
    param([int]$SizeMB)
    $filename = "test_video_${SizeMB}MB.mp4"
    $filepath = Join-Path $env:TEMP $filename
    
    Write-Host "Creating test file: $filename ($SizeMB MB)..." -ForegroundColor Yellow
    
    # Create a file with random data and MP4 header
    $mp4Header = [byte[]](0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70)
    [System.IO.File]::WriteAllBytes($filepath, $mp4Header)
    
    $stream = [System.IO.File]::OpenWrite($filepath)
    $stream.Seek(0, [System.IO.SeekOrigin]::End) | Out-Null
    
    $chunkSize = 1MB
    $totalBytes = $SizeMB * 1MB
    $written = $mp4Header.Length
    
    $random = New-Object System.Random
    while ($written -lt $totalBytes) {
        $size = [Math]::Min($chunkSize, $totalBytes - $written)
        $bytes = New-Object byte[] $size
        $random.NextBytes($bytes)
        $stream.Write($bytes, 0, $size)
        $written += $size
    }
    
    $stream.Close()
    Write-Host "✓ Test file created: $filepath" -ForegroundColor Green
    return $filepath
}

# Step 1: Login
Write-Host "[1/6] Logging in as $Email..." -ForegroundColor Cyan
try {
    $loginBody = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$ApiUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody

    $token = $loginResponse.token
    Write-Host "✓ Login successful" -ForegroundColor Green
    Write-Host "  User ID: $($loginResponse.user.id)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "✗ Login failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Check quota
Write-Host "[2/6] Checking quota..." -ForegroundColor Cyan
try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $quota = Invoke-RestMethod -Uri "$ApiUrl/api/user-quota" `
        -Method GET `
        -Headers $headers
    
    $usedMB = [Math]::Round($quota.quota.storage_used_bytes / 1MB, 2)
    $limitMB = [Math]::Round($quota.quota.storage_limit_bytes / 1MB, 2)
    
    Write-Host "✓ Quota retrieved" -ForegroundColor Green
    Write-Host "  Used: $usedMB MB / $limitMB MB" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "✗ Failed to get quota: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Create or use test file
Write-Host "[3/6] Preparing test file..." -ForegroundColor Cyan
if ($TestFile -and (Test-Path $TestFile)) {
    $filepath = $TestFile
    Write-Host "✓ Using provided file: $filepath" -ForegroundColor Green
}
else {
    # Create a 120MB test file to trigger chunked upload
    $filepath = New-TestVideoFile -SizeMB 120
}

$fileInfo = Get-Item $filepath
$fileSize = $fileInfo.Length
$fileSizeMB = [Math]::Round($fileSize / 1MB, 2)
Write-Host "  File: $($fileInfo.Name)" -ForegroundColor Gray
Write-Host "  Size: $fileSizeMB MB ($fileSize bytes)" -ForegroundColor Gray
Write-Host ""

# Calculate chunks
$chunkSize = 5MB
$totalChunks = [Math]::Ceiling($fileSize / $chunkSize)
Write-Host "  Chunks: $totalChunks (at 5MB each)" -ForegroundColor Gray
Write-Host ""

# Step 4: Start upload session
Write-Host "[4/6] Starting upload session..." -ForegroundColor Cyan
try {
    $startBody = @{
        filename = $fileInfo.Name
        fileSize = $fileSize
        mimetype = "video/mp4"
        totalChunks = $totalChunks
    } | ConvertTo-Json

    $session = Invoke-RestMethod -Uri "$ApiUrl/api/upload/start" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $startBody

    $sessionId = $session.sessionId
    Write-Host "✓ Session created" -ForegroundColor Green
    Write-Host "  Session ID: $sessionId" -ForegroundColor Gray
    Write-Host "  Share ID: $($session.shareId)" -ForegroundColor Gray
    Write-Host "  Expires: $($session.expiresAt)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "✗ Failed to start session: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Upload chunks
Write-Host "[5/6] Uploading chunks..." -ForegroundColor Cyan
$fileStream = [System.IO.File]::OpenRead($filepath)
$uploadedChunks = 0

try {
    for ($i = 0; $i -lt $totalChunks; $i++) {
        $start = $i * $chunkSize
        $length = [Math]::Min($chunkSize, $fileSize - $start)
        
        # Read chunk
        $buffer = New-Object byte[] $length
        $fileStream.Seek($start, [System.IO.SeekOrigin]::Begin) | Out-Null
        $fileStream.Read($buffer, 0, $length) | Out-Null
        
        # Create multipart form data
        $boundary = [System.Guid]::NewGuid().ToString()
        $bodyLines = @(
            "--$boundary",
            "Content-Disposition: form-data; name=`"chunk`"; filename=`"chunk_$i`"",
            "Content-Type: application/octet-stream",
            "",
            [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($buffer),
            "--$boundary",
            "Content-Disposition: form-data; name=`"chunkNumber`"",
            "",
            "$i",
            "--$boundary--"
        )
        $body = $bodyLines -join "`r`n"
        
        # Upload chunk
        $chunkHeaders = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "multipart/form-data; boundary=$boundary"
        }
        
        $chunkResult = Invoke-RestMethod -Uri "$ApiUrl/api/upload/chunk/$sessionId" `
            -Method POST `
            -Headers $chunkHeaders `
            -Body ([System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($body))
        
        $uploadedChunks++
        $progress = [Math]::Round(($uploadedChunks / $totalChunks) * 100, 1)
        Write-Host "  ✓ Chunk $($i + 1)/$totalChunks uploaded ($progress%)" -ForegroundColor Gray
    }
    
    Write-Host "✓ All chunks uploaded successfully" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "✗ Failed to upload chunk: $_" -ForegroundColor Red
    $fileStream.Close()
    exit 1
}
finally {
    $fileStream.Close()
}

# Step 6: Complete upload
Write-Host "[6/6] Completing upload..." -ForegroundColor Cyan
try {
    $complete = Invoke-RestMethod -Uri "$ApiUrl/api/upload/complete/$sessionId" `
        -Method POST `
        -Headers $headers
    
    Write-Host "✓ Upload completed successfully!" -ForegroundColor Green
    Write-Host "  Video ID: $($complete.videoId)" -ForegroundColor Gray
    Write-Host "  Share ID: $($complete.shareId)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "✗ Failed to complete upload: $_" -ForegroundColor Red
    exit 1
}

# Verify video exists
Write-Host "Verifying video..." -ForegroundColor Cyan
try {
    $videos = Invoke-RestMethod -Uri "$ApiUrl/api/videos" `
        -Method GET `
        -Headers $headers
    
    $uploadedVideo = $videos.videos | Where-Object { $_.id -eq $complete.videoId }
    
    if ($uploadedVideo) {
        Write-Host "✓ Video verified in database" -ForegroundColor Green
        Write-Host "  Title: $($uploadedVideo.title)" -ForegroundColor Gray
        Write-Host "  Size: $([Math]::Round($uploadedVideo.size / 1MB, 2)) MB" -ForegroundColor Gray
        Write-Host ""
    }
    else {
        Write-Host "⚠ Video not found in list" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠ Could not verify video: $_" -ForegroundColor Yellow
}

# Check quota again
Write-Host "Checking quota after upload..." -ForegroundColor Cyan
try {
    $quotaAfter = Invoke-RestMethod -Uri "$ApiUrl/api/user-quota" `
        -Method GET `
        -Headers $headers
    
    $usedAfterMB = [Math]::Round($quotaAfter.quota.storage_used_bytes / 1MB, 2)
    $limitAfterMB = [Math]::Round($quotaAfter.quota.storage_limit_bytes / 1MB, 2)
    $increaseMB = $usedAfterMB - $usedMB
    
    Write-Host "✓ Quota updated" -ForegroundColor Green
    Write-Host "  Before: $usedMB MB" -ForegroundColor Gray
    Write-Host "  After:  $usedAfterMB MB (+ $increaseMB MB)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "⚠ Failed to get updated quota: $_" -ForegroundColor Yellow
}

Write-Host "=== TEST COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  - File size: $fileSizeMB MB" -ForegroundColor Gray
Write-Host "  - Total chunks: $totalChunks" -ForegroundColor Gray
Write-Host "  - Video ID: $($complete.videoId)" -ForegroundColor Gray
Write-Host "  - Storage increase: +$increaseMB MB" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Check video in dashboard: http://localhost:4000" -ForegroundColor Gray
Write-Host "  2. Test video playback" -ForegroundColor Gray
Write-Host "  3. Verify chunks were cleaned up: data/videos/chunks/" -ForegroundColor Gray
Write-Host ""
