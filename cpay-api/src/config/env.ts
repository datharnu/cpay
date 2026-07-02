import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "./cpay.sqlite",
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  /** Allow any https://*.vercel.app origin (preview + production deploys). */
  corsAllowVercel: process.env.CORS_ALLOW_VERCEL !== "false",
  seedSandboxPartners: process.env.SEED_SANDBOX_PARTNERS === "true",
  nomba: {
    accountId: required("NOMBA_ACCOUNT_ID"),
    subAccountId: required("NOMBA_SUB_ACCOUNT_ID"),
    clientId: required("NOMBA_CLIENT_ID"),
    clientSecret: required("NOMBA_CLIENT_SECRET"),
    webhookSecret: process.env.NOMBA_WEBHOOK_SECRET ?? "",
    baseUrl: process.env.NOMBA_BASE_URL ?? "https://sandbox.nomba.com",
    webhookUrl: process.env.WEBHOOK_URL ?? "",
  },
};
