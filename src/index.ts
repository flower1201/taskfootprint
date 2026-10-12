export { VERSION } from "./version.js";
export { captureSnapshot, readSnapshotFile, writeSnapshotFile } from "./snapshot.js";
export { runCheck } from "./compare.js";
export { classifyScope } from "./scope.js";
export { writeReport } from "./report/write-report.js";
export { renderHtmlReport } from "./report/html.js";
export type {
  Snapshot,
  CheckResult,
  ChangeRecord,
  FileEntry,
  ScopeClass,
  ChangeKind,
} from "./types.js";
