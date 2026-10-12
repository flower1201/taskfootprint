import path from "node:path";
import { Command } from "commander";
import { VERSION } from "../version.js";
import {
  captureSnapshot,
  readSnapshotFile,
  writeSnapshotFile,
} from "../snapshot.js";
import { runCheck } from "../compare.js";
import { writeReport } from "../report/write-report.js";

const program = new Command();

program
  .name("taskfootprint")
  .description(
    "See what actually changed while your AI coding agent worked. Local snapshots, scope checks, offline reports.",
  )
  .version(VERSION);

program
  .command("snapshot")
  .description("Capture a content-hash baseline of the workspace")
  .argument("[path]", "workspace root", ".")
  .requiredOption("-o, --out <file>", "baseline JSON output path")
  .option(
    "--include-ignored <path>",
    "opt-in a gitignored path (repeatable)",
    collect,
    [] as string[],
  )
  .option("--max-files <n>", "max files to hash", String(50_000))
  .action(
    async (
      target: string,
      opts: {
        out: string;
        includeIgnored: string[];
        maxFiles: string;
      },
    ) => {
      try {
        const root = path.resolve(target);
        const outAbs = path.resolve(opts.out);
        const excludePaths = [toRelIfInside(root, outAbs)].filter(
          Boolean,
        ) as string[];

        const maxFiles = Number.parseInt(opts.maxFiles, 10);
        if (!Number.isFinite(maxFiles) || maxFiles < 1) {
          fail("error: --max-files must be a positive integer", 1);
          return;
        }

        const snapshot = await captureSnapshot({
          root,
          excludePaths,
          includeIgnored: opts.includeIgnored,
          limits: { maxFiles },
        });
        const written = await writeSnapshotFile(snapshot, outAbs);
        console.log(`TaskFootprint ${VERSION}`);
        console.log(`snapshot: ${written}`);
        console.log(
          `files ${snapshot.stats.fileCount} · bytes ${snapshot.stats.totalBytes} · coverage ${snapshot.coverage}`,
        );
        if (snapshot.warnings.length) {
          for (const w of snapshot.warnings) console.warn(`warn: ${w}`);
        }
        if (snapshot.coverage === "INCOMPLETE") process.exitCode = 1;
      } catch (err) {
        fail(`error: ${(err as Error).message}`, 1);
      }
    },
  );

program
  .command("check")
  .description("Compare current workspace against a baseline snapshot")
  .argument("[path]", "workspace root", ".")
  .requiredOption("-b, --baseline <file>", "baseline JSON from snapshot")
  .option("-o, --out <dir>", "report output directory", "./taskfootprint-out")
  .option(
    "--allow <glob>",
    "allowed change glob (repeatable)",
    collect,
    [] as string[],
  )
  .option(
    "--include-ignored <path>",
    "opt-in a gitignored path (repeatable)",
    collect,
    [] as string[],
  )
  .option("--json", "print machine-readable JSON summary to stdout", false)
  .action(
    async (
      target: string,
      opts: {
        baseline: string;
        out: string;
        allow: string[];
        includeIgnored: string[];
        json: boolean;
      },
    ) => {
      try {
        const root = path.resolve(target);
        const outDir = path.resolve(opts.out);
        const baselinePath = path.resolve(opts.baseline);
        const excludePaths = [
          toRelIfInside(root, baselinePath),
          toRelIfInside(root, outDir),
          // exclude report children heuristically
          ...["index.html", "changes.json", "summary.md"].map((f) =>
            toRelIfInside(root, path.join(outDir, f)),
          ),
        ].filter(Boolean) as string[];

        const baseline = await readSnapshotFile(baselinePath);
        const result = await runCheck({
          root,
          baseline,
          allow: opts.allow,
          excludePaths,
          includeIgnored: opts.includeIgnored,
        });
        const paths = await writeReport(result, outDir);

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                verdict: result.verdict,
                exitCode: result.exitCode,
                coverage: result.coverage,
                summary: result.summary,
                report: {
                  html: paths.htmlPath,
                  json: paths.jsonPath,
                  summary: paths.summaryPath,
                },
              },
              null,
              2,
            ),
          );
        } else {
          console.log(`TaskFootprint ${VERSION}`);
          console.log(`verdict: ${result.verdict} (exit ${result.exitCode})`);
          console.log(
            `changes +${result.summary.added} ~${result.summary.modified} -${result.summary.deleted}` +
              ` · within ${result.summary.withinScope} · outside ${result.summary.outsideScope}`,
          );
          console.log(`wrote ${paths.htmlPath}`);
          console.log(`wrote ${paths.jsonPath}`);
          console.log(`wrote ${paths.summaryPath}`);
          for (const w of result.warnings) console.warn(`warn: ${w}`);
        }
        process.exitCode = result.exitCode;
      } catch (err) {
        fail(`error: ${(err as Error).message}`, 1);
      }
    },
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  fail(`error: ${(err as Error).message}`, 1);
});

function collect(value: string, acc: string[]): string[] {
  acc.push(value);
  return acc;
}

function toRelIfInside(root: string, abs: string): string | null {
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

function fail(msg: string, code: number): void {
  console.error(msg);
  process.exitCode = code;
}
