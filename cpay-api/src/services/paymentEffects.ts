import {
  OverpaymentCase,
  Partner,
  PartnerNotification,
  Payment,
} from "../models";
import { formatNaira } from "./ledger";
import { shouldCreateOverpaymentCase } from "./overpaymentConsolidation";
import { frequencyLabel } from "./pledge";

export async function applyPaymentSideEffects(
  partnerId: string,
  paymentId: string,
  classification: Payment["classification"],
  excessKobo: number
): Promise<void> {
  const partner = await Partner.findByPk(partnerId);
  const payment = await Payment.findByPk(paymentId);
  if (!partner || !payment) return;
  // Offboarded members keep payment history, but no new action alerts.
  if (partner.status === "inactive") return;

  if (excessKobo > 0) {
    const canCreate = await shouldCreateOverpaymentCase(partnerId, paymentId);
    if (!canCreate) return;

    await OverpaymentCase.create({
      partnerId,
      paymentId,
      excessKobo,
      status: "pending_choice",
    });

    await PartnerNotification.create({
      partnerId,
      paymentId,
      type: "overpayment_pending",
      title: "Overpayment — action needed",
      message: `${partner.fullName} paid ${formatNaira(payment.amountKobo)}. ${formatNaira(excessKobo)} is extra after monthly dues. Choose: apply to next month or refund.`,
    });
    return;
  }

  if (classification === "under") {
    await PartnerNotification.create({
      partnerId,
      paymentId,
      type: "underpayment",
      title: "Underpayment received",
      message: `${partner.fullName} paid ${formatNaira(payment.amountKobo)} (below the ${formatNaira(partner.monthlyCommitmentKobo)} installment ${frequencyLabel(partner.commitmentFrequency)}). Follow up with the member.`,
    });
  }
}
