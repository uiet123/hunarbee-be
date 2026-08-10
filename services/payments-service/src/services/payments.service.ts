import crypto from "crypto";
import {
  query,
  AppError,
  env,
  toMinorUnits,
  fromMinorUnits,
  type PaymentCurrency,
  type PaymentDurationId,
} from "@hunarbee/shared";
import { razorpay } from "../lib/razorpay";
import { getCurrencyPricing, getLivePlanPrice } from "./fx.service";

interface CreateOrderInput {
  durationId: PaymentDurationId;
  currency: PaymentCurrency;
  programId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  countryIso: string;
  occupation: string;
  preferredBatch: string;
}

interface PaymentRow {
  id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount_paise: number;
  currency: string;
  status: "created" | "paid" | "failed";
  program_id: string | null;
  duration_id: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  country_iso: string | null;
  occupation: string | null;
  preferred_batch: string | null;
}

interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string | null;
        status?: string;
        amount?: number;
        currency?: string;
      };
    };
  };
}

function razorpayErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    error.error &&
    typeof error.error === "object" &&
    "description" in error.error
  ) {
    return String((error.error as { description?: string }).description);
  }
  return fallback;
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function assertWebhookSignature(rawBody: Buffer, signature?: string) {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError(
      "RAZORPAY_WEBHOOK_SECRET is not configured on the server",
      503
    );
  }
  if (!signature) {
    throw new AppError("Missing X-Razorpay-Signature header", 400);
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (!safeEqualHex(expected, signature)) {
    throw new AppError("Invalid webhook signature", 400);
  }
}

export function getPublicPaymentConfig() {
  return {
    keyId: env.RAZORPAY_KEY_ID,
  };
}

export async function getPublicPricing(currency: PaymentCurrency) {
  return getCurrencyPricing(currency);
}

export async function createPaymentOrder(input: CreateOrderInput) {
  const { amountMajor, pricing } = await getLivePlanPrice(
    input.currency,
    input.durationId
  );
  const chargeCurrency = pricing.currency;
  const amountMinor = toMinorUnits(amountMajor, chargeCurrency);
  const receipt = `hb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const contact = input.applicantPhone.trim();
  const email = input.applicantEmail.trim().toLowerCase();
  const name = input.applicantName.trim();
  const countryIso = input.countryIso.toUpperCase();

  const customer = await ensureRazorpayCustomer({ name, email, contact });

  let order: {
    id: string;
    amount: number | string;
    currency: string;
    receipt?: string | null;
    status: string;
  };

  try {
    order = await razorpay.orders.create({
      amount: amountMinor,
      currency: chargeCurrency,
      receipt,
      notes: {
        programId: input.programId,
        durationId: input.durationId,
        requestedCurrency: input.currency,
        currency: chargeCurrency,
        pricingSource: pricing.source,
        applicantEmail: email,
        applicantPhone: contact,
        countryIso,
        occupation: input.occupation,
        preferredBatch: input.preferredBatch,
      },
    });
  } catch (error) {
    console.error("[payments] Razorpay order create failed:", error);
    throw new AppError(
      razorpayErrorMessage(
        error,
        "Unable to create payment order. If using a non-INR currency, enable Razorpay International payments."
      ),
      502
    );
  }

  await query(
    `INSERT INTO payments (
      razorpay_order_id, amount_paise, currency, status,
      program_id, duration_id, applicant_name, applicant_email, applicant_phone,
      country_iso, occupation, preferred_batch, receipt
    ) VALUES ($1, $2, $3, 'created', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      order.id,
      amountMinor,
      order.currency || chargeCurrency,
      input.programId,
      input.durationId,
      name,
      email,
      contact,
      countryIso,
      input.occupation,
      input.preferredBatch,
      receipt,
    ]
  );

  return {
    orderId: order.id,
    amount: amountMinor,
    amountMajor,
    currency: order.currency || chargeCurrency,
    keyId: env.RAZORPAY_KEY_ID,
    receipt,
    durationId: input.durationId,
    pricingSource: pricing.source,
    customerId: customer?.id ?? null,
    contact,
  };
}

async function ensureRazorpayCustomer(input: {
  name?: string;
  email?: string;
  contact?: string;
}): Promise<{ id: string } | null> {
  if (!input.contact) return null;

  try {
    const customer = (await razorpay.customers.create({
      name: input.name?.trim() || "Applicant",
      email: input.email?.trim() || undefined,
      contact: input.contact,
      fail_existing: 0,
    })) as { id: string };

    await razorpay.customers.edit(customer.id, {
      name: input.name?.trim() || "Applicant",
      email: input.email?.trim() || undefined,
      contact: input.contact,
    });

    return { id: customer.id };
  } catch (error) {
    console.warn("[payments] Razorpay customer sync failed:", error);
    return null;
  }
}

async function getPaymentByOrderId(orderId: string): Promise<PaymentRow | null> {
  const existing = await query<PaymentRow>(
    `SELECT id, razorpay_order_id, razorpay_payment_id, amount_paise, currency, status,
            program_id, duration_id, applicant_name, applicant_email, applicant_phone,
            country_iso, occupation, preferred_batch::text AS preferred_batch
     FROM payments WHERE razorpay_order_id = $1`,
    [orderId]
  );
  return existing.rows[0] ?? null;
}

