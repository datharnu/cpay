import crypto from "crypto";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

/** Nomba docs: eventType:requestId:userId:walletId:txId:txType:txTime:responseCode:timestamp */
export function buildNombaSignaturePayload(
  payload: unknown,
  timestamp: string
): string {
  const root = asRecord(payload) ?? {};
  const data = asRecord(root.data) ?? {};
  const merchant = asRecord(data.merchant) ?? {};
  const transaction = asRecord(data.transaction) ?? {};

  const eventType = String(root.event_type ?? root.eventType ?? "");
  const requestId = String(root.requestId ?? root.request_id ?? "");
  const userId = String(merchant.userId ?? merchant.user_id ?? "");
  const walletId = String(merchant.walletId ?? merchant.wallet_id ?? "");
  const transactionId = String(
    transaction.transactionId ?? transaction.transaction_id ?? ""
  );
  const transactionType = String(
    transaction.type ?? transaction.transactionType ?? ""
  );
  const transactionTime = String(transaction.time ?? transaction.transaction_time ?? "");

  let transactionResponseCode = String(
    transaction.responseCode ?? transaction.response_code ?? ""
  );
  if (transactionResponseCode === "null") {
    transactionResponseCode = "";
  }

  return `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${transactionResponseCode}:${timestamp}`;
}

export function computeNombaSignature(
  hashingPayload: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(hashingPayload)
    .digest("base64");
}

export function verifyNombaWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  timestamp: string | undefined
): boolean {
  if (process.env.SKIP_WEBHOOK_SIGNATURE === "true") return true;

  const secret = process.env.NOMBA_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature?.trim()) return false;

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    console.warn("[webhook] invalid JSON for signature verification");
    return false;
  }

  const root = asRecord(payload) ?? {};
  const transaction = asRecord(asRecord(root.data)?.transaction) ?? {};
  const nombaTimestamp =
    timestamp?.trim() ||
    String(transaction.time ?? transaction.transaction_time ?? "");

  if (!nombaTimestamp) {
    console.warn("[webhook] missing nomba-timestamp header");
    return false;
  }

  const hashingPayload = buildNombaSignaturePayload(payload, nombaTimestamp);
  const expected = computeNombaSignature(hashingPayload, secret);
  const provided = signature.trim();

  if (provided.toLowerCase() === expected.toLowerCase()) {
    return true;
  }

  console.warn("[webhook] signature mismatch", {
    hashingPayload: hashingPayload.slice(0, 120),
    expectedPrefix: expected.slice(0, 12),
    providedPrefix: provided.slice(0, 12),
  });
  return false;
}
