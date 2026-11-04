import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';

/*
 * Auditoria de layout: F1–F6 em 1920×1080 e 1366×768, nos modos Simulação e
 * Biorreator real. Falha se algum texto visível estiver cortado (reticências,
 * line-clamp ou conteúdo mais largo que a caixa), mesmo com tooltip.
 *
 * Biorreator real: um broker MQTT falso responde dentro do navegador e publica um
 * ciclo parecido com o do equipamento (nada sai para broker.hivemq.com).
 */

const TABS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];
const VIEWPORTS = [
  { width: 1920, height: 1080, fits: true },
  // Abaixo da altura mínima das telas o <main> rola (notebook); o resto vale igual
  { width: 1366, height: 768, fits: false },
];
const MODES = ['simulacao', 'real'] as const;
/** Telas que cabem sem rolagem mesmo no notebook (indicadores sem corte no rodapé). */
const FIT_ON_LAPTOP = ['F3'];

// ─── Broker MQTT falso (biorreator real) ──────────────────────────────────

const TOPIC = 'senai661/appiot/biorreator';
const ANALOG_TOPIC = `${TOPIC}/a`;
const PHASES = {
  Produção: true,
  '1_Abastecimento_ok': true,
  '2_Agitação_ok': true,
  '3_Check_Pressão_ok': false,
  '4_Alivio_Pressão_ok': false,
  '5_Esterilização_ok': false,
  '6_Resfriamento_ok': false,
  '7_Adição_Cultura_ok': false,
  '8_Mistura_Calda_ok': false,
  '9_Adição_Micro_ok': false,
  '10_Fermentação_Temp': false,
  '11_Fim_Produção': false,
};

function varint(n: number) {
  const out: number[] = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
}

function publishPacket(topic: string, payload: string, retained = false) {
  const t = Buffer.from(topic, 'utf8');
  const body = Buffer.concat([Buffer.from([t.length >> 8, t.length & 0xff]), t, Buffer.from(payload, 'utf8')]);
  return Buffer.concat([Buffer.from([0x30 | (retained ? 1 : 0), ...varint(body.length)]), body]);
}

async function fakeBroker(page: Page) {
  const clients: WebSocketRoute[] = [];
  await page.routeWebSocket(/hivemq/, (ws) => {
    clients.push(ws);
    ws.onMessage((m) => {
      const b = Buffer.isBuffer(m) ? m : Buffer.from(m);
      const type = b[0] >> 4;
      if (type === 1) ws.send(Buffer.from([0x20, 0x02, 0x00, 0x00])); // CONNACK
      if (type === 12) ws.send(Buffer.from([0xd0, 0x00])); // PINGRESP
      if (type === 8) {
        // SUBACK + mensagem retida antiga (como no broker real)
        let i = 1;
        while (b[i] & 0x80) i++;
        i++;
        ws.send(Buffer.from([0x90, 0x03, b[i], b[i + 1], 0x00]));
        const topic = b.subarray(i + 4, i + 4 + ((b[i + 2] << 8) | b[i + 3])).toString('utf8');
        ws.send(publishPacket(topic, '{"TIT_100_01": 58}', true));
      }
    });
  });
  let tick = 0;
  const timer = setInterval(() => {
    tick += 1;
    // Pressão fora da escala uma vez (o equipamento já mandou 2,999); depois acima do alerta
    // da etapa Check Pressão (0,70), para a tela ter um alarme ativo
    const pressure = tick === 3 ? 2.999131917953491 : 0.7518228769302368 + tick * 0.001;
    for (const ws of clients) {
      for (const [k, v] of Object.entries(PHASES)) ws.send(publishPacket(TOPIC, JSON.stringify({ [k]: v })));
      ws.send(publishPacket(ANALOG_TOPIC, JSON.stringify([
        { PIT_100_01: pressure, LIT_100_01: 63.41869354248047, TIT_100_01: 26.558881759643555, 'AIT_100-01': 7.595485687255859 },
      ])));
    }
  }, 1000);
  return () => clearInterval(timer);
}

// ─── Auditoria de uma tela ────────────────────────────────────────────────

