import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CreateMultipartUploadCommand, UploadPartCopyCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import pino from "pino";
import BackupService from './services/backupService.js';




dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const PORT = Number(process.env.PORT || 8081);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "";
const STORAGE_BASE = path.resolve(process.env.STORAGE_PATH || "data/videos");
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 500);
const ALLOWED_TYPES = (process.env.ALLOWED_TYPES || "video/mp4,video/webm,video/quicktime,video/x-msvideo")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const DEBUG_ENABLED = process.env.DEBUG_ENABLED === "true" || process.env.NODE_ENV === "development";

const debugLog = (message, ...args) => {
  if (DEBUG_ENABLED || global.runtimeDebugEnabled) {
    logger.debug(message, ...args);
  }
};

// Make debugLog globally accessible for runtime toggle
global.debugLog = debugLog;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

fs.mkdirSync(STORAGE_BASE, { recursive: true });

// Database SSL: disabled for Docker internal networks, enabled only if DATABASE_SSL=true
const useSSL = process.env.DATABASE_SSL === "true";
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

// Ensure admin user exists on startup
const ensureAdminUser = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@streamshare.app";
  const adminPassword = process.env.ADMIN_PASSWORD || "StreamShare2026!";
  
  try {
    // Check if any users exist
    const { rows: users } = await pool.query("SELECT COUNT(*)::int AS count FROM public.users");
    if (users[0]?.count > 0) {
      // Check if admin user exists, update password if needed
      const { rows: existing } = await pool.query("SELECT id FROM public.users WHERE email = $1", [adminEmail]);
      if (existing.length > 0) {
        // Update password hash to ensure it's compatible with Node.js bcrypt
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await pool.query("UPDATE public.users SET password_hash = $1 WHERE email = $2", [passwordHash, adminEmail]);
        console.log(`[startup] Updated admin user password hash: ${adminEmail}`);
        return;
      }
    }
    
    // Create admin user if no users exist or admin doesn't exist
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const { rows } = await pool.query(
      "INSERT INTO public.users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = $2 RETURNING id",
      [adminEmail, passwordHash]
    );
    const adminId = rows[0].id;
    
    // Create profile
    await pool.query(
      "INSERT INTO public.profiles (id, default_visibility) VALUES ($1, 'public') ON CONFLICT (id) DO NOTHING",
      [adminId]
    );
    
    // Add admin role
    await pool.query(
      "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING",
      [adminId, 'admin']
    );
    
    // Set storage quota
    await pool.query(
      "INSERT INTO public.user_quotas (user_id, storage_limit_bytes) VALUES ($1, 10737418240) ON CONFLICT (user_id) DO NOTHING",
      [adminId]
    );
    
    console.log(`[startup] Admin user ready: ${adminEmail}`);
  } catch (error) {
    console.error("[startup] Failed to ensure admin user:", error.message);
  }
};

// Run admin check after a short delay to ensure DB is ready
setTimeout(() => {
  ensureAdminUser().catch(err => console.error('[startup] Admin user check failed:', err));
}, 3000);

// Initialize Backup Service
const backupService = new BackupService(pool);
setTimeout(() => {
  backupService.init().catch(err => console.error('[Backup] Failed to start service:', err));
}, 5000);

const app = express();

// Trust proxy (required when behind Cloudflare/nginx/Traefik)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "blob:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
}));

// Helper to check if request is from admin (for rate limit bypass)
const isAdminRequest = async (req) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return false;
    
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query(
      "SELECT role FROM public.user_roles WHERE user_id = $1 AND role = 'admin'",
      [payload.sub]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
};

// Rate limiting - 15 minutes window, 500 requests max per IP (admins bypass)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
  skip: async (req) => {
    // Always skip health checks and auth/me
    if (req.path === "/health" || req.path === "/api/auth/me") return true;
    // Skip rate limiting for admin users
    return await isAdminRequest(req);
  },
});

app.use(limiter);

// Login-specific rate limiting (20 failed attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  message: "Too many login attempts, please try again later.",
});

// Compression
app.use(compression());

// Request metrics tracking
let requestCount = 0;
let errorCount = 0;

app.use((req, res, next) => {
  requestCount++;
  const originalSend = res.send;
  res.send = function (data) {
    if (res.statusCode >= 400) errorCount++;
    originalSend.call(this, data);
  };
  next();
});

// CORS
const corsOrigins = CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",");
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/media", express.static(STORAGE_BASE));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, STORAGE_BASE),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const name = `${Date.now()}_${randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    debugLog(`[multer] File filter - mimetype: ${file.mimetype}, allowed: ${ALLOWED_TYPES.includes(file.mimetype)}`);
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("File type not allowed"));
  },
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  debugLog(`[multer] Error occurred:`, err.message);
  debugLog(`[multer] Request headers:`, Object.fromEntries(Object.entries(req.headers).filter(([key]) => !key.toLowerCase().includes('authorization'))));

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Maximum size: ${MAX_FILE_SIZE_MB}MB` });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: "Unexpected file field name. Expected 'file'" });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err.message === 'File type not allowed') {
    return res.status(400).json({ error: `File type not allowed. Allowed types: ${ALLOWED_TYPES.join(", ")}` });
  }

  console.error(`[multer] Unexpected error:`, err);
  return res.status(500).json({ error: "File upload failed" });
};

// --- Caching ---
const cache = {
  config: { data: null, expiresAt: 0 },
  roles: new Map(), // userId -> { data: string[], expiresAt: number }
};

const CACHE_TTL = {
  CONFIG: 5 * 60 * 1000, // 5 minutes
  ROLES: 60 * 1000,      // 1 minute
};

const getStorageConfig = async () => {
  const now = Date.now();
  if (cache.config.data && cache.config.expiresAt > now) {
    return cache.config.data;
  }

  try {
    const { rows } = await pool.query("SELECT * FROM public.storage_config ORDER BY created_at LIMIT 1");
    if (rows.length > 0) {
      cache.config = {
        data: rows[0],
        expiresAt: now + CACHE_TTL.CONFIG
      };
      return rows[0];
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch storage config:", error);
    return null;
  }
};

const buildStorjSignedUrl = async (config, key) => {
  const client = new S3Client({
    region: "us-east-1",
    endpoint: config.storj_endpoint,
    credentials: {
      accessKeyId: config.storj_access_key,
      secretAccessKey: config.storj_secret_key,
    },
    forcePathStyle: true,
  });

  const command = new GetObjectCommand({
    Bucket: config.storj_bucket,
    Key: key,
  });

  // Generate signed URL valid for 24 hours
  const signedUrl = await getSignedUrl(client, command, { expiresIn: 86400 });
  return signedUrl;
};

const getStorjKeyFromUrl = (rawUrl, bucket) => {
  try {
    const url = new URL(rawUrl);
    const rawPrefix = `/raw/${bucket}/`;
    if (url.pathname.startsWith(rawPrefix)) {
      return url.pathname.slice(rawPrefix.length);
    }
    const bucketPrefix = `/${bucket}/`;
    if (url.pathname.startsWith(bucketPrefix)) {
      return url.pathname.slice(bucketPrefix.length);
    }
  } catch (error) {
    return null;
  }
  return null;
};

const uploadToStorj = async (config, file, key) => {
  const client = new S3Client({
    region: "us-east-1",
    endpoint: config.storj_endpoint,
    credentials: {
      accessKeyId: config.storj_access_key,
      secretAccessKey: config.storj_secret_key,
    },
    forcePathStyle: true,
  });

  // Stream the file directly to S3 using multipart upload
  const fileStream = fs.createReadStream(file.path);
  const upload = new Upload({
    client,
    params: {
      Bucket: config.storj_bucket,
      Key: key,
      Body: fileStream,
      ContentType: file.mimetype,
    },
  });

  await upload.done();
  // Store just the key, not the full URL - we'll generate signed URLs on-the-fly
  return `storj://${config.storj_bucket}/${key}`;
};

const deleteFromStorj = async (config, key) => {
  const client = new S3Client({
    region: "us-east-1",
    endpoint: config.storj_endpoint,
    credentials: {
      accessKeyId: config.storj_access_key,
      secretAccessKey: config.storj_secret_key,
    },
    forcePathStyle: true,
  });

  const command = new DeleteObjectCommand({
    Bucket: config.storj_bucket,
    Key: key,
  });

  await client.send(command);
};

