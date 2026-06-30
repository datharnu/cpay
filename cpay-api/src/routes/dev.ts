import { Router } from "express";
import { Partner } from "../models";
import { applyPaymentToLedger, nairaToKobo } from "../services/ledger";
import { Payment } from "../models";
import { v4 as uuidv4 } from "uuid";
import { applyDemoCatchUp, seedDemoStory } from "../services/demoSeed";
import { applyPaymentSideEffects } from "../services/paymentEffects";

export const devRouter = Router();

/** Load full hackathon demo story (uses your 2 existing sandbox VAs) */
devRouter.post("/seed-demo", async (_req, res) => {
  try {
    const result = await seedDemoStory();
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({
      message: err instanceof Error ? err.message : "Demo seed failed",
    });
  }
});

/** Demo step 4 — Grace pays ₦100k catch-up */
devRouter.post("/demo-catch-up/:partnerId", async (req, res) => {
  try {
    const result = await applyDemoCatchUp(req.params.partnerId);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({
      message: err instanceof Error ? err.message : "Catch-up failed",
    });
  }
});

/** Sandbox helper — simulate inbound transfer when Nomba test transfer isn't available */
devRouter.post("/simulate-payment", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).end();
    return;
  }

  const { partnerId, amountNaira } = req.body as {
    partnerId?: string;
    amountNaira?: number;
  };

  if (!partnerId || !amountNaira) {
    res.status(400).json({ message: "partnerId and amountNaira required" });
    return;
  }

  const partner = await Partner.findByPk(partnerId);
  if (!partner) {
    res.status(404).json({ message: "Partner not found" });
    return;
  }

  const amountKobo = nairaToKobo(Number(amountNaira));
  const { classification, excessKobo } = await applyPaymentToLedger(
    partner.id,
    amountKobo
  );

  const payment = await Payment.create({
    partnerId: partner.id,
    amountKobo,
    classification,
    virtualAccountNumber: partner.virtualAccountNumber,
    senderName: "Sandbox Test Payer",
    requestId: `sim_${uuidv4()}`,
    rawPayload: JSON.stringify({ simulated: true, amountNaira }),
  });

  await applyPaymentSideEffects(
    partner.id,
    payment.id,
    classification,
    excessKobo
  );

  res.json({
    data: {
      partnerId,
      amountNaira,
      classification,
      excessKobo,
      message: "Simulated payment applied",
    },
  });
});
