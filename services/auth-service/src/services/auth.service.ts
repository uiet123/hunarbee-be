import { query, AppError, hashPassword, comparePassword, signToken } from "@hunarbee/shared";
import type { AuthUser } from "@hunarbee/shared";

interface UserRow extends AuthUser {
  password_hash: string;
}

function toPublicUser(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [input.email.toLowerCase()]
  );

  if (existing.rows[0]) {
    throw new AppError("Email is already registered", 409);
  }

  const passwordHash = await hashPassword(input.password);

  const inserted = await query<AuthUser>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role, created_at`,
    [input.name, input.email.toLowerCase(), passwordHash]
  );

  const user = inserted.rows[0];
  if (!user) {
    throw new AppError("Failed to create user", 500);
  }

  const token = signToken({ userId: user.id, email: user.email });
  return { user: toPublicUser(user), token };
}

export async function loginUser(input: { email: string; password: string }) {
  const result = await query<UserRow>(
    `SELECT id, name, email, role, password_hash, created_at
     FROM users WHERE email = $1`,
    [input.email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await comparePassword(input.password, user.password_hash);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = signToken({ userId: user.id, email: user.email });
  return { user: toPublicUser(user), token };
}

/** Student portal login — only student (and admin) roles. */
export async function loginPortalUser(input: {
  email: string;
  password: string;
}) {
  const data = await loginUser(input);
  if (data.user.role !== "student" && data.user.role !== "admin") {
    throw new AppError("This portal is for Hunarbee students", 403);
  }
  return data;
}

export async function getUserById(userId: string) {
  const result = await query<AuthUser>(
    `SELECT id, name, email, role, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return toPublicUser(user);
}

export interface PortalEnrollment {
  id: string;
  programId: string;
  durationId: string;
  preferredBatch: string;
  status: string;
  currency: string;
  amountPaise: number;
  createdAt: string;
}

/** Student home: profile + enrollments. */
export async function getPortalHome(userId: string) {
  const user = await getUserById(userId);

  if (user.role !== "student" && user.role !== "admin") {
    throw new AppError("This portal is for Hunarbee students", 403);
  }

  const enrollments = await query<{
    id: string;
    program_id: string;
    duration_id: string;
    preferred_batch: string;
    status: string;
    currency: string;
    amount_paise: number;
    created_at: string;
  }>(
    `SELECT id, program_id, duration_id,
            preferred_batch::text AS preferred_batch,
            status, currency, amount_paise, created_at
     FROM enrollments
     WHERE user_id = $1 OR lower(email) = lower($2)
     ORDER BY created_at DESC`,
    [userId, user.email]
  );

  return {
    user,
    enrollments: enrollments.rows.map(
      (row): PortalEnrollment => ({
        id: row.id,
        programId: row.program_id,
        durationId: row.duration_id,
        preferredBatch: row.preferred_batch,
        status: row.status,
        currency: row.currency,
        amountPaise: row.amount_paise,
        createdAt: row.created_at,
      })
    ),
  };
}
