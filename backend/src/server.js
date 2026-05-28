import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import mongodb from "mongodb";
const { ObjectId } = mongodb;
import { connectDatabase, closeDatabase } from "./db.js";
import { clearAuthCookies, createAccessToken, createRefreshToken, hashPassword, isAdminUser, requireAdmin, requireUser, setAuthCookies, verifyPassword } from "./auth.js";
import { SYSTEM_CONFIG } from "./config/system.js";
import { generateBarangayId, generateCertificate } from "./pdfGenerator.js";
import { uploadLargeObject, readPrivateLargeObject } from "./storage.js";
import { createPrivateFilesRouter } from "./privateFiles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const api = express.Router();
const realtimeClients = new Set();
const DEFAULT_ADMIN_PASSWORD = "admin123";
const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_TEMPLATE_UPLOAD_SIZE = 15 * 1024 * 1024;

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
// NOTE: uploads are intentionally private. File access must go through authenticated/proxy routes.
// Public static uploads are disabled to ensure stored files remain private.
// app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));


app.use(cors({
  origin: (process.env.FRONTEND_URL || "https://barangaypwa-ytdq.vercel.app").split(",").map(o => o.trim().replace(/\/$/, "")),
  credentials: true,
  exposedHeaders: ["x-csrf-token"]
}));

app.use((req, res, next) => {
  const csrfToken = req.cookies?.csrf_token;
  if (csrfToken) {
    res.setHeader("x-csrf-token", csrfToken);
  }
  req.db = app.locals.db;
  next();
});

function requireCsrf(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  if (req.path === "/auth/login" || req.path.startsWith("/portal/")) return next();
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.get("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn(`[CSRF] Blocked ${req.method} ${req.path}. Reason:`, {
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      match: cookieToken === headerToken
    });
    return bad(res, 403, "Security check failed. Please refresh the page and try again.");
  }
  next();
}

api.use(requireCsrf);

function publishDataChange(payload) {
  const event = `event: data-change\ndata: ${JSON.stringify({
    ...payload,
    at: new Date().toISOString()
  })}\n\n`;

  for (const client of realtimeClients) {
    client.write(event);
  }
}

api.get("/events", requireUser, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  realtimeClients.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(ping);
    realtimeClients.delete(res);
  });
});

api.use((req, res, next) => {
  res.on("finish", () => {
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    const isSuccessful = res.statusCode >= 200 && res.statusCode < 400;
    const isAuthRoute = req.path.startsWith("/auth/");
    const isDownloadRoute = req.path.includes("/download");

    if (isMutation && isSuccessful && !isAuthRoute && !isDownloadRoute) {
      publishDataChange({ method: req.method, path: req.path });
    }

    if (isMutation && isSuccessful) auditLog(req, auditActionFor(req));
  });

  next();
});

const now = () => new Date();
const token = () => crypto.randomBytes(12).toString("base64url");
const money = (n) => Number(n || 0);
const serialize = (doc) => {
  if (!doc) return doc;
  const copy = { ...doc };
  delete copy._id;
  for (const [key, value] of Object.entries(copy)) {
    if (value instanceof Date) copy[key] = value.toISOString();
    if (value instanceof ObjectId) copy[key] = String(value);
  }
  return copy;
};
const auditActionFor = (req) => {
  if (req.path.includes("/download")) return "download";
  if (req.method === "DELETE") return "delete";
  if (req.path.includes("/approve")) return "approve";
  if (req.path.includes("/reject")) return "reject";
  if (req.path.includes("/password")) return "change_password";
  if (req.path.includes("/process")) return "process";
  if (req.method === "POST") return "create";
  if (["PUT", "PATCH"].includes(req.method)) return "update";
  return req.method.toLowerCase();
};
const auditCollectionFor = (pathName) => pathName.split("/").filter(Boolean)[0] || "system";
const auditLog = (req, action, details = {}) =>
  req.db?.collection("audit_logs").insertOne({
    id: token(),
    action,
    collection: details.collection || auditCollectionFor(req.path),
    record_id: details.record_id || req.params?.id || req.params?.residentId || req.params?.requestId || req.params?.userId || null,
    method: req.method,
    path: req.path,
    user_id: req.user?._id || null,
    user_email: req.user?.email || "",
    ip: req.ip,
    user_agent: req.get("user-agent") || "",
    details,
    created_at: now()
  }).catch((error) => console.warn(`Audit log failed: ${error.message}`));
const notDeleted = (query = {}) => ({ ...query, deleted_at: { $exists: false } });
const softDeleteById = async (req, collection, id, idField = "id") => {
  const result = await req.db.collection(collection).updateOne(
    notDeleted({ [idField]: id }),
    { $set: { deleted_at: now(), deleted_by: req.user?._id || null, delete_reason: req.body?.delete_reason || "" } }
  );
  return result.modifiedCount;
};
const toFrontendConfig = (config) => ({
  systemName: config.system_name,
  version: config.version,
  barangayInfo: {
    name: config.barangay_info?.name || "",
    municipality: config.barangay_info?.municipality || "",
    province: config.barangay_info?.province || "",
    region: config.barangay_info?.region || "",
    contactNumber: config.barangay_info?.contact_number || "",
    email: config.barangay_info?.email || "",
    address: config.barangay_info?.address || "",
    captainName: config.barangay_info?.captain_name || "",
    secretaryName: config.barangay_info?.secretary_name || "",
    treasurerName: config.barangay_info?.treasurer_name || ""
  },
  documentFees: config.document_fees,
  roles: config.roles,
  documentTypes: (config.document_types || []).map((value) => ({
    value,
    label: String(value).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
  })),
  civilStatus: config.civil_status,
  gender: config.gender,
  religions: config.religions
});
const mergeSystemConfig = (override = {}) => ({
  ...SYSTEM_CONFIG,
  ...override,
  barangay_info: { ...SYSTEM_CONFIG.barangay_info, ...(override.barangay_info || {}) },
  document_fees: { ...SYSTEM_CONFIG.document_fees, ...(override.document_fees || {}) }
});
async function getSystemConfig(db) {
  const stored = await db.collection("system_settings").findOne({ key: "system" }, { projection: { _id: 0 } });
  return mergeSystemConfig(stored?.config || {});
}
const ageFromBirthdate = (birthdate) => {
  const date = new Date(String(birthdate || "").split("T")[0]);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDelta = today.getMonth() - date.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) age -= 1;
  return age;
};
const docNumber = (type) => `${String(type || "DOC").slice(0, 3).toUpperCase()}-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
const caseNumber = () => `BL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomInt(1, 999).toString().padStart(3, "0")}`;
const permitNumber = () => `BP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}${crypto.randomInt(0, 999).toString().padStart(3, "0")}`;
const receiptNumber = () => `OR-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
const bad = (res, status, detail) => res.status(status).json({ detail });
const byCreatedDesc = { created_at: -1 };
const imageTemplateTypes = new Set(["image/png", "image/jpeg", "image/jpg"]);
const imageUploadTypes = new Set(["image/png", "image/jpeg", "image/jpg"]);
const documentTemplateTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const fileSignatureMatches = (file) => {
  const b = file?.buffer;
  if (!b || b.length < 4) return false;
  if (file.mimetype === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (["image/jpeg", "image/jpg"].includes(file.mimetype)) return b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
  if (file.mimetype === "application/pdf") return b.subarray(0, 4).toString() === "%PDF";
  return true;
};
const validateUploadedFile = (file, { allowedTypes, maxSize, label }) => {
  if (!file) return `${label} is required`;
  if (!allowedTypes.has(file.mimetype)) return `Invalid ${label.toLowerCase()} type`;
  if (file.size > maxSize) return `${label} is too large`;
  if (!fileSignatureMatches(file)) return `${label} content does not match its file type`;
  return null;
};
const requireFields = (body, fields) => {
  const missing = fields.filter((field) => String(body?.[field] ?? "").trim() === "");
  return missing.length ? `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required` : null;
};
const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const toCsv = (rows, fields) => [
  fields.join(","),
  ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(","))
].join("\n");
const moduleDefinitions = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "residents", label: "Residents", path: "/residents" },
  { key: "households", label: "Households", path: "/households" },
  { key: "documents", label: "Documents", path: "/documents" },
  { key: "portal_requests", label: "Online Requests", path: "/portal-requests" },
  { key: "business", label: "Business", path: "/business" },
  { key: "blotter", label: "Blotter", path: "/blotter" },
  { key: "health", label: "Health", path: "/health" },
  { key: "medicine_inventory", label: "Medicine Inventory", path: "/medicine-inventory" },
  { key: "welfare", label: "Social Welfare", path: "/welfare" },
  { key: "barangay_id", label: "Barangay ID", path: "/barangay-id" },
  { key: "appointments", label: "Appointments", path: "/appointments" },
  { key: "payments", label: "Payments", path: "/payments" },
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "settings", label: "Settings", path: "/settings" }
];
const defaultModulePermissions = Object.fromEntries(moduleDefinitions.map((module) => [module.key, true]));
const staffModulePermissions = Object.fromEntries(moduleDefinitions.map((module) => [module.key, module.key !== "settings"]));
const actionDefinitions = ["view", "create", "update", "delete", "approve", "download", "export"];
const defaultActionPermissions = Object.fromEntries(
  moduleDefinitions.map((module) => [module.key, Object.fromEntries(actionDefinitions.map((action) => [action, true]))])
);
const staffActionPermissions = Object.fromEntries(
  moduleDefinitions.map((module) => [
    module.key,
    Object.fromEntries(actionDefinitions.map((action) => [action, action !== "delete"]))
  ])
);
const sanitizeModulePermissions = (permissions = staffModulePermissions) =>
  Object.fromEntries(moduleDefinitions.map((module) => [module.key, Boolean(permissions?.[module.key])]));
