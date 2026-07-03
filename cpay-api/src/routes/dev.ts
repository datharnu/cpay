import { Router } from "express";
import { applyDemoCatchUp, seedDemoStory } from "../services/demoSeed";
import { resetCleanDemo } from "../services/resetCleanDemo";

export const devRouter = Router();

function isResetAuthorized(req: { header(name: string): string | undefined }): boolean {
  const provided = req.header("x-cpay-reset-secret");
  const expected =
    process.env.CPAY_RESET_SECRET || process.env.NOMBA_CLIENT_SECRET || "";
  return Boolean(provided && expected && provided === expected);
}

/**
 * Full clean demo reset: expire all Nomba VAs and wipe CPay data.
 * Auth: header x-cpay-reset-secret = CPAY_RESET_SECRET or NOMBA_CLIENT_SECRET.
 */
devRouter.post("/reset-clean", async (req, res) => {
  if (!isResetAuthorized(req)) {
    res.status(401).json({ message: "Unauthorized reset" });
    return;
  }

  try {
    const result = await resetCleanDemo();
    res.json({
      data: {
        ...result,
        message:
          "Clean reset done. Create new partners from the app — old test history is gone.",
      },
    });
  } catch (err) {
    res.status(500).json({
      message: err instanceof Error ? err.message : "Clean reset failed",
    });
  }
});


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
