import {
  createServiceApp,
  startService,
  env,
  pool,
} from "@hunarbee/shared";
import paymentsRoutes from "./routes/payments.routes";

async function bootstrap() {
  const app = createServiceApp("payments-service");

  app.use("/", paymentsRoutes);

  try {
    await pool.query("SELECT 1");
    console.log("[payments-service] PostgreSQL connected");
  } catch (error) {
    console.warn("[payments-service] PostgreSQL connection failed:", error);
  }

  startService(app, env.PAYMENTS_SERVICE_PORT, "payments-service");
}

bootstrap();
