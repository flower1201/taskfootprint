import type {
  ChangeRecord,
  CheckResult,
  Snapshot,
} from "./types.js";
import { classifyScope } from "./scope.js";
import { captureSnapshot } from "./snapshot.js";
import path from "node:path";

export interface CheckOptions {
  root: string;
  baseline: Snapshot;
  allow: string[];
  excludePaths?: string[];
  includeIgnored?: string[];
}

export async function runCheck(opts: CheckOptions): Promise<CheckResult> {
  const root = path.resolve(opts.root);
  const current = await captureSnapshot({
    root,
    excludePaths: opts.excludePaths,
    includeIgnored: opts.includeIgnored,
    limits: opts.baseline.limits,
  });

  const baseMap = new Map(opts.baseline.files.map((f) => [f.path, f]));
  const curMap = new Map(current.files.map((f) => [f.path, f]));
  const allPaths = new Set([...baseMap.keys(), ...curMap.keys()]);

  const changes: ChangeRecord[] = [];
  for (const p of [...allPaths].sort()) {
    const b = baseMap.get(p);
    const c = curMap.get(p);
    let kind: ChangeRecord["kind"];
    if (b && c) {
      kind = b.hash === c.hash ? "UNCHANGED" : "MODIFIED";
    } else if (!b && c) {
      kind = "ADDED";
    } else if (b && !c) {
      kind = "DELETED";
    } else {
      kind = "INDETERMINATE";
    }

    const scope =
      kind === "UNCHANGED"
        ? "within"
        : classifyScope(p, opts.allow);

    changes.push({
      path: p,
      kind,
      scope: kind === "UNCHANGED" ? "within" : scope,
      baselineHash: b?.hash ?? null,
      currentHash: c?.hash ?? null,
      baselineSize: b?.size ?? null,
      currentSize: c?.size ?? null,
    });
  }

  const meaningful = changes.filter((c) => c.kind !== "UNCHANGED");
  const summary = {
    added: meaningful.filter((c) => c.kind === "ADDED").length,
    modified: meaningful.filter((c) => c.kind === "MODIFIED").length,
    deleted: meaningful.filter((c) => c.kind === "DELETED").length,
    unchanged: changes.filter((c) => c.kind === "UNCHANGED").length,
    indeterminate: meaningful.filter((c) => c.kind === "INDETERMINATE")
      .length,
    withinScope: meaningful.filter((c) => c.scope === "within").length,
    outsideScope: meaningful.filter((c) => c.scope === "outside").length,
    scopeIndeterminate: meaningful.filter(
      (c) => c.scope === "indeterminate",
    ).length,
  };

  const coverage =
    opts.baseline.coverage === "INCOMPLETE" ||
    current.coverage === "INCOMPLETE"
      ? "INCOMPLETE"
      : "COMPLETE";

  const warnings = [
    ...opts.baseline.warnings.map((w) => `baseline: ${w}`),
    ...current.warnings.map((w) => `current: ${w}`),
  ];

  if (
    opts.baseline.rootFingerprint !== current.rootFingerprint &&
    opts.baseline.headSha &&
    current.headSha &&
    opts.baseline.headSha !== current.headSha
  ) {
    warnings.push(
      `HEAD moved during interval: ${opts.baseline.headSha.slice(0, 8)} → ${current.headSha.slice(0, 8)}`,
    );
  }

  let verdict: CheckResult["verdict"] = "PASS";
  let exitCode: CheckResult["exitCode"] = 0;
  if (coverage === "INCOMPLETE") {
    verdict = "INCOMPLETE";
    exitCode = 1;
  } else if (summary.outsideScope > 0 || summary.scopeIndeterminate > 0) {
    verdict = "FAIL_SCOPE";
    exitCode = 2;
  }

  return {
    baseline: opts.baseline,
    current,
    changes: meaningful,
    summary,
    coverage,
    warnings,
    allowed: opts.allow,
    verdict,
    exitCode,
  };
}
