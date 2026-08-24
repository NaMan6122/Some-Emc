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
