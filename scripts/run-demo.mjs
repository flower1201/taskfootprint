import { mkdtemp, mkdir, writeFile, cp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const cli = path.join(root, "dist", "cli", "index.js");
const outDemo = path.join(root, "examples", "out-demo");

await rm(outDemo, { recursive: true, force: true });
await mkdir(outDemo, { recursive: true });

const work = await mkdtemp(path.join(os.tmpdir(), "tf-demo-"));
try {
  execFileSync("git", ["init"], { cwd: work, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "demo@example.com"], {
    cwd: work,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.name", "Demo"], {
    cwd: work,
    stdio: "ignore",
  });
  await mkdir(path.join(work, "src"), { recursive: true });
  await mkdir(path.join(work, "tests"), { recursive: true });
  await writeFile(path.join(work, "README.md"), "# sample\n");
  await writeFile(path.join(work, "src", "app.ts"), "export const n = 1;\n");
  await writeFile(path.join(work, "tests", "app.test.ts"), "ok\n");
  await writeFile(path.join(work, ".gitignore"), "node_modules/\n.env\n");
  execFileSync("git", ["add", "."], { cwd: work, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: work, stdio: "ignore" });

  // Pre-existing dirty (must NOT count as interval change if unchanged later)
  await writeFile(path.join(work, "README.md"), "# sample\npre-dirty\n");

  const baseline = path.join(outDemo, "baseline.json");
  execFileSync(
    process.execPath,
    [cli, "snapshot", work, "--out", baseline],
    { stdio: "inherit" },
  );

  // Simulated agent work: in-scope + out-of-scope
  await writeFile(path.join(work, "src", "app.ts"), "export const n = 2;\n");
  await writeFile(path.join(work, "src", "util.ts"), "export const u = 1;\n");
  await mkdir(path.join(work, "docs"), { recursive: true });
  await writeFile(path.join(work, "docs", "secret-plan.md"), "do not touch\n");

  try {
    execFileSync(
      process.execPath,
      [
        cli,
        "check",
        work,
        "--baseline",
        baseline,
        "--allow",
        "src/**",
        "--allow",
        "tests/**",
        "--out",
        outDemo,
      ],
      { stdio: "inherit" },
    );
  } catch (err) {
    // Demo intentionally includes an out-of-scope file → exit 2
    if (err && typeof err === "object" && "status" in err && err.status !== 2) {
      throw err;
    }
  }

  console.log(`\nDemo report: ${path.join(outDemo, "index.html")}`);
  console.log("Open via file:// — expect FAIL_SCOPE due to docs/secret-plan.md");
} finally {
  await rm(work, { recursive: true, force: true });
}
