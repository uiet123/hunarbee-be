import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, errorHandler } from "@hunarbee/shared";
import adminRoutes from "./routes/admin.routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/", adminRoutes);

app.use(errorHandler);

app.listen(env.ADMIN_SERVICE_PORT, () => {
  console.log(
    `[admin-service] listening on http://localhost:${env.ADMIN_SERVICE_PORT}`
  );
});
