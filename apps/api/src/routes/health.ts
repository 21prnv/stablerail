import { Router, type IRouter, type Request, type Response } from "express";

export const healthRouter: IRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "stablerail-api" });
});
