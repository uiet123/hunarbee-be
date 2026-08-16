export interface JwtPayload {
  userId: string;
  email: string;
  role: "student" | "admin" | "mentor";
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin" | "mentor";
  created_at: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
