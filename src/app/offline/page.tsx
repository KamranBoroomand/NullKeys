import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  description: "NullKeys is offline and the requested page is not cached yet.",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
      <section className="space-y-5" aria-labelledby="offline-title">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Offline</p>
        <h1 id="offline-title" className="text-3xl font-medium tracking-tight text-text">
          This page is not cached yet.
        </h1>
        <p className="max-w-xl text-sm leading-6 text-textMuted">
          Saved practice history remains on this device. Reconnect once to load this page, or return
          to a section you opened while online.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-9 items-center rounded-[0.4rem] border border-accent/35 bg-accentSoft px-3 py-2 text-sm font-medium text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Return to NullKeys
        </Link>
      </section>
    </main>
  );
}
