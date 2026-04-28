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

    // Return URL (served from /uploads/)
    const fileUrl = `/uploads/${appId}/${fileName}`;

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

// tRPC endpoint
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
