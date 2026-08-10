import { Router } from "express";
import { validateBody, createPaymentOrderSchema } from "@hunarbee/shared";
import * as paymentsController from "../controllers/payments.controller";

const router = Router();

router.get("/config", paymentsController.getConfig);
router.get("/pricing", paymentsController.getPricing);

router.post(
  "/orders",
  validateBody(createPaymentOrderSchema),
  paymentsController.createOrder
);

/** Frontend polls this after Checkout until webhook marks paid/failed */
router.get("/orders/:orderId", paymentsController.getOrderStatus);

/** Razorpay webhooks — source of truth for enrollment */
router.post("/webhook", paymentsController.handleWebhook);

export default router;
