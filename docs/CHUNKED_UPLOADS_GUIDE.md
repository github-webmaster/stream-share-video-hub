# Chunked Uploads Implementation Guide

## Overview

This document describes the chunked upload feature that enables resumable uploads of large video files. The implementation provides:

- **Automatic chunking** for files larger than 100MB
- **Resumable uploads** that survive page reloads
- **Quota management** integrated with existing system
- **Backward compatibility** with single-shot uploads for small files
- **Works with both** local storage and Storj S3-compatible storage

## Architecture

### Database Schema

Two new tables track upload sessions and chunks:

#### `upload_sessions`
Tracks the overall upload process for each file:
- `id` - Unique session identifier
- `user_id` - Owner of the upload
- `filename`, `file_size`, `mimetype` - File metadata
- `total_chunks`, `chunks_uploaded` - Progress tracking
- `status` - Current state: pending, uploading, assembling, completed, failed, cancelled
- `quota_reserved` - Whether quota was pre-reserved
- `reserved_bytes` - Amount of quota reserved
- `expires_at` - Sessions expire after 24 hours
- `share_id` - Pre-generated share ID for the final video

#### `upload_chunks`
Stores metadata for individual chunks:
- `session_id` - Reference to upload session
- `chunk_number` - Sequential chunk index (0-based)
- `chunk_size` - Size of this chunk in bytes
- `storage_path` - Temporary storage location

### API Routes

#### POST `/api/upload/start`
**Purpose**: Initialize a new chunked upload session

**Request Body**:
```json
{
  "filename": "my-video.mp4",
  "fileSize": 524288000,
  "mimetype": "video/mp4",
  "totalChunks": 100
}
```

**Response**:
```json
{
  "sessionId": "uuid-here",
  "shareId": "abc123",
  "expiresAt": "2026-02-05T12:00:00Z"
}
```

**What it does**:
1. Validates file type and size against system limits
2. Checks user quota (respects admin/regular user limits)
3. **Reserves quota atomically** to prevent race conditions
4. Creates upload session in database
5. Generates share_id upfront for the final video

---

#### POST `/api/upload/chunk/:sessionId`
**Purpose**: Upload a single chunk

**Request**: `multipart/form-data`
- `chunk` - The chunk blob (file part)
- `chunkNumber` - Sequential chunk index

**Response**:
```json
{
  "success": true,
  "chunkNumber": 5,
  "chunksUploaded": 6,
  "totalChunks": 100
}
```

**What it does**:
1. Validates session exists and belongs to user
2. Validates chunk number is within range
3. Stores chunk to temporary location (`data/videos/chunks/`)
4. Records chunk metadata in database
5. Updates session progress
6. **Idempotent**: Returns success if chunk already uploaded (enables resumability)

---

#### POST `/api/upload/complete/:sessionId`
**Purpose**: Finalize the upload and create video record

**Response**:
```json
{
  "success": true,
  "videoId": "uuid-here",
  "shareId": "abc123"
}
```

**What it does**:
1. Validates all chunks are uploaded
2. Updates status to "assembling"
3. **Assembles chunks** sequentially into final file
4. **Uploads to Storj** if configured (otherwise keeps local)
5. Creates video record in `videos` table
6. Increments user's upload count
7. **Cleans up temporary chunk files**
8. Marks session as completed

---

#### DELETE `/api/upload/cancel/:sessionId`
**Purpose**: Cancel an in-progress upload

**Response**:
```json
{
  "success": true
}
```

**What it does**:
1. **Frees reserved quota**
2. Deletes all uploaded chunks
3. Marks session as cancelled

---

#### GET `/api/upload/status/:sessionId`
**Purpose**: Check upload progress (optional, for debugging)

**Response**:
```json
{
  "session": {
    "filename": "my-video.mp4",
    "file_size": 524288000,
    "total_chunks": 100,
    "chunks_uploaded": 45,
    "status": "uploading",
    "expires_at": "2026-02-05T12:00:00Z"
  }
}
```