async function createEnrollmentFromPayment(payment: PaymentRow) {
  if (
    !payment.applicant_name ||
    !payment.applicant_email ||
    !payment.applicant_phone ||
    !payment.country_iso ||
    !payment.occupation ||
    !payment.preferred_batch ||
    !payment.program_id ||
    !payment.duration_id
  ) {
    throw new AppError(
      "Payment is missing applicant details required for enrollment",
      500
    );
  }

  const result = await query<{ id: string }>(
    `INSERT INTO enrollments (
      payment_id, full_name, email, phone, country_iso, occupation,
      preferred_batch, program_id, duration_id, currency, amount_paise, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, 'active')
    ON CONFLICT (payment_id) DO UPDATE SET updated_at = NOW()
    RETURNING id`,
    [
      payment.id,
      payment.applicant_name,
      payment.applicant_email,
      payment.applicant_phone,
      payment.country_iso,
      payment.occupation,
      payment.preferred_batch,
      payment.program_id,
      payment.duration_id,
      payment.currency,
      payment.amount_paise,
    ]
  );

  return result.rows[0]?.id ?? null;
}

async function getEnrollmentIdByPaymentId(paymentId: string) {
  const result = await query<{ id: string }>(
    `SELECT id FROM enrollments WHERE payment_id = $1 LIMIT 1`,
    [paymentId]
  );
  return result.rows[0]?.id ?? null;
}

/** Mark paid + create enrollment. Idempotent. Used only by webhooks. */
async function fulfillPaidOrder(input: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amountMinor?: number;
  currency?: string;
}) {
  const payment = await getPaymentByOrderId(input.razorpay_order_id);
  if (!payment) {
    throw new AppError("Payment order not found", 404);
  }

  if (
    typeof input.amountMinor === "number" &&
    input.amountMinor !== payment.amount_paise
  ) {
    throw new AppError("Payment amount does not match order", 400);
  }

  if (
    input.currency &&
    input.currency.toUpperCase() !== payment.currency.toUpperCase()
  ) {
    throw new AppError("Payment currency does not match order", 400);
  }

  if (payment.status !== "paid") {
    await query(
      `UPDATE payments
       SET razorpay_payment_id = $1,
           status = 'paid',
           updated_at = NOW()
       WHERE razorpay_order_id = $2 AND status <> 'paid'`,
      [input.razorpay_payment_id, input.razorpay_order_id]
    );
  } else if (!payment.razorpay_payment_id && input.razorpay_payment_id) {
    await query(
      `UPDATE payments
       SET razorpay_payment_id = $1, updated_at = NOW()
       WHERE razorpay_order_id = $2`,
      [input.razorpay_payment_id, input.razorpay_order_id]
    );
  }

  const enrollmentId = await createEnrollmentFromPayment(payment);

  return {
    orderId: input.razorpay_order_id,
    paymentId: input.razorpay_payment_id,
    enrollmentId,
    amountMajor: fromMinorUnits(payment.amount_paise, payment.currency),
    currency: payment.currency,
    programId: payment.program_id,
    durationId: payment.duration_id,
    status: "paid" as const,
  };
}

async function markPaymentFailed(input: {
  razorpay_order_id: string;
  razorpay_payment_id?: string;
}) {
  const payment = await getPaymentByOrderId(input.razorpay_order_id);
  if (!payment) {
    return { handled: false as const, reason: "order not found" };
  }

  if (payment.status === "paid") {
    return { handled: false as const, reason: "already paid" };
  }

  await query(
    `UPDATE payments
     SET status = 'failed',
         razorpay_payment_id = COALESCE($1, razorpay_payment_id),
         updated_at = NOW()
     WHERE razorpay_order_id = $2 AND status = 'created'`,
    [input.razorpay_payment_id ?? null, input.razorpay_order_id]
  );

  return {
    handled: true as const,
    orderId: input.razorpay_order_id,
    paymentId: input.razorpay_payment_id ?? null,
    status: "failed" as const,
  };
}

/** Public status for Checkout UI — polls until webhook marks paid. */
export async function getPaymentStatus(orderId: string) {
  const payment = await getPaymentByOrderId(orderId);
  if (!payment) {
    throw new AppError("Payment order not found", 404);
  }

  const enrollmentId =
    payment.status === "paid"
      ? await getEnrollmentIdByPaymentId(payment.id)
      : null;

  return {
    orderId: payment.razorpay_order_id,
    paymentId: payment.razorpay_payment_id,
    enrollmentId,
    status: payment.status,
    amountMajor: fromMinorUnits(payment.amount_paise, payment.currency),
    currency: payment.currency,
    programId: payment.program_id,
    durationId: payment.duration_id,
  };
}

/** Razorpay server webhooks — source of truth for paid/failed. */
export async function handleRazorpayWebhook(input: {
  rawBody: Buffer;
  signature: string | undefined;
  body: RazorpayWebhookBody;
}) {
  assertWebhookSignature(input.rawBody, input.signature);

  const event = input.body.event ?? "";
  const entity = input.body.payload?.payment?.entity;
  const orderId = entity?.order_id ?? undefined;
  const paymentId = entity?.id;

  if (event === "payment.captured") {
    if (!orderId || !paymentId) {
      return {
        handled: false,
        event,
        reason: "payment.captured missing order_id or payment id",
      };
    }

    if (entity?.status && entity.status !== "captured") {
      return {
        handled: false,
        event,
        reason: `payment status is ${entity.status}`,
      };
    }

    const result = await fulfillPaidOrder({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      amountMinor: typeof entity?.amount === "number" ? entity.amount : undefined,
      currency: entity?.currency,
    });

    return { handled: true, event, ...result };
  }

  if (event === "payment.failed") {
    if (!orderId) {
      return {
        handled: false,
        event,
        reason: "payment.failed missing order_id",
      };
    }

    const result = await markPaymentFailed({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
    });

    return { event, ...result };
  }

  return { handled: false, event, reason: "event ignored" };
}