// Get video expiration days for a user
// Returns: user-specific override > global config > 60 (default)
// 0 means no expiration, null means use global default
const getVideoExpirationDays = async (userId) => {
  try {
    // First check user-specific override
    const { rows: userRows } = await pool.query(
      "SELECT video_expiration_days FROM public.user_quotas WHERE user_id = $1",
      [userId]
    );
    
    const userExpiry = userRows[0]?.video_expiration_days;
    
    // If user has specific override (including 0 for 'never'), use it
    if (userExpiry !== null && userExpiry !== undefined) {
      return userExpiry;
    }
    
    // Otherwise use global config
    const config = await getStorageConfig();
    if (config?.video_expiration_days !== null && config?.video_expiration_days !== undefined) {
      return config.video_expiration_days;
    }
    
    // Default to 60 days
    return 60;
  } catch (error) {
    console.error("Error getting video expiration days:", error);
    return 60; // Default
  }
};

// Clean up expired videos (uses expires_at column)
const cleanupExpiredVideos = async () => {
  try {
    const { rows } = await pool.query(
      "SELECT id, user_id, storage_path, size FROM public.videos WHERE expires_at IS NOT NULL AND expires_at < now()"
    );

    if (rows.length === 0) {
      logger.info("No expired videos to clean up");
      return { deleted: 0, freedBytes: 0 };
    }

    logger.info({ count: rows.length }, "Starting expired video cleanup");
    let totalFreedBytes = 0;
    const config = await getStorageConfig();

    for (const video of rows) {
      try {
        // Delete from storage
        if (video.storage_path.startsWith("storj://")) {
          const match = video.storage_path.match(/^storj:\/\/[^\/]+\/(.+)$/);
          if (match && config?.provider === "storj") {
            await deleteFromStorj(config, match[1]);
          }
        } else if (video.storage_path.startsWith("https://link.storjshare.io/")) {
          if (config?.provider === "storj" && config.storj_bucket) {
            const key = getStorjKeyFromUrl(video.storage_path, config.storj_bucket);
            if (key) {
              await deleteFromStorj(config, key);
            }
          }
        } else if (!video.storage_path.startsWith("http")) {
          const filePath = safeJoin(STORAGE_BASE, video.storage_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }

        // Delete video record
        await pool.query("DELETE FROM public.videos WHERE id = $1", [video.id]);
        
        if (video.size) {
          totalFreedBytes += video.size;
          // Update user quota
          await pool.query(
            "UPDATE public.user_quotas SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE user_id = $2",
            [video.size, video.user_id]
          );
        }
      } catch (videoErr) {
        console.error(`Failed to cleanup expired video ${video.id}:`, videoErr.message);
      }
    }

    logger.info({ deleted: rows.length, freedBytes: totalFreedBytes }, "Expired video cleanup complete");
    return { deleted: rows.length, freedBytes: totalFreedBytes };
  } catch (error) {
    console.error("Error during expired video cleanup:", error);
    return { deleted: 0, freedBytes: 0 };
  }
};

// Run expired video cleanup on startup and every hour
const startExpirationCleanup = () => {
  // Run immediately on startup
  setTimeout(() => {
    cleanupExpiredVideos().catch(err => console.error("Startup cleanup failed:", err));
  }, 10000); // Wait 10 seconds after startup
  
  // Then run every hour
  setInterval(() => {
    cleanupExpiredVideos().catch(err => console.error("Scheduled cleanup failed:", err));
  }, 60 * 60 * 1000); // Every hour
};

// Start cleanup scheduler
startExpirationCleanup();

// Legacy cleanup function - kept for backward compatibility
// Clean up videos older than 90 days for non-admin users
const cleanupOldVideos = async (userId) => {
  try {
    // Check if user is admin - admins get unlimited retention
    try {
      const roles = await getUserRoles(userId);
      if (roles && roles.includes("admin")) {
        debugLog(`[cleanupOldVideos] Skipping retention cleanup for admin user ${userId}`);
        return;
      }
    } catch (roleErr) {
      console.warn(`[cleanupOldVideos] Failed to determine roles for user ${userId}:`, roleErr.message);
      // If role check fails, proceed with caution and continue cleanup for safety
    }

    // Non-admin users: 90 day retention
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { rows } = await pool.query(
      "SELECT id, storage_path, size FROM public.videos WHERE user_id = $1 AND created_at < $2",
      [userId, ninetyDaysAgo]
    );

    let totalFreedBytes = 0;

    for (const video of rows) {
      if (video.storage_path.startsWith("http")) {
        const config = await getStorageConfig();
        if (config?.provider === "storj" && config.storj_bucket) {
          const key = getStorjKeyFromUrl(video.storage_path, config.storj_bucket);
          if (key) {
            await deleteFromStorj(config, key);
          }
        }
      } else {
        const filePath = safeJoin(STORAGE_BASE, video.storage_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await pool.query("DELETE FROM public.videos WHERE id = $1", [video.id]);
      if (video.size) {
        totalFreedBytes += video.size;
      }
    }

    // Update storage quota if any videos were deleted
    if (totalFreedBytes > 0) {
      await pool.query(
        "UPDATE public.user_quotas SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE user_id = $2",
        [totalFreedBytes, userId]
      );
    }
  } catch (error) {
    console.error("Error cleaning up old videos:", error);
  }
};

const reconcileUserQuota = async (userId) => {
  try {
    const { rows: videoRows } = await pool.query(
      "SELECT COALESCE(SUM(size), 0) as total_size FROM public.videos WHERE user_id = $1",
      [userId]
    );

    const actualSize = videoRows[0]?.total_size || 0;

    const { rows: quotaRows } = await pool.query(
      "SELECT storage_used_bytes FROM public.user_quotas WHERE user_id = $1",
      [userId]
    );

    const recordedSize = quotaRows[0]?.storage_used_bytes || 0;

    if (actualSize !== recordedSize) {
      console.log(`[reconcile] User ${userId}: recorded=${recordedSize}, actual=${actualSize}, delta=${actualSize - recordedSize}`);
      await pool.query(
        "UPDATE public.user_quotas SET storage_used_bytes = $1 WHERE user_id = $2",
        [actualSize, userId]
      );
      return true;
    }
  } catch (error) {
    console.error("[reconcile] Error reconciling quota:", error);
  }
  return false;
};

const signToken = (user) => {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
};

const authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  debugLog(`[auth] Auth header present:`, !!authHeader);
  debugLog(`[auth] Auth header format valid:`, authHeader.startsWith("Bearer "));

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    debugLog(`[auth] No valid token found`);
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    debugLog(`[auth] Token verified for user:`, req.user.id);
    return next();
  } catch (error) {
    debugLog(`[auth] Token verification failed:`, error.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};

const getUserRoles = async (userId) => {
  const now = Date.now();
  const cached = cache.roles.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const { rows } = await pool.query(
      "SELECT role FROM public.user_roles WHERE user_id = $1",
      [userId]
    );
    const roles = rows.map((row) => row.role);

    cache.roles.set(userId, {
      data: roles,
      expiresAt: now + CACHE_TTL.ROLES
    });

    return roles;
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    return [];
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const roles = await getUserRoles(req.user.id);
    if (!roles.includes("admin")) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.roles = roles;
    return next();
  } catch (error) {
    return res.status(500).json({ error: "Failed to verify admin" });
  }
};

const safeJoin = (baseDir, target) => {
  const targetPath = path.normalize(path.join(baseDir, target));
  if (!targetPath.startsWith(baseDir)) {
    throw new Error("Invalid path");
  }
  return targetPath;
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/metrics", (_req, res) => {
  res.json({
    requests: requestCount,
    errors: errorCount,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Debug endpoint to check auth status (only in development or when DEBUG_ENABLED)
app.get("/api/auth/debug", async (req, res) => {
  if (process.env.NODE_ENV === "production" && !DEBUG_ENABLED) {
    return res.status(403).json({ error: "Debug endpoint disabled in production" });
  }
  
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@streamshare.app";
    const { rows: userCheck } = await pool.query(
      "SELECT id, email, password_hash IS NOT NULL as has_password FROM public.users WHERE email = $1",
      [adminEmail]
    );
    const { rows: userCount } = await pool.query("SELECT COUNT(*)::int AS count FROM public.users");
    const { rows: rolesCheck } = await pool.query("SELECT COUNT(*)::int AS count FROM public.user_roles");
    
    return res.json({
      adminEmail,
      adminExists: userCheck.length > 0,
      adminHasPassword: userCheck[0]?.has_password || false,
      totalUsers: userCount[0]?.count || 0,
      totalRoles: rolesCheck[0]?.count || 0,
      jwtSecretSet: !!JWT_SECRET,
      databaseConnected: true
    });
  } catch (error) {
    return res.json({
      error: error.message,
      databaseConnected: false
    });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const existing = await pool.query("SELECT id FROM public.users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS count FROM public.users");
    const userCount = countRows[0]?.count || 0;
    const role = userCount === 0 ? "admin" : "user";

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO public.users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [email, passwordHash]
    );
    const user = rows[0];

    await pool.query(
      "INSERT INTO public.profiles (id, default_visibility) VALUES ($1, 'public') ON CONFLICT (id) DO NOTHING",
      [user.id]
    );
    await pool.query(
      "INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING",
      [user.id, role]
    );

    // Set storage limit
    const config = await getStorageConfig();
    const defaultLimit = (config?.default_storage_limit_mb || 512) * 1024 * 1024;
    const storageLimit = role === "admin" ? 10737418240 : defaultLimit;

    await pool.query(
      "INSERT INTO public.user_quotas (user_id, storage_limit_bytes) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
      [user.id, storageLimit]
    );

    const token = signToken(user);
    return res.status(201).json({ token, user, roles: [role] });
  } catch (error) {
    console.error("[signup] Error creating user:", error);
    return res.status(500).json({ error: "Failed to create user" });
  }
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, email, password_hash, created_at FROM public.users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    let match = false;
    try {
      match = await bcrypt.compare(password, user.password_hash);
    } catch (bcryptError) {
      console.error(`[login] Bcrypt error for ${email}:`, bcryptError.message);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const roles = await getUserRoles(user.id);
    const token = signToken(user);
    return res.json({ token, user: { id: user.id, email: user.email, created_at: user.created_at }, roles });
  } catch (error) {
    console.error("[login] Error:", error.message || error);
    return res.status(500).json({ error: "Failed to login" });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, created_at FROM public.users WHERE id = $1",
      [req.user.id]
    );
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const roles = await getUserRoles(user.id);
    return res.json({ user, roles });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

app.patch("/api/auth/email", authRequired, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT password_hash FROM public.users WHERE id = $1",
      [req.user.id]
    );
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    await pool.query("UPDATE public.users SET email = $1 WHERE id = $2", [email, req.user.id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update email" });
  }
});

app.patch("/api/auth/password", authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT password_hash FROM public.users WHERE id = $1",
      [req.user.id]
    );
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE public.users SET password_hash = $1 WHERE id = $2", [passwordHash, req.user.id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update password" });
  }
});

