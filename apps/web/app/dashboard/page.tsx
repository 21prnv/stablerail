"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PaymentLinkResponse } from "@repo/types";
import {
  fetchPaymentLinks,
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
} from "../../lib/api";

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState("");
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [links, setLinks] = useState<PaymentLinkResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setStoredKey(getStoredApiKey());
  }, []);

  useEffect(() => {
    if (!storedKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    fetchPaymentLinks(storedKey)
      .then((res) => {
        if (!cancelled) setLinks(res.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storedKey]);

  const handleSaveApiKey = () => {
    const key = apiKey.trim();
    if (!key) return;
    setStoredApiKey(key);
    setStoredKey(key);
    setApiKey("");
  };

  const handleClearApiKey = () => {
    clearStoredApiKey();
    setStoredKey(null);
    setLinks([]);
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (storedKey === null) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-black mb-2">Enter your API key</h2>
          <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
            Use your merchant API key to view and manage payment links. You can find it in your
            Stablerail account or use the demo key after seeding the database.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="password"
              placeholder="e.g. your-api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
              className="flex-1 min-w-[200px] h-10 px-3 rounded-lg border border-neutral-300 bg-white text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            />
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="h-10 px-5 rounded-lg bg-black text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
            >
              Save & continue
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (storedKey && !apiKey) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 sm:p-8 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-black mb-2">API key</h2>
          <p className="text-neutral-500 text-sm mb-6">
            Using stored API key. Change it below or clear to enter a new one.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="password"
              placeholder="Enter new API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
              className="flex-1 min-w-[200px] h-10 px-3 rounded-lg border border-neutral-300 bg-white text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
            />
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="h-10 px-5 rounded-lg bg-black text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
            >
              Update key
            </button>
            <button
              type="button"
              onClick={handleClearApiKey}
              className="h-10 px-5 rounded-lg border border-neutral-300 bg-white text-black font-medium text-sm hover:bg-neutral-100 transition-colors"
            >
              Clear & sign out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-black">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-center text-neutral-500 text-sm py-12">Loading payment links…</p>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-black">Payment links</h2>
              <Link
                href="/dashboard/create"
                className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-black text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
              >
                Create payment link
              </Link>
            </div>
            {links.length === 0 ? (
              <p className="text-center text-neutral-500 text-sm py-12 px-4">
                No payment links yet. Create one to get started.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {links.map((link) => (
                  <li
                    key={link.id}
                    className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-black">
                        {link.amount} {link.currency}
                      </div>
                      <div className="text-sm text-neutral-500 mt-0.5 truncate">
                        {link.description || "No description"} · {link.id}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium uppercase tracking-wide ${
                        link.status === "paid"
                          ? "bg-black text-white"
                          : link.status === "expired"
                            ? "bg-neutral-300 text-white"
                            : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                      }`}
                    >
                      {link.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(link.url, link.id)}
                        title="Copy URL"
                        className="h-8 px-3 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors"
                      >
                        {copiedId === link.id ? "Copied" : "Copy URL"}
                      </button>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs font-medium hover:bg-neutral-100 transition-colors inline-flex items-center"
                      >
                        Open
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    );
  }

  return null;
}
