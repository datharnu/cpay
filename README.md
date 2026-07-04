# CPay

Church partnership payment tracker for the Nomba Hackathon (Team Rems).

Each partnership member gets a dedicated Nomba virtual account. Payments reconcile automatically via webhooks.

## Structure

```
cpay-api/   Express + Sequelize API (port 3001)
cpay-web/   Next.js finance dashboard (port 3000)
```

## Nomba environment

CPay uses **hackathon credentials from the Nomba onboarding email**, not personal dashboard keys.

| Credential set | `NOMBA_BASE_URL` | Use for |
|----------------|------------------|---------|
| Hackathon **TEST** | `https://sandbox.nomba.com` | Local dev (2 VA limit) |
| Hackathon **LIVE** | `https://api.nomba.com` | Render deploy + judge demo |

**Do not set `SKIP_WEBHOOK_SIGNATURE` on Render.** Set `NOMBA_WEBHOOK_SECRET` from Nomba instead — CPay verifies the `nomba-signature` HMAC on every inbound webhook.

## Quick start

### 1. API

```bash
cd cpay-api
cp .env.example .env   # add hackathon TEST credentials for local dev
npm install
npm run dev
```

### 2. Web

```bash
cd cpay-web
npm install
npm run dev
```

Open http://localhost:3000

The briefing page explains the problem; click **Open finance dashboard** for the live Nomba demo.

Optional: point the web app at a remote API:

```bash
NEXT_PUBLIC_API_URL=https://cpay-api-j4j1.onrender.com npm run dev
```

### 3. Webhooks

Point ngrok at port **3001** (CPay API) for local testing:

```bash
ngrok http 3001
```

Submit webhook URL + sub-account ID: https://forms.gle/hKfBRHZiTGvU7LC59

Set `WEBHOOK_URL` in `cpay-api/.env` (and on Render).

## Render deploy checklist

Set these in the Render dashboard (see `render.yaml` for defaults):

| Variable | Value |
|----------|--------|
| `NOMBA_BASE_URL` | `https://api.nomba.com` |
| `NOMBA_ACCOUNT_ID` | Hackathon parent account ID |
| `NOMBA_SUB_ACCOUNT_ID` | Hackathon sub-account ID |
| `NOMBA_CLIENT_ID` | Hackathon **LIVE** client ID |
| `NOMBA_CLIENT_SECRET` | Hackathon **LIVE** private key |
| `NOMBA_WEBHOOK_SECRET` | From Nomba (webhook signing key) |
| `WEBHOOK_URL` | `https://YOUR-SERVICE.onrender.com/webhooks/nomba` |
| `DATABASE_URL` | Neon Postgres connection string |

**Do not set** `SKIP_WEBHOOK_SIGNATURE`.

Health check: `GET https://cpay-api-j4j1.onrender.com/health`

## Testing payments (live demo)

Judges should use **real bank transfers to a member's Nomba virtual account**, not fake webhook POSTs.

1. Deploy the API on Render with hackathon **LIVE** credentials (see checklist above).
2. Submit the webhook URL in the hackathon form: https://forms.gle/hKfBRHZiTGvU7LC59
3. In the CPay dashboard, open a partnership member and copy their **dedicated account** (NUBAN).
4. Send **₦100** (or their monthly amount) from any Nigerian bank app to that account.
5. Nomba POSTs `payment_success` to `/webhooks/nomba` — CPay verifies the signature, reconciles, and the dashboard updates within seconds.

Overpayment alerts appear in the notification bell and as live toasts when a member pays more than their monthly commitment.

## Nomba APIs used (Virtual Accounts track)

| Nomba endpoint | Where in CPay |
|----------------|---------------|
| `POST /v1/auth/token/issue` | All Nomba calls |
| `POST /v1/auth/token/refresh` | Token cache |
| `POST /v1/accounts/virtual/{subAccountId}` | Add partner |
| `GET /v1/accounts/virtual/{identifier}` | Partner detail — verify VA |
| `GET /v1/transactions/virtual` | Partner statement + reconciliation |
| `GET /v1/transactions/accounts` | Background reconciliation (Transactions API) |
| `POST /v1/transfers/bank/lookup` | Refund — verify member bank |
| `POST /v1/transfers/bank` | Refund credit balance |
| `GET /v1/transfers/{merchantTxRef}` | Refund status |
| **Webhooks** | `/webhooks/nomba` — inbound payments (HMAC verified) |

Not used: Checkout, tokenized cards, mandates (bank-transfer track only).

## Demo flows

1. Add partner → dedicated NUBAN issued (Virtual Account API)
2. Bank transfer → Nomba webhook → ledger updated automatically
3. Partner detail → monthly ledger + overpayment resolution (Transfers API for refunds)
4. Payment history → export CSV for finance records
