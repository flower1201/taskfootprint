import { describe, expect, it } from "vitest";
import { renderHtmlReport } from "../src/report/html.js";
import type { CheckResult, Snapshot } from "../src/types.js";

function emptySnap(): Snapshot {
  return {
    schemaVersion: 1,
    tool: "taskfootprint",
    toolVersion: "0.1.0-rc.1",
    capturedAt: "2026-01-01T00:00:00.000Z",
    rootFingerprint: "abcd",
    headSha: null,
    coverage: "COMPLETE",
    warnings: [],
    limits: { maxFiles: 100, maxTotalBytes: 1e9, maxFileBytes: 1e6 },
    stats: { fileCount: 0, totalBytes: 0, skipped: 0 },
    files: [],
  };
}

describe("HTML escaping", () => {
  it("escapes XSS payloads in paths and warnings", () => {
    const result: CheckResult = {
      baseline: emptySnap(),
      current: emptySnap(),
      changes: [
        {
          path: `<img src=x onerror=alert(1)>`,
          kind: "ADDED",
          scope: "outside",
          baselineHash: null,
          currentHash: "abc",
          baselineSize: null,
          currentSize: 1,
        },
      ],
      summary: {
        added: 1,
        modified: 0,
        deleted: 0,
        unchanged: 0,
        indeterminate: 0,
        withinScope: 0,
        outsideScope: 1,
        scopeIndeterminate: 0,
      },
      coverage: "COMPLETE",
      warnings: [`<script>alert("x")</script>`],
      allowed: [`src/**"><script>`],
      verdict: "FAIL_SCOPE",
      exitCode: 2,
    };
    const html = renderHtmlReport(result);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toMatch(/<img[^>]*onerror=/i);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).toContain("onerror=alert(1)"); // escaped as text inside <code>
  });
});
