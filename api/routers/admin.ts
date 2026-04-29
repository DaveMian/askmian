import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { applications, applicationNotes } from "@db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { sendStatusUpdate } from "../lib/email";

export const adminRouter = createRouter({
  stats: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(applications);

    const total = all.length;
    const pending = all.filter((a) => a.status === "pending").length;
    const processing = all.filter((a) => a.status === "processing").length;
    const completed = all.filter((a) => a.status === "completed").length;
    const rejected = all.filter((a) => a.status === "rejected").length;
    const paid = all.filter(
      (a) => a.paymentStatus === "paid" || a.paymentStatus === "succeeded"
    ).length;
    const revenue = all.reduce((sum, a) => sum + (a.amountPaid || 0), 0);

    return { total, pending, processing, completed, rejected, paid, revenue };
  }),

  listApplications: publicQuery
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
        status: z.string().optional(),
        visaType: z.string().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      let query = db
        .select()
        .from(applications)
        .orderBy(desc(applications.createdAt))
        .limit(limit)
        .offset(offset);

      const rows = await query;

      // Filter in memory for simplicity (works for reasonable dataset sizes)
      let filtered = rows;
      if (input?.status) {
        filtered = filtered.filter((r) => r.status === input.status);
      }
      if (input?.visaType) {
        filtered = filtered.filter((r) => r.visaType === input.visaType);
      }
      if (input?.search) {
        const s = input.search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.fullName.toLowerCase().includes(s) ||
            r.phone.includes(s) ||
            r.email?.toLowerCase().includes(s) ||
            r.id.toString().includes(s)
        );
      }

      return filtered;
    }),

  getApplication: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const appRows = await db
        .select()
        .from(applications)
        .where(eq(applications.id, input.id));
      const app = appRows[0] || null;

      if (!app) return null;

      const notes = await db
        .select()
        .from(applicationNotes)
        .where(eq(applicationNotes.applicationId, input.id))
        .orderBy(desc(applicationNotes.createdAt));

      return { ...app, notes };
    }),

  updateStatus: publicQuery
    .input(z.object({ id: z.number(), status: z.string(), notifyCustomer: z.boolean().default(false) }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get current application to check email
      const appRows = await db
        .select()
        .from(applications)
        .where(eq(applications.id, input.id));
      const app = appRows[0];

      await db
        .update(applications)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(applications.id, input.id));

      // Send email notification if requested and email exists
      if (input.notifyCustomer && app?.email && app.email.length > 0) {
        await sendStatusUpdate({
          to: app.email,
          fullName: app.fullName,
          appId: app.id,
          visaType: app.visaType,
          status: input.status,
        });
      }

      return { success: true };
    }),

  // CSV export
  exportCSV: publicQuery
    .input(
      z.object({
        status: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(applications)
        .orderBy(desc(applications.createdAt));

      let filtered = rows;
      if (input?.status) {
        filtered = filtered.filter((r) => r.status === input.status);
      }

      // Build CSV
      const headers = [
        "ID", "Full Name", "Nationality", "Phone", "Email",
        "Visa Type", "Payment Method", "Payment Status", "Status",
        "Amount Paid (AED)", "Passport URL", "Photo URL", "Bank Statement URL",
        "Notes", "Created At", "Updated At",
      ];

      const csvRows = filtered.map((r) => [
        `"${(r.fullName || "").replace(/"/g, '""')}"`,
        `"${(r.nationality || "").replace(/"/g, '""')}"`,
        `"${r.phone || ""}"`,
        `"${(r.email || "").replace(/"/g, '""')}"`,
        `"${(r.visaType || "").replace(/"/g, '""')}"`,
        r.paymentMethod || "",
        r.paymentStatus || "",
        r.status || "",
        (r.amountPaid || 0) / 100, // Convert fils to AED
        r.passportUrl || "",
        r.photoUrl || "",
        r.bankStatementUrl || "",
        `"${(r.notes || "").replace(/"/g, '""')}"`,
        r.createdAt ? new Date(r.createdAt).toISOString() : "",
        r.updatedAt ? new Date(r.updatedAt).toISOString() : "",
      ]);

      const csv = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
      return { csv, count: filtered.length };
    }),
});
