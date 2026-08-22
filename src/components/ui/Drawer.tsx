"use client";

import { useEffect } from "react";

// spec-010: right detail drawer (480px) per design.md §8.
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
      >
        <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
          >
            Esc ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
