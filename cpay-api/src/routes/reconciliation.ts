import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Partner } from "../models";
import {
  getPartnerNombaTransactions,
  reconcileWithNomba,
  verifyPartnerVirtualAccount,
} from "../services/nombaReconciliation";
import { importMissingNombaPayments } from "../services/importNombaPayments";
import { reprocessUnmatchedPayments } from "../services/reconciliation";
import {
  getTransferStatus,
  listBanks,
  lookupBankAccount,
  sendBankTransfer,
} from "../services/nombaClient";
import { koboToNaira } from "../services/ledger";

export const reconciliationRouter = Router();

reconciliationRouter.post("/sync", async (_req, res) => {
  try {
    const result = await reconcileWithNomba();
    res.json({ data: result });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "Nomba reconciliation failed",
    });
  }
});

/** Pull inbound VA payments from Nomba that exist on Nomba but not in CPay (e.g. after a bad reset). */
reconciliationRouter.post("/import-missing", async (_req, res) => {
  try {
    const result = await importMissingNombaPayments();
    res.json({ data: result });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "Nomba import failed",
    });
  }
});

/** Re-read stored webhook JSON for unmatched rows (e.g. after parser fix). */
reconciliationRouter.post("/reprocess-unmatched", async (_req, res) => {
  try {
    const result = await reprocessUnmatchedPayments();
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({
      message: err instanceof Error ? err.message : "Reprocess failed",
    });
  }
});

reconciliationRouter.get("/partners/:id/verify-va", async (req, res) => {
  try {
    const data = await verifyPartnerVirtualAccount(req.params.id);
    res.json({ data });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "VA verification failed",
    });
  }
});

reconciliationRouter.get("/partners/:id/nomba-transactions", async (req, res) => {
  try {
    const data = await getPartnerNombaTransactions(req.params.id);
    res.json({ data });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "Failed to fetch Nomba transactions",
    });
  }
});

reconciliationRouter.get("/banks", async (_req, res) => {
  try {
    const banks = await listBanks();
    res.json({ data: banks });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "Failed to fetch banks",
    });
  }
});

const lookupSchema = z.object({
  bankCode: z.string().min(3),
  accountNumber: z.string().min(10),
});

reconciliationRouter.post("/transfers/lookup", async (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  try {
    const result = await lookupBankAccount(
      parsed.data.bankCode,
      parsed.data.accountNumber
    );
    res.json({ data: result });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "Bank lookup failed",
    });
  }
});

const refundSchema = z.object({
  bankCode: z.string().min(3),
  accountNumber: z.string().min(10),
  accountName: z.string().min(2),
});

reconciliationRouter.post("/partners/:id/refund-credit", async (req, res) => {
  const parsed = refundSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.flatten() });
    return;
  }

  const partner = await Partner.findByPk(req.params.id);
  if (!partner) {
    res.status(404).json({ message: "Partner not found" });
    return;
  }

  const credit = partner.creditBalanceKobo ?? 0;
  if (credit <= 0) {
    res.status(400).json({ message: "No credit balance to refund" });
    return;
  }

  const merchantTxRef = `cpay_refund_${uuidv4().replace(/-/g, "").slice(0, 20)}`;

  try {
    const verified = await lookupBankAccount(
      parsed.data.bankCode,
      parsed.data.accountNumber
    );

    const transfer = await sendBankTransfer({
      amountKobo: credit,
      bankCode: parsed.data.bankCode,
      accountNumber: verified.accountNumber || parsed.data.accountNumber,
      accountName: verified.accountName || parsed.data.accountName,
      merchantTxRef,
      narration: `CPay credit refund — ${partner.fullName}`,
    });

    partner.creditBalanceKobo = 0;
    await partner.save();

    const status = await getTransferStatus(merchantTxRef);

    res.json({
      data: {
        partnerId: partner.id,
        refundedNaira: koboToNaira(credit),
        merchantTxRef,
        transfer: transfer.data,
        status: status.data,
      },
    });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "Refund transfer failed",
    });
  }
});

reconciliationRouter.get("/transfers/:merchantTxRef", async (req, res) => {
  try {
    const result = await getTransferStatus(req.params.merchantTxRef);
    res.json({ data: result.data });
  } catch (err) {
    res.status(502).json({
      message: err instanceof Error ? err.message : "Transfer status fetch failed",
    });
  }
});
