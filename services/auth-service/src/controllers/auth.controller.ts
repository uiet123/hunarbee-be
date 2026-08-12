import type { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await authService.registerUser(req.body);
    res.status(201).json({
      success: true,
      message: "Registered successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await authService.loginUser(req.body);
    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function portalLogin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await authService.loginPortalUser(req.body);
    res.status(200).json({
      success: true,
      message: "Welcome to your internship portal",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await authService.getUserById(userId);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function portalHome(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const data = await authService.getPortalHome(userId);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
