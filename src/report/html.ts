import type { CheckResult } from "../types.js";
import { escapeHtml, shortHash } from "../util/paths.js";
import { VERSION } from "../version.js";

export function renderHtmlReport(result: CheckResult): string {
  const { summary, changes, verdict, coverage, warnings, allowed } = result;
  const groups = groupByDir(changes.map((c) => c.path));

  const rows = changes
    .map((c) => {
      const scopeClass =
        c.scope === "outside"
          ? "scope-out"
          : c.scope === "indeterminate"
            ? "scope-ind"
            : "scope-in";
      return `<tr class="${scopeClass}">
  <td><code>${escapeHtml(c.path)}</code></td>
  <td>${escapeHtml(c.kind)}</td>
  <td>${escapeHtml(c.scope)}</td>
  <td><code>${escapeHtml(c.baselineHash ? shortHash(c.baselineHash) : "—")}</code></td>
  <td><code>${escapeHtml(c.currentHash ? shortHash(c.currentHash) : "—")}</code></td>
</tr>`;
    })
    .join("\n");

  const warnHtml = warnings.length
    ? `<ul class="warn">${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`
    : `<p class="muted">No warnings.</p>`;

  const allowHtml = allowed.length
    ? `<ul>${allowed.map((a) => `<li><code>${escapeHtml(a)}</code></li>`).join("")}</ul>`
    : `<p class="muted">No allow patterns (report-only; all changes treated as within scope).</p>`;

  const dirList = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([dir, count]) =>
        `<li><code>${escapeHtml(dir || ".")}</code> · ${count}</li>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TaskFootprint Report</title>
<style>
  :root {
    --bg: #0e1116;
    --panel: #161b22;
    --text: #e7e5e4;
    --muted: #a8a29e;
    --pass: #14b8a6;
    --fail: #f43f5e;
    --warn: #f59e0b;
    --line: #292524;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
    background: radial-gradient(1200px 600px at 10% -10%, #134e4a55, transparent),
                radial-gradient(900px 500px at 100% 0%, #1c191755, transparent),
                var(--bg);
    color: var(--text);
    line-height: 1.5;
  }
  main { max-width: 1100px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.6rem; margin: 0 0 0.25rem; letter-spacing: -0.02em; }
  .sub { color: var(--muted); margin-bottom: 1.5rem; }
  .badge {
    display: inline-block; padding: 0.2rem 0.55rem; border-radius: 0.35rem;
    font-weight: 700; font-size: 0.85rem; letter-spacing: 0.04em;
  }
  .PASS { background: #134e4a; color: var(--pass); }
  .FAIL_SCOPE { background: #4c0519; color: var(--fail); }
  .INCOMPLETE { background: #451a03; color: var(--warn); }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem; margin: 1.25rem 0 1.75rem;
  }
  .card {
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 0.6rem; padding: 0.9rem 1rem;
  }
  .card .n { font-size: 1.6rem; font-weight: 700; }
  .card .l { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
  section { margin-top: 1.75rem; }
  h2 { font-size: 1.05rem; margin: 0 0 0.75rem; }
  table { width: 100%; border-collapse: collapse; background: var(--panel); border-radius: 0.6rem; overflow: hidden; }
  th, td { text-align: left; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
  th { color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  tr.scope-out { background: #4c051922; }
  tr.scope-ind { background: #451a0322; }
  code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 0.85em; }
  .warn { color: var(--warn); }
  .muted { color: var(--muted); }
  footer { margin-top: 2.5rem; color: var(--muted); font-size: 0.8rem; }
  ul { padding-left: 1.2rem; }
</style>
</head>
<body>
<main>
  <h1>TaskFootprint</h1>
  <p class="sub">Did your coding agent change more than it said?</p>
  <p>
    <span class="badge ${escapeHtml(verdict)}" id="verdict">${escapeHtml(verdict)}</span>
    · coverage <strong id="coverage">${escapeHtml(coverage)}</strong>
  </p>

  <div class="grid" id="stats">
    <div class="card"><div class="n">${summary.added}</div><div class="l">Added</div></div>
    <div class="card"><div class="n">${summary.modified}</div><div class="l">Modified</div></div>
    <div class="card"><div class="n">${summary.deleted}</div><div class="l">Deleted</div></div>
    <div class="card"><div class="n">${summary.withinScope}</div><div class="l">Within scope</div></div>
    <div class="card"><div class="n">${summary.outsideScope}</div><div class="l">Outside scope</div></div>
    <div class="card"><div class="n">${changes.length}</div><div class="l">Total changes</div></div>
  </div>

  <section>
    <h2>Allow scope</h2>
    ${allowHtml}
  </section>

  <section>
    <h2>By directory</h2>
    <ul id="by-dir">${dirList || '<li class="muted">No changes</li>'}</ul>
  </section>

  <section>
    <h2>Fingerprint summary</h2>
    <p class="muted">Baseline captured ${escapeHtml(result.baseline.capturedAt)} ·
    current ${escapeHtml(result.current.capturedAt)}</p>
    <p>Baseline files: ${result.baseline.stats.fileCount} ·
    Current files: ${result.current.stats.fileCount}</p>
    <p>Root fingerprint: <code>${escapeHtml(result.baseline.rootFingerprint)}</code>
    → <code>${escapeHtml(result.current.rootFingerprint)}</code></p>
  </section>

  <section>
    <h2>Warnings / coverage</h2>
    ${warnHtml}
  </section>

  <section>
    <h2>Changed files</h2>
    <table>
      <thead>
        <tr>
          <th>Path</th><th>Kind</th><th>Scope</th><th>Baseline</th><th>Current</th>
        </tr>
      </thead>
      <tbody id="changes">
        ${rows || '<tr><td colspan="5" class="muted">No changes in this interval.</td></tr>'}
      </tbody>
    </table>
  </section>

  <footer>
    TaskFootprint ${escapeHtml(VERSION)} · Offline local report · No CDN ·
    Do not publish this file without reviewing paths and metadata.
    This tool observes file changes; it is not a runtime sandbox.
  </footer>
</main>
</body>
</html>
`;
}

function groupByDir(paths: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of paths) {
    const i = p.lastIndexOf("/");
    const dir = i === -1 ? "" : p.slice(0, i);
    out[dir] = (out[dir] ?? 0) + 1;
  }
  return out;
}
