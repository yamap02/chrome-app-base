import assert from "node:assert/strict";
import test from "node:test";
import { stat, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

async function getZipArtifactPath() {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  return path.join(repoRoot, ".output", `${packageJson.name}-${packageJson.version}-chrome.zip`);
}

test("zip artifact 存在", async () => {
  const zipArtifactPath = await getZipArtifactPath();
  const zipStat = await stat(zipArtifactPath);

  assert.ok(zipStat.isFile());
  assert.ok(zipStat.size > 0);
});

test("zip artifact に必須配布物含有", async () => {
  const zipArtifactPath = await getZipArtifactPath();
  const { stdout } = await execFileAsync("unzip", ["-Z1", zipArtifactPath], {
    cwd: repoRoot,
  });
  const entries = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

  assert.ok(entries.includes("manifest.json"));
  assert.ok(entries.includes("background.js"));
  assert.ok(entries.includes("popup.html"));
});
