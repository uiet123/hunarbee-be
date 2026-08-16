import type { NextFunction, Request, Response } from "express";
import { AppError } from "./error";

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }
    
    if (req.user.role !== "admin") {
      throw new AppError("Admin access required", 403);
    }

    next();
  } catch (error) {
    next(error);
  }
}
