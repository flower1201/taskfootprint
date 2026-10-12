import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { captureSnapshot, writeSnapshotFile } from "../../src/snapshot.js";
import { runCheck } from "../../src/compare.js";
import { writeReport } from "../../src/report/write-report.js";
import { renderHtmlReport } from "../../src/report/html.js";
import type { CheckResult } from "../../src/types.js";

let tmp = "";
let htmlPath = "";
let jsonPath = "";
let checkResult: CheckResult;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "tf-e2e-"));
  execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "e2e@example.com"], {
    cwd: tmp,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.name", "E2E"], {
    cwd: tmp,
    stdio: "ignore",
  });
  await mkdir(path.join(tmp, "src"), { recursive: true });
  await writeFile(path.join(tmp, "src", "a.ts"), "export const a=1\n");
  execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: tmp, stdio: "ignore" });

  const baseline = await captureSnapshot({ root: tmp });
  await writeSnapshotFile(baseline, path.join(tmp, "baseline.json"));
  await writeFile(path.join(tmp, "src", "a.ts"), "export const a=2\n");
  await writeFile(path.join(tmp, "README.md"), "oops\n");
  checkResult = await runCheck({
    root: tmp,
    baseline,
    allow: ["src/**"],
    excludePaths: ["baseline.json"],
  });
  const out = path.join(tmp, "report");
  const paths = await writeReport(checkResult, out);
  htmlPath = paths.htmlPath;
  jsonPath = paths.jsonPath;
});

afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe("file:// report e2e", () => {
  it("loads offline via pathToFileURL with matching verdict and no external requests", async () => {
    const json = JSON.parse(await readFile(jsonPath, "utf8")) as {
      verdict: string;
      changes: Array<{ path: string; kind: string; scope: string }>;
    };
    expect(json.verdict).toBe("FAIL_SCOPE");
    expect(json.changes.some((c) => c.path === "README.md" && c.scope === "outside")).toBe(
      true,
    );
    expect(
      json.changes.some(
        (c) => c.path === "src/a.ts" && c.kind === "MODIFIED" && c.scope === "within",
      ),
    ).toBe(true);

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      const requests: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(String(err)));
      page.on("request", (req) => requests.push(req.url()));

      const fileUrl = pathToFileURL(htmlPath).href;
      expect(fileUrl.startsWith("file:")).toBe(true);
      await page.goto(fileUrl);

      const verdict = await page.locator("#verdict").innerText();
      expect(verdict).toBe(json.verdict);
      expect(verdict).toBe(checkResult.verdict);

      const body = await page.locator("body").innerText();
      // Card labels use CSS text-transform: uppercase
      expect(body.toLowerCase()).toContain("outside scope");
      expect(body).toContain("README.md");
      expect(body).toContain("src/a.ts");
      expect(body).toContain("MODIFIED");
      expect(body).toContain("outside"); // scope column for README.md

      const external = requests.filter(
        (u) => !u.startsWith("file:") && !u.startsWith("data:"),
      );
      expect(external).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally {
      await browser.close();
    }
  });

  it("does not execute XSS payloads embedded in report fields", async () => {
    const xssResult: CheckResult = {
      ...checkResult,
      warnings: [`<img src=x onerror="window.__xss=1">`],
      changes: [
        {
          path: `<script>window.__xss=1</script>`,
          kind: "ADDED",
          scope: "outside",
          baselineHash: null,
          currentHash: "abc",
          baselineSize: null,
          currentSize: 1,
        },
      ],
      allowed: [`src/**"><img src=x onerror=alert(1)>`],
    };
    const xssHtmlPath = path.join(tmp, "report", "xss.html");
    await writeFile(xssHtmlPath, renderHtmlReport(xssResult), "utf8");

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(xssHtmlPath).href);
      const flagged = await page.evaluate(() => {
        const w = window as unknown as { __xss?: number };
        return w.__xss === 1;
      });
      expect(flagged).toBe(false);
      const html = await page.content();
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toMatch(/<script>window\.__xss=1<\/script>/);
    } finally {
      await browser.close();
    }
  });
});
