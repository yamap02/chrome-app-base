import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const metadata = await readFile("utils/metadata.ts", "utf8");

assert.notEqual(packageJson.version, "0.0.0", "公開前に package version を設定してください");
assert(!metadata.includes("example.com"), "公開前に example.com の placeholder を置換してください");
assert(!metadata.includes("Chrome Extension Base"), "公開前に雛形名を置換してください");
console.log("Release preflight passed");