app.get("/api/admin/status", authRequired, async (req, res) => {
  try {
    const roles = await getUserRoles(req.user.id);
    return res.json({ isAdmin: roles.includes("admin") });
  } catch (error) {
    return res.status(500).json({ error: "Failed to check admin" });
  }
});

app.get("/api/admin/debug-status", authRequired, requireAdmin, async (_req, res) => {
  try {
    return res.json({ debugEnabled: DEBUG_ENABLED });
  } catch (error) {
    return res.status(500).json({ error: "Failed to get debug status" });
  }
});

// In-memory debug toggle (resets on server restart)
let runtimeDebugEnabled = DEBUG_ENABLED;

app.post("/api/admin/toggle-debug", authRequired, requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: "Enabled must be a boolean" });
    }

    runtimeDebugEnabled = enabled;

    // Update the global debugLog function  
    global.debugLog = (message, ...args) => {
      if (runtimeDebugEnabled) {
        console.log(message, ...args);
      }
    };

    console.log(`[admin] Debug logging ${enabled ? 'enabled' : 'disabled'} by admin`);
    return res.json({ debugEnabled: runtimeDebugEnabled });
  } catch (error) {
    return res.status(500).json({ error: "Failed to toggle debug" });
  }
});

// --- Backup API Routes ---

app.get("/api/admin/backups", authRequired, requireAdmin, async (_req, res) => {
  try {
    const defaultSchedule = '0 2 * * *';
    const defaultConfig = { backup_enabled: false, backup_schedule: defaultSchedule, backup_retention_days: 30 };
    
    let config = defaultConfig;
    try {
      const result = await pool.query(
        "SELECT backup_enabled, backup_schedule, backup_retention_days FROM public.storage_config LIMIT 1"
      );
      if (result.rows[0]) {
        config = {
          backup_enabled: result.rows[0].backup_enabled ?? false,
          backup_schedule: result.rows[0].backup_schedule ?? defaultSchedule,
          backup_retention_days: result.rows[0].backup_retention_days ?? 30
        };
      }
    } catch (queryErr) {
      // Columns may not exist yet, use defaults
      console.warn("[backup] Config columns may not exist, using defaults:", queryErr.message);
    }
    
    let files = [];
    try {
      files = await backupService.listBackups();
    } catch (listErr) {
      console.warn("[backup] Failed to list backups:", listErr.message);
    }

    return res.json({ config, files });
  } catch (error) {
    console.error("[backup] Failed to fetch info:", error);
    return res.status(500).json({ error: "Failed to fetch backup info" });
  }
});

app.post("/api/admin/backups/config", authRequired, requireAdmin, async (req, res) => {
  const { enabled, schedule, retentionDays } = req.body;
  try {
    // Upsert config
    await pool.query(`
      INSERT INTO public.storage_config (id, backup_enabled, backup_schedule, backup_retention_days)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        backup_enabled = EXCLUDED.backup_enabled,
        backup_schedule = EXCLUDED.backup_schedule,
        backup_retention_days = EXCLUDED.backup_retention_days,
        updated_at = NOW()
    `, [enabled, schedule, retentionDays]);

    await backupService.refreshSchedule();
    return res.json({ success: true });
  } catch (error) {
    console.error("[backup] Failed to update config:", error);
    return res.status(500).json({ error: "Failed to update backup config" });
  }
});

app.post("/api/admin/backups/run", authRequired, requireAdmin, async (_req, res) => {
  try {
    const result = await backupService.runBackup();
    if (result.success) {
      return res.json({ success: true, file: result.file });
    } else {
      return res.status(500).json({ error: result.message });
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal server error during backup" });
  }
});

app.get("/api/admin/reconcile-storage", authRequired, requireAdmin, async (_req, res) => {
  try {
    await pool.query("SELECT public.reconcile_user_storage()");
    return res.json({ success: true, message: "Storage quotas reconciled" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to reconcile storage" });
  }
});

app.get("/api/admin/users", authRequired, requireAdmin, async (req, res) => {
  try {
    // Try query with video_expiration_days first (new schema)
    let rows;
    try {
      const result = await pool.query(`
        SELECT 
          u.id, 
          u.email, 
          u.created_at,
          COALESCE(q.storage_used_bytes, 0) as storage_used,
          COALESCE(q.storage_limit_bytes, 0) as storage_limit,
          COALESCE(q.upload_count, 0) as upload_count,
          q.video_expiration_days,
          array_remove(array_agg(r.role), NULL) as roles
        FROM public.users u
        LEFT JOIN public.user_quotas q ON u.id = q.user_id
        LEFT JOIN public.user_roles r ON u.id = r.user_id
        GROUP BY u.id, u.email, u.created_at, q.storage_used_bytes, q.storage_limit_bytes, q.upload_count, q.video_expiration_days
        ORDER BY u.created_at DESC
      `);
      rows = result.rows;
    } catch (colError) {
      // Fallback for old schema without video_expiration_days column
      console.log("[admin] Using fallback users query (video_expiration_days column may not exist)");
      const result = await pool.query(`
        SELECT 
          u.id, 
          u.email, 
          u.created_at,
          COALESCE(q.storage_used_bytes, 0) as storage_used,
          COALESCE(q.storage_limit_bytes, 0) as storage_limit,
          COALESCE(q.upload_count, 0) as upload_count,
          NULL as video_expiration_days,
          array_remove(array_agg(r.role), NULL) as roles
        FROM public.users u
        LEFT JOIN public.user_quotas q ON u.id = q.user_id
        LEFT JOIN public.user_roles r ON u.id = r.user_id
        GROUP BY u.id, u.email, u.created_at, q.storage_used_bytes, q.storage_limit_bytes, q.upload_count
        ORDER BY u.created_at DESC
      `);
      rows = result.rows;
    }
    return res.json({ users: rows });
  } catch (error) {
    console.error("[admin] Failed to list users:", error);
    return res.status(500).json({ error: "Failed to list users" });
  }
});

app.patch("/api/admin/users/:id/password", authRequired, requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE public.users SET password_hash = $1 WHERE id = $2", [passwordHash, req.params.id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update password" });
  }
});

