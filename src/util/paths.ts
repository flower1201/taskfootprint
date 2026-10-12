import path from "node:path";

/** Normalize to POSIX relative path with forward slashes, no leading ./ */
export function toPosixRel(root: string, absPath: string): string {
  const rel = path.relative(root, absPath);
  return rel.split(path.sep).join("/");
}

export function normalizeRel(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

export function isInsideRoot(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedRoot === resolvedTarget) return true;
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  return resolvedTarget.startsWith(prefix);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function shortHash(hash: string, n = 12): string {
  return hash.slice(0, n);
}
