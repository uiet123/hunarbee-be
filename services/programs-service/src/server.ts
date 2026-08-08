import { createServiceApp, startService, env } from "@hunarbee/shared";
import programsRoutes from "./routes/programs.routes";

const app = createServiceApp("programs-service");

app.use("/", programsRoutes);

startService(app, env.PROGRAMS_SERVICE_PORT, "programs-service");