app.delete("/api/admin/users/:id", authRequired, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (userId === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  try {
    // 1. Get all videos to delete files
    const { rows: videos } = await pool.query("SELECT id, storage_path FROM public.videos WHERE user_id = $1", [userId]);
    const config = await getStorageConfig();

    for (const video of videos) {
      try {
        if (video.storage_path.startsWith("storj://")) {
          if (config?.provider === "storj" && config.storj_access_key && config.storj_secret_key) {
            const match = video.storage_path.match(/^storj:\/\/[^\/]+\/(.+)$/);
            if (match) await deleteFromStorj(config, match[1]);
          }
        } else if (video.storage_path.startsWith("https://link.storjshare.io/")) {
          if (config?.provider === "storj" && config.storj_bucket) {
            const key = getStorjKeyFromUrl(video.storage_path, config.storj_bucket);
            if (key) await deleteFromStorj(config, key);
          }
        } else if (!video.storage_path.startsWith("http")) {
          const filePath = safeJoin(STORAGE_BASE, video.storage_path);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`[admin] Failed to delete file for video ${video.id}:`, err);
      }
    }

    // 2. Delete DB records
    await pool.query("DELETE FROM public.videos WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM public.upload_sessions WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM public.user_quotas WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM public.user_roles WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM public.profiles WHERE id = $1", [userId]);
    await pool.query("DELETE FROM public.users WHERE id = $1", [userId]);

    return res.json({ success: true });
  } catch (error) {
    console.error("[admin] Failed to delete user:", error);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

app.get("/api/storage-config", authRequired, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM public.storage_config ORDER BY created_at LIMIT 1");
    return res.json({ config: rows[0] || null });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch storage config" });
  }
});

app.put("/api/storage-config", authRequired, requireAdmin, async (req, res) => {
  const updates = req.body || {};
  try {
    const { rows } = await pool.query("SELECT id FROM public.storage_config ORDER BY created_at LIMIT 1");
    const config = rows[0];
    if (!config) {
      return res.status(404).json({ error: "Storage config not found" });
    }

    const fields = ["provider", "storj_access_key", "storj_secret_key", "storj_endpoint", "storj_bucket", "max_file_size_mb", "allowed_types", "default_storage_limit_mb"];
    const setParts = [];
    const values = [];

    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        values.push(updates[field]);
        setParts.push(`${field} = $${values.length}`);
      }
    });

    if (setParts.length === 0) {
      return res.json({ success: true });
    }

    values.push(config.id);
    await pool.query(`UPDATE public.storage_config SET ${setParts.join(", ")} WHERE id = $${values.length}`, values);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update storage config" });
  }
});

app.patch("/api/admin/users/:id/quota", authRequired, requireAdmin, async (req, res) => {
  const { storageLimitBytes } = req.body;
  if (typeof storageLimitBytes !== 'number' || storageLimitBytes < 0) {
    return res.status(400).json({ error: "Invalid storage limit" });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO public.user_quotas (user_id, storage_limit_bytes, storage_used_bytes, upload_count) VALUES ($1, $2, 0, 0) ON CONFLICT (user_id) DO UPDATE SET storage_limit_bytes = $2 RETURNING storage_limit_bytes",
      [req.params.id, storageLimitBytes]
    );
    return res.json({ success: true, storage_limit_bytes: rows[0].storage_limit_bytes });
  } catch (error) {
    console.error("[admin] Failed to update user quota:", error);
    return res.status(500).json({ error: "Failed to update user quota" });
  }
});

// Update user's video expiration days
// null = use global default, 0 = never expire, > 0 = specific days
app.patch("/api/admin/users/:id/expiration", authRequired, requireAdmin, async (req, res) => {
  const { videoExpirationDays } = req.body;
  
  // Allow null (use global default), 0 (never expire), or positive numbers
  if (videoExpirationDays !== null && (typeof videoExpirationDays !== 'number' || videoExpirationDays < 0)) {
    return res.status(400).json({ error: "Invalid expiration value. Use null for default, 0 for never, or positive number for days." });
  }

  try {
    await pool.query(
      `INSERT INTO public.user_quotas (user_id, video_expiration_days, storage_used_bytes, storage_limit_bytes, upload_count) 
       VALUES ($1, $2, 0, 536870912, 0) 
       ON CONFLICT (user_id) DO UPDATE SET video_expiration_days = $2, updated_at = now()`,
      [req.params.id, videoExpirationDays]
    );
    return res.json({ success: true, video_expiration_days: videoExpirationDays });
  } catch (error) {
    console.error("[admin] Failed to update user expiration:", error);
    return res.status(500).json({ error: "Failed to update user expiration" });
  }
});

app.get("/api/user-quota", authRequired, async (req, res) => {
  try {
    debugLog(`[quota] Fetching quota for user ${req.user.id}`);

    // Get user roles to ensure proper quota limits
    const roles = await getUserRoles(req.user.id);
    const isAdmin = roles && roles.includes("admin");

    const config = await getStorageConfig();
    const defaultLimit = (config?.default_storage_limit_mb || 512) * 1024 * 1024;
    const expectedLimit = isAdmin ? 10737418240 : defaultLimit;

    // ALWAYS reconcile quota on fetch to ensure accuracy
    await reconcileUserQuota(req.user.id);

    const { rows } = await pool.query(
      "SELECT storage_used_bytes, storage_limit_bytes, upload_count FROM public.user_quotas WHERE user_id = $1",
      [req.user.id]
    );

    let quota = rows[0];

    // Create quota if doesn't exist
    if (!quota) {
      debugLog(`[quota] Creating new quota record for user ${req.user.id}`);
      await pool.query(
        "INSERT INTO public.user_quotas (user_id, storage_limit_bytes, storage_used_bytes, upload_count) VALUES ($1, $2, 0, 0)",
        [req.user.id, expectedLimit]
      );
      quota = { storage_used_bytes: 0, storage_limit_bytes: expectedLimit, upload_count: 0 };
    }
    // Update quota limit ONLY if it was using the OLD default (512MB) and the new default is different, 
    // OR if we want to enforce defaults (careful not to overwrite manual overrides).
    // For now, let's ONLY set it on creation or if it's 0/null. Manual overrides via admin panel should persist.
    else if (!quota.storage_limit_bytes) {
      await pool.query(
        "UPDATE public.user_quotas SET storage_limit_bytes = $1 WHERE user_id = $2",
        [expectedLimit, req.user.id]
      );
      quota.storage_limit_bytes = expectedLimit;
    }

    // Ensure numeric values
    quota.storage_used_bytes = parseInt(quota.storage_used_bytes) || 0;
    quota.storage_limit_bytes = parseInt(quota.storage_limit_bytes) || expectedLimit;
    quota.upload_count = parseInt(quota.upload_count) || 0;

    debugLog(`[quota] Returning quota: used=${quota.storage_used_bytes}, limit=${quota.storage_limit_bytes}, uploads=${quota.upload_count}`);

    return res.json({ quota });
  } catch (error) {
    console.error('[quota] Failed to fetch quota:', error);
    return res.status(500).json({ error: "Failed to fetch quota" });
  }
});

app.get("/api/videos", authRequired, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      "SELECT id, title, filename, storage_path, share_id, views, created_at, size, COUNT(*) OVER() as total_count FROM public.videos WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [req.user.id, limit, offset]
    );

    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    const config = await getStorageConfig();
    const storjEnabled = config?.provider === "storj" && config.storj_access_key && config.storj_secret_key;

    // Enhance videos with mediaUrl
    const enhancedVideos = await Promise.all(
      rows.map(async (row) => {
        // eslint-disable-next-line no-unused-vars
        const { total_count, ...video } = row;
        let mediaUrl = video.storage_path;

        try {
          // Always use signed URLs for any STORJ video (old or new)
          let storjKey = null;
          if (video.storage_path.startsWith("storj://")) {
            const match = video.storage_path.match(/^storj:\/\/[^\/]+\/(.+)$/);
            if (match) storjKey = match[1];
          } else if (video.storage_path.startsWith("https://link.storjshare.io/")) {
            storjKey = getStorjKeyFromUrl(video.storage_path, config.storj_bucket);
          }
          if (storjKey && storjEnabled) {
            try {
              mediaUrl = await buildStorjSignedUrl(config, storjKey);
            } catch (error) {
              console.warn(`[videos] Signed URL generation failed, using original:`, error.message);
            }
          } else if (!video.storage_path.startsWith("http://") && !video.storage_path.startsWith("https://")) {
            mediaUrl = `/media/${video.storage_path}`;
          }
        } catch (error) {
          console.error(`[videos] Failed to generate URL for ${video.id}:`, error.message);
        }

        return { ...video, mediaUrl };
      })
    );

    return res.json({ videos: enhancedVideos, total, page, limit });
  } catch (error) {
    console.error("[videos] Error:", error);
    return res.status(500).json({ error: "Failed to fetch videos" });
  }
});

