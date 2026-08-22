// spec-006-v1: advisory duplicate-suggestion heuristics.
// Pure functions — unit tested. Suggestions are ADVISORY ONLY; uniqueness and
// merges are always explicit human actions (see PRD FR-3 / spec risk note).

const STOP_TOKENS = new Set(["MS", "M", "S", "LLC", "L", "FZC", "FZE", "PSC"]);

function tokens(name: string): string[] {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP_TOKENS.has(t));
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}

function tokenMatch(a: string, b: string): boolean {
  return a === b || levenshtein(a, b) <= 2;
}

/** Every token of the smaller set must find an exact/near partner in the larger set. */
export function similarity(a: string, b: string): number | null {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return null;
  const [small, large] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (large.length - small.length > 1) return null; // too different in size
  let matchedChars = 0;
  for (const t of small) {
    const hit = large.find((u) => tokenMatch(t, u));
    if (!hit) return null;
    matchedChars += Math.min(t.length, hit.length);
  }
  const score = small.length / large.length;
  // Weight by character agreement so "AL SILMIYA" vs "AL MAJID" style pairs don't score.
  return score * (matchedChars / Math.max(small.join("").length, 1));
}

export type DuplicatePair = { aId: number; bId: number; score: number };

export function findDuplicatePairs(
  suppliers: { id: number; name: string }[],
  threshold = 0.6,
): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  for (let i = 0; i < suppliers.length; i++) {
    for (let j = i + 1; j < suppliers.length; j++) {
      const score = similarity(suppliers[i].name, suppliers[j].name);
      if (score !== null && score >= threshold) {
        out.push({ aId: suppliers[i].id, bId: suppliers[j].id, score: Number(score.toFixed(2)) });
      }
    }
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 20);
}
