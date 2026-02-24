import type { Request, Response, NextFunction } from "express";
import { prisma } from "@repo/database";

const API_KEY_HEADER = process.env.API_KEY_HEADER ?? "x-api-key";

export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers[API_KEY_HEADER.toLowerCase()] as string | undefined;

  if (!apiKey || typeof apiKey !== "string") {
    res.status(401).json({ error: "Missing or invalid API key" });
    return;
  }

  const merchant = await prisma.merchant.findUnique({ where: { apiKey } });
  if (!merchant) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  (req as Request & { merchant: { id: string; name: string } }).merchant = {
    id: merchant.id,
    name: merchant.name,
  };
  next();
}
