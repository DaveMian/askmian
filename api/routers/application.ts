import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { applications } from "@db/schema";
import { eq, like } from "drizzle-orm";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Generate random tracking code: AM-XXXXXX
function generateTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AM-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Admin notification email HTML
function adminNotificationHtml(data: {
  fullName: string;
  nationality: string;
  phone: string;
  email?: string | null;
  visaType: string;
  paymentMethod?: string | null;
  notes?: string | null;
  trackingCode: string;
}) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0A0F;color:#F5F0E8;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 30px;">
  <div style="text-align:center;margin-bottom:30px;"><span style="font-size:24px;">ASK <span style="color:#D4AF37;">MIAN</span></span></div>
  <div style="text-align:center;border-bottom:1px solid rgba(212,175,55,0.2);padding-bottom:25px;margin-bottom:30px;">
    <h1 style="font-size:22px;font-weight:400;color:#D4AF37;margin:0 0 8px;">New Application Received</h1>
    <p style="color:rgba(245,240,232,0.5);font-size:13px;margin:0;">Tracking Code: <strong style="color:#D4AF37;">${data.trackingCode}</strong> &mdash; ${date}</p>
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:12px;padding:24px;margin-bottom:20px;">
    <h2 style="font-size:14px;color:#D4AF37;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;font-weight:400;">Applicant Details</h2>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(245,240,232,0.4);font-size:13px;">Full Name</span><span style="color:#F5F0E8;font-size:13px;font-weight:500;">${data.fullName}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(245,240,232,0.4);font-size:13px;">Nationality</span><span style="color:#F5F0E8;font-size:13px;font-weight:500;">${data.nationality}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(245,240,232,0.4);font-size:13px;">Phone</span><span style="color:#F5F0E8;font-size:13px;font-weight:500;">${data.phone}</span></div>
    ${data.email ? `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(245,240,232,0.4);font-size:13px;">Email</span><span style="color:#F5F0E8;font-size:13px;font-weight:500;">${data.email}</span></div>` : ''}
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:12px;padding:24px;margin-bottom:20px;">
    <h2 style="font-size:14px;color:#D4AF37;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;font-weight:400;">Service Requested</h2>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(245,240,232,0.4);font-size:13px;">Visa Type</span><span style="display:inline-block;background:rgba(212,175,55,0.1);color:#D4AF37;padding:4px 12px;border-radius:20px;font-size:11px;letter-spacing:1px;text-transform:uppercase;">${data.visaType}</span></span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;"><span style="color:rgba(245,240,232,0.4);font-size:13px;">Payment Method</span><span style="color:#F5F0E8;font-size:13px;font-weight:500;">${data.paymentMethod || 'Not selected'}</span></div>
    ${data.notes ? `<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(245,240,232,0.4);font-size:13px;">Notes</span><span style="color:#F5F0E8;font-size:13px;font-weight:500;max-width:300px;text-align:right;">${data.notes}</span></div>` : ''}
  </div>
  <div style="text-align:center;margin-top:30px;padding-top:25px;border-top:1px solid rgba(212,175,55,0.1);">
    <p style="color:rgba(245,240,232,0.3);font-size:12px;margin:4px 0;">Reply to this email or contact via WhatsApp to follow up.</p>
    <p style="color:rgba(212,175,55,0.4);margin-top:12px;font-size:12px;">ASK MIAN Visa & PRO Services &mdash; Abu Dhabi, UAE</p>
  </div>
