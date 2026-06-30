type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function pickNaira(...values: unknown[]): number {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const n = typeof value === "string" ? parseFloat(value) : Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** Normalize Nomba webhook JSON into fields CPay uses for reconciliation. */
export function parseNombaWebhookPayload(payload: unknown): {
  eventType: string;
  requestId: string;
  virtualAccountNumber: string | null;
  amountNaira: number;
  senderName: string | null;
  transactionId: string | null;
  sessionId: string | null;
} {
  const root = asRecord(payload) ?? {};
  const data = asRecord(root.data) ?? {};
  const tx = asRecord(data.transaction) ?? asRecord(data.virtual_account) ?? {};
  const customer = asRecord(data.customer) ?? asRecord(data.sender) ?? {};

  const virtualAccountNumber = pickString(
    tx.aliasAccountNumber,
    tx.bankAccountNumber,
    tx.virtualAccountNumber,
    tx.accountNumber,
    data.aliasAccountNumber,
    data.bankAccountNumber,
    data.virtualAccountNumber
  );

  const amountNaira = pickNaira(
    tx.transactionAmount,
    tx.amount,
    data.transactionAmount,
    data.amount,
    root.amount
  );

  const transactionId = pickString(tx.transactionId, tx.id);
  const sessionId = pickString(tx.sessionId);

  const requestId =
    pickString(root.requestId, root.request_id, transactionId, sessionId) ??
    `nomba_${Date.now()}`;

  const eventType =
    pickString(root.event_type, root.eventType, root.type) ?? "payment_success";

  const senderName = pickString(
    customer.senderName,
    customer.accountName,
    customer.name,
    tx.senderName,
    tx.narration
  );

  return {
    eventType,
    requestId,
    virtualAccountNumber,
    amountNaira,
    senderName,
    transactionId,
    sessionId,
  };
}
