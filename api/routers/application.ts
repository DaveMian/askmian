import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { applications } from "@db/schema";
import { eq } from "drizzle-orm";
import { sendApplicationConfirmation, sendAdminNotification } from "../lib/email";

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
        stripePaymentIntentId: z.string().optional(),
        stripeClientSecret: z.string().optional(),
        paymentStatus: z.string().optional(),
        amountPaid: z.number().optional(),
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
        stripePaymentIntentId: input.stripePaymentIntentId || null,
        stripeClientSecret: input.stripeClientSecret || null,
        paymentStatus: input.paymentStatus || "pending",
        amountPaid: input.amountPaid || null,
        status: "pending",
      });

      const appId = Number(result[0].insertId);

      // Send confirmation email to customer
      if (input.email && input.email.length > 0) {
        await sendApplicationConfirmation({
          to: input.email,
          appId,
          fullName: input.fullName,
          visaType: input.visaType,
          paymentMethod: input.paymentMethod || "",
        });
      }

      // Send admin notification
      await sendAdminNotification({
        appId,
        fullName: input.fullName,
        visaType: input.visaType,
        phone: input.phone,
        email: input.email,
        paymentMethod: input.paymentMethod || "",
      });

      return { id: appId };
    }),

  // Public status tracking - no auth needed
  track: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(applications)
        .where(eq(applications.id, input.id));
      const app = rows[0];
      if (!app) return null;
      // Return only safe fields for public view
      return {
        id: app.id,
        fullName: app.fullName,
        visaType: app.visaType,
        status: app.status,
        paymentStatus: app.paymentStatus,
        paymentMethod: app.paymentMethod,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        fullName: z.string().optional(),
        nationality: z.string().optional(),
        currentLocation: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        visaType: z.string().optional(),
        travelDate: z.string().optional(),
        notes: z.string().optional(),
        paymentMethod: z.string().optional(),
        passportUrl: z.string().optional(),
        photoUrl: z.string().optional(),
        bankStatementUrl: z.string().optional(),
        stripePaymentIntentId: z.string().optional(),
        stripeClientSecret: z.string().optional(),
        paymentStatus: z.string().optional(),
        amountPaid: z.number().optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.fullName) updateData.fullName = data.fullName;
      if (data.nationality) updateData.nationality = data.nationality;
      if (data.currentLocation !== undefined) updateData.currentLocation = data.currentLocation || null;
      if (data.phone) updateData.phone = data.phone;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.visaType) updateData.visaType = data.visaType;
      if (data.travelDate !== undefined) updateData.travelDate = data.travelDate || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
      if (data.passportUrl) updateData.passportUrl = data.passportUrl;
      if (data.photoUrl) updateData.photoUrl = data.photoUrl;
      if (data.bankStatementUrl) updateData.bankStatementUrl = data.bankStatementUrl;
      if (data.stripePaymentIntentId) updateData.stripePaymentIntentId = data.stripePaymentIntentId;
      if (data.stripeClientSecret) updateData.stripeClientSecret = data.stripeClientSecret;
      if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
      if (data.amountPaid !== undefined) updateData.amountPaid = data.amountPaid;
      if (data.status) updateData.status = data.status;
      updateData.updatedAt = new Date();

      await db.update(applications).set(updateData).where(eq(applications.id, id));
      return { success: true };
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
