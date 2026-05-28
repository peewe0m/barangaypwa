import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const uploadsDir = path.resolve("uploads");
const defaultBucket = "barangay-assets";
let warnedMissingServiceRoleKey = false;

function normalizeSupabaseUrl(url) {
  if (!url) return url;

  const trimmed = url.replace(/\/+$/, "");
  const storageMatch = trimmed.match(/^https:\/\/([a-z0-9-]+)\.storage\.supabase\.co(?:\/.*)?$/i);
  if (storageMatch) return `https://${storageMatch[1]}.supabase.co`;

  return trimmed;
}

function supabaseConfig() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    url,
    key: serviceRoleKey,
    hasServiceRoleKey: Boolean(serviceRoleKey),
  };
}

function client() {
  const { url, key, hasServiceRoleKey } = supabaseConfig();
  if (!url || !key) return null;
  if (!hasServiceRoleKey) return null;
  return createClient(url, key);
}

function warnMissingServiceRoleKey() {
  if (warnedMissingServiceRoleKey) return;
  warnedMissingServiceRoleKey = true;
  console.warn(
    "Supabase storage is configured without SUPABASE_SERVICE_ROLE_KEY. " +
    "Private uploads will use local storage until a service role key is set."
  );
}

function isMissingBucketError(error) {
  return /bucket not found|not found/i.test(error?.message || "");
}

async function createBucketIfAllowed(supabase, bucket) {
  const { hasServiceRoleKey } = supabaseConfig();
  if (!hasServiceRoleKey) {
    return { created: false, reason: "SUPABASE_SERVICE_ROLE_KEY is not configured" };
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 15 * 1024 * 1024,
  });

  if (!error) return { created: true };
  if (/already exists|duplicate/i.test(error.message || "")) return { created: true };

  return { created: false, reason: error.message };
}

async function uploadToSupabase(supabase, bucket, key, buffer, contentType) {
  return supabase.storage.from(bucket).upload(key, buffer, {
    contentType,
    upsert: true
  });
}

export async function uploadLargeObject(key, buffer, contentType) {
  // Upload target:
  // - local provider: stored under ./uploads and served only via authenticated handlers.
  // - supabase provider: stored in the configured bucket, but we never return a public URL.

  const bucket = process.env.SUPABASE_BUCKET || defaultBucket;
  const supabase = client();

  if (supabase) {
    let { error } = await uploadToSupabase(supabase, bucket, key, buffer, contentType);

    if (isMissingBucketError(error)) {
      const bucketResult = await createBucketIfAllowed(supabase, bucket);
      if (bucketResult.created) {
        ({ error } = await uploadToSupabase(supabase, bucket, key, buffer, contentType));
      } else {
        console.warn(`Supabase bucket "${bucket}" is missing and could not be created: ${bucketResult.reason}`);
      }
    }

    if (!error) {
      // Do NOT return public URLs. Keep bucket/private access behind authenticated download routes.
      return { url: null, provider: "supabase", key };
    }
    console.warn(`Supabase upload failed for ${key}: ${error.message}; falling back to local private storage.`);
  } else if (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) {
    warnMissingServiceRoleKey();
  }

  const localPath = path.join(uploadsDir, key);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, buffer);

  // Do not return a direct URL. Clients must fetch through authenticated routes.
  return { url: null, provider: "local", key };
}

// Server-side helpers for private storage access.
export async function readPrivateLargeObject(storage, url) {
  // local provider
  if (storage?.provider === "local" && storage.key) {
    const localPath = path.resolve("uploads", storage.key);
    return fs.readFile(localPath);
  }

  // supabase provider (no public URLs)
  if (storage?.provider === "supabase" && storage.key) {
    const supabase = client();
    if (!supabase) throw new Error("Supabase not configured");

    const bucket = process.env.SUPABASE_BUCKET || defaultBucket;
    const { data, error } = await supabase.storage.from(bucket).download(storage.key);
    if (error) throw error;

    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }

  // legacy support for direct /uploads URLs (should not be used by clients)
  if (typeof url === "string" && url.startsWith("/uploads/")) {
    const localPath = path.resolve(String(url).replace(/^\/uploads\//, "uploads/"));
    return fs.readFile(localPath);
  }

  return null;
}

export async function getPrivateObjectUrl() {
  // Intentionally not returning a URL; authenticated proxy route must stream bytes.
  return null;
}
