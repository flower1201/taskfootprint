import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CheckResult } from "../types.js";
import { renderHtmlReport } from "./html.js";

export async function writeReport(
  result: CheckResult,
  outDir: string,
): Promise<{ htmlPath: string; jsonPath: string; summaryPath: string }> {
  const abs = path.resolve(outDir);
  await mkdir(abs, { recursive: true });

  const jsonPath = path.join(abs, "changes.json");
  const htmlPath = path.join(abs, "index.html");
  const summaryPath = path.join(abs, "summary.md");

  const jsonDoc = {
    schemaVersion: 1,
    tool: "taskfootprint",
    verdict: result.verdict,
    exitCode: result.exitCode,
    coverage: result.coverage,
    allowed: result.allowed,
    summary: result.summary,
    warnings: result.warnings,
    baseline: {
      capturedAt: result.baseline.capturedAt,
      headSha: result.baseline.headSha,
      rootFingerprint: result.baseline.rootFingerprint,
      fileCount: result.baseline.stats.fileCount,
      coverage: result.baseline.coverage,
    },
    current: {
      capturedAt: result.current.capturedAt,
      headSha: result.current.headSha,
      rootFingerprint: result.current.rootFingerprint,
      fileCount: result.current.stats.fileCount,
      coverage: result.current.coverage,
    },
    changes: result.changes,
  };

  const md = [
    `# TaskFootprint summary`,
    ``,
    `**Verdict:** ${result.verdict}`,
    `**Coverage:** ${result.coverage}`,
    ``,
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Added | ${result.summary.added} |`,
    `| Modified | ${result.summary.modified} |`,
    `| Deleted | ${result.summary.deleted} |`,
    `| Within scope | ${result.summary.withinScope} |`,
    `| Outside scope | ${result.summary.outsideScope} |`,
    ``,
    `## Allow patterns`,
    ...(result.allowed.length
      ? result.allowed.map((a) => `- \`${a}\``)
      : ["- _(none — report-only)_"]),
    ``,
    `## Changes`,
    ...(result.changes.length
      ? result.changes.map(
          (c) => `- \`${c.path}\` — ${c.kind} · scope=${c.scope}`,
        )
      : ["- _(none)_"]),
    ``,
    `## Warnings`,
    ...(result.warnings.length
      ? result.warnings.map((w) => `- ${w}`)
      : ["- _(none)_"]),
    ``,
    `> Local sensitive artifact. Review before sharing. Not a runtime sandbox.`,
    ``,
  ].join("\n");

  await writeFile(jsonPath, JSON.stringify(jsonDoc, null, 2) + "\n", "utf8");
  await writeFile(htmlPath, renderHtmlReport(result), "utf8");
  await writeFile(summaryPath, md, "utf8");

  return { htmlPath, jsonPath, summaryPath };
}
