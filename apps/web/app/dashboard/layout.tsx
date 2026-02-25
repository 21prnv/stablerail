import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Merchant Dashboard | Stablerail",
  description: "Manage payment links and settings",
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-semibold tracking-tight text-black">
            Stablerail Dashboard
          </h1>
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-neutral-600 hover:text-black transition-colors"
            >
              Payment links
            </Link>
            <Link
              href="/dashboard/create"
              className="text-sm font-medium text-neutral-600 hover:text-black transition-colors"
            >
              Create link
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-neutral-600 hover:text-black transition-colors"
            >
              Home
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
