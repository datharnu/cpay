import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Partner, PartnerMonth, Payment, OverpaymentCase, PartnerNotification } from "../models";
import { createVirtualAccount, fetchVirtualAccount } from "../services/nombaClient";
import {
  ensurePartnerMonths,
  formatNaira,
  getPartnerSummary,
  koboToNaira,
  nairaToKobo,
} from "../services/ledger";
import { settleAllPendingRefunds, trySettleOverpaymentRefund } from "../services/refundSettlement";

export const partnersRouter = Router();

function sortByNewest(
  a: { createdAt?: Date | string | null },
  b: { createdAt?: Date | string | null }
): number {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tb - ta;
}

const createPartnerSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  monthlyCommitment: z.number().positive(),
});

partnersRouter.get("/", async (_req, res) => {
  const partners = await Partner.findAll({ order: [["createdAt", "DESC"]] });
  const enriched = await Promise.all(
    partners.map(async (p) => {
      await ensurePartnerMonths(p);
      const summary = await getPartnerSummary(p.id);
      return {
        id: p.id,
        fullName: p.fullName,
        phone: p.phone,
        email: p.email,
        monthlyCommitment: koboToNaira(p.monthlyCommitmentKobo),
        virtualAccountNumber: p.virtualAccountNumber,
        bankName: p.bankName,
        bankAccountName: p.bankAccountName,
        creditBalance: koboToNaira(p.creditBalanceKobo ?? 0),
        status: p.status,
        arrears: summary ? koboToNaira(summary.arrearsKobo) : 0,
        monthsPaid: summary?.monthsPaid ?? 0,
        monthsMissed: summary?.monthsMissed ?? 0,
      };
    })
  );
  res.json({ data: enriched });
});

partnersRouter.get("/:id", async (req, res) => {
  const partner = await Partner.findByPk(req.params.id, {
    include: [
      { model: PartnerMonth, as: "months" },
      { model: Payment, as: "payments" },
      {
        model: OverpaymentCase,
        as: "overpayments",
        include: [{ model: Payment, as: "payment" }],
      },
      { model: PartnerNotification, as: "notifications" },
    ],
  });

  if (!partner) {
    res.status(404).json({ message: "Partner not found" });
    return;
  }

  await ensurePartnerMonths(partner);

  const overpaymentRows =
    (partner as Partner & { overpayments?: OverpaymentCase[] }).overpayments ?? [];
  for (const row of overpaymentRows) {
    if (row.status === "refund_pending") {
      await trySettleOverpaymentRefund(row);
    }
  }

  const summary = await getPartnerSummary(partner.id);

  let nombaVaStatus: { verified: boolean; expired?: boolean } | null = null;
  if (partner.virtualAccountNumber) {
    try {
      const va = await fetchVirtualAccount(partner.virtualAccountNumber);
      nombaVaStatus = {
        verified: true,
        expired: Boolean((va.data as { expired?: boolean })?.expired),
      };
    } catch {
      nombaVaStatus = { verified: false };
    }
  }

  const months = ((partner as Partner & { months?: PartnerMonth[] }).months ?? [])
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((m) => ({
      year: m.year,
      month: m.month,
      expected: koboToNaira(m.expectedKobo),
      paid: koboToNaira(m.paidKobo),
      status: m.status,
      label: new Date(m.year, m.month - 1).toLocaleString("en-NG", {
        month: "short",
        year: "numeric",
      }),
    }));

  const payments = ((partner as Partner & { payments?: Payment[] }).payments ?? [])
    .sort((a, b) =>
      sortByNewest(
        a as Payment & { createdAt?: Date },
        b as Payment & { createdAt?: Date }
      )
    )
    .map((p) => ({
      id: p.id,
      amount: koboToNaira(p.amountKobo),
      classification: p.classification,
      senderName: p.senderName,
      nombaTransactionId: p.nombaTransactionId,
      createdAt: (p as Payment & { createdAt?: Date }).createdAt ?? null,
    }));

  const overpayments = (
    (partner as Partner & { overpayments?: OverpaymentCase[] }).overpayments ?? []
  )
    .sort((a, b) =>
      sortByNewest(
        a as OverpaymentCase & { createdAt?: Date },
        b as OverpaymentCase & { createdAt?: Date }
      )
    )
    .map((c) => ({
      id: c.id,
      paymentId: c.paymentId,
      excess: koboToNaira(c.excessKobo),
      status: c.status,
      choice: c.choice,
      merchantTxRef: c.merchantTxRef,
      refundAccountName: c.refundAccountName,
      refundAccountNumber: c.refundAccountNumber,
      createdAt: (c as OverpaymentCase & { createdAt?: Date }).createdAt ?? null,
    }));

  const notifications = (
    (partner as Partner & { notifications?: PartnerNotification[] }).notifications ?? []
  )
    .sort((a, b) => b.id.localeCompare(a.id))
    .map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: (n as PartnerNotification & { createdAt?: Date }).createdAt ?? null,
    }));

  res.json({
    data: {
      id: partner.id,
      fullName: partner.fullName,
      phone: partner.phone,
      email: partner.email,
      monthlyCommitment: koboToNaira(partner.monthlyCommitmentKobo),
      virtualAccountNumber: partner.virtualAccountNumber,
      bankName: partner.bankName,
      bankAccountName: partner.bankAccountName,
      creditBalance: koboToNaira(partner.creditBalanceKobo ?? 0),
      arrears: summary ? koboToNaira(summary.arrearsKobo) : 0,
      nombaVaStatus,
      months,
      payments,
      overpayments,
      notifications,
    },
  });
});

partnersRouter.post("/", async (req, res) => {
  const parsed = createPartnerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const { fullName, phone, email, monthlyCommitment } = parsed.data;
  const accountRef = `cpay_${uuidv4().replace(/-/g, "").slice(0, 24)}`;

  const partner = await Partner.create({
    fullName,
    phone,
    email: email ?? null,
    monthlyCommitmentKobo: nairaToKobo(monthlyCommitment),
    accountRef,
  });

  try {
    const va = await createVirtualAccount({
      accountRef,
      accountName: `${fullName} Partnership`,
    });

    partner.virtualAccountNumber = va.bankAccountNumber;
    partner.bankName = va.bankName;
    partner.bankAccountName = va.bankAccountName;
    await partner.save();
  } catch (err) {
    await partner.destroy();
    res.status(502).json({
      message:
        err instanceof Error && err.message.includes("2 sandbox")
          ? "Sandbox limit reached (max 2 virtual accounts). Use your existing Nomba VAs or delete a partner first."
          : err instanceof Error
            ? err.message
            : "Nomba VA creation failed",
    });
    return;
  }

  await ensurePartnerMonths(partner);

  res.status(201).json({
    data: {
      id: partner.id,
      fullName: partner.fullName,
      monthlyCommitment,
      virtualAccountNumber: partner.virtualAccountNumber,
      bankName: partner.bankName,
      bankAccountName: partner.bankAccountName,
      message: `Dedicated account ready. Pay ${formatNaira(partner.monthlyCommitmentKobo)} monthly to ${partner.virtualAccountNumber}`,
    },
  });
});
