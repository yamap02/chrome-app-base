import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const buildDir = path.join(repoRoot, ".output", "chrome-mv3");

class CdpClient {
  #nextId = 1;
  #pending = new Map();

  constructor(ws) {
    this.ws = ws;

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data));
      const pendingRequest = this.#pending.get(payload.id);

      if (!pendingRequest) {
        return;
      }

      this.#pending.delete(payload.id);

      if (payload.error) {
        pendingRequest.reject(new Error(payload.error.message));
        return;
      }

      pendingRequest.resolve(payload.result);
    });
  }

  async close() {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  send(method, params = {}, sessionId) {
    const id = this.#nextId++;

    return new Promise((resolve, reject) => {
      this.#pending.set(id, { reject, resolve });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

async function ensurePathExists(targetPath) {
  await access(targetPath);
}

async function waitFor(callback, { intervalMs = 200, timeoutMs = 15000 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const result = await callback();

    if (result) {
      return result;
    }

    await delay(intervalMs);
  }

  throw new Error(`Timed out after ${timeoutMs} ms`);
}

function resolveChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);

  if (process.platform !== "darwin") {
    candidates.unshift("google-chrome", "google-chrome-stable", "chromium", "chromium-browser");
  }

  return candidates[0];
}

async function connectToBrowser(wsUrl) {
  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  return new CdpClient(ws);
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send(
    "Runtime.evaluate",
    {
      awaitPromise: true,
      expression,
      returnByValue: true,
    },
    sessionId,
  );

  return result.result?.value;
}

async function openPopupTarget(cdp, extensionId) {
  const { targetId } = await cdp.send("Target.createTarget", {
    url: `chrome-extension://${extensionId}/popup.html`,
  });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    flatten: true,
    targetId,
  });

  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);

  return { sessionId, targetId };
}

async function launchChrome() {
  const chromeBinary = resolveChromeBinary();

  if (!chromeBinary) {
    throw new Error("CHROME_BIN not configured");
  }

  await ensurePathExists(buildDir);
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "chrome-extension-base-"));

  return await new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const launchArguments = [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      `--disable-extensions-except=${buildDir}`,
      `--load-extension=${buildDir}`,
      "about:blank",
    ];
    const chromeProcess = spawn(chromeBinary, launchArguments, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      const wsMatch = text.match(
        /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/,
      );

      if (!wsMatch || settled) {
        return;
      }

      settled = true;
      resolve({ chromeProcess, userDataDir, wsUrl: wsMatch[1] });
    };

    chromeProcess.stdout.on("data", onData);
    chromeProcess.stderr.on("data", onData);
    chromeProcess.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk.toString());
    });
    chromeProcess.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk.toString());
    });
    chromeProcess.once("error", async (error) => {
      if (!settled) {
        settled = true;
        await rm(userDataDir, { force: true, recursive: true });
        reject(error);
      }
    });
    chromeProcess.once("exit", async (code) => {
      if (!settled) {
        settled = true;
        await rm(userDataDir, { force: true, recursive: true });
        reject(
          new Error(
            [
              `Chrome exited before DevTools connection: code=${code} signal=${chromeProcess.signalCode}`,
              `stdout=${stdoutChunks.join("").trim() || "<empty>"}`,
              `stderr=${stderrChunks.join("").trim() || "<empty>"}`,
            ].join("\n"),
          ),
        );
      }
    });
  });
}

async function launchChromeWithRetry(maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await launchChrome();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      await delay(500 * attempt);
    }
  }

  throw lastError;
}

test("headless popup smoke", async () => {
  const { chromeProcess, userDataDir, wsUrl } = await launchChromeWithRetry();
  const cdp = await connectToBrowser(wsUrl);

  try {
    const extensionId = await waitFor(async () => {
      const { targetInfos } = await cdp.send("Target.getTargets");
      const extensionTarget = targetInfos.find(
        (targetInfo) =>
          targetInfo.url.startsWith("chrome-extension://") &&
          (targetInfo.type === "service_worker" || targetInfo.type === "background_page"),
      );

      if (!extensionTarget) {
        return null;
      }

      return extensionTarget.url.match(/^chrome-extension:\/\/([a-p]{32})\//)?.[1] ?? null;
    });

    const { sessionId, targetId } = await openPopupTarget(cdp, extensionId);

    await waitFor(async () => {
      const title = await evaluate(
        cdp,
        sessionId,
        "document.querySelector('.hero-title')?.textContent",
      );
      return title === "拡張状態管理" ? title : null;
    });

    await waitFor(async () => {
      const status = await evaluate(
        cdp,
        sessionId,
        "document.querySelector('.footer-status')?.textContent?.trim()",
      );
      return status === "Storage ready" ? status : null;
    });

    const initialLabel = await evaluate(
      cdp,
      sessionId,
      "document.querySelector('button[aria-label=\"拡張機能有効状態切替\"]')?.textContent?.trim()",
    );
    assert.equal(initialLabel, "ON");

    await evaluate(
      cdp,
      sessionId,
      "document.querySelector('button[aria-label=\"拡張機能有効状態切替\"]')?.click()",
    );

    await waitFor(async () => {
      const buttonLabel = await evaluate(
        cdp,
        sessionId,
        "document.querySelector('button[aria-label=\"拡張機能有効状態切替\"]')?.textContent?.trim()",
      );
      return buttonLabel === "OFF" ? buttonLabel : null;
    });

    await cdp.send("Target.closeTarget", { targetId });

    const reopenedPopup = await openPopupTarget(cdp, extensionId);
    await waitFor(async () => {
      const status = await evaluate(
        cdp,
        reopenedPopup.sessionId,
        "document.querySelector('.footer-status')?.textContent?.trim()",
      );
      return status === "Storage ready" ? status : null;
    });

    const persistedLabel = await evaluate(
      cdp,
      reopenedPopup.sessionId,
      "document.querySelector('button[aria-label=\"拡張機能有効状態切替\"]')?.textContent?.trim()",
    );
    assert.equal(persistedLabel, "OFF");
  } finally {
    await cdp.close();
    chromeProcess.kill("SIGTERM");
    await delay(500);
    if (chromeProcess.exitCode === null) {
      chromeProcess.kill("SIGKILL");
    }
    await rm(userDataDir, { force: true, recursive: true });
  }
});