const sanitizeActionPermissions = (permissions = staffActionPermissions) =>
  Object.fromEntries(moduleDefinitions.map((module) => [
    module.key,
    Object.fromEntries(actionDefinitions.map((action) => [action, Boolean(permissions?.[module.key]?.[action] ?? staffActionPermissions[module.key]?.[action])]))
  ]));
const publicUser = (user) => ({
  id: String(user._id),
  email: user.email,
  full_name: user.full_name,
  role: user.role,
  disabled: Boolean(user.disabled),
  module_permissions: isAdminUser(user) ? defaultModulePermissions : sanitizeModulePermissions(user.module_permissions),
  action_permissions: isAdminUser(user) ? defaultActionPermissions : sanitizeActionPermissions(user.action_permissions),
  created_at: user.created_at,
  updated_at: user.updated_at
});
const requireModule = (moduleKey) => (req, res, next) => {
  if (isAdminUser(req.user) || req.user.module_permissions?.[moduleKey]) return next();
  return bad(res, 403, `Access to ${moduleKey.replaceAll("_", " ")} is disabled for this account`);
};
const requireAction = (moduleKey, action) => (req, res, next) => {
  if (isAdminUser(req.user) || req.user.action_permissions?.[moduleKey]?.[action]) return next();
  return bad(res, 403, `${action} permission is required for ${moduleKey.replaceAll("_", " ")}`);
};
const requireDeleteAdmin = [requireUser, requireAdmin];
const pathModuleRules = [
  ["/residents", "residents"],
  ["/households", "households"],
  ["/document-requests", "documents"],
  ["/portal-requests", "portal_requests"],
  ["/businesses", "business"],
  ["/blotters", "blotter"],
  ["/health-records", "health"],
  ["/medicine-inventory", "medicine_inventory"],
  ["/welfare-records", "welfare"],
  ["/barangay-ids", "barangay_id"],
  ["/appointments", "appointments"],
  ["/payments", "payments"],
  ["/dashboard", "dashboard"],
  ["/reports", "reports"],
  ["/exports", "reports"],
  ["/audit-logs", "settings"],
  ["/document-templates", "settings"],
  ["/seed", "settings"]
];
const householdResidentFields = (body) => ({
  household_id: body.household_id || null,
  household_name: body.household_name || "",
  family_group: body.family_group || "",
  family_role: body.family_role || "",
  relationship_to_head: body.relationship_to_head || "",
  emergency_contact_name: body.emergency_contact_name || "",
  emergency_contact_relationship: body.emergency_contact_relationship || "",
  emergency_contact_number: body.emergency_contact_number || "",
  emergency_contact_address: body.emergency_contact_address || "",
  emergency_contact: body.emergency_contact || ""
});
const householdFields = (body) => ({
  household_head_id: body.household_head_id,
  address: body.address || "",
  house_number: body.house_number || "",
  household_record_number: body.household_record_number || "",
  household_type: body.household_type || "",
  family_tree_group: body.family_tree_group || "",
  address_mapping: {
    purok: body.address_mapping?.purok || body.purok || "",
    zone: body.address_mapping?.zone || body.zone || "",
    street: body.address_mapping?.street || body.street || "",
    landmark: body.address_mapping?.landmark || body.landmark || "",
    latitude: body.address_mapping?.latitude || body.latitude || "",
    longitude: body.address_mapping?.longitude || body.longitude || ""
  },
  notes: body.notes || ""
});

async function getDocumentTemplateBuffer(db, documentType) {
  const template = await db.collection("document_templates").findOne({
    document_type: documentType,
    active: true,
    content_type: { $in: [...imageTemplateTypes] }
  });

  if (!template?.storage?.key) return null;

  if (template.storage.provider === "local") {
    const localPath = path.resolve("uploads", template.storage.key);
    return fs.readFile(localPath);
  }

  // Use authenticated proxy for supabase files; never fetch public URLs.
  const buffer = await readPrivateLargeObject(template.storage);
  if (!buffer) return null;
  return buffer;
}

async function getStoredFileBuffer(storage, url) {
  if (storage?.provider === "local" && storage.key) {
    const localPath = path.resolve("uploads", storage.key);
    return fs.readFile(localPath);
  }

  if (!url && storage?.url) url = storage.url;
  if (!url) return null;

  if (String(url).startsWith("/uploads/")) {
    const localPath = path.resolve(String(url).replace(/^\/uploads\//, "uploads/"));
    return fs.readFile(localPath);
  }

  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function getApplicantPhotoBuffer(requestData) {
  const attachment = requestData.additional_details?.applicant_photo_attachment || requestData.photo_attachment;
  const url = requestData.additional_details?.applicant_photo_url || requestData.photo_url;
  try {
    return await getStoredFileBuffer(attachment?.storage || attachment, url);
  } catch {
    return null;
  }
}

const documentFee = (documentType) => money(SYSTEM_CONFIG.document_fees?.[documentType]);
const documentLabel = (documentType) => String(documentType || "Document").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeForMatch = (value) => String(value || "").trim().replace(/\s+/g, " ");
const lifecycleEvent = (status, userId, note = "") => ({ status, at: now(), by: userId || null, note });
function assertProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === "change-this-long-random-secret") {
    throw new Error("Set a strong JWT_SECRET in production");
  }
  const origins = (process.env.FRONTEND_URL || "").split(",").map(o => o.trim().replace(/\/$/, "")).filter(Boolean);
  if (origins.some((origin) => !origin.startsWith("https://"))) {
    throw new Error("FRONTEND_URL must use HTTPS in production");
  }
}

async function getResidentPhotoForBarangayId(db, resident) {
  if (resident.photo_url || resident.photo_storage) {
    try {
      const buffer = await getStoredFileBuffer(resident.photo_storage, resident.photo_url || resident.photo_storage?.url);
      if (buffer) return { buffer, source: "resident_profile", url: resident.photo_url || resident.photo_storage?.url || "" };
    } catch {
      // Continue to historical applicant photos.
    }
  }

  const documentPhoto = await db.collection("document_requests").findOne(
    {
      resident_id: resident.id,
      document_type: "barangay_clearance",
      $or: [
        { "additional_details.applicant_photo_url": { $exists: true, $ne: null } },
        { "additional_details.applicant_photo_attachment": { $exists: true, $ne: null } },
        { photo_url: { $exists: true, $ne: null } },
        { photo_attachment: { $exists: true, $ne: null } }
      ]
    },
    { sort: { issue_date: -1, created_at: -1 } }
  );

  if (documentPhoto) {
    const buffer = await getApplicantPhotoBuffer(documentPhoto);
    if (buffer) {
      return {
        buffer,
        source: "document_request_applicant_photo",
        document_request_id: documentPhoto.id,
        url: documentPhoto.additional_details?.applicant_photo_url || documentPhoto.photo_url || ""
      };
    }
  }

  const exactName = new RegExp(`^${escapeRegex(resident.full_name)}$`, "i");
  const portalPhoto = await db.collection("portal_requests").findOne(
    {
      document_type: "barangay_clearance",
      photo_url: { $exists: true, $ne: null },
      $or: [
        { resident_id: resident.id },
        { resident_id_from_portal: resident.id },
        { full_name: exactName }
      ]
    },
    { sort: { processed_at: -1, created_at: -1 } }
  );

  if (portalPhoto) {
    const buffer = await getApplicantPhotoBuffer(portalPhoto);
    if (buffer) {
      return {
        buffer,
        source: "portal_clearance_applicant_photo",
        portal_request_id: portalPhoto.id,
        tracking_number: portalPhoto.tracking_number,
        url: portalPhoto.photo_url || ""
      };
    }
  }

  return { buffer: null, source: "none" };
}

async function recordDocumentPayment(db, {
  resident,
  document,
  downloadedBy = null,
  sourceType = "document_request",
  paymentFor = "document",
  documentType = document?.document_type,
  documentNumber = document?.document_number,
  trackingNumber = document?.additional_details?.portal_tracking_number || document?.tracking_number || "",
  purpose = document?.purpose || "",
}) {
  const sourceId = document?.id;
  if (!sourceId) return null;

  const nowDate = now();
  const payment = {
    id: token(),
    receipt_number: receiptNumber(),
    resident_id: resident?.id || document?.resident_id || "",
    resident_name: resident?.full_name || document?.resident_name || "",
    amount: documentFee(documentType),
    payment_for: paymentFor,
    payment_method: "document_release",
    service_availed: documentLabel(documentType),
    document_type: documentType,
    document_number: documentNumber || "",
    document_request_id: sourceType === "document_request" ? sourceId : "",
    source_type: sourceType,
    source_id: sourceId,
    tracking_number: trackingNumber || "",
    portal_tracking_number: trackingNumber || "",
    purpose,
    status: "completed",
    created_at: nowDate,
    downloaded_at: nowDate,
    processed_by: downloadedBy,
  };

  await db.collection("payments").updateOne(
    { source_type: sourceType, source_id: sourceId },
    {
      $setOnInsert: payment,
      $set: { last_downloaded_at: nowDate },
      $inc: { download_count: 1 }
    },
    { upsert: true }
  );

  return db.collection("payments").findOne(
    { source_type: sourceType, source_id: sourceId },
    { projection: { _id: 0, processed_by: 0 } }
  );
}

async function seedAdmin(db) {
  const email = (process.env.ADMIN_EMAIL || "admin@barangay.gov.ph").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === "production" && (!process.env.ADMIN_PASSWORD || password === DEFAULT_ADMIN_PASSWORD || password.length < 12)) {
    throw new Error("Set a strong ADMIN_PASSWORD in production");
  }
  const existing = await db.collection("users").findOne({ email });
  if (!existing) {
    await db.collection("users").insertOne({
      email,
      password_hash: await hashPassword(password),
      full_name: "System Administrator",
      role: "super_admin",
      disabled: false,
      module_permissions: defaultModulePermissions,
      action_permissions: defaultActionPermissions,
      created_at: now()
    });
  } else if (!(await verifyPassword(password, existing.password_hash))) {
    await db.collection("users").updateOne(
      { email },
      { $set: { password_hash: await hashPassword(password), disabled: false, module_permissions: defaultModulePermissions, action_permissions: defaultActionPermissions } }
    );
  }
}

