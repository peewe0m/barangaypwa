import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { toObjectId } from "./db.js";

const JWT_ALGORITHM = "HS256";

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  return process.env.JWT_SECRET;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function createAccessToken(userId, email) {
  return jwt.sign({ sub: userId, email, type: "access" }, jwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: "15m"
  });
}

export function isAdminUser(user) {
  return ["admin", "super_admin"].includes(user?.role);
}

export function createRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: "refresh" }, jwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: "7d"
  });
}

export function setAuthCookies(res, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === "production";
  const csrfToken = crypto.randomBytes(24).toString("base64url");

  // Use strict transport + sensible cookie defaults.
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 15 * 60 * 1000,
    path: "/",
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  // Not strictly required for auth logic; keep minimal exposure.
  res.cookie("auth_hint", "1", {
    httpOnly: false,
    secure: isProd,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  // CSRF token must be readable by the browser for axios interceptor.
  res.cookie("csrf_token", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}


export function clearAuthCookies(res) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  res.clearCookie("auth_hint", { path: "/" });
  res.clearCookie("csrf_token", { path: "/" });
}

export async function requireUser(req, res, next) {
  try {
    let token = req.cookies?.access_token;
    const header = req.get("authorization") || "";
    if (!token && header.startsWith("Bearer ")) token = header.slice(7);
    if (!token) return res.status(401).json({ detail: "Not authenticated" });

    const payload = jwt.verify(token, jwtSecret(), { algorithms: [JWT_ALGORITHM] });
    if (payload.type !== "access") return res.status(401).json({ detail: "Invalid token type" });

    const user = await req.db.collection("users").findOne({ _id: toObjectId(payload.sub) });
    if (!user) return res.status(401).json({ detail: "User not found" });
    if (user.disabled || user.deleted_at) return res.status(403).json({ detail: "Account is disabled" });

    user._id = String(user._id);
    delete user.password_hash;
    req.user = user;
    next();
  } catch (error) {
    const detail = error.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    res.status(401).json({ detail });
  }
}

export function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) return res.status(403).json({ detail: "Admin access is required" });
  next();
}
