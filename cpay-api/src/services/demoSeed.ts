import { v4 as uuidv4 } from "uuid";
import { Partner, PartnerMonth, Payment, WebhookEvent } from "../models";
import { nairaToKobo } from "./ledger";

export async function seedDemoStory() {
  await Payment.destroy({ where: {}, force: true });
  await PartnerMonth.destroy({ where: {}, force: true });
  await WebhookEvent.destroy({ where: {}, force: true });
  await Partner.destroy({ where: {}, force: true });

  const grace = await Partner.create({
    fullName: "Sister Grace Adeyemi",
    phone: "08012345678",
    email: "grace@church.org",
    monthlyCommitmentKobo: nairaToKobo(50_000),
    pledgeTotalKobo: nairaToKobo(600_000),
    commitmentFrequency: "monthly",
    installmentCount: 12,
    accountRef: `cpay_demo_grace_${Date.now()}`,
    virtualAccountNumber: "6087240289",
    bankName: "Nombank MFB",
    bankAccountName: "Nomba/Sister Grace Partnership",
    joinedAt: new Date("2026-03-01"),
  });

  const ade = await Partner.create({
    fullName: "Brother Ade Okafor",
    phone: "08098765432",
    email: "ade@church.org",
    monthlyCommitmentKobo: nairaToKobo(30_000),
    pledgeTotalKobo: nairaToKobo(360_000),
    commitmentFrequency: "monthly",
    installmentCount: 12,
    accountRef: `cpay_demo_ade_${Date.now()}`,
    virtualAccountNumber: "5903473362",
    bankName: "Nombank MFB",
    bankAccountName: "Nomba/Brother Ade Partnership",
    joinedAt: new Date("2026-04-01"),
  });

  const graceMonths = [
    { year: 2026, month: 3, expectedKobo: nairaToKobo(50_000), paidKobo: nairaToKobo(50_000), status: "paid" as const },
    { year: 2026, month: 4, expectedKobo: nairaToKobo(50_000), paidKobo: 0, status: "missed" as const },
    { year: 2026, month: 5, expectedKobo: nairaToKobo(50_000), paidKobo: nairaToKobo(30_000), status: "partial" as const },
    { year: 2026, month: 6, expectedKobo: nairaToKobo(50_000), paidKobo: 0, status: "pending" as const },
  ];

  for (const m of graceMonths) {
    await PartnerMonth.create({ partnerId: grace.id, ...m });
  }

  const adeMonths = [
    { year: 2026, month: 4, expectedKobo: nairaToKobo(30_000), paidKobo: nairaToKobo(30_000), status: "paid" as const },
    { year: 2026, month: 5, expectedKobo: nairaToKobo(30_000), paidKobo: nairaToKobo(30_000), status: "paid" as const },
    { year: 2026, month: 6, expectedKobo: nairaToKobo(30_000), paidKobo: 0, status: "pending" as const },
  ];

  for (const m of adeMonths) {
    await PartnerMonth.create({ partnerId: ade.id, ...m });
  }

  await Payment.create({
    partnerId: grace.id,
    amountKobo: nairaToKobo(50_000),
    classification: "exact",
    virtualAccountNumber: grace.virtualAccountNumber,
    senderName: "GRACE ADEYEMI",
    nombaTransactionId: "DEMO-TX-GRACE-MAR",
    requestId: `demo_${uuidv4()}`,
    rawPayload: JSON.stringify({ demo: true, month: "March 2026" }),
  });

  await Payment.create({
    partnerId: grace.id,
    amountKobo: nairaToKobo(30_000),
    classification: "under",
    virtualAccountNumber: grace.virtualAccountNumber,
    senderName: "GRACE ADEYEMI",
    nombaTransactionId: "DEMO-TX-GRACE-MAY-PARTIAL",
    requestId: `demo_${uuidv4()}`,
    rawPayload: JSON.stringify({ demo: true, month: "May 2026 partial" }),
  });

  await Payment.create({
    partnerId: ade.id,
    amountKobo: nairaToKobo(30_000),
    classification: "exact",
    virtualAccountNumber: ade.virtualAccountNumber,
    senderName: "ADE OKAFOR",
    nombaTransactionId: "DEMO-TX-ADE-APR",
    requestId: `demo_${uuidv4()}`,
  });

  await Payment.create({
    partnerId: ade.id,
    amountKobo: nairaToKobo(30_000),
    classification: "exact",
    virtualAccountNumber: ade.virtualAccountNumber,
    senderName: "ADE OKAFOR",
    nombaTransactionId: "DEMO-TX-ADE-MAY",
    requestId: `demo_${uuidv4()}`,
  });

  await Payment.create({
    partnerId: null,
    amountKobo: nairaToKobo(50_000),
    classification: "unmatched",
    virtualAccountNumber: "1234567890",
    senderName: "UNKNOWN PAYER",
    requestId: `demo_${uuidv4()}`,
    rawPayload: JSON.stringify({ demo: true, note: "Misdirected payment" }),
  });

  return {
    graceId: grace.id,
    adeId: ade.id,
    graceAccount: grace.virtualAccountNumber,
    adeAccount: ade.virtualAccountNumber,
    graceArrearsNaira: 70_000,
    message:
      "Demo loaded: Grace has ₦70,000 arrears (missed April + partial May). 1 unmatched payment in queue.",
  };
}

export async function applyDemoCatchUp(gracePartnerId: string) {
  const partner = await Partner.findByPk(gracePartnerId);
  if (!partner) throw new Error("Partner not found");

  for (const month of [4, 5, 6]) {
    const row = await PartnerMonth.findOne({
      where: { partnerId: partner.id, year: 2026, month },
    });
    if (row) {
      row.paidKobo = row.expectedKobo;
      row.status = "paid";
      await row.save();
    }
  }

  await Payment.create({
    partnerId: partner.id,
    amountKobo: nairaToKobo(100_000),
    classification: "catch_up",
    virtualAccountNumber: partner.virtualAccountNumber,
    senderName: "GRACE ADEYEMI",
    nombaTransactionId: "DEMO-TX-GRACE-CATCHUP",
    requestId: `demo_${uuidv4()}`,
    rawPayload: JSON.stringify({ demo: true, note: "Catch-up: April + May + June" }),
  });

  return { amountNaira: 100_000, classification: "catch_up" as const };
}
