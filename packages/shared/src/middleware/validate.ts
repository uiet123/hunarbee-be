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
