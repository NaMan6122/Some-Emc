"use client";

import Link from "next/link";
import { useSession } from "@/hooks/use-app-data";
import { useEffect, useState } from "react";

export function LandingClient() {
  const { session, isLoading } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isAuthed = !!session;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* Sticky header */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur transition-colors ${
          scrolled
            ? "border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/80"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">P</div>
            <span className="text-lg font-semibold tracking-tight">ProCare</span>
            <span className="hidden rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 sm:inline">Trends EMC</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-300 sm:flex">
            <a href="#features" className="hover:text-zinc-900 dark:hover:text-zinc-100">Features</a>
            <a href="#dashboards" className="hover:text-zinc-900 dark:hover:text-zinc-100">Dashboards</a>
            <a href="#quality" className="hover:text-zinc-900 dark:hover:text-zinc-100">Data Quality</a>
          </nav>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            ) : isAuthed ? (
              <Link
                href="/overview"
                className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 sm:block">
                  Sign in
                </Link>
                <Link href="/login" className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero — fullscreen GIF background */}
      <section className="relative isolate flex min-h-screen items-center overflow-hidden">
        {/* GIF background — swappable: drop your file at public/hero.gif */}
        {/* If no GIF exists, the gradient fallback below is visible */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage: "url('/hero.gif'), radial-gradient(1200px 600px at 80% -10%, #6366f1 0%, transparent 60%), radial-gradient(900px 500px at -10% 30%, #06b6d4 0%, transparent 55%), linear-gradient(180deg, #fafafa 0%, #eef2ff 100%)",
            backgroundColor: "#fafafa",
          }}
        />
        {/* Strong overlay for readability on top of GIF */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/70 via-white/60 to-white/90 dark:from-zinc-950/70 dark:via-zinc-950/60 dark:to-zinc-950/90" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />

        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 pb-12 pt-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live on Neon · Project 1571 seeded
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.02]">
              Procurement
              <span className="block bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">that balances.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-6 text-zinc-600 dark:text-zinc-300">
              ProCare turns your LPO log, JCA budgets, payment certificates and variation orders into a single source of truth — with live variance, cash-flow and vendor analytics. The source of truth stays audited, the reports stay reproducible, the flags stay visible.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {isAuthed ? (
                <Link href="/overview" className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                  Open Overview
                </Link>
              ) : (
                <Link href="/login" className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                  Sign in to ProCare
                </Link>
              )}
              <a href="#features" className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Explore features
              </a>
            </div>

            {/* Pill stats — real seeded anchors */}
            <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["AED 12.98M", "LPOs committed"],
                ["AED 10.33M", "Certified net"],
                ["81.8%", "Recovery rate"],
              ].map(([v, k]) => (
                <div key={k} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
                  <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{k}</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 text-xs text-zinc-500">
              Drop your GIF at <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">public/hero.gif</code> to replace the gradient — no code change needed.
            </p>
          </div>

          {/* Right — preview card stack */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[28px] bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-cyan-500/20 blur-2xl" />
            <div className="rounded-[20px] border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Live dashboard preview</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">● Live</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Budget variance", "FIRE_FIGHTING — no JCA line", "AED 1,583,925"],
                  ["Retention", "Held vs released", "AED 489,097"],
                  ["Vendors", "14 near-duplicates flagged", "18 findings"],
                  ["Import", "CSV dry-run + bulk", "All-or-nothing"],
                ].map(([t, s, v]) => (
                  <div key={t} className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-zinc-500">{s}</p>
                    <p className="mt-2 font-mono text-xs font-semibold tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800">
                <span className="text-zinc-500">Mid Island Parkway · 1571</span>
                <Link href={isAuthed ? "/report?project=1571" : "/login"} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                  {isAuthed ? "Open printable report →" : "Sign in to view →"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Everything the paper trail was trying to do</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">One validated system of record. Server-computed totals. Audited everywhere money moves.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["LPO Register", "Revisions with R-suffixes, verification states, VO linkage, CSV import. Money exact to the fils."],
            ["JCA Budgets & Variance", "Per-trade utilisation, watch/over bands, coverage gaps surfaced — not hidden."],
            ["Payment Certificates", "Net = gross − retention enforced, gapless numbering advisory, cumulative cross-check."],
            ["Variation Orders", "DRAFT → SUBMITTED → APPROVED/REJECTED, approval completeness, unapproved exposure."],
            ["Live Dashboards", "Six tabs that reproduce the legacy report KPIs at DB-exact precision."],
            ["Data-Quality Queue", "Duplicate suppliers, missing JCA lines, PC gaps, unapproved claims — triageable."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboards strip */}
      <section id="dashboards" className="border-y border-zinc-200 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h3 className="text-lg font-semibold">Dashboards that stay honest</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Budget, cash-flow, investment, vendors, flags — every figure is an SQL aggregate behind an audit log. No client-side totals, no hand-maintained sums.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["Overview", "/overview"],
              ["Budget", "/budget"],
              ["Payment Certificates", "/payment-certificates"],
              ["Investment", "/investment"],
              ["Vendors", "/vendors"],
              ["Printable Report", "/report?project=1571"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={isAuthed ? href : "/login"}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quality */}
      <section id="quality" className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-[24px] border border-zinc-200 bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-600 p-[1px] dark:border-zinc-800">
          <div className="rounded-[23px] bg-white p-8 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Data quality you can triage</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Flags surface automatically — missing budget lines, phantom vendors, PC gaps, unapproved variation claims. Assign, resolve or mark won&apos;t-fix with a note. Every resolution is audited.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={isAuthed ? "/flags" : "/login"} className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
                Open Flags Queue
              </Link>
              <span className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                Retention ledger · CSV exports · Cross-project allocations included
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Trends Electro-Mechanical Works LLC · ProCare Platform</span>
          <span className="font-mono text-[11px]">AED-only · Neon Postgres · Next.js 15</span>
        </div>
      </footer>
    </div>
  );
}
