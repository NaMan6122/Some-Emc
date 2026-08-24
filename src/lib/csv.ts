// spec-018-v1: shared CSV conventions cloned from the spec-007 LPO exporter —
// RFC-style escaping, fils-exact AED money strings, ISO dates, attachment
// disposition, utf-8.

export function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export type CsvCell = string | number | bigint | boolean | null | undefined;

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = rows.map((r) => r.map((c) => csvEscape(c == null ? "" : String(c))).join(","));
  return [headers.join(","), ...lines].join("\n");
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ---------------------------------------------------------------------------
// Parsing (spec-021-v1): RFC-4180-ish reader for bulk import. Handles quoted
// cells (embedded commas/newlines/escaped quotes) and CRLF. Throws
// CsvParseError on structurally broken input (unclosed quote).
// ---------------------------------------------------------------------------

export class CsvParseError extends Error {}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      if (cell !== "") throw new CsvParseError("Unexpected quote inside unquoted cell");
      inQuotes = true;
    } else if (c === ",") {
      pushCell();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushCell();
      pushRow();
    } else {
      cell += c;
    }
    i++;
  }
  if (inQuotes) throw new CsvParseError("Unclosed quoted cell");
  pushCell();
  pushRow();
  return rows;
}

