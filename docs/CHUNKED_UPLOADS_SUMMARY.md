# Resumable Chunked Uploads - Implementation Summary

## What Was Implemented

A complete resumable, chunked upload system for large video files with the following features:

✅ **Automatic Chunking** - Files > 100MB automatically use chunked upload (5MB chunks)  
✅ **Resumable Uploads** - Survive page reloads and network interruptions  
✅ **Quota Management** - Integrates seamlessly with existing quota system  
✅ **Backward Compatible** - Existing single-shot uploads still work for small files  
✅ **Storj & Local Storage** - Works with both storage backends  
✅ **Progress Tracking** - Real-time chunk-by-chunk progress  
✅ **Retry Logic** - Per-chunk retry on failure (3 attempts)  
✅ **Session Cleanup** - Automatic cleanup of expired sessions and chunks  

---

## Files Changed/Added

### Database Migration
- **`supabase/migrations/20260204120000_add_chunked_uploads.sql`** - New tables and cleanup function

### Backend (Node.js)
- **`server/src/index.js`** - Added 6 new routes for chunked uploads:
  - `POST /api/upload/start` - Initialize session
  - `POST /api/upload/chunk/:sessionId` - Upload chunk
  - `POST /api/upload/complete/:sessionId` - Finalize upload
  - `DELETE /api/upload/cancel/:sessionId` - Cancel upload
  - `GET /api/upload/status/:sessionId` - Check progress
  - `POST /api/admin/cleanup-expired-sessions` - Admin cleanup

### Frontend (React/TypeScript)
- **`src/lib/api.ts`** - Added chunked upload API methods
- **`src/hooks/useUpload.tsx`** - Enhanced upload logic with chunking and resumability

### Documentation
- **`docs/CHUNKED_UPLOADS_GUIDE.md`** - Comprehensive implementation guide
- **`docs/CHUNKED_UPLOADS_MIGRATION_CHECKLIST.md`** - Migration steps
- **`test-chunked-upload.ps1`** - Automated test script

---

## New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/upload/start` | POST | Initialize chunked upload session |
| `/api/upload/chunk/:sessionId` | POST | Upload a single chunk |
| `/api/upload/complete/:sessionId` | POST | Finalize and assemble chunks |
| `/api/upload/cancel/:sessionId` | DELETE | Cancel upload and free quota |
| `/api/upload/status/:sessionId` | GET | Check upload progress |
| `/api/upload` | POST | **Unchanged** - Legacy single-shot upload |

---

## Database Changes

### New Tables

**`upload_sessions`** - Tracks upload sessions
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key to users)
- filename, file_size, mimetype
- total_chunks, chunks_uploaded
- status (pending, uploading, assembling, completed, failed, cancelled)
- quota_reserved, reserved_bytes
- share_id (pre-generated for final video)
- expires_at (24 hour expiration)
```

**`upload_chunks`** - Tracks individual chunks
```sql
- id (UUID, primary key)
- session_id (UUID, foreign key to upload_sessions)
- chunk_number (integer)
- chunk_size (bigint)
- storage_path (text)
- uploaded_at (timestamp)
```

### New Function
**`cleanup_expired_upload_sessions()`** - Cleans up expired sessions and frees quota

---

## How It Works

### Upload Flow

1. **File Size Check**
   - Files ≤ 100MB → Use existing single-shot upload
   - Files > 100MB → Use new chunked upload

2. **Chunked Upload Process**
   ```
   User selects file (e.g., 520 MB)
   ↓
   Frontend: Split into chunks (104 chunks × 5MB)
   ↓
   Frontend: POST /api/upload/start
   ↓
   Backend: Reserve quota, create session
   ↓
   Frontend: Upload chunks 0-103 sequentially
   ↓
   Backend: Store chunks in data/videos/chunks/
   ↓
   Frontend: POST /api/upload/complete/:sessionId
   ↓
   Backend: Assemble chunks → Upload to Storj/Local
   ↓
   Backend: Create video record, cleanup chunks
   ↓
   User sees video in dashboard
   ```

3. **Resumability**
   - Session info stored in localStorage
   - On page reload, already uploaded chunks are skipped
   - Upload continues from last chunk

4. **Quota Enforcement**
   - Quota reserved atomically when session starts
   - If user closes browser, quota remains reserved until session expires (24h)
   - Cleanup function frees quota from expired sessions

---

## Migration Steps

### Quick Start (Development)

```bash
# 1. Apply database migration
psql $DATABASE_URL -f supabase/migrations/20260204120000_add_chunked_uploads.sql