---

#### POST `/api/admin/cleanup-expired-sessions` (Admin only)
**Purpose**: Clean up expired sessions and free quota

Runs the database cleanup function that:
- Finds sessions expired (>24 hours old)
- Frees reserved quota
- Deletes old chunk files
- Removes old cancelled/failed sessions (>7 days)

---

### Frontend Implementation

#### Upload Hook (`useUpload.tsx`)

**Configuration**:
```typescript
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100MB threshold
```

**Flow**:
1. **Detection**: Files > 100MB use chunked upload, smaller files use single-shot
2. **Resumability**: Session info stored in localStorage with key `upload_session_{filename}`
3. **Chunk Upload**: Sequential chunk upload with per-chunk retry (3 attempts)
4. **Progress**: Real-time progress based on chunks uploaded
5. **Cleanup**: LocalStorage cleared on completion or cancellation

**Resumability Example**:
```typescript
// User uploads 50/100 chunks, then closes browser
// On page reload, hook checks localStorage
// Finds existing session and resumes from chunk 51
```

---

## Migration Guide

### Database Migration

Run the migration to add new tables:

```bash
# Apply migration to PostgreSQL
psql $DATABASE_URL -f supabase/migrations/20260204120000_add_chunked_uploads.sql
```

**Migration includes**:
- Creates `upload_sessions` table
- Creates `upload_chunks` table
- Adds indexes for performance
- Creates cleanup function `cleanup_expired_upload_sessions()`

### Code Deployment

The implementation is **fully backward compatible**:

1. **Old uploads still work**: The existing `/api/upload` route remains unchanged
2. **Gradual adoption**: Frontend automatically uses chunked uploads for files > 100MB
3. **No API breaking changes**: All existing endpoints unchanged
4. **Quota system enhanced**: Chunked uploads integrate with existing quota logic

### Deployment Steps

1. **Deploy database migration**:
   ```bash
   psql $DATABASE_URL -f supabase/migrations/20260204120000_add_chunked_uploads.sql
   ```

2. **Update backend** (server/src/index.js):
   - New routes added before existing `/api/upload`
   - No changes to existing routes

3. **Update frontend**:
   - `src/lib/api.ts` - New chunked upload API methods
   - `src/hooks/useUpload.tsx` - Enhanced upload logic
   - No changes needed to Dashboard or other components

4. **Create chunks directory**:
   ```bash
   mkdir -p data/videos/chunks
   ```

5. **Restart services**:
   ```bash
   # Backend
   cd server && npm start
   
   # Frontend
   npm run dev
   ```

---

## Testing Guide

### Manual Testing

#### Test 1: Small File (Single-Shot Upload)
```bash
# Upload a file < 100MB
# Should use existing /api/upload route
# Check browser console: "using single-shot upload"
```

**Expected**:
- Progress bar shows smooth animation
- Upload completes in one request
- Video appears in dashboard

---

#### Test 2: Large File (Chunked Upload)
```bash
# Upload a file > 100MB
# Should use chunked upload routes
# Check browser console: "using chunked upload"
```

**Expected**:
- Console shows session start
- Chunks upload sequentially (5MB each)
- Progress bar advances per chunk
- Final assembly and video creation
- Video appears in dashboard

---

#### Test 3: Resumability
1. Start uploading a large file (> 100MB)
2. When ~50% uploaded, refresh the browser
3. Upload the **same file** again

**Expected**:
- Console shows "Resuming session"
- Already uploaded chunks are skipped
- Upload continues from last chunk
- Completes successfully

---

#### Test 4: Quota Enforcement
```bash
# As regular user (512MB quota)
# Upload files until quota exhausted
```

**Expected**:
- Chunked uploads reserve quota at session start
- Quota exceeded error if not enough space
- Cancelled uploads free reserved quota
- Admin users bypass quota checks

---

#### Test 5: Storj Integration
**Prerequisites**: Storj credentials configured

