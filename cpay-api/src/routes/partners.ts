import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";
import { Partner, PartnerMonth, Payment, OverpaymentCase, PartnerNotification } from "../models";
import {
  createVirtualAccount,
  expireVirtualAccount,
  fetchVirtualAccount,
} from "../services/nombaClient";
import { markPartnerNotificationsRead } from "../services/notifications";
import {
  ensurePartnerMonths,
  formatNaira,
  formatPartnershipStartLabel,
  getPartnerSummary,
  koboToNaira,
  nairaToKobo,
} from "../services/ledger";
import { settleAllPendingRefunds, trySettleOverpaymentRefund } from "../services/refundSettlement";
import { consolidateDuplicateOverpayments } from "../services/overpaymentConsolidation";
import {
  COMMITMENT_FREQUENCIES,
  getPledgeProgress,
  installmentAmountKobo,
  isCommitmentFrequency,
} from "../services/pledge";

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
  /** Full amount the member agreed to give. */
  pledgeTotal: z.number().positive(),
  /** How often each installment is due. */
  frequency: z.enum(COMMITMENT_FREQUENCIES),
  /** How many installments make up the full pledge. */
  installmentCount: z.number().int().min(1).max(520),
  /** HTML month input: "2026-07" */
  partnershipStartMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a valid month (YYYY-MM)"),
});

