import type {
  CreatePaymentLinkBody,
  ListPaymentLinksResponse,
  PaymentLinkResponse,
  ApiErrorResponse,
} from "@repo/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_KEY_HEADER = "x-api-key";

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    [API_KEY_HEADER]: apiKey,
  };
}

export async function fetchPaymentLinks(apiKey: string): Promise<ListPaymentLinksResponse> {
  const res = await fetch(`${API_URL}/v1/payment-links`, { headers: headers(apiKey) });
  if (!res.ok) {
    const err = (await res.json()) as ApiErrorResponse;
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<ListPaymentLinksResponse>;
}

export async function createPaymentLink(
  apiKey: string,
  body: CreatePaymentLinkBody
): Promise<PaymentLinkResponse> {
  const res = await fetch(`${API_URL}/v1/payment-links`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json()) as ApiErrorResponse;
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<PaymentLinkResponse>;
}

export const API_KEY_STORAGE = "stablerail-api-key";

export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(API_KEY_STORAGE);
}

export function setStoredApiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearStoredApiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(API_KEY_STORAGE);
}
