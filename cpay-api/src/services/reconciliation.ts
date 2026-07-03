import crypto from "crypto";
import { Partner, Payment, WebhookEvent } from "../models";
import { applyPaymentToLedger, nairaToKobo } from "./ledger";
import { applyPaymentSideEffects } from "./paymentEffects";
import { findDuplicatePayment } from "./overpaymentConsolidation";
import {
  matchKnownVirtualAccount,
  parseNombaWebhookPayload,
  isCpayOutboundTransferWebhook,
} from "./webhookPayload";

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
  payload: unknown,
  rawPayload: string
): Promise<{ ok: boolean; message: string }> {
  console.log("[webhook raw]", rawPayload.slice(0, 8000));

  let fields = parseNombaWebhookPayload(payload);

  if (!fields.virtualAccountNumber) {
    const partners = await Partner.findAll();
    const known = partners
      .map((p) => p.virtualAccountNumber)
      .filter((va): va is string => Boolean(va));
    const matchedVa = matchKnownVirtualAccount(payload, known);
    if (matchedVa) {
      fields = { ...fields, virtualAccountNumber: matchedVa };
    }
  }

  const existing = await WebhookEvent.findOne({
    where: { requestId: fields.requestId },
  });
  if (existing) {
    return { ok: true, message: "duplicate ignored" };
  }

  if (isCpayOutboundTransferWebhook(payload)) {
    await WebhookEvent.create({
      requestId: fields.requestId,
      eventType: fields.eventType || "outbound_transfer",
    });
    return { ok: true, message: "ignored outbound CPay refund transfer" };
  }

  if (!PAYMENT_EVENTS.has(fields.eventType) && fields.eventType) {
    await WebhookEvent.create({
      requestId: fields.requestId,
      eventType: fields.eventType,
    });
    return { ok: true, message: `ignored event: ${fields.eventType}` };
  }

  if (!fields.virtualAccountNumber && fields.amountNaira <= 0) {
    await WebhookEvent.create({
      requestId: fields.requestId,
      eventType: fields.eventType,
    });
    console.warn("[webhook] ignored empty payload");
    return { ok: true, message: "ignored empty webhook payload" };
  }

  const duplicatePayment = await findDuplicatePayment({
    nombaTransactionId: fields.transactionId,
    sessionId: fields.sessionId,
    requestId: fields.requestId,
  });
  if (duplicatePayment) {
    await WebhookEvent.create({
      requestId: fields.requestId,
      eventType: fields.eventType,
    });
    return { ok: true, message: "duplicate nomba payment ignored" };
  }

  const amountKobo = nairaToKobo(fields.amountNaira);
  const partner = fields.virtualAccountNumber
    ? await Partner.findOne({
        where: { virtualAccountNumber: fields.virtualAccountNumber },
      })
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
    nombaTransactionId: fields.transactionId,
    sessionId: fields.sessionId,
    senderName: fields.senderName,
    virtualAccountNumber: fields.virtualAccountNumber,
    requestId: fields.requestId,
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

  await WebhookEvent.create({
    requestId: fields.requestId,
    eventType: fields.eventType,
  });

  console.log("[webhook]", fields.eventType, {
    va: fields.virtualAccountNumber,
    amountNaira: fields.amountNaira,
    partner: partner?.fullName ?? "unmatched",
  });

  return {
    ok: true,
    message: partner
      ? `payment applied to ${partner.fullName}`
      : "unmatched payment recorded",
  };
}

export async function reprocessUnmatchedPayments(): Promise<{
  fixed: number;
  skipped: number;
  purged: number;
  total: number;
}> {
  const rows = await Payment.findAll({
    where: { classification: "unmatched" },
    order: [["createdAt", "ASC"]],
  });

  let fixed = 0;
  let skipped = 0;
  let purged = 0;

  for (const payment of rows) {
    if (!payment.rawPayload) {
      skipped += 1;
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payment.rawPayload);
    } catch {
      skipped += 1;
      continue;
    }

    if (isCpayOutboundTransferWebhook(parsed)) {
      await payment.destroy();
      purged += 1;
      continue;
    }

    const fields = parseNombaWebhookPayload(parsed);
    if (!fields.virtualAccountNumber || fields.amountNaira <= 0) {
      skipped += 1;
      continue;
    }

    const partner = await Partner.findOne({
      where: { virtualAccountNumber: fields.virtualAccountNumber },
    });
    if (!partner) {
      skipped += 1;
      continue;
    }

    const amountKobo = nairaToKobo(fields.amountNaira);
    const { classification, excessKobo } = await applyPaymentToLedger(
      partner.id,
      amountKobo
    );

    payment.partnerId = partner.id;
    payment.amountKobo = amountKobo;
    payment.classification = classification;
    payment.virtualAccountNumber = fields.virtualAccountNumber;
    payment.senderName = fields.senderName;
    payment.nombaTransactionId = fields.transactionId;
    payment.sessionId = fields.sessionId;
    await payment.save();

    await applyPaymentSideEffects(
      partner.id,
      payment.id,
      classification,
      excessKobo
    );

    fixed += 1;
  }

  purged += await Payment.destroy({
    where: { classification: "unmatched", amountKobo: 0 },
  });

  return { fixed, skipped, purged, total: rows.length };
}
