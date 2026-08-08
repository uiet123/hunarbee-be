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
    origin: env.CORS_ORIGIN,
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
});