</div>
</body></html>`;
}

// Customer confirmation email HTML
function customerConfirmationHtml(data: {
  fullName: string;
  visaType: string;
  trackingCode: string;
  paymentMethod?: string | null;
}) {
  const firstName = data.fullName.split(' ')[0];
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0A0F;color:#F5F0E8;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 30px;">
  <div style="text-align:center;margin-bottom:30px;"><span style="font-size:24px;">ASK <span style="color:#D4AF37;">MIAN</span></span></div>
  <div style="text-align:center;border-bottom:1px solid rgba(212,175,55,0.2);padding-bottom:25px;margin-bottom:30px;">
    <h1 style="font-size:22px;font-weight:400;color:#D4AF37;margin:0 0 8px;">Your Application is Confirmed</h1>
    <p style="color:rgba(245,240,232,0.5);font-size:13px;margin:0;">Tracking Code: <strong style="color:#D4AF37;font-size:16px;">${data.trackingCode}</strong></p>
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:12px;padding:24px;margin-bottom:20px;">
    <p style="color:rgba(245,240,232,0.6);font-size:14px;line-height:1.7;margin:0 0 12px;">Dear ${firstName},</p>
    <p style="color:rgba(245,240,232,0.6);font-size:14px;line-height:1.7;margin:0 0 16px;">Thank you for choosing Ask Mian for your <strong style="color:#D4AF37;">${data.visaType}</strong>. We have received your application and our team will begin processing immediately.</p>
    <p style="color:#D4AF37;font-size:13px;margin:0;">Expected processing time: <strong>5 business days</strong></p>
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:12px;padding:24px;margin-bottom:20px;">
    <h2 style="font-size:14px;color:#D4AF37;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;font-weight:400;">What Happens Next</h2>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><div style="width:28px;height:28px;border-radius:50%;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);color:#D4AF37;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;">1</div><div style="font-size:13px;color:rgba(245,240,232,0.6);line-height:1.5;"><strong style="color:#F5F0E8;">Document Review</strong><br>Our team reviews your submitted documents within 24 hours</div></div>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><div style="width:28px;height:28px;border-radius:50%;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);color:#D4AF37;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;">2</div><div style="font-size:13px;color:rgba(245,240,232,0.6);line-height:1.5;"><strong style="color:#F5F0E8;">Application Submission</strong><br>We submit to UAE immigration authorities</div></div>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><div style="width:28px;height:28px;border-radius:50%;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);color:#D4AF37;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;">3</div><div style="font-size:13px;color:rgba(245,240,232,0.6);line-height:1.5;"><strong style="color:#F5F0E8;">Visa Approval</strong><br>Your visa is processed and approved (5 business days)</div></div>
    <div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;"><div style="width:28px;height:28px;border-radius:50%;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);color:#D4AF37;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;">4</div><div style="font-size:13px;color:rgba(245,240,232,0.6);line-height:1.5;"><strong style="color:#F5F0E8;">Delivery</strong><br>Receive your visa via email and WhatsApp</div></div>
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:12px;padding:24px;margin-bottom:20px;">
    <h2 style="font-size:14px;color:#D4AF37;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;font-weight:400;">Track Your Application</h2>
    <p style="color:rgba(245,240,232,0.6);font-size:13px;line-height:1.6;margin:0 0 12px;">Use your tracking code <strong style="color:#D4AF37;">${data.trackingCode}</strong> to check your status anytime at:</p>
    <a href="https://askmian.com/#/track" style="display:inline-block;background:rgba(212,175,55,0.1);color:#D4AF37;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;border:1px solid rgba(212,175,55,0.2);">askmian.com/#/track</a>
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
    <p style="color:rgba(245,240,232,0.6);font-size:14px;margin:0 0 16px;">Questions? Reach us directly on WhatsApp</p>
    <a href="https://wa.me/971558689543" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Chat on WhatsApp
    </a>
  </div>
  <div style="text-align:center;margin-top:30px;padding-top:25px;border-top:1px solid rgba(212,175,55,0.1);">
    <p style="color:rgba(245,240,232,0.3);font-size:12px;margin:4px 0;"><a href="https://askmian.com" style="color:#D4AF37;text-decoration:none;">askmian.com</a> &mdash; Abu Dhabi, UAE</p>
    <p style="color:rgba(245,240,232,0.3);margin-top:8px;font-size:12px;">This is an automated confirmation. Please do not reply to this email.</p>
  </div>
</div>
</body></html>`;
}

// Status update email HTML
function statusUpdateHtml(data: {
  fullName: string;
  visaType: string;
  trackingCode: string;
  status: string;
  oldStatus: string;
}) {
  const firstName = data.fullName.split(' ')[0];
  const statusMessages: Record<string, { emoji: string; title: string; message: string }> = {
    pending: { emoji: '📋', title: 'Application Received', message: 'Your application has been submitted and is in our system.' },
    documents_review: { emoji: '📄', title: 'Document Review', message: 'Our team is reviewing your submitted documents.' },
    submitted_immigration: { emoji: '🛫', title: 'Submitted to Immigration', message: 'Your application has been filed with UAE immigration authorities.' },
    processing: { emoji: '⏳', title: 'Under Processing', message: 'Immigration authorities are reviewing your application.' },
    approved: { emoji: '✅', title: 'Visa Approved!', message: 'Great news! Your visa has been approved and is being prepared for delivery.' },
    delivered: { emoji: '📧', title: 'Delivered', message: 'Your visa has been sent to your email and WhatsApp.' },
    rejected: { emoji: '❌', title: 'Application Rejected', message: 'We are sorry, but your application was not approved. We will contact you with next steps.' },
  };

  const info = statusMessages[data.status] || { emoji: '📋', title: data.status, message: 'Your application status has been updated.' };

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0A0F;color:#F5F0E8;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 30px;">
  <div style="text-align:center;margin-bottom:30px;"><span style="font-size:24px;">ASK <span style="color:#D4AF37;">MIAN</span></span></div>
  <div style="text-align:center;border-bottom:1px solid rgba(212,175,55,0.2);padding-bottom:25px;margin-bottom:30px;">
    <h1 style="font-size:22px;font-weight:400;color:#D4AF37;margin:0 0 8px;">Status Update: ${info.title}</h1>
    <p style="color:rgba(245,240,232,0.5);font-size:13px;margin:0;">Tracking Code: <strong style="color:#D4AF37;">${data.trackingCode}</strong></p>
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:12px;padding:30px;margin-bottom:20px;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">${info.emoji}</div>
    <p style="color:rgba(245,240,232,0.7);font-size:15px;line-height:1.6;margin:0;">Dear ${firstName},</p>
    <p style="color:rgba(245,240,232,0.7);font-size:15px;line-height:1.6;margin:12px 0 0;">${info.message}</p>
    <p style="color:#D4AF37;font-size:13px;margin-top:16px;">Visa Type: <strong>${data.visaType}</strong></p>
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.1);border-radius:12px;padding:24px;margin-bottom:20px;">
    <p style="color:rgba(245,240,232,0.5);font-size:13px;margin:0;">Track your application anytime at <a href="https://askmian.com/#/track" style="color:#D4AF37;text-decoration:none;">askmian.com/#/track</a></p>
  </div>
  <div style="text-align:center;margin-top:30px;padding-top:25px;border-top:1px solid rgba(212,175,55,0.1);">
    <p style="color:rgba(245,240,232,0.3);font-size:12px;margin:4px 0;"><a href="https://askmian.com" style="color:#D4AF37;text-decoration:none;">askmian.com</a> &mdash; Abu Dhabi, UAE</p>
  </div>
