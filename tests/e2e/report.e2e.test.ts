import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { captureSnapshot, writeSnapshotFile } from "../../src/snapshot.js";
import { runCheck } from "../../src/compare.js";
import { writeReport } from "../../src/report/write-report.js";

let tmp = "";
let htmlPath = "";

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
  const result = await runCheck({
    root: tmp,
    baseline,
    allow: ["src/**"],
    excludePaths: ["baseline.json"],
  });
  const out = path.join(tmp, "report");
  const paths = await writeReport(result, out);
  htmlPath = paths.htmlPath;
});

afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe("file:// report e2e", () => {
  it("loads offline without external resources and shows verdict", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const requests: string[] = [];
      page.on("request", (req) => requests.push(req.url()));
      await page.goto(pathToFileURL(htmlPath).href);
      const verdict = await page.locator("#verdict").innerText();
      expect(verdict).toBe("FAIL_SCOPE");
      const body = await page.locator("body").innerText();
      expect(body).toContain("Outside scope");
      expect(body).toContain("README.md");
      const external = requests.filter(
        (u) => !u.startsWith("file:") && !u.startsWith("data:"),
      );
      expect(external).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
