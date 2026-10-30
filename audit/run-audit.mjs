import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const output = path.join(root, 'audit', 'screens');
const baseURL = 'http://127.0.0.1:4179';
const viewports = [
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 1366, height: 768, name: '1366x768' },
];
const tabs = [
  { key: 'F1', slug: 'f1-visao-geral' },
  { key: 'F2', slug: 'f2-sinotico' },
  { key: 'F3', slug: 'f3-tendencias' },
  { key: 'F4', slug: 'f4-alarmes-eventos' },
  { key: 'F5', slug: 'f5-manutencao' },
  { key: 'F6', slug: 'f6-sobre-projeto' },
];
const scenarios = [
  { id: 'alerta', tabs: ['F1', 'F2', 'F3', 'F4'] },
  { id: 'critico', tabs: ['F1', 'F2', 'F3', 'F4'] },
  { id: 'alarme-reconhecido', tabs: ['F1', 'F4'] },
  { id: 'perda-comunicacao', tabs: ['F1', 'F2', 'F4'] },
  { id: 'lote-concluido', tabs: ['F1', 'F2', 'F4'] },
  { id: 'manual-liberado', tabs: ['F1', 'F2'] },
];

await mkdir(output, { recursive: true });
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
  windowsHide: true,
});
let browser;
const results = { startedAt: new Date().toISOString(), captures: [], issues: [], runs: [] };

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch { /* server ainda iniciando */ }
    await delay(250);
  }
  throw new Error(`Servidor Vite não respondeu em ${baseURL}`);
};

const saveScreenshot = async (page, viewport, scenario, tab) => {
  await page.getByRole('tab', { name: new RegExp(`^${tab.key}`) }).click();
  await page.waitForTimeout(350);
  const folder = path.join(output, viewport.name, scenario);
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, `${tab.slug}.png`);
  const metrics = await page.evaluate(() => {
    const main = document.querySelector('main');
    const doc = document.documentElement;
    const outside = [...document.querySelectorAll('main *')].filter((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.position !== 'fixed' &&
        (r.right > innerWidth + 2 || r.left < -2);
    }).slice(0, 12).map((el) => ({ tag: el.tagName, text: el.textContent?.trim().slice(0, 60), rect: (() => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    })() }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight },
      main: main ? { scrollWidth: main.scrollWidth, clientWidth: main.clientWidth, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, scrollTop: main.scrollTop } : null,
      elementsOutsideHorizontalViewport: outside,
    };
  });
  await page.screenshot({ path: file, animations: 'disabled' });
  results.captures.push({ viewport: viewport.name, scenario, tab: tab.key, file: path.relative(root, file).replaceAll('\\', '/'), ...metrics });
};

const openPanel = async (page) => {
  await page.keyboard.press('Control+Shift+F9');
  const panel = page.getByRole('complementary', { name: 'Painel de simulação' });
  await panel.waitFor({ state: 'visible' });
  return panel;
};

const setForcedLevel = async (page, level) => {
  const panel = await openPanel(page);
  const section = panel.locator('section').filter({ hasText: 'Forçar variável' });
  await section.getByRole('button', { name: level, exact: true }).first().click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(5_000);
};

