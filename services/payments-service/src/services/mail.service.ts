import nodemailer from "nodemailer";
import { env } from "@hunarbee/shared";

export interface WelcomeEmailPayload {
  to: string;
  fullName: string;
  programTitle: string;
  planLabel: string;
  preferredBatch: string;
  loginEmail: string;
  temporaryPassword: string | null;
  isNewAccount: boolean;
}

function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWelcomeHtml(payload: WelcomeEmailPayload): string {
  const portalUrl = env.PORTAL_URL || "https://portal.hunarbee.com";
  const passwordBlock = payload.isNewAccount && payload.temporaryPassword
    ? `<p style="margin:0 0 8px;"><strong>Temporary password:</strong> <code>${escapeHtml(payload.temporaryPassword)}</code></p>
       <p style="margin:0 0 16px;color:#555;font-size:13px;">Please change this password after your first login.</p>`
    : `<p style="margin:0 0 16px;color:#555;font-size:13px;">Use your existing Hunarbee portal password to sign in. If you forgot it, use “Forgot password” on the portal.</p>`;

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#0b1220;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e8eaee;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c99700;font-weight:700;">Hunarbee</p>
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">Congratulations, ${escapeHtml(payload.fullName)}!</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#445066;">
                  Your internship enrollment is confirmed. Below is your offer summary and learning portal access.
                </p>

                <div style="background:#fff8e1;border:1px solid #f5d76e;border-radius:12px;padding:16px;margin:0 0 20px;">
                  <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Offer letter</p>
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#333;">
                    We are pleased to offer you a place in the
                    <strong>${escapeHtml(payload.programTitle)}</strong> internship
                    (<strong>${escapeHtml(payload.planLabel)}</strong>), starting with preferred batch
                    <strong>${escapeHtml(payload.preferredBatch)}</strong>.
                    This email confirms your enrollment with Hunarbee.
                  </p>
                </div>

                <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Learning portal login</p>
                <p style="margin:0 0 8px;"><strong>Email / ID:</strong> ${escapeHtml(payload.loginEmail)}</p>
                ${passwordBlock}
                <p style="margin:0 0 24px;">
                  <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#f5b800;color:#0b1220;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;">
                    Open learning portal
                  </a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b778a;">
                  Portal link: ${escapeHtml(portalUrl)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Send enrollment welcome email over SMTP. Returns false if SMTP is not configured. */
export async function sendWelcomeEmail(
  payload: WelcomeEmailPayload
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    console.warn(
      "[mail] SMTP is not configured — skipping welcome email. Set SMTP_HOST/SMTP_USER/SMTP_PASS."
    );
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: payload.to,
    subject: `Congratulations — your Hunarbee ${payload.programTitle} enrollment`,
    html: buildWelcomeHtml(payload),
    text: [
      `Congratulations, ${payload.fullName}!`,
      "",
      `Your ${payload.programTitle} (${payload.planLabel}) internship enrollment is confirmed.`,
      `Preferred batch: ${payload.preferredBatch}`,
      "",
      "Learning portal login",
      `Email / ID: ${payload.loginEmail}`,
      payload.isNewAccount && payload.temporaryPassword
        ? `Temporary password: ${payload.temporaryPassword}`
        : "Use your existing portal password.",
      `Portal: ${env.PORTAL_URL}`,
    ].join("\n"),
  });

  return true;
}
