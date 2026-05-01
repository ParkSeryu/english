import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const isEnabled = process.env.VERIFY_EXECUTABLE_RLS === "1";
const scriptPath = path.resolve(process.cwd(), "scripts/verify-topic-folder-access-rls.sh");
const hasDocker = existsSync("/usr/bin/docker") || existsSync("/bin/docker") || existsSync("/usr/local/bin/docker");
const shouldRun = isEnabled && hasDocker && existsSync(scriptPath);

describe.skipIf(!shouldRun)("Executable RLS security smoke tests", () => {
  it("passes local SQL RLS verification script", async () => {
    const result = spawnSync("bash", [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, POSTGRES_IMAGE: process.env.POSTGRES_IMAGE || "postgres:16-alpine", HOME: process.env.HOME },
      timeout: 120000
    });

    if (result.error) throw result.error;
    if (typeof result.status === "number" && result.status !== 0) {
      throw new Error(`RLS script failed with status ${result.status}: ${(result.stderr || "").trim()}`);
    }

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(output).toContain("topic-folder-access RLS verification passed");
  });
});
