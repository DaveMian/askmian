import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { applications } from "@db/schema";
import { desc, eq } from "drizzle-orm";

export const adminRouter = createRouter({
  stats: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(applications);

    const total = all.length;
    const pending = all.filter((a) => a.status === "pending").length;
    const processing = all.filter((a) => a.status === "processing").length;
    const completed = all.filter((a) => a.status === "completed").length;
    const paid = all.filter(
      (a) => a.paymentStatus === "paid" || a.paymentStatus === "succeeded"
    ).length;
    const revenue = all.reduce((sum, a) => sum + (a.amountPaid || 0), 0);

    return { total, pending, processing, completed, paid, revenue };
  }),

  listApplications: publicQuery
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const rows = await db
        .select()
        .from(applications)
        .orderBy(desc(applications.createdAt))
        .limit(limit)
        .offset(offset);
      return rows;
    }),

  updateStatus: publicQuery
    .input(z.object({ id: z.number(), status: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(applications)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(applications.id, input.id));
      return { success: true };
    }),
});
