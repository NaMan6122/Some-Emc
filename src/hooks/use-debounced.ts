"use client";

import { useEffect, useState } from "react";

// design.md §8: 300ms debounce for free-text filters (spec-010).
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
