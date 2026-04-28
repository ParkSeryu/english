import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const appDirs = ["app", "components", "lib"];

function allSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return allSourceFiles(full);
    if (/\.(ts|tsx)$/.test(entry)) return [full];
    return [];
  });
}

describe("MVP scope guard", () => {
  it("does not add AI, exam timer/ranking, broad notes, or voice UI scope to app source", () => {
    const combined = appDirs
      .flatMap((dir) => allSourceFiles(path.join(root, dir)))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
      .toLowerCase();

    expect(combined).not.toMatch(/openai|anthropic|ai tutor|generated example|ranking dashboard|exam timer|speechrecognition|getusermedia|microphone/);
  });

  it("documents the explicit voice and pronunciation exclusion", () => {
    const readme = readFileSync("README.md", "utf8").toLowerCase();
    expect(readme).toContain("voice/pronunciation features");
    expect(readme).toContain("excluded from mvp");
  });
});
