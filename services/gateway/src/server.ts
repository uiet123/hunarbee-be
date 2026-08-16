import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "@hunarbee/shared";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Hunarbee API Gateway is running",
    services: {
      auth: env.AUTH_SERVICE_URL,
      programs: env.PROGRAMS_SERVICE_URL,
      payments: env.PAYMENTS_SERVICE_URL,
    },
    timestamp: new Date().toISOString(),
  });
});

/** Auth microservice — /api/auth/* */
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: env.AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/auth": "" },
  })
);

/** Programs microservice — /api/programs/* */
app.use(
  "/api/programs",
  createProxyMiddleware({
    target: env.PROGRAMS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/programs": "" },
  })
);

/** Payments microservice — /api/payments/* */
app.use(
  "/api/payments",
  createProxyMiddleware({
    target: env.PAYMENTS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/payments": "" },
  })
);

/** Admin microservice — /api/admin/* */
app.use(
  "/api/admin",
  createProxyMiddleware({
    target: env.ADMIN_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/admin": "" },
  })
);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found on gateway",
  });
});

app.listen(env.GATEWAY_PORT, () => {
  console.log(`[gateway] listening on http://localhost:${env.GATEWAY_PORT}`);
  console.log(`[gateway] proxy auth -> ${env.AUTH_SERVICE_URL}`);
  console.log(`[gateway] proxy programs -> ${env.PROGRAMS_SERVICE_URL}`);
  console.log(`[gateway] proxy payments -> ${env.PAYMENTS_SERVICE_URL}`);
  console.log(`[gateway] proxy admin -> ${env.ADMIN_SERVICE_URL}`);
});
