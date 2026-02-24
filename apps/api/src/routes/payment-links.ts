import { Router, type IRouter, type Request, type Response } from "express";
import { prisma } from "@repo/database";
import { requireApiKey } from "../middleware/auth.js";

export const paymentLinksRouter: IRouter = Router();
const BASE_URL = process.env.BASE_URL ?? "http://localhost:4000";

paymentLinksRouter.use(requireApiKey);

paymentLinksRouter.post("/", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const { amount, currency = "USDC", description } = req.body as {
      amount?: string;
      currency?: string;
      description?: string;
    };

    if (!amount || typeof amount !== "string") {
      res.status(400).json({ error: "amount is required and must be a string" });
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
    res.status(201).json({
      id: link.id,
      url,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
      status: link.status,
      createdAt: link.createdAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create payment link" });
  }
});

paymentLinksRouter.get("/", async (req: Request, res: Response) => {
  try {
    const merchant = (req as Request & { merchant: { id: string } }).merchant;
    const links = await prisma.paymentLink.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      data: links.map((link) => ({
        id: link.id,
        url: `${BASE_URL}/pay/${link.id}`,
        amount: link.amount,
        currency: link.currency,
        description: link.description,
        status: link.status,
        createdAt: link.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list payment links" });
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
      res.status(404).json({ error: "Payment link not found" });
      return;
    }
    res.json({
      id: link.id,
      url: `${BASE_URL}/pay/${link.id}`,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
      status: link.status,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get payment link" });
  }
});
