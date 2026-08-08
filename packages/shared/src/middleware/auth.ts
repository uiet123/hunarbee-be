import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/auth";
import { AppError } from "./error";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError("Invalid or expired token", 401));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      req.user = verifyToken(header.slice(7));
    }
    next();
  } catch {
    next();
  }
}
