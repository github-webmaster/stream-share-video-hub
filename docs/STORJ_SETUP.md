# STORJ S3 Integration Guide

## Overview

This guide explains how to set up and configure STORJ S3 for decentralized video storage in StreamShare Hub. The implementation includes automatic fallback to Supabase Storage for reliability.

## Features

✅ **Secure Upload Endpoint** - Edge function at `/api/upload/video`  
✅ **STORJ S3 Integration** - Decentralized cloud storage with AWS S3 compatibility  
✅ **File Validation** - Type, size, and user quota checking  
✅ **Admin Panel** - Easy configuration interface (admin only)  
✅ **Role-Based Access** - First registered user automatically becomes admin  
✅ **Error Handling** - Retry logic with exponential backoff  
✅ **Progress Tracking** - Real-time upload status monitoring  
✅ **Automatic Fallback** - Falls back to Supabase if STORJ unavailable  

## Prerequisites

1. Active Supabase project
2. STORJ account (sign up at https://www.storj.io/)
3. STORJ S3 credentials (Access Key, Secret Key, Bucket)

## Getting STORJ Credentials

### Step 1: Create a STORJ Account
1. Go to https://www.storj.io/
2. Sign up for a free account
3. Complete email verification

### Step 2: Create an Access Grant
1. Log in to the STORJ dashboard
2. Navigate to **Access** → **Create Access Grant**
3. Choose "S3 Credentials"
4. Give your access grant a name (e.g., "StreamShare Hub")
5. Select permissions:
   - ✅ Read
   - ✅ Write
   - ✅ List
   - ✅ Delete

### Step 3: Create a Bucket
1. Go to **Buckets** in the STORJ dashboard
2. Click **New Bucket**
3. Enter a bucket name (e.g., "streamshare-videos")
4. Save the bucket name

### Step 4: Generate S3 Credentials
1. After creating the access grant, STORJ will display:
   - **Access Key ID** (save this)
   - **Secret Access Key** (save this - shown only once!)
   - **Endpoint** (typically `https://gateway.storjshare.io`)

## Configuration

### Option 1: Admin Panel (Recommended)

1. **Create First User Account**
   - Register as the first user on your StreamShare Hub instance
   - You'll automatically be assigned admin role

2. **Access Admin Panel**
   - Navigate to `/admin` or click the Settings icon in the dashboard
   - You'll see the "Admin Panel" page

3. **Configure STORJ**
   - Toggle "Use STORJ S3" to ON
   - Enter your STORJ credentials:
     - **Access Key**: Your STORJ Access Key ID
     - **Secret Key**: Your STORJ Secret Access Key
     - **Bucket Name**: Your STORJ bucket name
     - **Endpoint**: `https://gateway.storjshare.io` (default)
   - Set **Maximum File Size** (default: 500MB)

4. **Test Connection** (Optional but Recommended)
   - Click "Test Connection" button
   - Verify the connection is successful
   - If it fails, double-check your credentials

5. **Save Configuration**
   - Click "Save Changes"
   - Your configuration is now active!

### Option 2: Database Configuration

If you prefer to configure directly via database:

```sql
-- Update storage configuration
UPDATE public.storage_config
SET 
  provider = 'storj',
  storj_access_key = 'your-access-key-here',
  storj_secret_key = 'your-secret-key-here',
  storj_bucket = 'your-bucket-name',
  storj_endpoint = 'https://gateway.storjshare.io',
  max_file_size_mb = 500,
  updated_at = NOW()
WHERE id = (SELECT id FROM public.storage_config LIMIT 1);
```

## How It Works

### Upload Flow

1. **User Uploads Video**
   - User selects video file via drag-and-drop or file picker
   - File is validated (type, size, quota)

2. **Authentication**
   - Edge function verifies user session
   - Checks user quota availability

3. **Storage Selection**
   - If STORJ is configured → Attempt STORJ upload
   - If STORJ fails → Fallback to Supabase Storage
   - If STORJ not configured → Use Supabase Storage

4. **STORJ Upload Process**
   - Generate AWS4-HMAC-SHA256 signature
   - Upload file to STORJ via S3-compatible API
   - Store public STORJ URL in database

5. **Progress Tracking**
   - Real-time progress updates
   - Retry logic on failures (max 3 retries)
   - Success/failure notifications

6. **Database Updates**
   - Create video record
   - Update user quota
   - Track upload progress

## Architecture

### Database Tables

**storage_config**
- Stores STORJ configuration
- Admin-only access via RLS policies
- Single row configuration

**upload_progress**
- Tracks upload status
- Records storage provider used
- Supports retry tracking

**user_quotas**
- 5GB default storage limit per user
- Tracks used/available space
- Updated after each upload

**user_roles**
- Admin/user role assignment
- First user = admin
- Subsequent users = user

### Edge Function

Location: `supabase/functions/upload-video/index.ts`

Key Functions:
- `createS3Signature()` - Generates AWS S3 signature for STORJ
- `uploadToStorj()` - Handles STORJ upload with signed requests
- `uploadToSupabase()` - Fallback Supabase storage upload

## File Validation

### Allowed File Types
- video/mp4
- video/webm
- video/quicktime
- video/x-msvideo

### File Size Limits
- Default: 500MB per file
- Configurable via admin panel (1MB - 5000MB)

### User Quotas
- Default: 5GB per user
- Tracks total storage used
- Prevents uploads exceeding quota

## Security

### Authentication
- All uploads require valid user session
- Bearer token authentication
- RLS policies enforce access control

### Admin Access
- First registered user = automatic admin
- Admin panel restricted to admin role
- STORJ credentials encrypted at rest

### Data Protection
- Videos stored with encryption at rest
- Secure S3 signature generation
- No credential exposure in client

## Monitoring

### Upload Progress
- Real-time progress tracking
- Status states: pending, uploading, completed, failed
- Automatic retry on network errors

### Error Handling
- Max 3 retry attempts
- Exponential backoff (1s, 2s, 3s)
- Detailed error messages
- Automatic fallback to Supabase

## Troubleshooting

### STORJ Connection Fails

**Issue**: Test connection fails or uploads fail

**Solutions**:
1. Verify credentials are correct
2. Check bucket exists and is accessible
3. Ensure access grant has correct permissions
4. Confirm endpoint URL is correct
5. Check STORJ service status

### Uploads Falling Back to Supabase

**Issue**: All uploads use Supabase despite STORJ configuration

**Solutions**:
1. Check if STORJ provider is selected
2. Verify all STORJ credentials are filled
3. Review edge function logs for errors
4. Test STORJ connection in admin panel

### Quota Exceeded Error

**Issue**: User cannot upload despite having space

**Solutions**:
1. Check user_quotas table for actual usage
2. Verify storage_limit_bytes is correct
3. Recalculate used storage if needed:
   ```sql
   UPDATE user_quotas
   SET storage_used_bytes = (
     SELECT COALESCE(SUM(size), 0)
     FROM videos
     WHERE user_id = user_quotas.user_id
   )
   WHERE user_id = 'user-id-here';
   ```

### Admin Panel Not Accessible

**Issue**: Cannot access `/admin` route

**Solutions**:
1. Verify user is logged in
2. Check user_roles table for admin role
3. Clear browser cache and cookies
4. Re-login to refresh session

## Performance Tips

### Optimize Upload Speed
- Use modern browsers (Chrome, Firefox, Safari)
- Stable internet connection recommended
- Files under 500MB upload faster

### STORJ Performance
- STORJ uses decentralized storage (can be slower than centralized)
- Automatic fallback ensures reliability
- Consider Supabase for mission-critical uploads

### Cost Optimization
- STORJ offers pay-as-you-go pricing
- Supabase has generous free tier
- Monitor usage in respective dashboards

## API Reference

### Upload Endpoint

**URL**: `POST /functions/v1/upload-video`

**Headers**:
```
Authorization: Bearer <session-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "filename": "my-video.mp4",
  "contentType": "video/mp4",
  "fileSize": 10485760,
  "fileData": "<base64-encoded-file-data>"
}
```

**Response Success**:
```json
{
  "success": true,
  "video": {
    "id": "uuid",
    "share_id": "share-uuid",
    "storage_path": "user-id/file.mp4",
    "storage_provider": "storj",
    "url": "https://link.storjshare.io/raw/bucket/file.mp4"
  }
}
```

**Response Error**:
```json
{
  "error": "Error message"
}
```

## Testing

Run the complete test suite:

```bash
npm test
```

Tests cover:
- ✅ File validation
- ✅ Storage provider selection
- ✅ Fallback logic
- ✅ Admin access control
- ✅ Quota management
- ✅ Error handling
- ✅ Progress tracking

## Migration Guide

### From Supabase-Only to STORJ

1. **Backup existing videos** (optional but recommended)
2. **Set up STORJ credentials** (follow steps above)
3. **Configure STORJ** in admin panel
4. **Test with small upload**
5. **Monitor for 24 hours**
6. **Existing videos remain in Supabase** (no automatic migration)

### From STORJ Back to Supabase

1. Go to admin panel
2. Toggle "Use STORJ S3" to OFF
3. Save changes
4. All new uploads use Supabase
5. Existing STORJ videos remain accessible

## Support

### Documentation
- Main README: `/README.md`
- Database Schema: `/supabase/migrations/`
- Edge Function: `/supabase/functions/upload-video/`

### Common Issues
- Check Supabase logs for edge function errors
- Review browser console for client errors
- Verify network connectivity
- Check STORJ dashboard for service status

## Best Practices

1. **Always test connection** before saving STORJ config
2. **Monitor storage usage** in both STORJ and Supabase dashboards
3. **Keep credentials secure** - never commit to version control
4. **Set reasonable quotas** to prevent abuse
5. **Use fallback** for production reliability
6. **Regular backups** recommended for critical content
7. **Monitor edge function logs** for issues

## License

This implementation follows the main project license. STORJ usage subject to STORJ Terms of Service.

---

**Need Help?** 
- Check troubleshooting section above
- Review Supabase edge function logs
- Consult STORJ documentation: https://docs.storj.io/
