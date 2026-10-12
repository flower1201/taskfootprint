import { spawn } from "node:child_process";
import path from "node:path";

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

/** Run git with argv array only — never shell-concatenated. */
export function runGit(
  cwd: string,
  args: string[],
  opts?: { maxBuffer?: number },
): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const max = opts?.maxBuffer ?? 16 * 1024 * 1024;
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let total = 0;
    let truncated = false;

    child.stdout.on("data", (buf: Buffer) => {
      total += buf.length;
      if (total <= max) chunks.push(buf);
      else truncated = true;
    });
    child.stderr.on("data", (buf: Buffer) => {
      errChunks.push(buf);
    });
    child.on("error", (err) => {
      resolve({
        ok: false,
        stdout: "",
        stderr: err.message,
        code: null,
      });
    });
    child.on("close", (code) => {
      const stdout = Buffer.concat(chunks).toString("utf8");
      const stderr =
        Buffer.concat(errChunks).toString("utf8") +
        (truncated ? "\n[stdout truncated]" : "");
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        code,
      });
    });
  });
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  const r = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return r.ok && r.stdout.trim() === "true";
}

export async function getHeadSha(cwd: string): Promise<string | null> {
  const r = await runGit(cwd, ["rev-parse", "HEAD"]);
  if (!r.ok) return null;
  const sha = r.stdout.trim();
  return /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
}

/** NUL-separated relative paths from git ls-files -z --others --cached --exclude-standard */
export async function listGitVisibleFiles(cwd: string): Promise<{
  paths: string[];
  incomplete: boolean;
  warning?: string;
}> {
  const r = await runGit(cwd, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ]);
  if (!r.ok) {
    return {
      paths: [],
      incomplete: true,
      warning: `git ls-files failed: ${r.stderr.trim() || "unknown error"}`,
    };
  }
  const parts = r.stdout.split("\0").filter(Boolean);
  const paths = parts
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => p.length > 0 && !p.includes("\0"));
  return { paths, incomplete: false };
}

export function resolveUnderRoot(root: string, rel: string): string | null {
  const abs = path.resolve(root, rel);
  const resolvedRoot = path.resolve(root);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  if (abs !== resolvedRoot && !abs.startsWith(prefix)) return null;
  if (rel.includes("\0") || path.isAbsolute(rel)) return null;
  const normalized = path.normalize(rel);
  if (normalized.startsWith("..")) return null;
  return abs;
}
