import { Op } from "sequelize";
import { Partner, Payment } from "../models";
import { koboToNaira } from "./ledger";

const CLASSIFICATION_LABELS: Record<string, string> = {
  exact: "Exact",
  under: "Underpayment",
  over: "Overpayment",
  catch_up: "Catch-up",
  unmatched: "Unmatched",
};

function escapeCsv(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseDateParam(value: string, endOfDay: boolean): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }
  const [, year, month, day] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.");
  }
  return date;
}

function formatExportDateTime(iso: Date | string | null | undefined) {
  const date = iso ? new Date(iso) : new Date();
  return {
    date: date.toLocaleDateString("en-NG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: date.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

export function buildExportFilename(params: {
  from: string;
  to: string;
  partnerName?: string | null;
}) {
  const scope = params.partnerName
    ? params.partnerName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
    : "all-members";
  return `cpay-payments-${scope}-${params.from}-to-${params.to}.csv`;
}

export async function buildPaymentExportCsv(params: {
  from: string;
  to: string;
  partnerId?: string;
}) {
  const fromDate = parseDateParam(params.from, false);
  const toDate = parseDateParam(params.to, true);
  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error("Start date must be on or before end date.");
  }

  const where: Record<string, unknown> = {
    createdAt: {
      [Op.between]: [fromDate, toDate],
    },
  };
  if (params.partnerId) {
    where.partnerId = params.partnerId;
  }

  const rows = await Payment.findAll({
    where,
    include: [
      {
        model: Partner,
        attributes: ["id", "fullName", "phone", "virtualAccountNumber"],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  const headers = [
    "Date",
    "Time",
    "Member Name",
    "Phone",
    "Dedicated Account",
    "Amount (NGN)",
    "Classification",
    "Transfer From",
    "Nomba Reference",
    "Payment ID",
  ];

  let totalKobo = 0;
  const dataRows = rows.map((payment) => {
    const partner = (payment as Payment & { Partner?: Partner }).Partner;
    const { date, time } = formatExportDateTime(
      (payment as Payment & { createdAt?: Date }).createdAt
    );
    totalKobo += payment.amountKobo;

    return [
      date,
      time,
      partner?.fullName ?? "Unmatched",
      partner?.phone ?? "",
      payment.virtualAccountNumber ?? partner?.virtualAccountNumber ?? "",
      koboToNaira(payment.amountKobo).toFixed(2),
      CLASSIFICATION_LABELS[payment.classification] ?? payment.classification,
      payment.senderName ?? "",
      payment.nombaTransactionId ?? "",
      payment.id,
    ];
  });

  const lines = [
    headers.map(escapeCsv).join(","),
    ...dataRows.map((row) => row.map(escapeCsv).join(",")),
    [
      "TOTAL",
      "",
      "",
      "",
      "",
      koboToNaira(totalKobo).toFixed(2),
      `${rows.length} payment${rows.length === 1 ? "" : "s"}`,
      "",
      "",
      "",
    ]
      .map(escapeCsv)
      .join(","),
  ];

  return {
    csv: `\uFEFF${lines.join("\r\n")}\r\n`,
    count: rows.length,
    totalNaira: koboToNaira(totalKobo),
    partnerName: params.partnerId
      ? ((rows[0] as Payment & { Partner?: Partner })?.Partner?.fullName ??
        (
          await Partner.findByPk(params.partnerId, {
            attributes: ["fullName"],
          })
        )?.fullName ??
        null)
      : null,
  };
}
