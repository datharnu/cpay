import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { configureSqlite, sequelize } from "./db";
import "./models";
import { dashboardRouter } from "./routes/dashboard";
import { devRouter } from "./routes/dev";
import { overpaymentsRouter } from "./routes/overpayments";
import { partnersRouter } from "./routes/partners";
import { reconciliationRouter } from "./routes/reconciliation";
import { nombaWebhookHandler } from "./routes/webhooks";
import { seedSandboxPartnersIfEmpty } from "./services/seedSandboxPartners";
import { auditSandboxWebhookSetup } from "./services/auditSandboxWebhook";

async function main() {
  await configureSqlite();
  await sequelize.sync();

  if (env.seedSandboxPartners) {
    await seedSandboxPartnersIfEmpty();
    await auditSandboxWebhookSetup();
  }

  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins,
    })
  );

  app.post(
    "/webhooks/nomba",
    express.raw({ type: "application/json" }),
    nombaWebhookHandler
  );

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", app: "CPay API" });
  });

  app.use("/api/partners", partnersRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/overpayments", overpaymentsRouter);
  app.use("/api/reconciliation", reconciliationRouter);

  if (process.env.NODE_ENV !== "production") {
    app.use("/api/dev", devRouter);
  }

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[api error]", err);
      res.status(500).json({
        message: err instanceof Error ? err.message : "Internal server error",
      });
    }
  );

  app.listen(env.port, () => {
    const webhookPath = "/webhooks/nomba";
    const publicWebhook = env.nomba.webhookUrl || `(set WEBHOOK_URL)${webhookPath}`;
    console.log(`CPay API running on port ${env.port}`);
    console.log(`Webhook: ${publicWebhook}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