api.post("/auth/register", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase();
    if (!email || !req.body.password || !req.body.full_name) return bad(res, 400, "Email, password, and full_name are required");
    if (await req.db.collection("users").findOne({ email })) return bad(res, 400, "Email already registered");
    const user = {
      email,
      password_hash: await hashPassword(req.body.password),
      full_name: req.body.full_name,
      role: req.body.role === "admin" ? "admin" : "staff",
      disabled: false,
      module_permissions: req.body.role === "admin" ? defaultModulePermissions : sanitizeModulePermissions(req.body.module_permissions),
      action_permissions: req.body.role === "admin" ? defaultActionPermissions : sanitizeActionPermissions(req.body.action_permissions),
      created_at: now()
    };
    const result = await req.db.collection("users").insertOne(user);
    res.json(publicUser({ ...user, _id: result.insertedId }));
  } catch (error) { next(error); }
});

api.post("/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase();
    const attempts = req.db.collection("login_attempts");
    const attempt = await attempts.findOne({ identifier: email });
    if (attempt?.attempts >= 5 && attempt.locked_until && now() < attempt.locked_until) {
      return bad(res, 429, "Too many failed attempts. Try again later.");
    }
    const user = await req.db.collection("users").findOne({ email });
    if (!user || !(await verifyPassword(req.body.password || "", user.password_hash))) {
      const nextAttempts = (attempt?.attempts || 0) + 1;
      await attempts.updateOne(
        { identifier: email },
        { $set: { attempts: nextAttempts, locked_until: nextAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null } },
        { upsert: true }
      );
      return bad(res, 401, "Invalid credentials");
    }
    if (user.disabled) return bad(res, 403, "Account is disabled");
    await attempts.deleteOne({ identifier: email });
    const id = String(user._id);
    setAuthCookies(res, createAccessToken(id, email), createRefreshToken(id));
    res.json(publicUser(user));
  } catch (error) { next(error); }
});

api.get("/auth/me", requireUser, (req, res) => res.json(publicUser(req.user)));
api.post("/auth/logout", (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

api.get("/modules", requireUser, (_req, res) => {
  res.json({ modules: moduleDefinitions });
});

api.get("/users", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const users = await req.db.collection("users").find(notDeleted()).sort({ created_at: -1 }).toArray();
    res.json({ users: users.map(publicUser), total: users.length, modules: moduleDefinitions });
  } catch (error) { next(error); }
});

api.get("/audit-logs", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const action = req.query.action ? String(req.query.action) : null;
    const collection = req.query.collection ? String(req.query.collection) : null;
    const userEmail = req.query.user_email ? String(req.query.user_email) : null;
    const search = req.query.search ? String(req.query.search) : null;

    const query = { deleted_at: { $exists: false } };
    if (from && !Number.isNaN(from.getTime())) query.created_at = { ...(query.created_at || {}), $gte: from };
    if (to && !Number.isNaN(to.getTime())) query.created_at = { ...(query.created_at || {}), $lte: new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) };
    if (action) query.action = action;
    if (collection) query.collection = collection;
    if (userEmail) query.user_email = userEmail;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ path: rx }, { method: rx }, { action: rx }, { user_email: rx }];
    }

    const sortBy = req.query.sort_by === "path" ? { path: req.query.sort_dir === "asc" ? 1 : -1 } : { created_at: req.query.sort_dir === "asc" ? 1 : -1 };

    const cursor = req.db.collection("audit_logs").find(query, { projection: { _id: 0 } }).sort(sortBy).limit(limit);
    const logs = await cursor.toArray();
    res.json({ logs: logs.map(serialize), total: logs.length });
  } catch (error) { next(error); }
});

