/**
 * POST a signed Nomba-style payment_success webhook to CPay (sandbox testing).
 * Exercises signature verification + full reconcile path — no bank transfer needed.
 *
 * Usage:
 *   npx tsx src/scripts/simulate-webhook.ts --va 6087240289 --amount 50
 *   npx tsx src/scripts/simulate-webhook.ts --partner-id <uuid> --amount 100
 */
import "dotenv/config";
import "../models";
import { Partner } from "../models";
import { sequelize } from "../db";
import {
  buildVaFundingWebhookPayload,
  signWebhookBody,
} from "../services/reconciliation";

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  return {
    va: get("--va"),
    partnerId: get("--partner-id"),
    amountNaira: Number(get("--amount") ?? "50"),
    url: get("--url") ?? `http://localhost:${process.env.PORT ?? 3001}/webhooks/nomba`,
    sender: get("--sender") ?? "Sandbox Test Payer",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.va && !args.partnerId) {
    console.error(
      "Provide --va <accountNumber> or --partner-id <uuid>, and --amount <naira>"
    );
    process.exit(1);
  }

  if (!Number.isFinite(args.amountNaira) || args.amountNaira <= 0) {
    console.error("--amount must be a positive number (Naira)");
    process.exit(1);
  }

  let va = args.va;
  if (!va && args.partnerId) {
    const partner = await Partner.findByPk(args.partnerId);
    if (!partner?.virtualAccountNumber) {
      console.error("Partner not found or has no virtual account");
      process.exit(1);
    }
    va = partner.virtualAccountNumber;
    console.log(`Partner: ${partner.fullName}`);
  }

  const payload = buildVaFundingWebhookPayload({
    virtualAccountNumber: va!,
    amountNaira: args.amountNaira,
    senderName: args.sender,
  });

  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.NOMBA_WEBHOOK_SECRET) {
    headers["nomba-signature"] = signWebhookBody(rawBody);
  } else {
    console.warn("NOMBA_WEBHOOK_SECRET not set — server will skip signature check");
  }

  console.log(`POST ${args.url}`);
  console.log(`VA: ${va} | Amount: ₦${args.amountNaira} | requestId: ${payload.requestId}`);

  const res = await fetch(args.url, {
    method: "POST",
    headers: {
      ...headers,
    },
    body: rawBody,
  });

  const text = await res.text();
  console.log(`Response: ${res.status} ${text}`);

  if (!res.ok) {
    process.exit(1);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
