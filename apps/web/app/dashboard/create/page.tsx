"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_CURRENCY } from "@repo/types";
import type { CreatePaymentLinkBody } from "@repo/types";
import { createPaymentLink, getStoredApiKey } from "../../../lib/api";

export default function CreatePaymentLinkPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = getStoredApiKey();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      setError("No API key. Go back and enter your API key.");
      return;
    }
    const amt = amount.trim();
    if (!amt) {
      setError("Amount is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body: CreatePaymentLinkBody = {
        amount: amt,
        currency: currency || undefined,
        description: description.trim() || undefined,
      };
      await createPaymentLink(apiKey, body);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create payment link");
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof window !== "undefined" && !apiKey) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-black mb-2">API key required</h2>
          <p className="text-neutral-500 text-sm mb-6">
            Please enter your API key on the dashboard first.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-black text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-10">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-black mb-6">Create payment link</h1>
        {error && (
          <div className="mb-6 p-4 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-black">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-black mb-1.5">
              Amount
            </label>
            <input
              id="amount"
              type="text"
              placeholder="e.g. 10.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-black mb-1.5">
              Currency
            </label>
            <input
              id="currency"
              type="text"
              placeholder="USDC"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-black mb-1.5">
              Description (optional)
            </label>
            <textarea
              id="description"
              placeholder="e.g. Premium plan"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[88px] px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm resize-y"
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-lg bg-black text-white font-medium text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create link"}
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center h-10 px-5 rounded-lg border border-neutral-300 bg-white text-black font-medium text-sm hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
