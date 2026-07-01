import { Router } from "express";
import { Partner, Payment } from "../models";
import { koboToNaira } from "../services/ledger";

export const paymentsRouter = Router();

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