partnersRouter.get("/", async (_req, res, next) => {
  try {
    const partners = await Partner.findAll({ order: [["createdAt", "DESC"]] });
    const enriched = [];

    for (const p of partners) {
      await ensurePartnerMonths(p);
      const summary = await getPartnerSummary(p.id);
      const pledge = await getPledgeProgress(p);
      enriched.push({
        id: p.id,
        fullName: p.fullName,
        phone: p.phone,
        email: p.email,
        monthlyCommitment: pledge.installmentAmount,
        pledgeTotal: pledge.pledgeTotal,
        frequency: pledge.frequency,
        frequencyShortLabel: pledge.frequencyShortLabel,
        installmentCount: pledge.installmentCount,
        installmentAmount: pledge.installmentAmount,
        planSummary: pledge.planSummary,
        paidTowardPledge: pledge.paidTowardPledge,
        remainingPledge: pledge.remainingPledge,
        progressPercent: pledge.progressPercent,
        pledgeComplete: pledge.pledgeComplete,
        expectedThisMonth: pledge.expectedThisMonth,
        partnershipStartLabel: formatPartnershipStartLabel(p),
        virtualAccountNumber: p.virtualAccountNumber,
        bankName: p.bankName,
        bankAccountName: p.bankAccountName,
        creditBalance: koboToNaira(p.creditBalanceKobo ?? 0),
        status: p.status,
        arrears: summary ? koboToNaira(summary.arrearsKobo) : 0,
        monthsPaid: summary?.monthsPaid ?? 0,
        monthsMissed: summary?.monthsMissed ?? 0,
      });
    }

    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
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

  await consolidateDuplicateOverpayments();

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

  const overpaymentRecords = await OverpaymentCase.findAll({
    where: {
      partnerId: partner.id,
      status: { [Op.ne]: "dismissed" },
    },
    order: [["createdAt", "DESC"]],
  });

  const overpayments = overpaymentRecords
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

  const pledge = await getPledgeProgress(partner);

  res.json({
    data: {
      id: partner.id,
      fullName: partner.fullName,
      phone: partner.phone,
      email: partner.email,
      monthlyCommitment: pledge.installmentAmount,
      pledgeTotal: pledge.pledgeTotal,
      frequency: pledge.frequency,
      frequencyLabel: pledge.frequencyLabel,
      frequencyShortLabel: pledge.frequencyShortLabel,
      installmentCount: pledge.installmentCount,
      installmentAmount: pledge.installmentAmount,
      planSummary: pledge.planSummary,
      paidTowardPledge: pledge.paidTowardPledge,
      remainingPledge: pledge.remainingPledge,
      progressPercent: pledge.progressPercent,
      pledgeComplete: pledge.pledgeComplete,
      expectedThisMonth: pledge.expectedThisMonth,
      partnershipStartYear: partner.partnershipStartYear,
      partnershipStartMonth: partner.partnershipStartMonth,
      partnershipStartLabel: formatPartnershipStartLabel(partner),
      virtualAccountNumber: partner.virtualAccountNumber,
      bankName: partner.bankName,
      bankAccountName: partner.bankAccountName,
      creditBalance: koboToNaira(partner.creditBalanceKobo ?? 0),
      arrears: summary ? koboToNaira(summary.arrearsKobo) : 0,
      status: partner.status,
      nombaVaStatus,
      months,
      payments,
      overpayments,
      notifications,
    },
  });
});

/**
 * Offboard a member: expire their Nomba VA so new transfers cannot land,
 * mark partner inactive, and clear open overpayment action alerts.
 */
partnersRouter.post("/:id/deactivate", async (req, res) => {
  const partner = await Partner.findByPk(req.params.id);
  if (!partner) {
    res.status(404).json({ message: "Partner not found" });
    return;
  }

  if (partner.status === "inactive") {
    res.json({
      data: {
        id: partner.id,
        status: partner.status,
        virtualAccountNumber: partner.virtualAccountNumber,
        vaExpired: true,
        message: "Partner is already inactive.",
      },
    });
    return;
  }

  const openRefunds = await OverpaymentCase.count({
    where: { partnerId: partner.id, status: "refund_pending" },
  });
  if (openRefunds > 0) {
    res.status(400).json({
      message:
        "Settle or resolve pending refunds before deactivating this partner.",
    });
    return;
  }

  let vaExpired = false;
  let vaMessage: string | null = null;

  if (partner.virtualAccountNumber) {
    try {
      await expireVirtualAccount(partner.virtualAccountNumber);
      vaExpired = true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Nomba expire failed";
      // Treat already-expired VAs as success so offboarding can finish.
      if (/expir|already|not found|404/i.test(detail)) {
        vaExpired = true;
        vaMessage = detail;
      } else {
        res.status(502).json({
          message: `Could not expire Nomba virtual account: ${detail}`,
        });
        return;
      }
    }
  } else {
    vaExpired = true;
    vaMessage = "No virtual account on file.";
  }

  partner.status = "inactive";
  await partner.save();

  const pendingCases = await OverpaymentCase.findAll({
    where: { partnerId: partner.id, status: "pending_choice" },
  });
  for (const row of pendingCases) {
    row.status = "dismissed";
    row.resolvedAt = new Date();
    await row.save();
  }

  await markPartnerNotificationsRead(partner.id, {
    types: ["overpayment_pending"],
  });

  res.json({
    data: {
      id: partner.id,
      status: partner.status,
      virtualAccountNumber: partner.virtualAccountNumber,
      vaExpired,
      dismissedOverpayments: pendingCases.length,
      message: vaMessage
        ? `Partner deactivated. ${vaMessage}`
        : "Partner deactivated and Nomba virtual account expired.",
    },
  });
});

partnersRouter.post("/", async (req, res) => {
  const parsed = createPartnerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const {
    fullName,
    phone,
    email,
    pledgeTotal,
    frequency,
    installmentCount,
    partnershipStartMonth,
  } = parsed.data;

  if (!isCommitmentFrequency(frequency)) {
    res.status(400).json({ message: "Pick a valid payment schedule." });
    return;
  }

  const count =
    frequency === "one_off" ? 1 : Math.max(1, Math.floor(installmentCount));
  const pledgeTotalKobo = nairaToKobo(pledgeTotal);
  const installmentKobo = installmentAmountKobo(pledgeTotalKobo, count);
  const [startYear, startMonth] = partnershipStartMonth.split("-").map(Number);
  const accountRef = `cpay_${uuidv4().replace(/-/g, "").slice(0, 24)}`;

  const partner = await Partner.create({
    fullName,
    phone,
    email: email ?? null,
    monthlyCommitmentKobo: installmentKobo,
    pledgeTotalKobo,
    commitmentFrequency: frequency,
    installmentCount: count,
    partnershipStartYear: startYear,
    partnershipStartMonth: startMonth,
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
  const pledge = await getPledgeProgress(partner);

  res.status(201).json({
    data: {
      id: partner.id,
      fullName: partner.fullName,
      monthlyCommitment: pledge.installmentAmount,
      pledgeTotal: pledge.pledgeTotal,
      frequency: pledge.frequency,
      installmentCount: pledge.installmentCount,
      installmentAmount: pledge.installmentAmount,
      planSummary: pledge.planSummary,
      virtualAccountNumber: partner.virtualAccountNumber,
      bankName: partner.bankName,
      bankAccountName: partner.bankAccountName,
      message: `Dedicated account ready. Plan: ${pledge.planSummary}. Pay to ${partner.virtualAccountNumber}`,
    },
  });
});
