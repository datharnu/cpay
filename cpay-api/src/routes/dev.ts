import { Router } from "express";
import { applyDemoCatchUp, seedDemoStory } from "../services/demoSeed";

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
