import { Router } from "express";
import { Partner, Payment } from "../models";
import { koboToNaira } from "../services/ledger";
import {
  buildExportFilename,
  buildPaymentExportCsv,
} from "../services/paymentExport";

export const paymentsRouter = Router();

paymentsRouter.get("/export", async (req, res, next) => {
  try {
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    const partnerId = req.query.partnerId
      ? String(req.query.partnerId).trim()
      : undefined;

    if (!from || !to) {
      res.status(400).json({
        error: "from and to query params are required (YYYY-MM-DD).",
      });
      return;
    }

    const result = await buildPaymentExportCsv({ from, to, partnerId });
    const filename = buildExportFilename({
      from,
      to,
      partnerName: result.partnerName,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(result.csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed.";
    if (
      message.includes("YYYY-MM-DD") ||
      message.includes("Invalid date") ||
      message.includes("Start date")
    ) {
      res.status(400).json({ error: message });
      return;
    }
    next(err);
  }
});

paymentsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await Payment.findAll({
      include: [
        {
          model: Partner,
          attributes: ["id", "fullName", "virtualAccountNumber"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 200,
    });

    res.json({
      data: rows.map((p) => {
        const partner = (p as Payment & { Partner?: Partner }).Partner;
        return {
          id: p.id,
          partnerId: p.partnerId,
          partnerName: partner?.fullName ?? null,
          virtualAccountNumber: p.virtualAccountNumber ?? partner?.virtualAccountNumber ?? null,
          amount: koboToNaira(p.amountKobo),
          classification: p.classification,
          senderName: p.senderName,
          nombaTransactionId: p.nombaTransactionId,
          createdAt: (p as Payment & { createdAt?: Date }).createdAt ?? null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});
