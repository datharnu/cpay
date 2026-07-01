import { env } from "../config/env";

type TokenCache = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

let cache: TokenCache | null = null;

type NombaResponse<T> = {
  code?: string;
  description?: string;
  message?: string;
  data?: T;
};

async function parseNombaJson<T>(res: Response): Promise<NombaResponse<T>> {
  return res.json() as Promise<NombaResponse<T>>;
}

function nombaErrorMessage(
  json: NombaResponse<unknown>,
  path: string,
  status: number
): string {
  if (json.description) return json.description;
  if (json.message) return json.message;
  const data = json.data as { description?: string; message?: string } | undefined;
  if (data?.description) return data.description;
  if (data?.message) return data.message;
  return `Nomba request failed (${status}): ${path}`;
}

function assertNombaSuccess<T>(json: NombaResponse<T>, path: string): void {
  if (json.code && json.code !== "00" && json.code !== "200") {
    throw new Error(nombaErrorMessage(json, path, 200));
  }
}

export async function getNombaToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt - 5 * 60 * 1000) {
    return cache.accessToken;
  }
  return issueToken();
}

async function issueToken(): Promise<string> {
  const res = await fetch(`${env.nomba.baseUrl}/v1/auth/token/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accountId: env.nomba.accountId,
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.nomba.clientId,
      client_secret: env.nomba.clientSecret,
    }),
  });

  const json = await parseNombaJson<{
    access_token: string;
    refresh_token?: string;
    expiresAt?: string;
  }>(res);

  if (!res.ok || !json.data?.access_token) {
    throw new Error(`Nomba auth failed: ${json.description ?? res.statusText}`);
  }

  const expiresAt = json.data.expiresAt
    ? new Date(json.data.expiresAt).getTime()
    : Date.now() + 55 * 60 * 1000;

  cache = {
    accessToken: json.data.access_token,
    refreshToken: json.data.refresh_token,
    expiresAt,
  };
  return cache.accessToken;
}

/** POST /v1/auth/token/refresh */
export async function refreshNombaToken(): Promise<string> {
  if (!cache?.refreshToken) {
    return issueToken();
  }

  const res = await fetch(`${env.nomba.baseUrl}/v1/auth/token/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accountId: env.nomba.accountId,
      Authorization: `Bearer ${cache.accessToken}`,
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: cache.refreshToken,
    }),
  });

  const json = await parseNombaJson<{
    access_token: string;
    refresh_token?: string;
    expiresAt?: string;
  }>(res);

  if (!res.ok || !json.data?.access_token) {
    return issueToken();
  }

  cache = {
    accessToken: json.data.access_token,
    refreshToken: json.data.refresh_token ?? cache.refreshToken,
    expiresAt: json.data.expiresAt
      ? new Date(json.data.expiresAt).getTime()
      : Date.now() + 55 * 60 * 1000,
  };
  return cache.accessToken;
}

