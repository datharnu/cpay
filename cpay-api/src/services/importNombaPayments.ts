import { Op } from "sequelize";
import { Partner, Payment } from "../models";
import {
  applyPaymentToLedger,
  nairaToKobo,
  rebuildPartnerLedger,
} from "./ledger";
import { applyPaymentSideEffects } from "./paymentEffects";
import {
  reconcileWithNomba,
  type ReconciliationDrift,
} from "./nombaReconciliation";

export async function importMissingNombaPayments(): Promise<{
  imported: number;
  skipped: number;
  drifts: ReconciliationDrift[];
}> {
  const { drifts } = await reconcileWithNomba();
  const orphans = drifts.filter((d) => d.issue === "orphan_on_nomba");

  let imported = 0;
  let skipped = 0;

  for (const drift of orphans) {
    if (!drift.partnerId || !drift.nombaTransactionId) {
      skipped += 1;
      continue;
    }

    const requestId = drift.sessionId ?? drift.nombaTransactionId;
    const existing = await Payment.findOne({
      where: {
        [Op.or]: [
          { requestId },
          { nombaTransactionId: drift.nombaTransactionId },
          ...(drift.sessionId ? [{ sessionId: drift.sessionId }] : []),
        ],
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const partner = await Partner.findByPk(drift.partnerId);
    if (!partner) {
      skipped += 1;
      continue;
    }

    const amountKobo = nairaToKobo(drift.amountNaira);
    const { classification, excessKobo } = await applyPaymentToLedger(
      partner.id,
      amountKobo
    );

    const payment = await Payment.create({
      partnerId: partner.id,
      amountKobo,
      classification,
      nombaTransactionId: drift.nombaTransactionId,
      sessionId: drift.sessionId ?? null,
      senderName: null,
      virtualAccountNumber: drift.virtualAccountNumber ?? partner.virtualAccountNumber,
      requestId,
      rawPayload: JSON.stringify({
        source: "nomba_transactions_api_import",
        drift,
      }),
    });

    await applyPaymentSideEffects(
      partner.id,
      payment.id,
      classification,
      excessKobo
    );

    imported += 1;
  }

  return { imported, skipped, drifts };
}

export async function rebuildAllPartnerLedgers(): Promise<void> {
  const partners = await Partner.findAll();
  for (const partner of partners) {
    await rebuildPartnerLedger(partner.id);
  }
}
