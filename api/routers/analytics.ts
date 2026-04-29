import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { applications } from "@db/schema";
import { sql } from "drizzle-orm";

export const analyticsRouter = createRouter({
  // Monthly application count for the last 12 months
  monthlyApplications: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        month: sql<string>`DATE_FORMAT(${applications.createdAt}, '%Y-%m')`,
        count: sql<number>`COUNT(*)`,
      })
      .from(applications)
      .groupBy(sql`DATE_FORMAT(${applications.createdAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${applications.createdAt}, '%Y-%m')`)
      .limit(12);
    return rows;
  }),

  // Revenue breakdown by visa type
  revenueByVisaType: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        visaType: applications.visaType,
        count: sql<number>`COUNT(*)`,
        revenue: sql<number>`COALESCE(SUM(${applications.amountPaid}), 0)`,
      })
      .from(applications)
      .groupBy(applications.visaType);
    return rows;
  }),

  // Payment method breakdown
  paymentMethodBreakdown: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        method: applications.paymentMethod,
        count: sql<number>`COUNT(*)`,
      })
      .from(applications)
      .groupBy(applications.paymentMethod);
    return rows.filter((r) => r.method);
  }),

  // Status breakdown
  statusBreakdown: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        status: applications.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(applications)
      .groupBy(applications.status);
    return rows;
  }),
});
