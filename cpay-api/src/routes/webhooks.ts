import { Request, Response } from "express";
import {
  handleNombaWebhook,
  verifyWebhookSignature,
} from "../services/reconciliation";

export async function nombaWebhookHandler(req: Request, res: Response) {
  const rawBody = req.body as Buffer;
  const signature = req.header("nomba-signature");
  const timestamp = req.header("nomba-timestamp");

  if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
    res.status(401).send("Invalid signature");
    return;
  }

  try {
    const payload = JSON.parse(rawBody.toString());
    const result = await handleNombaWebhook(payload, rawBody.toString());
    console.log("[webhook]", result.message);
    res.status(200).send("OK");
  } catch (err) {
    console.error("[webhook error]", err);
    res.status(500).json({
      message: err instanceof Error ? err.message : "Webhook processing failed",
    });
  }
}
