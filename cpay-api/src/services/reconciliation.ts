import crypto from "crypto";
import {
  OverpaymentCase,
  Partner,
  PartnerNotification,
  Payment,
  WebhookEvent,
} from "../models";
import { applyPaymentToLedger, nairaToKobo } from "./ledger";
import { applyPaymentSideEffects } from "./paymentEffects";

type NombaWebhookPayload = {
  event_type?: string;
  requestId?: string;
  data?: {
    transaction?: {
      type?: string;
      transactionId?: string;
      sessionId?: string;
      transactionAmount?: number;
      aliasAccountNumber?: string;
    };
    customer?: {
      senderName?: string;
    };
  };
};

const PAYMENT_EVENTS = new Set([
  "payment_success",
  "virtual_account.funded",
  "payout_success",
]);

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined
): boolean {
  if (process.env.SKIP_WEBHOOK_SIGNATURE === "true") return true;

  const secret = process.env.NOMBA_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return signature === expected;
}

export async function handleNombaWebhook(
  payload: NombaWebhookPayload,
  rawPayload: string
): Promise<{ ok: boolean; message: string }> {
  const requestId =
    payload.requestId ??
    payload.data?.transaction?.transactionId ??
    crypto.randomUUID();

  const existing = await WebhookEvent.findOne({ where: { requestId } });
  if (existing) {
    return { ok: true, message: "duplicate ignored" };
  }

  const eventType = payload.event_type ?? "payment_success";

  if (!PAYMENT_EVENTS.has(eventType) && payload.event_type) {
    await WebhookEvent.create({ requestId, eventType });
    return { ok: true, message: `ignored event: ${eventType}` };
  }

  const tx = payload.data?.transaction;
  const amountKobo = nairaToKobo(Number(tx?.transactionAmount ?? 0));
  const vaNumber = tx?.aliasAccountNumber ?? null;

  const partner = vaNumber
    ? await Partner.findOne({ where: { virtualAccountNumber: vaNumber } })
    : null;

  let classification: Payment["classification"] = "unmatched";
  let excessKobo = 0;
  if (partner && amountKobo > 0) {
    const result = await applyPaymentToLedger(partner.id, amountKobo);
    classification = result.classification;
    excessKobo = result.excessKobo;
  }

  const payment = await Payment.create({
    partnerId: partner?.id ?? null,
    amountKobo,
    classification,
    nombaTransactionId: tx?.transactionId ?? null,
    sessionId: tx?.sessionId ?? null,
    senderName: payload.data?.customer?.senderName ?? null,
    virtualAccountNumber: vaNumber,
    requestId,
    rawPayload,
  });

  if (partner) {
    await applyPaymentSideEffects(
      partner.id,
      payment.id,
      classification,
      excessKobo
    );
  }

  await WebhookEvent.create({ requestId, eventType });

  return {
    ok: true,
    message: partner
      ? `payment applied to ${partner.fullName}`
      : "unmatched payment recorded",
  };
}
