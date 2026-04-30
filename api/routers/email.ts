import { createRouter, publicQuery } from "../middleware";
import { z } from "zod";
import { Resend } from "resend";
import { env } from "../lib/env";

const resend = env.isProduction && process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Admin notification email — sent when new application arrives
function adminNotificationTemplate(data: {
  fullName: string;
  nationality: string;
  phone: string;
  email?: string | null;
  visaType: string;
  paymentMethod?: string | null;
  notes?: string | null;
  appId: number;
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Application - Ask Mian</title>
  <style>
    body { font-family: 'Georgia', serif; background: #0A0A0F; color: #F5F0E8; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 30px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo span { font-family: 'Georgia', serif; font-size: 24px; }
    .logo .gold { color: #D4AF37; }
    .header { text-align: center; border-bottom: 1px solid rgba(212,175,55,0.2); padding-bottom: 25px; margin-bottom: 30px; }
    .header h1 { font-family: 'Georgia', serif; font-size: 22px; font-weight: 400; color: #D4AF37; margin: 0 0 8px 0; }
    .header p { color: rgba(245,240,232,0.5); font-size: 13px; margin: 0; }
    .section { background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.1); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .section h2 { font-family: 'Georgia', serif; font-size: 14px; color: #D4AF37; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px 0; font-weight: 400; }
    .field { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .field:last-child { border-bottom: none; }
    .field-label { color: rgba(245,240,232,0.4); font-size: 13px; }
    .field-value { color: #F5F0E8; font-size: 13px; font-weight: 500; }
    .badge { display: inline-block; background: rgba(212,175,55,0.1); color: #D4AF37; padding: 4px 12px; border-radius: 20px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
    .footer { text-align: center; margin-top: 30px; padding-top: 25px; border-top: 1px solid rgba(212,175,55,0.1); }
    .footer p { color: rgba(245,240,232,0.3); font-size: 12px; margin: 4px 0; }
    .cta { display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #B8941F 100%); color: #0A0A0F; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span>ASK <span class="gold">MIAN</span></span>
    </div>
    <div class="header">
      <h1>New Application Received</h1>
      <p>Application #${data.appId} &mdash; ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="section">
      <h2>Applicant Details</h2>
      <div class="field"><span class="field-label">Full Name</span><span class="field-value">${data.fullName}</span></div>
      <div class="field"><span class="field-label">Nationality</span><span class="field-value">${data.nationality}</span></div>
      <div class="field"><span class="field-label">Phone</span><span class="field-value">${data.phone}</span></div>
      ${data.email ? `<div class="field"><span class="field-label">Email</span><span class="field-value">${data.email}</span></div>` : ''}
    </div>
    <div class="section">
      <h2>Service Requested</h2>
      <div class="field"><span class="field-label">Visa Type</span><span class="field-value"><span class="badge">${data.visaType}</span></span></div>
      <div class="field"><span class="field-label">Payment Method</span><span class="field-value">${data.paymentMethod || 'Not selected'}</span></div>
      ${data.notes ? `<div class="field"><span class="field-label">Notes</span><span class="field-value">${data.notes}</span></div>` : ''}
    </div>
    <div class="footer">
      <p>Reply to this email or contact via WhatsApp to follow up.</p>
      <p style="color: rgba(212,175,55,0.4); margin-top: 12px;">ASK MIAN Visa & PRO Services &mdash; Abu Dhabi, UAE</p>
    </div>
  </div>
</body>
</html>`;
}

// Customer confirmation email
function customerConfirmationTemplate(data: {
  fullName: string;
  visaType: string;
  appId: number;
}) {
  const firstName = data.fullName.split(' ')[0];
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Received - Ask Mian</title>
  <style>
    body { font-family: 'Georgia', serif; background: #0A0A0F; color: #F5F0E8; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 30px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo span { font-family: 'Georgia', serif; font-size: 24px; }
    .logo .gold { color: #D4AF37; }
    .header { text-align: center; border-bottom: 1px solid rgba(212,175,55,0.2); padding-bottom: 25px; margin-bottom: 30px; }
    .header h1 { font-family: 'Georgia', serif; font-size: 22px; font-weight: 400; color: #D4AF37; margin: 0 0 8px 0; }
    .header p { color: rgba(245,240,232,0.5); font-size: 13px; margin: 0; }
    .section { background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.1); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .section h2 { font-family: 'Georgia', serif; font-size: 14px; color: #D4AF37; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px 0; font-weight: 400; }
    .section p { color: rgba(245,240,232,0.6); font-size: 14px; line-height: 1.7; margin: 0 0 12px 0; }
    .section p:last-child { margin-bottom: 0; }
    .step { display: flex; align-items: flex-start; gap: 16px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .step:last-child { border-bottom: none; }
    .step-number { width: 28px; height: 28px; border-radius: 50%; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3); color: #D4AF37; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
    .step-text { font-size: 13px; color: rgba(245,240,232,0.6); line-height: 1.5; }
    .step-text strong { color: #F5F0E8; }
    .whatsapp-btn { display: inline-flex; align-items: center; gap: 8px; background: #25D366; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 25px; border-top: 1px solid rgba(212,175,55,0.1); }
    .footer p { color: rgba(245,240,232,0.3); font-size: 12px; margin: 4px 0; }
    .contact { color: #D4AF37; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span>ASK <span class="gold">MIAN</span></span>
    </div>
    <div class="header">
      <h1>Your Application is Confirmed</h1>
      <p>Application #${data.appId} &mdash; ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="section">
      <p>Dear ${firstName},</p>
      <p>Thank you for choosing Ask Mian for your <strong style="color: #D4AF37;">${data.visaType}</strong>. We have received your application and our team will begin processing immediately.</p>
      <p style="color: #D4AF37; font-size: 13px; margin-top: 16px;">Expected processing time: <strong>5 business days</strong></p>
    </div>
    <div class="section">
      <h2>What Happens Next</h2>
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-text"><strong>Document Review</strong><br>Our team reviews your submitted documents within 24 hours</div>
      </div>
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-text"><strong>Application Submission</strong><br>We submit to UAE immigration authorities</div>
      </div>
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-text"><strong>Visa Approval</strong><br>Your visa is processed and approved (5 business days)</div>
      </div>
      <div class="step">
        <div class="step-number">4</div>
        <div class="step-text"><strong>Delivery</strong><br>Receive your visa via email and WhatsApp</div>
      </div>
    </div>
    <div class="section" style="text-align: center;">
      <p style="margin-bottom: 16px;">Questions? Reach us directly on WhatsApp</p>
      <a href="https://wa.me/971558689543" class="whatsapp-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Chat on WhatsApp
      </a>
    </div>
    <div class="footer">
      <p><a href="https://askmian.com" class="contact">askmian.com</a> &mdash; Abu Dhabi, UAE</p>
      <p style="color: rgba(245,240,232,0.3); margin-top: 8px;">This is an automated confirmation. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

export const emailRouter = createRouter({
  // Send notification emails (called internally from application router)
  sendApplicationNotification: publicQuery
    .input(
      z.object({
        fullName: z.string(),
        nationality: z.string(),
        phone: z.string(),
        email: z.string().optional().nullable(),
        visaType: z.string(),
        paymentMethod: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        appId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      if (!resend) {
        console.log("[Email] Resend not configured, skipping notification");
        return { sent: false, reason: "Resend not configured" };
      }

      const notificationEmail = process.env.NOTIFICATION_EMAIL || "askmian.llc@gmail.com";

      try {
        // Send admin notification
        await resend.emails.send({
          from: "Ask Mian <notifications@askmian.com>",
          to: notificationEmail,
          subject: `New Application #${input.appId} - ${input.fullName} (${input.visaType})`,
          html: adminNotificationTemplate(input),
        });

        // Send customer confirmation if email provided
        if (input.email) {
          await resend.emails.send({
            from: "Ask Mian <confirmations@askmian.com>",
            to: input.email,
            subject: `Your Ask Mian Application #${input.appId} is Confirmed`,
            html: customerConfirmationTemplate({
              fullName: input.fullName,
              visaType: input.visaType,
              appId: input.appId,
            }),
          });
        }

        return { sent: true };
      } catch (error) {
        console.error("[Email] Failed to send:", error);
        return { sent: false, reason: "Email service error" };
      }
    }),
});
