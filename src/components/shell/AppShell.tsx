"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { filterNav } from "@/components/shell/nav";
import { useProjectContext, useSession } from "@/hooks/use-app-data";

// spec-009-v1: app shell — role-aware sidebar + sticky topbar + content column.

function ProjectSwitcher() {
  const { projects, code, setCode } = useProjectContext();
  return (
    <select
      aria-label="Project"
      data-testid="project-switcher"
      value={code ?? ""}
      onChange={(e) => setCode(e.target.value)}
      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
    >
      {projects.map((p) => (
        <option key={p.id} value={p.code}>
          {p.code} · {p.name}
        </option>
      ))}
    </select>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  function toggleDark() {
    setDark((d) => {
      document.documentElement.classList.toggle("dark", !d);
      return !d;
    });
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const groups = filterNav(session?.role ?? null);

  const nav = (
    <nav className="flex flex-col gap-5 px-3">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{g.group}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const active = pathname === i.href || pathname.startsWith(i.href + "/");
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setMobileOpen(false)}
                    data-testid={`nav-${i.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className={`block rounded-lg px-2.5 py-1.5 text-sm ${
                      active
                        ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" data-testid="app-shell">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-zinc-200 bg-white px-2 py-4 dark:border-zinc-800 dark:bg-zinc-900 lg:flex">
        <div className="mb-4 px-2">
          <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">ProCare</p>
          <div className="mt-2"><ProjectSwitcher /></div>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <p className="px-2 text-[10px] text-zinc-400">ProCare · Trends EMC</p>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white p-4 dark:bg-zinc-900">
            <div className="mb-4"><ProjectSwitcher /></div>
            {nav}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 lg:pl-64">
        <button
          className="rounded-lg border border-zinc-200 px-2 py-1 text-sm lg:hidden dark:border-zinc-700"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
        <input
          placeholder="Search… (⌘K soon)"
          disabled
          className="hidden w-72 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-500 sm:block dark:border-zinc-700 dark:bg-zinc-800"
        />
        <div className="ml-auto flex items-center gap-3 py-2 pr-4">
          <button
            onClick={toggleDark}
            aria-label="Toggle dark mode"
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {dark ? "Light" : "Dark"}
          </button>
          {session && (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-zinc-500 sm:block">{session.name} · {session.role}</span>
              <button
                onClick={logout}
                className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-4 sm:px-6 sm:py-6 lg:pl-64">{children}</main>
    </div>
  );
}
