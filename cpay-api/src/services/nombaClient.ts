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
    throw new Error(
      json.description ?? json.message ?? `Nomba request failed: ${path}`
    );
  }

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
  transactionId?: string;
  sessionId?: string;
  status?: string;
  amount?: string;
  senderName?: string;
  aliasAccountNumber?: string;
  entryType?: string;
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
  dateTo?: string
) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const qs = params.toString();
  return nombaRequest<{ results: NombaVirtualTransaction[] }>(
    `/v1/transactions/accounts${qs ? `?${qs}` : ""}`
  );
}

/** GET /v1/transactions/requery/{sessionId} */
export async function requeryTransaction(sessionId: string) {
  return nombaRequest<Record<string, unknown>>(
    `/v1/transactions/requery/${sessionId}`
  );
}

/** POST /v1/transfers/bank/lookup */
export async function lookupBankAccount(bankCode: string, accountNumber: string) {
  return nombaRequest<{ accountName: string; accountNumber: string }>(
    "/v1/transfers/bank/lookup",
    {
      method: "POST",
      body: JSON.stringify({ bankCode, accountNumber }),
    }
  );
}

/** POST /v1/transfers/bank — refund overpayment / payout */
export async function sendBankTransfer(input: {
  amountKobo: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  merchantTxRef: string;
  narration: string;
  senderName?: string;
}) {
  return nombaRequest<Record<string, unknown>>("/v1/transfers/bank", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountKobo,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      merchantTxRef: input.merchantTxRef,
      narration: input.narration,
      senderName: input.senderName ?? "CPay Church Finance",
    }),
  });
}

/** GET /v1/transfers/{merchantTxRef} */
export async function getTransferStatus(merchantTxRef: string) {
  return nombaRequest<Record<string, unknown>>(
    `/v1/transfers/${encodeURIComponent(merchantTxRef)}`
  );
}
