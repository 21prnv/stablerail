import type { PaymentLinkStatus } from "./domain.js";

// --- Payment link: create (request) ---
export type CreatePaymentLinkBody = {
  amount: string;
  currency?: string;
  description?: string | null;
};

// --- Payment link: single (response) ---
export type PaymentLinkResponse = {
  id: string;
  url: string;
  amount: string;
  currency: string;
  description: string | null;
  status: PaymentLinkStatus;
  createdAt: string; // ISO
  updatedAt?: string; // ISO, optional for list item
};

// --- Payment link: list (response) ---
export type ListPaymentLinksResponse = {
  data: PaymentLinkResponse[];
};

// --- Public payment link (no auth, for checkout) ---
export type PublicPaymentLinkResponse = {
  id: string;
  amount: string;
  currency: string;
  description: string | null;
  status: PaymentLinkStatus;
};

// --- API error (generic) ---
export type ApiErrorResponse = {
  error: string;
};