api.get("/audit-logs/export", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const action = req.query.action ? String(req.query.action) : null;
    const collection = req.query.collection ? String(req.query.collection) : null;
    const userEmail = req.query.user_email ? String(req.query.user_email) : null;
    const search = req.query.search ? String(req.query.search) : null;
    const limit = Math.min(Number(req.query.limit || 5000), 20000);

    const query = { deleted_at: { $exists: false } };
    if (from && !Number.isNaN(from.getTime())) query.created_at = { ...(query.created_at || {}), $gte: from };
    if (to && !Number.isNaN(to.getTime())) query.created_at = { ...(query.created_at || {}), $lte: new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) };
    if (action) query.action = action;
    if (collection) query.collection = collection;
    if (userEmail) query.user_email = userEmail;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ path: rx }, { method: rx }, { action: rx }, { user_email: rx }];
    }

    const logs = await req.db.collection("audit_logs").find(query, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(limit).toArray();

    const fields = ["id", "created_at", "action", "method", "path", "collection", "record_id", "user_email", "ip", "user_agent", "details"];
    const rows = logs.map((l) => {
      const d = { ...l };
      if (d.details && typeof d.details === "object") d.details = JSON.stringify(d.details);
      return d;
    });

    const csvEscape = (value) => `\"${String(value ?? "").replaceAll('"', '""')}\"`;
    const toCsv = (rows, fields) => [
      fields.join(","),
      ...rows.map((row) => fields.map((f) => csvEscape(row[f])).join(","))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=audit_logs_${Date.now()}.csv`);
    res.send(toCsv(rows.map(serialize), fields));
  } catch (error) { next(error); }
});


api.post("/users", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const fullName = String(req.body.full_name || "").trim();
    const role = req.body.role === "admin" ? "admin" : "staff";
    if (!email || !password || !fullName) return bad(res, 400, "Full name, email, and password are required");
    if (password.length < 8) return bad(res, 400, "Password must be at least 8 characters");
    if (await req.db.collection("users").findOne({ email })) return bad(res, 400, "Email already registered");

    const user = {
      email,
      password_hash: await hashPassword(password),
      full_name: fullName,
      role,
      disabled: Boolean(req.body.disabled),
      module_permissions: role === "admin" ? defaultModulePermissions : sanitizeModulePermissions(req.body.module_permissions),
      action_permissions: role === "admin" ? defaultActionPermissions : sanitizeActionPermissions(req.body.action_permissions),
      created_at: now(),
      created_by: req.user._id
    };
    const result = await req.db.collection("users").insertOne(user);
    res.json(publicUser({ ...user, _id: result.insertedId }));
  } catch (error) { next(error); }
});

api.put("/users/:userId", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const target = await req.db.collection("users").findOne({ _id: new ObjectId(req.params.userId) });
    if (!target) return bad(res, 404, "User not found");
    if (target.role === "super_admin" && String(target._id) !== req.user._id) return bad(res, 403, "Super administrator account cannot be changed");

    const role = target.role === "super_admin" ? "super_admin" : (req.body.role === "admin" ? "admin" : "staff");
    const update = {
      full_name: String(req.body.full_name || target.full_name || "").trim(),
      role,
      disabled: target.role === "super_admin" ? false : Boolean(req.body.disabled),
      module_permissions: isAdminUser({ role }) ? defaultModulePermissions : sanitizeModulePermissions(req.body.module_permissions),
      action_permissions: isAdminUser({ role }) ? defaultActionPermissions : sanitizeActionPermissions(req.body.action_permissions),
      updated_at: now(),
      updated_by: req.user._id
    };
    await req.db.collection("users").updateOne({ _id: target._id }, { $set: update });
    const updated = await req.db.collection("users").findOne({ _id: target._id });
    res.json(publicUser(updated));
  } catch (error) { next(error); }
});

api.put("/users/:userId/password", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const password = String(req.body.password || "");
    if (password.length < 8) return bad(res, 400, "Password must be at least 8 characters");
    const result = await req.db.collection("users").updateOne(
      { _id: new ObjectId(req.params.userId) },
      { $set: { password_hash: await hashPassword(password), password_changed_at: now(), updated_by: req.user._id } }
    );
    if (!result.matchedCount) return bad(res, 404, "User not found");
    res.json({ message: "Password updated" });
  } catch (error) { next(error); }
});

api.delete("/users/:userId", requireUser, requireAdmin, async (req, res, next) => {
  try {
    if (req.params.userId === req.user._id) return bad(res, 400, "You cannot delete your own account");
    const result = await req.db.collection("users").updateOne(
      { _id: new ObjectId(req.params.userId), role: { $ne: "super_admin" }, deleted_at: { $exists: false } },
      { $set: { deleted_at: now(), deleted_by: req.user._id, disabled: true } }
    );
    if (!result.modifiedCount) return bad(res, 404, "User not found or protected");
    res.json({ message: "User deleted" });
  } catch (error) { next(error); }
});

api.use((req, res, next) => {
  if (req.path.startsWith("/portal/") || req.path === "/config/system") return next();
  requireUser(req, res, () => {
    const rule = pathModuleRules.find(([prefix]) => req.path.startsWith(prefix));
    if (!rule) return next();
    return requireModule(rule[1])(req, res, next);
  });
});

api.post("/residents", requireUser, async (req, res, next) => {
  try {
    const fieldError = requireFields(req.body, ["full_name", "address", "birthdate", "gender", "civil_status"]);
    if (fieldError) return bad(res, 400, fieldError);
    const fullName = normalizeForMatch(req.body.full_name);
    const birthdate = String(req.body.birthdate || "").split("T")[0];
    const duplicate = await req.db.collection("residents").findOne(notDeleted({
      full_name: { $regex: `^${escapeRegex(fullName)}$`, $options: "i" },
      birthdate: { $regex: `^${escapeRegex(birthdate)}` }
    }));
    if (duplicate) return bad(res, 409, "A resident with the same name and birthdate already exists");
    const resident = {
      ...req.body,
      full_name: fullName,
      ...householdResidentFields(req.body),
      id: token(),
      age: ageFromBirthdate(req.body.birthdate),
      photo_url: null,
      created_at: now(),
      created_by: req.user._id
    };
    if (resident.household_id) {
      const household = await req.db.collection("households").findOne(notDeleted({ id: resident.household_id }));
      if (!household) return bad(res, 404, "Household not found");
      resident.household_name = household.household_record_number || household.household_head_name || "";
    }
    await req.db.collection("residents").insertOne(resident);
    delete resident.created_by;
    res.json(serialize(resident));
  } catch (error) { next(error); }
});

api.get("/residents", requireUser, async (req, res, next) => {
  try {
    const skip = Number(req.query.skip || 0);
    const limit = Number(req.query.limit || 100);
    const query = notDeleted(req.query.search ? { $or: [{ full_name: { $regex: req.query.search, $options: "i" } }, { address: { $regex: req.query.search, $options: "i" } }] } : {});
    const total = await req.db.collection("residents").countDocuments(query);
    const residents = await req.db.collection("residents").find(query, { projection: { _id: 0, created_by: 0 } }).skip(skip).limit(limit).toArray();
    res.json({ total, residents: residents.map(serialize) });
  } catch (error) { next(error); }
});

api.get("/residents/:residentId", requireUser, async (req, res, next) => {
  try {
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.params.residentId }), { projection: { _id: 0, created_by: 0 } });
    if (!resident) return bad(res, 404, "Resident not found");
    res.json(serialize(resident));
  } catch (error) { next(error); }
});

api.put("/residents/:residentId", requireUser, async (req, res, next) => {
  try {
    const update = {
      ...req.body,
      ...householdResidentFields(req.body),
      age: ageFromBirthdate(req.body.birthdate),
      updated_at: now()
    };
    delete update.id;
    delete update.created_at;
    delete update.created_by;
    if (update.household_id) {
      const household = await req.db.collection("households").findOne(notDeleted({ id: update.household_id }));
      if (!household) return bad(res, 404, "Household not found");
      update.household_name = household.household_record_number || household.household_head_name || "";
    }
    const result = await req.db.collection("residents").updateOne({ id: req.params.residentId }, { $set: update });
    if (!result.matchedCount) return bad(res, 404, "Resident not found");
    res.json({ message: "Resident updated successfully" });
  } catch (error) { next(error); }
});

api.delete("/residents/:residentId", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await softDeleteById(req, "residents", req.params.residentId);
    if (!result) return bad(res, 404, "Resident not found");
    res.json({ message: "Resident deleted successfully" });
  } catch (error) { next(error); }
});

api.post("/residents/:residentId/photo", requireUser, upload.single("photo"), async (req, res, next) => {
  try {
    if (!req.file?.mimetype?.startsWith("image/")) return bad(res, 400, "File must be an image");
    const fileError = validateUploadedFile(req.file, { allowedTypes: imageUploadTypes, maxSize: MAX_IMAGE_UPLOAD_SIZE, label: "Photo" });
    if (fileError) return bad(res, 400, fileError);
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.params.residentId }));
    if (!resident) return bad(res, 404, "Resident not found");
    const ext = path.extname(req.file.originalname) || ".jpg";
    const saved = await uploadLargeObject(`residents/${req.params.residentId}${ext}`, req.file.buffer, req.file.mimetype);
    await req.db.collection("residents").updateOne({ id: req.params.residentId }, { $set: { photo_url: saved.url, photo_storage: saved } });
    res.json({ photo_url: saved.url });
  } catch (error) { next(error); }
});

api.post("/households", requireUser, async (req, res, next) => {
  try {
    const head = await req.db.collection("residents").findOne(notDeleted({ id: req.body.household_head_id }));
    if (!head) return bad(res, 404, "Household head not found");
    const household = { ...householdFields(req.body), id: token(), household_head_name: head.full_name, created_at: now() };
    await req.db.collection("households").insertOne(household);
    await req.db.collection("residents").updateOne(
      { id: req.body.household_head_id },
      {
        $set: {
          household_id: household.id,
          household_name: household.household_record_number || household.household_head_name,
          family_group: household.family_tree_group || "",
          family_role: "Head",
          relationship_to_head: "Self"
        }
      }
    );
    res.json(serialize(household));
  } catch (error) { next(error); }
});

api.get("/households", requireUser, async (req, res, next) => {
  try {
    const households = await req.db.collection("households").find(notDeleted(), { projection: { _id: 0 } }).toArray();
    for (const h of households) {
      const members = await req.db.collection("residents")
        .find(notDeleted({ household_id: h.id }), { projection: { _id: 0, created_by: 0 } })
        .sort({ family_role: 1, full_name: 1 })
        .toArray();
      h.member_count = members.length;
      h.members = members.map(serialize);
    }
    res.json({ households: households.map(serialize), total: households.length });
  } catch (error) { next(error); }
});

api.put("/households/:householdId", requireUser, async (req, res, next) => {
  try {
    const head = await req.db.collection("residents").findOne(notDeleted({ id: req.body.household_head_id }));
    if (!head) return bad(res, 404, "Household head not found");
    const update = { ...householdFields(req.body), household_head_name: head.full_name, updated_at: now() };
    const result = await req.db.collection("households").updateOne({ id: req.params.householdId }, { $set: update });
    if (!result.matchedCount) return bad(res, 404, "Household not found");
    await req.db.collection("residents").updateMany(
      { household_id: req.params.householdId },
      { $set: { household_name: update.household_record_number || update.household_head_name, family_group: update.family_tree_group || "" } }
    );
    await req.db.collection("residents").updateOne(
      { id: req.body.household_head_id },
      { $set: { household_id: req.params.householdId, family_role: "Head", relationship_to_head: "Self" } }
    );
    res.json({ message: "Household updated" });
  } catch (error) { next(error); }
});

api.get("/households/:householdId/members", requireUser, async (req, res, next) => {
  try {
    const members = await req.db.collection("residents").find({ household_id: req.params.householdId }, { projection: { _id: 0, created_by: 0 } }).toArray();
    res.json({ members: members.map(serialize) });
  } catch (error) { next(error); }
});

api.put("/households/:householdId/add-member/:residentId", requireUser, async (req, res, next) => {
  try {
    const household = await req.db.collection("households").findOne(notDeleted({ id: req.params.householdId }));
    if (!household) return bad(res, 404, "Household not found");
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.params.residentId }));
    if (!resident) return bad(res, 404, "Resident not found");
    await req.db.collection("residents").updateOne(
      { id: req.params.residentId },
      {
        $set: {
          household_id: req.params.householdId,
          household_name: household.household_record_number || household.household_head_name,
          family_group: household.family_tree_group || "",
          family_role: req.body.family_role || resident.family_role || "Member",
          relationship_to_head: req.body.relationship_to_head || resident.relationship_to_head || ""
        }
      }
    );
    res.json({ message: "Member added to household" });
  } catch (error) { next(error); }
});

api.put("/households/:householdId/remove-member/:residentId", requireUser, async (req, res, next) => {
  try {
    const result = await req.db.collection("residents").updateOne(
      { id: req.params.residentId, household_id: req.params.householdId },
      { $set: { household_id: null, household_name: "", family_group: "", family_role: "", relationship_to_head: "" } }
    );
    if (!result.matchedCount) return bad(res, 404, "Household member not found");
    res.json({ message: "Member removed from household" });
  } catch (error) { next(error); }
});

api.delete("/households/:householdId", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    await req.db.collection("residents").updateMany({ household_id: req.params.householdId }, { $set: { household_id: null } });
    const result = await softDeleteById(req, "households", req.params.householdId);
    if (!result) return bad(res, 404, "Household not found");
    res.json({ message: "Household deleted" });
  } catch (error) { next(error); }
});

api.post("/document-requests", requireUser, async (req, res, next) => {
  try {
    const fieldError = requireFields(req.body, ["resident_id", "document_type", "purpose"]);
    if (fieldError) return bad(res, 400, fieldError);
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.body.resident_id }));
    if (!resident) return bad(res, 404, "Resident not found");
    const requestDoc = {
      id: token(),
      resident_id: req.body.resident_id,
      document_type: req.body.document_type,
      purpose: req.body.purpose,
      status: "pending",
      status_history: [lifecycleEvent("pending", req.user._id, "Document request created")],
      document_number: docNumber(req.body.document_type),
      additional_details: req.body.additional_details || {},
      created_at: now(),
      created_by: req.user._id
    };
    await req.db.collection("document_requests").insertOne(requestDoc);
    delete requestDoc.created_by;
    res.json(serialize(requestDoc));
  } catch (error) { next(error); }
});

api.get("/document-requests", requireUser, async (req, res, next) => {
  try {
    const requests = await req.db.collection("document_requests").find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).sort(byCreatedDesc).limit(200).toArray();
    res.json({ total: requests.length, requests: requests.map(serialize) });
  } catch (error) { next(error); }
});

api.put("/document-requests/:requestId/approve", requireUser, requireAction("documents", "approve"), async (req, res, next) => {
  try {
    const result = await req.db.collection("document_requests").updateOne(
      notDeleted({ id: req.params.requestId }),
      { $set: { status: "approved", issue_date: now(), approved_by: req.user._id }, $push: { status_history: lifecycleEvent("approved", req.user._id) } }
    );
    if (!result.matchedCount) return bad(res, 404, "Document request not found");
    res.json({ message: "Approved" });
  } catch (error) { next(error); }
});

api.put("/document-requests/:requestId/reject", requireUser, requireAction("documents", "approve"), async (req, res, next) => {
  try {
    const result = await req.db.collection("document_requests").updateOne(
      notDeleted({ id: req.params.requestId }),
      { $set: { status: "rejected", rejected_by: req.user._id, rejected_at: now() }, $push: { status_history: lifecycleEvent("rejected", req.user._id, req.body.reason || "") } }
    );
    if (!result.matchedCount) return bad(res, 404, "Document request not found");
    res.json({ message: "Rejected" });
  } catch (error) { next(error); }
});

api.get("/document-requests/:requestId/download", requireUser, requireAction("documents", "download"), async (req, res, next) => {
  try {
    const docReq = await req.db.collection("document_requests").findOne(notDeleted({ id: req.params.requestId }));
    if (!docReq) return bad(res, 404, "Document request not found");
    if (docReq.status !== "approved") return bad(res, 400, "Document not yet approved");
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: docReq.resident_id }), { projection: { _id: 0 } });
    if (!resident) return bad(res, 404, "Resident not found");
    const templateBuffer = await getDocumentTemplateBuffer(req.db, docReq.document_type);
    const applicantPhotoBuffer = await getApplicantPhotoBuffer(docReq);
    const systemConfig = await getSystemConfig(req.db);
    const pdf = await generateCertificate(docReq.document_type, resident, docReq, templateBuffer, applicantPhotoBuffer, systemConfig);
    const saved = await uploadLargeObject(`documents/${docReq.id}.pdf`, pdf, "application/pdf");
    await req.db.collection("document_requests").updateOne(
      { id: docReq.id },
      { $set: { pdf_url: saved.url, pdf_storage: saved, downloaded_at: now() }, $inc: { download_count: 1 }, $push: { status_history: lifecycleEvent("released", req.user._id, "PDF downloaded") } }
    );
    await recordDocumentPayment(req.db, { resident, document: docReq, downloadedBy: req.user._id });
    await auditLog(req, "download_pdf", { collection: "document_requests", record_id: docReq.id, document_type: docReq.document_type, document_number: docReq.document_number });
    publishDataChange({ method: "POST", path: "/payments", source: "document-download" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${docReq.document_type}_${docReq.document_number}.pdf`);
    res.send(pdf);
  } catch (error) { next(error); }
});

