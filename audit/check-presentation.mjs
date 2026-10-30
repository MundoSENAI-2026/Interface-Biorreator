import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const url = 'http://127.0.0.1:4180';
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '4180', '--strictPort'], { stdio: 'ignore', windowsHide: true });
let browser;
const result = { viewport: '1920x1080', checks: {} };

try {
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(url)).ok) break; } catch { /* wait */ }
    await delay(250);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (msg) => { if (msg.type() === 'error') (result.consoleErrors ??= []).push(msg.text()); });
  page.on('pageerror', (error) => (result.consoleErrors ??= []).push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.keyboard.press('p');
  await delay(300);
  result.checks.fullscreenEntered = await page.evaluate(() => Boolean(document.fullscreenElement));
  await delay(3_300);
  result.checks.cursorHiddenAfterConfiguredDelay = await page.evaluate(() => document.documentElement.classList.contains('hide-cursor'));
  await mkdir(path.join(root, 'audit', 'screens', 'presentation'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'audit', 'screens', 'presentation', 'presentation-mode.png') });
  await page.waitForTimeout(17_000);
  result.checks.rotatedFromF1ToF2 = await page.getByRole('tab', { name: /^F2/ }).getAttribute('aria-selected') === 'true';
  await page.keyboard.press('p');
  await delay(150);
  result.checks.fullscreenExited = !(await page.evaluate(() => Boolean(document.fullscreenElement)));
  await browser.close();
  browser = undefined;
} catch (error) {
  result.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
  result.finishedAt = new Date().toISOString();
  await writeFile(path.join(root, 'audit', 'presentation-results.json'), JSON.stringify(result, null, 2));
}
