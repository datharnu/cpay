import { OverpaymentCase, PartnerNotification } from "../models";
import { formatNaira } from "./ledger";
import { markPartnerNotificationsRead } from "./notifications";
import { getTransferStatus } from "./nombaClient";

function isNombaTransferSettled(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;

  const status = String(
    data.status ?? data.transferStatus ?? data.state ?? ""
  ).toUpperCase();

  if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "SETTLED"].includes(status)) {
    return true;
  }

  if (["PENDING_BILLING", "NEW", "PROCESSING"].includes(status)) {
    return false;
  }

  const code = String(data.code ?? "");
  if (code === "00") return true;

  const nested = data.data as Record<string, unknown> | undefined;
  if (nested && isNombaTransferSettled(nested)) return true;

  return false;
}

export async function trySettleOverpaymentRefund(
  overpayment: OverpaymentCase
): Promise<OverpaymentCase> {
  if (overpayment.status !== "refund_pending" || !overpayment.merchantTxRef) {
    return overpayment;
  }

  try {
    const result = await getTransferStatus(overpayment.merchantTxRef);
    const payload = (result.data ?? {}) as Record<string, unknown>;

    if (!isNombaTransferSettled(payload)) {
      return overpayment;
    }

    overpayment.status = "refunded";
    overpayment.resolvedAt = overpayment.resolvedAt ?? new Date();
    await overpayment.save();

    await markPartnerNotificationsRead(overpayment.partnerId, {
      paymentId: overpayment.paymentId,
      types: ["overpayment_pending"],
    });

    const dest =
      overpayment.refundAccountName && overpayment.refundAccountNumber
        ? `${overpayment.refundAccountName} (${overpayment.refundAccountNumber})`
        : "bank account";

    await PartnerNotification.create({
      partnerId: overpayment.partnerId,
      paymentId: overpayment.paymentId,
      type: "overpayment_resolved",
      title: "Overpayment refund settled",
      message: `${formatNaira(overpayment.excessKobo)} confirmed settled to ${dest} via Nomba.`,
    });

    return overpayment;
  } catch {
    return overpayment;
  }
}

export async function settleAllPendingRefunds(): Promise<number> {
  const pending = await OverpaymentCase.findAll({
    where: { status: "refund_pending" },
  });

  let settled = 0;
  for (const row of pending) {
    const before = row.status;
    await trySettleOverpaymentRefund(row);
    if (before === "refund_pending" && row.status === "refunded") {
      settled += 1;
    }
  }
  return settled;
}
