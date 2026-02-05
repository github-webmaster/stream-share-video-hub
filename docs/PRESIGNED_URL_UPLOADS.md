# Presigned URL Direct Uploads 🔒

## Overview

Direct-to-storage uploads offload bandwidth and CPU from your backend server by allowing clients to upload chunks directly to Storj using presigned URLs. The backend only generates URLs and coordinates the upload, not the actual data transfer.

## How It Works

### Traditional Flow (Backend Proxied)
```
Client → [Chunk Data] → Backend → [Chunk Data] → Storj
```
- Backend receives and temporarily stores chunk
- Backend uploads chunk to Storj
- High bandwidth and CPU usage on backend

### Direct Upload Flow (Presigned URLs)
```
Client → [Get URL] → Backend
Client → [Chunk Data] → Storj (Direct PUT)
Client → [Notify Complete] → Backend
```
- Backend generates presigned PUT URL
- Client uploads chunk directly to Storj
- Backend tracks completion
- **Zero** data transfer through backend!

## Implementation

### Server Endpoints (20+ LOC)

#### 1. Generate Presigned URL
```javascript
POST /api/upload/chunk-url/:sessionId/:chunkNumber
```
Generates a presigned PUT URL for direct upload to Storj.

**Response:**
```json
{
  "url": "https://gateway.storjshare.io/...",
  "key": "chunks/user123/session456/0"
}
```

#### 2. Notify Chunk Complete
```javascript
POST /api/upload/chunk-complete/:sessionId/:chunkNumber
Body: { "key": "chunks/...", "size": 5242880 }
```
Notifies backend that chunk was uploaded directly.

**Response:**
```json
{
  "success": true,
  "chunksUploaded": 3
}
```

### Client Usage Example

```typescript
// Upload chunk directly to Storj
const uploadChunkDirect = async (sessionId: string, chunkNum: number, blob: Blob) => {
  // 1. Get presigned URL
  const { url, key } = await videoApi.getChunkUploadUrl(sessionId, chunkNum);
  
  // 2. PUT chunk directly to Storj
  await fetch(url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  
  // 3. Notify backend
  await videoApi.notifyChunkComplete(sessionId, chunkNum, key, blob.size);
};
```

### Automatic Fallback

The client automatically falls back to backend upload if presigned URLs fail:

```typescript
try {
  // Try direct upload
  const { url, key } = await getChunkUploadUrl(sessionId, i);
  await fetch(url, { method: 'PUT', body: chunkBlob });
  await notifyChunkComplete(sessionId, i, key, chunkBlob.size);
} catch (error) {
  // Fallback to backend upload
  await uploadChunk(sessionId, i, chunkBlob);
}
```

## Benefits

### 🚀 Performance
- **10-100x** less backend bandwidth usage
- Parallel chunk uploads scale infinitely
- No backend CPU spent on data transfer

### 💰 Cost Savings
- Reduced bandwidth costs
- Smaller backend instances needed
- Lower cloud egress fees

### 🔧 Reliability
- Direct S3/Storj connection (fewer hops)
- Automatic fallback if presigned URLs unavailable
- Works with existing chunked upload system

## Assembly Process

When all chunks are uploaded:

### Direct Upload (NEW)
```javascript
// Chunks already in Storj at: chunks/user/session/0, chunks/user/session/1, ...
// Use S3 Multipart Copy to assemble them server-side
CreateMultipartUpload → UploadPartCopy (each chunk) → CompleteMultipartUpload
// Final file: user/timestamp_hash.mp4
// Cleanup: Delete chunk objects
```

### Backend Upload (Fallback)
```javascript
// Chunks in local disk: data/videos/chunks/session_chunk_0
// Assemble locally, then upload to Storj
fs.createWriteStream → write chunks → uploadToStorj
// Final file: storj://bucket/user/timestamp_hash.mp4
```

## Configuration

No additional configuration needed! 

- If Storj is configured → Direct uploads enabled
- If Storj NOT configured → Automatic fallback to backend upload
- Works seamlessly with existing system

## Bandwidth Comparison

For a **500MB video** uploaded in **100 chunks** (5MB each):

| Method | Backend Bandwidth | Backend CPU |
|--------|-------------------|-------------|
| **Backend Proxied** | 500MB in + 500MB out = **1GB** | High (read/write) |
| **Direct Upload** | ~100KB (100 × 1KB metadata) | Minimal (URLs only) |

**Savings: ~99.99% bandwidth reduction!**

## Security

- Presigned URLs expire in **1 hour** (3600 seconds)
- Each URL is unique per chunk and session
- Only authenticated users can request URLs
- Chunks stored in isolated user directories
- URLs can't be reused for other files

## Testing

1. **Manual Test:**
```powershell
# Start upload session
$token = "your-jwt-token"
$session = Invoke-RestMethod -Uri "http://localhost:8081/api/upload/start" `
  -Method POST -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json" `
  -Body '{"filename":"test.mp4","fileSize":10485760,"mimetype":"video/mp4","totalChunks":2}'

# Get presigned URL
$url = Invoke-RestMethod -Uri "http://localhost:8081/api/upload/chunk-url/$($session.sessionId)/0" `
  -Method POST -Headers @{Authorization="Bearer $token"}

# Upload chunk directly
$chunk = [byte[]](1..5242880)
Invoke-RestMethod -Uri $url.url -Method PUT -Body $chunk -ContentType "application/octet-stream"

# Notify completion
Invoke-RestMethod -Uri "http://localhost:8081/api/upload/chunk-complete/$($session.sessionId)/0" `
  -Method POST -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json" `
  -Body "{`"key`":`"$($url.key)`",`"size`":5242880}"
```

2. **Integration Test:**
Upload a large file (>100MB) through the web UI and check browser console:
```
[upload] Using chunked upload
Direct upload to Storj: chunks/user123/session456/0
Direct upload to Storj: chunks/user123/session456/1
...
```

## Monitoring

Check backend logs for direct uploads:
```
[chunked-upload] Direct upload detected - assembling in Storj
```

Check for fallbacks (should be rare):
```
Direct upload failed for chunk 0, using backend
```

## Troubleshooting

**Q: Chunks still going through backend?**
- Check Storj is configured in storage_config table
- Verify presigned URL endpoint returns URL (not 400 error)
- Check browser console for errors

**Q: Presigned URL errors?**
- Verify Storj credentials are correct
- Check bucket permissions
- Ensure endpoint URL is correct (gateway.storjshare.io)

**Q: CORS errors?**
- Storj should allow CORS by default
- If issues, configure bucket CORS policy

## Migration Notes

- ✅ **Zero breaking changes** - works alongside existing uploads
- ✅ **Automatic detection** - system decides based on storage_path format
- ✅ **Backward compatible** - old uploads still work
- ✅ **Graceful degradation** - falls back if Storj unavailable

## Performance Metrics

Expected improvements for large files (>100MB):

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Backend Bandwidth | 100% | <1% | **99%+** |
| Backend CPU | High | Minimal | **90%+** |
| Upload Speed | Network limited | Storage limited | **Faster** |
| Scalability | Backend bottleneck | Unlimited | **∞** |

---

**Summary:** Direct uploads transform your backend from a data bottleneck into a lightweight coordinator, enabling true cloud-native scalability! 🚀
