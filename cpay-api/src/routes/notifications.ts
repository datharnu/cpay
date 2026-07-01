import { Router } from "express";
import { Partner, PartnerNotification } from "../models";
import {
  mapNotificationRow,
  reconcileNotificationReadState,
} from "../services/notifications";

export const notificationsRouter = Router();

notificationsRouter.get("/", async (_req, res, next) => {
  try {
    await reconcileNotificationReadState();

    const rows = await PartnerNotification.findAll({
      include: [{ model: Partner }],
      order: [["createdAt", "DESC"]],
      limit: 50,
    });

    const data = rows.map((n) => {
      const partner = (n as PartnerNotification & { Partner?: Partner }).Partner;
      return mapNotificationRow(n, partner);
    });

    const unreadCount = data.filter((n) => !n.read).length;

    res.json({ data: { items: data, unreadCount } });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const row = await PartnerNotification.findByPk(req.params.id);
    if (!row) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    row.read = true;
    await row.save();

    res.json({ data: mapNotificationRow(row) });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/read-all", async (_req, res, next) => {
  try {
    const [count] = await PartnerNotification.update(
      { read: true },
      { where: { read: false } }
    );

    res.json({ data: { marked: count } });
  } catch (err) {
    next(err);
  }
});