async function audit(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    const cards = [...document.querySelectorAll<HTMLElement>('[data-layout-card]')];
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
    };
    const describe = (element: HTMLElement, reason: string) => ({
      reason,
      tag: element.tagName,
      text: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      size: `${element.scrollWidth}/${element.clientWidth}×${element.scrollHeight}/${element.clientHeight}`,
      className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
    });

    const overflows = cards.flatMap((card, cardIndex) => {
      const bounds = card.getBoundingClientRect();
      return [...card.querySelectorAll<HTMLElement>('*')].filter((element) => {
        if (!visible(element)) return false;
        if (element.closest('[data-layout-card]') !== card) return false;
        if (getComputedStyle(element).position === 'fixed') return false;
        const rect = element.getBoundingClientRect();
        return rect.left < bounds.left - 1 || rect.top < bounds.top - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1;
      }).slice(0, 12).map((element) => ({ cardIndex, ...describe(element, 'fora do card') }));
    });

    const internalScroll = cards.filter((card) => card.scrollHeight > card.clientHeight + 1).map((card) => ({
      title: card.querySelector('h2')?.textContent?.trim() ?? '(card sem título)',
      scrollHeight: card.scrollHeight,
      clientHeight: card.clientHeight,
    }));

    // Texto cortado: reticências, line-clamp ou conteúdo mais largo que a caixa. Tooltip não justifica.
    const scope = [...(header?.querySelectorAll<HTMLElement>('*') ?? []), ...(main?.querySelectorAll<HTMLElement>('*') ?? [])];
    const truncated = scope.filter((element) => {
      if (element instanceof SVGElement || element.closest('svg')) return false;
      if (!visible(element) || !element.textContent?.trim()) return false;
      if (element.closest('.sr-only, [role="tooltip"]')) return false;
      return true;
    }).flatMap((element) => {
      const style = getComputedStyle(element);
      const wider = element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1;
      if (style.textOverflow === 'ellipsis' && wider) return [describe(element, 'reticências')];
      const clamp = style.getPropertyValue('-webkit-line-clamp');
      if (clamp && clamp !== 'none' && element.scrollHeight > element.clientHeight + 1) return [describe(element, 'line-clamp')];
      if (wider && element !== main) return [describe(element, 'mais largo que a caixa')];
      return [];
    }).slice(0, 25);

    return {
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      mainHeight: main?.clientHeight ?? 0,
      mainScrollHeight: main?.scrollHeight ?? 0,
      internalScroll,
      overflows,
      truncated,
    };
  });
}

for (const mode of MODES) {
  for (const viewport of VIEWPORTS) {
    const name = `${mode === 'real' ? 'Biorreator real' : 'Simulação'} · ${viewport.width}×${viewport.height}`;
    test(`F1–F6 sem texto cortado nem vazamento · ${name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const stopBroker = mode === 'real' ? await fakeBroker(page) : () => {};
      await page.addInitScript((m) => localStorage.setItem('br100.fonteDeDados', m), mode);
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      if (mode === 'real') {
        await expect(page.locator('header').first()).toContainText('Online', { timeout: 15_000 });
        await page.waitForTimeout(3500); // inclui a leitura fora da escala no histórico
      }

      // LAYOUT_TABS=F4,F3 restringe as telas (útil durante o ajuste de uma tela)
      const only = process.env.LAYOUT_TABS?.split(',').map((t) => t.trim().toUpperCase());
      for (const key of TABS.filter((t) => !only || only.includes(t))) {
        await page.getByRole('tab', { name: new RegExp(`^${key}`) }).click();
        await page.waitForTimeout(300);
        const result = await audit(page);
        const where = `${name} · ${key}`;
        console.log(`[layout] ${where}: ${result.truncated.length} corte(s), ${result.overflows.length} vazamento(s), ${result.internalScroll.length} rolagem(ns) interna(s)`);
        if (process.env.LAYOUT_SHOTS) await page.screenshot({ path: `${process.env.LAYOUT_SHOTS}/${mode}-${viewport.width}-${key}.png` });
        if (process.env.LAYOUT_DUMP) console.log(JSON.stringify({ where, truncated: result.truncated, overflows: result.overflows, internalScroll: result.internalScroll }));

        expect.soft(result.documentWidth, `${where}: rolagem horizontal da página`).toBeLessThanOrEqual(result.viewportWidth);
        if (viewport.fits || FIT_ON_LAPTOP.includes(key)) {
          expect.soft(result.documentHeight, `${where}: rolagem vertical da página`).toBeLessThanOrEqual(result.viewportHeight);
          expect.soft(result.mainScrollHeight, `${where}: rolagem vertical na área da tela`).toBeLessThanOrEqual(result.mainHeight + 1);
        }
        expect.soft(result.internalScroll, `${where}: rolagem interna em card`).toEqual([]);
        expect.soft(result.overflows, `${where}: conteúdo fora do card`).toEqual([]);
        expect.soft(result.truncated, `${where}: texto cortado`).toEqual([]);
      }
      stopBroker();
    });
  }
}
