import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "./error";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "Password is required"),
});

export const PAYMENT_DURATION_IDS = ["1-month", "2-months", "3-months"] as const;

/**
 * Any ISO 4217 currency code (3 letters).
 * Country → native currency; live FX converts from INR.
 * If FX has no rate for a code, payments service falls back to USD.
 */
export type PaymentDurationId = (typeof PAYMENT_DURATION_IDS)[number];
export type PaymentCurrency = string;

export const PAYMENT_CURRENCY_REGEX = /^[A-Z]{3}$/;

export function isPaymentCurrency(value: string): value is PaymentCurrency {
  return PAYMENT_CURRENCY_REGEX.test(value);
}

/** Razorpay zero-decimal currencies (amount is major units, not *100). */
export const ZERO_DECIMAL_CURRENCIES = [
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "IDR",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
] as const;

/** Razorpay three-decimal currencies (fils / fils-like). */
export const THREE_DECIMAL_CURRENCIES = [
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
] as const;

/** Base catalog prices in INR — live FX converts from these. */
export const BASE_INR_PRICES: Record<PaymentDurationId, number> = {
  "1-month": 499,
  "2-months": 999,
  "3-months": 1499,
};

/**
 * Only fallback when ExchangeRate-API fails.
 * Prices are shown/charged in USD.
 */
export const USD_FALLBACK_PRICES: Record<PaymentDurationId, number> = {
  "1-month": 6,
  "2-months": 12,
  "3-months": 18,
};

/** Round converted major units; never charge less than 1 for non-INR. */
export function roundConvertedAmount(
  amountInr: number,
  rateFromInr: number
): number {
  const raw = amountInr * rateFromInr;
  return Math.max(1, Math.round(raw));
}

export function isZeroDecimalCurrency(currency: string): boolean {
  return (ZERO_DECIMAL_CURRENCIES as readonly string[]).includes(currency);
}

export function isThreeDecimalCurrency(currency: string): boolean {
  return (THREE_DECIMAL_CURRENCIES as readonly string[]).includes(currency);
}

/** Convert major units to Razorpay amount subunits. */
export function toMinorUnits(amount: number, currency: string = "INR"): number {
  if (isZeroDecimalCurrency(currency)) {
    return Math.round(amount);
  }
  if (isThreeDecimalCurrency(currency)) {
    return Math.round(amount * 1000);
  }
  return Math.round(amount * 100);
}

export function fromMinorUnits(
  minorAmount: number,
  currency: string = "INR"
): number {
  if (isZeroDecimalCurrency(currency)) {
    return minorAmount;
  }
  if (isThreeDecimalCurrency(currency)) {
    return minorAmount / 1000;
  }
  return minorAmount / 100;
}

export const createPaymentOrderSchema = z.object({
  durationId: z.string().trim().min(1),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAYMENT_CURRENCY_REGEX, "Invalid currency code")
    .default("INR"),
  programId: z.string().trim().min(1).max(64),
  applicantName: z.string().trim().min(2).max(120),
  applicantEmail: z.string().trim().email().max(255),
  applicantPhone: z.string().trim().min(8).max(20),
  countryIso: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Invalid country code"),
  occupation: z.string().trim().min(1).max(64),
  preferredBatch: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "preferredBatch must be YYYY-MM-DD"),
});

type Schema = z.ZodTypeAny;

export function validateBody(schema: Schema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(", ");
      next(new AppError(message, 400));
      return;
    }
    req.body = result.data;
    next();
  };
}
