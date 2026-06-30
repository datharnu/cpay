import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { sequelize } from "./db";
import "./models";
import { dashboardRouter } from "./routes/dashboard";
import { devRouter } from "./routes/dev";
import { overpaymentsRouter } from "./routes/overpayments";
import { partnersRouter } from "./routes/partners";
import { reconciliationRouter } from "./routes/reconciliation";
import { nombaWebhookHandler } from "./routes/webhooks";
import { seedSandboxPartnersIfEmpty } from "./services/seedSandboxPartners";

async function main() {
  await sequelize.sync();

  if (env.seedSandboxPartners) {
    await seedSandboxPartnersIfEmpty();
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
