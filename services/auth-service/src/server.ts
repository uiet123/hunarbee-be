import {
  createServiceApp,
  startService,
  env,
  pool,
} from "@hunarbee/shared";
import authRoutes from "./routes/auth.routes";

async function bootstrap() {
  const app = createServiceApp("auth-service");

  app.use("/", authRoutes);

  try {
    await pool.query("SELECT 1");
    console.log("[auth-service] PostgreSQL connected");
  } catch (error) {
    console.warn("[auth-service] PostgreSQL connection failed:", error);
  }

  startService(app, env.AUTH_SERVICE_PORT, "auth-service");
}

bootstrap();