app.get("/api/video-media/:videoId", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT storage_path FROM public.videos WHERE id = $1 AND user_id = $2",
      [req.params.videoId, req.user.id]
    );

    const video = rows[0];
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const storagePath = video.storage_path;

    // Handle STORJ URLs - generate fresh signed URL
    if (storagePath.startsWith("storj://")) {
      const config = await getStorageConfig();
      if (config?.provider === "storj" && config.storj_access_key && config.storj_secret_key) {
        // Extract key from storj://bucket/key format
        const match = storagePath.match(/^storj:\/\/[^\/]+\/(.+)$/);
        if (match) {
          const key = match[1];
          try {
            const signedUrl = await buildStorjSignedUrl(config, key);
            return res.json({ url: signedUrl });
          } catch (error) {
            console.error(`[video-media] Failed to generate signed URL for ${key}:`, error.message);
            return res.status(500).json({ error: "Failed to generate video URL" });
          }
        }
      }
      return res.status(400).json({ error: "STORJ not configured" });
    }

    // Handle local files
    if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
      return res.json({ url: storagePath });
    }

    // Local file path
    const mediaUrl = `/media/${storagePath}`;
    return res.json({ url: mediaUrl });
  } catch (error) {
    console.error(`[video-media] Error:`, error);
    return res.status(500).json({ error: "Failed to fetch video URL" });
  }
});

app.patch("/api/videos/:id", authRequired, async (req, res) => {
  const { title } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    const { rowCount } = await pool.query(
      "UPDATE public.videos SET title = $1 WHERE id = $2 AND user_id = $3",
      [title, req.params.id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: "Video not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update video" });
  }
});

app.delete("/api/videos/:id", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM public.videos WHERE id = $1 AND user_id = $2 RETURNING storage_path, size",
      [req.params.id, req.user.id]
    );
    const video = rows[0];
    // Return success even if video not found (idempotent delete)
    if (!video) {
      return res.json({ success: true });
    }

    const config = await getStorageConfig();

    // Handle new-style STORJ URLs (storj://bucket/key)
    if (video.storage_path.startsWith("storj://")) {
      if (config?.provider === "storj" && config.storj_access_key && config.storj_secret_key) {
        const match = video.storage_path.match(/^storj:\/\/[^\/]+\/(.+)$/);
        if (match) {
          await deleteFromStorj(config, match[1]);
        }
      }
    }
    // Handle old-style STORJ URLs
    else if (video.storage_path.startsWith("https://link.storjshare.io/")) {
      if (config?.provider === "storj" && config.storj_bucket) {
        const key = getStorjKeyFromUrl(video.storage_path, config.storj_bucket);
        if (key) {
          await deleteFromStorj(config, key);
        }
      }
    }
    // Handle local files
    else {
      const filePath = safeJoin(STORAGE_BASE, video.storage_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Update storage quota
    if (video.size) {
      await pool.query(
        "UPDATE public.user_quotas SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE user_id = $2",
        [video.size, req.user.id]
      );
    }

    // Always reconcile quota after delete to prevent orphaned storage
    await reconcileUserQuota(req.user.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete video" });
  }
});

// ==================== CHUNKED UPLOAD ROUTES ====================

// Start a chunked upload session
app.post("/api/upload/start", authRequired, async (req, res) => {
  const { filename, fileSize, mimetype, totalChunks } = req.body;

  if (!filename || !fileSize || !mimetype || !totalChunks) {
    return res.status(400).json({ error: "Missing required fields: filename, fileSize, mimetype, totalChunks" });
  }

  if (!ALLOWED_TYPES.includes(mimetype)) {
    return res.status(400).json({ error: `File type not allowed. Allowed types: ${ALLOWED_TYPES.join(", ")}` });
  }

  if (fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return res.status(400).json({ error: `File too large. Maximum size: ${MAX_FILE_SIZE_MB}MB` });
  }

  try {
    debugLog(`[chunked-upload] Starting session for user ${req.user.id}, file: ${filename}, size: ${fileSize}`);

    // Clean up old videos
    await cleanupOldVideos(req.user.id);

    // Auto-reconcile quota
    await reconcileUserQuota(req.user.id);

    // Get user roles and determine quota
    const roles = await getUserRoles(req.user.id);
    const isAdmin = roles && roles.includes("admin");

    const config = await getStorageConfig();
    const defaultLimit = (config?.default_storage_limit_mb || 512) * 1024 * 1024;
    const MIN_QUOTA = isAdmin ? 10737418240 : defaultLimit;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Lock user quota
      const { rows: qRows } = await client.query(
        "SELECT storage_used_bytes, storage_limit_bytes FROM public.user_quotas WHERE user_id = $1 FOR UPDATE",
        [req.user.id]
      );

      if (qRows.length === 0) {
        await client.query(
          "INSERT INTO public.user_quotas (user_id, storage_limit_bytes) VALUES ($1, $2)",
          [req.user.id, MIN_QUOTA]
        );
        const { rows: newQ } = await client.query(
          "SELECT storage_used_bytes, storage_limit_bytes FROM public.user_quotas WHERE user_id = $1 FOR UPDATE",
          [req.user.id]
        );
        qRows.push(...newQ);
      }

      let quota = qRows[0];
      if (!quota.storage_limit_bytes || quota.storage_limit_bytes < MIN_QUOTA) {
        // Only auto-upgrade if below MIN_QUOTA (e.g. role change or default increase), 
        // but respect if it was manually set higher? 
        // Actually, for simplicity, if it's less than the *current* default/role-based minimum, bump it up.
        await client.query(
          "UPDATE public.user_quotas SET storage_limit_bytes = $1 WHERE user_id = $2",
          [MIN_QUOTA, req.user.id]
        );
        quota.storage_limit_bytes = MIN_QUOTA;
      }

      debugLog(`[chunked-upload] Quota check: ${quota.storage_used_bytes} + ${fileSize} vs ${quota.storage_limit_bytes}`);

      const currentUsed = parseInt(quota.storage_used_bytes) || 0;
      const fileSizeInt = parseInt(fileSize) || 0;
      const storageLimit = parseInt(quota.storage_limit_bytes) || 0;

      // Skip quota check for admin
      if (!isAdmin && (currentUsed + fileSizeInt) > storageLimit) {
        await client.query("ROLLBACK");
        debugLog(`[chunked-upload] Quota exceeded for user ${req.user.id}`);
        return res.status(400).json({
          error: "Storage quota exceeded",
          details: DEBUG_ENABLED ? { currentUsed, fileSize: fileSizeInt, storageLimit } : undefined
        });
      }

      // Reserve quota
      await client.query(
        "UPDATE public.user_quotas SET storage_used_bytes = storage_used_bytes + $1 WHERE user_id = $2",
        [fileSize, req.user.id]
      );

      // Create upload session
      const shareId = randomBytes(6).toString("hex");
      const { rows: sessRows } = await client.query(
        `INSERT INTO public.upload_sessions 
         (user_id, filename, file_size, mimetype, total_chunks, share_id, status, quota_reserved, reserved_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', true, $7)
         RETURNING id, share_id, expires_at`,
        [req.user.id, filename, fileSize, mimetype, totalChunks, shareId, fileSize]
      );

      await client.query("COMMIT");
      client.release();

      const session = sessRows[0];
      debugLog(`[chunked-upload] Session created: ${session.id}`);

      return res.json({
        sessionId: session.id,
        shareId: session.share_id,
        expiresAt: session.expires_at
      });
    } catch (err) {
      await client.query("ROLLBACK");
      client.release();
      throw err;
    }
  } catch (error) {
    console.error(`[chunked-upload] Error starting session:`, error);
    return res.status(500).json({ error: "Failed to start upload session" });
  }
});

