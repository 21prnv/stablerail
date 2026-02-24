import { Router, type IRouter, type Request, type Response } from "express";
import { prisma } from "@repo/database";
import type { CreatePaymentLinkBody, PaymentLinkResponse, ApiErrorResponse, PaymentLinkStatus } from "@repo/types";
import { DEFAULT_CURRENCY } from "@repo/types";
import { requireApiKey } from "../middleware/auth.js";

export const paymentLinksRouter: IRouter = Router();
const BASE_URL = process.env.BASE_URL ?? "http://localhost:4000";

paymentLinksRouter.use(requireApiKey);

paymentLinksRouter.post("/", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const body = req.body as Partial<CreatePaymentLinkBody>;
    const { amount, currency = DEFAULT_CURRENCY, description } = body;

    if (!amount || typeof amount !== "string") {
      res.status(400).json({ error: "amount is required and must be a string" } satisfies ApiErrorResponse);
      return;
    }

    const link = await prisma.paymentLink.create({
      data: {
        merchantId: merchant.id,
        amount,
        currency,
        description: description ?? null,
      },
    });

    const url = `${BASE_URL}/pay/${link.id}`;
    const response: PaymentLinkResponse = {
      id: link.id,
      url,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
      status: link.status as PaymentLinkStatus,
      createdAt: link.createdAt.toISOString(),
    };
    res.status(201).json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create payment link" } satisfies ApiErrorResponse);
  }
});

paymentLinksRouter.get("/", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const links = await prisma.paymentLink.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
    });
    const data: PaymentLinkResponse[] = links.map((link) => ({
      id: link.id,
      url: `${BASE_URL}/pay/${link.id}`,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
      status: link.status as PaymentLinkStatus,
      createdAt: link.createdAt.toISOString(),
    }));
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list payment links" } satisfies ApiErrorResponse);
  }
});

paymentLinksRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const { id } = req.params;
    const link = await prisma.paymentLink.findFirst({
      where: { id, merchantId: merchant.id },
    });
    if (!link) {
      res.status(404).json({ error: "Payment link not found" } satisfies ApiErrorResponse);
      return;
    }
    const response: PaymentLinkResponse = {
      id: link.id,
      url: `${BASE_URL}/pay/${link.id}`,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
      status: link.status as PaymentLinkStatus,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get payment link" } satisfies ApiErrorResponse);
  }
});
