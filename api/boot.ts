import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import fs from "fs";
import path from "path";

const app = new Hono<{ Bindings: HttpBindings }>();

// CORS — custom middleware (avoids bundler issues with hono/cors)
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin") || "*";
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token");
  c.header("Access-Control-Allow-Credentials", "true");

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

  return next();
});

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// File upload endpoint (outside tRPC - handles multipart)
app.post("/api/upload", bodyLimit({ maxSize: 20 * 1024 * 1024 }), async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const field = formData.get("field") as string || "document";
    const appId = formData.get("applicationId") as string || "unknown";

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Create app-specific directory
    const appDir = path.join(uploadsDir, appId);
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    const ext = path.extname(file.name) || ".bin";
    const fileName = `${field}_${Date.now()}${ext}`;
    const filePath = path.join(appDir, fileName);

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Return URL (absolute for cross-origin frontend hosting)
    const baseUrl = process.env.BACKEND_URL || '';
    const fileUrl = baseUrl ? `${baseUrl}/uploads/${appId}/${fileName}` : `/uploads/${appId}/${fileName}`;

    return c.json({
      success: true,
      url: fileUrl,
      fileName: file.name,
      size: file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// Serve uploaded files statically
app.use("/uploads/*", async (c) => {
  const filePath = path.join(uploadsDir, c.req.path.replace("/uploads/", ""));
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    c.header("Content-Type", mimeTypes[ext] || "application/octet-stream");
    return c.body(fs.readFileSync(filePath));
  }
  return c.notFound();
});

// Database migration endpoint — adds columns that exist in the schema but may be missing from the live DB
app.post("/api/migrate", async (c) => {
  try {
    const mysql = await import("mysql2/promise");

    // Parse DATABASE_URL (mysql://user:pass@host:port/dbname)
    const url = new URL(env.databaseUrl);
    const connection = await mysql.createConnection({
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.replace(/^\//, ""),
      ssl: { rejectUnauthorized: false },
    });

    const dbName = url.pathname.replace(/^\//, "");
    const results: { column: string; action: string }[] = [];

    // Helper: check if a column exists in INFORMATION_SCHEMA
    async function columnExists(table: string, column: string): Promise<boolean> {
      const [rows] = await connection.execute(
        `SELECT COUNT(*) AS cnt
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [dbName, table, column]
      );
      return (rows as any)[0].cnt > 0;
    }

    // 1. tracking_code VARCHAR(20) UNIQUE AFTER id
    if (await columnExists("applications", "tracking_code")) {
      results.push({ column: "tracking_code", action: "already exists — skipped" });
    } else {
      await connection.execute(
        "ALTER TABLE applications ADD COLUMN tracking_code VARCHAR(20) UNIQUE AFTER id"
      );
      results.push({ column: "tracking_code", action: "added" });
    }

    // 2. payment_proof_url VARCHAR(500) AFTER payment_status
    if (await columnExists("applications", "payment_proof_url")) {
      results.push({ column: "payment_proof_url", action: "already exists — skipped" });
    } else {
      await connection.execute(
        "ALTER TABLE applications ADD COLUMN payment_proof_url VARCHAR(500) AFTER payment_status"
      );
      results.push({ column: "payment_proof_url", action: "added" });
    }

    await connection.end();

    return c.json({ success: true, migrations: results });
  } catch (err: any) {
    console.error("[migrate] error:", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Health check + connectivity test
app.get("/health", async (c) => {
  try {
    // Test database connection
    const { getDb } = await import("./queries/connection");
    const db = getDb();
    const result = await db.execute("SELECT 1 as test");
    
    return c.json({
      status: "ok",
      time: new Date().toISOString(),
      db: result ? "connected" : "disconnected",
      env: env.isProduction ? "production" : "development",
      uploadDir: fs.existsSync(uploadsDir) ? "ready" : "missing",
    });
  } catch (err: any) {
    return c.json({
      status: "error",
      db: "disconnected",
      error: err.message,
    }, 500);
  }
});

// tRPC endpoint
app.use("/api/trpc/*", async (c) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });

  // tRPC creates its own Response — we must copy CORS headers onto it
  const origin = c.req.header("Origin") || "*";
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", origin);
  newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token");
  newHeaders.set("Access-Control-Allow-Credentials", "true");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on port ${port}`);
  });
}