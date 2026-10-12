import { lstat, readdir, readFile, readlink } from "node:fs/promises";
import path from "node:path";
import ignore from "ignore";
import type { FileEntry, ScanLimits } from "./types.js";
import { DEFAULT_LIMITS } from "./types.js";
import { hashFile, hashSymlink } from "./util/hash.js";
import {
  isGitRepo,
  listGitVisibleFiles,
  resolveUnderRoot,
} from "./util/git.js";
import { isInsideRoot, toPosixRel } from "./util/paths.js";

const DEFAULT_HARD_EXCLUDES = [
  ".git",
  "node_modules",
  ".taskfootprint",
  "dist",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
];

export interface ScanOptions {
  root: string;
  limits?: Partial<ScanLimits>;
  /** Extra relative paths to always skip (e.g. baseline / report dirs). */
  excludePaths?: string[];
  /** Explicit opt-in of gitignored relative paths (exact or directory prefix). */
  includeIgnored?: string[];
}

export interface ScanOutcome {
  files: FileEntry[];
  coverage: "COMPLETE" | "INCOMPLETE";
  warnings: string[];
  skipped: number;
  totalBytes: number;
  limits: ScanLimits;
}

async function loadGitignore(root: string): Promise<ReturnType<typeof ignore>> {
  const ig = ignore();
  ig.add(DEFAULT_HARD_EXCLUDES.map((d) => `${d}/`));
  try {
    const text = await readFile(path.join(root, ".gitignore"), "utf8");
    ig.add(text);
  } catch {
    // no .gitignore
  }
  return ig;
}

function shouldIncludeIgnored(
  rel: string,
  includeIgnored: string[],
): boolean {
  const n = rel.replace(/\\/g, "/");
  return includeIgnored.some((rule) => {
    const r = rule.replace(/\\/g, "/").replace(/\/$/, "");
    return n === r || n.startsWith(r + "/");
  });
}

async function walkFallback(
  root: string,
  ig: ReturnType<typeof ignore>,
  includeIgnored: string[],
  excludeSet: Set<string>,
  limits: ScanLimits,
): Promise<{
  candidates: string[];
  warnings: string[];
  incomplete: boolean;
}> {
  const candidates: string[] = [];
  const warnings: string[] = [];
  let incomplete = false;

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      incomplete = true;
      warnings.push(
        `cannot read directory ${toPosixRel(root, dir)}: ${(err as Error).message}`,
      );
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const rel = toPosixRel(root, abs);
      if (!rel || rel === "..") continue;
      if (excludeSet.has(rel)) continue;
      if (DEFAULT_HARD_EXCLUDES.includes(ent.name)) continue;

      const ignored = ig.ignores(rel) || ig.ignores(rel + "/");
      if (ignored && !shouldIncludeIgnored(rel, includeIgnored)) continue;

      if (ent.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (ent.isFile() || ent.isSymbolicLink()) {
        candidates.push(rel);
        if (candidates.length > limits.maxFiles) {
          incomplete = true;
          warnings.push(
            `file count exceeded maxFiles=${limits.maxFiles}; scan incomplete`,
          );
          return;
        }
      }
    }
  }

  await walk(root);
  return { candidates, warnings, incomplete };
}

export async function scanWorkspace(opts: ScanOptions): Promise<ScanOutcome> {
  const root = path.resolve(opts.root);
  const limits: ScanLimits = { ...DEFAULT_LIMITS, ...opts.limits };
  const includeIgnored = opts.includeIgnored ?? [];
  const excludeSet = new Set(
    (opts.excludePaths ?? []).map((p) => p.replace(/\\/g, "/")),
  );
  const warnings: string[] = [];
  let incomplete = false;
  let candidates: string[] = [];

  const git = await isGitRepo(root);
  if (git) {
    const listed = await listGitVisibleFiles(root);
    if (listed.incomplete) {
      incomplete = true;
      if (listed.warning) warnings.push(listed.warning);
    }
    candidates = listed.paths.filter((p) => !excludeSet.has(p));
    // Opt-in ignored files via filesystem check
    for (const extra of includeIgnored) {
      const abs = resolveUnderRoot(root, extra);
      if (!abs) {
        warnings.push(`include-ignored path escapes root: ${extra}`);
        incomplete = true;
        continue;
      }
      try {
        const st = await lstat(abs);
        if (st.isFile() || st.isSymbolicLink()) {
          if (!candidates.includes(extra.replace(/\\/g, "/"))) {
            candidates.push(extra.replace(/\\/g, "/"));
          }
        }
      } catch {
        // missing opt-in path is fine
      }
    }
  } else {
    const ig = await loadGitignore(root);
    const walked = await walkFallback(
      root,
      ig,
      includeIgnored,
      excludeSet,
      limits,
    );
    candidates = walked.candidates;
    warnings.push(...walked.warnings);
    incomplete = incomplete || walked.incomplete;
    warnings.push("not a git repository; used directory walk + .gitignore");
  }

  if (candidates.length > limits.maxFiles) {
    incomplete = true;
    warnings.push(
      `candidate files ${candidates.length} exceed maxFiles=${limits.maxFiles}`,
    );
    candidates = candidates.slice(0, limits.maxFiles);
  }

  const files: FileEntry[] = [];
  let totalBytes = 0;
  let skipped = 0;

  for (const rel of candidates.sort()) {
    const abs = resolveUnderRoot(root, rel);
    if (!abs) {
      skipped++;
      incomplete = true;
      warnings.push(`skipped unsafe path: ${rel}`);
      continue;
    }

    let st;
    try {
      st = await lstat(abs);
    } catch (err) {
      skipped++;
      incomplete = true;
      warnings.push(`stat failed ${rel}: ${(err as Error).message}`);
      continue;
    }

    if (st.isSymbolicLink()) {
      const target = await readlink(abs);
      const targetAbs = path.resolve(path.dirname(abs), target);
      if (!isInsideRoot(root, targetAbs)) {
        skipped++;
        warnings.push(`skipped external symlink: ${rel}`);
        continue;
      }
      const hash = await hashSymlink(abs);
      files.push({
        path: rel,
        hash,
        size: 0,
        kind: "symlink",
      });
      continue;
    }

    if (!st.isFile()) {
      skipped++;
      continue;
    }

    if (st.size > limits.maxFileBytes) {
      skipped++;
      incomplete = true;
      warnings.push(
        `skipped oversized file ${rel} (${st.size} > maxFileBytes=${limits.maxFileBytes})`,
      );
      continue;
    }

    if (totalBytes + st.size > limits.maxTotalBytes) {
      skipped++;
      incomplete = true;
      warnings.push(
        `total read budget exceeded at ${rel}; remaining files skipped`,
      );
      break;
    }

    try {
      const hash = await hashFile(abs);
      // consistency: re-stat size
      const st2 = await lstat(abs);
      if (st2.size !== st.size || !st2.isFile()) {
        skipped++;
        incomplete = true;
        warnings.push(`file changed during scan: ${rel}`);
        continue;
      }
      totalBytes += st.size;
      files.push({
        path: rel,
        hash,
        size: st.size,
        kind: "file",
        mode: (st.mode & 0o777).toString(8),
      });
    } catch (err) {
      skipped++;
      incomplete = true;
      warnings.push(`hash failed ${rel}: ${(err as Error).message}`);
    }
  }

  return {
    files,
    coverage: incomplete ? "INCOMPLETE" : "COMPLETE",
    warnings,
    skipped,
    totalBytes,
    limits,
  };
}
