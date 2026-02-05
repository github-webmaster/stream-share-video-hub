// Example: Direct presigned URL upload for chunks
// This demonstrates the client-side implementation

import { videoApi } from "@/lib/api";

/**
 * Upload a large video using direct-to-Storj presigned URLs
 */
export async function uploadLargeVideo(file: File): Promise<string> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // 1. Start upload session
  const session = await videoApi.startChunkedUpload(
    file.name,
    file.size,
    file.type,
    totalChunks
  );
  
  console.log(`📦 Session started: ${session.sessionId}`);
  
  try {
    // 2. Upload each chunk directly to Storj
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);
      
      console.log(`⬆️  Chunk ${i + 1}/${totalChunks}: ${chunkBlob.size} bytes`);
      
      // Get presigned URL
      const { url, key } = await videoApi.getChunkUploadUrl(session.sessionId, i);
      
      // PUT directly to Storj (bypasses backend!)
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: chunkBlob,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      // Notify backend chunk is complete
      await videoApi.notifyChunkComplete(session.sessionId, i, key, chunkBlob.size);
      
      console.log(`✅ Chunk ${i + 1} uploaded to: ${key}`);
    }
    
    // 3. Complete the upload (backend assembles chunks in Storj)
    console.log(`🔧 Assembling ${totalChunks} chunks...`);
    const result = await videoApi.completeChunkedUpload(session.sessionId);
    
    console.log(`🎉 Upload complete! Video ID: ${result.videoId}`);
    return result.videoId!;
    
  } catch (error) {
    // Cancel session on error
    await videoApi.cancelChunkedUpload(session.sessionId);
    throw error;
  }
}

/**
 * Example with progress tracking and retry logic
 */
export async function uploadWithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<string> {
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const MAX_RETRIES = 3;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  const session = await videoApi.startChunkedUpload(
    file.name,
    file.size,
    file.type,
    totalChunks
  );
  
  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
      
      // Retry logic
      let success = false;
      let retries = 0;
      
      while (!success && retries < MAX_RETRIES) {
        try {
          const { url, key } = await videoApi.getChunkUploadUrl(session.sessionId, i);
          
          // Direct PUT to Storj
          await fetch(url, {
            method: 'PUT',
            body: chunk,
            headers: { 'Content-Type': 'application/octet-stream' },
          });
          
          // Notify backend
          await videoApi.notifyChunkComplete(session.sessionId, i, key, chunk.size);
          success = true;
          
        } catch (error) {
          retries++;
          if (retries >= MAX_RETRIES) throw error;
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      // Update progress (0-80% for upload, 80-100% for processing)
      const progress = Math.round(((i + 1) / totalChunks) * 80);
      onProgress(progress);
    }
    
    // Processing phase
    onProgress(85);
    const result = await videoApi.completeChunkedUpload(session.sessionId);
    onProgress(100);
    
    return result.videoId!;
    
  } catch (error) {
    await videoApi.cancelChunkedUpload(session.sessionId);
    throw error;
  }
}

/**
 * Example: Simple usage
 */
async function example() {
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  const file = fileInput?.files?.[0];
  
  if (!file) return;
  
  console.log(`📁 Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
  
  const videoId = await uploadLargeVideo(file);
  
  console.log(`✅ Done! Video ID: ${videoId}`);
}

/**
 * Comparison: Backend vs Direct Upload
 */
function showBandwidthSavings(fileSize: number) {
  const MB = fileSize / 1024 / 1024;
  
  console.log('📊 Bandwidth Comparison:');
  console.log('');
  console.log('  Backend Upload (old):');
  console.log(`    Client → Backend: ${MB.toFixed(2)}MB`);
  console.log(`    Backend → Storj:  ${MB.toFixed(2)}MB`);
  console.log(`    Total:            ${(MB * 2).toFixed(2)}MB through backend`);
  console.log('');
  console.log('  Direct Upload (new):');
  console.log(`    Client → Storj:   ${MB.toFixed(2)}MB (direct!)`);
  console.log('    Backend traffic:  ~0.1MB (URLs only)');
  console.log(`    Savings:          ${((MB * 2 - 0.1) / (MB * 2) * 100).toFixed(2)}%`);
}

// Example output for 500MB file:
// showBandwidthSavings(500 * 1024 * 1024);
// 📊 Bandwidth Comparison:
//   Backend Upload (old):
//     Client → Backend: 500.00MB
//     Backend → Storj:  500.00MB  
//     Total:            1000.00MB through backend
//   Direct Upload (new):
//     Client → Storj:   500.00MB (direct!)
//     Backend traffic:  ~0.1MB (URLs only)
//     Savings:          99.99%
