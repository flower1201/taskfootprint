import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readlink } from "node:fs/promises";

export async function hashFile(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export async function hashSymlink(absPath: string): Promise<string> {
  const target = await readlink(absPath);
  return createHash("sha256").update(`symlink:${target}`).digest("hex");
}

export function rootFingerprint(cwd: string, headSha: string | null): string {
  const material = `taskfootprint|${headSha ?? "no-git"}|${cwd.length}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}
