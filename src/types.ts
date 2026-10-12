import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const FileEntrySchema = z.object({
  path: z.string().min(1),
  hash: z.string().min(1),
  size: z.number().int().nonnegative(),
  kind: z.enum(["file", "symlink"]),
  mode: z.string().optional(),
});

export const SnapshotSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  tool: z.literal("taskfootprint"),
  toolVersion: z.string(),
  capturedAt: z.string(),
  rootFingerprint: z.string(),
  headSha: z.string().nullable(),
  coverage: z.enum(["COMPLETE", "INCOMPLETE"]),
  warnings: z.array(z.string()),
  limits: z.object({
    maxFiles: z.number().int().positive(),
    maxTotalBytes: z.number().int().positive(),
    maxFileBytes: z.number().int().positive(),
  }),
  stats: z.object({
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
  files: z.array(FileEntrySchema),
});

export type FileEntry = z.infer<typeof FileEntrySchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;

export type ChangeKind =
  | "ADDED"
  | "MODIFIED"
  | "DELETED"
  | "UNCHANGED"
  | "INDETERMINATE";

export type ScopeClass = "within" | "outside" | "indeterminate";

export interface ChangeRecord {
  path: string;
  kind: ChangeKind;
  scope: ScopeClass;
  baselineHash: string | null;
  currentHash: string | null;
  baselineSize: number | null;
  currentSize: number | null;
}

export interface CheckResult {
  baseline: Snapshot;
  current: Snapshot;
  changes: ChangeRecord[];
  summary: {
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
    indeterminate: number;
    withinScope: number;
    outsideScope: number;
    scopeIndeterminate: number;
  };
  coverage: "COMPLETE" | "INCOMPLETE";
  warnings: string[];
  allowed: string[];
  verdict: "PASS" | "FAIL_SCOPE" | "INCOMPLETE";
  exitCode: 0 | 1 | 2;
}

export interface ScanLimits {
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes: number;
}

export const DEFAULT_LIMITS: ScanLimits = {
  maxFiles: 50_000,
  maxTotalBytes: 512 * 1024 * 1024,
  maxFileBytes: 16 * 1024 * 1024,
};
