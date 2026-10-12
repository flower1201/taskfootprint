import { minimatch } from "minimatch";
import type { ScopeClass } from "./types.js";
import { normalizeRel } from "./util/paths.js";

/**
 * First matching allow pattern wins (order preserved).
 * No allow patterns → everything is "within" (report-only mode).
 */
export function classifyScope(
  filePath: string,
  allowPatterns: string[],
): ScopeClass {
  const rel = normalizeRel(filePath);
  if (allowPatterns.length === 0) return "within";

  // Reject absolute / escape attempts as indeterminate
  if (pathLooksUnsafe(rel)) return "indeterminate";

  for (const pattern of allowPatterns) {
    const p = pattern.replace(/\\/g, "/");
    if (!p) continue;
    try {
      if (
        minimatch(rel, p, {
          dot: true,
          nocase: process.platform === "win32",
        })
      ) {
        return "within";
      }
    } catch {
      return "indeterminate";
    }
  }
  return "outside";
}

function pathLooksUnsafe(rel: string): boolean {
  if (!rel) return true;
  if (rel.includes("\0")) return true;
  if (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) return true;
  const parts = rel.split("/");
  return parts.some((p) => p === "..");
}
