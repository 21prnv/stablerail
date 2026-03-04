import { Router, type IRouter, type Request, type Response } from "express";
import { prisma, webhookDelivery, type WebhookDelivery } from "@repo/database";
import type { ApiErrorResponse } from "@repo/types";
import { requireApiKey } from "../middleware/auth.js";

export const webhooksRouter: IRouter = Router();

webhooksRouter.use(requireApiKey);

/** GET /v1/webhooks/settings — return merchant webhook URL (for dashboard tracking page) */
webhooksRouter.get("/settings", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const m = await prisma.merchant.findUnique({
      where: { id: merchant.id },
      select: { webhookUrl: true },
    });
    if (!m) {
      res.status(404).json({ error: "Merchant not found" } satisfies ApiErrorResponse);
      return;
    }
    res.json({
      webhookUrl: m.webhookUrl ?? null,
      webhookConfigured: !!m.webhookUrl,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get webhook settings" } satisfies ApiErrorResponse);
  }
});

/** GET /v1/webhooks/deliveries — list recent webhook deliveries */
webhooksRouter.get("/deliveries", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100);
    const cursor = req.query.cursor as string | undefined;

    const list = await webhookDelivery.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = list.length > limit;
    const data = (hasMore ? list.slice(0, limit) : list).map((d: WebhookDelivery) => ({
      id: d.id,
      eventType: d.eventType,
      eventId: d.eventId,
      attempt: d.attempt,
      status: d.status,
      responseCode: d.responseCode,
      createdAt: d.createdAt.toISOString(),
    }));
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
    res.json({ data, ...(nextCursor ? { nextCursor } : {}) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list webhook deliveries" } satisfies ApiErrorResponse);
  }
});