// Get presigned URL for direct chunk upload
app.post("/api/upload/chunk-url/:sessionId/:chunkNumber", authRequired, async (req, res) => {
  const { sessionId, chunkNumber } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT user_id, total_chunks, mimetype FROM public.upload_sessions WHERE id = $1",
      [sessionId]
    );

    if (!rows[0] || rows[0].user_id !== req.user.id) {
      return res.status(404).json({ error: "Session not found" });
    }

    const chunkNum = parseInt(chunkNumber);
    if (chunkNum < 0 || chunkNum >= rows[0].total_chunks) {
      return res.status(400).json({ error: "Invalid chunk number" });
    }

    const config = await getStorageConfig();
    if (config?.provider !== "storj" || !config.storj_access_key) {
      return res.status(400).json({ error: "Direct upload not configured" });
    }

    const client = new S3Client({
      region: "us-east-1",
      endpoint: config.storj_endpoint,
      credentials: {
        accessKeyId: config.storj_access_key,
        secretAccessKey: config.storj_secret_key,
      },
    });

    const key = `chunks/${req.user.id}/${sessionId}/${chunkNumber}`;
    const command = new PutObjectCommand({ Bucket: config.storj_bucket, Key: key });
    const url = await getSignedUrl(client, command, { expiresIn: 3600 });

    return res.json({ url, key });
  } catch (error) {
    console.error("[presigned] Error:", error);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Upload a single chunk
const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const chunksDir = path.join(STORAGE_BASE, "chunks");
      fs.mkdirSync(chunksDir, { recursive: true });
      cb(null, chunksDir);
    },
    filename: (req, file, cb) => {
      const sessionId = req.params.sessionId;
      const chunkNumber = req.body.chunkNumber;
      const name = `${sessionId}_chunk_${chunkNumber}_${Date.now()}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per chunk
});

// Notify backend that a chunk was uploaded directly
app.post("/api/upload/chunk-complete/:sessionId/:chunkNumber", authRequired, async (req, res) => {
  const { sessionId, chunkNumber } = req.params;
  const { key, size } = req.body;

  try {
    const { rows } = await pool.query(
      "SELECT user_id, status, total_chunks FROM public.upload_sessions WHERE id = $1",
      [sessionId]
    );

    if (!rows[0] || rows[0].user_id !== req.user.id) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (rows[0].status !== 'pending' && rows[0].status !== 'uploading') {
      return res.status(400).json({ error: "Invalid session status" });
    }

    const chunkNum = parseInt(chunkNumber);
    const { rows: existing } = await pool.query(
      "SELECT id FROM public.upload_chunks WHERE session_id = $1 AND chunk_number = $2",
      [sessionId, chunkNum]
    );

    if (existing.length > 0) {
      const { rows: updated } = await pool.query(
        "SELECT COUNT(*)::int as count FROM public.upload_chunks WHERE session_id = $1",
        [sessionId]
      );
      return res.json({ success: true, chunksUploaded: updated[0].count });
    }

    await pool.query(
      "INSERT INTO public.upload_chunks (session_id, chunk_number, chunk_size, storage_path) VALUES ($1, $2, $3, $4)",
      [sessionId, chunkNum, size, key]
    );

    const { rows: updated } = await pool.query(
      "UPDATE public.upload_sessions SET chunks_uploaded = chunks_uploaded + 1, status = 'uploading' WHERE id = $1 RETURNING chunks_uploaded",
      [sessionId]
    );

    return res.json({ success: true, chunksUploaded: updated[0].chunks_uploaded });
  } catch (error) {
    console.error("[chunk-complete] Error:", error);
    return res.status(500).json({ error: "Failed to record chunk" });
  }
});

app.post("/api/upload/chunk/:sessionId", authRequired, (req, res, next) => {
  chunkUpload.single("chunk")(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req, res) => {
  const { sessionId } = req.params;
  const { chunkNumber } = req.body;

  if (!req.file || chunkNumber === undefined) {
    return res.status(400).json({ error: "Missing chunk data or chunk number" });
  }

  try {
    debugLog(`[chunked-upload] Uploading chunk ${chunkNumber} for session ${sessionId}`);

    // Verify session belongs to user
    const { rows: sessRows } = await pool.query(
      "SELECT id, user_id, status, total_chunks FROM public.upload_sessions WHERE id = $1",
      [sessionId]
    );

    const session = sessRows[0];
    if (!session) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Upload session not found" });
    }

    if (session.user_id !== req.user.id) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (session.status !== 'pending' && session.status !== 'uploading') {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Cannot upload chunks in status: ${session.status}` });
    }

    const chunkNum = parseInt(chunkNumber);
    if (chunkNum < 0 || chunkNum >= session.total_chunks) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Invalid chunk number" });
    }

    // Check if chunk already exists (allow re-upload for resumability)
    const { rows: existingChunks } = await pool.query(
      "SELECT id FROM public.upload_chunks WHERE session_id = $1 AND chunk_number = $2",
      [sessionId, chunkNum]
    );

    if (existingChunks.length > 0) {
      // Chunk already uploaded, return success
      debugLog(`[chunked-upload] Chunk ${chunkNumber} already exists for session ${sessionId}`);
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      const { rows: updatedChunks } = await pool.query(
        "SELECT COUNT(*)::int as count FROM public.upload_chunks WHERE session_id = $1",
        [sessionId]
      );

      return res.json({
        success: true,
        chunkNumber: chunkNum,
        chunksUploaded: updatedChunks[0].count
      });
    }

    // Store chunk metadata
    await pool.query(
      "INSERT INTO public.upload_chunks (session_id, chunk_number, chunk_size, storage_path) VALUES ($1, $2, $3, $4)",
      [sessionId, chunkNum, req.file.size, req.file.filename]
    );

    // Update session
    const { rows: updatedSess } = await pool.query(
      `UPDATE public.upload_sessions 
       SET chunks_uploaded = chunks_uploaded + 1, status = 'uploading'
       WHERE id = $1 
       RETURNING chunks_uploaded, total_chunks`,
      [sessionId]
    );

    const updated = updatedSess[0];
    debugLog(`[chunked-upload] Chunk ${chunkNumber} uploaded: ${updated.chunks_uploaded}/${updated.total_chunks}`);

    return res.json({
      success: true,
      chunkNumber: chunkNum,
      chunksUploaded: updated.chunks_uploaded,
      totalChunks: updated.total_chunks
    });
  } catch (error) {
    console.error(`[chunked-upload] Error uploading chunk:`, error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: "Failed to upload chunk" });
  }
});

