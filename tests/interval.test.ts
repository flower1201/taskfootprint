import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { captureSnapshot } from "../src/snapshot.js";
import { runCheck } from "../src/compare.js";

const temps: string[] = [];

afterEach(async () => {
  for (const t of temps.splice(0)) {
    await rm(t, { recursive: true, force: true });
  }
});

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tf-"));
  temps.push(dir);
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.name", "Test"], {
    cwd: dir,
    stdio: "ignore",
  });
  await writeFile(path.join(dir, ".gitignore"), "node_modules/\n.env\n");
  await mkdir(path.join(dir, "src"), { recursive: true });
  await mkdir(path.join(dir, "tests"), { recursive: true });
  await writeFile(path.join(dir, "README.md"), "# demo\n");
  await writeFile(path.join(dir, "src", "app.ts"), "export const a = 1;\n");
  execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });
  return dir;
}

describe("interval semantics", () => {
  it("does not attribute pre-existing dirty README as interval change", async () => {
    const dir = await makeRepo();
    // Pre-task dirty
    await writeFile(path.join(dir, "README.md"), "# demo\npre-dirty\n");
    const baseline = await captureSnapshot({ root: dir });

    // Agent only changes src
    await writeFile(path.join(dir, "src", "app.ts"), "export const a = 2;\n");
    const result = await runCheck({
      root: dir,
      baseline,
      allow: ["src/**"],
    });

    expect(result.changes.find((c) => c.path === "README.md")).toBeUndefined();
    expect(result.changes.some((c) => c.path === "src/app.ts")).toBe(true);
    expect(result.verdict).toBe("PASS");
    expect(result.exitCode).toBe(0);
  });

  it("detects content change of pre-existing untracked file", async () => {
    const dir = await makeRepo();
    await writeFile(path.join(dir, "scratch.txt"), "v1\n");
    const baseline = await captureSnapshot({ root: dir });
    await writeFile(path.join(dir, "scratch.txt"), "v2\n");
    const result = await runCheck({
      root: dir,
      baseline,
      allow: ["src/**"],
    });
    const hit = result.changes.find((c) => c.path === "scratch.txt");
    expect(hit?.kind).toBe("MODIFIED");
    expect(hit?.scope).toBe("outside");
    expect(result.exitCode).toBe(2);
  });

  it("flags out-of-scope adds and new directories", async () => {
    const dir = await makeRepo();
    const baseline = await captureSnapshot({ root: dir });
    await mkdir(path.join(dir, "docs"), { recursive: true });
    await writeFile(path.join(dir, "docs", "note.md"), "hi\n");
    await writeFile(path.join(dir, "src", "util.ts"), "export {}\n");
    const result = await runCheck({
      root: dir,
      baseline,
      allow: ["src/**", "tests/**"],
    });
    expect(result.summary.outsideScope).toBeGreaterThan(0);
    expect(result.changes.some((c) => c.path === "docs/note.md")).toBe(true);
    expect(result.changes.some((c) => c.path === "src/util.ts" && c.scope === "within")).toBe(
      true,
    );
    expect(result.exitCode).toBe(2);
  });

  it("detects deletes", async () => {
    const dir = await makeRepo();
    await writeFile(path.join(dir, "src", "doomed.ts"), "x\n");
    const baseline = await captureSnapshot({ root: dir });
    await rm(path.join(dir, "src", "doomed.ts"));
    const result = await runCheck({
      root: dir,
      baseline,
      allow: ["src/**"],
    });
    expect(
      result.changes.find((c) => c.path === "src/doomed.ts")?.kind,
    ).toBe("DELETED");
  });
});