# 2. Create chunks directory
mkdir -p data/videos/chunks

# 3. Restart backend (already updated)
cd server && npm start

# 4. Restart frontend (already updated)
npm run dev

# 5. Test it!
# Upload a file > 100MB and watch the console
```

### Production Deployment

See **`docs/CHUNKED_UPLOADS_MIGRATION_CHECKLIST.md`** for detailed steps.

---

## Testing

### Manual Test
1. Upload a small file (< 100MB) → Should use single-shot
2. Upload a large file (> 100MB) → Should use chunked
3. Start large upload, refresh browser, upload same file → Should resume
4. Check browser console for "using chunked upload" message

### Automated Test
```powershell
# Run the test script
.\test-chunked-upload.ps1

# With custom file
.\test-chunked-upload.ps1 -TestFile "C:\path\to\large-video.mp4"

# With custom credentials
.\test-chunked-upload.ps1 -Email "user@example.com" -Password "password"
```

### Database Verification
```sql
-- Check active sessions
SELECT id, filename, status, chunks_uploaded, total_chunks 
FROM upload_sessions 
WHERE status IN ('pending', 'uploading');

-- Check quota is correct
SELECT user_id, storage_used_bytes, storage_limit_bytes
FROM user_quotas;

-- Run cleanup
SELECT cleanup_expired_upload_sessions();
```

---

## Configuration

### Backend Settings (server/src/index.js)

```javascript
// Max chunk size (default 50MB)
limits: { fileSize: 50 * 1024 * 1024 }
```

### Frontend Settings (src/hooks/useUpload.tsx)

```typescript
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100MB threshold
const MAX_RETRIES = 3; // Chunk retry attempts
```

---

## Maintenance

### Setup Cleanup Cron Job (Recommended)

Clean up expired sessions every hour:

```bash
# Add to crontab
crontab -e

# Add this line
0 * * * * curl -X POST http://localhost:8081/api/admin/cleanup-expired-sessions \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Manual Cleanup

```powershell
# Via API (requires admin token)
Invoke-WebRequest -Uri "http://localhost:8081/api/admin/cleanup-expired-sessions" `
  -Method POST `
  -Headers @{Authorization="Bearer $adminToken"}

# Via database
psql $DATABASE_URL -c "SELECT cleanup_expired_upload_sessions();"

# Cleanup old chunk files manually (if needed)
Get-ChildItem "data\videos\chunks" | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-1)} | Remove-Item
```

---

## Monitoring

### Check Disk Usage
```powershell
# Windows
Get-ChildItem "data\videos\chunks" -Recurse | Measure-Object -Property Length -Sum

# Linux/Mac
du -sh data/videos/chunks/
```

### Monitor Sessions
```sql
-- Active sessions
SELECT COUNT(*) FROM upload_sessions WHERE status IN ('pending', 'uploading');

-- Sessions by status (last 24h)
SELECT status, COUNT(*) 
FROM upload_sessions 
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY status;

-- Average upload time
SELECT AVG(completed_at - created_at) as avg_duration
FROM upload_sessions
WHERE status = 'completed';
```

---

## Troubleshooting

### Chunks not cleaning up
```bash
# Run cleanup function
SELECT cleanup_expired_upload_sessions();

# Manual cleanup
find data/videos/chunks/ -type f -mtime +1 -delete
```

