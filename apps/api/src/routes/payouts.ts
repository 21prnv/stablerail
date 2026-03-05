import { Router, type IRouter, type Request, type Response } from "express";
import { prisma } from "@repo/database";
import { z } from "zod";
import type {
  PayoutResponse,
  ApiErrorResponse,
  PayoutStatus,
  ListPayoutsResponse,
} from "@repo/types";
import { DEFAULT_CURRENCY } from "@repo/types";
import { requireApiKey } from "../middleware/auth.js";

const IDEMPOTENCY_HEADER = "idempotency-key";

const createPayoutSchema = z.object({
  amount: z.string().min(1, "amount is required"),
  currency: z.string().optional().default(DEFAULT_CURRENCY),
  destination: z.string().nullable().optional(),
});

export const payoutsRouter: IRouter = Router();

payoutsRouter.use(requireApiKey);

function toPayoutResponse(p: {
  id: string;
  amount: string;
  currency: string;
  destination: string | null;
  status: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PayoutResponse {
  return {
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    destination: p.destination,
    status: p.status as PayoutStatus,
    failureReason: p.failureReason,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

payoutsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const idempotencyKey = req.headers[IDEMPOTENCY_HEADER] as string | undefined;

    const parsed = createPayoutSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join("; ") || "Validation failed";
      res.status(400).json({ error: msg } satisfies ApiErrorResponse);
      return;
    }
    const { amount, currency, destination } = parsed.data;

    if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim()) {
      const existing = await prisma.idempotency.findUnique({
        where: {
          merchantId_idempotencyKey: {
            merchantId: merchant.id,
            idempotencyKey: idempotencyKey.trim(),
          },
        },
      });
      if (existing) {
        res.status(existing.responseStatus).setHeader("Content-Type", "application/json");
        res.send(existing.responseBody);
        return;
      }
    }

    const payout = await prisma.payout.create({
      data: {
        merchantId: merchant.id,
        amount,
        currency,
        destination: destination ?? null,
        idempotencyKey:
          idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim()
            ? idempotencyKey.trim()
            : null,
      },
    });

    const response = toPayoutResponse(payout);

    if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim()) {
      await prisma.idempotency.create({
        data: {
          merchantId: merchant.id,
          idempotencyKey: idempotencyKey.trim(),
          responseStatus: 201,
          responseBody: JSON.stringify(response),
        },
      });
    }

    res.status(201).json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create payout" } satisfies ApiErrorResponse);
  }
});

payoutsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100);
    const cursor = req.query.cursor as string | undefined;

    const payouts = await prisma.payout.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = payouts.length > limit;
    const data = (hasMore ? payouts.slice(0, limit) : payouts).map(toPayoutResponse);
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    const result: ListPayoutsResponse & { nextCursor?: string } = { data };
    if (nextCursor) result.nextCursor = nextCursor;
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list payouts" } satisfies ApiErrorResponse);
  }
});

payoutsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const { id } = req.params;
    const payout = await prisma.payout.findFirst({
      where: { id, merchantId: merchant.id },
    });
    if (!payout) {
      res.status(404).json({ error: "Payout not found" } satisfies ApiErrorResponse);
      return;
    }
    res.json(toPayoutResponse(payout));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get payout" } satisfies ApiErrorResponse);
  }
});

payoutsRouter.post("/:id/simulate-complete", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const { id } = req.params;
    const outcome = (req.body?.outcome ?? req.query.outcome ?? "completed") as string;
    const failureReason = (req.body?.failureReason ?? req.query.failureReason) as string | undefined;
    const success = outcome !== "failed";

    const payout = await prisma.payout.findFirst({
      where: { id, merchantId: merchant.id },
      include: { merchant: true },
    });
    if (!payout) {
      res.status(404).json({ error: "Payout not found" } satisfies ApiErrorResponse);
      return;
    }
    if (payout.status === "completed" || payout.status === "failed") {
      res.status(400).json({
        error: `Payout already in terminal state: ${payout.status}`,
      } satisfies ApiErrorResponse);
      return;
    }

    const updated = await prisma.payout.update({
      where: { id },
      data: {
        status: success ? "completed" : "failed",
        failureReason: success ? null : (failureReason ?? "Simulated failure"),
      },
    });

    res.json(toPayoutResponse(updated));
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: "Failed to simulate payout completion",
    } satisfies ApiErrorResponse);
  }
});
