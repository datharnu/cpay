import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { configureSqlite, sequelize } from "./db";
import "./models";
import { dashboardRouter } from "./routes/dashboard";
import { devRouter } from "./routes/dev";
import { notificationsRouter } from "./routes/notifications";
import { overpaymentsRouter } from "./routes/overpayments";
import { partnersRouter } from "./routes/partners";
import { paymentsRouter } from "./routes/payments";
import { reconciliationRouter } from "./routes/reconciliation";
import { nombaWebhookHandler } from "./routes/webhooks";
import { seedSandboxPartnersIfEmpty } from "./services/seedSandboxPartners";
import { syncPartnerVirtualAccountWebhooks } from "./services/syncPartnerWebhooks";
import { importMissingNombaPayments } from "./services/importNombaPayments";

async function main() {
  await configureSqlite();
  await sequelize.sync();

  let freshlySeeded = false;
  if (env.seedSandboxPartners) {
    freshlySeeded = await seedSandboxPartnersIfEmpty();
  }

  if (env.nomba.webhookUrl) {
    await syncPartnerVirtualAccountWebhooks();
  }

  if (freshlySeeded) {
    try {
      const result = await importMissingNombaPayments();
      console.log(
        `[boot import] Restored ${result.imported} payment(s) from Nomba sub-account (${result.skipped} skipped).`
      );
    } catch (err) {
      console.warn(
        "[boot import] Could not import Nomba payments on startup:",
        err instanceof Error ? err.message : err
      );
    }
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
  app.use("/api/payments", paymentsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/notifications", notificationsRouter);
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