// Complete the chunked upload
app.post("/api/upload/complete/:sessionId", authRequired, async (req, res) => {
  const { sessionId } = req.params;

  try {
    debugLog(`[chunked-upload] Completing session ${sessionId}`);

    // Get session and verify ownership
    const { rows: sessRows } = await pool.query(
      `SELECT * FROM public.upload_sessions WHERE id = $1`,
      [sessionId]
    );

    const session = sessRows[0];
    if (!session) {
      return res.status(404).json({ error: "Upload session not found" });
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (session.status === 'completed') {
      return res.json({ success: true, videoId: session.video_id, shareId: session.share_id });
    }

    if (session.status !== 'uploading' && session.status !== 'pending') {
      return res.status(400).json({ error: `Cannot complete upload in status: ${session.status}` });
    }

    // Verify all chunks uploaded
    if (session.chunks_uploaded !== session.total_chunks) {
      return res.status(400).json({
        error: "Not all chunks uploaded",
        chunksUploaded: session.chunks_uploaded,
        totalChunks: session.total_chunks
      });
    }

    // Update status to assembling
    await pool.query(
      "UPDATE public.upload_sessions SET status = 'assembling' WHERE id = $1",
      [sessionId]
    );

    // Get all chunks in order
    const { rows: chunks } = await pool.query(
      "SELECT chunk_number, storage_path, chunk_size FROM public.upload_chunks WHERE session_id = $1 ORDER BY chunk_number ASC",
      [sessionId]
    );

    if (chunks.length !== session.total_chunks) {
      throw new Error("Chunk count mismatch");
    }

    debugLog(`[chunked-upload] Assembling ${chunks.length} chunks`);

    const config = await getStorageConfig();
    const storjEnabled = config?.provider === "storj" && config.storj_access_key && config.storj_secret_key && config.storj_bucket;
    const ext = path.extname(session.filename || "");

    // Check if chunks were uploaded directly to Storj
    const isDirectUpload = chunks[0]?.storage_path?.startsWith("chunks/");
    let storagePath;

    if (isDirectUpload && storjEnabled) {
      // Chunks are already in Storj - assemble them using multipart upload
      debugLog(`[chunked-upload] Direct upload detected - assembling in Storj`);
      const finalKey = `${req.user.id}/${Date.now()}_${randomBytes(8).toString("hex")}${ext}`;
      const client = new S3Client({
        region: "us-east-1",
        endpoint: config.storj_endpoint,
        credentials: { accessKeyId: config.storj_access_key, secretAccessKey: config.storj_secret_key },
      });

      const multipart = await client.send(new CreateMultipartUploadCommand({
        Bucket: config.storj_bucket,
        Key: finalKey,
        ContentType: session.mimetype,
      }));

      const parts = [];
      for (let i = 0; i < chunks.length; i++) {
        const partResp = await client.send(new UploadPartCopyCommand({
          Bucket: config.storj_bucket,
          Key: finalKey,
          PartNumber: i + 1,
          CopySource: `${config.storj_bucket}/${chunks[i].storage_path}`,
          UploadId: multipart.UploadId,
        }));
        parts.push({ PartNumber: i + 1, ETag: partResp.CopyPartResult.ETag });
      }

      await client.send(new CompleteMultipartUploadCommand({
        Bucket: config.storj_bucket,
        Key: finalKey,
        UploadId: multipart.UploadId,
        MultipartUpload: { Parts: parts },
      }));

      storagePath = `storj://${config.storj_bucket}/${finalKey}`;

      // Clean up chunk objects
      for (const chunk of chunks) {
        await client.send(new DeleteObjectCommand({
          Bucket: config.storj_bucket,
          Key: chunk.storage_path,
        }));
      }
    } else {
      // Legacy path: assemble chunks from local disk
      const chunksDir = path.join(STORAGE_BASE, "chunks");
      const finalFilename = `${Date.now()}_${randomBytes(8).toString("hex")}${ext}`;
      const finalPath = path.join(STORAGE_BASE, finalFilename);
      const writeStream = fs.createWriteStream(finalPath);

      for (const chunk of chunks) {
        const chunkPath = path.join(chunksDir, chunk.storage_path);
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Chunk ${chunk.chunk_number} not found at ${chunkPath}`);
        }
        writeStream.write(fs.readFileSync(chunkPath));
      }

      writeStream.end();
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      debugLog(`[chunked-upload] Chunks assembled to ${finalPath}`);

      storagePath = finalFilename;
      if (storjEnabled) {
        try {
          const key = `${req.user.id}/${Date.now()}_${randomBytes(8).toString("hex")}${ext}`;
          debugLog(`[chunked-upload] Uploading to STORJ: ${key}`);
          storagePath = await uploadToStorj(config, { path: finalPath, mimetype: session.mimetype, originalname: session.filename }, key);
          if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
          debugLog(`[chunked-upload] STORJ upload successful: ${storagePath}`);
        } catch (storjError) {
          console.error(`[chunked-upload] STORJ upload failed, keeping local:`, storjError);
          storagePath = finalFilename;
        }
      }

      // Clean up local chunks
      for (const chunk of chunks) {
        const chunkPath = path.join(chunksDir, chunk.storage_path);
        if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
      }
    }

    // Create video record
    const title = path.basename(session.filename || "Untitled");
    
    // Calculate expiration date based on user/global settings
    const expirationDays = await getVideoExpirationDays(req.user.id);
    const expiresAt = expirationDays > 0 ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString() : null;
    
    const { rows: videoRows } = await pool.query(
      "INSERT INTO public.videos (title, filename, storage_path, share_id, user_id, size, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [title, session.filename, storagePath, session.share_id, req.user.id, session.file_size, expiresAt]
    );

    const videoId = videoRows[0].id;

    // Update session as completed
    await pool.query(
      "UPDATE public.upload_sessions SET status = 'completed', storage_path = $1, completed_at = now() WHERE id = $2",
      [storagePath, sessionId]
    );

    // Increment upload count (quota was already reserved)
    await pool.query(
      "UPDATE public.user_quotas SET upload_count = upload_count + 1 WHERE user_id = $1",
      [req.user.id]
    );

    await pool.query("DELETE FROM public.upload_chunks WHERE session_id = $1", [sessionId]);

    debugLog(`[chunked-upload] Upload completed: video ${videoId}`);

    return res.json({
      success: true,
      videoId,
      shareId: session.share_id
    });
  } catch (error) {
    console.error(`[chunked-upload] Error completing upload:`, error);

    // Mark session as failed
    try {
      await pool.query(
        "UPDATE public.upload_sessions SET status = 'failed', error_message = $1 WHERE id = $2",
        [error.message, sessionId]
      );
    } catch (e) {
      console.error(`[chunked-upload] Failed to update session status:`, e);
    }

    return res.status(500).json({ error: "Failed to complete upload" });
  }
});

// Cancel a chunked upload
app.delete("/api/upload/cancel/:sessionId", authRequired, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const { rows: sessRows } = await pool.query(
      "SELECT * FROM public.upload_sessions WHERE id = $1",
      [sessionId]
    );

    const session = sessRows[0];
    if (!session) {
      return res.status(404).json({ error: "Upload session not found" });
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Free reserved quota
    if (session.quota_reserved && session.reserved_bytes > 0) {
      await pool.query(
        "UPDATE public.user_quotas SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE user_id = $2",
        [session.reserved_bytes, req.user.id]
      );
    }

    // Delete chunks
    const { rows: chunks } = await pool.query(
      "SELECT storage_path FROM public.upload_chunks WHERE session_id = $1",
      [sessionId]
    );

    const chunksDir = path.join(STORAGE_BASE, "chunks");
    for (const chunk of chunks) {
      const chunkPath = path.join(chunksDir, chunk.storage_path);
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
    }

    await pool.query("DELETE FROM public.upload_chunks WHERE session_id = $1", [sessionId]);
    await pool.query("UPDATE public.upload_sessions SET status = 'cancelled' WHERE id = $1", [sessionId]);

    debugLog(`[chunked-upload] Session cancelled: ${sessionId}`);

    return res.json({ success: true });
  } catch (error) {
    console.error(`[chunked-upload] Error cancelling upload:`, error);
    return res.status(500).json({ error: "Failed to cancel upload" });
  }
});

// Get upload session status
app.get("/api/upload/status/:sessionId", authRequired, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const { rows: sessRows } = await pool.query(
      "SELECT id, filename, file_size, total_chunks, chunks_uploaded, status, expires_at, error_message FROM public.upload_sessions WHERE id = $1",
      [sessionId]
    );

    const session = sessRows[0];
    if (!session) {
      return res.status(404).json({ error: "Upload session not found" });
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    return res.json({ session });
  } catch (error) {
    console.error(`[chunked-upload] Error getting status:`, error);
    return res.status(500).json({ error: "Failed to get upload status" });
  }
});

// Cleanup expired sessions (can be called periodically via cron or manually)
app.post("/api/admin/cleanup-expired-sessions", authRequired, requireAdmin, async (_req, res) => {
  try {
    await pool.query("SELECT public.cleanup_expired_upload_sessions()");
    return res.json({ success: true, message: "Expired sessions cleaned up" });
  } catch (error) {
    console.error(`[chunked-upload] Error cleaning up expired sessions:`, error);
    return res.status(500).json({ error: "Failed to cleanup expired sessions" });
  }
});

app.post("/api/admin/cache/clear", authRequired, requireAdmin, (req, res) => {
  cache.config.data = null;
  cache.config.expiresAt = 0;
  cache.roles.clear();
  debugLog(`[cache] Cache cleared by admin ${req.user.id}`);
  return res.json({ success: true, message: "Cache cleared" });
});

// ==================== SINGLE-SHOT UPLOAD (Legacy/Small Files) ====================

app.post("/api/upload", authRequired, (req, res, next) => {
  debugLog(`[upload] === UPLOAD REQUEST RECEIVED ===`);
  debugLog(`[upload] Content-Type:`, req.headers['content-type']);
  debugLog(`[upload] Content-Length:`, req.headers['content-length']);
  debugLog(`[upload] User-Agent:`, req.headers['user-agent']);
  debugLog(`[upload] User ID:`, req.user?.id);

  upload.single("file")(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req, res) => {
  // Enhanced debug logging
  debugLog(`[upload] === NEW UPLOAD REQUEST ===`);
  debugLog(`[upload] Headers:`, Object.fromEntries(Object.entries(req.headers).filter(([key]) => !key.toLowerCase().includes('authorization'))));
  debugLog(`[upload] Content-Type:`, req.headers['content-type']);
  debugLog(`[upload] User:`, req.user);
  debugLog(`[upload] Body type:`, typeof req.body);
  debugLog(`[upload] Body length:`, req.body ? Object.keys(req.body).length : 'null');
  debugLog(`[upload] File present:`, !!req.file);

  if (req.file) {
    debugLog(`[upload] File details:`, {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      destination: req.file.destination,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    });
  }

  if (!req.file) {
    debugLog(`[upload] ERROR: No file in request`);
    debugLog(`[upload] Multer error check - req.multerError:`, req.multerError);
    return res.status(400).json({ error: "File is required" });
  }

  try {
    debugLog(`[upload] Starting upload for user ${req.user.id}, file: ${req.file.originalname}, size: ${req.file.size} bytes`);

    // Clean up videos older than 90 days
    await cleanupOldVideos(req.user.id);

    // Auto-reconcile quota to prevent orphaned storage issues
    const wasReconciled = await reconcileUserQuota(req.user.id);
    if (wasReconciled) {
      debugLog(`[upload] Quota was auto-reconciled before upload`);
    }

    const config = await getStorageConfig();
    const storjEnabled =
      config?.provider === "storj" &&
      config?.storj_access_key &&
      config?.storj_secret_key &&
      config?.storj_bucket;

    // Reserve space atomically to avoid race conditions between concurrent uploads
    const client = await pool.connect();
    let reserved = false;
    try {
      await client.query("BEGIN");

      // Get user roles to determine quota limits
      const roles = await getUserRoles(req.user.id);
      const isAdmin = roles && roles.includes("admin");
      const defaultLimit = (config?.default_storage_limit_mb || 512) * 1024 * 1024;

      // Set quota limits based on user role
      const MIN_QUOTA = isAdmin ? 10737418240 : defaultLimit;

      // Ensure quota row exists and lock it
      const { rows: qRows } = await client.query(
        "SELECT storage_used_bytes, storage_limit_bytes FROM public.user_quotas WHERE user_id = $1 FOR UPDATE",
        [req.user.id]
      );

      if (qRows.length === 0) {
        debugLog(`[upload] Creating quota for user ${req.user.id} (${isAdmin ? 'admin' : 'regular'})`);
        await client.query(
          "INSERT INTO public.user_quotas (user_id, storage_limit_bytes) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
          [req.user.id, MIN_QUOTA]
        );
        const { rows: newQ } = await client.query(
          "SELECT storage_used_bytes, storage_limit_bytes FROM public.user_quotas WHERE user_id = $1 FOR UPDATE",
          [req.user.id]
        );
        qRows.push(...newQ);
      }

      let quota = qRows[0];
      // Update quota limit if user role changed or quota is too low
      if (!quota.storage_limit_bytes || quota.storage_limit_bytes < MIN_QUOTA) {
        debugLog(`[upload] Updating quota limit for user ${req.user.id}: ${quota.storage_limit_bytes} -> ${MIN_QUOTA}`);
        await client.query(
          "UPDATE public.user_quotas SET storage_limit_bytes = $1 WHERE user_id = $2",
          [MIN_QUOTA, req.user.id]
        );
        quota.storage_limit_bytes = MIN_QUOTA;
      }

      debugLog(`[upload] Locked user quota: ${quota.storage_used_bytes}/${quota.storage_limit_bytes} bytes`);
      debugLog(`[upload] File size: ${req.file.size} bytes`);
      debugLog(`[upload] Quota calculation: ${quota.storage_used_bytes} + ${req.file.size} = ${quota.storage_used_bytes + req.file.size}`);
      debugLog(`[upload] Limit check: ${quota.storage_used_bytes + req.file.size} > ${quota.storage_limit_bytes} = ${(quota.storage_used_bytes + req.file.size) > quota.storage_limit_bytes}`);

      // Ensure numeric comparison - parse as BigInt for large numbers
      const currentUsed = parseInt(quota.storage_used_bytes) || 0;
      const newFileSize = parseInt(req.file.size) || 0;
      const storageLimit = parseInt(quota.storage_limit_bytes) || 0;
      const totalAfterUpload = currentUsed + newFileSize;
      // Skip quota check for admin users  
      if (!isAdmin) {
        if (totalAfterUpload > storageLimit) {
          await client.query("ROLLBACK");
          debugLog(`[upload] QUOTA EXCEEDED - Used: ${currentUsed}, File: ${newFileSize}, Total: ${totalAfterUpload}, Limit: ${storageLimit}`);
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            error: "Storage quota exceeded",
            details: DEBUG_ENABLED ? {
              currentUsed,
              fileSize: newFileSize,
              totalAfterUpload,
              storageLimit,
              remainingSpace: storageLimit - currentUsed
            } : undefined
          });
        }
      } else {
        debugLog(`[upload] Admin user - skipping quota check`);
      }

      // Reserve the bytes now
      await client.query(
        "UPDATE public.user_quotas SET storage_used_bytes = storage_used_bytes + $1 WHERE user_id = $2",
        [req.file.size, req.user.id]
      );

      await client.query("COMMIT");
      client.release();
      reserved = true;
      // At this point the space is reserved; proceed with upload. If upload fails, we'll subtract.
    } catch (txErr) {
      try {
        await client.query("ROLLBACK");
      } catch (e) { }
      client.release();
      console.error(`[upload] Transaction error:`, txErr);
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: "Failed to reserve quota" });
    }

    const shareId = randomBytes(6).toString("hex");
    const title = path.basename(req.file.originalname || "Untitled");

    let storagePath = req.file.filename;
    if (storjEnabled) {
      const ext = path.extname(req.file.originalname || "");
      const key = `${req.user.id}/${Date.now()}_${randomBytes(8).toString("hex")}${ext}`;
      try {
        debugLog(`[upload] Uploading to STORJ: ${key}`);
        storagePath = await uploadToStorj(config, req.file, key);
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        debugLog(`[upload] STORJ upload successful: ${storagePath}`);
      } catch (storjError) {
        console.error(`[upload] STORJ upload failed, falling back to local:`, storjError);
        storagePath = req.file.filename;
      }
    }

    debugLog(`[upload] Inserting video record with path: ${storagePath}`);
    
    // Calculate expiration date based on user/global settings
    const expirationDays = await getVideoExpirationDays(req.user.id);
    const expiresAt = expirationDays > 0 ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString() : null;
    
    const { rows } = await pool.query(
      "INSERT INTO public.videos (title, filename, storage_path, share_id, user_id, size, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, share_id",
      [title, req.file.originalname, storagePath, shareId, req.user.id, req.file.size, expiresAt]
    );

    // Storage was reserved earlier in a transaction; only increment upload_count now
    debugLog(`[upload] Incrementing upload_count for user ${req.user.id}`);
    await pool.query(
      "UPDATE public.user_quotas SET upload_count = upload_count + 1 WHERE user_id = $1",
      [req.user.id]
    );

    debugLog(`[upload] Upload successful: ${rows[0].id}`);
    return res.json({
      success: true,
      video: { id: rows[0].id, share_id: rows[0].share_id },
    });
  } catch (error) {
    console.error(`[upload] Error: ${error.message}`, error);
    // If we reserved space earlier but failed later, revert the reservation
    try {
      if (reserved) {
        await pool.query(
          "UPDATE public.user_quotas SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE user_id = $2",
          [req.file.size, req.user.id]
        );
        debugLog(`[upload] Reverted reserved bytes for user ${req.user.id}`);
      }
    } catch (revertErr) {
      console.error(`[upload] Failed to revert reservation:`, revertErr);
    }

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: "Failed to upload video" });
  }
});

app.get("/api/public/videos/:shareId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT v.id, v.title, v.storage_path, v.views, v.visibility, p.default_visibility FROM public.videos v JOIN public.profiles p ON v.user_id = p.id WHERE v.share_id = $1",
      [req.params.shareId]
    );
    const video = rows[0];
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.visibility !== "public") {
      return res.status(404).json({ error: "Video not found" });
    }

    let mediaUrl = video.storage_path;
    const config = await getStorageConfig();
    const storjEnabled = config?.provider === "storj" && config.storj_access_key && config.storj_secret_key;

    // Always use signed URLs for any STORJ video (old or new)
    let storjKey = null;
    if (video.storage_path.startsWith("storj://")) {
      const match = video.storage_path.match(/^storj:\/\/[^\/]+\/(.+)$/);
      if (match) storjKey = match[1];
    } else if (video.storage_path.startsWith("https://link.storjshare.io/")) {
      storjKey = getStorjKeyFromUrl(video.storage_path, config.storj_bucket);
    }
    if (storjKey && storjEnabled) {
      try {
        mediaUrl = await buildStorjSignedUrl(config, storjKey);
      } catch (error) {
        console.warn(`[public-videos] Signed URL generation failed, using original:`, error.message);
      }
    } else if (!video.storage_path.startsWith("http://") && !video.storage_path.startsWith("https://")) {
      mediaUrl = `/media/${video.storage_path}`;
    }

    return res.json({ video: { id: video.id, title: video.title, storage_path: video.storage_path, mediaUrl, views: video.views } });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch video" });
  }
});

app.post("/api/public/videos/:shareId/views", async (req, res) => {
  try {
    await pool.query("UPDATE public.videos SET views = views + 1 WHERE share_id = $1", [req.params.shareId]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update views" });
  }
});

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'API server started');
});
