"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  fetchWebhookSettings,
  fetchWebhookDeliveries,
  getStoredApiKey,
} from "../../../lib/api";
import type { WebhookDeliveryItem } from "../../../lib/api";

const EVENT_TYPES = [
  {
    type: "payment.completed",
    description: "Sent when a payment link is paid (e.g. after simulate-pay or real payment).",
    data: "paymentLinkId, amount, currency, status",
  },
  {
    type: "payout.completed",
    description: "Sent when a payout reaches completed status.",
    data: "payoutId, amount, currency, status",
  },
  {
    type: "payout.failed",
    description: "Sent when a payout fails.",
    data: "payoutId, amount, currency, status, failureReason",
  },
] as const;

export default function WebhooksPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDeliveries = useCallback((silent = false) => {
    if (!apiKey) return;
    if (!silent) setDeliveriesLoading(true);
    fetchWebhookDeliveries(apiKey, { limit: 30 })
      .then((res) => setDeliveries(res.data))
      .catch(() => setDeliveries([]))
      .finally(() => {
        if (!silent) setDeliveriesLoading(false);
      });
  }, [apiKey]);

  useEffect(() => {
    setApiKey(getStoredApiKey());
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      setDeliveriesLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    fetchWebhookSettings(apiKey)
      .then((res) => setWebhookUrl(res.webhookUrl))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    loadDeliveries();
  }, [apiKey, loadDeliveries]);

  // Poll deliveries every 4 seconds so new webhooks appear without refresh
  useEffect(() => {
    if (!apiKey) return;
    const interval = setInterval(() => loadDeliveries(true), 4000);
    return () => clearInterval(interval);
  }, [apiKey, loadDeliveries]);

  if (apiKey === null) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-black mb-2">API key required</h2>
          <p className="text-neutral-500 text-sm mb-6">
            Enter your API key on the dashboard to view webhook settings.
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
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-semibold text-black mb-2">Webhooks</h1>
      <p className="text-neutral-500 text-sm mb-8">
        Track your webhook endpoint and event types. Configure your URL in the API or seed data.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Current endpoint */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-black mb-3">Endpoint</h2>
          {loading ? (
            <p className="text-neutral-500 text-sm">Loading…</p>
          ) : webhookUrl ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-700">Webhook URL</p>
              <code className="block p-3 rounded-lg bg-neutral-100 text-neutral-800 text-sm break-all">
                {webhookUrl}
              </code>
              <p className="text-xs text-neutral-500">
                Events are sent as POST requests with JSON body and HMAC-SHA256 signature.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                No webhook URL configured. Set <code className="bg-amber-100 px-1 rounded">webhookUrl</code> (and
                optionally <code className="bg-amber-100 px-1 rounded">webhookSecret</code>) for your merchant to
                receive events.
              </p>
            </div>
          )}
        </section>

        {/* Recent deliveries — updates automatically every 4s */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-black">Recent deliveries</h2>
            <button
              type="button"
              onClick={() => loadDeliveries()}
              disabled={deliveriesLoading}
              className="text-sm font-medium text-neutral-600 hover:text-black disabled:opacity-50"
            >
              {deliveriesLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <p className="text-xs text-neutral-500 mb-4">Updates automatically every few seconds.</p>
          {deliveriesLoading && deliveries.length === 0 ? (
            <p className="text-neutral-500 text-sm">Loading…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-neutral-500 text-sm">No deliveries yet. Trigger a payment or payout to see entries.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500 font-medium">
                    <th className="py-2 px-2">Event</th>
                    <th className="py-2 px-2">Attempt</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Response</th>
                    <th className="py-2 px-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-neutral-100">
                      <td className="py-2 px-2 font-mono text-xs">{d.eventType}</td>
                      <td className="py-2 px-2">{d.attempt}</td>
                      <td className="py-2 px-2">
                        <span
                          className={
                            d.status === "success"
                              ? "text-green-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2 px-2">{d.responseCode ?? "—"}</td>
                      <td className="py-2 px-2 text-neutral-500">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Event types */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-black mb-4">Event types</h2>
          <ul className="space-y-4">
            {EVENT_TYPES.map((ev) => (
              <li
                key={ev.type}
                className="flex flex-col sm:flex-row sm:items-start gap-2 pb-4 border-b border-neutral-100 last:border-0 last:pb-0"
              >
                <code className="text-sm font-medium text-black shrink-0 sm:w-44">
                  {ev.type}
                </code>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-600">{ev.description}</p>
                  <p className="text-xs text-neutral-500 mt-1">Data: {ev.data}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Signing */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-black mb-3">Verifying signatures</h2>
          <p className="text-sm text-neutral-600 mb-4">
            Each request includes a header <code className="bg-neutral-100 px-1 rounded text-xs">x-webhook-signature</code> with
            value <code className="bg-neutral-100 px-1 rounded text-xs">sha256=&lt;hex&gt;</code>. Compute HMAC-SHA256 of the raw
            request body using your webhook secret (or API key if no secret is set) and compare.
          </p>
          <div className="p-4 rounded-lg bg-neutral-100 text-neutral-800 text-xs font-mono overflow-x-auto">
            <pre>{`// Node.js example
const crypto = require('crypto');
const signature = req.headers['x-webhook-signature']; // "sha256=..."
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));`}</pre>
          </div>
          <p className="text-xs text-neutral-500 mt-3">
            Delivery ID is in <code className="bg-neutral-100 px-1 rounded">x-webhook-id</code>. We retry failed
            deliveries with exponential backoff (up to 3 attempts).
          </p>
        </section>
      </div>
    </main>
  );
}