1. Upload large file
2. Check after completion:
   - Video record has `storage_path` starting with `storj://`
   - Local assembled file deleted
   - Chunk files cleaned up
   - Video playback works via signed URL

---

### Automated Testing

#### API Tests

```bash
# Test session start
curl -X POST http://localhost:8081/api/upload/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test.mp4",
    "fileSize": 524288000,
    "mimetype": "video/mp4",
    "totalChunks": 100
  }'
```

#### Database Verification

```sql
-- Check active sessions
SELECT id, filename, status, chunks_uploaded, total_chunks 
FROM upload_sessions 
WHERE status = 'uploading';

-- Check quota reservation
SELECT user_id, storage_used_bytes, storage_limit_bytes
FROM user_quotas
WHERE user_id = 'your-user-id';

-- Run cleanup manually
SELECT cleanup_expired_upload_sessions();
```

---

## Configuration

### Environment Variables

No new environment variables needed. Uses existing:
- `STORAGE_PATH` - Base path for video storage (chunks stored in `{STORAGE_PATH}/chunks`)
- `MAX_FILE_SIZE_MB` - Maximum file size (applies to both single-shot and chunked)
- `ALLOWED_TYPES` - Allowed MIME types

### Tunable Parameters (Frontend)

Edit `src/hooks/useUpload.tsx`:

```typescript
// Chunk size (default 5MB)
const CHUNK_SIZE = 5 * 1024 * 1024;

// Threshold for using chunked uploads (default 100MB)
const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024;

// Max chunk retries (default 3)
const MAX_RETRIES = 3;

// Retry delay (default 1000ms)
const RETRY_DELAY = 1000;
```

### Tunable Parameters (Backend)

Edit `server/src/index.js`:

```javascript
// Max chunk size (default 50MB)
limits: { fileSize: 50 * 1024 * 1024 }

// Session expiration (default 24 hours)
// Edit migration file: expires_at TIMESTAMP ... DEFAULT (now() + INTERVAL '24 hours')
```

---

## Monitoring & Maintenance

### Cleanup Expired Sessions

**Automated** (recommended):
Set up a cron job to run cleanup:

```bash
# Add to crontab - run every hour
0 * * * * curl -X POST http://localhost:8081/api/admin/cleanup-expired-sessions \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Manual**:
```sql
SELECT cleanup_expired_upload_sessions();
```

### Monitor Disk Usage

Check chunk directory size:
```bash
du -sh data/videos/chunks/
```

If chunks accumulate (indicates cleanup not running):
```bash
# Force cleanup old chunks (manual)
find data/videos/chunks/ -type f -mtime +1 -delete
```

### Monitor Active Sessions

```sql
-- Active sessions
SELECT COUNT(*) FROM upload_sessions 
WHERE status IN ('pending', 'uploading');

-- Sessions by status
SELECT status, COUNT(*) 
FROM upload_sessions 
GROUP BY status;

-- Average completion time
SELECT AVG(completed_at - created_at) as avg_duration
FROM upload_sessions
WHERE status = 'completed';
```

---

## Troubleshooting

### Issue: Chunks not cleaning up

**Symptoms**: `data/videos/chunks/` directory growing

**Solutions**:
1. Run cleanup function: `SELECT cleanup_expired_upload_sessions();`
2. Check cron job is running
3. Manually delete old chunks:
   ```bash
   find data/videos/chunks/ -type f -mtime +1 -delete
   ```

---

### Issue: Upload stuck at "assembling"

**Symptoms**: Session status stuck at "assembling"

**Solutions**:
1. Check backend logs for assembly errors
2. Verify all chunks exist:
   ```sql
   SELECT session_id, COUNT(*) as chunk_count
   FROM upload_chunks
   WHERE session_id = 'stuck-session-id'
   GROUP BY session_id;
   ```
3. Cancel and retry:
   ```sql
   UPDATE upload_sessions 
   SET status = 'failed' 
   WHERE id = 'stuck-session-id';
   ```

---

### Issue: Quota not freed after cancel

**Symptoms**: Quota remains reserved after cancelling upload

**Solutions**:
1. Run quota reconciliation:
   ```bash
   curl http://localhost:8081/api/admin/reconcile-storage \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
