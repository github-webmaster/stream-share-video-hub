import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StorageConfig {
  provider: string;
  storj_access_key: string | null;
  storj_secret_key: string | null;
  storj_endpoint: string | null;
  storj_bucket: string | null;
  max_file_size_mb: number;
  allowed_types: string[];
}

interface UploadRequest {
  filename: string;
  contentType: string;
  fileSize: number;
  fileData: string; // base64 encoded
}

// Create S3 signature for STORJ
async function createS3Signature(
  method: string,
  path: string,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string,
  payload: ArrayBuffer,
  contentType: string
): Promise<{ headers: Record<string, string>; signedUrl: string }> {
  const encoder = new TextEncoder();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await crypto.subtle.digest("SHA-256", payload);
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:gateway.storjshare.io\n` +
    `x-amz-content-sha256:${payloadHashHex}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHashHex}`;

  const canonicalRequestHash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHashHex}`;

  // Create signing key
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretKey}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");

  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return {
    headers: {
      "Content-Type": contentType,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHashHex,
      Authorization: authHeader,
    },
    signedUrl: `https://gateway.storjshare.io${path}`,
  };
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

async function uploadToStorj(
  config: StorageConfig,
  filePath: string,
  fileData: ArrayBuffer,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const path = `/${config.storj_bucket}/${filePath}`;
    
    const { headers, signedUrl } = await createS3Signature(
      "PUT",
      path,
      config.storj_access_key!,
      config.storj_secret_key!,
      "us-east-1",
      "s3",
      fileData,
      contentType
    );

    const response = await fetch(signedUrl, {
      method: "PUT",
      headers,
      body: fileData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `STORJ upload failed: ${response.status} - ${errorText}` };
    }

    return {
      success: true,
      url: `https://link.storjshare.io/raw/${config.storj_bucket}/${filePath}`,
    };
  } catch (error) {
    return { success: false, error: `STORJ error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function uploadToSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  authHeader: string,
  filePath: string,
  fileData: ArrayBuffer,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { error } = await client.storage
      .from("videos")
      .upload(filePath, fileData, {
        contentType,
        upsert: false,
      });

    if (error) {
      return { success: false, error: `Supabase upload failed: ${error.message}` };
    }

    const { data: urlData } = client.storage
      .from("videos")
      .getPublicUrl(filePath);

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    return { success: false, error: `Supabase error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create authenticated client for user operations
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Parse request body
    const body: UploadRequest = await req.json();
    const { filename, contentType, fileSize, fileData } = body;

    if (!filename || !contentType || !fileSize || !fileData) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: filename, contentType, fileSize, fileData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get storage config
    const { data: configData } = await adminClient.rpc("get_storage_config");
    
    const config: StorageConfig = configData?.[0] || {
      provider: "supabase",
      storj_access_key: null,
      storj_secret_key: null,
      storj_endpoint: null,
      storj_bucket: null,
      max_file_size_mb: 500,
      allowed_types: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
    };

    // Validate file type
    if (!config.allowed_types.includes(contentType)) {
      return new Response(
        JSON.stringify({ 
          error: `File type not allowed. Allowed types: ${config.allowed_types.join(", ")}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size
    const maxBytes = config.max_file_size_mb * 1024 * 1024;
    if (fileSize > maxBytes) {
      return new Response(
        JSON.stringify({ 
          error: `File too large. Maximum size: ${config.max_file_size_mb}MB` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user quota
    const { data: quotaData } = await adminClient.rpc("check_user_quota", {
      _user_id: userId,
      _file_size: fileSize,
    });

    if (quotaData && quotaData[0] && !quotaData[0].has_quota) {
      const remaining = quotaData[0].remaining;
      return new Response(
        JSON.stringify({ 
          error: `Storage quota exceeded. Remaining: ${Math.floor(remaining / 1024 / 1024)}MB` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create upload progress record
    const { data: progressData, error: progressError } = await supabaseClient
      .from("upload_progress")
      .insert({
        user_id: userId,
        filename,
        file_size: fileSize,
        status: "uploading",
        storage_provider: config.provider === "storj" && config.storj_access_key ? "storj" : "supabase",
      })
      .select("id")
      .single();

    if (progressError) {
      console.error("Progress record error:", progressError);
    }

    const progressId = progressData?.id;

    // Decode base64 file data
    const binaryArray = Uint8Array.from(atob(fileData), (c) => c.charCodeAt(0));
    const binaryData = binaryArray.buffer as ArrayBuffer;

    // Generate file path
    const fileExt = filename.split(".").pop() || "mp4";
    const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${userId}/${uniqueName}`;

    let uploadResult: { success: boolean; url?: string; error?: string };
    let storageProvider = "supabase";

    // Try STORJ first if configured
    if (
      config.provider === "storj" &&
      config.storj_access_key &&
      config.storj_secret_key &&
      config.storj_bucket
    ) {
      storageProvider = "storj";
      uploadResult = await uploadToStorj(config, filePath, binaryData, contentType);

      // Fallback to Supabase if STORJ fails
      if (!uploadResult.success) {
        console.log("STORJ upload failed, falling back to Supabase:", uploadResult.error);
        storageProvider = "supabase";
        uploadResult = await uploadToSupabase(supabaseUrl, supabaseAnonKey, authHeader, filePath, binaryData, contentType);
      }
    } else {
      // Use Supabase storage
      uploadResult = await uploadToSupabase(supabaseUrl, supabaseAnonKey, authHeader, filePath, binaryData, contentType);
    }

    if (!uploadResult.success) {
      // Update progress to failed
      if (progressId) {
        await supabaseClient
          .from("upload_progress")
          .update({
            status: "failed",
            error_message: uploadResult.error,
            retry_count: 1,
          })
          .eq("id", progressId);
      }

      return new Response(
        JSON.stringify({ error: uploadResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create video record
    const { data: videoData, error: videoError } = await supabaseClient
      .from("videos")
      .insert({
        title: filename.split(".")[0] || "Untitled",
        filename,
        storage_path: filePath,
        user_id: userId,
        size: fileSize,
      })
      .select("id, share_id")
      .single();

    if (videoError) {
      return new Response(
        JSON.stringify({ error: `Database error: ${videoError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user quota
    await adminClient.rpc("update_user_quota", {
      _user_id: userId,
      _bytes_added: fileSize,
    });

    // Update progress to completed
    if (progressId) {
      await supabaseClient
        .from("upload_progress")
        .update({
          status: "completed",
          bytes_uploaded: fileSize,
          storage_provider: storageProvider,
        })
        .eq("id", progressId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        video: {
          id: videoData.id,
          share_id: videoData.share_id,
          storage_path: filePath,
          storage_provider: storageProvider,
          url: uploadResult.url,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
