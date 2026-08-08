import { Router } from "express";
import {
  requireAuth,
  validateBody,
  registerSchema,
  loginSchema,
} from "@hunarbee/shared";
import * as authController from "../controllers/auth.controller";

const router = Router();

router.post("/register", validateBody(registerSchema), authController.register);
router.post("/login", validateBody(loginSchema), authController.login);
router.get("/me", requireAuth, authController.me);

export default router;
