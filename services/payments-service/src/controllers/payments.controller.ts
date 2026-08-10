import type { NextFunction, Request, Response } from "express";
import { AppError, isPaymentCurrency } from "@hunarbee/shared";
import * as paymentsService from "../services/payments.service";

export async function getConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: paymentsService.getPublicPaymentConfig(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getPricing(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = String(req.query.currency ?? "INR").toUpperCase();
    if (!isPaymentCurrency(raw)) {
      throw new AppError("Invalid currency code (expected ISO 4217, e.g. JPY)", 400);
    }

    const data = await paymentsService.getPublicPricing(raw);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await paymentsService.createPaymentOrder(req.body);
    res.status(201).json({
      success: true,
      message: "Payment order created",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/** Poll after Checkout — webhook fulfills payment asynchronously. */
export async function getOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) {
      throw new AppError("Order id is required", 400);
    }

    const data = await paymentsService.getPaymentStatus(orderId);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/** Razorpay server-to-server webhook (payment.captured / payment.failed). */
export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new AppError("Raw webhook body unavailable for signature check", 400);
    }

    const data = await paymentsService.handleRazorpayWebhook({
      rawBody,
      signature: req.header("x-razorpay-signature") || undefined,
      body: req.body,
    });

    res.json({
      success: true,
      message: data.handled ? "Webhook processed" : "Webhook received",
      data,
    });
  } catch (error) {
    next(error);
  }
}