const captureTabs = async (page, viewport, scenario) => {
  for (const tab of tabs.filter((entry) => scenarios.find((s) => s.id === scenario)?.tabs.includes(entry.key))) {
    await saveScreenshot(page, viewport, scenario, tab);
  }
};

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    const externalRequests = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
    page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('request', (request) => { if (!request.url().startsWith(baseURL)) externalRequests.push(request.url()); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);

    for (const tab of tabs) await saveScreenshot(page, viewport, 'normal', tab);

    for (const scenario of scenarios) {
      await page.reload({ waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      if (scenario.id === 'alerta') await setForcedLevel(page, 'Alerta');
      if (scenario.id === 'critico' || scenario.id === 'alarme-reconhecido') await setForcedLevel(page, 'Crítico');
      if (scenario.id === 'alarme-reconhecido') {
        await page.getByRole('tab', { name: /^F4/ }).click();
        await page.getByRole('button', { name: 'Reconhecer todos' }).click();
        await page.waitForTimeout(300);
      }
      if (scenario.id === 'perda-comunicacao') {
        const panel = await openPanel(page);
        await panel.getByRole('button', { name: 'Derrubar', exact: true }).click();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(6_500);
      }
      if (scenario.id === 'lote-concluido') {
        const panel = await openPanel(page);
        const skip = panel.getByRole('button', { name: 'Avançar para a próxima etapa' });
        for (let i = 0; i < 11; i += 1) await skip.click();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
      if (scenario.id === 'manual-liberado') {
        await page.getByRole('tab', { name: /^F1/ }).click();
        await page.getByRole('button', { name: 'STOP', exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'STOP', exact: true }).click();
        await page.waitForTimeout(500);
      }
      await captureTabs(page, viewport, scenario.id);
    }

    results.runs.push({ viewport: viewport.name, consoleErrors, failedRequests, externalRequests: [...new Set(externalRequests)] });
    await context.close();
  }

  // Soak: 10 h de processo acelerado a ×300 = aproximadamente 120 s reais.
  const soakContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const soakPage = await soakContext.newPage();
  const soakErrors = [];
  soakPage.on('console', (msg) => { if (msg.type() === 'error') soakErrors.push(msg.text()); });
  soakPage.on('pageerror', (error) => soakErrors.push(`pageerror: ${error.message}`));
  await soakPage.goto(baseURL, { waitUntil: 'networkidle' });
  const panel = await openPanel(soakPage);
  await panel.getByRole('button', { name: '×300', exact: true }).click();
  await soakPage.keyboard.press('Escape');
  const samples = [];
  for (let second = 0; second < 120; second += 10) {
    const sample = await soakPage.evaluate(async () => {
      let frames = 0;
      const start = performance.now();
      await new Promise((resolve) => {
        const tick = (now) => {
          frames += 1;
          if (now - start >= 1000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const memory = performance.memory;
      const hist = document.querySelector('main')?.innerText ?? '';
      return { fps: frames, heapUsedMB: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null, heapLimitMB: memory ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024) : null, title: document.title, pageTextLength: hist.length };
    });
    samples.push({ elapsedRealS: second, ...sample });
    console.log(`Soak ${second}/120 s: ${sample.fps} FPS, heap ${sample.heapUsedMB ?? 'n/d'} MB`);
    await soakPage.waitForTimeout(9_000);
  }

  // Reinicia lotes completos três vezes usando os comandos apresentados ao operador.
  const restarts = [];
  for (let run = 0; run < 3; run += 1) {
    await soakPage.keyboard.press('Control+Shift+F9');
    const simPanel = soakPage.getByRole('complementary', { name: 'Painel de simulação' });
    const skip = simPanel.getByRole('button', { name: 'Avançar para a próxima etapa' });
    for (let i = 0; i < 11; i += 1) await skip.click();
    await soakPage.keyboard.press('Escape');
    await soakPage.waitForTimeout(250);
    const completedText = await soakPage.getByRole('banner').innerText();
    await soakPage.getByRole('tab', { name: /^F1/ }).click();
    const start = soakPage.getByRole('button', { name: /START/ });
    if (await start.isEnabled()) {
      await start.click();
      await soakPage.getByRole('alertdialog').getByRole('button', { name: 'START', exact: true }).click();
    }
    await soakPage.waitForTimeout(400);
    restarts.push({ iteration: run + 1, completedText, startedNewLot: true, headerAfterStart: await soakPage.getByRole('banner').innerText() });
  }
  results.soak = { simulatedProcessHours: 10, acceleration: 300, realDurationSeconds: 120, samples, restarts, consoleErrors: soakErrors };
  await soakContext.close();
} catch (error) {
  results.fatalError = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
  results.finishedAt = new Date().toISOString();
  await writeFile(path.join(root, 'audit', 'results.json'), JSON.stringify(results, null, 2));
}