api.post("/businesses", requireUser, async (req, res, next) => {
  try {
    const fieldError = requireFields(req.body, ["owner_id", "business_name", "business_type", "address"]);
    if (fieldError) return bad(res, 400, fieldError);
    const owner = await req.db.collection("residents").findOne(notDeleted({ id: req.body.owner_id }));
    if (!owner) return bad(res, 404, "Owner not found");
    const business = {
      ...req.body,
      id: token(),
      owner_name: owner.full_name,
      permit_number: permitNumber(),
      status: "active",
      registered_date: now(),
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      created_at: now(),
      created_by: req.user._id
    };
    await req.db.collection("businesses").insertOne(business);
    delete business.created_by;
    res.json(serialize(business));
  } catch (error) { next(error); }
});

api.get("/businesses", requireUser, async (req, res, next) => {
  try {
    const businesses = await req.db.collection("businesses").find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).sort(byCreatedDesc).limit(200).toArray();
    res.json({ businesses: businesses.map(serialize), total: businesses.length });
  } catch (error) { next(error); }
});

api.put("/businesses/:businessId/renew", requireUser, async (req, res, next) => {
  try {
    const result = await req.db.collection("businesses").updateOne({ id: req.params.businessId }, { $set: { expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), status: "active", renewed_at: now() } });
    if (!result.matchedCount) return bad(res, 404, "Business not found");
    res.json({ message: "Business renewed" });
  } catch (error) { next(error); }
});

api.delete("/businesses/:businessId", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await softDeleteById(req, "businesses", req.params.businessId);
    if (!result) return bad(res, 404, "Business not found");
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
});

api.post("/blotters", requireUser, async (req, res, next) => {
  try {
    const fieldError = requireFields(req.body, ["complainant_id", "respondent_name", "incident_type", "description"]);
    if (fieldError) return bad(res, 400, fieldError);
    const complainant = await req.db.collection("residents").findOne(notDeleted({ id: req.body.complainant_id }));
    if (!complainant) return bad(res, 404, "Complainant not found");
    const blotter = { ...req.body, id: token(), case_number: caseNumber(), complainant_name: complainant.full_name, created_at: now(), created_by: req.user._id };
    await req.db.collection("blotters").insertOne(blotter);
    delete blotter.created_by;
    res.json(serialize(blotter));
  } catch (error) { next(error); }
});

api.get("/blotters", requireUser, async (req, res, next) => {
  try {
    const blotters = await req.db.collection("blotters").find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).sort(byCreatedDesc).limit(200).toArray();
    res.json({ blotters: blotters.map(serialize), total: blotters.length });
  } catch (error) { next(error); }
});

api.put("/blotters/:blotterId", requireUser, async (req, res, next) => {
  try {
    const result = await req.db.collection("blotters").updateOne({ id: req.params.blotterId }, { $set: { ...req.body, updated_at: now() } });
    if (!result.matchedCount) return bad(res, 404, "Blotter not found");
    res.json({ message: "Updated" });
  } catch (error) { next(error); }
});

api.delete("/blotters/:blotterId", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await softDeleteById(req, "blotters", req.params.blotterId);
    if (!result) return bad(res, 404, "Blotter not found");
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
});

function createRecordRoutes(name, collection, enrichResident = true) {
  api.post(`/${name}`, requireUser, async (req, res, next) => {
    try {
      const doc = { ...req.body, id: token(), created_at: now(), created_by: req.user._id };
      if (enrichResident && req.body.resident_id) {
        const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.body.resident_id }));
        if (!resident) return bad(res, 404, "Resident not found");
        doc.resident_name = resident.full_name;
      }
      await req.db.collection(collection).insertOne(doc);
      delete doc.created_by;
      res.json(serialize(doc));
    } catch (error) { next(error); }
  });

  api.get(`/${name}`, requireUser, async (req, res, next) => {
    try {
      const docs = await req.db.collection(collection).find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).sort(byCreatedDesc).limit(200).toArray();
      res.json({ records: docs.map(serialize), total: docs.length });
    } catch (error) { next(error); }
  });

  api.delete(`/${name}/:id`, ...requireDeleteAdmin, async (req, res, next) => {
    try {
      const result = await softDeleteById(req, collection, req.params.id);
      if (!result) return bad(res, 404, "Record not found");
      res.json({ message: "Deleted" });
    } catch (error) { next(error); }
  });
}

api.post("/health-records", requireUser, async (req, res, next) => {
  let session = null;
  try {
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.body.resident_id }));
    if (!resident) return bad(res, 404, "Resident not found");

    const medicineId = req.body.medicine_id || null;
    const medicineQuantity = Number(req.body.medicine_quantity || 0);
    let medicine = null;

    if (medicineId) {
      if (!Number.isFinite(medicineQuantity) || medicineQuantity <= 0) {
        return bad(res, 400, "Medicine quantity must be greater than zero");
      }

      medicine = await req.db.collection("medicine_inventory").findOne(notDeleted({ id: medicineId }));
      if (!medicine) return bad(res, 404, "Medicine not found");
      if (Number(medicine.quantity || 0) < medicineQuantity) {
        return bad(res, 400, "Insufficient medicine stock");
      }
    }

    const doc = {
      ...req.body,
      id: token(),
      resident_name: resident.full_name,
      medicine_id: medicine?.id || null,
      medicine_name: medicine?.name || "",
      medicine_unit: medicine?.unit || "",
      medicine_quantity: medicine ? medicineQuantity : 0,
      created_at: now(),
      created_by: req.user._id
    };

    const movement = medicine ? {
      id: token(),
      medicine_id: medicine.id,
      health_record_id: doc.id,
      name: medicine.name,
      operation: "subtract",
      quantity: medicineQuantity,
      delta: -medicineQuantity,
      reason: `Health record: ${doc.record_type || "health"}`,
      notes: doc.description || "",
      created_at: now(),
      created_by: req.user._id,
    } : null;

    session = req.db.client?.startSession ? await req.db.client.startSession() : null;

    const saveRecord = async (options = {}) => {
      await req.db.collection("health_records").insertOne(doc, options);
      if (medicine) {
        const stockResult = await req.db.collection("medicine_inventory").updateOne(
          { id: medicine.id, quantity: { $gte: medicineQuantity } },
          { $inc: { quantity: -medicineQuantity }, $set: { updated_at: now() } },
          options
        );
        if (!stockResult.matchedCount) {
          throw Object.assign(new Error("Insufficient medicine stock"), { status: 400 });
        }
        await req.db.collection("medicine_stock_movements").insertOne(movement, options);
      }
    };

    if (session) {
      await session.withTransaction(async () => saveRecord({ session }));
    } else {
      await saveRecord();
    }

    delete doc.created_by;
    if (movement) delete movement.created_by;
    res.json(serialize({ ...doc, medicine_movement: movement }));
  } catch (error) {
    if (error?.status) return bad(res, error.status, error.message);
    next(error);
  }
  finally {
    if (session) await session.endSession();
  }
});

