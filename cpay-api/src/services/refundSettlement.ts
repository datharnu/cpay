import { OverpaymentCase, PartnerNotification } from "../models";
import { formatNaira } from "./ledger";
import { markPartnerNotificationsRead } from "./notifications";
import { getTransferStatus } from "./nombaClient";

export type RefundSettlementOutcome =
  | "unchanged"
  | "still_pending"
  | "settled"
  | "failed";

export type RefundSettlementResult = {
  overpayment: OverpaymentCase;
  outcome: RefundSettlementOutcome;
  detail?: string;
};

function transferStatus(data: Record<string, unknown> | undefined): string {
  if (!data) return "";
  return String(
    data.status ?? data.transferStatus ?? data.state ?? ""
  ).toUpperCase();
}

function isNombaTransferSettled(data: Record<string, unknown> | undefined): boolean {
  const status = transferStatus(data);
  if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "SETTLED"].includes(status)) {
    return true;
  }

  const nested = data?.data as Record<string, unknown> | undefined;
  if (nested && isNombaTransferSettled(nested)) return true;

  return false;
}

function isNombaTransferFailed(data: Record<string, unknown> | undefined): boolean {
  const status = transferStatus(data);
  return [
    "REFUND",
    "PAYMENT_FAILED",
    "CANCELLED",
    "REVERSED_BY_VENDOR",
    "FAILED",
  ].includes(status);
}

function failureDetail(data: Record<string, unknown> | undefined): string {
  if (!data) return "Nomba did not confirm the transfer.";
  const message = String(
    data.gatewayMessage ?? data.description ?? data.message ?? ""
  ).trim();
  if (message) return message;
  const status = transferStatus(data);
  if (status) return `Nomba reported status: ${status}`;
  return "Nomba did not confirm the transfer.";
}

async function notifyRefundFailed(
  overpayment: OverpaymentCase,
  detail: string
): Promise<void> {
  const dest =
    overpayment.refundAccountName && overpayment.refundAccountNumber
      ? `${overpayment.refundAccountName} (${overpayment.refundAccountNumber})`
      : "bank account";

  await PartnerNotification.create({
    partnerId: overpayment.partnerId,
    paymentId: overpayment.paymentId,
    type: "overpayment_pending",
    title: "Refund failed",
    message: `${formatNaira(overpayment.excessKobo)} could not be sent to ${dest}. ${detail} You can try again from the overpayment section.`,
  });
}

export async function trySettleOverpaymentRefund(
  overpayment: OverpaymentCase
): Promise<RefundSettlementResult> {
  if (overpayment.status !== "refund_pending" || !overpayment.merchantTxRef) {
    return { overpayment, outcome: "unchanged" };
  }

  try {
    const result = await getTransferStatus(overpayment.merchantTxRef);
    const payload = (result.data ?? {}) as Record<string, unknown>;

    if (isNombaTransferFailed(payload)) {
      const detail = failureDetail(payload);
      overpayment.status = "pending_choice";
      overpayment.merchantTxRef = null;
      await overpayment.save();

      await markPartnerNotificationsRead(overpayment.partnerId, {
        paymentId: overpayment.paymentId,
        types: ["overpayment_pending"],
      });
      await notifyRefundFailed(overpayment, detail);

      return { overpayment, outcome: "failed", detail };
    }

    if (!isNombaTransferSettled(payload)) {
      return { overpayment, outcome: "still_pending" };
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
      message: `${formatNaira(overpayment.excessKobo)} sent to ${dest}.`,
    });

    return { overpayment, outcome: "settled" };
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : "Could not check refund status.";
    return { overpayment, outcome: "still_pending", detail };
  }
}

export async function settleAllPendingRefunds(): Promise<number> {
  const pending = await OverpaymentCase.findAll({
    where: { status: "refund_pending" },
  });

  let settled = 0;
  for (const row of pending) {
    const before = row.status;
    const result = await trySettleOverpaymentRefund(row);
    if (before === "refund_pending" && result.outcome === "settled") {
      settled += 1;
    }
  }
  return settled;
}

export function refundOutcomeMessage(
  result: RefundSettlementResult,
  excessKobo: number
): { tone: "success" | "warning" | "error"; message: string } {
  const amount = formatNaira(excessKobo);
  const dest =
    result.overpayment.refundAccountName && result.overpayment.refundAccountNumber
      ? `${result.overpayment.refundAccountName} (${result.overpayment.refundAccountNumber})`
      : "bank account";

  if (result.outcome === "settled") {
    return {
      tone: "success",
      message: `${amount} refunded to ${dest}.`,
    };
  }

  if (result.outcome === "failed") {
    return {
      tone: "error",
      message: `Refund failed: ${result.detail ?? "Nomba could not complete the transfer."}`,
    };
  }

  if (result.outcome === "still_pending") {
    return {
      tone: "warning",
      message: `Refund initiated — ${amount} to ${dest}. Waiting for Nomba to confirm.`,
    };
  }

  return {
    tone: "warning",
    message: `Refund status unchanged.`,
  };
}
