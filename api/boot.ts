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

// CORS - custom middleware (works with esbuild bundling)
// Must set headers on EVERY response, including tRPC responses
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin") || "*";
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token");
  c.header("Access-Control-Allow-Credentials", "true");

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

  await next();

  // Ensure CORS headers are on the final response too
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Credentials", "true");
});

// Health check endpoint
app.get("/api/health", async (c) => {
  try {
    const { getDb } = await import("./queries/connection");
    const db = getDb();
    const result = await db.query.applications?.findFirst() ?? "db_ready";
    return c.json({
      status: "ok",
      db: "connected",
      env: {
        hasDatabaseUrl: !!env.databaseUrl,
        hasAdminPassword: !!env.adminPassword,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return c.json({ status: "error", db: "disconnected", error }, 500);
  }
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
    const field = (formData.get("field") as string) || "document";
    const appId = (formData.get("applicationId") as string) || "unknown";

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    const appDir = path.join(uploadsDir, appId);
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    const ext = path.extname(file.name) || ".bin";
    const fileName = `${field}_${Date.now()}${ext}`;
    const filePath = path.join(appDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Return FULL URL so frontend/admin can access files from Cloudflare Pages
    const origin = new URL(c.req.url).origin;
    const fileUrl = `${origin}/uploads/${appId}/${fileName}`;

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

// Serve uploaded files statically with CORS
app.use("/uploads/*", async (c) => {
  const origin = c.req.header("Origin") || "*";
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Credentials", "true");

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

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

// tRPC endpoint - wrap response to preserve CORS headers
app.use("/api/trpc/*", async (c) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });

  const origin = c.req.header("Origin") || "*";
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", origin);
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
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Database URL configured: ${env.databaseUrl ? "YES" : "NO"}`);
  });
}
