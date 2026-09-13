import assert from "node:assert/strict";
import test from "node:test";
import { stat, readFile } from "node:fs/promises";
import { readFile as readBinaryFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const archive = await readBinaryFile(zipArtifactPath);
  const entries = [];
  for (let offset = 0; offset + 46 <= archive.length; ) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      offset += 1;
      continue;
    }
    const nameLength = archive.readUInt16LE(offset + 28);
    entries.push(archive.toString("utf8", offset + 46, offset + 46 + nameLength));
    offset +=
      46 + nameLength + archive.readUInt16LE(offset + 30) + archive.readUInt16LE(offset + 32);
  }

  assert.ok(entries.includes("manifest.json"));
  assert.ok(entries.includes("background.js"));
  assert.ok(entries.includes("popup.html"));
});
