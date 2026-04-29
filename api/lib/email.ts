// Email service using Resend (free tier: 100 emails/day)
// Sign up at resend.com to get your API key

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@askmian.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendViaResend(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY not set, skipping email:", payload.subject);
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ASK MIAN <${FROM_EMAIL}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (res.ok) {
      console.log("[Email] Sent:", payload.subject, "to", payload.to);
      return { success: true };
    } else {
      const err = await res.text();
      console.error("[Email] Failed:", err);
      return { success: false, error: err };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Email] Error:", msg);
    return { success: false, error: msg };
  }
}

// Templates
function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASK MIAN</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#141414;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
          <tr>
            <td style="background:#D4AF37;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#000;font-size:24px;font-weight:bold;">ASK MIAN</h1>
              <p style="margin:4px 0 0;color:#000;font-size:12px;opacity:0.7;">UAE Visa & PRO Services</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#e0e0e0;font-size:14px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center;color:#666;font-size:11px;">
              <p>Abu Dhabi, UAE | +971 55 868 9543 | WhatsApp: +971 55 868 9543</p>
              <p style="margin-top:8px;">This is an automated email from ASK MIAN Visa & PRO Services.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Application submitted confirmation to customer
export async function sendApplicationConfirmation(data: {
  to: string;
  appId: number;
  trackingCode: string;
  fullName: string;
  visaType: string;
  paymentMethod: string;
}): Promise<{ success: boolean; error?: string }> {
  const html = baseTemplate(`
    <h2 style="color:#D4AF37;margin-top:0;">Application Received</h2>
    <p>Dear ${data.fullName},</p>
    <p>Thank you for submitting your visa application. We have received your details and will begin processing shortly.</p>
    
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#D4AF37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Application Details</p>
      <p style="margin:4px 0;"><strong style="color:#999;">Tracking Number:</strong> <span style="color:#D4AF37;font-weight:bold;font-family:monospace;">${data.trackingCode}</span></p>
      <p style="margin:4px 0;"><strong style="color:#999;">Visa Type:</strong> ${data.visaType}</p>
      <p style="margin:4px 0;"><strong style="color:#999;">Payment Method:</strong> ${data.paymentMethod}</p>
      <p style="margin:4px 0;"><strong style="color:#999;">Processing Time:</strong> 5 business days</p>
    </div>
    
    <p><strong style="color:#D4AF37;">What happens next?</strong></p>
    <ol style="color:#ccc;padding-left:20px;">
      <li>Our team will review your documents within 24 hours</li>
      <li>We submit your application to UAE immigration authorities</li>
      <li>Your visa is processed within 5 business days</li>
      <li>You receive your visa via email and WhatsApp</li>
    </ol>
    
    <p style="margin-top:20px;">Track your application anytime with your tracking number:</p>
    <a href="https://askmian.com/#/track" style="display:inline-block;background:#D4AF37;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;">Track Your Application</a>
    
    <p style="margin-top:20px;color:#999;font-size:12px;">If you have any questions, reply to this email or contact us on WhatsApp at +971 55 868 9543.</p>
  `);

  return sendViaResend({ to: data.to, subject: `ASK MIAN - Application ${data.trackingCode} Received`, html });
}

// Admin notification when new application arrives
export async function sendAdminNotification(data: {
  appId: number;
  trackingCode: string;
  fullName: string;
  visaType: string;
  phone: string;
  email?: string | null;
  paymentMethod: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!ADMIN_EMAIL) {
    console.log("[Email] ADMIN_EMAIL not set, skipping admin notification");
    return { success: false, error: "ADMIN_EMAIL not configured" };
  }

  const html = baseTemplate(`
    <h2 style="color:#D4AF37;margin-top:0;">New Application Submitted</h2>
    <p>A new visa application has been submitted on your website.</p>
    
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#D4AF37;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Application Details</p>
      <p style="margin:4px 0;"><strong style="color:#999;">Tracking Number:</strong> <span style="color:#D4AF37;font-weight:bold;font-family:monospace;">${data.trackingCode}</span></p>
      <p style="margin:4px 0;"><strong style="color:#999;">Name:</strong> ${data.fullName}</p>
      <p style="margin:4px 0;"><strong style="color:#999;">Visa Type:</strong> ${data.visaType}</p>
      <p style="margin:4px 0;"><strong style="color:#999;">Phone:</strong> ${data.phone}</p>
      ${data.email ? `<p style="margin:4px 0;"><strong style="color:#999;">Email:</strong> ${data.email}</p>` : ""}
      <p style="margin:4px 0;"><strong style="color:#999;">Payment Method:</strong> ${data.paymentMethod}</p>
    </div>
    
    <a href="https://askmian.com/#/admin" style="display:inline-block;background:#D4AF37;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;">View in Admin Dashboard</a>
  `);

  return sendViaResend({
    to: ADMIN_EMAIL,
    subject: `ASK MIAN - New Application ${data.trackingCode} from ${data.fullName}`,
    html,
  });
}

// Status update email to customer
export async function sendStatusUpdate(data: {
  to: string;
  fullName: string;
  trackingCode: string;
  visaType: string;
  status: string;
}): Promise<{ success: boolean; error?: string }> {
  const statusMessages: Record<string, string> = {
    pending: "Your application has been received and is awaiting review.",
    processing: "Great news! Your application is now being processed by our team. We are working with UAE immigration authorities to get your visa approved.",
    completed: "Congratulations! Your visa has been approved and sent to you via email and WhatsApp. Please check your messages.",
    rejected: "We regret to inform you that your visa application was not approved by UAE immigration authorities. Our team will contact you shortly to discuss next steps and refund options.",
    documents_requested: "We need additional documents to proceed with your application. Our team will contact you via WhatsApp with specific requirements.",
  };

  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    processing: "#3b82f6",
    completed: "#22c55e",
    rejected: "#ef4444",
    documents_requested: "#f97316",
  };

  const html = baseTemplate(`
    <h2 style="color:#D4AF37;margin-top:0;">Application Status Update</h2>
    <p>Dear ${data.fullName},</p>
    <p>There has been an update to your visa application.</p>
    
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 8px;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tracking ${data.trackingCode}</p>
      <p style="margin:4px 0;color:#ccc;">${data.visaType}</p>
      <div style="display:inline-block;background:${statusColors[data.status] || "#666"}20;border:1px solid ${statusColors[data.status] || "#666"};border-radius:20px;padding:6px 16px;margin-top:12px;">
        <span style="color:${statusColors[data.status] || "#ccc"};font-weight:bold;text-transform:uppercase;font-size:12px;">${data.status.replace(/_/g, " ")}</span>
      </div>
    </div>
    
    <p>${statusMessages[data.status] || "Your application status has been updated."}</p>
    
    <p style="margin-top:20px;">You can track your application anytime:</p>
    <a href="https://askmian.com/#/track" style="display:inline-block;background:#D4AF37;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px;">Track Your Application</a>
    
    <p style="margin-top:20px;color:#999;font-size:12px;">Questions? Reply to this email or WhatsApp us at +971 55 868 9543.</p>
  `);

  return sendViaResend({
    to: data.to,
    subject: `ASK MIAN - ${data.trackingCode} Status: ${data.status.replace(/_/g, " ").toUpperCase()}`,
    html,
  });
}
