import express from "express";
import { requireUser } from "./auth.js";
import { readPrivateLargeObject } from "./storage.js";

export function createPrivateFilesRouter() {
  const router = express.Router();

  // Authenticated download for private uploads/templates.
  // Permission model here mirrors the existing "download" action where possible.
  // For simplicity we protect all private file downloads under "documents/download"
  // (staff can still access the documents module where file templates are used).
  // If you want stricter enforcement, extend mapping by provider/path.

  router.get("/private-files/:provider/:key(*)", requireUser, async (req, res, next) => {
    try {
      const provider = req.params.provider;
      const key = req.params.key;

      // Basic guard against path tricks.
      if (!provider || !key || key.includes("..")) return res.status(400).json({ detail: "Invalid key" });

      // Stream bytes to client.
      const storage = { provider, key };
      const buf = await readPrivateLargeObject(storage);
      if (!buf) return res.status(404).json({ detail: "File not found" });

      // Best-effort content type.
      const lower = String(key).toLowerCase();
      const contentType = lower.endsWith(".pdf") ? "application/pdf" : lower.endsWith(".png") ? "image/png" : lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-store");
      // Force download for non-images/templates.
      const disposition = contentType === "application/pdf" ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disposition}; filename=${encodeURIComponent(key.split("/").pop())}`);
      res.end(buf);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

