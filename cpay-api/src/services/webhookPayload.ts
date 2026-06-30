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

function collectRecords(value: unknown, out: JsonRecord[] = []): JsonRecord[] {
  const record = asRecord(value);
  if (!record) return out;

  out.push(record);
  for (const child of Object.values(record)) {
    if (child && typeof child === "object") {
      collectRecords(child, out);
    }
  }
  return out;
}

function pickFromRecords(
  records: JsonRecord[],
  keys: string[]
): string | null {
  for (const record of records) {
    for (const key of keys) {
      const value = pickString(record[key]);
      if (value) return value;
    }
  }
  return null;
}

function pickAmountFromRecords(records: JsonRecord[]): number {
  const keys = [
    "transactionAmount",
    "transaction_amount",
    "amount",
    "amountReceived",
    "amount_received",
  ];

  for (const record of records) {
    for (const key of keys) {
      const raw = record[key];
      const n = pickNaira(raw);
      if (n > 0) {
        if (
          typeof raw === "string" &&
          /^\d+$/.test(raw) &&
          n >= 1000 &&
          n % 100 === 0
        ) {
          const asKobo = n / 100;
          if (asKobo > 0 && asKobo <= 150) return asKobo;
        }
        return n;
      }
    }
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
  const records = collectRecords(payload);

  const virtualAccountNumber = pickFromRecords(records, [
    "aliasAccountNumber",
    "alias_account_number",
    "bankAccountNumber",
    "bank_account_number",
    "virtualAccountNumber",
    "virtual_account_number",
    "accountNumber",
    "account_number",
    "customerBillerId",
  ]);

  const amountNaira = pickAmountFromRecords(records);

  const transactionId = pickFromRecords(records, [
    "transactionId",
    "transaction_id",
    "id",
  ]);
  const sessionId = pickFromRecords(records, ["sessionId", "session_id"]);

  const requestId =
    pickString(
      root.requestId,
      root.request_id,
      transactionId,
      sessionId
    ) ?? `nomba_${Date.now()}`;

  const eventType =
    pickString(root.event_type, root.eventType, root.type) ??
    "payment_success";

  const senderName = pickFromRecords(records, [
    "senderName",
    "sender_name",
    "accountName",
    "account_name",
    "name",
    "narration",
  ]);

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

/** Last resort: find a known partner VA anywhere in the webhook JSON blob. */
export function matchKnownVirtualAccount(
  payload: unknown,
  knownAccounts: string[]
): string | null {
  const blob = JSON.stringify(payload);
  for (const account of knownAccounts) {
    if (account && blob.includes(account)) return account;
  }
  return null;
}
