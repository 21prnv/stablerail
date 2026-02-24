import { Router, type IRouter, type Request, type Response } from "express";
import { prisma } from "@repo/database";
import type { PublicPaymentLinkResponse, ApiErrorResponse, PaymentLinkStatus } from "@repo/types";
import { sendWebhook } from "../lib/webhook.js";

export const payRouter: IRouter = Router();

// Public: get payment link details for checkout page (no auth)
payRouter.get("/v1/public/payment-links/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const link = await prisma.paymentLink.findUnique({ where: { id } });
    if (!link) {
      res.status(404).json({ error: "Payment link not found" } satisfies ApiErrorResponse);
      return;
    }
    const response: PublicPaymentLinkResponse = {
      id: link.id,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
      status: link.status as PaymentLinkStatus,
    };
    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get payment link" } satisfies ApiErrorResponse);
  }
});

// Public: simulate USDC payment (no auth, for demo)
payRouter.post("/v1/public/payment-links/:id/simulate-pay", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const link = await prisma.paymentLink.findUnique({ where: { id }, include: { merchant: true } });
    if (!link) {
      res.status(404).json({ error: "Payment link not found" } satisfies ApiErrorResponse);
      return;
    }
    if (link.status === "paid") {
      res.status(400).json({ error: "Payment already completed" } satisfies ApiErrorResponse);
      return;
    }
    const updated = await prisma.paymentLink.update({
      where: { id },
      data: { status: "paid" },
    });

    // Fire webhook in background if merchant has webhookUrl
    if (link.merchant.webhookUrl) {
      const secret = link.merchant.webhookSecret ?? link.merchant.apiKey;
      sendWebhook(
        link.merchant.webhookUrl,
        {
          type: "payment.completed",
          data: {
            paymentLinkId: updated.id,
            amount: updated.amount,
            currency: updated.currency,
            status: updated.status,
          },
        },
        secret
      );
    }

    res.json({
      id: updated.id,
      amount: updated.amount,
      currency: updated.currency,
      status: updated.status,
      message: "Payment simulated successfully",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to simulate payment" } satisfies ApiErrorResponse);
  }
});

// Serve checkout page at /pay/:id
payRouter.get("/pay/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const base = process.env.BASE_URL ?? "http://localhost:4000";
  const apiBase = base.replace(/\/$/, "");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pay with USDC — Stablerail</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f0f12; color: #e4e4e7; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 2rem; max-width: 400px; width: 100%; text-align: center; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
    .amount { font-size: 2rem; font-weight: 700; color: #a5f3fc; margin: 0.5rem 0; }
    .description { color: #a1a1aa; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .status { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; margin-bottom: 1rem; }
    .status.paid { color: #4ade80; }
    button { width: 100%; padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; background: #0ea5e9; color: #fff; }
    button:hover { background: #0284c7; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #f87171; font-size: 0.875rem; margin-top: 1rem; }
    .success { color: #4ade80; font-size: 0.875rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Pay with USDC</h1>
    <div class="status" id="status">Loading…</div>
    <div class="amount" id="amount">—</div>
    <div class="description" id="description"></div>
    <button id="btn" disabled>Pay with USDC</button>
    <div class="error" id="error"></div>
    <div class="success" id="success"></div>
  </div>
  <script>
    const id = ${JSON.stringify(id)};
    const apiBase = ${JSON.stringify(apiBase)};
    const statusEl = document.getElementById("status");
    const amountEl = document.getElementById("amount");
    const descEl = document.getElementById("description");
    const btn = document.getElementById("btn");
    const errEl = document.getElementById("error");
    const okEl = document.getElementById("success");

    async function load() {
      try {
        const r = await fetch(apiBase + "/v1/public/payment-links/" + id);
        if (!r.ok) throw new Error("Link not found");
        const data = await r.json();
        amountEl.textContent = data.amount + " " + data.currency;
        descEl.textContent = data.description || "";
        statusEl.textContent = data.status;
        if (data.status === "paid") {
          statusEl.classList.add("paid");
          btn.disabled = true;
          btn.textContent = "Already paid";
        } else {
          btn.disabled = false;
        }
      } catch (e) {
        statusEl.textContent = "Error";
        errEl.textContent = e.message || "Failed to load";
      }
    }

    btn.addEventListener("click", async () => {
      errEl.textContent = "";
      okEl.textContent = "";
      btn.disabled = true;
      btn.textContent = "Processing…";
      try {
        const r = await fetch(apiBase + "/v1/public/payment-links/" + id + "/simulate-pay", { method: "POST" });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Payment failed");
        statusEl.textContent = "paid";
        statusEl.classList.add("paid");
        amountEl.textContent = data.amount + " " + data.currency;
        okEl.textContent = "Payment successful.";
        btn.textContent = "Paid";
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Pay with USDC";
        errEl.textContent = e.message || "Payment failed";
      }
    });

    load();
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});
