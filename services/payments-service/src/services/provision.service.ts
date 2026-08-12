import crypto from "crypto";
import { query, hashPassword } from "@hunarbee/shared";
import { sendWelcomeEmail } from "./mail.service";

const PROGRAM_TITLES: Record<string, string> = {
  frontend: "Frontend Development",
  backend: "Backend Development",
  fullstack: "Full Stack Development",
};

const PLAN_LABELS: Record<string, string> = {
  "1-month": "1 Month",
  "2-months": "2 Months",
  "3-months": "3 Months",
};

interface EnrollmentRow {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  preferred_batch: string;
  program_id: string;
  duration_id: string;
  welcome_email_sent_at: string | null;
}

function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url").slice(0, 12);
}

function formatBatch(value: string): string {
  const raw = value.includes("T") ? value.slice(0, 10) : value;
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return raw;
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Ensure student user exists, link enrollment, send welcome email once.
 * Email failures are logged and do not throw (webhook must stay successful).
 */
export async function provisionEnrollmentAccess(enrollmentId: string) {
  const found = await query<EnrollmentRow>(
    `SELECT id, user_id, full_name, email,
            preferred_batch::text AS preferred_batch,
            program_id, duration_id, welcome_email_sent_at
     FROM enrollments
     WHERE id = $1`,
    [enrollmentId]
  );

  const enrollment = found.rows[0];
  if (!enrollment) {
    console.warn("[provision] Enrollment not found:", enrollmentId);
    return;
  }

  const email = enrollment.email.trim().toLowerCase();
  let userId = enrollment.user_id;
  let temporaryPassword: string | null = null;
  let isNewAccount = false;

  if (!userId) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (existing.rows[0]) {
      userId = existing.rows[0].id;
    } else {
      temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      const created = await query<{ id: string }>(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'student')
         RETURNING id`,
        [enrollment.full_name, email, passwordHash]
      );
      userId = created.rows[0]?.id ?? null;
      isNewAccount = Boolean(userId);
    }

    if (userId) {
      await query(
        `UPDATE enrollments
         SET user_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [userId, enrollment.id]
      );
    }
  }

  if (enrollment.welcome_email_sent_at) {
    return;
  }

  try {
    const sent = await sendWelcomeEmail({
      to: email,
      fullName: enrollment.full_name,
      programTitle: PROGRAM_TITLES[enrollment.program_id] ?? enrollment.program_id,
      planLabel: PLAN_LABELS[enrollment.duration_id] ?? enrollment.duration_id,
      preferredBatch: formatBatch(enrollment.preferred_batch),
      loginEmail: email,
      temporaryPassword,
      isNewAccount,
    });

    if (sent) {
      await query(
        `UPDATE enrollments
         SET welcome_email_sent_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND welcome_email_sent_at IS NULL`,
        [enrollment.id]
      );
    }
  } catch (error) {
    console.error("[provision] Welcome email failed:", error);
  }
}