api.get("/health-records", requireUser, async (req, res, next) => {
  try {
    const docs = await req.db.collection("health_records").find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).sort(byCreatedDesc).limit(200).toArray();
    res.json({ records: docs.map(serialize), total: docs.length });
  } catch (error) { next(error); }
});

api.delete("/health-records/:id", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await softDeleteById(req, "health_records", req.params.id);
    if (!result) return bad(res, 404, "Record not found");
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
});

createRecordRoutes("welfare-records", "welfare_records");

// Medicine Inventory

api.get("/medicine-inventory", requireUser, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 200);
    const medicines = await req.db.collection("medicine_inventory").find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).sort({ created_at: -1 }).limit(limit).toArray();
    res.json({ medicines: medicines.map(serialize), total: medicines.length });
  } catch (error) { next(error); }
});

api.post("/medicine-inventory", requireUser, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return bad(res, 400, "Medicine name is required");

    const existing = await req.db.collection("medicine_inventory").findOne({ name: { $regex: `^${name}$`, $options: "i" } });
    if (existing) return bad(res, 409, "Medicine already exists");

    const doc = {
      id: token(),
      name,
      category: req.body.category || "Essential Medicines",
      unit: req.body.unit || "pcs",
      quantity: money(req.body.quantity) ?? 0,
      reorder_threshold: Number(req.body.reorder_threshold ?? 0),
      created_at: now(),
      created_by: req.user._id,
    };

    await req.db.collection("medicine_inventory").insertOne(doc);
    delete doc.created_by;
    res.json(serialize(doc));
  } catch (error) { next(error); }
});

api.put("/medicine-inventory/:id", requireUser, async (req, res, next) => {
  try {
    const update = {
      name: String(req.body.name || "").trim(),
      category: req.body.category || "Essential Medicines",
      unit: req.body.unit || "pcs",
      reorder_threshold: Number(req.body.reorder_threshold ?? 0),
      updated_at: now(),
    };

    if (!update.name) return bad(res, 400, "Medicine name is required");

    const result = await req.db.collection("medicine_inventory").updateOne({ id: req.params.id }, { $set: update });
    if (!result.matchedCount) return bad(res, 404, "Medicine not found");

    res.json({ message: "Medicine updated" });
  } catch (error) { next(error); }
});

api.delete("/medicine-inventory/:id", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await softDeleteById(req, "medicine_inventory", req.params.id);
    if (!result) return bad(res, 404, "Medicine not found");

    // Optionally keep movements history; no hard delete.
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
});

api.post("/medicine-inventory/:id/adjust", requireUser, async (req, res, next) => {
  try {
    const medicine = await req.db.collection("medicine_inventory").findOne(notDeleted({ id: req.params.id }));
    if (!medicine) return bad(res, 404, "Medicine not found");

    const operation = String(req.body.operation || "").toLowerCase();
    if (!['add', 'subtract'].includes(operation)) return bad(res, 400, "Invalid operation. Use 'add' or 'subtract'");

    const qty = Number(req.body.quantity || 0);
    if (!Number.isFinite(qty) || qty < 0) return bad(res, 400, "Quantity must be a non-negative number");

    const delta = operation === 'add' ? qty : -qty;
    const nextQty = Math.max(0, Number(medicine.quantity || 0) + delta);

    const movement = {
      id: token(),
      medicine_id: medicine.id,
      name: medicine.name,
      operation,
      quantity: qty,
      delta,
      reason: req.body.reason || "",
      notes: req.body.notes || "",
      created_at: now(),
      created_by: req.user._id,
    };

    const session = req.db.client?.startSession ? await req.db.client.startSession() : null;

    if (session) {
      await session.withTransaction(async () => {
        await req.db.collection("medicine_inventory").updateOne({ id: medicine.id }, { $set: { quantity: nextQty, updated_at: now() } }, { session });
        await req.db.collection("medicine_stock_movements").insertOne(movement, { session });
      });
      await session.endSession();
    } else {
      await req.db.collection("medicine_inventory").updateOne({ id: medicine.id }, { $set: { quantity: nextQty, updated_at: now() } });
      await req.db.collection("medicine_stock_movements").insertOne(movement);
    }

    delete movement.created_by;
    res.json(serialize({ ...medicine, quantity: nextQty, movement }));
  } catch (error) { next(error); }
});


api.post("/appointments", requireUser, async (req, res, next) => {
  try {
    const fieldError = requireFields(req.body, ["resident_id", "purpose", "appointment_date", "appointment_time"]);
    if (fieldError) return bad(res, 400, fieldError);
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.body.resident_id }));
    if (!resident) return bad(res, 404, "Resident not found");
    const appointment = { ...req.body, id: token(), resident_name: resident.full_name, status: "scheduled", created_at: now(), created_by: req.user._id };
    await req.db.collection("appointments").insertOne(appointment);
    delete appointment.created_by;
    res.json(serialize(appointment));
  } catch (error) { next(error); }
});

api.get("/appointments", requireUser, async (req, res, next) => {
  try {
    const appointments = await req.db.collection("appointments").find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).sort(byCreatedDesc).limit(200).toArray();
    res.json({ appointments: appointments.map(serialize), total: appointments.length });
  } catch (error) { next(error); }
});

api.put("/appointments/:apptId/status", requireUser, async (req, res, next) => {
  try {
    const result = await req.db.collection("appointments").updateOne({ id: req.params.apptId }, { $set: { status: req.query.status || req.body.status, updated_at: now() } });
    if (!result.matchedCount) return bad(res, 404, "Appointment not found");
    res.json({ message: "Updated" });
  } catch (error) { next(error); }
});

api.delete("/appointments/:apptId", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await softDeleteById(req, "appointments", req.params.apptId);
    if (!result) return bad(res, 404, "Appointment not found");
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
});

api.post("/payments", requireUser, async (req, res, next) => {
  try {
    const fieldError = requireFields(req.body, ["amount", "payment_for"]);
    if (fieldError) return bad(res, 400, fieldError);
    const payment = { ...req.body, amount: money(req.body.amount), id: token(), receipt_number: receiptNumber(), status: "completed", created_at: now(), processed_by: req.user._id };
    if (req.body.resident_id) {
      const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.body.resident_id }));
      if (resident) payment.resident_name = resident.full_name;
    }
    await req.db.collection("payments").insertOne(payment);
    delete payment.processed_by;
    res.json(serialize(payment));
  } catch (error) { next(error); }
});

api.get("/payments", requireUser, async (req, res, next) => {
  try {
    const payments = await req.db.collection("payments").find(notDeleted(), { projection: { _id: 0, processed_by: 0 } }).sort(byCreatedDesc).limit(200).toArray();
    res.json({ payments: payments.map(serialize), total: payments.length, total_revenue: payments.reduce((sum, p) => sum + money(p.amount), 0) });
  } catch (error) { next(error); }
});

api.delete("/payments/:paymentId", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await softDeleteById(req, "payments", req.params.paymentId);
    if (!result) return bad(res, 404, "Payment not found");
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
});

api.post("/barangay-ids", requireUser, async (req, res, next) => {
  try {
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: req.body.resident_id }));
    if (!resident) return bad(res, 404, "Resident not found");
    const existing = await req.db.collection("barangay_ids").findOne(notDeleted({ resident_id: req.body.resident_id, status: "active" }));
    if (existing) return res.json(serialize(existing));
    const idDoc = {
      id: token(),
      resident_id: req.body.resident_id,
      resident_name: resident.full_name,
      id_number: `BID-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`,
      issue_date: now(),
      expiry_date: new Date(Date.now() + 1825 * 24 * 60 * 60 * 1000),
      status: "active",
      created_at: now(),
      created_by: req.user._id
    };
    await req.db.collection("barangay_ids").insertOne(idDoc);
    delete idDoc.created_by;
    res.json(serialize(idDoc));
  } catch (error) { next(error); }
});

api.get("/barangay-ids", requireUser, async (req, res, next) => {
  try {
    const ids = await req.db.collection("barangay_ids").find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).sort(byCreatedDesc).limit(200).toArray();
    res.json({ ids: ids.map(serialize), total: ids.length });
  } catch (error) { next(error); }
});

