import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: path.resolve(__dirname, "../../../../.env"),
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GATEWAY_PORT: z.coerce.number().default(5000),
  AUTH_SERVICE_PORT: z.coerce.number().default(5001),
  AUTH_SERVICE_URL: z.string().default("http://localhost:5001"),
  PROGRAMS_SERVICE_PORT: z.coerce.number().default(5002),
  PROGRAMS_SERVICE_URL: z.string().default("http://localhost:5002"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
