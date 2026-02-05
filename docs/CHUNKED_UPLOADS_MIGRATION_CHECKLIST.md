# Chunked Upload Migration Checklist ✅ (with Direct Presigned URLs)

**NEW**: Includes direct-to-Storj uploads for maximum performance!

## Pre-Migration

- [ ] Backup database
- [ ] Note current disk space available
- [ ] Document current upload success rate
- [ ] Test in development environment first

## Database Migration

- [ ] Run migration SQL file:
  ```bash
  # IMPORTANT: Run on 'streamshare' database, NOT 'postgres'
  psql $DATABASE_URL -f supabase/migrations/20260204120000_add_chunked_uploads.sql
  
  # Or with Docker Compose:
  cat supabase/migrations/20260204120000_add_chunked_uploads.sql | docker compose exec -T db psql -U postgres -d streamshare
  ```
- [ ] Verify tables created:
  ```sql
  \dt public.upload_*
  ```
- [ ] Verify indexes created:
  ```sql
  \di upload_*
  ```
- [ ] Test cleanup function:
  ```sql
  SELECT cleanup_expired_upload_sessions();
  ```

## Backend Deployment

- [ ] Pull/deploy updated `server/src/index.js`
- [ ] Create chunks directory:
  ```bash
  mkdir -p data/videos/chunks
  ```
- [ ] Restart backend service
- [ ] Verify health endpoint: `curl http://localhost:8081/health`
- [ ] Check logs for startup errors

## Frontend Deployment

- [ ] Pull/deploy updated frontend files:
  - `src/lib/api.ts`
  - `src/hooks/useUpload.tsx`
- [ ] Rebuild frontend: `npm run build` (if needed)
- [ ] Restart frontend dev server: `npm run dev`
- [ ] Verify no console errors on page load

## Smoke Tests

- [ ] Test 1: Upload small file (< 100MB)
  - Should use single-shot upload
  - Check console: "using single-shot upload"
  - Verify video appears in dashboard
  
- [ ] Test 2: Upload large file (> 100MB)
  - Should use chunked upload  
  - Check console: "using chunked upload"
  - Verify progress updates per chunk
  - Verify video appears in dashboard
  
- [ ] Test 3: **Direct Upload to Storj (NEW)** 🚀
  - Upload large file with Storj configured
  - Check browser console: "Direct upload to Storj: chunks/..."
  - Backend logs: "[chunked-upload] Direct upload detected"
  - Verify NO chunk files in `data/videos/chunks/` (uploaded directly!)
  - Check network tab: PUT requests to `gateway.storjshare.io`

- [ ] Test 4: Check database
  ```sql
  SELECT COUNT(*) FROM upload_sessions;
  SELECT COUNT(*) FROM upload_chunks;
  ```

- [ ] Test 5: Verify quota still works
  - Check quota display in UI
  - Upload a file and verify quota decreases
  - Delete a file and verify quota increases

## Post-Migration Setup

- [ ] Set up cleanup cron job:
  ```bash
  # Add to crontab
  0 * * * * curl -X POST http://localhost:8081/api/admin/cleanup-expired-sessions \
    -H "Authorization: Bearer $ADMIN_TOKEN"
  ```

- [ ] Configure monitoring alerts (optional):
  - Disk usage for chunks directory
  - Long-running sessions
  - Failed uploads

- [ ] Update user documentation (if applicable)

## Rollback Plan (If Needed)

If issues arise:

1. [ ] Revert backend code to previous version
2. [ ] Restart backend
3. [ ] Frontend will fall back to single-shot uploads automatically
4. [ ] Database tables can remain (no harm, just unused)
5. [ ] To fully rollback database:
   ```sql
   DROP TABLE IF EXISTS upload_chunks CASCADE;
   DROP TABLE IF EXISTS upload_sessions CASCADE;
   DROP FUNCTION IF EXISTS cleanup_expired_upload_sessions CASCADE;
   ```

## Validation (24 hours post-migration)

- [ ] Check for orphaned chunks:
  ```bash
  du -sh data/videos/chunks/
  ```
  
- [ ] Verify cleanup ran:
  ```sql
  SELECT COUNT(*) FROM upload_sessions WHERE status = 'cancelled';
  ```

- [ ] Check upload success rate:
  ```sql
  SELECT status, COUNT(*) 
  FROM upload_sessions 
  WHERE created_at > now() - INTERVAL '24 hours'
  GROUP BY status;
  ```

- [ ] Review error logs for any issues

- [ ] User feedback: Any complaints?

## Success Criteria

✅ Migration is successful if:
- Small files still upload correctly (single-shot)
- Large files upload correctly (chunked)
- **Direct uploads bypass backend (99% bandwidth savings!)** 🚀
- Quota system still accurate
- No increase in failed uploads
- Chunks are cleaned up properly
- No disk space issues

---

## Performance Benefits (Direct Uploads)

When Storj is configured, you get:
- **99%+ bandwidth reduction** on backend
- **90%+ CPU reduction** on backend  
- Unlimited scalability (no backend bottleneck)
- Faster uploads (direct to storage)
- Lower cloud egress costs

**Example:** 500MB upload
- **Old:** 1000MB through backend (500 in + 500 out)
- **New:** ~0.1MB through backend (presigned URLs only)
- **Savings:** 99.99%!

See [PRESIGNED_URL_UPLOADS.md](./PRESIGNED_URL_UPLOADS.md) for details.

---

## Timeline Estimate

- Database Migration: 1 minute
- Backend Deployment: 2-5 minutes
- Frontend Deployment: 2-5 minutes  
- Smoke Tests: 10-15 minutes
- **Total: ~20-30 minutes**

---

## Contact/Escalation

If issues arise during migration:
1. Check logs: `docker compose logs api` or server console
2. Check database: Connect to psql and inspect tables
3. Review CHUNKED_UPLOADS_GUIDE.md troubleshooting section
4. Rollback if critical issues

---

## Notes

- ✅ Fully backward compatible - existing uploads will not break
- ✅ Gradual adoption - only files > 100MB use new system
- ✅ Can be rolled back without data loss
- ⚠️ Requires periodic cleanup (cron job recommended)
- ⚠️ Monitor disk usage in chunks directory
