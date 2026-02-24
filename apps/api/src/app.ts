import cors from "cors";
import express, { type Application } from "express";
import { healthRouter } from "./routes/health.js";
import { paymentLinksRouter } from "./routes/payment-links.js";
import { payRouter } from "./routes/pay.js";

const app: Application = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:4000"],
    credentials: true,
  })
);
app.use(express.json());

app.use("/health", healthRouter);
app.use("/v1/payment-links", paymentLinksRouter);
app.use("/", payRouter);

export default app;
