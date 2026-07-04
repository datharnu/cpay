import { Router, RequestHandler } from "express";
import { applyDemoCatchUp, seedDemoStory } from "../services/demoSeed";
import { resetCleanDemo } from "../services/resetCleanDemo";

export const devRouter = Router();

/** Demo seed routes are local-only — never exposed on the deployed judge demo. */
const localOnly: RequestHandler = (_req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).end();
    return;
  }
  next();
};

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


/** Load full hackathon demo story (local dev only) */
devRouter.post("/seed-demo", localOnly, async (_req, res) => {
  try {
    const result = await seedDemoStory();
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({
      message: err instanceof Error ? err.message : "Demo seed failed",
    });
  }
});

/** Demo step 4 — Grace pays catch-up (local dev only) */
devRouter.post("/demo-catch-up/:partnerId", localOnly, async (req, res) => {
  try {
    const result = await applyDemoCatchUp(req.params.partnerId);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({
      message: err instanceof Error ? err.message : "Catch-up failed",
    });
  }
});
