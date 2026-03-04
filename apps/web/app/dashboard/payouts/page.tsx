"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PayoutResponse } from "@repo/types";
import {
  fetchPayouts,
  getStoredApiKey,
  simulatePayoutComplete,
} from "../../../lib/api";

export default function PayoutsPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(getStoredApiKey());
  }, []);

  const loadPayouts = () => {
    if (!apiKey) return;
    setError(null);
    setLoading(true);
    fetchPayouts(apiKey)
      .then((res) => setPayouts(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    loadPayouts();
  }, [apiKey]);

  const handleSimulate = async (payout: PayoutResponse, outcome: "completed" | "failed") => {
    if (!apiKey || payout.status === "completed" || payout.status === "failed") return;
    setSimulatingId(payout.id);
    setError(null);
    try {
      await simulatePayoutComplete(
        apiKey,
        payout.id,
        outcome,
        outcome === "failed" ? "Simulated failure" : undefined
      );
      loadPayouts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulate failed");
    } finally {
      setSimulatingId(null);
    }
  };

  if (apiKey === null) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-black mb-2">API key required</h2>
          <p className="text-neutral-500 text-sm mb-6">
            Enter your API key on the dashboard to view payouts.
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
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {error && (
        <div className="mb-6 p-4 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-black">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-black">Payouts</h2>
          <Link
            href="/dashboard/payouts/create"
            className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-black text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
          >
            Create payout
          </Link>
        </div>
        {loading ? (
          <p className="text-center text-neutral-500 text-sm py-12">Loading payouts…</p>
        ) : payouts.length === 0 ? (
          <p className="text-center text-neutral-500 text-sm py-12 px-4">
            No payouts yet. Create one to get started.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-black">
                    {payout.amount} {payout.currency}
                  </div>
                  <div className="text-sm text-neutral-500 mt-0.5 truncate">
                    {payout.destination || "No destination"} · {payout.id}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wide ${
                    payout.status === "completed"
                      ? "bg-black text-white"
                      : payout.status === "failed"
                        ? "bg-red-100 text-red-800 border border-red-200"
                        : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                  }`}
                >
                  {payout.status}
                </span>
                {(payout.status === "requested" || payout.status === "processing") && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSimulate(payout, "completed")}
                      disabled={simulatingId === payout.id}
                      className="h-8 px-3 rounded-lg bg-black text-white text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      {simulatingId === payout.id ? "…" : "Complete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulate(payout, "failed")}
                      disabled={simulatingId === payout.id}
                      className="h-8 px-3 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                      Fail
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
