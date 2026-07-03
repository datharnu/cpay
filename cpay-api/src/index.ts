import cors from "cors";
import express from "express";
import { corsOptions } from "./config/cors";
import { env } from "./config/env";
import { configureDatabase, dbKind, isDurableDatabase, sequelize } from "./db";
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
import { consolidateDuplicateOverpayments } from "./services/overpaymentConsolidation";
import { backfillPartnerPledges } from "./services/pledge";
import { Partner, Payment } from "./models";

async function main() {
  await configureDatabase();
  await sequelize.sync();
  console.log(
    `[boot] Database: ${dbKind} (${isDurableDatabase ? "durable" : "ephemeral"}) → ${env.databaseUrl}`
  );

  try {
    const backfilled = await backfillPartnerPledges();
    if (backfilled > 0) {
      console.log(`[boot] Filled pledge plans for ${backfilled} existing member(s).`);
    }
  } catch (err) {
    console.warn(
      "[boot] Could not backfill partner pledges:",
      err instanceof Error ? err.message : err
    );
  }

  let freshlySeeded = false;
  if (env.seedSandboxPartners) {
    freshlySeeded = await seedSandboxPartnersIfEmpty();
  }

  if (env.nomba.webhookUrl) {
    await syncPartnerVirtualAccountWebhooks();
  }

  // Only pull historical Nomba payments when explicitly enabled (avoids re-polluting a clean demo).
  if (freshlySeeded && process.env.IMPORT_NOMBA_ON_SEED === "true") {
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

  try {
    const consolidated = await consolidateDuplicateOverpayments();
    if (consolidated.dismissed > 0) {
      console.log(
        `[boot] Dismissed ${consolidated.dismissed} duplicate overpayment case(s) across ${consolidated.partnersAffected} member(s).`
      );
    }
  } catch (err) {
    console.warn(
      "[boot] Could not consolidate duplicate overpayments:",
      err instanceof Error ? err.message : err
    );
  }

  const app = express();

  app.use(cors(corsOptions));

  app.post(
    "/webhooks/nomba",
    express.raw({ type: "application/json" }),
    nombaWebhookHandler
  );

  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      const [partnerCount, paymentCount] = await Promise.all([
        Partner.count(),
        Payment.count(),
      ]);
      res.json({
        status: "ok",
        app: "CPay API",
        databaseKind: dbKind,
        databaseUrl: redactDatabaseUrl(env.databaseUrl),
        durableStorage: isDurableDatabase,
        persistentDisk: env.databaseUrl.startsWith("/var/data"),
        partnerCount,
        paymentCount,
      });
    } catch (err) {
      res.status(500).json({
        status: "error",
        app: "CPay API",
        databaseKind: dbKind,
        databaseUrl: redactDatabaseUrl(env.databaseUrl),
        durableStorage: isDurableDatabase,
        message: err instanceof Error ? err.message : "Health check failed",
      });
    }
  });

  app.use("/api/partners", partnersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/overpayments", overpaymentsRouter);
  app.use("/api/reconciliation", reconciliationRouter);
  // Reset + demo tools (reset-clean is secret-protected for live use).
  app.use("/api/dev", devRouter);

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

function redactDatabaseUrl(url: string): string {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    try {
      const parsed = new URL(url);
      if (parsed.password) parsed.password = "***";
      return parsed.toString();
    } catch {
      return "postgresql://***";
    }
  }
  return url;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