export async function nombaRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<NombaResponse<T>> {
  const token = await getNombaToken();
  const res = await fetch(`${env.nomba.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      accountId: env.nomba.accountId,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const json = await parseNombaJson<T>(res);

  if (!res.ok) {
    throw new Error(nombaErrorMessage(json, path, res.status));
  }

  assertNombaSuccess(json, path);
  return json;
}

export type VirtualAccountResult = {
  bankAccountNumber: string;
  bankAccountName: string;
  bankName: string;
  accountRef: string;
};

/** POST /v1/accounts/virtual/{subAccountId} */
export async function createVirtualAccount(input: {
  accountRef: string;
  accountName: string;
}): Promise<VirtualAccountResult> {
  const body: Record<string, string> = {
    accountRef: input.accountRef,
    accountName: input.accountName,
    currency: "NGN",
  };

  if (env.nomba.webhookUrl) {
    body.callbackUrl = env.nomba.webhookUrl;
  }

  const json = await nombaRequest<VirtualAccountResult>(
    `/v1/accounts/virtual/${env.nomba.subAccountId}`,
    { method: "POST", body: JSON.stringify(body) }
  );

  if (!json.data?.bankAccountNumber) {
    throw new Error("VA creation failed: no account number returned");
  }

  return json.data;
}

/** GET /v1/accounts/virtual/{identifier} */
export async function fetchVirtualAccount(identifier: string) {
  return nombaRequest<Record<string, unknown>>(
    `/v1/accounts/virtual/${identifier}`
  );
}

/** POST /v1/accounts/virtual/list */
export async function listVirtualAccounts(filters?: {
  accountRef?: string;
  bankAccountNumber?: string;
}) {
  return nombaRequest<{ results: unknown[] }>("/v1/accounts/virtual/list", {
    method: "POST",
    body: JSON.stringify(filters ?? {}),
  });
}

export type NombaVirtualTransaction = {
  id?: string;
  transactionId?: string;
  sessionId?: string;
  status?: string;
  amount?: string;
  transactionAmount?: string;
  senderName?: string;
  aliasAccountNumber?: string;
  recipientAccountNumber?: string;
  bankAccountNumber?: string;
  virtualAccountNumber?: string;
  entryType?: string;
  type?: string;
  transactionType?: string;
  timeCreated?: string;
};

/** GET /v1/transactions/virtual */
export async function fetchVirtualAccountTransactions(
  virtualAccount: string,
  dateFrom?: string,
  dateTo?: string
) {
  const params = new URLSearchParams({ virtual_account: virtualAccount });
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  return nombaRequest<{
    results: NombaVirtualTransaction[];
    cursor?: string;
  }>(`/v1/transactions/virtual?${params.toString()}`);
}

/** GET /v1/transactions/accounts — parent account transactions */
export async function fetchAccountTransactions(
  dateFrom?: string,
  dateTo?: string,
  limit = 100
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  return nombaRequest<{ results: NombaVirtualTransaction[] }>(
    `/v1/transactions/accounts?${params.toString()}`
  );
}

/** GET /v1/transactions/accounts/{subAccountId} — VA inbound payments land here */
export async function fetchSubAccountTransactions(
  dateFrom?: string,
  dateTo?: string,
  limit = 200
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  return nombaRequest<{ results: NombaVirtualTransaction[] }>(
    `/v1/transactions/accounts/${env.nomba.subAccountId}?${params.toString()}`
  );
}

/** PUT /v1/accounts/virtual/{identifier} — update callback URL, name, etc. */
export async function updateVirtualAccount(
  identifier: string,
  input: { callbackUrl?: string; accountName?: string; newAccountRef?: string }
) {
  return nombaRequest<{ updated?: boolean }>(
    `/v1/accounts/virtual/${identifier}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}

/** GET /v1/transactions/requery/{sessionId} */
export async function requeryTransaction(sessionId: string) {
  return nombaRequest<Record<string, unknown>>(
    `/v1/transactions/requery/${sessionId}`
  );
}

export type NombaBank = {
  code: string;
  name: string;
};

/** GET /v1/transfers/banks */
export async function listBanks(): Promise<NombaBank[]> {
  const json = await nombaRequest<{ results: NombaBank[] } | NombaBank[]>(
    "/v1/transfers/banks",
    { method: "GET" }
  );

  const raw = json.data;
  const banks = Array.isArray(raw) ? raw : (raw?.results ?? []);

  return banks
    .filter((bank) => bank.code && bank.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** POST /v1/transfers/bank/lookup */
export async function lookupBankAccount(bankCode: string, accountNumber: string) {
  const json = await nombaRequest<{ accountName: string; accountNumber: string }>(
    "/v1/transfers/bank/lookup",
    {
      method: "POST",
      body: JSON.stringify({ bankCode, accountNumber }),
    }
  );

  if (!json.data?.accountName) {
    throw new Error("Bank lookup failed: account name not returned");
  }

  return json.data;
}

/** POST /v2/transfers/bank/{subAccountId} — refund from hackathon sub-account balance */
export async function sendBankTransfer(input: {
  amountKobo: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  merchantTxRef: string;
  narration: string;
  senderName?: string;
}) {
  // Nomba v2 bank transfers expect amount in naira (not kobo). CPay stores money in kobo internally.
  const amountNaira = input.amountKobo / 100;
  return nombaRequest<Record<string, unknown>>(
    `/v2/transfers/bank/${env.nomba.subAccountId}`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: amountNaira,
        bankCode: input.bankCode,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
        merchantTxRef: input.merchantTxRef,
        narration: input.narration,
        senderName: input.senderName ?? "CPay Church Finance",
      }),
    }
  );
}

/** GET /v1/transfers/{merchantTxRef} */
export async function getTransferStatus(merchantTxRef: string) {
  return nombaRequest<Record<string, unknown>>(
    `/v1/transfers/${encodeURIComponent(merchantTxRef)}`
  );
}