### Quota not freed
```bash
# Reconcile storage
curl http://localhost:8081/api/admin/reconcile-storage \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Upload stuck
```sql
-- Check session status
SELECT * FROM upload_sessions WHERE id = 'session-id';

-- Cancel stuck session
UPDATE upload_sessions SET status = 'cancelled' WHERE id = 'session-id';
```

---

## Performance Notes

**Chunk Size Trade-offs:**
- 5MB (current): Good balance for most scenarios
- Smaller (1-2MB): Better resumability, more requests
- Larger (10-20MB): Faster on fast connections, less resumable

**Database Notes:**
- Indexes created for performance
- Consider partitioning `upload_sessions` for high volume
- Regular VACUUM recommended

**Storage Notes:**
- Chunks stored in `data/videos/chunks/`
- Cleaned up after successful assembly
- Monitor disk usage in production

---

## Security

✅ **Session Ownership** - All routes verify session belongs to user  
✅ **Quota Enforcement** - Quota reserved atomically at start  
✅ **File Type Validation** - MIME type checked  
✅ **Size Limits** - Both chunk and total file size enforced  
✅ **Auto Expiration** - Sessions expire after 24 hours  
✅ **Path Safety** - Server-generated chunk filenames only  

---

## Future Enhancements

Potential improvements (not yet implemented):

- Parallel chunk uploads (upload multiple chunks concurrently)
- Chunk deduplication (skip duplicate chunks)
- Direct Storj upload (bypass server for chunks)
- Chunk verification (MD5/SHA checksums)
- Progress webhooks (WebSocket real-time updates)
- Compression (compress chunks before upload)

---

## Key Differences from Single-Shot Upload

| Feature | Single-Shot | Chunked |
|---------|------------|---------|
| **Trigger** | Files ≤ 100MB | Files > 100MB |
| **API Route** | `/api/upload` | `/api/upload/start` + chunks |
| **Progress** | Simulated | Real (chunk-by-chunk) |
| **Resumable** | No | Yes (survives page reload) |
| **Quota Reserve** | On upload | On session start |
| **Storage** | Direct to final location | Chunks → Assembly |
| **Cleanup** | Immediate | After assembly |

---

## Quick Reference

**Documentation:**
- Full Guide: `docs/CHUNKED_UPLOADS_GUIDE.md`
- Migration: `docs/CHUNKED_UPLOADS_MIGRATION_CHECKLIST.md`

**Key Files:**
- DB Migration: `supabase/migrations/20260204120000_add_chunked_uploads.sql`
- Backend: `server/src/index.js`
- Frontend API: `src/lib/api.ts`
- Upload Hook: `src/hooks/useUpload.tsx`
- Test Script: `test-chunked-upload.ps1`

**Useful Commands:**
```bash
# Run migration
psql $DATABASE_URL -f supabase/migrations/20260204120000_add_chunked_uploads.sql

# Test upload
.\test-chunked-upload.ps1

# Cleanup sessions
curl -X POST http://localhost:8081/api/admin/cleanup-expired-sessions \
  -H "Authorization: Bearer $TOKEN"

# Check disk usage
du -sh data/videos/chunks/
```

---

## Success Criteria

The implementation is successful if:

✅ Small files (< 100MB) upload using single-shot (no change)  
✅ Large files (> 100MB) upload using chunks  
✅ Progress bar updates with each chunk  
✅ Page reload during upload allows resuming  
✅ Quota remains accurate  
✅ Chunks are cleaned up after assembly  
✅ Works with both local and Storj storage  
✅ No increase in failed uploads  

---

## Support

For issues:
1. Check `docs/CHUNKED_UPLOADS_GUIDE.md` troubleshooting section
2. Review backend logs for errors
3. Inspect database session state
4. Check browser console for frontend errors
5. Verify chunk files on disk

Enable debug logging via admin panel for detailed logs.

---

**Implementation Date**: February 4, 2026  
**Status**: ✅ Complete and Ready for Testing  
**Backward Compatible**: Yes  
**Breaking Changes**: None  
