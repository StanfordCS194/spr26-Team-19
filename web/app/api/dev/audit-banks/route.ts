import { NextResponse } from "next/server";
import { auditCuratedBanks } from "@/lib/numpy-bank-audit";

/**
 * Dev-only QA endpoint: statically audits the curated coding-problem banks and
 * returns a JSON report. Runnable headlessly during `next dev`:
 *
 *   curl -s http://localhost:3000/api/dev/audit-banks | jq
 *
 * Returns HTTP 200 when every check passes, 500 otherwise — usable as a guard.
 * Solvability (running each problem through the real grader) is verified by the
 * browser page at /dev/bank-check, since Pyodide is browser-only.
 */
export async function GET() {
  const report = auditCuratedBanks();
  return NextResponse.json(report, { status: report.ok ? 200 : 500 });
}
