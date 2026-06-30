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

Set `WEBHOOK_URL` in `cpay-api/.env` (and on Render).

**Stop** the old `nomba-sandbox-test` server if it is still on port 3001.

### Testing payments (real sandbox transfers)

Judges and demos should use **real Nomba sandbox bank transfers**, not fake webhook POSTs.

1. Deploy the API with a stable URL (e.g. Render) and set:
   - `WEBHOOK_URL=https://YOUR-API.onrender.com/webhooks/nomba`
   - `NOMBA_WEBHOOK_SECRET` from the Nomba dashboard (if provided)
2. Submit the same webhook URL in the hackathon form: https://forms.gle/hKfBRHZiTGvU7LC59
3. In the CPay dashboard, open a partnership member and copy their **dedicated account** (NUBAN).
4. Send **₦100** (or their monthly amount) from the Nomba sandbox transfer flow to that account.
5. Nomba POSTs `payment_success` to `/webhooks/nomba` — CPay reconciles automatically.

If a transfer cleared in Nomba but the dashboard is slow to update, use **Import from Nomba** or **Sync with Nomba** on the home page.

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
