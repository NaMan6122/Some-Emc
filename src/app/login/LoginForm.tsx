"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.replace(next.startsWith("/") ? next : "/");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Login failed");
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none " +
    "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/30 disabled:bg-zinc-100";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e2) => setEmail(e2.target.value)}
          className={inputCls}
          disabled={pending}
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e2) => setPassword(e2.target.value)}
          className={inputCls}
          disabled={pending}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