</div>
</body></html>`;
}

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
        paymentProofUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Generate unique tracking code
      let trackingCode = generateTrackingCode();
      let attempts = 0;
      while (attempts < 5) {
        const existing = await db.select().from(applications).where(eq(applications.trackingCode, trackingCode));
        if (existing.length === 0) break;
        trackingCode = generateTrackingCode();
        attempts++;
      }

      const result = await db.insert(applications).values({
        trackingCode,
        fullName: input.fullName,
        nationality: input.nationality,
        currentLocation: input.currentLocation || null,
        phone: input.phone,
        email: input.email || null,
        visaType: input.visaType,
        travelDate: input.travelDate || null,
        notes: input.notes || null,
        paymentMethod: input.paymentMethod || null,
        paymentStatus: "pending",
        paymentProofUrl: input.paymentProofUrl || null,
        passportUrl: input.passportUrl || null,
        photoUrl: input.photoUrl || null,
        bankStatementUrl: input.bankStatementUrl || null,
        status: "pending",
      });

      const appId = Number(result[0].insertId);

      // Send email notifications (non-blocking)
      if (resend) {
        try {
          const notificationEmail = process.env.NOTIFICATION_EMAIL || "askmian.llc@gmail.com";

          // Admin notification
          await resend.emails.send({
            from: "Ask Mian <notifications@askmian.com>",
            to: notificationEmail,
            subject: `New Application ${trackingCode} - ${input.fullName} (${input.visaType})`,
            html: adminNotificationHtml({ ...input, trackingCode }),
          });

          // Customer confirmation
          if (input.email) {
            await resend.emails.send({
              from: "Ask Mian <confirmations@askmian.com>",
              to: input.email,
              subject: `Your Ask Mian Application ${trackingCode} is Confirmed`,
              html: customerConfirmationHtml({
                fullName: input.fullName,
                visaType: input.visaType,
                trackingCode,
                paymentMethod: input.paymentMethod,
              }),
            });
          }
        } catch (emailErr) {
          console.error("[Application] Email notification failed:", emailErr);
        }
      } else {
        console.log("[Application] Resend not configured, skipping email notification");
      }

      return { id: appId, trackingCode };
    }),

  // Get by numeric ID (for admin)
  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(applications).where(eq(applications.id, input.id));
      return rows[0] || null;
    }),

  // Get by tracking code (for public tracking page)
  getByTrackingCode: publicQuery
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(applications).where(eq(applications.trackingCode, input.code.toUpperCase()));
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

      await db.update(applications).set(updateData).where(eq(applications.id, id));
      return { success: true };
    }),

  // Update status with email notification
  updateStatus: publicQuery
    .input(
      z.object({
        id: z.number(),
        status: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get current application to compare old status
      const current = await db.select().from(applications).where(eq(applications.id, input.id));
      const app = current[0];
      const oldStatus = app?.status || 'pending';

      // Update status
      await db.update(applications).set({ status: input.status, updatedAt: new Date() }).where(eq(applications.id, input.id));

      // Send status update email if email exists and status actually changed
      if (resend && app?.email && input.status !== oldStatus) {
        try {
          await resend.emails.send({
            from: "Ask Mian <updates@askmian.com>",
            to: app.email,
            subject: `Ask Mian Status Update: ${input.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
            html: statusUpdateHtml({
              fullName: app.fullName,
              visaType: app.visaType,
              trackingCode: app.trackingCode || String(app.id),
              status: input.status,
              oldStatus,
            }),
          });
        } catch (err) {
          console.error("[Application] Status update email failed:", err);
        }
      }

      return { success: true };
    }),

  // Update payment status with optional proof
  updatePaymentStatus: publicQuery
    .input(
      z.object({
        id: z.number(),
        paymentStatus: z.string(),
        paymentProofUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = { paymentStatus: input.paymentStatus, updatedAt: new Date() };
      if (input.paymentProofUrl) updateData.paymentProofUrl = input.paymentProofUrl;

      await db.update(applications).set(updateData).where(eq(applications.id, input.id));
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
