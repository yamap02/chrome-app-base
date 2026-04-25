import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const manifestPath = path.join(repoRoot, ".output", "chrome-mv3", "manifest.json");

async function loadManifest() {
  const manifestSource = await readFile(manifestPath, "utf8");
  return JSON.parse(manifestSource);
}

test("manifest 契約維持", async () => {
  const manifest = await loadManifest();

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Chrome Extension Base");
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.action?.default_popup, "popup.html");
  assert.equal(manifest.background?.service_worker, "background.js");
  assert.ok(
    manifest.content_scripts?.some((contentScript) =>
      contentScript.matches?.includes("https://*.example.com/*"),
    ),
  );
});
