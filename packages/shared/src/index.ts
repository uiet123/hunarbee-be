import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error";

/** Create a base Express app with shared middleware. */
export function createServiceApp(serviceName: string) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
      skip: () => false,
    })
  );

  app.get("/health", (_req, res) => {
    res.json({
      success: true,
      service: serviceName,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

export function startService(
  app: express.Express,
  port: number,
  serviceName: string
) {
  app.use(notFound);
  app.use(errorHandler);

  app.listen(port, () => {
    console.log(`[${serviceName}] listening on http://localhost:${port}`);
  });
}

export * from "./config/env";
export * from "./db/pool";
export * from "./middleware/auth";
export * from "./middleware/error";
export * from "./middleware/validate";
export * from "./utils/auth";
export * from "./types";
