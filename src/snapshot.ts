import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { VERSION } from "./version.js";
import { scanWorkspace, type ScanOptions } from "./scan.js";
import {
  SCHEMA_VERSION,
  SnapshotSchema,
  type Snapshot,
} from "./types.js";
import { getHeadSha, isGitRepo } from "./util/git.js";
import { rootFingerprint } from "./util/hash.js";

export async function captureSnapshot(
  opts: ScanOptions,
): Promise<Snapshot> {
  const root = path.resolve(opts.root);
  const git = await isGitRepo(root);
  const headSha = git ? await getHeadSha(root) : null;
  const scanned = await scanWorkspace(opts);

  const snapshot: Snapshot = {
    schemaVersion: SCHEMA_VERSION,
    tool: "taskfootprint",
    toolVersion: VERSION,
    capturedAt: new Date().toISOString(),
    rootFingerprint: rootFingerprint(root, headSha),
    headSha,
    coverage: scanned.coverage,
    warnings: scanned.warnings,
    limits: scanned.limits,
    stats: {
      fileCount: scanned.files.length,
      totalBytes: scanned.totalBytes,
      skipped: scanned.skipped,
    },
    files: scanned.files,
  };

  return SnapshotSchema.parse(snapshot);
}

export async function writeSnapshotFile(
  snapshot: Snapshot,
  outPath: string,
): Promise<string> {
  const abs = path.resolve(outPath);
  await mkdir(path.dirname(abs), { recursive: true });
  const body = JSON.stringify(snapshot, null, 2) + "\n";
  await writeFile(abs, body, { encoding: "utf8", mode: 0o600 });
  try {
    await chmod(abs, 0o600);
  } catch {
    // Windows may ignore mode; best-effort
  }
  return abs;
}

export async function readSnapshotFile(filePath: string): Promise<Snapshot> {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(path.resolve(filePath), "utf8");
  const data = JSON.parse(raw) as unknown;
  return SnapshotSchema.parse(data);
}