2. Check session status:
   ```sql
   SELECT id, status, quota_reserved, reserved_bytes
   FROM upload_sessions
   WHERE user_id = 'affected-user-id';
   ```

---

### Issue: Resume not working

**Symptoms**: Upload restarts from beginning instead of resuming

**Solutions**:
1. Check localStorage in browser dev tools
2. Verify session hasn't expired (24 hour limit)
3. Ensure filename is identical
4. Clear stale sessions:
   ```javascript
   // In browser console
   Object.keys(localStorage)
     .filter(k => k.startsWith('upload_session_'))
     .forEach(k => localStorage.removeItem(k));
   ```

---

## Performance Considerations

### Chunk Size Trade-offs

**Smaller chunks (1-2MB)**:
- ✅ Better resumability (less re-upload on failure)
- ✅ Lower memory usage
- ❌ More HTTP requests
- ❌ Slower for fast connections

**Larger chunks (10-20MB)**:
- ✅ Fewer HTTP requests
- ✅ Faster on fast connections
- ❌ More data re-upload on failure
- ❌ Higher memory usage

**Recommended**: 5MB (current default) works well for most scenarios

### Database Performance

Indexes are created on:
- `upload_sessions.user_id`
- `upload_sessions.status`
- `upload_sessions.expires_at`
- `upload_chunks.session_id`

For high-volume systems, consider:
- Regular VACUUM ANALYZE
- Partition `upload_sessions` by created_at
- Archive old completed sessions

---

## Security Considerations

1. **Session Ownership**: All routes verify session belongs to requesting user
2. **Quota Enforcement**: Quota reserved atomically at session start
3. **File Type Validation**: MIME type checked against `ALLOWED_TYPES`
4. **Size Limits**: Both per-chunk (50MB) and total file size enforced
5. **Expiration**: Sessions auto-expire after 24 hours
6. **Path Safety**: Chunks use server-generated names (no user-provided paths)

---

## Future Enhancements

Potential improvements:

1. **Parallel chunk uploads**: Upload multiple chunks concurrently
2. **Chunk deduplication**: Detect and skip duplicate chunks
3. **Compression**: Compress chunks before upload
4. **Progress webhooks**: Real-time progress via WebSocket
5. **Direct Storj upload**: Upload chunks directly to Storj (bypass server)
6. **Chunk verification**: MD5/SHA checksums for chunk integrity
7. **Bandwidth throttling**: Limit upload speed to prevent congestion
8. **Multi-part assembly**: Use Storj multipart API instead of local assembly

---

## API Summary Table

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/upload/start` | POST | Required | Initialize upload session |
| `/api/upload/chunk/:sessionId` | POST | Required | Upload a single chunk |
| `/api/upload/complete/:sessionId` | POST | Required | Finalize and assemble |
| `/api/upload/cancel/:sessionId` | DELETE | Required | Cancel and free quota |
| `/api/upload/status/:sessionId` | GET | Required | Check session status |
| `/api/upload` | POST | Required | Legacy single-shot upload |
| `/api/admin/cleanup-expired-sessions` | POST | Admin | Clean expired sessions |

---

## Success Metrics

After deployment, monitor:

1. **Upload success rate**: % of completed uploads
2. **Average upload time**: For different file sizes
3. **Resume rate**: % of uploads that resumed
4. **Error rate**: Failed uploads and reasons
5. **Quota accuracy**: Discrepancies between quota and actual storage

Query for metrics:
```sql
-- Upload success rate (last 7 days)
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM upload_sessions
WHERE created_at > now() - INTERVAL '7 days'
GROUP BY status;
```

---

## Support

For issues or questions:
1. Check this guide first
2. Review backend logs for errors
3. Inspect database session state
4. Check browser console for frontend errors
5. Verify chunk files exist on disk

Debug mode can be enabled via admin panel to see detailed logs.
