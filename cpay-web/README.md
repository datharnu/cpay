# CPay Web

Next.js finance dashboard for [CPay](../README.md) — church partnership collections via Nomba virtual accounts.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 for the judge briefing, then **Open finance dashboard** for the live demo.

Optional: point the web app at a remote API:

```bash
NEXT_PUBLIC_API_URL=https://cpay-api-j4j1.onrender.com npm run dev
```

## What you can demo

- **Dashboard** — live Nomba wallet balance, collections chart, recent webhook payments
- **Partnership members** — each member's dedicated NUBAN and monthly ledger
- **Add partner** — provisions a real Nomba virtual account
- **Overpayments** — notification + toast when excess is paid; resolve on member profile (credit or Nomba refund)
- **Payment history** — all reconciled transfers + CSV export

## Judge demo

Full setup (Nomba credentials, webhooks, live bank transfer test): see the root [README](../README.md).

Deployed API health: https://cpay-api-j4j1.onrender.com/health
