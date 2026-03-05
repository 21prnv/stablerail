import type { PaymentLinkStatus } from "./domain.js";

export type CreatePaymentLinkBody = {
  amount: string;
  currency?: string;
  description?: string | null;
};

export type PaymentLinkResponse = {
  id: string;
  url: string;
  amount: string;
  currency: string;
  description: string | null;
  status: PaymentLinkStatus;
  createdAt: string;
  updatedAt?: string;
};

export type ListPaymentLinksResponse = {
  data: PaymentLinkResponse[];
};

export type PublicPaymentLinkResponse = {
  id: string;
  amount: string;
  currency: string;
  description: string | null;
  status: PaymentLinkStatus;
};

export type ApiErrorResponse = {
  error: string;
};