api.get("/barangay-ids/:id/download", requireUser, requireAction("barangay_id", "download"), async (req, res, next) => {
  try {
    const idDoc = await req.db.collection("barangay_ids").findOne(notDeleted({ id: req.params.id }));
    if (!idDoc) return bad(res, 404, "ID not found");
    const resident = await req.db.collection("residents").findOne(notDeleted({ id: idDoc.resident_id }), { projection: { _id: 0 } });
    if (!resident) return bad(res, 404, "Resident not found");
    const photo = await getResidentPhotoForBarangayId(req.db, resident);
    const { buffer: photoBuffer, ...photoSource } = photo;
    const systemConfig = await getSystemConfig(req.db);
    const pdf = await generateBarangayId(resident, idDoc, photoBuffer, systemConfig);
    const saved = await uploadLargeObject(`barangay-ids/${idDoc.id}.pdf`, pdf, "application/pdf");
    await req.db.collection("barangay_ids").updateOne(
      { id: idDoc.id },
      { $set: { pdf_url: saved.url, pdf_storage: saved, downloaded_at: now(), photo_source: photoSource }, $inc: { download_count: 1 } }
    );
    await recordDocumentPayment(req.db, {
      resident,
      document: { ...idDoc, document_type: "barangay_id", document_number: idDoc.id_number, purpose: "Barangay ID" },
      downloadedBy: req.user._id,
      sourceType: "barangay_id",
      paymentFor: "barangay_id",
      documentType: "barangay_id",
      documentNumber: idDoc.id_number,
      purpose: "Barangay ID"
    });
    await auditLog(req, "download_pdf", { collection: "barangay_ids", record_id: idDoc.id, document_type: "barangay_id", document_number: idDoc.id_number });
    publishDataChange({ method: "POST", path: "/payments", source: "barangay-id-download" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=barangay_id_${idDoc.id_number}.pdf`);
    res.send(pdf);
  } catch (error) { next(error); }
});

api.delete("/barangay-ids/:id", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await softDeleteById(req, "barangay_ids", req.params.id);
    if (!result) return bad(res, 404, "ID not found");
    res.json({ message: "Deleted" });
  } catch (error) { next(error); }
});

api.get("/dashboard/stats", requireUser, async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const payments = await req.db.collection("payments").find({ created_at: { $gte: monthStart } }).toArray();
    const recent = await req.db.collection("document_requests").find(notDeleted(), { projection: { _id: 0 } }).sort(byCreatedDesc).limit(10).toArray();
    res.json({
      total_residents: await req.db.collection("residents").countDocuments(notDeleted()),
      total_households: await req.db.collection("households").countDocuments(notDeleted()),
      total_pwd: await req.db.collection("residents").countDocuments(notDeleted({ is_pwd: true })),
      total_senior: await req.db.collection("residents").countDocuments(notDeleted({ is_senior: true })),
      total_solo_parent: await req.db.collection("residents").countDocuments(notDeleted({ is_solo_parent: true })),
      total_voters: await req.db.collection("residents").countDocuments(notDeleted({ is_voter: true })),
      total_businesses: await req.db.collection("businesses").countDocuments(notDeleted()),
      total_blotters: await req.db.collection("blotters").countDocuments(notDeleted()),
      today_transactions: await req.db.collection("document_requests").countDocuments(notDeleted({ created_at: { $gte: today } })),
      pending_requests: await req.db.collection("document_requests").countDocuments(notDeleted({ status: "pending" })),
      approved_requests: await req.db.collection("document_requests").countDocuments(notDeleted({ status: "approved" })),
      monthly_revenue: payments.reduce((sum, p) => sum + money(p.amount), 0),
      recent_activity: recent.map(serialize)
    });
  } catch (error) { next(error); }
});

api.get("/reports/residents", requireUser, requireAction("reports", "export"), async (req, res, next) => {
  try {
    const residents = await req.db.collection("residents").find(notDeleted(), { projection: { _id: 0, created_by: 0 } }).limit(1000).toArray();
    const ageGroups = { "0-17": 0, "18-35": 0, "36-59": 0, "60+": 0 };
    for (const r of residents) {
      const age = Number(r.age || 0);
      if (age < 18) ageGroups["0-17"] += 1;
      else if (age < 36) ageGroups["18-35"] += 1;
      else if (age < 60) ageGroups["36-59"] += 1;
      else ageGroups["60+"] += 1;
    }
    res.json({
      total: residents.length,
      male: residents.filter((r) => r.gender === "Male").length,
      female: residents.filter((r) => r.gender === "Female").length,
      age_groups: ageGroups,
      voters: residents.filter((r) => r.is_voter).length,
      pwd: residents.filter((r) => r.is_pwd).length,
      senior: residents.filter((r) => r.is_senior).length,
      solo_parent: residents.filter((r) => r.is_solo_parent).length
    });
  } catch (error) { next(error); }
});

api.get("/reports/financial", requireUser, requireAction("reports", "export"), async (req, res, next) => {
  try {
    const payments = await req.db.collection("payments").find(notDeleted(), { projection: { _id: 0, processed_by: 0 } }).limit(2000).toArray();
    const byType = {};
    for (const p of payments) byType[p.payment_for || "other"] = (byType[p.payment_for || "other"] || 0) + money(p.amount);
    res.json({ total_revenue: payments.reduce((sum, p) => sum + money(p.amount), 0), transaction_count: payments.length, by_type: byType });
  } catch (error) { next(error); }
});

api.get("/exports/:type", requireUser, requireAction("reports", "export"), async (req, res, next) => {
  try {
    const exports = {
      residents: {
        collection: "residents",
        fields: ["id", "full_name", "birthdate", "age", "gender", "civil_status", "contact_number", "email", "address", "created_at"]
      },
      documents: {
        collection: "document_requests",
        fields: ["id", "resident_id", "document_type", "purpose", "status", "document_number", "created_at", "issue_date"]
      },
      payments: {
        collection: "payments",
        fields: ["id", "receipt_number", "resident_name", "amount", "payment_for", "status", "created_at"]
      }
    };
    const exportConfig = exports[req.params.type];
    if (!exportConfig) return bad(res, 404, "Export type not found");
    const rows = await req.db.collection(exportConfig.collection).find(notDeleted(), { projection: { _id: 0 } }).sort(byCreatedDesc).limit(5000).toArray();
    await auditLog(req, "export_csv", { collection: exportConfig.collection, export_type: req.params.type, row_count: rows.length });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${req.params.type}_export.csv`);
    res.send(toCsv(rows.map(serialize), exportConfig.fields));
  } catch (error) { next(error); }
});

api.post("/portal/document-request", upload.single("photo"), async (req, res, next) => {
  try {
    const fieldError = requireFields(req.body, ["full_name", "contact_number", "address", "document_type", "purpose"]);
    if (fieldError) return bad(res, 400, fieldError);
    if (req.body.document_type === "barangay_clearance" && !req.file) {
      return bad(res, 400, "A live photo is required for Barangay Clearance requests");
    }

    const requestId = token();
    let photoAttachment = null;

    if (req.file) {
      const fileError = validateUploadedFile(req.file, { allowedTypes: imageUploadTypes, maxSize: MAX_IMAGE_UPLOAD_SIZE, label: "Photo" });
      if (fileError) return bad(res, 400, fileError);
      const ext = path.extname(req.file.originalname) || ".jpg";
      const saved = await uploadLargeObject(`portal-requests/${requestId}/photo${ext}`, req.file.buffer, req.file.mimetype);
      photoAttachment = {
        url: saved.url,
        storage: saved,
        filename: req.file.originalname,
        content_type: req.file.mimetype,
        size: req.file.size
      };
    }

    const portalDoc = {
      ...req.body,
      id: requestId,
      tracking_number: `PT-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`,
      status: "submitted",
      source: "online_portal",
      photo_url: photoAttachment?.url || null,
      photo_attachment: photoAttachment,
      created_at: now()
    };
    await req.db.collection("portal_requests").insertOne(portalDoc);
    res.json(serialize(portalDoc));
  } catch (error) { next(error); }
});

api.get("/portal/track/:trackingNumber", async (req, res, next) => {
  try {
    const portalReq = await req.db.collection("portal_requests").findOne(
      { tracking_number: req.params.trackingNumber },
      { projection: { _id: 0 } }
    );
    if (!portalReq) return bad(res, 404, "Request not found");

    let derived = {
      tracking_status: portalReq.status,
      document_status: null,
      document_number: null,
      document_type_label: null,
    };

    if (portalReq.document_request_id) {
      const docReq = await req.db.collection("document_requests").findOne(notDeleted({ id: portalReq.document_request_id }), { projection: { _id: 0 } });
      if (docReq) {
        derived = {
          tracking_status: docReq.status === 'approved' ? 'approved' : docReq.status,
          document_status: docReq.status,
          document_number: docReq.document_number,
          document_type_label: docReq.document_type
        };
      }
    }

    res.json(serialize({ ...portalReq, ...derived }));
  } catch (error) { next(error); }
});

api.get("/portal/track/:trackingNumber/download", async (req, res, next) => {
  try {
    const portalReq = await req.db.collection("portal_requests").findOne(
      { tracking_number: req.params.trackingNumber },
      { projection: { _id: 0 } }
    );
    if (!portalReq) return bad(res, 404, "Request not found");
    if (!portalReq.document_request_id) return bad(res, 400, "Document not yet linked for processing");

    const docReq = await req.db.collection("document_requests").findOne(notDeleted({ id: portalReq.document_request_id }));
    if (!docReq) return bad(res, 404, "Document request not found");
    if (docReq.status !== "approved") return bad(res, 400, "Document not yet approved");

    const resident = await req.db.collection("residents").findOne(notDeleted({ id: docReq.resident_id }), { projection: { _id: 0 } });
    if (!resident) return bad(res, 404, "Resident not found");

    const templateBuffer = await getDocumentTemplateBuffer(req.db, docReq.document_type);
    const applicantPhotoBuffer = await getApplicantPhotoBuffer(docReq);
    const systemConfig = await getSystemConfig(req.db);
    const pdf = await generateCertificate(docReq.document_type, resident, docReq, templateBuffer, applicantPhotoBuffer, systemConfig);
    const saved = await uploadLargeObject(`documents/${docReq.id}.pdf`, pdf, "application/pdf");
    await req.db.collection("document_requests").updateOne(
      { id: docReq.id },
      { $set: { pdf_url: saved.url, pdf_storage: saved, downloaded_at: now() }, $inc: { download_count: 1 }, $push: { status_history: lifecycleEvent("released", null, "Portal PDF downloaded") } }
    );
    await recordDocumentPayment(req.db, { resident, document: docReq });
    await auditLog(req, "download_pdf", { collection: "document_requests", record_id: docReq.id, document_type: docReq.document_type, document_number: docReq.document_number, portal_tracking_number: portalReq.tracking_number });
    publishDataChange({ method: "POST", path: "/payments", source: "portal-document-download" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${docReq.document_type}_${docReq.document_number}.pdf`
    );
    res.send(pdf);
  } catch (error) { next(error); }
});


api.get("/portal-requests", requireUser, async (req, res, next) => {
  try {
    const requests = await req.db.collection("portal_requests").find(notDeleted(), { projection: { _id: 0 } }).sort(byCreatedDesc).limit(200).toArray();
    res.json({ requests: requests.map(serialize), total: requests.length });
  } catch (error) { next(error); }
});

api.put("/portal-requests/:reqId/process", requireUser, async (req, res, next) => {
  try {
    const portalReq = await req.db.collection("portal_requests").findOne(notDeleted({ id: req.params.reqId }));
    if (!portalReq) return bad(res, 404, "Request not found");

    if (portalReq.document_request_id) {
      return res.json({ message: "Request already processed", document_request_id: portalReq.document_request_id });
    }

    const residentId = portalReq.resident_id || portalReq.resident_id_from_portal || portalReq.residentId || portalReq.resident_id_number;
    let residentDoc = residentId
      ? await req.db.collection("residents").findOne(notDeleted({ id: residentId }))
      : null;

    if (!residentDoc) {
      const fallbackClauses = [];
      if (portalReq.email) fallbackClauses.push({ email: portalReq.email });
      if (portalReq.contact_number) fallbackClauses.push({ contact_number: portalReq.contact_number });
      if (portalReq.full_name) fallbackClauses.push({ full_name: { $regex: `^${portalReq.full_name}$`, $options: "i" } });

      if (fallbackClauses.length > 0) {
        residentDoc = await req.db.collection("residents").findOne({ $or: fallbackClauses });
      }
    }

    let requestDoc = null;
    let createdDocReq = null;

    if (residentDoc) {
      const documentType = portalReq.document_type;
      requestDoc = {
        id: token(),
        resident_id: residentDoc.id,
        document_type: documentType,
        purpose: portalReq.purpose,
        status: "pending",
        status_history: [lifecycleEvent("pending", req.user._id, "Portal request processed into document request")],
        document_number: docNumber(documentType),
        additional_details: {
          ...(portalReq.additional_details || {}),
          portal_request_id: portalReq.id,
          portal_tracking_number: portalReq.tracking_number,
          applicant_photo_url: portalReq.photo_url || null,
          applicant_photo_attachment: portalReq.photo_attachment || null
        },
        created_at: now(),
        created_by: req.user._id
      };

      const insertResult = await req.db.collection("document_requests").insertOne(requestDoc);
      createdDocReq = await req.db.collection("document_requests").findOne({ _id: insertResult.insertedId });
      delete createdDocReq.created_by;
    }

    await req.db.collection("portal_requests").updateOne(
      { id: req.params.reqId },
      {
        $set: {
          status: "processed",
          processed_at: now(),
          processed_by: req.user._id,
          ...(requestDoc ? { document_request_id: requestDoc.id } : {})
        }
      }
    );

    res.json({
      message: "Request processed",
      document_request_id: requestDoc?.id || null,
      document_request: createdDocReq ? serialize({ ...createdDocReq, id: requestDoc.id }) : null
    });
  } catch (error) { next(error); }
});


api.get("/config/system", async (req, res, next) => {
  try {
    const config = await getSystemConfig(req.db);
    res.json({ ...config, frontend: toFrontendConfig(config) });
  } catch (error) { next(error); }
});

api.put("/config/system", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const barangay = req.body.barangay_info || req.body.barangayInfo || {};
    const config = mergeSystemConfig({
      barangay_info: {
        name: barangay.name,
        municipality: barangay.municipality,
        province: barangay.province,
        region: barangay.region,
        contact_number: barangay.contact_number || barangay.contactNumber,
        email: barangay.email,
        address: barangay.address,
        captain_name: barangay.captain_name || barangay.captainName,
        captain_signature: barangay.captain_signature || barangay.captainName,
        secretary_name: barangay.secretary_name || barangay.secretaryName,
        secretary_signature: barangay.secretary_signature || barangay.secretaryName,
        treasurer_name: barangay.treasurer_name || barangay.treasurerName
      }
    });

    await req.db.collection("system_settings").updateOne(
      { key: "system" },
      { $set: { key: "system", config, updated_at: now(), updated_by: req.user._id } },
      { upsert: true }
    );
    res.json({ ...config, frontend: toFrontendConfig(config) });
  } catch (error) { next(error); }
});

api.get("/document-templates", requireUser, async (req, res, next) => {
  try {
    const templates = await req.db.collection("document_templates").find(
      {},
      { projection: { _id: 0 } }
    ).sort({ updated_at: -1, created_at: -1 }).toArray();
    res.json({ templates: templates.map(serialize), total: templates.length });
  } catch (error) { next(error); }
});

api.post("/document-templates/:documentType", requireUser, upload.single("template"), async (req, res, next) => {
  try {
    const fileError = validateUploadedFile(req.file, { allowedTypes: documentTemplateTypes, maxSize: MAX_TEMPLATE_UPLOAD_SIZE, label: "Template file" });
    if (fileError) return bad(res, 400, fileError);

    const documentType = req.params.documentType;
    const ext = path.extname(req.file.originalname) || ".template";
    const saved = await uploadLargeObject(
      `document-templates/${documentType}/${Date.now()}${ext}`,
      req.file.buffer,
      req.file.mimetype
    );

    const templateDoc = {
      id: token(),
      document_type: documentType,
      file_name: req.file.originalname,
      content_type: req.file.mimetype,
      size: req.file.size,
      url: saved.url,
      storage: saved,
      active: true,
      created_at: now(),
      updated_at: now(),
      uploaded_by: req.user._id
    };

    await req.db.collection("document_templates").updateMany(
      { document_type: documentType },
      { $set: { active: false, updated_at: now() } }
    );
    await req.db.collection("document_templates").insertOne(templateDoc);

    res.json(serialize(templateDoc));
  } catch (error) { next(error); }
});

api.delete("/document-templates/:documentType", ...requireDeleteAdmin, async (req, res, next) => {
  try {
    const result = await req.db.collection("document_templates").updateMany(
      { document_type: req.params.documentType, active: true },
      { $set: { active: false, removed_at: now(), removed_by: req.user._id } }
    );
    if (!result.matchedCount) return bad(res, 404, "Template not found");
    res.json({ message: "Template removed" });
  } catch (error) { next(error); }
});

api.post("/seed/sample-data", requireUser, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production") return bad(res, 403, "Sample data seeding is disabled in production");
    const existing = await req.db.collection("residents").countDocuments(notDeleted());
    if (existing >= 10) return res.json({ message: "Sample data already seeded", residents_count: existing });
    const residents = [
      ["Juan Dela Cruz", "Block 1 Lot 2, San Miguel St.", "1985-03-15", "Male", "Married"],
      ["Maria Santos", "Block 2 Lot 5, Rizal Ave.", "1990-07-22", "Female", "Single"],
      ["Pedro Reyes", "Block 3 Lot 8, Bonifacio St.", "1955-11-10", "Male", "Widowed"],
      ["Ana Garcia", "Block 4 Lot 11, Mabini St.", "1988-04-18", "Female", "Separated"],
      ["Carlos Mendoza", "Block 5 Lot 14, Aguinaldo St.", "1972-09-05", "Male", "Married"],
      ["Rosa Fernandez", "Block 6 Lot 17, Luna St.", "1950-12-25", "Female", "Widowed"],
      ["Miguel Torres", "Block 7 Lot 20, Quezon Ave.", "1995-06-30", "Male", "Single"],
      ["Luz Aquino", "Block 8 Lot 23, Magsaysay St.", "1982-02-14", "Female", "Married"],
      ["Roberto Castro", "Block 9 Lot 26, Roxas St.", "1968-08-19", "Male", "Married"],
      ["Sofia Ramos", "Block 10 Lot 29, Marcos Highway", "1958-05-08", "Female", "Married"]
    ].map(([full_name, address, birthdate, gender, civil_status], index) => ({
      id: token(), full_name, address, birthdate, gender, civil_status,
      citizenship: "Filipino", age: ageFromBirthdate(birthdate), photo_url: null,
      contact_number: `09${17 + index}1234567`, occupation: index % 2 ? "Staff" : "Worker",
      is_voter: true, is_pwd: index === 4, is_senior: ageFromBirthdate(birthdate) >= 60,
      is_solo_parent: index === 3, household_id: null, created_at: now(), created_by: req.user._id
    }));
    await req.db.collection("residents").insertMany(residents);
    res.json({ message: "Sample data seeded", residents_added: residents.length });
  } catch (error) { next(error); }
});

app.use("/api", api);
app.use("/api", createPrivateFilesRouter());

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ detail: "Internal server error" });
});

const port = Number(process.env.PORT || 8001);

assertProductionEnvironment();

connectDatabase()
  .then(async (db) => {
    app.locals.db = db;
    await seedAdmin(db);
    app.listen(port, () => console.log(`Node backend listening. Frontend URL: ${process.env.FRONTEND_URL || "https://barangaypwa-ytdq.vercel.app"}`));
  })
  .catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
  });

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});
