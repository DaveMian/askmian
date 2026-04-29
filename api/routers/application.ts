import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { applications } from "@db/schema";
import { eq } from "drizzle-orm";

export const applicationRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        fullName: z.string().min(1),
        nationality: z.string().min(1),
        currentLocation: z.string().optional(),
        phone: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        visaType: z.string().min(1),
        travelDate: z.string().optional(),
        notes: z.string().optional(),
        paymentMethod: z.string().optional(),
        passportUrl: z.string().optional(),
        photoUrl: z.string().optional(),
        bankStatementUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(applications).values({
        fullName: input.fullName,
        nationality: input.nationality,
        currentLocation: input.currentLocation || null,
        phone: input.phone,
        email: input.email || null,
        visaType: input.visaType,
        travelDate: input.travelDate || null,
        notes: input.notes || null,
        paymentMethod: input.paymentMethod || null,
        passportUrl: input.passportUrl || null,
        photoUrl: input.photoUrl || null,
        bankStatementUrl: input.bankStatementUrl || null,
        status: "pending",
        paymentStatus: "pending",
      });
      return { id: Number(result[0].insertId) };
    }),

  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(applications)
        .where(eq(applications.id, input.id));
      return rows[0] || null;
    }),

  updatePayment: publicQuery
    .input(
      z.object({
        id: z.number(),
        stripePaymentIntentId: z.string().optional(),
        stripeClientSecret: z.string().optional(),
        paymentStatus: z.string().optional(),
        amountPaid: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.stripePaymentIntentId) updateData.stripePaymentIntentId = data.stripePaymentIntentId;
      if (data.stripeClientSecret) updateData.stripeClientSecret = data.stripeClientSecret;
      if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
      if (data.amountPaid !== undefined) updateData.amountPaid = data.amountPaid;
      updateData.updatedAt = new Date();

      await db
        .update(applications)
        .set(updateData)
        .where(eq(applications.id, id));
      return { success: true };
    }),

  updateStatus: publicQuery
    .input(
      z.object({
        id: z.number(),
        status: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(applications)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(applications.id, input.id));
      return { success: true };
    }),

  updateDocuments: publicQuery
    .input(
      z.object({
        id: z.number(),
        passportUrl: z.string().optional(),
        photoUrl: z.string().optional(),
        bankStatementUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.passportUrl) updateData.passportUrl = data.passportUrl;
      if (data.photoUrl) updateData.photoUrl = data.photoUrl;
      if (data.bankStatementUrl) updateData.bankStatementUrl = data.bankStatementUrl;
      updateData.updatedAt = new Date();

      await db.update(applications).set(updateData).where(eq(applications.id, id));
      return { success: true };
    }),
});
