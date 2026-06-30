# CPay

Church partnership payment tracker for the Nomba Hackathon (Team Rems).

Each partnership member gets a dedicated Nomba virtual account. Payments reconcile automatically via webhooks.

## Structure

```
cpay-api/   Express + Sequelize API (port 3001)
cpay-web/   Next.js finance dashboard (port 3000)
```

## Quick start

### 1. API

```bash
cd cpay-api
cp .env.example .env   # add Nomba TEST credentials
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

### 3. Webhooks

Point ngrok at port **3001** (CPay API):

```bash
ngrok http 3001
```

Submit webhook URL + sub-account ID: https://forms.gle/hKfBRHZiTGvU7LC59

Set `WEBHOOK_URL` in `cpay-api/.env`.

**Stop** the old `nomba-sandbox-test` server if it is still on port 3001.

### Sandbox testing (no real money)

After you have confirmed at least one real webhook end-to-end, use the simulator for day-to-day dev:

```bash
cd cpay-api
npm run simulate:webhook -- --va YOUR_PARTNER_NUBAN --amount 50
```

This POSTs a signed `payment_success` payload (`vact_transfer`) to `/webhooks/nomba` — same path Nomba uses. Set `NOMBA_WEBHOOK_SECRET` in `.env` (or leave unset to skip verification locally).

Optional: `--partner-id <uuid>` instead of `--va`, `--sender "Name"`, `--url http://localhost:3001/webhooks/nomba`.

## Nomba APIs used (Virtual Accounts track)

| Nomba endpoint | Where in CPay |
|----------------|---------------|
| `POST /v1/auth/token/issue` | All Nomba calls |
| `POST /v1/auth/token/refresh` | Token cache |
| `POST /v1/accounts/virtual/{subAccountId}` | Add partner |
| `GET /v1/accounts/virtual/{identifier}` | Partner detail — verify VA |
| `GET /v1/transactions/virtual` | Partner statement + reconciliation |
| `GET /v1/transactions/accounts` | Dashboard “Sync with Nomba” |
| `POST /v1/transfers/bank/lookup` | Refund — verify member bank |
| `POST /v1/transfers/bank` | Refund credit balance |
| `GET /v1/transfers/{merchantTxRef}` | Refund status |
| **Webhooks** | `/webhooks/nomba` — inbound payments |

Not used: Checkout, tokenized cards, mandates (bank-transfer track only).

## Demo flows

1. Add partner → dedicated NUBAN issued (Virtual Account API)
2. Payment webhook → ledger updated (Webhooks)
3. **Sync with Nomba** on dashboard (Transactions API)
4. Partner detail → **Load from Nomba Transactions API**
5. Overpayment → refund via Transfers API (when credit balance exists)
